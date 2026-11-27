// AI layer: calls OpenAI (REST Responses API with a strict JSON schema, key in the
// Authorization header) and checks the output in code before it is used
// (ARCHITECTURE section 4, ADR-14).
// Never throws: every failure returns { status: 'failed' }, and the order goes on without AI.
// Logs carry a short reason code only, never the key, the input or the provider's response.
import {
  ORDER_DRAFT_SYSTEM, ORDER_DRAFT_SCHEMA, orderDraftUserText, CLARIFICATION_SYSTEM, CLARIFICATION_SCHEMA,
  FAQ_MATCH_SYSTEM, faqMatchSchema, faqMatchUserText,
} from './prompts.js';

const ENDPOINT = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-6-luna';
const TIMEOUT_MS = 20000;
const MAX_OUTPUT_TOKENS = 400;
// The chat (Milestone 15, plan D3): a customer waits for the answer, and the output is one id.
const FAQ_TIMEOUT_MS = 8000;
const FAQ_MAX_OUTPUT_TOKENS = 50;
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

// clarification_draft output (plan D10): one paragraph, same cleaning and checks.
// Returns the clean paragraph or null.
export function checkClarificationDraft(raw) {
  let data;
  try {
    data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (typeof data.clarification_paragraph !== 'string') return null;
  const cleanText = cleanParagraph(data.clarification_paragraph);
  if (!cleanText) return null;
  if (URL_RE.test(cleanText) || TIME_RE.test(cleanText)) return null;
  return cleanText;
}

function fail(kind, reason) {
  console.error(`ai: ${kind} failed (${reason})`);
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

// One OpenAI request shared by every AI action: strict JSON schema, not stored; 20 s and
// 400 tokens unless the caller asks for less. Returns { model, text } or { error: <reason code> }.
async function callModel(name, system, userText, schema, { timeoutMs = TIMEOUT_MS, maxTokens = MAX_OUTPUT_TOKENS } = {}) {
  const key = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  if (!key) return { error: 'no key' };

  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        input: [
          { role: 'system', content: system },
          { role: 'user', content: userText },
        ],
        text: { format: { type: 'json_schema', name, strict: true, schema } },
        reasoning: { effort: 'none' },
        max_output_tokens: maxTokens,
        store: false,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    return { error: err.name === 'TimeoutError' ? 'timeout' : 'network' };
  }
  if (!res.ok) return { error: `http ${res.status}` };

  let body;
  try {
    body = await res.json();
  } catch {
    return { error: 'bad response' };
  }
  const out = outputText(body);
  if (!out) return { error: `no answer (${body && body.status ? body.status : 'none'})` };
  if (out.refusal) return { error: 'refusal' };
  return { model, text: out.text };
}

// One clarification_draft call. input: from buildClarificationInput (first name, typed
// number and date only). Returns { status: 'ok', model, generated_at, paragraph } or
// { status: 'failed' }; the caller then uses the fixed paragraph (plan D11).
export async function generateClarificationDraft(input) {
  const kind = 'clarification_draft';
  const answer = await callModel(kind, CLARIFICATION_SYSTEM, orderDraftUserText(input), CLARIFICATION_SCHEMA);
  if (answer.error) return fail(kind, answer.error);
  const paragraph = checkClarificationDraft(answer.text);
  if (!paragraph) return fail(kind, 'output check');
  return { status: 'ok', model: answer.model, generated_at: new Date().toISOString(), paragraph };
}

// One order_draft call. input: from buildOrderDraftInput (no email, phone or meeting time).
// Returns the object stored in orders.ai_output.
export async function generateOrderDraft(input) {
  const kind = 'order_draft';
  const answer = await callModel(kind, ORDER_DRAFT_SYSTEM, orderDraftUserText(input), ORDER_DRAFT_SCHEMA);
  if (answer.error) return fail(kind, answer.error);
  const model = answer.model;

  const checked = checkOrderDraft(answer.text);
  if (!checked) return fail(kind, 'output check');

  return {
    status: 'ok',
    model,
    generated_at: new Date().toISOString(),
    recommended_services: checked.recommended_services,
    customer_paragraph: checked.customer_paragraph,
  };
}

// ---------- Customer chat (Milestone 15, plan D3, D5) ----------

// raw: the model's JSON text; ids: the list's ids. Returns a known id, or 'none' for
// anything else (bad JSON, a missing field, an id that is not in the list).
export function checkFaqMatch(raw, ids) {
  let data;
  try {
    data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return 'none';
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return 'none';
  const id = data.answer_id;
  return typeof id === 'string' && ids.includes(id) ? id : 'none';
}

// One faq_match call. items: data/faq.json items (only id and question are sent).
// Returns { status: 'ok', answer_id } or { status: 'failed' }. The question is never logged.
export async function matchFaq(question, items) {
  const kind = 'faq_match';
  const ids = items.map((item) => item.id);
  const answer = await callModel(kind, FAQ_MATCH_SYSTEM, faqMatchUserText(question, items), faqMatchSchema(ids),
    { timeoutMs: FAQ_TIMEOUT_MS, maxTokens: FAQ_MAX_OUTPUT_TOKENS });
  if (answer.error) return fail(kind, answer.error);
  return { status: 'ok', answer_id: checkFaqMatch(answer.text, ids) };
}
