// POST /api/chat: the customer chat "Ask Sereno" (Milestone 15, FR-48).
// The AI only picks the id of one question in data/faq.json (or "none"); the page then shows
// Asaf's answer word for word. The question is never stored, logged or sent back.
import faq from '../data/faq.json' with { type: 'json' };
import { withHandler, sendOk, sendError } from '../lib/http.js';
import { validateChatBody } from '../lib/validate.js';
import { matchFaq } from '../lib/ai.js';

// Plan D6: questions a minute from one address. Kept only in this copy of the function's
// memory for one minute; the OpenAI monthly spending limit is the real ceiling (ADR).
export const PER_MINUTE = 8;
const WINDOW_MS = 60 * 1000;
export const TOO_MANY_MESSAGE = 'Too many questions, please wait a minute.';
const recent = new Map(); // address -> times of its questions in the last minute

// The caller's address: the first entry Vercel puts in x-forwarded-for.
function addressOf(req) {
  const forwarded = req.headers && req.headers['x-forwarded-for'];
  const first = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '';
  return first || (req.socket && req.socket.remoteAddress) || 'unknown';
}

// true when this address may ask now (and counts the question); false over the limit.
export function allowQuestion(address, now = Date.now()) {
  for (const [key, times] of recent) {
    const kept = times.filter((t) => now - t < WINDOW_MS);
    if (kept.length) recent.set(key, kept); else recent.delete(key);
  }
  const times = recent.get(address) || [];
  if (times.length >= PER_MINUTE) return false;
  times.push(now);
  recent.set(address, times);
  return true;
}

// For the tests.
export function resetChatLimits() {
  recent.clear();
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

  // 1. Anti-bot field: "no answer", without calling the AI.
  if (body && typeof body === 'object' && !Array.isArray(body)
      && body.website !== undefined && body.website !== null && body.website !== '') {
    return sendOk(res, { answer_id: 'none' });
  }

  // 2. Validation.
  const checked = validateChatBody(body);
  if (checked.error) return sendError(res, 400, 'bad_request', checked.error);

  // 3. Per-minute limit.
  if (!allowQuestion(addressOf(req))) return sendError(res, 429, 'too_many_requests', TOO_MANY_MESSAGE);

  // 4. The AI picks an id; any failure is "none" (plan D5).
  const result = await matchFaq(checked.value.question, faq.items);
  sendOk(res, { answer_id: result.status === 'ok' ? result.answer_id : 'none' });
});
