// Tests for the wheelchair quantity and the fixed meeting point (Milestone 11). Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateOrderBody } from '../lib/validate.js';
import { servicesLabels } from '../public/js/services-text.js';
import { toManagerView, toAgentView } from '../lib/orders-view.js';
import {
  approvedEmailPayload, rejectedEmailPayload, clarificationEmailPayload, flightChangeEmailPayload,
  receivedEmailPayload,
} from '../lib/notify.js';
import { buildOrderDraftInput, NEW_CUSTOMER_HISTORY } from '../lib/prompts.js';
import lists from '../data/lists.json' with { type: 'json' };

const NOW = new Date('2026-11-20T21:30:00Z');
const FLIGHT_ID = '11111111-2222-4333-8444-555555555555';
const MEETING_POINT = 'Departures hall, Terminal 3, before security.';
const MORE_ERROR = 'Wheelchairs cannot be more than the number of travellers.';
const WHOLE_ERROR = 'Wheelchairs must be a whole number from 1 to the number of travellers.';
const NO_SERVICE_ERROR = 'Wheelchairs need the wheelchair service.';
const LABELS = Object.fromEntries(lists.services.map((s) => [s.code, s.label]));

function body(overrides = {}) {
  return {
    flight_id: FLIGHT_ID, flight_no: 'DM101', flight_date: null,
    travelers: 3, bags: 1, services: ['porter', 'wheelchair'], escort_scope: 'full',
    full_name: 'Dana Test', phone: '050-1234567', email: 'dana@example.com', notes: '',
    approval_ack: true,
    ...overrides,
  };
}

function orderRow(overrides = {}) {
  return {
    id: 'a1b2c3d4-0000-4000-8000-000000000001',
    status: 'approved',
    contact_name: 'Daniel A.',
    contact_phone: '050-1110001',
    customer: { email: 'daniel@example.com' },
    flight: { flight_no: 'DM101', destination: 'London', departure_at: '2026-12-10T12:30:00+00:00' },
    flight_no_submitted: 'DM101',
    travelers: 3,
    bags: 2,
    services: ['porter', 'wheelchair'],
    wheelchairs: 2,
    escort_scope: 'full',
    recommended_time: '2026-12-10T10:45:00+00:00',
    final_time: '2026-12-10T10:40:00+00:00',
    manager_notes: 'Secret note for the agent',
    ai_output: null,
    created_at: '2026-12-09T16:00:00+00:00',
    ...overrides,
  };
}

// ---------- The meeting point ----------

test('the meeting point is the fixed sentence Asaf chose', () => {
  assert.equal(lists.meeting_point, MEETING_POINT);
});

// ---------- Validation (plan D11) ----------

test('a quantity from 1 to the number of travellers is kept', () => {
  assert.equal(validateOrderBody(body({ wheelchairs: 2 }), NOW).value.wheelchairs, 2);
  assert.equal(validateOrderBody(body({ wheelchairs: 3 }), NOW).value.wheelchairs, 3);
  assert.equal(validateOrderBody(body({ wheelchairs: 1 }), NOW).value.wheelchairs, 1);
});

test('a wheelchair without a quantity counts as 1 (a page opened before the update)', () => {
  assert.equal(validateOrderBody(body(), NOW).value.wheelchairs, 1);
  assert.equal(validateOrderBody(body({ wheelchairs: null }), NOW).value.wheelchairs, 1);
});

test('more wheelchairs than travellers is refused', () => {
  assert.equal(validateOrderBody(body({ wheelchairs: 4 }), NOW).error, MORE_ERROR);
  assert.equal(validateOrderBody(body({ travelers: 1, wheelchairs: 2 }), NOW).error, MORE_ERROR);
});

test('zero, a fraction or text is refused', () => {
  for (const value of [0, -1, 1.5, '2', true, {}]) {
    assert.equal(validateOrderBody(body({ wheelchairs: value }), NOW).error, WHOLE_ERROR, String(value));
  }
});

