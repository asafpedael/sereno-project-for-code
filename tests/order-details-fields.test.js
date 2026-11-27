// Tests for Milestone 16 (FR-49): the other travellers' names, the escort language and the way
// to the airport. Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import lists from '../data/lists.json' with { type: 'json' };
import {
  validateOrderBody, cleanTravellerNames,
  LANGUAGE_MESSAGE, ARRIVAL_MESSAGE, NAMES_LENGTH_MESSAGE, NAMES_ONE_TRAVELLER_MESSAGE,
} from '../lib/validate.js';
import { toManagerView, toAgentView, toCustomerView, LOOKUP_SELECT } from '../lib/orders-view.js';
import { approvedEmailPayload, receivedEmailPayload } from '../lib/notify.js';
import { buildOrderDraftInput } from '../lib/prompts.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const NOW = new Date('2026-11-20T21:30:00Z');
const FLIGHT_ID = '11111111-2222-4333-8444-555555555555';

function body(overrides = {}) {
  return {
    flight_id: FLIGHT_ID, flight_no: 'DM101', flight_date: null,
    travelers: 3, bags: 2, services: [], escort_scope: 'full',
    escort_language: 'he', arrival_method: 'drop_off', traveller_names: 'Maya Avraham, Noam Avraham',
    full_name: 'Dana Test', phone: '050-1234567', email: 'dana@example.com', notes: '',
    approval_ack: true,
    ...overrides,
  };
}

function row(overrides = {}) {
  return {
    id: 'a1b2c3d4-0000-4000-8000-000000000001',
    status: 'approved',
    contact_name: 'Daniel A.',
    contact_phone: '050-1110001',
    customer: { email: 'daniel@example.com' },
    flight: { flight_no: 'DM101', destination: 'London', airline: 'Demo Airlines', departure_at: '2026-12-10T12:30:00+00:00' },
    flight_no_submitted: 'DM101',
    travelers: 3,
    bags: 2,
    services: [],
    escort_scope: 'full',
    final_time: '2026-12-10T10:30:00+00:00',
    approved_departure_at: '2026-12-10T12:30:00+00:00',
    traveller_names: 'SECRET-NAMES Maya Avraham',
    escort_language: 'ru',
    arrival_method: 'train',
    ai_output: null,
    ...overrides,
  };
}

const OLD = { traveller_names: null, escort_language: null, arrival_method: null };

test('lists: exactly Asaf\'s three languages and four ways, in order', () => {
  assert.deepEqual(lists.escort_languages, [
    { code: 'en', label: 'English' }, { code: 'he', label: 'Hebrew' }, { code: 'ru', label: 'Russian' },
  ]);
  assert.deepEqual(lists.arrival_methods, [
    { code: 'taxi', label: 'Taxi or shuttle' }, { code: 'car', label: 'Driving and parking' },
    { code: 'drop_off', label: 'Drop-off' }, { code: 'train', label: 'Train' },
  ]);
});

test('order form HTML holds the same codes and labels as data/lists.json', () => {
  const html = read('public/order.html');
  const options = [...html.matchAll(/<option value="([^"]+)"[^>]*>([^<]+)<\/option>/g)].map((m) => ({ code: m[1], label: m[2] }));
  assert.deepEqual(options, lists.escort_languages);
  assert.match(html, /<option value="en" selected>English<\/option>/);
  const ways = [...html.matchAll(/name="arrival_method" value="([^"]+)">[\s\S]*?<span class="arrival__text">([^<]+)<\/span>/g)]
    .map((m) => ({ code: m[1], label: m[2] }));
  assert.deepEqual(ways, lists.arrival_methods);
  assert.match(html, /Other travellers \(optional\)/);
});

test('validation: the three details are kept', () => {
  const r = validateOrderBody(body(), NOW);
  assert.equal(r.error, undefined);
  assert.equal(r.value.escort_language, 'he');
  assert.equal(r.value.arrival_method, 'drop_off');
  assert.equal(r.value.traveller_names, 'Maya Avraham, Noam Avraham');
  for (const { code } of lists.escort_languages) assert.equal(validateOrderBody(body({ escort_language: code }), NOW).value.escort_language, code);
  for (const { code } of lists.arrival_methods) assert.equal(validateOrderBody(body({ arrival_method: code }), NOW).value.arrival_method, code);
});

test('validation: missing language or way is stored empty (a page opened before the update)', () => {
  const old = body();
  delete old.escort_language;
  delete old.arrival_method;
  delete old.traveller_names;
  const r = validateOrderBody(old, NOW);
  assert.equal(r.error, undefined);
  assert.deepEqual([r.value.escort_language, r.value.arrival_method, r.value.traveller_names], [null, null, null]);
  assert.equal(validateOrderBody(body({ escort_language: null, arrival_method: null }), NOW).error, undefined);
});

test('validation: an unknown language or way is refused', () => {
  for (const value of ['fr', 'EN', '', 1, {}]) {
    assert.equal(validateOrderBody(body({ escort_language: value }), NOW).error, LANGUAGE_MESSAGE, String(value));
    assert.equal(validateOrderBody(body({ arrival_method: value }), NOW).error, ARRIVAL_MESSAGE, String(value));
  }
});

