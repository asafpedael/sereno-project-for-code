// Input validation for the API functions. Pure functions: return { value } or { error }.
import lists from '../data/lists.json' with { type: 'json' };
import { isDateKey, todayIL, addDays } from './time.js';

const MAX_SEARCH_LENGTH = 40;
const SERVICE_CODES = lists.services.map((s) => s.code);
const ESCORT_CODES = lists.escort_scopes.map((s) => s.code);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE_RE = /^[0-9+\-() ]{7,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/;
// Control characters (newline and tab allowed only where stated).
const LINE_SEPARATORS = String.fromCharCode(0x2028, 0x2029); // written as char codes on purpose
const CONTROL_RE = new RegExp(`[\x00-\x1F\x7F-\x9F${LINE_SEPARATORS}]`);
const CONTROL_EXCEPT_NEWLINE_RE = new RegExp(`[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F${LINE_SEPARATORS}]`);

export function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

// Actions of POST /api/order-decision: approve and reject (M3, manager), complete (M4,
// field agent), confirm_flight_missing and the flight-change actions (M5, manager),
// add_note (M6, manager), assign_agent (M9, manager).
export const DECISION_ACTIONS = [
  'approve', 'reject', 'complete',
  'confirm_flight_missing', 'approve_flight_change', 'ignore_flight_change',
  'add_note', 'assign_agent',
];
// Actions that may carry a field agent (M9, plan D4, D5).
const ACTIONS_WITH_AGENT = ['approve', 'assign_agent'];
// Actions that may carry a meeting time chosen by the manager.
const ACTIONS_WITH_TIME = ['approve', 'approve_flight_change'];
// Actions that may carry manager notes (M6, plan D12).
const ACTIONS_WITH_NOTES = ['approve', 'reject', 'add_note'];
const MAX_MANAGER_NOTES = 500;
// ISO date-time with an explicit zone, e.g. 2026-12-10T10:45:00.000Z or 2026-12-10T12:45+02:00.
const ISO_WITH_ZONE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$/;

// Body of POST /api/order-decision. manager_notes (M6, plan D12): only with approve, reject
// and add_note; trimmed, up to 500 characters, no control characters except new lines;
// empty -> null. add_note requires the field (an empty one clears the note).
export function validateDecisionBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'The request is not valid.' };
  }
  const { order_id, action, final_time, manager_notes } = body;
  if (!isUuid(order_id)) return { error: 'Order id is not valid.' };
  if (typeof action !== 'string' || !DECISION_ACTIONS.includes(action)) return { error: 'Unknown action.' };

  let finalTime = null;
  if (!isEmpty(final_time)) {
    if (!ACTIONS_WITH_TIME.includes(action)) return { error: 'A meeting time can only be set when approving.' };
    if (typeof final_time !== 'string' || final_time.length > 40 || !ISO_WITH_ZONE_RE.test(final_time)) {
      return { error: 'Meeting time is not valid.' };
    }
    const parsed = new Date(final_time);
    if (Number.isNaN(parsed.getTime())) return { error: 'Meeting time is not valid.' };
    finalTime = parsed;
  }

  let notes = null;
  if (manager_notes !== undefined && manager_notes !== null) {
    if (!ACTIONS_WITH_NOTES.includes(action)) {
      return { error: 'Manager notes can only be saved with approve, reject or add_note.' };
    }
    if (typeof manager_notes !== 'string' || CONTROL_EXCEPT_NEWLINE_RE.test(manager_notes)) {
      return { error: 'Manager notes are not valid.' };
    }
    const trimmed = manager_notes.trim();
    if (charLength(trimmed) > MAX_MANAGER_NOTES) return { error: 'Manager notes must be 500 characters or fewer.' };
    notes = trimmed || null;
  } else if (action === 'add_note') {
    return { error: 'Manager notes are required.' };
  }

  // M9: agent_id (a user id, or empty / null = no agent) only with approve and assign_agent;
  // assign_agent requires the field (null clears the agent).
  const agentGiven = !isEmpty(body.agent_id);
  if (agentGiven && !ACTIONS_WITH_AGENT.includes(action)) {
    return { error: 'A field agent can only be set when approving or assigning.' };
  }
  if (agentGiven && !isUuid(body.agent_id)) return { error: 'Field agent is not valid.' };
  if (action === 'assign_agent' && !('agent_id' in body)) return { error: 'Field agent is required.' };
  const agentId = agentGiven ? body.agent_id.toLowerCase() : null;

  return {
    value: {
      order_id: order_id.toLowerCase(), action, final_time: finalTime, manager_notes: notes, agent_id: agentId,
    },
  };
}

