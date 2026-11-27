// Tests for the estimated price (Milestone 13). Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PRICES, estimatePrice, formatPrice, formatAmount } from '../public/js/price.js';
import { toManagerView, toAgentView } from '../lib/orders-view.js';
import { approvedEmailPayload, receivedEmailPayload, flightChangeEmailPayload } from '../lib/notify.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function order(overrides = {}) {
  return { travelers: 1, bags: 0, services: [], wheelchairs: null, escort_scope: 'full', ...overrides };
}

test("Asaf's price list (27.11.2026)", () => {
  assert.deepEqual({ ...PRICES }, {
    currency: 'USD', full: 300, partial: 200, extra_traveller: 40, extra_bag: 5, porter: 30, wheelchair: 0,
  });
});

test('one traveller, no bags: the escort price only', () => {
  assert.equal(estimatePrice(order()).total, 300);
  assert.equal(estimatePrice(order({ escort_scope: 'partial' })).total, 200);
});

test('2 travellers, 3 bags, porter, full = $375', () => {
  const price = estimatePrice(order({ travelers: 2, bags: 3, services: ['porter'] }));
  assert.equal(price.total, 375);
  assert.deepEqual(price.lines, [
    { label: 'Full escort', amount: 300 },
    { label: '1 more traveller', amount: 40 },
    { label: '1 extra bag', amount: 5 },
    { label: 'Porter / luggage help', amount: 30 },
  ]);
});

test('10 travellers, 10 bags, partial = $560 (bags within one per traveller are free)', () => {
  const price = estimatePrice(order({ travelers: 10, bags: 10, escort_scope: 'partial' }));
  assert.equal(price.total, 560);
  assert.equal(price.lines.length, 2);
  assert.equal(price.lines[1].label, '9 more travellers');
});

test('extra bags are counted beyond one per traveller', () => {
  assert.equal(estimatePrice(order({ travelers: 2, bags: 2 })).total, 340);
  const price = estimatePrice(order({ travelers: 1, bags: 4 }));
  assert.equal(price.total, 315);
  assert.equal(price.lines[1].label, '3 extra bags');
});

test('porter is once per order; wheelchairs are free in any number', () => {
  assert.equal(estimatePrice(order({ travelers: 3, bags: 9, services: ['porter'] })).total, 300 + 80 + 30 + 30);
  const price = estimatePrice(order({ travelers: 3, services: ['wheelchair'], wheelchairs: 3 }));
  assert.equal(price.total, 380);
  assert.deepEqual(price.lines.at(-1), { label: 'Wheelchair × 3', amount: 0 });
  assert.equal(estimatePrice(order({ services: ['wheelchair'] })).lines.at(-1).label, 'Wheelchair');
});

test('the lines always add up to the total', () => {
  for (const scope of ['full', 'partial']) {
    for (let travelers = 1; travelers <= 10; travelers += 1) {
      for (let bags = 0; bags <= 10; bags += 1) {
        const price = estimatePrice(order({ travelers, bags, escort_scope: scope, services: ['porter', 'wheelchair'] }));
        assert.equal(price.lines.reduce((sum, l) => sum + l.amount, 0), price.total);
      }
    }
  }
});

test('no escort or counts out of range give no price', () => {
  assert.equal(estimatePrice(order({ escort_scope: null })), null);
  assert.equal(estimatePrice(order({ escort_scope: 'gold' })), null);
  assert.equal(estimatePrice(order({ escort_scope: '__proto__' })), null);
  assert.equal(estimatePrice(order({ travelers: 0 })), null);
  assert.equal(estimatePrice(order({ travelers: 11 })), null);
  assert.equal(estimatePrice(order({ bags: -1 })), null);
  assert.equal(estimatePrice(order({ bags: 1.5 })), null);
});

test('formatting: dollars with grouping, "Free" for 0 beside a choice', () => {
  assert.equal(formatPrice(375), '$375');
  assert.equal(formatPrice(1200), '$1,200');
  assert.equal(formatAmount(0), 'Free');
  assert.equal(formatAmount(30), '$30');
});

function row(overrides = {}) {
  return {
    id: 'a1b2c3d4-0000-4000-8000-000000000001', status: 'approved',
    contact_name: 'Daniel A.', contact_phone: '050-1110001', customer: { email: 'daniel@example.com' },
    flight: { flight_no: 'DM101', destination: 'London', departure_at: '2026-12-10T12:30:00+00:00' },
    flight_no_submitted: 'DM101', travelers: 2, bags: 3, services: ['porter'], escort_scope: 'full',
    final_time: '2026-12-10T10:45:00+00:00', estimated_price: 375,
    ...overrides,
  };
}

test('the manager view carries the price; the field agent view does not', () => {
  assert.equal(toManagerView(row()).estimated_price, 375);
  assert.equal(toManagerView(row({ estimated_price: null })).estimated_price, null);
  assert.equal(toManagerView(row({ estimated_price: undefined })).estimated_price, null);
  assert.ok(!('estimated_price' in toAgentView(row())));
});

test('the received and approval emails carry "$375", or null for an older order', () => {
  assert.equal(approvedEmailPayload(row()).estimated_price, '$375');
  assert.equal(approvedEmailPayload(row({ estimated_price: null })).estimated_price, null);
  const received = receivedEmailPayload({
    reference: 'A1B2C3D4', email: 'd@example.com', name: 'Dana', flight: row().flight, estimatedPrice: 375,
  });
  assert.equal(received.estimated_price, '$375');
  assert.equal(receivedEmailPayload({ reference: 'A', email: 'd@example.com', name: 'D', flight: null,
    typedFlightNo: 'LY315', typedDate: '2026-12-12' }).estimated_price, null);
  // The flight-change event reuses the approval payload (its template does not show the price).
  assert.equal(flightChangeEmailPayload(row(), null).estimated_price, '$375');
});

test('"Order number" replaces "Reference" on the received screen, the archive and every email', () => {
  const order = read('public/order.html');
  assert.ok(order.includes('Order number'));
  assert.ok(!/>\s*Reference\s*</.test(order));
  const archive = read('public/staff/archive.html');
  assert.ok(archive.includes('>Order number<'));
  assert.ok(!archive.includes('>Reference<'));
  const n8n = read('n8n/sereno-notifications.json');
  assert.ok(!n8n.includes('label: \\"Reference\\"'));
  assert.equal(n8n.split('label: \\"Order number\\"').length - 1, 6);
  assert.equal(n8n.split('label: \\"Estimated price\\"').length - 1, 2);
});

test('the page shows no shekel prices and none of the mock-up example prices', () => {
  const page = read('public/order.html') + read('public/js/order-form.js');
  assert.ok(!page.includes('₪'));
  for (const sample of ['450', '+100', '$80', '$120']) assert.ok(!page.includes(sample), sample);
});

test('the migration keeps the old call working (the new parameter has a default)', () => {
  const sql = read('supabase/migrations/005_estimated_price.sql');
  assert.match(sql, /p_estimated_price integer default null/);
  assert.match(sql, /add column if not exists estimated_price integer/);
});
