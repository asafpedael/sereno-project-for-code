// Input validation for the API functions. Pure functions: return { value } or { error }.
import lists from '../data/lists.json' with { type: 'json' };

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

// Actions of POST /api/order-decision built so far: approve and reject (M3, manager),
// complete (M4, field agent). add_note (M6), confirm_flight_missing and the flight-change
// actions (M5) are added in their milestones.
export const DECISION_ACTIONS = ['approve', 'reject', 'complete'];
// ISO date-time with an explicit zone, e.g. 2026-12-10T10:45:00.000Z or 2026-12-10T12:45+02:00.
const ISO_WITH_ZONE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$/;

// Body of POST /api/order-decision. manager_notes is ignored until M6.
export function validateDecisionBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'The request is not valid.' };
  }
  const { order_id, action, final_time } = body;
  if (!isUuid(order_id)) return { error: 'Order id is not valid.' };
  if (typeof action !== 'string' || !DECISION_ACTIONS.includes(action)) return { error: 'Unknown action.' };

  let finalTime = null;
  if (!isEmpty(final_time)) {
    if (action !== 'approve') return { error: 'A meeting time can only be set when approving.' };
    if (typeof final_time !== 'string' || final_time.length > 40 || !ISO_WITH_ZONE_RE.test(final_time)) {
      return { error: 'Meeting time is not valid.' };
    }
    const parsed = new Date(final_time);
    if (Number.isNaN(parsed.getTime())) return { error: 'Meeting time is not valid.' };
    finalTime = parsed;
  }

  return { value: { order_id: order_id.toLowerCase(), action, final_time: finalTime } };
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

// Body of POST /api/submit-order (honeypot is checked separately, before this).
// M2: the flight must be chosen from the list (flight_id); manual entry comes in M5.
export function validateOrderBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'The request is not valid.' };
  }

  const { flight_id, flight_no, flight_date, travelers, bags, services, escort_scope, full_name, phone, email, notes } = body;

  if (typeof flight_id !== 'string' || !UUID_RE.test(flight_id)) {
    return { error: 'Please select your flight from the list.' };
  }
  if (!isEmpty(flight_date)) {
    return { error: 'Please select your flight from the list.' };
  }
  if (!isEmpty(flight_no) && (typeof flight_no !== 'string' || flight_no.length > 20)) {
    return { error: 'Flight number is not valid.' };
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

  return {
    value: {
      flight_id: flight_id.toLowerCase(),
      travelers,
      bags,
      services: serviceList,
      escort_scope,
      full_name: name,
      phone: phoneValue,
      email: emailValue,
      notes: notesValue,
    },
  };
}
