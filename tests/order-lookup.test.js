// Tests for the customer's order lookup (Milestone 14). Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateLookupBody, LOOKUP_NUMBER_MESSAGE, LOOKUP_EMAIL_MESSAGE } from '../lib/validate.js';
import { LOOKUP_SELECT, customerStatus, toCustomerView } from '../lib/orders-view.js';
import lists from '../data/lists.json' with { type: 'json' };

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const VIEW_KEYS = [
  'reference', 'status', 'flight', 'meeting_time', 'flight_change_pending', 'meeting_point',
  'travelers', 'bags', 'services', 'escort', 'estimated_price',
  'escort_language', 'arrival_method', // Milestone 16 (never the traveller names)
].sort();

const SECRET_TEXTS = ['MANAGER-SECRET', 'CUSTOMER-SECRET', '050-9999999', 'AI-SECRET', 'agent-uuid', 'Secret Name', 'secret@example.com'];

function row(overrides = {}) {
  return {
    id: 'a1b2c3d4-1111-2222-3333-444455556666',
    status: 'approved',
    flight_no_submitted: 'DM101',
    flight_date_submitted: null,
    travelers: 2,
    bags: 3,
    services: ['porter'],
    wheelchairs: null,
    escort_scope: 'full',
    estimated_price: 375,
    final_time: '2026-12-10T10:45:00Z',
    recommended_time: '2026-12-10T10:45:00Z',
    approved_departure_at: '2026-12-10T12:30:00Z',
    ignored_departure_at: null,
    ai_output: { status: 'ok', customer_paragraph: 'AI-SECRET' },
    manager_notes: 'MANAGER-SECRET',
    customer_notes: 'CUSTOMER-SECRET',
    contact_name: 'Secret Name',
    contact_phone: '050-9999999',
    assigned_agent_id: 'agent-uuid',
    customer: { email: 'secret@example.com' },
    flight: { flight_no: 'DM101', airline: 'Demo Airlines', destination: 'London', departure_at: '2026-12-10T12:30:00Z' },
    ...overrides,
  };
}

test('validateLookupBody: number trimmed and upper-cased, email lower-cased', () => {
  assert.deepEqual(validateLookupBody({ order_number: ' a1b2c3d4 ', email: ' Name@Example.COM ' }),
    { value: { reference: 'A1B2C3D4', email: 'name@example.com' } });
});

test('validateLookupBody: bad numbers and emails get the field messages', () => {
  for (const n of ['A1B2C3D', 'A1B2C3D45', 'G1B2C3D4', 'A1B2 3D4', 12345678, undefined, '']) {
    assert.deepEqual(validateLookupBody({ order_number: n, email: 'a@example.com' }), { error: LOOKUP_NUMBER_MESSAGE });
  }
  for (const e of ['', 'no-at', 'a@b', undefined, 5]) {
    assert.deepEqual(validateLookupBody({ order_number: 'A1B2C3D4', email: e }), { error: LOOKUP_EMAIL_MESSAGE });
  }
  assert.deepEqual(validateLookupBody(null), { error: LOOKUP_NUMBER_MESSAGE });
  assert.deepEqual(validateLookupBody([]), { error: LOOKUP_NUMBER_MESSAGE });
});

test('customerStatus: needs_clarification is pending until the clarification email', () => {
  assert.equal(customerStatus({ status: 'pending' }), 'pending');
  assert.equal(customerStatus({ status: 'needs_clarification', ai_output: null }), 'pending');
  assert.equal(customerStatus({ status: 'needs_clarification', ai_output: { clarification: { sent_at: '2026-12-01T10:00:00Z' } } }), 'check_email');
  for (const s of ['approved', 'rejected', 'completed']) assert.equal(customerStatus({ status: s }), s);
});

test('toCustomerView: exactly the fixed fields, nothing internal', () => {
  for (const status of ['pending', 'needs_clarification', 'approved', 'rejected', 'completed']) {
    const view = toCustomerView(row({ status }));
    assert.deepEqual(Object.keys(view).sort(), VIEW_KEYS);
    assert.deepEqual(Object.keys(view.flight).sort(), ['airline', 'date', 'departure_at', 'destination', 'flight_no']);
    const text = JSON.stringify(view);
    for (const secret of SECRET_TEXTS) assert.ok(!text.includes(secret), `${status} leaks ${secret}`);
    assert.ok(!text.includes('a1b2c3d4-1111'), 'no full id');
  }
});

