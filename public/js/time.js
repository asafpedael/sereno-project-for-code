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
