// GET /api/orders: staff order lists and order details (ARCHITECTURE section 5.1).
// M3: manager only, view=inbox and id=<uuid>. M5: the inbox also holds "needs_clarification"
// orders and approved orders with a flight time change (soonest departure first).
// M4: view=approved for the manager and the field agent (the agent gets the limited view).
// M6: every manager view says whether the customer is returning (decision 11), and the
// order details add the customer's previous orders (up to 5).
// The archive (view=archive) comes in M7.
import { getSupabase } from '../lib/supabase.js';
import { withHandler, sendOk, sendError } from '../lib/http.js';
import { requireStaff } from '../lib/auth.js';
import { isUuid } from '../lib/validate.js';
import {
  ORDER_SELECT, HISTORY_SELECT, MAX_PREVIOUS_ORDERS, toManagerView, toAgentView, byDeparture, byMeetingTime,
  flightChangePending, completedByCustomer, isReturningCustomer,
} from '../lib/orders-view.js';

const PAGE_SIZE = 50;
const MAX_APPROVED_CHECKED = 500; // demo volumes are small
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