test('toCustomerView: approved shows the time and the meeting point', () => {
  const view = toCustomerView(row());
  assert.equal(view.reference, 'A1B2C3D4');
  assert.equal(view.status, 'approved');
  assert.equal(view.meeting_time, '2026-12-10T10:45:00Z');
  assert.equal(view.meeting_point, lists.meeting_point);
  assert.equal(view.flight_change_pending, false);
  assert.equal(view.services, 'Porter / luggage help');
  assert.equal(view.escort, 'Full (to the gate)');
  assert.equal(view.estimated_price, '$375');
});

test('toCustomerView: a flight change waiting for the manager hides the time', () => {
  const view = toCustomerView(row({ flight: { flight_no: 'DM101', airline: null, destination: 'London', departure_at: '2026-12-10T13:00:00Z' } }));
  assert.equal(view.flight_change_pending, true);
  assert.equal(view.meeting_time, null);
  assert.equal(view.meeting_point, lists.meeting_point);
});

test('toCustomerView: time and meeting point per status', () => {
  const pending = toCustomerView(row({ status: 'pending', final_time: null }));
  assert.equal(pending.meeting_time, null);
  assert.equal(pending.meeting_point, lists.meeting_point);
  const rejected = toCustomerView(row({ status: 'rejected' }));
  assert.equal(rejected.meeting_time, null);
  assert.equal(rejected.meeting_point, null);
  const completed = toCustomerView(row({ status: 'completed' }));
  assert.equal(completed.meeting_time, '2026-12-10T10:45:00Z');
  assert.equal(completed.meeting_point, null);
  const check = toCustomerView(row({ status: 'needs_clarification', final_time: null, ai_output: { clarification: { sent_at: 'x' } } }));
  assert.equal(check.status, 'check_email');
  assert.equal(check.meeting_time, null);
  assert.equal(check.meeting_point, lists.meeting_point);
});

test('toCustomerView: typed flight, old order without price, services', () => {
  const view = toCustomerView(row({
    status: 'needs_clarification', flight: null, flight_no_submitted: 'LY999', flight_date_submitted: '2026-12-20',
    estimated_price: null, services: ['porter', 'wheelchair'], wheelchairs: 2,
  }));
  assert.deepEqual(view.flight, { flight_no: 'LY999', destination: null, airline: null, departure_at: null, date: '2026-12-20' });
  assert.equal(view.estimated_price, null);
  assert.equal(view.services, 'Porter / luggage help, Wheelchair × 2');
  assert.equal(toCustomerView(row({ services: [] })).services, 'None');
});

test('LOOKUP_SELECT reads no internal column', () => {
  for (const word of ['manager_notes', 'customer_notes', 'contact_', 'assigned_agent_id', 'email', 'recommended_time', '*']) {
    assert.ok(!LOOKUP_SELECT.includes(word), word);
  }
});

test('006_order_lookup.sql: columns, locked function, limits, grants', () => {
  const sql = read('supabase/migrations/006_order_lookup.sql');
  assert.match(sql, /alter table public\.orders\s+add column if not exists lookup_guard jsonb/);
  assert.match(sql, /alter table public\.customers add column if not exists lookup_guard jsonb/);
  assert.match(sql, /create or replace function public\.lookup_order\(p_reference text, p_email text\)/);
  assert.match(sql, /security invoker set search_path = ''/);
  assert.match(sql, /pg_advisory_xact_lock\(727002\)/);
  assert.match(sql, /c_max_failures constant integer := 5/);
  assert.match(sql, /c_window constant interval := interval '15 minutes'/);
  assert.match(sql, /revoke execute on function public\.lookup_order\(text, text\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.lookup_order\(text, text\) to service_role/);
});

test('pages: landing links to the lookup; the lookup page has its fields', () => {
  const landing = read('public/index.html');
  assert.ok((landing.match(/href="\/check-order\.html"/g) || []).length >= 2);
  const page = read('public/check-order.html');
  assert.match(page, /<label[^>]*for="order-number"[^>]*>Order number<\/label>/);
  assert.match(page, /<label[^>]*for="lookup-email"[^>]*>Email<\/label>/);
  assert.match(page, /name="website"/);
  assert.match(page, /<meta name="robots" content="noindex">/);
});
