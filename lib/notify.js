// Sends a notification event to the n8n webhook, which builds and sends the email.
// Never throws: returns true when n8n accepted the event, false otherwise.
// Logs never include the secret, the webhook URL or provider response bodies.
import { formatLocalIL, formatDateOnly } from './time.js';
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

// With a flight: its number, destination and departure. Without one (typed flight not
// found): the number and date the customer typed ("12 Dec 2026", or null when no date).
function flightFields(row) {
  if (row.flight) {
    return {
      flight_no: row.flight.flight_no,
      destination: row.flight.destination,
      departure_local: row.flight.departure_at ? formatLocalIL(row.flight.departure_at) : null,
    };
  }
  return {
    flight_no: row.flight_no_submitted,
    destination: null,
    departure_local: formatDateOnly(row.flight_date_submitted),
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

// Missing flight (plan D9): the typed number and date, and the clarification paragraph
// already saved on the order.
export function clarificationEmailPayload(row, paragraph) {
  const { flight_no, departure_local } = flightFields(row);
  return {
    type: 'customer_clarification',
    to: row.customer ? row.customer.email : null,
    customer_name: row.contact_name,
    reference: reference(row),
    flight_no,
    departure_local,
    ai_paragraph: paragraph,
  };
}

// "Request received" (FR-43, Asaf 24.11.2026): sent to the customer right after the order is
// saved. Only what the customer typed and the reference; no meeting time (it is a manager
// decision), no AI paragraph, no notes. A typed flight that was not found shows the typed
// number and date, like the other emails (the customer is not told it was not found).
export function receivedEmailPayload({ reference: ref, email, name, flight, typedFlightNo, typedDate }) {
  return {
    type: 'customer_received',
    to: email,
    customer_name: name,
    reference: ref,
    flight_no: flight ? flight.flight_no : typedFlightNo,
    destination: flight ? flight.destination : null,
    departure_local: flight ? formatLocalIL(flight.departure_at) : formatDateOnly(typedDate),
  };
}

// Approved flight change (plan D13): like the approval email with the new meeting time.
// previous_meeting_time_local stays in the event (ARCHITECTURE section 5.2), but the n8n
// template does not show it (Asaf's decision, 22.11.2026). No AI paragraph.
export function flightChangeEmailPayload(row, previousFinalTime) {
  return {
    ...approvedEmailPayload(row),
    type: 'customer_flight_change',
    previous_meeting_time_local: previousFinalTime ? formatLocalIL(previousFinalTime) : null,
    ai_paragraph: '',
  };
}
