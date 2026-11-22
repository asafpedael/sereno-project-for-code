// Builds the order objects the API returns, per role (ARCHITECTURE section 5.1).
// Manager view and the field agent's limited view (M4); flight-change and missing-flight
// fields (M5). Returning customer and history (M6) are added in their milestone.
import { meetingTime } from '../public/js/meeting-time.js';

// One select: the order, the customer's email and the flight (existing foreign keys).
export const ORDER_SELECT = '*, customer:customers(email), flight:flights(flight_no, destination, departure_at)';

export function referenceOf(id) {
  return String(id).slice(0, 8).toUpperCase();
}

// FR-42 / decision 14: a pending order's recommended time always follows the flight's
// current departure; any other status keeps the stored value.
export function currentRecommended(row) {
  if (row.status === 'pending' && row.flight && row.flight.departure_at) {
    return meetingTime(new Date(row.flight.departure_at), row.travelers, row.bags).toISOString();
  }
  return row.recommended_time;
}

function instant(value) {
  if (value === null || value === undefined || value === '') return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

// ARCHITECTURE section 2 (plan D7): an approved order with a flight whose current departure
// differs from the departure approved by the manager, and from the one the manager chose to
// ignore (if any). Compared as instants, not as text.
export function flightChangePending(row) {
  if (row.status !== 'approved' || !row.flight) return false;
  const current = instant(row.flight.departure_at);
  const approved = instant(row.approved_departure_at);
  if (current === null || approved === null) return false;
  if (current === approved) return false;
  const ignored = instant(row.ignored_departure_at);
  return ignored === null || current !== ignored;
}

// True once the clarification email for a missing flight was sent (plan D9).
export function clarificationSent(row) {
  const ai = row.ai_output;
  return Boolean(ai && typeof ai === 'object' && ai.clarification && ai.clarification.sent_at);
}

export function toManagerView(row) {
  const changePending = flightChangePending(row);
  const flight = row.flight
    ? { flight_no: row.flight.flight_no, destination: row.flight.destination, departure_at: row.flight.departure_at }
    : { flight_no: row.flight_no_submitted, destination: null, departure_at: null };
  return {
    id: row.id,
    reference: referenceOf(row.id),
    status: row.status,
    customer: {
      full_name: row.contact_name,
      phone: row.contact_phone,
      email: row.customer ? row.customer.email : null,
    },
    flight,
    travelers: row.travelers,
    bags: row.bags,
    services: Array.isArray(row.services) ? row.services : [],
    escort_scope: row.escort_scope,
    customer_notes: row.customer_notes,
    recommended_time: currentRecommended(row),
    final_time: row.final_time,
    created_at: row.created_at,
    ai_output: pickAi(row.ai_output),
    // What the customer typed when the flight was entered by hand (number, YYYY-MM-DD or null).
    submitted_flight: { flight_no: row.flight_no_submitted, date: row.flight_date_submitted || null },
    flight_change_pending: changePending,
    previous_departure_at: changePending ? row.approved_departure_at : null,
    new_recommended_time: changePending
      ? meetingTime(new Date(row.flight.departure_at), row.travelers, row.bags).toISOString()
      : null,
    clarification: { sent: clarificationSent(row) },
  };
}

// Only what the manager screen uses from orders.ai_output: null (no AI run, e.g. seed orders),
// { status: 'failed' }, or { status: 'ok', customer_paragraph, recommended_services }.
export function pickAi(ai) {
  if (!ai || typeof ai !== 'object') return null;
  if (ai.status !== 'ok') return { status: 'failed' };
  return {
    status: 'ok',
    customer_paragraph: typeof ai.customer_paragraph === 'string' ? ai.customer_paragraph : '',
    recommended_services: Array.isArray(ai.recommended_services) ? ai.recommended_services : [],
  };
}

// Field agent (ARCHITECTURE section 3): only what is needed to perform the service.
// No customer email, no ai_output, no customer notes, no history.
export function toAgentView(row) {
  return {
    id: row.id,
    reference: referenceOf(row.id),
    status: row.status,
    customer: { full_name: row.contact_name, phone: row.contact_phone },
    flight: row.flight
      ? { flight_no: row.flight.flight_no, destination: row.flight.destination, departure_at: row.flight.departure_at }
      : { flight_no: row.flight_no_submitted, destination: null, departure_at: null },
    travelers: row.travelers,
    bags: row.bags,
    services: Array.isArray(row.services) ? row.services : [],
    escort_scope: row.escort_scope,
    final_time: row.final_time,
    manager_notes: row.manager_notes || null,
  };
}

// Soonest meeting first (agent list); orders without a meeting time go last.
export function byMeetingTime(a, b) {
  const ta = a.final_time ? Date.parse(a.final_time) : Infinity;
  const tb = b.final_time ? Date.parse(b.final_time) : Infinity;
  return ta - tb;
}

// Soonest departure first; orders without a flight go last.
export function byDeparture(a, b) {
  const ta = a.flight.departure_at ? Date.parse(a.flight.departure_at) : Infinity;
  const tb = b.flight.departure_at ? Date.parse(b.flight.departure_at) : Infinity;
  return ta - tb;
}