test('names: trimmed, spaces collapsed, empty lines dropped, empty -> null', () => {
  assert.deepEqual(cleanTravellerNames('  Maya   Avraham \r\n\r\n Noam  A. '), { value: 'Maya Avraham\nNoam A.' });
  assert.deepEqual(cleanTravellerNames(''), { value: null });
  assert.deepEqual(cleanTravellerNames('   \n  '), { value: null });
  assert.deepEqual(cleanTravellerNames(null), { value: null });
  assert.equal(validateOrderBody(body({ traveller_names: '   ' }), NOW).value.traveller_names, null);
});

test('names: up to 300 characters, no control characters, need 2 or more travellers', () => {
  assert.equal(validateOrderBody(body({ traveller_names: 'a'.repeat(300) }), NOW).error, undefined);
  assert.equal(validateOrderBody(body({ traveller_names: 'a'.repeat(301) }), NOW).error, NAMES_LENGTH_MESSAGE);
  assert.equal(validateOrderBody(body({ traveller_names: 'Maya\u0007' }), NOW).error, 'Names are not valid.');
  assert.equal(validateOrderBody(body({ traveller_names: ['Maya'] }), NOW).error, 'Names are not valid.');
  assert.equal(validateOrderBody(body({ travelers: 1 }), NOW).error, NAMES_ONE_TRAVELLER_MESSAGE);
  assert.equal(validateOrderBody(body({ travelers: 1, traveller_names: '' }), NOW).error, undefined);
});

test('validation: the consent check is still the last one', () => {
  const r = validateOrderBody(body({ arrival_method: 'boat', approval_ack: false }), NOW);
  assert.equal(r.error, ARRIVAL_MESSAGE);
});

test('manager and agent views carry the three details; old orders give nulls', () => {
  for (const view of [toManagerView(row()), toAgentView(row())]) {
    assert.equal(view.traveller_names, 'SECRET-NAMES Maya Avraham');
    assert.equal(view.escort_language, 'ru');
    assert.equal(view.arrival_method, 'train');
  }
  for (const view of [toManagerView(row(OLD)), toAgentView(row(OLD))]) {
    assert.deepEqual([view.traveller_names, view.escort_language, view.arrival_method], [null, null, null]);
  }
});

test('order lookup: language and way as labels, never the names', () => {
  const view = toCustomerView(row());
  assert.equal(view.escort_language, 'Russian');
  assert.equal(view.arrival_method, 'Train');
  assert.equal('traveller_names' in view, false);
  assert.equal(JSON.stringify(view).includes('SECRET-NAMES'), false);
  assert.equal(LOOKUP_SELECT.includes('traveller_names'), false);
  assert.match(LOOKUP_SELECT, /escort_language, arrival_method/);
  const old = toCustomerView(row(OLD));
  assert.deepEqual([old.escort_language, old.arrival_method], [null, null]);
});

test('approval email: language and way as labels, never the names', () => {
  const payload = approvedEmailPayload(row());
  assert.equal(payload.escort_language, 'Russian');
  assert.equal(payload.arrival_method, 'Train');
  assert.equal(JSON.stringify(payload).includes('SECRET-NAMES'), false);
  const old = approvedEmailPayload(row(OLD));
  assert.deepEqual([old.escort_language, old.arrival_method], [null, null]);
});

test('"request received" email does not change', () => {
  const payload = receivedEmailPayload({
    reference: 'A1B2C3D4', email: 'd@example.com', name: 'Dana', flight: row().flight, estimatedPrice: 300,
  });
  assert.deepEqual(Object.keys(payload).sort(), [
    'customer_name', 'departure_local', 'destination', 'estimated_price', 'flight_no', 'reference', 'to', 'type',
  ]);
});

test('the AI gets none of the new details (plan D11)', () => {
  const order = validateOrderBody(body(), NOW).value;
  const input = buildOrderDraftInput({ ...order, full_name: 'Dana Test' }, row().flight);
  const text = JSON.stringify(input);
  for (const key of ['traveller_names', 'escort_language', 'arrival_method']) assert.equal(key in input, false, key);
  assert.equal(text.includes('Maya'), false);
  assert.equal(text.includes('drop_off'), false);
});

test('007 migration: three defaulted parameters, the 17-parameter version dropped', () => {
  const sql = read('supabase/migrations/007_order_details.sql');
  for (const p of ['p_traveller_names text default null', 'p_escort_language text default null', 'p_arrival_method text default null']) {
    assert.ok(sql.includes(p), p);
  }
  assert.match(sql, /drop function if exists public\.insert_order_with_limits\(\s*uuid, uuid, text, text, text, integer, integer, jsonb, text, text, timestamptz, integer, integer,\s*date, text, integer, integer\s*\)/);
  assert.match(sql, /char_length\(traveller_names\) <= 300/);
});

test('n8n export: the two new rows only in the approval email', () => {
  const flow = JSON.parse(read('n8n/sereno-notifications.json'));
  const withRow = flow.nodes.filter((n) => JSON.stringify(n).includes('Escort language')).map((n) => n.name);
  assert.deepEqual(withRow, ['Set customer_approved']);
  const approved = JSON.stringify(flow.nodes.find((n) => n.name === 'Set customer_approved'));
  assert.ok(approved.includes('$json.body.arrival_method'));
  assert.equal(JSON.stringify(flow).includes('traveller_names'), false);
});
