// POST /api/order-decision: decisions on an order (ARCHITECTURE section 5.1).
// M3: the manager approves or rejects a pending order.
// M4: the field agent marks an approved order completed (action "complete", agent only), and
// the customer gets an email after approve/reject, sent only once the decision is saved.
// A failed email never undoes the decision: the reply says email_sent: false (decision 10).
// M5: reject from "needs_clarification", confirm_flight_missing (clarification email) and
// approve/ignore of a flight time change.
// M6: add_note (manager, any status, no email), and manager_notes saved with approve/reject.
// M9: approve may assign a field agent (agent_id), assign_agent changes it on an approved
// order, and an agent may complete only an order assigned to him or to nobody.
import { getSupabase } from '../lib/supabase.js';
import { withHandler, sendOk, sendError } from '../lib/http.js';
import { requireStaff, roleMayDecide } from '../lib/auth.js';
import { validateDecisionBody } from '../lib/validate.js';
import {
  ORDER_SELECT, toManagerView, toAgentView, flightChangePending, clarificationSent,
  completedByCustomer, isReturningCustomer, isAgentUser,
} from '../lib/orders-view.js';
import { meetingTime } from '../public/js/meeting-time.js';
import {
  notify, approvedEmailPayload, rejectedEmailPayload, clarificationEmailPayload, flightChangeEmailPayload,
} from '../lib/notify.js';
import { fixedClarificationParagraph, buildClarificationInput } from '../lib/prompts.js';
import { generateClarificationDraft } from '../lib/ai.js';
import { formatDateOnly } from '../lib/time.js';

const BEFORE_DEPARTURE = 'Meeting time must be before departure';
const ALREADY_DECIDED = 'This order was already decided.';
const NOT_COMPLETABLE = 'This order is not approved or was already completed.';
const CLARIFICATION_DONE = 'The clarification email was already sent, or the order was already decided.';
const CHANGE_DONE = 'This flight change was already handled.';
const REJECTABLE = ['pending', 'needs_clarification'];
const AGENT_NOT_FOUND = 'This field agent was not found.';
const NOT_APPROVED = 'This order is no longer approved.';

// M9 (plan D4): the chosen user must exist and still have the role "agent".
async function isCurrentAgent(userId) {
  const { data, error } = await getSupabase().auth.admin.getUserById(userId);
  if (error || !data || !data.user) return false;
  return isAgentUser(data.user);
}

function readBody(req) {
  try {
    return req.body;
  } catch {
    return undefined; // invalid JSON
  }
}

// Missing flight (plan D9): checks, paragraph, claim, email, release if the email failed.
// The claim is one conditional update that sets sent_at only while it is still empty, so two
// clicks at the same moment cannot send two emails. The status stays "needs_clarification"
// (decision 9: the order can only stay there or be rejected).
async function confirmFlightMissing(res, order) {
  if (order.status !== 'needs_clarification' || clarificationSent(order)) {
    return sendError(res, 409, 'conflict', CLARIFICATION_DONE);
  }

  // clarification_draft (AI, plan D10), or the fixed paragraph when it fails (plan D11).
  const draft = await generateClarificationDraft(buildClarificationInput(order));
  const paragraph = draft.status === 'ok'
    ? draft.paragraph
    : fixedClarificationParagraph(order.flight_no_submitted, formatDateOnly(order.flight_date_submitted));
  const sentAt = new Date().toISOString();
  const aiOutput = draft.status === 'ok'
    ? { status: 'ok', model: draft.model, generated_at: draft.generated_at, clarification: { paragraph, sent_at: sentAt } }
    : { status: 'failed', clarification: { paragraph, sent_at: sentAt } };

  const { data: claimed, error: claimError } = await getSupabase()
    .from('orders')
    .update({ ai_output: aiOutput })
    .eq('id', order.id)
    .eq('status', 'needs_clarification')
    .is('ai_output->clarification->>sent_at', null)
    .select('id');
  if (claimError) throw claimError;
  if (!claimed || claimed.length === 0) return sendError(res, 409, 'conflict', CLARIFICATION_DONE);

  const emailSent = await notify(clarificationEmailPayload(order, paragraph));
  if (!emailSent) {
    // Release only our own claim, so the manager can try again.
    const { error: releaseError } = await getSupabase()
      .from('orders')
      .update({ ai_output: { ...aiOutput, clarification: { paragraph, sent_at: null } } })
      .eq('id', order.id)
      .eq('ai_output->clarification->>sent_at', sentAt);
    if (releaseError) console.error(`order-decision: clarification not released (${releaseError.code || 'no code'})`);
  }

  const updated = await readOrder(order.id);
  return sendOk(res, { order: await managerView(updated), email_sent: emailSent });
}