// Flight search text: optional, up to 40 characters. Only letters, digits, spaces and '-'
// are kept, so the text is safe inside a PostgREST filter. Empty result = no filter.
export function cleanSearchQuery(q) {
  if (q === undefined || q === null) return { value: '' };
  if (typeof q !== 'string') return { error: 'Search text is not valid.' };
  const trimmed = q.trim();
  if (trimmed.length > MAX_SEARCH_LENGTH) return { error: 'Search text must be 40 characters or fewer.' };
  const cleaned = trimmed.replace(/[^A-Za-z0-9 -]/g, '').replace(/\s+/g, ' ').trim();
  return { value: cleaned };
}

// Length in characters as Postgres char_length counts them (code points).
function charLength(s) {
  return Array.from(s).length;
}

function isEmpty(v) {
  return v === undefined || v === null || v === '';
}

const MANUAL_FLIGHT_NO_RE = /^[A-Za-z0-9 -]+$/;
const MAX_FLIGHT_DAYS_AHEAD = 365;

// A typed flight (M5, plan D1): flight_no is letters, digits, spaces and '-', up to 20
// characters, stored upper case without spaces and '-' ("ly 315" -> "LY315", 2-10 left);
// flight_date is a real YYYY-MM-DD date from today (Israel time) up to 365 days ahead.
export function validateManualFlight(flight_no, flight_date, now = new Date()) {
  if (isEmpty(flight_no) || (typeof flight_no === 'string' && flight_no.trim() === '')) {
    return { error: 'Please enter your flight number.' };
  }
  if (typeof flight_no !== 'string' || flight_no.length > 20 || !MANUAL_FLIGHT_NO_RE.test(flight_no)) {
    return { error: 'Enter a flight number with letters and digits only.' };
  }
  const normalized = flight_no.replace(/[ -]/g, '').toUpperCase();
  if (normalized.length < 2 || normalized.length > 10) {
    return { error: 'Enter a flight number with letters and digits only.' };
  }

  if (isEmpty(flight_date)) return { error: 'Please choose your departure date.' };
  if (!isDateKey(flight_date)) return { error: 'Please choose your departure date.' };
  const today = todayIL(now);
  if (flight_date < today) return { error: 'Choose a date from today on.' };
  if (flight_date > addDays(today, MAX_FLIGHT_DAYS_AHEAD)) {
    return { error: 'Choose a date within the next 12 months.' };
  }

  return { value: { flight_no: normalized, flight_date } };
}

