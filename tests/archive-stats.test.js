// Archive statistics (M8, plan D2-D5): the summary cards per role.
// Approvals "Status" menu (M8, plan D14): which inbox orders each option keeps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { archiveStats, completedByCustomer } from '../lib/orders-view.js';
import { filterInbox } from '../public/js/inbox-filter.js';

test('inbox filter keeps the right orders for each option', () => {
  const inbox = [
    { id: 'p1', status: 'pending', flight_change_pending: false },
    { id: 'p2', status: 'pending', flight_change_pending: false },
    { id: 'n1', status: 'needs_clarification', flight_change_pending: false },
    { id: 'f1', status: 'approved', flight_change_pending: true },
  ];
  const ids = (filter) => filterInbox(inbox, filter).map((o) => o.id);
  assert.deepEqual(ids(''), ['p1', 'p2', 'n1', 'f1']);
  assert.deepEqual(ids('pending'), ['p1', 'p2']);
  assert.deepEqual(ids('needs_clarification'), ['n1']);
  assert.deepEqual(ids('flight_change'), ['f1']);
  assert.deepEqual(ids('approved'), ['p1', 'p2', 'n1', 'f1']); // unknown value: everything
  assert.deepEqual(filterInbox([], 'pending'), []);
});

const rows = [
  { id: 'o1', status: 'pending', customer_id: 'c1' },
  { id: 'o2', status: 'completed', customer_id: 'c1' },
  { id: 'o3', status: 'approved', customer_id: 'c1' },
  { id: 'o4', status: 'rejected', customer_id: 'c2' },
  { id: 'o5', status: 'completed', customer_id: 'c3' }, // c3's only order: not returning
  { id: 'o6', status: 'needs_clarification', customer_id: 'c4' },
];
// The completed orders of these customers (the archive reads them for all matching customers).
const completed = completedByCustomer([
  { id: 'o2', customer_id: 'c1' },
  { id: 'o5', customer_id: 'c3' },
  { id: 'x9', customer_id: 'c4' }, // an order outside the filter still makes c4 returning
]);

test('manager cards: approved counts approved and completed, returning counts customers', () => {
  assert.deepEqual(archiveStats(rows, completed, 'manager'), {
    total: 6, approved: 3, returning_customers: 2, rejected: 1,
  });
});

test('a customer with several returning orders counts once', () => {
  const two = rows.filter((r) => r.customer_id === 'c1');
  assert.equal(archiveStats(two, completed, 'manager').returning_customers, 1);
});

test('a customer whose only order is the completed one is not returning', () => {
  const only = rows.filter((r) => r.customer_id === 'c3');
  assert.equal(archiveStats(only, completed, 'manager').returning_customers, 0);
});

test('a status filter that leaves only rejected orders', () => {
  const rejected = rows.filter((r) => r.status === 'rejected');
  assert.deepEqual(archiveStats(rejected, completed, 'manager'), {
    total: 1, approved: 0, returning_customers: 0, rejected: 1,
  });
});

test('empty list gives zeros', () => {
  assert.deepEqual(archiveStats([], new Map(), 'manager'), {
    total: 0, approved: 0, returning_customers: 0, rejected: 0,
  });
  assert.deepEqual(archiveStats([], null, 'agent'), { total: 0, approved: 0, completed: 0 });
});

test('agent cards: total, approved and completed only, never returning', () => {
  const agentRows = rows.filter((r) => ['approved', 'completed'].includes(r.status));
  const stats = archiveStats(agentRows, completed, 'agent');
  assert.deepEqual(stats, { total: 3, approved: 1, completed: 2 });
  assert.equal('returning_customers' in stats, false);
  assert.equal('rejected' in stats, false);
});
