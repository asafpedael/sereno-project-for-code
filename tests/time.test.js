// Tests for public/js/time.js (Israel time helpers). Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { israelInputToIso, toIsraelInputs, formatDayTimeIL, formatTimeIL } from '../public/js/time.js';

test('Israel wall-clock time to ISO: winter (UTC+2) and summer (UTC+3)', () => {
  assert.equal(israelInputToIso('2026-12-10', '12:45'), '2026-12-10T10:45:00.000Z');
  assert.equal(israelInputToIso('2026-07-15', '12:45'), '2026-07-15T09:45:00.000Z');
});

test('meeting before midnight stays on the previous day', () => {
  assert.equal(israelInputToIso('2026-12-11', '23:40'), '2026-12-11T21:40:00.000Z');
  assert.equal(israelInputToIso('2026-12-12', '00:10'), '2026-12-11T22:10:00.000Z');
});

test('round trip: ISO -> inputs -> ISO', () => {
  for (const iso of ['2026-12-11T21:40:00.000Z', '2026-07-15T09:45:00.000Z', '2026-03-27T23:30:00.000Z']) {
    const { date, time } = toIsraelInputs(iso);
    assert.equal(israelInputToIso(date, time), iso);
  }
});

test('inputs use the Israel calendar day, not UTC', () => {
  assert.deepEqual(toIsraelInputs('2026-12-11T22:10:00Z'), { date: '2026-12-12', time: '00:10' });
});

test('invalid inputs give null', () => {
  assert.equal(israelInputToIso('', '12:00'), null);
  assert.equal(israelInputToIso('2026-12-10', ''), null);
  assert.equal(israelInputToIso('2026-02-31', '12:00'), null);
  assert.equal(israelInputToIso('2026-12-10', '24:00'), null);
  assert.equal(israelInputToIso('10/12/2026', '12:00'), null);
});

test('day labels: Today, Tomorrow, then the date (Israel days)', () => {
  const now = new Date('2026-12-10T08:00:00Z'); // 10:00 in Israel
  assert.equal(formatDayTimeIL('2026-12-10T12:30:00Z', now), 'Today 14:30');
  assert.equal(formatDayTimeIL('2026-12-11T19:20:00Z', now), 'Tomorrow 21:20');
  assert.equal(formatDayTimeIL('2026-12-12T09:00:00Z', now), 'Sat 12 Dec 11:00');
  // 23:30 UTC on the 10th is already the 11th in Israel.
  assert.equal(formatDayTimeIL('2026-12-10T23:30:00Z', now), 'Tomorrow 01:30');
});

test('email format (lib/time.js): "27 Oct 2026, 14:30" in Israel time', async () => {
  const { formatLocalIL } = await import('../lib/time.js');
  assert.equal(formatLocalIL('2026-10-27T12:30:00Z'), '27 Oct 2026, 14:30');
  assert.equal(formatLocalIL('2026-12-11T22:10:00Z'), '12 Dec 2026, 00:10');
});

test('times are shown in 24-hour Israel time', () => {
  assert.equal(formatTimeIL('2026-12-10T19:05:00Z'), '21:05');
});