// Body of POST /api/submit-order (honeypot is checked separately, before this).
// The flight is either chosen from the list (flight_id) or typed (flight_no + flight_date),
// never both. now is injectable for tests.
export function validateOrderBody(body, now = new Date()) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'The request is not valid.' };
  }

  const { flight_id, flight_no, flight_date, travelers, bags, services, escort_scope, full_name, phone, email, notes } = body;

  let flight;
  if (!isEmpty(flight_id)) {
    if (typeof flight_id !== 'string' || !UUID_RE.test(flight_id)) {
      return { error: 'Please select your flight from the list.' };
    }
    if (!isEmpty(flight_date)) {
      return { error: 'Choose a flight from the list or enter it manually, not both.' };
    }
    if (!isEmpty(flight_no) && (typeof flight_no !== 'string' || flight_no.length > 20)) {
      return { error: 'Flight number is not valid.' };
    }
    flight = { flight_id: flight_id.toLowerCase(), flight_no: null, flight_date: null };
  } else {
    if (isEmpty(flight_no) && isEmpty(flight_date)) {
      return { error: 'Please select your flight from the list.' };
    }
    const manual = validateManualFlight(flight_no, flight_date, now);
    if (manual.error) return manual;
    flight = { flight_id: null, ...manual.value };
  }

  if (!Number.isInteger(travelers) || travelers < 1 || travelers > 10) {
    return { error: 'Travellers must be a whole number from 1 to 10.' };
  }
  if (!Number.isInteger(bags) || bags < 0 || bags > 10) {
    return { error: 'Checked bags must be a whole number from 0 to 10.' };
  }

  const serviceList = isEmpty(services) ? [] : services;
  if (!Array.isArray(serviceList)
    || serviceList.some((s) => typeof s !== 'string' || !SERVICE_CODES.includes(s))
    || new Set(serviceList).size !== serviceList.length) {
    return { error: 'Optional services are not valid.' };
  }

  // Milestone 11 (FR-08, plan D11): how many wheelchairs, 1 up to the number of travellers.
  // A wheelchair without a quantity counts as 1 (a page opened before the update sends none).
  let wheelchairs = null;
  const wheelchairsSent = body.wheelchairs !== undefined && body.wheelchairs !== null;
  if (serviceList.includes('wheelchair')) {
    wheelchairs = 1;
    if (wheelchairsSent) {
      if (!Number.isInteger(body.wheelchairs) || body.wheelchairs < 1) {
        return { error: 'Wheelchairs must be a whole number from 1 to the number of travellers.' };
      }
      if (body.wheelchairs > travelers) {
        return { error: 'Wheelchairs cannot be more than the number of travellers.' };
      }
      wheelchairs = body.wheelchairs;
    }
  } else if (wheelchairsSent) {
    return { error: 'Wheelchairs need the wheelchair service.' };
  }

  if (typeof escort_scope !== 'string' || !ESCORT_CODES.includes(escort_scope)) {
    return { error: 'Please choose an escort scope.' };
  }

  if (typeof full_name !== 'string' || CONTROL_RE.test(full_name)) {
    return { error: 'Please enter your full name.' };
  }
  const name = full_name.trim().replace(/ {2,}/g, ' ');
  if (charLength(name) < 2 || charLength(name) > 80) {
    return { error: 'Full name must be 2 to 80 characters.' };
  }

  if (typeof phone !== 'string') return { error: 'Please enter a valid phone number.' };
  const phoneValue = phone.trim();
  if (!PHONE_RE.test(phoneValue) || (phoneValue.match(/\d/g) || []).length < 7) {
    return { error: 'Please enter a valid phone number.' };
  }

  if (typeof email !== 'string') return { error: 'Please enter a valid email address.' };
  const emailValue = email.trim().toLowerCase();
  if (emailValue.length > 254 || !EMAIL_RE.test(emailValue)) {
    return { error: 'Please enter a valid email address.' };
  }

  let notesValue = null;
  if (!isEmpty(notes)) {
    if (typeof notes !== 'string' || CONTROL_EXCEPT_NEWLINE_RE.test(notes)) {
      return { error: 'Notes are not valid.' };
    }
    const trimmed = notes.trim();
    if (charLength(trimmed) > 500) return { error: 'Notes must be 500 characters or fewer.' };
    notesValue = trimmed || null;
  }

  // Milestone 10 (FR-44): the customer ticked "I understand my booking is subject to manager
  // approval". Only the JSON value true counts; it is checked, not stored.
  if (body.approval_ack !== true) {
    return { error: 'Please confirm that your booking is subject to manager approval.' };
  }

  return {
    value: {
      ...flight,
      travelers,
      bags,
      services: serviceList,
      wheelchairs,
      escort_scope,
      full_name: name,
      phone: phoneValue,
      email: emailValue,
      notes: notesValue,
    },
  };
}

