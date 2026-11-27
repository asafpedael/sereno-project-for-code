// The boarding-pass card (Milestone 13, plan D10, D13), shared by the order form and the
// order lookup page (Milestone 14, plan D11). Text is set with textContent only (dom.js).
import { el } from './dom.js';
import { formatTimeIL, formatDateIL } from './time.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function planeIcon() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'pass__plane');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z');
  path.setAttribute('transform', 'rotate(90 12 12)');
  svg.append(path);
  return svg;
}

function passField(label, value) {
  return value ? el('span', { className: 'pass__field' },
    el('span', { className: 'pass__key' }, label), el('span', { className: 'pass__value' }, value)) : null;
}

// stub: [[label, value, big?], ...]; empty values are left out.
// tag (optional): a node shown at the end of the stub (the status tag on the lookup page).
export function boardingPass({ flight, typedNo = '', typedDate = '', stub, tag = null }) {
  const destination = flight ? flight.destination : '';
  const main = el('div', { className: 'pass__main' },
    el('span', { className: 'pass__key' }, 'Your flight'),
    el('div', { className: 'pass__route' },
      el('span', { className: 'pass__city' }, 'Tel Aviv'),
      el('span', { className: 'pass__line' }, planeIcon()),
      el('span', { className: `pass__city pass__city--to${destination ? '' : ' is-pending'}` },
        destination || 'To be confirmed')),
    el('div', { className: 'pass__fields' },
      passField('Flight', flight ? flight.flight_no : typedNo),
      passField('Date', flight ? formatDateIL(flight.departure_at) : typedDate),
      passField('Departs', flight ? formatTimeIL(flight.departure_at) : ''),
      passField('Airline', flight ? flight.airline || '' : '')));
  const stubNode = el('div', { className: 'pass__stub' },
    ...stub.filter(([, value]) => value).map(([label, value, big]) => el('span', { className: 'pass__field' },
      el('span', { className: 'pass__key' }, label),
      el('span', { className: big ? 'pass__big' : 'pass__value pass__value--gold' }, value))),
    tag);
  return el('div', { className: 'pass' }, main, stubNode);
}
