// Builds the order objects the API returns, per role (ARCHITECTURE section 5.1).
// M3: manager view only. Agent view (M4), AI output (M4), returning customer and
// history (M6) and flight_change_pending (M5) are added in their milestones.
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

export function toManagerView(row) {
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
  };
}

// Soonest departure first; orders without a flight go last.
export function byDeparture(a, b) {
  const ta = a.flight.departure_at ? Date.parse(a.flight.departure_at) : Infinity;
  const tb = b.flight.departure_at ? Date.parse(b.flight.departure_at) : Infinity;
  return ta - tb;
}
