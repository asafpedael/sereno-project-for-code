// Server-side time formatting in Israel time (Asia/Jerusalem) for email webhook bodies.

const format = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jerusalem',
  day: 'numeric', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

// "27 Oct 2026, 14:30"
export function formatLocalIL(value) {
  const parts = Object.fromEntries(format.formatToParts(new Date(value)).map((p) => [p.type, p.value]));
  return `${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute}`;
}
