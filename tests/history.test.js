// Tests for returning customer, customer history and the recommended-services filter
// (lib/orders-view.js, M6 plan D5-D7). Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  completedByCustomer, isReturningCustomer, toHistoryItem, toManagerView, toAgentView, pickAi,
} from '../lib/orders-view.js';

const DANIEL = 'c1';
const RONEN = 'c4';

function order(over = {}) {
  return {
    id: 'a1b2c3d4-0000-4000-8000-000000000001',
    customer_id: DANIEL,
    status: 'pending',
    contact_name: 'Daniel A.',
    contact_phone: '050-1110001',
    customer: { email: 'daniel.a@example.com' },
    flight: { flight_no: 'DM101', destination: 'London', departure_at: '2026-12-10T12:30:00Z' },
    flight_no_submitted: 'DM101',
    flight_date_submitted: null,
    travelers: 2,
    bags: 3,
    services: ['porter'],
    escort_scope: 'full',
    manager_notes: null,
    ai_output: null,
    ...over,
  };
}

test('a customer with another completed order is returning', () => {
  const map = completedByCustomer([{ id: 'other-completed', customer_id: DANIEL }]);
  assert.equal(isReturningCustomer(order(), map), true);
});

test('the order itself being completed does not make the customer returning', () => {
  const map = completedByCustomer([{ id: order().id, customer_id: DANIEL }]);
  assert.equal(isReturningCustomer(order({ status: 'completed' }), map), false);
});

test('only pending / approved / rejected other orders: not returning (no completed rows)', () => {
  assert.equal(isReturningCustomer(order({ customer_id: RONEN }), completedByCustomer([])), false);
});

test("another customer's completed order does not count", () => {
  const map = completedByCustomer([{ id: 'x', customer_id: RONEN }]);
  assert.equal(isReturningCustomer(order(), map), false);
});

test('manager view carries is_returning_customer (default false)', () => {
  assert.equal(toManagerView(order()).is_returning_customer, false);
  assert.equal(toManagerView(order(), { returning: true }).is_returning_customer, true);
  assert.ok(!('previous_orders' in toManagerView(order())), 'lists have no history');
});

test('previous orders: at most 5, the current order left out, typed flight shown', () => {
  const rows = [
    { id: order().id, status: 'pending', flight: order().flight },
    ...Array.from({ length: 6 }, (_, i) => ({
      id: `0000000${i}-0000-4000-8000-000000000000`, status: 'completed', flight_no_submitted: 'DM101',
      flight_date_submitted: null, flight: { flight_no: 'DM101', destination: 'London', departure_at: '2026-12-01T12:30:00Z' },
    })),
  ];
  const view = toManagerView(order(), { returning: true, previousOrders: rows });
  assert.equal(view.previous_orders.length, 5);
  assert.ok(view.previous_orders.every((o) => o.reference !== 'A1B2C3D4'));
  assert.deepEqual(toHistoryItem({
    id: '00000006-0000-4000-8000-000000000006', status: 'needs_clarification', flight: null,
    flight_no_submitted: 'DM999', flight_date_submitted: '2026-12-12',
  }), {
    reference: '00000006', status: 'needs_clarification', flight_no: 'DM999', destination: null,
    departure_at: null, flight_date_submitted: '2026-12-12',
  });
});

test('history items carry no notes, email or phone', () => {
  const item = toHistoryItem({ id: 'x0000000', status: 'completed', manager_notes: 'secret', contact_phone: '050', flight: null });
  assert.deepEqual(Object.keys(item).sort(),
    ['departure_at', 'destination', 'flight_date_submitted', 'flight_no', 'reference', 'status']);
});

test('the agent view never has returning or history fields', () => {
  const view = toAgentView(order({ status: 'approved' }));
  for (const key of ['is_returning_customer', 'previous_orders', 'ai_output']) assert.ok(!(key in view), key);
});

test('recommended services: foreign values and duplicates removed on read', () => {
  const ai = { status: 'ok', customer_paragraph: 'Hi', recommended_services: ['porter', 'lounge', 'porter', 'wheelchair', 'chauffeur'] };
  assert.deepEqual(pickAi(ai).recommended_services, ['porter', 'wheelchair']);
  assert.deepEqual(pickAi({ status: 'ok', customer_paragraph: 'Hi', recommended_services: 'porter' }).recommended_services, []);
});
