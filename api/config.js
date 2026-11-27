// GET /api/config: public settings for the browser (publishable key only), the fixed lists
// and the chat's questions and answers.
import lists from '../data/lists.json' with { type: 'json' };
// Milestone 15: the chat's questions and answers (public text, answered in the page).
import faq from '../data/faq.json' with { type: 'json' };
import { withHandler, sendOk } from '../lib/http.js';

export default withHandler(['GET'], async (req, res) => {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) throw new Error('SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY is not set');
  sendOk(res, { supabase_url: url, supabase_publishable_key: publishableKey, lists, faq });
});
