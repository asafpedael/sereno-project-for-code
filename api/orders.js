// GET /api/orders: staff order lists and order details (ARCHITECTURE section 5.1).
// M3: manager only, view=inbox and id=<uuid>. M5: the inbox also holds "needs_clarification"
// orders and approved orders with a flight time change (soonest departure first).
// M4: view=approved for the manager and the field agent (the agent gets the limited view).
// M6: every manager view says whether the customer is returning (decision 11), and the
// order details add the customer's previous orders (up to 5).
// M7: view=archive for both roles (manager: every status; agent: approved and completed,
// limited view), with search, status and departure-date filters and 50 rows per page.
import { getSupabase } from '../lib/supabase.js';
import { withHandler, sendOk, sendError } from '../lib/http.js';
import { requireStaff } from '../lib/auth.js';
import { isUuid, validateArchiveQuery } from '../lib/validate.js';
import { israelDayRange } from '../lib/time.js';
import {
  ORDER_SELECT, HISTORY_SELECT, MAX_PREVIOUS_ORDERS, toManagerView, toAgentView, byDeparture, byMeetingTime,
  flightChangePending, completedByCustomer, isReturningCustomer,
  archiveStatuses, archiveSearchConditions, archiveDateConditions, combineOrGroups,
} from '../lib/orders-view.js';

const PAGE_SIZE = 50;
const MAX_APPROVED_CHECKED = 500; // demo volumes are small
const MAX_FLIGHTS_IN_RANGE = 1000;
const MANAGER_ONLY = 'You do not have permission for this action.';

// One query for the whole list (plan D6): the "completed" orders of the customers in it.
async function completedMapFor(rows) {
  const customerIds = [...new Set(rows.map((r) => r.customer_id).filter(Boolean))];
  if (customerIds.length === 0) return new Map();
  const { data, error } = await getSupabase()
    .from('orders')
    .select('id, customer_id')
    .eq('status', 'completed')
    .in('customer_id', customerIds);
  if (error) throw error;
  return completedByCustomer(data);
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

// Archive (plan D6, D8-D10): newest order first, 50 rows per page, exact total.
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
  const { data, error, count } = await build(ORDER_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(start, start + PAGE_SIZE - 1);

  if (error && error.code === 'PGRST103') {
    // A page past the end: no rows, but still the real total.
    const counted = await build('id', { count: 'exact', head: true });
    if (counted.error) throw counted.error;
    return sendOk(res, { orders: [], page, page_size: PAGE_SIZE, total: counted.count || 0 });
  }
  if (error) throw error;

  const orders = staff.role === 'agent' ? data.map(toAgentView) : await managerViews(data);
  return sendOk(res, { orders, page, page_size: PAGE_SIZE, total: count || 0 });
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
