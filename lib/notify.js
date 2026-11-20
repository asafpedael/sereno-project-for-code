// Sends a notification event to the n8n webhook, which builds and sends the email.
// Never throws: returns true when n8n accepted the event, false otherwise.
// Logs never include the secret, the webhook URL or provider response bodies.
import { formatLocalIL } from './time.js';
import lists from '../data/lists.json' with { type: 'json' };

const TIMEOUT_MS = 8000;

export async function notify(payload) {
  const url = process.env.N8N_WEBHOOK_URL;
  const secret = process.env.N8N_WEBHOOK_SECRET;
  const type = payload && payload.type;
  if (!url || !secret) {
    console.error('notify: N8N_WEBHOOK_URL or N8N_WEBHOOK_SECRET is not set');
    return false;
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': secret },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`notify: webhook returned ${res.status} for type ${type}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`notify: request failed for type ${type} (${err.name})`);
    return false;
  }
}

// ---------- Customer email events after a manager decision (FR-31, ARCHITECTURE section 5.2) ----------
// Pure builders from a saved order row (ORDER_SELECT: customer email + flight).
// They never include manager_notes or customer_notes (those must not reach the customer).

const SERVICE_LABELS = Object.fromEntries(lists.services.map((s) => [s.code, s.label]));
const ESCORT_LABELS = Object.fromEntries(lists.escort_scopes.map((s) => [s.code, s.label]));

function reference(row) {
  return String(row.id).slice(0, 8).toUpperCase();
}

function flightFields(row) {
  return {
    flight_no: row.flight ? row.flight.flight_no : row.flight_no_submitted,
    destination: row.flight ? row.flight.destination : null,
    departure_local: row.flight && row.flight.departure_at ? formatLocalIL(row.flight.departure_at) : null,
  };
}

// The AI paragraph only when the stored AI output passed every check (status "ok").
function aiParagraph(row) {
  const ai = row.ai_output;
  return ai && ai.status === 'ok' && typeof ai.customer_paragraph === 'string' ? ai.customer_paragraph : '';
}

export function approvedEmailPayload(row) {
  return {
    type: 'customer_approved',
    to: row.customer ? row.customer.email : null,
    customer_name: row.contact_name,
    reference: reference(row),
    ...flightFields(row),
    meeting_time_local: row.final_time ? formatLocalIL(row.final_time) : null,
    previous_meeting_time_local: null,
    travelers: row.travelers,
    bags: row.bags,
    services: (Array.isArray(row.services) ? row.services : []).map((code) => SERVICE_LABELS[code] || code),
    escort_scope: ESCORT_LABELS[row.escort_scope] || row.escort_scope,
    ai_paragraph: aiParagraph(row),
  };
}

export function rejectedEmailPayload(row) {
  return {
    type: 'customer_rejected',
    to: row.customer ? row.customer.email : null,
    customer_name: row.contact_name,
    reference: reference(row),
    ...flightFields(row),
  };
}