// Flight time changed after approval (plan D13, D8). Approve: new meeting time from the
// flight's current departure (or the manager's time, before departure) and an update email.
// Ignore: remembers the new departure, no email. Both run as one conditional update.
async function resolveFlightChange(res, order, ignore, requestedFinal) {
  if (!flightChangePending(order)) return sendError(res, 409, 'conflict', CHANGE_DONE);

  const departure = new Date(order.flight.departure_at);
  let recommended = null;
  let finalTime = null;
  if (!ignore) {
    recommended = meetingTime(departure, order.travelers, order.bags);
    finalTime = requestedFinal || recommended;
    if (finalTime.getTime() >= departure.getTime()) {
      return sendError(res, 400, 'bad_request', BEFORE_DEPARTURE);
    }
  }

  const updated = await runUpdate('resolve_flight_change', {
    p_order_id: order.id,
    p_expected_departure: order.approved_departure_at,
    p_new_departure: departure.toISOString(),
    p_recommended: recommended ? recommended.toISOString() : null,
    p_final_time: finalTime ? finalTime.toISOString() : null,
    p_ignore: ignore,
  });
  if (!updated) return sendError(res, 409, 'conflict', CHANGE_DONE);

  if (ignore) return sendOk(res, { order: await managerView(updated) });
  const emailSent = await notify(flightChangeEmailPayload(updated, order.final_time));
  return sendOk(res, { order: await managerView(updated), email_sent: emailSent });
}

// Reads one order with the customer's email and the flight.
async function readOrder(orderId) {
  const { data, error } = await getSupabase()
    .from('orders').select(ORDER_SELECT).eq('id', orderId).maybeSingle();
  if (error) throw error;
  return data;
}

// The manager view of a decided order, with is_returning_customer (decision 11, plan D6),
// so the screen keeps the "Returning" tag on an order that stays open.
async function managerView(row) {
  const { data, error } = await getSupabase()
    .from('orders').select('id, customer_id').eq('status', 'completed').eq('customer_id', row.customer_id);
  if (error) throw error;
  return toManagerView(row, { returning: isReturningCustomer(row, completedByCustomer(data)) });
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
  const {
    order_id: orderId, final_time: requestedFinal, manager_notes: notes, agent_id: agentId,
  } = checked.value;

  if (agentId && !(await isCurrentAgent(agentId))) return sendError(res, 400, 'bad_request', AGENT_NOT_FOUND);

  const order = await readOrder(orderId);
  if (!order) return sendError(res, 404, 'not_found', 'Order not found.');

  // M9 (plan D5): change the agent of an approved order (null = open to all agents).
  // One conditional update, no email.
  if (action === 'assign_agent') {
    if (order.status !== 'approved') return sendError(res, 409, 'conflict', NOT_APPROVED);
    const { data: assigned, error: assignError } = await getSupabase()
      .from('orders')
      .update({ assigned_agent_id: agentId })
      .eq('id', orderId)
      .eq('status', 'approved')
      .select('id');
    if (assignError) throw assignError;
    if (!assigned || assigned.length === 0) return sendError(res, 409, 'conflict', NOT_APPROVED);
    return sendOk(res, { order: await managerView(await readOrder(orderId)) });
  }

  // Manager notes (FR-29, plan D12): one plain update in any status, no email.
  // The note is shown to the field agent and never sent to the customer.
  if (action === 'add_note') {
    const { error: noteError } = await getSupabase()
      .from('orders').update({ manager_notes: notes }).eq('id', orderId);
    if (noteError) throw noteError;
    return sendOk(res, { order: await managerView(await readOrder(orderId)) });
  }

  // Field agent: approved -> completed (FR-41, decision 8). No email.
  // M9 (plan D7, D8): another agent's order answers 404, as if it did not exist for him;
  // an unassigned order is recorded as his.
  if (action === 'complete') {
    const me = staff.user.id;
    if (order.assigned_agent_id && order.assigned_agent_id !== me) {
      return sendError(res, 404, 'not_found', 'Order not found.');
    }
    if (order.status !== 'approved') return sendError(res, 409, 'conflict', NOT_COMPLETABLE);
    const updated = await runUpdate('complete_order', { p_order_id: orderId, p_agent_id: me });
    if (!updated) return sendError(res, 409, 'conflict', NOT_COMPLETABLE);
    return sendOk(res, { order: toAgentView(updated, me) });
  }

  if (action === 'confirm_flight_missing') return confirmFlightMissing(res, order);
  if (action === 'approve_flight_change' || action === 'ignore_flight_change') {
    return resolveFlightChange(res, order, action === 'ignore_flight_change', requestedFinal);
  }

  let updated;
  if (action === 'reject') {
    // From "pending" and from "needs_clarification" (ARCHITECTURE section 2, plan D12).
    if (!REJECTABLE.includes(order.status)) return sendError(res, 409, 'conflict', ALREADY_DECIDED);
    updated = await runUpdate('decide_order', {
      p_order_id: orderId, p_from: REJECTABLE, p_to: 'rejected',
      p_final_time: null, p_notes: notes, p_departure: null, p_recommended: null,
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
      // An empty box sends null, and decide_order keeps any earlier note.
      p_final_time: finalTime.toISOString(), p_notes: notes,
      p_departure: departure.toISOString(), p_recommended: recommended.toISOString(),
      // M9 (plan D4): saved in the same update as the approval (null = all agents).
      p_agent_id: agentId,
    });
  }

  if (!updated) return sendError(res, 409, 'conflict', ALREADY_DECIDED);

  const payload = action === 'approve' ? approvedEmailPayload(updated) : rejectedEmailPayload(updated);
  const emailSent = await notify(payload);
  sendOk(res, { order: await managerView(updated), email_sent: emailSent });
});
