// POST /api/submit-order: public order form submission. Creates an order with status "pending".
// Replies only with a reference code and the status, never with stored data.
import { randomBytes } from 'node:crypto';
import { getSupabase } from '../lib/supabase.js';
import { withHandler, sendOk, sendError } from '../lib/http.js';
import { validateOrderBody } from '../lib/validate.js';
import { meetingTime } from '../public/js/meeting-time.js';
import { notify } from '../lib/notify.js';
import { formatLocalIL } from '../lib/time.js';
import { generateOrderDraft } from '../lib/ai.js';
import { buildOrderDraftInput } from '../lib/prompts.js';
import lists from '../data/lists.json' with { type: 'json' };

const SERVICE_LABELS = Object.fromEntries(lists.services.map((s) => [s.code, s.label]));
const ESCORT_LABELS = Object.fromEntries(lists.escort_scopes.map((s) => [s.code, s.label]));

const HOUR_MS = 60 * 60 * 1000;
const MAX_ORDERS_PER_EMAIL_PER_HOUR = 3;
const MAX_ORDERS_PER_HOUR = 30;
const TOO_MANY_MESSAGE = 'Too many requests, please try again later';
const UNIQUE_VIOLATION = '23505';

function readBody(req) {
  try {
    return req.body;
  } catch {
    return undefined; // invalid JSON
  }
}

async function countOrdersSince(since, customerId) {
  let query = getSupabase()
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since);
  if (customerId) query = query.eq('customer_id', customerId);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function findCustomerId(email) {
  const { data, error } = await getSupabase()
    .from('customers')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (error) throw error;
  return data ? data.id : null;
}

// Existing customers are never changed (decision 17); new ones are created with the typed details.
async function findOrCreateCustomerId(order) {
  const existing = await findCustomerId(order.email);
  if (existing) return existing;
  const { data, error } = await getSupabase()
    .from('customers')
    .insert({ full_name: order.full_name, phone: order.phone, email: order.email })
    .select('id')
    .single();
  if (!error) return data.id;
  if (error.code === UNIQUE_VIOLATION) {
    // Created by a parallel submission a moment ago.
    const id = await findCustomerId(order.email);
    if (id) return id;
  }
  throw error;
}

export default withHandler(['POST'], async (req, res) => {
  const body = readBody(req);

  // 1. Honeypot: a filled hidden field looks like success but saves nothing.
  if (body && typeof body === 'object' && !Array.isArray(body)
      && body.website !== undefined && body.website !== null && body.website !== '') {
    return sendOk(res, { reference: randomBytes(4).toString('hex').toUpperCase(), status: 'pending' });
  }

  // 2. Validation
  const checked = validateOrderBody(body);
  if (checked.error) return sendError(res, 400, 'bad_request', checked.error);
  const order = checked.value;

  // 3. Rate limits (last hour). A quick early check; the insert in step 7 checks again
  //    as one locked step in the database, so parallel requests cannot get past it.
  const since = new Date(Date.now() - HOUR_MS).toISOString();
  if (await countOrdersSince(since) >= MAX_ORDERS_PER_HOUR) {
    return sendError(res, 429, 'too_many_requests', TOO_MANY_MESSAGE);
  }
  const knownCustomerId = await findCustomerId(order.email);
  if (knownCustomerId && await countOrdersSince(since, knownCustomerId) >= MAX_ORDERS_PER_EMAIL_PER_HOUR) {
    return sendError(res, 429, 'too_many_requests', TOO_MANY_MESSAGE);
  }

  // 4. Flight: must exist and must not have departed
  const { data: flight, error: flightError } = await getSupabase()
    .from('flights')
    .select('id, flight_no, destination, departure_at')
    .eq('id', order.flight_id)
    .maybeSingle();
  if (flightError) throw flightError;
  if (!flight) return sendError(res, 400, 'bad_request', 'Please select your flight from the list.');
  const departure = new Date(flight.departure_at);
  if (departure.getTime() <= Date.now()) {
    return sendError(res, 400, 'bad_request', 'This flight has already departed. Please choose another flight.');
  }

  // 5. Customer
  const customerId = knownCustomerId || await findOrCreateCustomerId(order);

  // 6. Meeting time, always computed here (a value sent by the page is never used)
  const recommended = meetingTime(departure, order.travelers, order.bags);

  // 7. Order: inserted with status "pending" only if the hourly limits still allow it
  const { data: rows, error: insertError } = await getSupabase().rpc('insert_order_with_limits', {
    p_customer_id: customerId,
    p_flight_id: flight.id,
    p_flight_no: flight.flight_no,
    p_contact_name: order.full_name,
    p_contact_phone: order.phone,
    p_travelers: order.travelers,
    p_bags: order.bags,
    p_services: order.services,
    p_escort_scope: order.escort_scope,
    p_customer_notes: order.notes,
    p_recommended: recommended.toISOString(),
    p_max_per_customer: MAX_ORDERS_PER_EMAIL_PER_HOUR,
    p_max_total: MAX_ORDERS_PER_HOUR,
  });
  if (insertError) throw insertError;
  if (!rows || rows.length === 0) {
    return sendError(res, 429, 'too_many_requests', TOO_MANY_MESSAGE);
  }
  const saved = rows[0];

  const reference = saved.id.slice(0, 8).toUpperCase();

  // 8. AI order_draft (FR-17): a personal paragraph for the approval email, checked in code.
  //    The order is already saved: an AI failure only stores { status: 'failed' }.
  const aiOutput = await generateOrderDraft(buildOrderDraftInput(order, flight));
  const { error: aiSaveError } = await getSupabase()
    .from('orders').update({ ai_output: aiOutput }).eq('id', saved.id);
  if (aiSaveError) console.error(`submit-order: ai_output not saved (${aiSaveError.code || 'no code'})`);

  // 9. Alert the manager through n8n (FR-14). The order is already saved, so a failed
  //    alert is only logged and the customer still gets success.
  await notify({
    type: 'manager_alert',
    reference,
    customer_name: order.full_name,
    flight_no: flight.flight_no,
    destination: flight.destination,
    departure_local: formatLocalIL(departure),
    meeting_time_local: formatLocalIL(recommended),
    travelers: order.travelers,
    bags: order.bags,
    services: order.services.map((code) => SERVICE_LABELS[code] || code),
    escort_scope: ESCORT_LABELS[order.escort_scope] || order.escort_scope,
    needs_clarification: false,
  });

  // 10. Reply: reference and status only
  sendOk(res, { reference, status: 'pending' });
});
