// GET /api/flights: all flights ordered by departure (minimal M1 version; search and future-only filter come in M2).
import { getSupabase } from '../lib/supabase.js';
import { withHandler, sendOk } from '../lib/http.js';

export default withHandler(['GET'], async (req, res) => {
  const { data, error } = await getSupabase()
    .from('flights')
    .select('id, flight_no, airline, destination, departure_at')
    .order('departure_at', { ascending: true });
  if (error) throw error;
  sendOk(res, { flights: data });
});