test('a quantity without the wheelchair service is refused; none at all is fine', () => {
  assert.equal(validateOrderBody(body({ services: ['porter'], wheelchairs: 2 }), NOW).error, NO_SERVICE_ERROR);
  assert.equal(validateOrderBody(body({ services: ['porter'] }), NOW).value.wheelchairs, null);
  assert.equal(validateOrderBody(body({ services: [], wheelchairs: null }), NOW).value.wheelchairs, null);
});

test('an invalid service list is still reported first', () => {
  assert.equal(validateOrderBody(body({ services: ['spa'], wheelchairs: 9 }), NOW).error, 'Optional services are not valid.');
});

// ---------- Labels (plan D7, D8) ----------

test('labels: one wheelchair or none recorded reads "Wheelchair"; 2 or more adds the quantity', () => {
  assert.deepEqual(servicesLabels([], null, LABELS), []);
  assert.deepEqual(servicesLabels(['wheelchair'], null, LABELS), ['Wheelchair']);
  assert.deepEqual(servicesLabels(['wheelchair'], 1, LABELS), ['Wheelchair']);
  assert.deepEqual(servicesLabels(['wheelchair'], 2, LABELS), ['Wheelchair × 2']);
  assert.deepEqual(servicesLabels(['porter', 'wheelchair'], 3, LABELS), ['Porter / luggage help', 'Wheelchair × 3']);
  assert.deepEqual(servicesLabels(['porter'], 3, LABELS), ['Porter / luggage help']);
  assert.deepEqual(servicesLabels(['unknown'], null, LABELS), ['unknown']);
  assert.deepEqual(servicesLabels(null, null, LABELS), []);
});

// ---------- Views (plan D12) ----------

test('manager and agent views carry the quantity, null for an order saved before it existed', () => {
  assert.equal(toManagerView(orderRow()).wheelchairs, 2);
  assert.equal(toAgentView(orderRow()).wheelchairs, 2);
  const old = orderRow();
  delete old.wheelchairs;
  assert.equal(toManagerView(old).wheelchairs, null);
  assert.equal(toAgentView(old).wheelchairs, null);
});

// ---------- Emails (plan D3, D4, D13) ----------

test('approval email: the meeting point and "Wheelchair × 2", no manager notes', () => {
  const payload = approvedEmailPayload(orderRow());
  assert.equal(payload.meeting_point, MEETING_POINT);
  assert.deepEqual(payload.services, ['Porter / luggage help', 'Wheelchair × 2']);
  assert.equal(JSON.stringify(payload).includes('Secret note'), false);
});

test('approval email of an old order: "Wheelchair" as before', () => {
  assert.deepEqual(approvedEmailPayload(orderRow({ wheelchairs: null })).services, ['Porter / luggage help', 'Wheelchair']);
});

test('flight-change email carries the meeting point too', () => {
  const payload = flightChangeEmailPayload(orderRow(), '2026-12-10T10:00:00+00:00');
  assert.equal(payload.meeting_point, MEETING_POINT);
  assert.deepEqual(payload.services, ['Porter / luggage help', 'Wheelchair × 2']);
});

test('rejection, clarification and "request received" emails have no meeting point', () => {
  assert.equal('meeting_point' in rejectedEmailPayload(orderRow({ status: 'rejected' })), false);
  assert.equal('meeting_point' in clarificationEmailPayload(orderRow(), 'Paragraph.'), false);
  const received = receivedEmailPayload({
    reference: 'A1B2C3D4', email: 'daniel@example.com', name: 'Daniel A.',
    flight: { flight_no: 'DM101', destination: 'London', departure_at: '2026-12-10T12:30:00+00:00' },
  });
  assert.equal('meeting_point' in received, false);
});

// ---------- AI input (plan D14) ----------

test('the AI input carries the quantity', () => {
  const order = validateOrderBody(body({ wheelchairs: 2 }), NOW).value;
  const flight = { flight_no: 'DM101', destination: 'London', departure_at: '2026-12-10T12:30:00+00:00' };
  assert.equal(buildOrderDraftInput(order, flight, NEW_CUSTOMER_HISTORY).wheelchairs, 2);
  const noChair = validateOrderBody(body({ services: ['porter'] }), NOW).value;
  assert.equal(buildOrderDraftInput(noChair, flight, NEW_CUSTOMER_HISTORY).wheelchairs, null);
});
