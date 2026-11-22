// Tests for the customer email events in lib/notify.js. Run: node --test
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  notify, approvedEmailPayload, rejectedEmailPayload, clarificationEmailPayload, flightChangeEmailPayload,
} from '../lib/notify.js';
import { fixedClarificationParagraph } from '../lib/prompts.js';

function row(overrides = {}) {
  return {
    id: 'a1b2c3d4-0000-4000-8000-000000000001',
    status: 'approved',
    contact_name: 'Daniel A.',
    contact_phone: '050-1110001',
    customer: { email: 'daniel@example.com' },
    flight: { flight_no: 'DM101', destination: 'London', departure_at: '2026-12-10T12:30:00+00:00' },
    flight_no_submitted: 'DM101',
    travelers: 2,
    bags: 3,
    services: ['porter', 'wheelchair'],
    escort_scope: 'full',
    customer_notes: 'One oversized bag.',
    final_time: '2026-12-10T10:40:00+00:00',
    manager_notes: 'Secret note for the agent',
    ai_output: { status: 'ok', customer_paragraph: 'Hello Daniel, thank you for choosing Sereno.', recommended_services: ['porter'] },
    ...overrides,
  };
}

test('approved email: order details and the final meeting time in Israel time', () => {
  assert.deepEqual(approvedEmailPayload(row()), {
    type: 'customer_approved',
    to: 'daniel@example.com',
    customer_name: 'Daniel A.',
    reference: 'A1B2C3D4',
    flight_no: 'DM101',
    destination: 'London',
    departure_local: '10 Dec 2026, 14:30',
    meeting_time_local: '10 Dec 2026, 12:40',
    previous_meeting_time_local: null,
    travelers: 2,
    bags: 3,
    services: ['Porter / luggage help', 'Wheelchair'],
    escort_scope: 'Full (to the gate)',
    ai_paragraph: 'Hello Daniel, thank you for choosing Sereno.',
  });
});

test('approved email: no AI paragraph when the AI failed or never ran', () => {
  assert.equal(approvedEmailPayload(row({ ai_output: { status: 'failed' } })).ai_paragraph, '');
  assert.equal(approvedEmailPayload(row({ ai_output: null })).ai_paragraph, '');
});

test('rejected email: name, reference and flight only', () => {
  assert.deepEqual(rejectedEmailPayload(row({ status: 'rejected', final_time: null })), {
    type: 'customer_rejected',
    to: 'daniel@example.com',
    customer_name: 'Daniel A.',
    reference: 'A1B2C3D4',
    flight_no: 'DM101',
    destination: 'London',
    departure_local: '10 Dec 2026, 14:30',
  });
});

const missing = (overrides = {}) => row({
  status: 'needs_clarification', flight: null, flight_no_submitted: 'LY315',
  flight_date_submitted: '2026-12-12', final_time: null, ai_output: null, ...overrides,
});

test('rejected email for a typed flight: the typed number and date', () => {
  const payload = rejectedEmailPayload(missing({ status: 'rejected' }));
  assert.equal(payload.flight_no, 'LY315');
  assert.equal(payload.destination, null);
  assert.equal(payload.departure_local, '12 Dec 2026');
  assert.equal(rejectedEmailPayload(missing({ flight_date_submitted: null })).departure_local, null);
});

test('clarification email: typed number and date and the saved paragraph', () => {
  assert.deepEqual(clarificationEmailPayload(missing(), 'Please check your flight.'), {
    type: 'customer_clarification',
    to: 'daniel@example.com',
    customer_name: 'Daniel A.',
    reference: 'A1B2C3D4',
    flight_no: 'LY315',
    departure_local: '12 Dec 2026',
    ai_paragraph: 'Please check your flight.',
  });
});

test('flight change email: new meeting time, previous kept in the event, no AI paragraph', () => {
  const payload = flightChangeEmailPayload(
    row({ final_time: '2026-12-10T11:40:00+00:00', flight: { flight_no: 'DM101', destination: 'London', departure_at: '2026-12-10T13:30:00+00:00' } }),
    '2026-12-10T10:40:00+00:00');
  assert.equal(payload.type, 'customer_flight_change');
  assert.equal(payload.departure_local, '10 Dec 2026, 15:30');
  assert.equal(payload.meeting_time_local, '10 Dec 2026, 13:40');
  assert.equal(payload.previous_meeting_time_local, '10 Dec 2026, 12:40');
  assert.equal(payload.ai_paragraph, '');
});

test('fixed clarification paragraph, with and without a date (D11)', () => {
  assert.equal(fixedClarificationParagraph('LY315', '12 Dec 2026'),
    'We could not find flight LY315 on 12 Dec 2026 in our schedule. Please check your flight number and departure date, and send a new request with the correct details. We will be glad to help.');
  assert.equal(fixedClarificationParagraph('DM999', null),
    'We could not find flight DM999 in our schedule. Please check your flight number and departure date, and send a new request with the correct details. We will be glad to help.');
});

test('customer emails never carry manager notes, customer notes or the phone', () => {
  for (const payload of [
    approvedEmailPayload(row()), rejectedEmailPayload(row()),
    clarificationEmailPayload(missing(), 'x'), flightChangeEmailPayload(row(), '2026-12-10T10:00:00Z'),
  ]) {
    const text = JSON.stringify(payload);
    for (const secret of ['Secret note for the agent', 'One oversized bag.', '050-1110001']) {
      assert.ok(!text.includes(secret), `${secret} must not be in ${payload.type}`);
    }
  }
});

// ---------- notify(): true only when n8n accepted the event ----------

const realFetch = globalThis.fetch;
const realEnv = { url: process.env.N8N_WEBHOOK_URL, secret: process.env.N8N_WEBHOOK_SECRET };
const quiet = console.error;

afterEach(() => {
  globalThis.fetch = realFetch;
  console.error = quiet;
  if (realEnv.url === undefined) delete process.env.N8N_WEBHOOK_URL; else process.env.N8N_WEBHOOK_URL = realEnv.url;
  if (realEnv.secret === undefined) delete process.env.N8N_WEBHOOK_SECRET; else process.env.N8N_WEBHOOK_SECRET = realEnv.secret;
});

function setup(response) {
  process.env.N8N_WEBHOOK_URL = 'https://n8n.test/webhook/sereno-dev';
  process.env.N8N_WEBHOOK_SECRET = 'test-secret';
  console.error = () => {};
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (response instanceof Error) throw response;
    return response;
  };
  return calls;
}

test('notify: accepted event returns true and sends the secret header', async () => {
  const calls = setup({ ok: true, status: 200 });
  assert.equal(await notify({ type: 'customer_rejected' }), true);
  assert.equal(calls[0].options.headers['X-Webhook-Secret'], 'test-secret');
});

test('notify: refused, failed or unconfigured returns false', async () => {
  setup({ ok: false, status: 403 });
  assert.equal(await notify({ type: 'customer_approved' }), false);
  setup(new Error('network'));
  assert.equal(await notify({ type: 'customer_approved' }), false);
  setup({ ok: true, status: 200 });
  delete process.env.N8N_WEBHOOK_SECRET;
  assert.equal(await notify({ type: 'customer_approved' }), false);
});
