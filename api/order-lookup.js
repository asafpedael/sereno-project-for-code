// POST /api/order-lookup: the customer's order lookup (Milestone 14, FR-47).
// Shows one order only when the order number and the email belong to it. Every case where
// nothing is shown gets the same 404 and message, so a stranger cannot tell whether a number
// or an email exists. Wrong tries are counted and locked inside lookup_order (006_order_lookup.sql).
import { getSupabase } from '../lib/supabase.js';
import { withHandler, sendOk, sendError } from '../lib/http.js';
import { validateLookupBody } from '../lib/validate.js';
import { LOOKUP_SELECT, toCustomerView } from '../lib/orders-view.js';

export const NOT_FOUND_MESSAGE = "We couldn't find an order with these details. Please check the order number and the email you booked with. After 5 tries, please wait 15 minutes before trying again.";

function notFound(res) {
  return sendError(res, 404, 'not_found', NOT_FOUND_MESSAGE);
}

function readBody(req) {
  try {
    return req.body;
  } catch {
    return undefined; // invalid JSON
  }
}

export default withHandler(['POST'], async (req, res) => {
  const body = readBody(req);

  // 1. Anti-bot field: the same answer as a missing order, nothing touched.
  if (body && typeof body === 'object' && !Array.isArray(body)
      && body.website !== undefined && body.website !== null && body.website !== '') {
    return notFound(res);
  }

  // 2. Validation (a malformed try is not counted).
  const checked = validateLookupBody(body);
  if (checked.error) return sendError(res, 400, 'bad_request', checked.error);
  const { reference, email } = checked.value;

  // 3. Match and count, in one locked step in the database.
  const { data: rows, error } = await getSupabase().rpc('lookup_order', {
    p_reference: reference,
    p_email: email,
  });
  if (error) throw error;
  const result = rows && rows[0];
  if (!result || !result.is_found || !result.order_id) return notFound(res);

  // 4. Read only the columns the page needs.
  const { data: row, error: readError } = await getSupabase()
    .from('orders')
    .select(LOOKUP_SELECT)
    .eq('id', result.order_id)
    .maybeSingle();
  if (readError) throw readError;
  if (!row) return notFound(res);

  // 5. A fixed list of fields.
  sendOk(res, { order: toCustomerView(row) });
});
