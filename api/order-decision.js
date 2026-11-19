// POST /api/order-decision: the manager approves or rejects a pending order (ARCHITECTURE section 5.1).
// M3: approve and reject only, manager only (an agent gets 403). No customer email yet (M4).
import { getSupabase } from '../lib/supabase.js';
import { withHandler, sendOk, sendError } from '../lib/http.js';
import { requireStaff } from '../lib/auth.js';
import { validateDecisionBody } from '../lib/validate.js';
import { ORDER_SELECT, toManagerView } from '../lib/orders-view.js';
import { meetingTime } from '../public/js/meeting-time.js';

const BEFORE_DEPARTURE = 'Meeting time must be before departure';
const ALREADY_DECIDED = 'This order was already decided.';

function readBody(req) {
  try {
    return req.body;
  } catch {
    return undefined; // invalid JSON
  }
}

// Runs decide_order and returns the updated row with the customer and flight, or null (409).
async function decide(orderId, params) {
  const { data: rows, error } = await getSupabase().rpc('decide_order', { p_order_id: orderId, ...params });
  if (error) throw error;
  if (!rows || rows.length === 0) return null;
  const { data, error: readError } = await getSupabase()
    .from('orders').select(ORDER_SELECT).eq('id', orderId).single();
  if (readError) throw readError;
  return data;
}

export default withHandler(['POST'], async (req, res) => {
  const staff = await requireStaff(req, res, ['manager']);
  if (!staff) return;

  const checked = validateDecisionBody(readBody(req));
  if (checked.error) return sendError(res, 400, 'bad_request', checked.error);
  const { order_id: orderId, action, final_time: requestedFinal } = checked.value;

  const { data: order, error } = await getSupabase()
    .from('orders').select(ORDER_SELECT).eq('id', orderId).maybeSingle();
  if (error) throw error;
  if (!order) return sendError(res, 404, 'not_found', 'Order not found.');

  let updated;
  if (action === 'reject') {
    if (order.status !== 'pending') return sendError(res, 409, 'conflict', ALREADY_DECIDED);
    updated = await decide(orderId, {
      p_from: ['pending'], p_to: 'rejected',
      p_final_time: null, p_notes: null, p_departure: null, p_recommended: null,
    });
  } else {
    if (order.status !== 'pending') return sendError(res, 409, 'conflict', ALREADY_DECIDED);
    if (!order.flight_id || !order.flight) {
      return sendError(res, 409, 'conflict', 'This order can no longer be approved.');
    }
    // FR-42: always from the flight's current departure, read now.
    const departure = new Date(order.flight.departure_at);
    const recommended = meetingTime(departure, order.travelers, order.bags);
    const finalTime = requestedFinal || recommended;
    if (finalTime.getTime() >= departure.getTime()) {
      return sendError(res, 400, 'bad_request', BEFORE_DEPARTURE);
    }
    updated = await decide(orderId, {
      p_from: ['pending'], p_to: 'approved',
      p_final_time: finalTime.toISOString(), p_notes: null,
      p_departure: departure.toISOString(), p_recommended: recommended.toISOString(),
    });
  }

  if (!updated) return sendError(res, 409, 'conflict', ALREADY_DECIDED);
  sendOk(res, { order: toManagerView(updated) });
});
