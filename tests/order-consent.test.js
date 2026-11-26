// Tests for the booking consent in the order form body (Milestone 10, FR-44). Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateOrderBody } from '../lib/validate.js';

const NOW = new Date('2026-11-20T21:30:00Z');
const FLIGHT_ID = '11111111-2222-4333-8444-555555555555';
const ACK_ERROR = 'Please confirm that your booking is subject to manager approval.';

function body(overrides = {}) {
  return {
    flight_id: FLIGHT_ID, flight_no: 'DM101', flight_date: null,
    travelers: 2, bags: 1, services: ['porter'], escort_scope: 'full',
    full_name: 'Dana Test', phone: '050-1234567', email: 'dana@example.com', notes: '',
    approval_ack: true,
    ...overrides,
  };
}

test('consent true: accepted, and not part of the stored value', () => {
  const r = validateOrderBody(body(), NOW);
  assert.equal(r.error, undefined);
  assert.equal('approval_ack' in r.value, false);
});

test('consent missing or not exactly true: refused', () => {
  const missing = body();
  delete missing.approval_ack;
  assert.equal(validateOrderBody(missing, NOW).error, ACK_ERROR);
  for (const value of [false, 'true', 1, null, 'yes', {}]) {
    assert.equal(validateOrderBody(body({ approval_ack: value }), NOW).error, ACK_ERROR, String(value));
  }
});

test('another wrong field is reported before the missing consent', () => {
  const r = validateOrderBody(body({ email: 'not-an-email', approval_ack: false }), NOW);
  assert.equal(r.error, 'Please enter a valid email address.');
});
