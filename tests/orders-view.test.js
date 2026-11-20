// Tests for lib/orders-view.js. Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toManagerView, toAgentView, pickAi, currentRecommended, referenceOf, byDeparture, byMeetingTime,
} from '../lib/orders-view.js';

function row(overrides = {}) {
  return {
    id: 'a1b2c3d4-0000-4000-8000-000000000001',
    status: 'pending',
    contact_name: 'Daniel A.',
    contact_phone: '050-1110001',
    customer: { email: 'daniel@example.com' },
    flight: { flight_no: 'DM101', destination: 'London', departure_at: '2026-12-10T12:30:00+00:00' },
    flight_no_submitted: 'DM101',
    travelers: 2,
    bags: 3,
    services: ['porter'],
    escort_scope: 'full',
    customer_notes: 'One oversized bag.',
    recommended_time: '2026-12-10T10:45:00+00:00',
    final_time: null,
    manager_notes: 'secret note',
    ai_output: { status: 'ok' },
    created_at: '2026-12-09T16:00:00+00:00',
    ...overrides,
  };
}

test('reference is the first 8 characters in upper case', () => {
  assert.equal(referenceOf('a1b2c3d4-0000-4000-8000-000000000001'), 'A1B2C3D4');
});

test('pending order: recommended time follows the current flight departure (FR-42)', () => {
  // Flight moved 60 minutes later than when the order was stored.
  const moved = row({ flight: { flight_no: 'DM101', destination: 'London', departure_at: '2026-12-10T13:30:00Z' } });
  assert.equal(currentRecommended(moved), '2026-12-10T11:45:00.000Z');
});

test('approved order keeps its stored recommended time', () => {
  const approved = row({ status: 'approved', flight: { flight_no: 'DM101', destination: 'London', departure_at: '2026-12-10T13:30:00Z' } });
  assert.equal(currentRecommended(approved), '2026-12-10T10:45:00+00:00');
});

test('manager view: contact details come from the order, email from the customer', () => {
  const view = toManagerView(row());
  assert.deepEqual(view.customer, { full_name: 'Daniel A.', phone: '050-1110001', email: 'daniel@example.com' });
  assert.equal(view.reference, 'A1B2C3D4');
  assert.deepEqual(view.flight, { flight_no: 'DM101', destination: 'London', departure_at: '2026-12-10T12:30:00+00:00' });
  assert.equal(view.customer_notes, 'One oversized bag.');
  assert.equal(view.escort_scope, 'full');
});

test('manager view does not include fields of later milestones', () => {
  const view = toManagerView(row());
  for (const key of ['manager_notes', 'customer_id', 'flight_id']) {
    assert.ok(!(key in view), `${key} must not be returned`);
  }
});

test('order without a flight shows the submitted flight number and no recommended time', () => {
  const view = toManagerView(row({ status: 'needs_clarification', flight: null, flight_no_submitted: 'DM999', recommended_time: null }));
  assert.deepEqual(view.flight, { flight_no: 'DM999', destination: null, departure_at: null });
  assert.equal(view.recommended_time, null);
});

test('sorting: soonest departure first, no flight last', () => {
  const a = toManagerView(row({ flight: { flight_no: 'A', destination: 'X', departure_at: '2026-12-11T10:00:00Z' } }));
  const b = toManagerView(row({ flight: { flight_no: 'B', destination: 'X', departure_at: '2026-12-10T10:00:00Z' } }));
  const c = toManagerView(row({ flight: null, flight_no_submitted: 'C' }));
  assert.deepEqual([a, c, b].sort(byDeparture).map((o) => o.flight.flight_no), ['B', 'A', 'C']);
});

test('manager view: only the used AI fields', () => {
  const ai = { status: 'ok', model: 'm', generated_at: 'x', customer_paragraph: 'Hello Daniel.', recommended_services: ['porter'] };
  assert.deepEqual(toManagerView(row({ ai_output: ai })).ai_output,
    { status: 'ok', customer_paragraph: 'Hello Daniel.', recommended_services: ['porter'] });
  assert.deepEqual(pickAi({ status: 'failed' }), { status: 'failed' });
  assert.equal(pickAi(null), null);
});

test('agent view: exactly the fields the agent needs, no email, AI, notes or history', () => {
  const view = toAgentView(row({ status: 'approved', final_time: '2026-12-10T10:45:00+00:00' }));
  assert.deepEqual(Object.keys(view).sort(), [
    'bags', 'customer', 'escort_scope', 'final_time', 'flight', 'id', 'manager_notes',
    'reference', 'services', 'status', 'travelers',
  ]);
  assert.deepEqual(view.customer, { full_name: 'Daniel A.', phone: '050-1110001' });
  assert.equal(view.manager_notes, 'secret note');
  const text = JSON.stringify(view);
  for (const leak of ['daniel@example.com', 'One oversized bag.', 'ai_output', 'recommended_time']) {
    assert.ok(!text.includes(leak), `${leak} must not reach the agent`);
  }
});

test('agent view: empty manager notes become null', () => {
  assert.equal(toAgentView(row({ manager_notes: '' })).manager_notes, null);
});

test('agent sorting: soonest meeting first, no meeting time last', () => {
  const a = toAgentView(row({ id: 'a0000000-0000-4000-8000-000000000001', final_time: '2026-12-10T12:00:00Z' }));
  const b = toAgentView(row({ id: 'b0000000-0000-4000-8000-000000000001', final_time: '2026-12-10T09:00:00Z' }));
  const c = toAgentView(row({ id: 'c0000000-0000-4000-8000-000000000001', final_time: null }));
  assert.deepEqual([a, c, b].sort(byMeetingTime).map((o) => o.reference), ['B0000000', 'A0000000', 'C0000000']);
});
