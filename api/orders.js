// GET /api/orders: staff order lists and order details (ARCHITECTURE section 5.1).
// M3: manager only. view=inbox (pending orders, soonest departure first) and id=<uuid>.
// The agent views (view=approved) come in M4 and the archive (view=archive) in M7.
import { getSupabase } from '../lib/supabase.js';
import { withHandler, sendOk, sendError } from '../lib/http.js';
import { requireStaff } from '../lib/auth.js';
import { isUuid } from '../lib/validate.js';
import { ORDER_SELECT, toManagerView, byDeparture } from '../lib/orders-view.js';

const PAGE_SIZE = 50;

export default withHandler(['GET'], async (req, res) => {
  const staff = await requireStaff(req, res, ['manager']);
  if (!staff) return;

  const { id, view } = req.query;

  if (id !== undefined) {
    if (!isUuid(id)) return sendError(res, 400, 'bad_request', 'Order id is not valid.');
    const { data, error } = await getSupabase()
      .from('orders')
      .select(ORDER_SELECT)
      .eq('id', id.toLowerCase())
      .maybeSingle();
    if (error) throw error;
    if (!data) return sendError(res, 404, 'not_found', 'Order not found.');
    return sendOk(res, { order: toManagerView(data) });
  }

  if (view !== 'inbox') return sendError(res, 400, 'bad_request', 'Unknown view.');

  const { data, error } = await getSupabase()
    .from('orders')
    .select(ORDER_SELECT)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(PAGE_SIZE);
  if (error) throw error;

  sendOk(res, { orders: data.map(toManagerView).sort(byDeparture), page: 1 });
});
