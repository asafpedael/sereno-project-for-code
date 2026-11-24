// GET /api/orders: staff order lists and order details (ARCHITECTURE section 5.1).
// M3: manager only, view=inbox and id=<uuid>. M5: the inbox also holds "needs_clarification"
// orders and approved orders with a flight time change (soonest departure first).
// M4: view=approved for the manager and the field agent (the agent gets the limited view).
// M6: every manager view says whether the customer is returning (decision 11), and the
// order details add the customer's previous orders (up to 5).
// M7: view=archive for both roles (manager: every status; agent: approved and completed,
// limited view), with search, status and departure-date filters and 50 rows per page.
// M8: the archive reply adds "stats" for the summary cards, counted over every matching order.
import { getSupabase } from '../lib/supabase.js';
import { withHandler, sendOk, sendError } from '../lib/http.js';
import { requireStaff } from '../lib/auth.js';
import { isUuid, validateArchiveQuery } from '../lib/validate.js';
import { israelDayRange } from '../lib/time.js';
import {
  ORDER_SELECT, HISTORY_SELECT, MAX_PREVIOUS_ORDERS, toManagerView, toAgentView, byDeparture, byMeetingTime,
  flightChangePending, completedByCustomer, isReturningCustomer,
  archiveStatuses, archiveSearchConditions, archiveDateConditions, combineOrGroups, archiveStats,
} from '../lib/orders-view.js';

const PAGE_SIZE = 50;
const MAX_APPROVED_CHECKED = 500; // demo volumes are small
const MAX_FLIGHTS_IN_RANGE = 1000;
const MANAGER_ONLY = 'You do not have permission for this action.';
const STATS_CHUNK = 1000; // Supabase answers at most 1000 rows per request
const MAX_STATS_CHUNKS = 20;
const CUSTOMER_ID_CHUNK = 200; // keeps the request address short

// One query for the whole list (plan D6): the "completed" orders of the customers in it.
// M8: the customer ids are sent in groups, because the archive statistics may hold many.
async function completedMapFor(rows) {
  const customerIds = [...new Set(rows.map((r) => r.customer_id).filter(Boolean))];
  const found = [];
  for (let i = 0; i < customerIds.length; i += CUSTOMER_ID_CHUNK) {
    const { data, error } = await getSupabase()
      .from('orders')
      .select('id, customer_id')
      .eq('status', 'completed')
      .in('customer_id', customerIds.slice(i, i + CUSTOMER_ID_CHUNK));
    if (error) throw error;
    found.push(...data);
  }
  return completedByCustomer(found);
}

// Manager views of a list, each with is_returning_customer.
async function managerViews(rows) {
  const completed = await completedMapFor(rows);
  return rows.map((row) => toManagerView(row, { returning: isReturningCustomer(row, completed) }));
}

// Ids of the flights departing inside the Israel days from..to (either end may be open).
async function flightIdsBetween(from, to) {
  let query = getSupabase().from('flights').select('id');
  if (from) query = query.gte('departure_at', israelDayRange(from).start);
  if (to) query = query.lt('departure_at', israelDayRange(to).end);
  const { data, error } = await query.limit(MAX_FLIGHTS_IN_RANGE);
  if (error) throw error;
  return data.map((f) => f.id);
}

// M8 (plan D2): id, status and customer of every order matching the archive filters,
// read in chunks of 1000 rows.
async function allMatching(build) {
  const rows = [];
  for (let chunk = 0; chunk < MAX_STATS_CHUNKS; chunk += 1) {
    const start = chunk * STATS_CHUNK;
    const { data, error } = await build('id, status, customer_id')
      .order('id', { ascending: true })
      .range(start, start + STATS_CHUNK - 1);
    if (error && error.code === 'PGRST103') break; // past the end
    if (error) throw error;
    rows.push(...data);
    if (data.length < STATS_CHUNK) return rows;
  }
  console.warn('Archive statistics: more matching orders than were read.');
  return rows;
}

