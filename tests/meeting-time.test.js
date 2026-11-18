// Tests for the meeting-time formula (public/js/meeting-time.js). Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { meetingTime } from '../public/js/meeting-time.js';

const TZ = 'Asia/Jerusalem';
const MINUTE_MS = 60 * 1000;

// Offset of Israel time from UTC (in minutes) at a given instant.
function israelOffsetMinutes(date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TZ, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).formatToParts(date).map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return Math.round((asUtc - date.getTime()) / MINUTE_MS);
}

// Israel local date (YYYY-MM-DD) + day offset, at local time HH:MM -> Date.
function il(baseDate, dayOffset, hhmm) {
  const [y, m, d] = baseDate.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  const naiveUtc = Date.UTC(y, m - 1, d + dayOffset, hh, mm);
  let result = new Date(naiveUtc - israelOffsetMinutes(new Date(naiveUtc)) * MINUTE_MS);
  // Second pass in case the first guess crossed a daylight-saving change.
  result = new Date(naiveUtc - israelOffsetMinutes(result) * MINUTE_MS);
  return result;
}

function minutesBefore(departure, meeting) {
  return (departure.getTime() - meeting.getTime()) / MINUTE_MS;
}

// Product examples (PRD section 3, MILESTONES M2 Definition of Done)
test('2 travellers, 3 bags, departure 14:30 -> 12:45', () => {
  assert.deepEqual(meetingTime(il('2026-12-10', 0, '14:30'), 2, 3), il('2026-12-10', 0, '12:45'));
});

test('1 traveller, 0 bags -> exactly 90 minutes before', () => {
  const dep = il('2026-12-10', 0, '19:45');
  assert.equal(minutesBefore(dep, meetingTime(dep, 1, 0)), 90);
});

test('10 travellers, 10 bags -> exactly 165 minutes before', () => {
  const dep = il('2026-12-10', 0, '16:10');
  assert.equal(minutesBefore(dep, meetingTime(dep, 10, 10)), 165);
});

test('meeting crosses midnight: departure 01:10, 1 traveller, 0 bags -> 23:40 the day before', () => {
  assert.deepEqual(meetingTime(il('2026-12-12', 0, '01:10'), 1, 0), il('2026-12-11', 0, '23:40'));
});

test('rounding is always down to a multiple of 5 minutes', () => {
  // 2 travellers, 3 bags = 104 minutes; 14:30 - 104 = 12:46 -> 12:45
  assert.deepEqual(meetingTime(il('2026-12-10', 0, '14:30'), 2, 3), il('2026-12-10', 0, '12:45'));
  // 1 traveller, 0 bags at 14:33 -> 13:03 -> 13:00 (never later than the formula)
  assert.deepEqual(meetingTime(il('2026-12-10', 0, '14:33'), 1, 0), il('2026-12-10', 0, '13:00'));
  // Already on a multiple of 5: no change
  assert.deepEqual(meetingTime(il('2026-12-10', 0, '14:30'), 1, 0), il('2026-12-10', 0, '13:00'));
});

test('every result is a multiple of 5 minutes and never less than the formula lead time', () => {
  const dep = il('2026-12-10', 0, '14:37');
  for (let travelers = 1; travelers <= 10; travelers++) {
    for (let bags = 0; bags <= 10; bags++) {
      const result = meetingTime(dep, travelers, bags);
      const lead = 90 + 5 * (travelers - 1) + 3 * bags;
      const before = minutesBefore(dep, result);
      assert.equal(result.getUTCMinutes() % 5, 0);
      assert.ok(before >= lead && before < lead + 5, `${travelers}/${bags}: ${before} vs ${lead}`);
    }
  }
});

test('escort scope is not an input: the function only takes departure, travellers and bags', () => {
  assert.equal(meetingTime.length, 3);
  const dep = il('2026-12-10', 0, '14:30');
  assert.deepEqual(meetingTime(dep, 2, 3, 'full'), meetingTime(dep, 2, 3, 'partial'));
});

test('returns a Date and does not change the departure Date', () => {
  const dep = il('2026-12-10', 0, '14:30');
  const before = dep.getTime();
  const result = meetingTime(dep, 2, 3);
  assert.ok(result instanceof Date);
  assert.equal(dep.getTime(), before);
});

// Seed match: the 14 orders with a flight in supabase/seed/seed.sql.
// [order, travelers, bags, departure day offset, departure time, meeting day offset, meeting time]
const SEED_CASES = [
  [1, 2, 3, 0, '14:30', 0, '12:45'],
  [2, 2, 3, 0, '14:30', 0, '12:45'],
  [3, 5, 8, 0, '18:45', 0, '16:30'],
  [4, 2, 3, 1, '21:20', 1, '19:35'],
  [5, 2, 1, -7, '18:45', -7, '17:05'],
  [7, 1, 1, 2, '21:20', 2, '19:45'],
  [8, 5, 4, 0, '18:45', 0, '16:40'],
  [9, 3, 2, 1, '11:00', 1, '09:10'],
  [10, 2, 2, -9, '14:30', -9, '12:45'],
  [11, 1, 0, 2, '01:10', 1, '23:40'],
  [12, 10, 10, 0, '16:10', 0, '13:25'],
  [13, 1, 0, 0, '19:45', 0, '18:15'],
  [14, 2, 3, 0, '14:30', 0, '12:45'],
  [15, 1, 2, -9, '14:30', -9, '12:50'],
];

// A winter and a summer "today", so both Israel standard time and daylight time are covered.
for (const today of ['2026-12-10', '2026-07-15']) {
  test(`matches recommended_time of every seed order (today = ${today})`, () => {
    for (const [order, travelers, bags, depDay, depTime, meetDay, meetTime] of SEED_CASES) {
      const result = meetingTime(il(today, depDay, depTime), travelers, bags);
      assert.deepEqual(result, il(today, meetDay, meetTime), `seed order ${order}`);
    }
  });
}
