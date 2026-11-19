// Date and time display in Israel time (Asia/Jerusalem), whatever the browser's own time zone.

const TZ = 'Asia/Jerusalem';

const timeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const dateFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short',
});
const dayKeyFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
});

function toDate(value) {
  return value instanceof Date ? value : new Date(value);
}

// "14:30"
export function formatTimeIL(value) {
  return timeFormat.format(toDate(value));
}

// "Thu 10 Dec"
export function formatDateIL(value) {
  const parts = Object.fromEntries(dateFormat.formatToParts(toDate(value)).map((p) => [p.type, p.value]));
  return `${parts.weekday} ${parts.day} ${parts.month}`;
}

// "Thu 10 Dec · 14:30"
export function formatDateTimeIL(value) {
  return `${formatDateIL(value)} · ${formatTimeIL(value)}`;
}

// True when both instants fall on the same calendar day in Israel.
export function isSameDayIL(a, b) {
  return dayKeyFormat.format(toDate(a)) === dayKeyFormat.format(toDate(b));
}

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

// "YYYY-MM-DD" of the Israel calendar day of an instant.
function dayKeyIL(value) {
  return dayKeyFormat.format(toDate(value));
}

// "Today 14:30", "Tomorrow 21:20", or "Thu 10 Dec 14:30" (Israel days; now is injectable for tests).
export function formatDayTimeIL(value, now = new Date()) {
  const key = dayKeyIL(value);
  const today = dayKeyIL(now);
  const tomorrow = dayKeyIL(new Date(toDate(now).getTime() + DAY_MS));
  let day;
  if (key === today) day = 'Today';
  else if (key === tomorrow) day = 'Tomorrow';
  else day = formatDateIL(value);
  return `${day} ${formatTimeIL(value)}`;
}

// Israel wall-clock date and time of an instant, as values for <input type="date"> / <input type="time">.
export function toIsraelInputs(value) {
  return { date: dayKeyIL(value), time: formatTimeIL(value) };
}

// Offset of Israel time from UTC, in minutes, at a given instant.
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

// Israel wall-clock date ("YYYY-MM-DD") and time ("HH:MM") -> ISO instant, or null when not valid.
export function israelInputToIso(dateStr, timeStr) {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || '');
  const t = /^(\d{2}):(\d{2})$/.exec(timeStr || '');
  if (!d || !t) return null;
  const [y, m, day, hh, mm] = [+d[1], +d[2], +d[3], +t[1], +t[2]];
  if (m < 1 || m > 12 || day < 1 || day > 31 || hh > 23 || mm > 59) return null;
  const naiveUtc = Date.UTC(y, m - 1, day, hh, mm);
  if (new Date(naiveUtc).getUTCDate() !== day) return null; // e.g. 31 Feb
  let result = new Date(naiveUtc - israelOffsetMinutes(new Date(naiveUtc)) * MINUTE_MS);
  // Second pass in case the first guess crossed a daylight-saving change.
  result = new Date(naiveUtc - israelOffsetMinutes(result) * MINUTE_MS);
  return result.toISOString();
}
