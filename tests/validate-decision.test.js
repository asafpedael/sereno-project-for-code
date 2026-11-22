// Tests for validateDecisionBody (lib/validate.js). Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDecisionBody } from '../lib/validate.js';

const ID = 'A1B2C3D4-0000-4000-8000-000000000001';

test('valid approve without a meeting time (server uses the recomputed one)', () => {
  assert.deepEqual(validateDecisionBody({ order_id: ID, action: 'approve' }).value,
    { order_id: ID.toLowerCase(), action: 'approve', final_time: null });
});

test('valid approve with a meeting time, Z or offset', () => {
  assert.equal(validateDecisionBody({ order_id: ID, action: 'approve', final_time: '2026-12-10T10:45:00.000Z' })
    .value.final_time.toISOString(), '2026-12-10T10:45:00.000Z');
  assert.equal(validateDecisionBody({ order_id: ID, action: 'approve', final_time: '2026-12-10T12:45+02:00' })
    .value.final_time.toISOString(), '2026-12-10T10:45:00.000Z');
});

test('valid reject', () => {
  assert.equal(validateDecisionBody({ order_id: ID, action: 'reject' }).value.action, 'reject');
});

test('bad body or order id', () => {
  assert.ok(validateDecisionBody(null).error);
  assert.ok(validateDecisionBody([]).error);
  assert.ok(validateDecisionBody({ order_id: 'abc', action: 'approve' }).error);
});

test('complete is accepted (M4)', () => {
  assert.deepEqual(validateDecisionBody({ order_id: ID, action: 'complete' }).value,
    { order_id: ID.toLowerCase(), action: 'complete', final_time: null });
});

test('meeting time is refused with complete', () => {
  assert.ok(validateDecisionBody({ order_id: ID, action: 'complete', final_time: '2026-12-10T10:45:00Z' }).error);
});

test('actions of later milestones do not exist yet', () => {
  for (const action of ['add_note', '', undefined, 1]) {
    assert.equal(validateDecisionBody({ order_id: ID, action }).error, 'Unknown action.');
  }
});

test('M5 actions are accepted', () => {
  for (const action of ['confirm_flight_missing', 'approve_flight_change', 'ignore_flight_change']) {
    assert.deepEqual(validateDecisionBody({ order_id: ID, action }).value,
      { order_id: ID.toLowerCase(), action, final_time: null }, action);
  }
});

test('meeting time: allowed with approve_flight_change, refused with the other M5 actions', () => {
  assert.equal(validateDecisionBody({ order_id: ID, action: 'approve_flight_change', final_time: '2026-12-10T11:45:00Z' })
    .value.final_time.toISOString(), '2026-12-10T11:45:00.000Z');
  for (const action of ['confirm_flight_missing', 'ignore_flight_change']) {
    assert.ok(validateDecisionBody({ order_id: ID, action, final_time: '2026-12-10T11:45:00Z' }).error, action);
  }
});

test('meeting time must have a zone and be a real date', () => {
  for (const final_time of ['2026-12-10T10:45', '2026-12-10', '10:45', '2026-13-40T10:45Z', 'x'.repeat(41), 12345]) {
    assert.equal(validateDecisionBody({ order_id: ID, action: 'approve', final_time }).error, 'Meeting time is not valid.');
  }
});

test('meeting time is refused with reject', () => {
  assert.ok(validateDecisionBody({ order_id: ID, action: 'reject', final_time: '2026-12-10T10:45:00Z' }).error);
});
