// Tests for validateDecisionBody (lib/validate.js). Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDecisionBody } from '../lib/validate.js';

const ID = 'A1B2C3D4-0000-4000-8000-000000000001';

test('valid approve without a meeting time (server uses the recomputed one)', () => {
  assert.deepEqual(validateDecisionBody({ order_id: ID, action: 'approve' }).value,
    { order_id: ID.toLowerCase(), action: 'approve', final_time: null, manager_notes: null, agent_id: null });
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
    { order_id: ID.toLowerCase(), action: 'complete', final_time: null, manager_notes: null, agent_id: null });
});

test('meeting time is refused with complete', () => {
  assert.ok(validateDecisionBody({ order_id: ID, action: 'complete', final_time: '2026-12-10T10:45:00Z' }).error);
});

test('unknown actions are refused', () => {
  for (const action of ['archive', '', undefined, 1]) {
    assert.equal(validateDecisionBody({ order_id: ID, action }).error, 'Unknown action.');
  }
});

test('M5 actions are accepted', () => {
  for (const action of ['confirm_flight_missing', 'approve_flight_change', 'ignore_flight_change']) {
    assert.deepEqual(validateDecisionBody({ order_id: ID, action }).value,
      { order_id: ID.toLowerCase(), action, final_time: null, manager_notes: null, agent_id: null }, action);
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

// ---------- M6: manager notes (plan D12) ----------

test('add_note is accepted with a note, trimmed', () => {
  assert.deepEqual(validateDecisionBody({ order_id: ID, action: 'add_note', manager_notes: '  Extra margin needed \n' }).value,
    { order_id: ID.toLowerCase(), action: 'add_note', final_time: null, manager_notes: 'Extra margin needed', agent_id: null });
});

test('add_note with an empty note clears it; without the field it is refused', () => {
  assert.equal(validateDecisionBody({ order_id: ID, action: 'add_note', manager_notes: '   ' }).value.manager_notes, null);
  assert.equal(validateDecisionBody({ order_id: ID, action: 'add_note' }).error, 'Manager notes are required.');
  assert.equal(validateDecisionBody({ order_id: ID, action: 'add_note', manager_notes: null }).error, 'Manager notes are required.');
});

test('manager notes are allowed with approve and reject', () => {
  assert.equal(validateDecisionBody({ order_id: ID, action: 'approve', manager_notes: 'Large family' }).value.manager_notes, 'Large family');
  assert.equal(validateDecisionBody({ order_id: ID, action: 'reject', manager_notes: 'Duplicate' }).value.manager_notes, 'Duplicate');
  assert.equal(validateDecisionBody({ order_id: ID, action: 'approve', manager_notes: '' }).value.manager_notes, null);
});

test('manager notes are refused with the other actions', () => {
  for (const action of ['complete', 'confirm_flight_missing', 'approve_flight_change', 'ignore_flight_change']) {
    assert.equal(validateDecisionBody({ order_id: ID, action, manager_notes: 'x' }).error,
      'Manager notes can only be saved with approve, reject or add_note.', action);
  }
});

test('manager notes: new lines allowed, other control characters and non-strings refused', () => {
  assert.equal(validateDecisionBody({ order_id: ID, action: 'add_note', manager_notes: 'Line 1\nLine 2' }).value.manager_notes, 'Line 1\nLine 2');
  assert.equal(validateDecisionBody({ order_id: ID, action: 'add_note', manager_notes: 'bad\u0007bell' }).error, 'Manager notes are not valid.');
  assert.equal(validateDecisionBody({ order_id: ID, action: 'add_note', manager_notes: 42 }).error, 'Manager notes are not valid.');
});

test('manager notes: up to 500 characters', () => {
  assert.equal(validateDecisionBody({ order_id: ID, action: 'add_note', manager_notes: 'a'.repeat(500) }).value.manager_notes.length, 500);
  assert.equal(validateDecisionBody({ order_id: ID, action: 'add_note', manager_notes: 'a'.repeat(501) }).error,
    'Manager notes must be 500 characters or fewer.');
});
