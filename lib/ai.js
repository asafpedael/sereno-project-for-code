// AI layer: calls OpenAI (REST Responses API with a strict JSON schema, key in the
// Authorization header) and checks the output in code before it is used
// (ARCHITECTURE section 4, ADR-14).
// Never throws: every failure returns { status: 'failed' }, and the order goes on without AI.
// Logs carry a short reason code only, never the key, the input or the provider's response.
import { ORDER_DRAFT_SYSTEM, ORDER_DRAFT_SCHEMA, orderDraftUserText } from './prompts.js';

const ENDPOINT = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-6-luna';
const TIMEOUT_MS = 20000;
const MAX_PARAGRAPH = 600;
const ALLOWED_SERVICES = ['porter', 'wheelchair'];
const URL_RE = /(https?:\/\/|www\.)/i;
// Any time of day: "12:45", "12.45", "9am", "9 pm" (decision O4: the paragraph names no time).
const TIME_RE = /\b\d{1,2}[:.]\d{2}\b|\b\d{1,2}\s?(am|pm|a\.m\.|p\.m\.)(?![a-z])/i;

export const FAILED = Object.freeze({ status: 'failed' });

// Strips tags, collapses spaces, and cuts a too-long text at the last sentence end within the limit.
// Returns the clean text, or null when it is empty or cannot be cut at a sentence end.
function cleanParagraph(text) {
  const plain = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!plain) return null;
  if (plain.length <= MAX_PARAGRAPH) return plain;
  const head = plain.slice(0, MAX_PARAGRAPH);
  let end = -1;
  for (const match of head.matchAll(/[.!?](?=\s|$)/g)) end = match.index;
  return end > 0 ? head.slice(0, end + 1) : null;
}

// The four output checks of ARCHITECTURE section 4, plus "no time of day" (O4).
// raw: the model's JSON text. Returns { recommended_services, customer_paragraph } or null.
export function checkOrderDraft(raw) {
  let data;
  try {
    data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const { recommended_services: services, customer_paragraph: paragraph } = data;
  if (!Array.isArray(services) || typeof paragraph !== 'string') return null;

  const cleanServices = [...new Set(services.filter((s) => ALLOWED_SERVICES.includes(s)))];
  const cleanText = cleanParagraph(paragraph);
  if (!cleanText) return null;
  if (URL_RE.test(cleanText) || TIME_RE.test(cleanText)) return null;

  return { recommended_services: cleanServices, customer_paragraph: cleanText };
}

function fail(reason) {
  console.error(`ai: order_draft failed (${reason})`);
  return { ...FAILED };
}

// The model's JSON text from a Responses API body, or { refusal } / null.
function outputText(body) {
  if (!body || body.status !== 'completed' || !Array.isArray(body.output)) return null;
  for (const item of body.output) {
    if (item.type !== 'message' || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (part.type === 'refusal') return { refusal: true };
      if (part.type === 'output_text' && typeof part.text === 'string') return { text: part.text };
    }
  }
  return null;
}

// One order_draft call. input: from buildOrderDraftInput (no email, phone or meeting time).
// Returns the object stored in orders.ai_output.
export async function generateOrderDraft(input) {
  const key = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  if (!key) return fail('no key');

  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        input: [
          { role: 'system', content: ORDER_DRAFT_SYSTEM },
          { role: 'user', content: orderDraftUserText(input) },
        ],
        text: { format: { type: 'json_schema', name: 'order_draft', strict: true, schema: ORDER_DRAFT_SCHEMA } },
        reasoning: { effort: 'none' },
        max_output_tokens: 400,
        store: false,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    return fail(err.name === 'TimeoutError' ? 'timeout' : 'network');
  }
  if (!res.ok) return fail(`http ${res.status}`);

  let body;
  try {
    body = await res.json();
  } catch {
    return fail('bad response');
  }
  const out = outputText(body);
  if (!out) return fail(`no answer (${body && body.status ? body.status : 'none'})`);
  if (out.refusal) return fail('refusal');

  const checked = checkOrderDraft(out.text);
  if (!checked) return fail('output check');

  return {
    status: 'ok',
    model,
    generated_at: new Date().toISOString(),
    recommended_services: checked.recommended_services,
    customer_paragraph: checked.customer_paragraph,
  };
}
