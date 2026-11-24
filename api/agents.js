// GET /api/agents: the field agents the manager can assign to an order (M9, plan D3).
// Manager only. The users are read here, on the server, with the secret key; only the id and
// a name of each agent leave the server, and never to a field agent's browser.
import { getSupabase } from '../lib/supabase.js';
import { withHandler, sendOk } from '../lib/http.js';
import { requireStaff } from '../lib/auth.js';
import { agentsFromUsers } from '../lib/orders-view.js';

const USERS_PER_PAGE = 1000; // staff users are created by hand (at most 5, ARCHITECTURE section 3)

export default withHandler(['GET'], async (req, res) => {
  const staff = await requireStaff(req, res, ['manager']);
  if (!staff) return;

  const { data, error } = await getSupabase().auth.admin.listUsers({ page: 1, perPage: USERS_PER_PAGE });
  if (error) throw error;
  sendOk(res, { agents: agentsFromUsers(data.users) });
});
