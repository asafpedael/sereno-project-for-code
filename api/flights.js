// GET /api/flights?q=<text>: search future flights by flight number or destination (max 20).
import { getSupabase } from '../lib/supabase.js';
import { withHandler, sendOk, sendError } from '../lib/http.js';
import { cleanSearchQuery } from '../lib/validate.js';

const MAX_RESULTS = 20;

export default withHandler(['GET'], async (req, res) => {
  const search = cleanSearchQuery(req.query.q);
  if (search.error) return sendError(res, 400, 'bad_request', search.error);

  let query = getSupabase()
    .from('flights')
    .select('id, flight_no, airline, destination, departure_at')
    .gt('departure_at', new Date().toISOString())
    .order('departure_at', { ascending: true })
    .limit(MAX_RESULTS);

  if (search.value) {
    const pattern = `%${search.value}%`;
    query = query.or(`flight_no.ilike.${pattern},destination.ilike.${pattern}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  sendOk(res, { flights: data });
});
