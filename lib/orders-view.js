// Builds the order objects the API returns, per role (ARCHITECTURE section 5.1).
// Manager view and the field agent's limited view (M4); flight-change and missing-flight
// fields (M5); manager notes, returning customer and customer history (M6).
import { meetingTime } from '../public/js/meeting-time.js';
import lists from '../data/lists.json' with { type: 'json' };

const SERVICE_CODES = lists.services.map((s) => s.code);
export const MAX_PREVIOUS_ORDERS = 5;

// Select for the customer history in the order details (plan D7).
export const HISTORY_SELECT = 'id, status, flight_no_submitted, flight_date_submitted, created_at, flight:flights(flight_no, destination, departure_at)';

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

// Decision 11 (plan D6): customer_id -> ids of that customer's "completed" orders.
// completedRows: [{ id, customer_id }] from one query over the customers in a list.
export function completedByCustomer(completedRows) {
  const map = new Map();
  for (const r of completedRows || []) {
    if (!map.has(r.customer_id)) map.set(r.customer_id, new Set());
    map.get(r.customer_id).add(r.id);
  }
  return map;
}

// A returning customer has at least one OTHER order in status "completed".
export function isReturningCustomer(row, completedMap) {
  const ids = completedMap && completedMap.get(row.customer_id);
  if (!ids) return false;
  for (const id of ids) if (id !== row.id) return true;
  return false;
}

// One line of the "Customer history" box (plan D7). A typed flight that was not found
// shows the typed number and date.
export function toHistoryItem(row) {
  return {
    reference: referenceOf(row.id),
    status: row.status,
    flight_no: row.flight ? row.flight.flight_no : row.flight_no_submitted,
    destination: row.flight ? row.flight.destination : null,
    departure_at: row.flight ? row.flight.departure_at : null,
    flight_date_submitted: row.flight ? null : (row.flight_date_submitted || null),
  };
}

// Manager view. extra: { returning } on every manager read, and { previousOrders } (rows
// with HISTORY_SELECT) only for the order details (ARCHITECTURE section 5.1).
export function toManagerView(row, extra = {}) {
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
    // FR-29: the manager's note for the field agent (never sent to the customer).
    manager_notes: row.manager_notes || null,
    ai_output: pickAi(row.ai_output),
    // What the customer typed when the flight was entered by hand (number, YYYY-MM-DD or null).
    submitted_flight: { flight_no: row.flight_no_submitted, date: row.flight_date_submitted || null },
    flight_change_pending: changePending,
    previous_departure_at: changePending ? row.approved_departure_at : null,
    new_recommended_time: changePending
      ? meetingTime(new Date(row.flight.departure_at), row.travelers, row.bags).toISOString()
      : null,
    clarification: { sent: clarificationSent(row) },
    is_returning_customer: Boolean(extra.returning),
    ...(Array.isArray(extra.previousOrders)
      ? { previous_orders: extra.previousOrders.filter((o) => o.id !== row.id).slice(0, MAX_PREVIOUS_ORDERS).map(toHistoryItem) }
      : {}),
  };
}

// Only what the manager screen uses from orders.ai_output: null (no AI run, e.g. seed orders),
// { status: 'failed' }, or { status: 'ok', customer_paragraph, recommended_services }.
// recommended_services is filtered again on every read (plan D5): only codes from
// data/lists.json, no duplicates, so the screen always shows a subset of porter / wheelchair.
export function pickAi(ai) {
  if (!ai || typeof ai !== 'object') return null;
  if (ai.status !== 'ok') return { status: 'failed' };
  const services = Array.isArray(ai.recommended_services) ? ai.recommended_services : [];
  return {
    status: 'ok',
    customer_paragraph: typeof ai.customer_paragraph === 'string' ? ai.customer_paragraph : '',
    recommended_services: [...new Set(services.filter((s) => SERVICE_CODES.includes(s)))],
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

// ---------- Archive (M7, plan D6 and D8) ----------
const ALL_STATUSES = lists.statuses.map((s) => s.code);
const AGENT_ARCHIVE_STATUSES = ['approved', 'completed'];

// Statuses each role may see in the archive (ARCHITECTURE section 3).
export function archiveStatuses(role) {
  if (role === 'manager') return [...ALL_STATUSES];
  if (role === 'agent') return [...AGENT_ARCHIVE_STATUSES];
  return [];
}

// PostgREST "or" conditions for the search: customer name or flight number. The texts come
// from validateArchiveQuery (letters, digits, spaces and '-' only). Spaces are lost inside
// a PostgREST "or" filter, so each space becomes a wildcard: "maya z" finds "Maya Z.".
export function archiveSearchConditions(q, flightQ) {
  if (!q) return null;
  const parts = [`contact_name.ilike.*${q.replace(/ /g, '*')}*`];
  if (flightQ) parts.push(`flight_no_submitted.ilike.*${flightQ}*`);
  return parts.join(',');
}

// PostgREST "or" conditions for the departure range: the flight departs inside the range
// (flightIds, found first in flights), or a typed flight that was not found has a typed date
// inside the range. from/to are "YYYY-MM-DD" or null.
export function archiveDateConditions(flightIds, from, to) {
  if (!from && !to) return null;
  const typed = ['flight_id.is.null'];
  if (from) typed.push(`flight_date_submitted.gte.${from}`);
  if (to) typed.push(`flight_date_submitted.lte.${to}`);
  const parts = [];
  if (flightIds.length) parts.push(`flight_id.in.(${flightIds.join(',')})`);
  parts.push(`and(${typed.join(',')})`);
  return parts.join(',');
}

// One filter for .or(): each group must hold (AND), any condition inside a group may (OR).
export function combineOrGroups(groups) {
  const present = groups.filter(Boolean);
  if (present.length === 0) return null;
  if (present.length === 1) return present[0];
  return `and(${present.map((g) => `or(${g})`).join(',')})`;
}
