// POST /api/order-decision: decisions on an order (ARCHITECTURE section 5.1).
// M3: the manager approves or rejects a pending order.
// M4: the field agent marks an approved order completed (action "complete", agent only), and
// the customer gets an email after approve/reject, sent only once the decision is saved.
// A failed email never undoes the decision: the reply says email_sent: false (decision 10).
import { getSupabase } from '../lib/supabase.js';
import { withHandler, sendOk, sendError } from '../lib/http.js';
import { requireStaff, roleMayDecide } from '../lib/auth.js';
import { validateDecisionBody } from '../lib/validate.js';
import { ORDER_SELECT, toManagerView, toAgentView } from '../lib/orders-view.js';
import { meetingTime } from '../public/js/meeting-time.js';
import { notify, approvedEmailPayload, rejectedEmailPayload } from '../lib/notify.js';

const BEFORE_DEPARTURE = 'Meeting time must be before departure';
const ALREADY_DECIDED = 'This order was already decided.';
const NOT_COMPLETABLE = 'This order is not approved or was already completed.';

function readBody(req) {
  try {
    return req.body;
  } catch {
    return undefined; // invalid JSON
  }
}

// Reads one order with the customer's email and the flight.
async function readOrder(orderId) {
  const { data, error } = await getSupabase()
    .from('orders').select(ORDER_SELECT).eq('id', orderId).maybeSingle();
  if (error) throw error;
  return data;
}

// Runs a conditional-update function and returns the updated row with the customer and
// flight, or null when it changed nothing (409).
async function runUpdate(fn, params) {
  const { data: rows, error } = await getSupabase().rpc(fn, params);
  if (error) throw error;
  if (!rows || rows.length === 0) return null;
  return readOrder(params.p_order_id);
}

export default withHandler(['POST'], async (req, res) => {
  const staff = await requireStaff(req, res, ['manager', 'agent']);
  if (!staff) return;

  const body = readBody(req);
  const action = body && typeof body === 'object' ? body.action : undefined;
  if (!roleMayDecide(staff.role, action)) {
    return sendError(res, 403, 'forbidden', 'You do not have permission for this action.');
  }

  const checked = validateDecisionBody(body);
  if (checked.error) return sendError(res, 400, 'bad_request', checked.error);
  const { order_id: orderId, final_time: requestedFinal } = checked.value;

  const order = await readOrder(orderId);
  if (!order) return sendError(res, 404, 'not_found', 'Order not found.');

  // Field agent: approved -> completed (FR-41, decision 8). No email.
  if (action === 'complete') {
    if (order.status !== 'approved') return sendError(res, 409, 'conflict', NOT_COMPLETABLE);
    const updated = await runUpdate('complete_order', { p_order_id: orderId });
    if (!updated) return sendError(res, 409, 'conflict', NOT_COMPLETABLE);
    return sendOk(res, { order: toAgentView(updated) });
  }

  let updated;
  if (action === 'reject') {
    if (order.status !== 'pending') return sendError(res, 409, 'conflict', ALREADY_DECIDED);
    updated = await runUpdate('decide_order', {
      p_order_id: orderId, p_from: ['pending'], p_to: 'rejected',
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
    updated = await runUpdate('decide_order', {
      p_order_id: orderId, p_from: ['pending'], p_to: 'approved',
      p_final_time: finalTime.toISOString(), p_notes: null,
      p_departure: departure.toISOString(), p_recommended: recommended.toISOString(),
    });
  }

  if (!updated) return sendError(res, 409, 'conflict', ALREADY_DECIDED);

  const payload = action === 'approve' ? approvedEmailPayload(updated) : rejectedEmailPayload(updated);
  const emailSent = await notify(payload);
  sendOk(res, { order: toManagerView(updated), email_sent: emailSent });
});
