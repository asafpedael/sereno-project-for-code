// Field agent screen (phone first): approved orders as cards, soonest meeting first.
// "Mark completed" asks for confirmation inside the card (DESIGN screen 4).
// All data text is set with textContent (dom.js). Times are shown in Israel time (time.js).
import { getJson } from './api.js';
import { el, clear } from './dom.js';
import { formatTimeIL, formatDateIL, isSameDayIL } from './time.js';
import { requireRole, bindLogout, staffGet, staffPost } from './session.js';

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

const session = requireRole('agent');

const listNode = document.getElementById('order-list');
const listError = document.getElementById('list-error');
const listEmpty = document.getElementById('list-empty');
const listLoading = document.getElementById('list-loading');
const refreshButton = document.getElementById('refresh');
const statusLine = document.getElementById('status-line');

let labels = { services: {}, escort_scopes: {} };
let orders = [];

function labelMap(list) {
  return Object.fromEntries((list || []).map((item) => [item.code, item.label]));
}

function setStatus(message, { error = false } = {}) {
  statusLine.textContent = message;
  statusLine.classList.toggle('is-error', error);
}

// "Full (to the gate)" -> "Full": the card has room for the short form only.
function escortText(code) {
  const label = labels.escort_scopes[code] || code;
  return label.replace(/\s*\(.*\)\s*$/, '');
}

function servicesText(services) {
  if (!services.length) return '–';
  return services.map((code) => labels.services[code] || code).join(', ');
}

// Phone link: keep digits and a leading + only.
function telHref(phone) {
  const cleaned = String(phone).replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  return `tel:${cleaned}`;
}

function item(label, value) {
  return el('div', {},
    el('span', { className: 'agent-card__label' }, label),
    el('span', { className: 'agent-card__value' }, value));
}

// ---------- Cards ----------

function card(order, index) {
  const meeting = order.final_time;
  const departure = order.flight.departure_at;
  const departureText = departure
    ? (meeting && isSameDayIL(meeting, departure) ? formatTimeIL(departure) : `${formatDateIL(departure)} ${formatTimeIL(departure)}`)
    : '–';

  const node = el('li', { className: `agent-card${index === 0 ? ' agent-card--first' : ''}` });
  const flightText = order.flight.destination ? `${order.flight.flight_no} ${order.flight.destination}` : order.flight.flight_no;

  node.append(
    el('div', { className: 'agent-card__top' },
      el('div', {},
        el('span', { className: 'agent-card__label' }, 'Meeting time'),
        el('span', { className: 'agent-card__time' }, meeting ? formatTimeIL(meeting) : '–'),
        el('span', { className: 'agent-card__date' }, meeting ? formatDateIL(meeting) : '')),
      el('div', { className: 'agent-card__departure' },
        el('span', { className: 'agent-card__label' }, 'Departure'),
        el('span', { className: 'agent-card__departure-time' }, departureText))),
    el('div', { className: 'agent-card__person' },
      el('span', { className: 'agent-card__name' }, order.customer.full_name,
        // M9 (plan D13, O5): his own orders; unassigned orders have no tag.
        order.assigned_to_me ? el('span', { className: 'tag tag-returning agent-card__tag' }, 'Assigned to you') : null),
      el('a', { className: 'agent-card__phone', attrs: { href: telHref(order.customer.phone) } }, order.customer.phone)),
    el('div', { className: 'agent-card__grid' },
      item('Flight', flightText),
      item('Services', servicesText(order.services)),
      item('Travellers · Bags', `${order.travelers} · ${order.bags}`),
      item('Escort', escortText(order.escort_scope))),
  );
  if (order.manager_notes) {
    node.append(el('div', { className: 'agent-card__notes' },
      el('span', { className: 'agent-card__label' }, 'Manager notes'),
      el('span', { className: 'agent-card__value' }, order.manager_notes)));
  }
  node.append(completeArea(order));
  return node;
}

// "Mark completed" -> "Mark this order as completed?" Confirm / Cancel, in the same card.
function completeArea(order) {
  const area = el('div', { className: 'agent-card__actions' });
  const error = el('p', { className: 'alert-error', attrs: { role: 'alert', hidden: '' } });

  function showButton() {
    const button = el('button', { className: 'btn btn-small btn-secondary', attrs: { type: 'button' } }, 'Mark completed');
    button.addEventListener('click', showConfirm);
    area.replaceChildren(error, button);
    return button;
  }

  function showConfirm() {
    error.hidden = true;
    const confirm = el('button', { className: 'btn btn-small btn-primary', attrs: { type: 'button' } }, 'Confirm');
    const cancel = el('button', { className: 'btn btn-small btn-secondary', attrs: { type: 'button' } }, 'Cancel');
    const question = el('p', { className: 'confirm-row__question' }, 'Mark this order as completed?');
    cancel.addEventListener('click', () => showButton().focus());
    confirm.addEventListener('click', async () => {
      confirm.disabled = true;
      cancel.disabled = true;
      try {
        await staffPost('/api/order-decision', { order_id: order.id, action: 'complete' });
        orders = orders.filter((o) => o.id !== order.id);
        renderList();
        setStatus(`Order ${order.reference} marked completed.`);
        statusLine.focus();
      } catch (err) {
        if (err.status === 401) return; // going to the login page
        if (err.status === 409) {
          setStatus(`${err.message} The list was refreshed.`, { error: true });
          await loadOrders();
          return;
        }
        error.textContent = err.message || GENERIC_MESSAGE;
        error.hidden = false;
        showButton();
      }
    });
    area.replaceChildren(error, el('div', { className: 'confirm-row' }, question,
      el('div', { className: 'confirm-row__buttons' }, confirm, cancel)));
    confirm.focus();
  }

  showButton();
  return area;
}

function renderList() {
  clear(listNode);
  listEmpty.hidden = orders.length > 0;
  orders.forEach((order, index) => listNode.append(card(order, index)));
}

// ---------- Loading ----------

async function loadOrders() {
  refreshButton.disabled = true;
  listError.hidden = true;
  try {
    const data = await staffGet('/api/orders?view=approved');
    orders = data.orders;
    renderList();
  } catch (err) {
    if (err.status === 401) return; // session.js is already going to the login page
    listError.textContent = err.message || GENERIC_MESSAGE;
    listError.hidden = false;
  } finally {
    listLoading.hidden = true;
    refreshButton.disabled = false;
  }
}

async function start() {
  bindLogout(document.getElementById('logout'));
  statusLine.setAttribute('tabindex', '-1');
  refreshButton.addEventListener('click', () => {
    setStatus('');
    loadOrders();
  });
  try {
    const config = await getJson('/api/config');
    labels = { services: labelMap(config.lists.services), escort_scopes: labelMap(config.lists.escort_scopes) };
  } catch {
    // Labels are optional: codes are shown instead.
  }
  await loadOrders();
}

if (session) start();