// Archive (plan D6, D8-D10): newest order first, 50 rows per page, exact total.
// M8: plus the summary cards (stats) over all matching orders, not only the page.
async function archive(staff, req, res) {
  const parsed = validateArchiveQuery(req.query);
  if (parsed.error) return sendError(res, 400, 'bad_request', parsed.error);
  const { q, flightQ, status, from, to, page } = parsed.value;

  const allowed = archiveStatuses(staff.role);
  const flightIds = from || to ? await flightIdsBetween(from, to) : [];
  const orFilter = combineOrGroups([
    archiveSearchConditions(q, flightQ),
    archiveDateConditions(flightIds, from, to),
  ]);

  const build = (select, options) => {
    let query = getSupabase().from('orders').select(select, options).in('status', allowed);
    if (status) query = query.eq('status', status);
    if (orFilter) query = query.or(orFilter);
    return query;
  };

  const start = (page - 1) * PAGE_SIZE;
  const [pageResult, matching] = await Promise.all([
    build(ORDER_SELECT, { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(start, start + PAGE_SIZE - 1),
    allMatching(build),
  ]);
  const { data, error, count } = pageResult;
  // The manager's returning flags: one map for the cards and the page rows, so they agree.
  const completed = staff.role === 'manager' ? await completedMapFor(matching) : null;
  const stats = archiveStats(matching, completed, staff.role);

  if (error && error.code === 'PGRST103') {
    // A page past the end: no rows, but still the real total.
    return sendOk(res, { orders: [], page, page_size: PAGE_SIZE, total: matching.length, stats });
  }
  if (error) throw error;

  const orders = staff.role === 'agent'
    ? data.map(toAgentView)
    : data.map((row) => toManagerView(row, { returning: isReturningCustomer(row, completed) }));
  return sendOk(res, { orders, page, page_size: PAGE_SIZE, total: count || 0, stats });
}

export default withHandler(['GET'], async (req, res) => {
  const staff = await requireStaff(req, res, ['manager', 'agent']);
  if (!staff) return;

  const { id, view } = req.query;

  if (id !== undefined) {
    if (staff.role !== 'manager') return sendError(res, 403, 'forbidden', MANAGER_ONLY);
    if (!isUuid(id)) return sendError(res, 400, 'bad_request', 'Order id is not valid.');
    const { data, error } = await getSupabase()
      .from('orders')
      .select(ORDER_SELECT)
      .eq('id', id.toLowerCase())
      .maybeSingle();
    if (error) throw error;
    if (!data) return sendError(res, 404, 'not_found', 'Order not found.');

    // Customer history (plan D7): the other orders of the same customer, newest first.
    const [history, completed] = await Promise.all([
      getSupabase()
        .from('orders')
        .select(HISTORY_SELECT)
        .eq('customer_id', data.customer_id)
        .neq('id', data.id)
        .order('created_at', { ascending: false })
        .limit(MAX_PREVIOUS_ORDERS),
      completedMapFor([data]),
    ]);
    if (history.error) throw history.error;
    return sendOk(res, {
      order: toManagerView(data, { returning: isReturningCustomer(data, completed), previousOrders: history.data }),
    });
  }

  if (view === 'approved') {
    const { data, error } = await getSupabase()
      .from('orders')
      .select(ORDER_SELECT)
      .eq('status', 'approved')
      .order('final_time', { ascending: true })
      .limit(PAGE_SIZE);
    if (error) throw error;
    const orders = staff.role === 'agent' ? data.map(toAgentView) : await managerViews(data);
    return sendOk(res, { orders: orders.sort(byMeetingTime), page: 1 });
  }

  if (view === 'archive') return archive(staff, req, res);

  if (view !== 'inbox') return sendError(res, 400, 'bad_request', 'Unknown view.');
  if (staff.role !== 'manager') return sendError(res, 403, 'forbidden', MANAGER_ONLY);

  // Inbox (plan D6): orders waiting for a decision, plus approved orders whose flight time
  // changed. The change is checked in code on each read (ARCHITECTURE section 2, no trigger).
  const [waiting, approved] = await Promise.all([
    getSupabase()
      .from('orders')
      .select(ORDER_SELECT)
      .in('status', ['pending', 'needs_clarification'])
      .order('created_at', { ascending: true })
      .limit(PAGE_SIZE),
    getSupabase()
      .from('orders')
      .select(ORDER_SELECT)
      .eq('status', 'approved')
      .not('flight_id', 'is', null)
      .not('approved_departure_at', 'is', null)
      .order('created_at', { ascending: true })
      .limit(MAX_APPROVED_CHECKED),
  ]);
  if (waiting.error) throw waiting.error;
  if (approved.error) throw approved.error;

  const rows = [...waiting.data, ...approved.data.filter(flightChangePending)];
  sendOk(res, { orders: (await managerViews(rows)).sort(byDeparture), page: 1 });
});
