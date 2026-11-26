// Tests for the typed (manual) flight in the order form body (M5, plan D1). Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateOrderBody, validateManualFlight } from '../lib/validate.js';
import { israelDayRange, formatDateOnly, todayIL, addDays } from '../lib/time.js';

// 20 Nov 2026, 23:30 Israel time (21:30 UTC): "today" in Israel is 20 Nov.
const NOW = new Date('2026-11-20T21:30:00Z');
const FLIGHT_ID = '11111111-2222-4333-8444-555555555555';

function body(overrides = {}) {
  return {
    flight_id: null, flight_no: 'ly 315', flight_date: '2026-12-12',
    travelers: 2, bags: 1, services: [], escort_scope: 'full',
    full_name: 'Dana Test', phone: '050-1234567', email: 'dana@example.com', notes: '',
    approval_ack: true,
    ...overrides,
  };
}

test('typed flight is normalized: upper case, spaces and "-" removed', () => {
  const r = validateOrderBody(body({ flight_no: ' ly-31 5 ' }), NOW);
  assert.equal(r.error, undefined);
  assert.equal(r.value.flight_id, null);
  assert.equal(r.value.flight_no, 'LY315');
  assert.equal(r.value.flight_date, '2026-12-12');
});

test('flight from the list: flight_no and flight_date are not kept', () => {
  const r = validateOrderBody(body({ flight_id: FLIGHT_ID.toUpperCase(), flight_no: 'DM101', flight_date: null }), NOW);
  assert.equal(r.error, undefined);
  assert.equal(r.value.flight_id, FLIGHT_ID);
  assert.equal(r.value.flight_no, null);
  assert.equal(r.value.flight_date, null);
});

test('both a list flight and a typed date -> error', () => {
  const r = validateOrderBody(body({ flight_id: FLIGHT_ID }), NOW);
  assert.match(r.error, /not both/);
});

test('neither a list flight nor a typed flight -> error', () => {
  const r = validateOrderBody(body({ flight_no: '', flight_date: null }), NOW);
  assert.equal(r.error, 'Please select your flight from the list.');
});

test('missing number or date', () => {
  assert.equal(validateManualFlight('', '2026-12-12', NOW).error, 'Please enter your flight number.');
  assert.equal(validateManualFlight('   ', '2026-12-12', NOW).error, 'Please enter your flight number.');
  assert.equal(validateManualFlight('LY315', '', NOW).error, 'Please choose your departure date.');
  assert.equal(validateManualFlight('LY315', null, NOW).error, 'Please choose your departure date.');
});

test('bad characters and lengths in the flight number', () => {
  const bad = 'Enter a flight number with letters and digits only.';
  for (const value of ['LY<315>', 'LY315; drop', 'LY.315', 'L', '1234567890A', 'A'.repeat(21), 'LY315\n', 42]) {
    assert.equal(validateManualFlight(value, '2026-12-12', NOW).error, bad, String(value));
  }
  assert.equal(validateManualFlight('ab', '2026-12-12', NOW).value.flight_no, 'AB');
  assert.equal(validateManualFlight('1234567890', '2026-12-12', NOW).value.flight_no, '1234567890');
});

test('date: not a real date, in the past, or more than 365 days ahead', () => {
  assert.equal(validateManualFlight('LY315', '2026-02-31', NOW).error, 'Please choose your departure date.');
  assert.equal(validateManualFlight('LY315', '12/12/2026', NOW).error, 'Please choose your departure date.');
  assert.equal(validateManualFlight('LY315', '2026-11-19', NOW).error, 'Choose a date from today on.');
  assert.equal(validateManualFlight('LY315', '2027-11-21', NOW).error, 'Choose a date within the next 12 months.');
});

test('date: today (Israel day, not UTC) and exactly 365 days ahead are accepted', () => {
  assert.equal(validateManualFlight('LY315', '2026-11-20', NOW).error, undefined);
  assert.equal(validateManualFlight('LY315', '2027-11-20', NOW).error, undefined);
  // 23:30 UTC on 20 Nov is already 21 Nov in Israel, so 20 Nov is in the past.
  assert.equal(validateManualFlight('LY315', '2026-11-20', new Date('2026-11-20T23:30:00Z')).error,
    'Choose a date from today on.');
});

test('Israel day range: winter (UTC+2) and summer (UTC+3)', () => {
  assert.deepEqual(israelDayRange('2026-12-12'), {
    start: '2026-12-11T22:00:00.000Z', end: '2026-12-12T22:00:00.000Z',
  });
  assert.deepEqual(israelDayRange('2026-07-15'), {
    start: '2026-07-14T21:00:00.000Z', end: '2026-07-15T21:00:00.000Z',
  });
  assert.equal(israelDayRange('2026-02-30'), null);
});

test('date helpers', () => {
  assert.equal(formatDateOnly('2026-12-12'), '12 Dec 2026');
  assert.equal(formatDateOnly(null), null);
  assert.equal(todayIL(NOW), '2026-11-20');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});
