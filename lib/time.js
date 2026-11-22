// Server-side time helpers in Israel time (Asia/Jerusalem): email webhook bodies and
// Israel calendar days for typed flight dates.
import { israelInputToIso } from '../public/js/time.js';

const TZ = 'Asia/Jerusalem';
const DAY_MS = 24 * 60 * 60 * 1000;

const format = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  day: 'numeric', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const dayKeyFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
});
// A plain calendar date is formatted in UTC, so the day never shifts.
const dateOnlyFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric',
});

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

// "27 Oct 2026, 14:30"
export function formatLocalIL(value) {
  const parts = Object.fromEntries(format.formatToParts(new Date(value)).map((p) => [p.type, p.value]));
  return `${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute}`;
}

// UTC midnight of a real "YYYY-MM-DD" calendar date, or null (e.g. "2026-02-31").
function dateKeyToUtc(dateStr) {
  const m = DATE_KEY_RE.exec(typeof dateStr === 'string' ? dateStr : '');
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const utc = Date.UTC(y, mo - 1, d);
  return new Date(utc).getUTCDate() === d ? utc : null;
}

// True for a real calendar date written as "YYYY-MM-DD".
export function isDateKey(dateStr) {
  return dateKeyToUtc(dateStr) !== null;
}

// "YYYY-MM-DD" of today in Israel (now is injectable for tests).
export function todayIL(now = new Date()) {
  return dayKeyFormat.format(now);
}

// A "YYYY-MM-DD" date moved by a number of calendar days.
export function addDays(dateStr, days) {
  const utc = dateKeyToUtc(dateStr);
  if (utc === null) return null;
  return new Date(utc + days * DAY_MS).toISOString().slice(0, 10);
}

// Start and end (exclusive) of an Israel calendar day, as ISO instants; null when not a real date.
export function israelDayRange(dateStr) {
  if (!isDateKey(dateStr)) return null;
  return {
    start: israelInputToIso(dateStr, '00:00'),
    end: israelInputToIso(addDays(dateStr, 1), '00:00'),
  };
}

// "12 Dec 2026" for a "YYYY-MM-DD" date, or null.
export function formatDateOnly(dateStr) {
  const utc = dateKeyToUtc(dateStr);
  if (utc === null) return null;
  const parts = Object.fromEntries(dateOnlyFormat.formatToParts(new Date(utc)).map((p) => [p.type, p.value]));
  return `${parts.day} ${parts.month} ${parts.year}`;
}