// ---------- Archive (M7, plan D8 and D9) ----------
const STATUS_CODES = lists.statuses.map((s) => s.code);
const MAX_ARCHIVE_PAGE = 1000;
const PAGE_RE = /^\d{1,4}$/;

// Archive search text: like cleanSearchQuery, but letters of any language are kept, because
// customers may type their names in Hebrew. Still no punctuation, so it is safe in a filter.
function cleanArchiveSearch(q) {
  if (q === undefined || q === null) return { value: '' };
  if (typeof q !== 'string') return { error: 'Search text is not valid.' };
  // A '+' may reach us undecoded from a form-style query string ("maya+z"): read it as a space.
  const trimmed = q.replace(/\+/g, ' ').trim();
  if (trimmed.length > MAX_SEARCH_LENGTH) return { error: 'Search text must be 40 characters or fewer.' };
  return { value: trimmed.replace(/[^\p{L}\p{N} -]/gu, '').replace(/\s+/g, ' ').trim() };
}

// Query of GET /api/orders?view=archive. Returns { value: { q, flightQ, status, from, to, page } }
// or { error }. q: cleaned search text ('' = no search); flightQ: the same text without spaces
// and '-', upper case, compared with the stored flight number; from/to: Israel calendar days.
export function validateArchiveQuery(query = {}) {
  const search = cleanArchiveSearch(query.q);
  if (search.error) return { error: search.error };
  const q = search.value;
  const flightQ = q.replace(/[\s-]/g, '').toUpperCase();

  let status = null;
  if (!isEmpty(query.status)) {
    if (typeof query.status !== 'string' || !STATUS_CODES.includes(query.status)) return { error: 'Unknown status.' };
    status = query.status;
  }

  const dates = {};
  for (const key of ['from', 'to']) {
    const v = query[key];
    if (isEmpty(v)) { dates[key] = null; continue; }
    if (typeof v !== 'string' || !isDateKey(v)) return { error: 'Dates must be in the form YYYY-MM-DD.' };
    dates[key] = v;
  }
  if (dates.from && dates.to && dates.from > dates.to) {
    return { error: 'The From date must not be after the To date.' };
  }

  let page = 1;
  if (!isEmpty(query.page)) {
    const n = typeof query.page === 'string' && PAGE_RE.test(query.page) ? Number(query.page) : NaN;
    if (!Number.isInteger(n) || n < 1 || n > MAX_ARCHIVE_PAGE) return { error: 'Page is not valid.' };
    page = n;
  }

  // M9 (plan D14): "My orders only" for the field agent: "1" or empty.
  let mine = false;
  if (!isEmpty(query.mine)) {
    if (query.mine !== '1') return { error: 'Unknown filter.' };
    mine = true;
  }

  return { value: { q, flightQ, status, from: dates.from, to: dates.to, page, mine } };
}

// ---------- Order lookup (Milestone 14, plan D5, D7) ----------
export const LOOKUP_NUMBER_MESSAGE = 'Please enter the 8-character order number.';
export const LOOKUP_EMAIL_MESSAGE = 'Please enter a valid email address.';
const ORDER_NUMBER_RE = /^[0-9A-F]{8}$/;

// Body of POST /api/order-lookup -> { value: { reference, email } } or { error }.
// The number is trimmed and upper-cased (the 8 characters of ADR-45); the email is lower-cased.
export function validateLookupBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: LOOKUP_NUMBER_MESSAGE };
  const { order_number, email } = body;
  if (typeof order_number !== 'string') return { error: LOOKUP_NUMBER_MESSAGE };
  const reference = order_number.trim().toUpperCase();
  if (!ORDER_NUMBER_RE.test(reference)) return { error: LOOKUP_NUMBER_MESSAGE };
  if (typeof email !== 'string') return { error: LOOKUP_EMAIL_MESSAGE };
  const emailValue = email.trim().toLowerCase();
  if (emailValue.length > 254 || !EMAIL_RE.test(emailValue)) return { error: LOOKUP_EMAIL_MESSAGE };
  return { value: { reference, email: emailValue } };
}
