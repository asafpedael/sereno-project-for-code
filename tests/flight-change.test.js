// Tests for flight-change detection and the M5 manager-view fields (plan D7, D14). Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flightChangePending, clarificationSent, toManagerView } from '../lib/orders-view.js';

const APPROVED_AT = '2026-12-10T12:30:00+00:00';

function row(overrides = {}) {
  return {
    id: 'a1b2c3d4-0000-4000-8000-000000000001',
    status: 'approved',
    contact_name: 'Noa B.',
    contact_phone: '050-1110004',
    customer: { email: 'noa@example.com' },
    flight: { flight_no: 'DM101', destination: 'London', departure_at: APPROVED_AT },
    flight_no_submitted: 'DM101',
    flight_date_submitted: null,
    travelers: 2,
    bags: 3,
    services: [],
    escort_scope: 'full',
    customer_notes: null,
    recommended_time: '2026-12-10T10:45:00+00:00',
    final_time: '2026-12-10T10:45:00+00:00',
    approved_departure_at: APPROVED_AT,
    ignored_departure_at: null,
    ai_output: null,
    created_at: '2026-12-09T16:00:00+00:00',
    ...overrides,
  };
}

const moved = (iso) => ({ flight: { flight_no: 'DM101', destination: 'London', departure_at: iso } });

test('same departure: no change', () => {
  assert.equal(flightChangePending(row()), false);
});

test('same instant written differently is not a change', () => {
  assert.equal(flightChangePending(row(moved('2026-12-10T14:30:00+02:00'))), false);
  assert.equal(flightChangePending(row(moved('2026-12-10T12:30:00.000Z'))), false);
});

test('flight moved: change pending', () => {
  assert.equal(flightChangePending(row(moved('2026-12-10T13:30:00Z'))), true);
});

test('changed then ignored: no change', () => {
  assert.equal(flightChangePending(row({ ...moved('2026-12-10T13:30:00Z'), ignored_departure_at: '2026-12-10T13:30:00+00:00' })), false);
});

test('ignored, then moved again: change pending again', () => {
  assert.equal(flightChangePending(row({ ...moved('2026-12-10T14:00:00Z'), ignored_departure_at: '2026-12-10T13:30:00+00:00' })), true);
});

test('moved back to the approved time after an ignore: no change', () => {
  assert.equal(flightChangePending(row({ ignored_departure_at: '2026-12-10T13:30:00+00:00' })), false);
});

test('not approved, no flight, or no approved departure: never a change', () => {
  for (const status of ['pending', 'needs_clarification', 'rejected', 'completed']) {
    assert.equal(flightChangePending(row({ ...moved('2026-12-10T13:30:00Z'), status })), false, status);
  }
  assert.equal(flightChangePending(row({ flight: null })), false);
  assert.equal(flightChangePending(row({ ...moved('2026-12-10T13:30:00Z'), approved_departure_at: null })), false);
});

test('manager view: change fields when the flight moved', () => {
  const view = toManagerView(row(moved('2026-12-10T13:30:00Z')));
  assert.equal(view.flight_change_pending, true);
  assert.equal(view.previous_departure_at, APPROVED_AT);
  assert.equal(view.flight.departure_at, '2026-12-10T13:30:00Z');
  // 2 travellers, 3 bags = 105 minutes before the new departure.
  assert.equal(view.new_recommended_time, '2026-12-10T11:45:00.000Z');
});

test('manager view: no change fields when nothing moved', () => {
  const view = toManagerView(row());
  assert.equal(view.flight_change_pending, false);
  assert.equal(view.previous_departure_at, null);
  assert.equal(view.new_recommended_time, null);
});

test('manager view: typed flight and clarification state', () => {
  const missing = row({
    status: 'needs_clarification', flight: null, flight_no_submitted: 'LY315',
    flight_date_submitted: '2026-12-12', approved_departure_at: null, final_time: null, recommended_time: null,
  });
  const view = toManagerView(missing);
  assert.deepEqual(view.submitted_flight, { flight_no: 'LY315', date: '2026-12-12' });
  assert.deepEqual(view.clarification, { sent: false });
  assert.equal(view.flight_change_pending, false);

  const sent = { ...missing, ai_output: { status: 'ok', clarification: { paragraph: 'x', sent_at: '2026-12-01T10:00:00Z' } } };
  assert.equal(clarificationSent(sent), true);
  assert.deepEqual(toManagerView(sent).clarification, { sent: true });
  assert.equal(clarificationSent({ ...missing, ai_output: { status: 'failed', clarification: { paragraph: 'x', sent_at: null } } }), false);
});

test('seed-style missing flight with no typed date', () => {
  const view = toManagerView(row({ status: 'needs_clarification', flight: null, flight_no_submitted: 'DM999', flight_date_submitted: null }));
  assert.deepEqual(view.submitted_flight, { flight_no: 'DM999', date: null });
});
