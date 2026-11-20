// Manager approvals screen: list of pending orders (left) and the selected order's details (right).
// All data text is set with textContent (dom.js). Times are shown in Israel time (time.js).
import { getJson } from './api.js';
import { el, clear } from './dom.js';
import {
  formatDayTimeIL, formatTimeIL, formatDateIL, isSameDayIL, toIsraelInputs, israelInputToIso,
} from './time.js';
import { requireRole, bindLogout, staffGet, staffPost } from './session.js';

const BEFORE_DEPARTURE = 'Meeting time must be before departure';
const MISSING_TIME = 'Please enter a date and time.';
const GENERIC_MESSAGE = 'Something went wrong. Please try again.';
const EMAIL_NOT_SENT = 'Decision saved, but the email to the customer was not sent.';

const session = requireRole('manager');

const listNode = document.getElementById('order-list');
const listError = document.getElementById('list-error');
const listEmpty = document.getElementById('list-empty');
const listLoading = document.getElementById('list-loading');
const detailsNode = document.getElementById('details');
const refreshButton = document.getElementById('refresh');
const statusLine = document.getElementById('status-line');

const STATUS_TAGS = {
  pending: { label: 'Pending', className: 'tag tag-pending' },
  approved: { label: 'Approved', className: 'tag tag-approved' },
  rejected: { label: 'Rejected', className: 'tag tag-rejected' },
  needs_clarification: { label: 'Needs clarification', className: 'tag tag-dark' },
  completed: { label: 'Completed', className: 'tag tag-approved' },
};

let labels = { services: {}, escort_scopes: {} };
let orders = [];
let selectedId = null;
// A just-decided order whose customer email was not sent: it left the list but stays open
// in the details with the warning, so the manager sees it (DESIGN, decision 10).
let heldOrder = null;

function labelMap(list) {
  return Object.fromEntries((list || []).map((item) => [item.code, item.label]));
}

function statusTag(status) {
  const tag = STATUS_TAGS[status] || { label: status, className: 'tag tag-pending' };
  return el('span', { className: tag.className }, tag.label);
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function departureText(order) {
  return order.flight.departure_at ? formatDayTimeIL(order.flight.departure_at) : 'Not found';
}

function servicesText(order) {
  if (!order.services.length) return 'No extra services';
  return order.services.map((code) => labels.services[code] || code).join(', ');
}

function setStatus(message, { error = false } = {}) {
  statusLine.textContent = message;
  statusLine.classList.toggle('is-error', error);
}

// ---------- List ----------

function renderList() {
  clear(listNode);
  listEmpty.hidden = orders.length > 0;
  for (const order of orders) {
    const destination = order.flight.destination || 'Flight not found';
    const button = el('button', {
      className: 'order-item',
      attrs: { type: 'button', 'aria-pressed': String(order.id === selectedId), 'data-id': order.id },
    },
    el('span', { className: 'order-item__title' }, `${order.customer.full_name} · ${order.flight.flight_no}`),
    el('span', { className: 'order-item__sub' },
      `${destination} · ${departureText(order)} · ${plural(order.travelers, 'traveller')}`),
    el('span', { className: 'order-item__tags' }, statusTag(order.status)));
    button.addEventListener('click', () => {
      selectOrder(order.id);
      // One-column layout (phone): bring the details into view below the list.
      if (window.matchMedia('(max-width: 899px)').matches) detailsNode.scrollIntoView({ block: 'start' });
    });
    listNode.append(el('li', {}, button));
  }
}

function selectOrder(id) {
  selectedId = id;
  heldOrder = null;
  for (const button of listNode.querySelectorAll('.order-item')) {
    button.setAttribute('aria-pressed', String(button.dataset.id === id));
  }
  renderDetails();
}

// ---------- Details ----------

function dataItem(label, value) {
  return el('div', {},
    el('span', { className: 'details-grid__label' }, label),
    el('span', { className: 'details-grid__value' }, value));
}

function panel(title, text) {
  return el('div', { className: 'panel stack' },
    el('h3', { className: 'panel__title' }, title),
    el('p', { className: 'panel__text' }, text));
}

// AI panel (M4): the personal email draft when the AI output passed every check.
// The service recommendation is shown from M6.
function aiPanel(order) {
  const ai = order.ai_output;
  if (!ai || ai.status !== 'ok' || !ai.customer_paragraph) return panel('AI recommendations', 'AI suggestions unavailable');
  return el('div', { className: 'panel stack' },
    el('h3', { className: 'panel__title' }, 'AI recommendations'),
    el('p', { className: 'panel__text' }, 'Email draft:'),
    el('p', { className: 'panel__text ai-draft' }, `“${ai.customer_paragraph}”`));
}

function renderDetails() {
  clear(detailsNode);
  const order = orders.find((o) => o.id === selectedId) || (heldOrder && heldOrder.id === selectedId ? heldOrder : null);
  if (!order) {
    detailsNode.hidden = true;
    return;
  }
  detailsNode.hidden = false;

  const flightText = order.flight.destination
    ? `${order.flight.flight_no} · ${order.flight.destination}`
    : order.flight.flight_no;
  const escortText = labels.escort_scopes[order.escort_scope] || order.escort_scope;

  detailsNode.append(
    el('div', { className: 'details__head' },
      el('h2', { className: 'h3' }, `Order ${order.reference}`),
      statusTag(order.status)),
    el('div', { className: 'details-grid' },
      dataItem('Customer', order.customer.full_name),
      dataItem('Phone / Email', `${order.customer.phone} · ${order.customer.email}`),
      dataItem('Flight', flightText),
      dataItem('Departure', departureText(order)),
      dataItem('Travellers · Bags', `${order.travelers} · ${order.bags}`),
      dataItem('Services · Escort', `${servicesText(order)} · ${escortText}`)),
    el('div', { className: 'details-panels' },
      panel('Customer notes', order.customer_notes || 'No notes'),
      aiPanel(order)),
  );
  if (order === heldOrder) {
    detailsNode.append(el('div', { className: 'decision' },
      el('p', { className: 'alert-error', attrs: { role: 'alert' } }, EMAIL_NOT_SENT)));
  } else if (order.status === 'pending') {
    detailsNode.append(decisionArea(order));
  }
}

// ---------- Decision: meeting time, Reject, Approve ----------

function recommendedHint(order) {
  const rec = order.recommended_time;
  if (!rec) return '';
  const sameDay = order.flight.departure_at && isSameDayIL(rec, order.flight.departure_at);
  return `Recommended ${sameDay ? '' : `${formatDateIL(rec)} `}${formatTimeIL(rec)}`;
}

function decisionArea(order) {
  const initial = order.recommended_time ? toIsraelInputs(order.recommended_time) : { date: '', time: '' };

  const dateInput = el('input', {
    className: 'input', attrs: { type: 'date', id: 'meeting-date', 'aria-label': 'Meeting date', 'aria-describedby': 'meeting-hint meeting-error' },
  });
  const timeInput = el('input', {
    className: 'input', attrs: { type: 'time', id: 'meeting-time', 'aria-label': 'Meeting time of day', 'aria-describedby': 'meeting-hint meeting-error' },
  });
  dateInput.value = initial.date;
  timeInput.value = initial.time;

  const fieldError = el('p', { className: 'field__error', attrs: { id: 'meeting-error', hidden: '' } });
  const field = el('fieldset', { className: 'field meeting-field' },
    el('legend', { className: 'fieldset__legend' }, 'Meeting time'),
    el('div', { className: 'meeting-field__inputs' }, dateInput, timeInput),
    el('p', { className: 'field__hint', attrs: { id: 'meeting-hint' } }, recommendedHint(order)),
    fieldError);

  const formError = el('p', { className: 'alert-error', attrs: { role: 'alert', hidden: '' } });
  const rejectButton = el('button', { className: 'btn btn-secondary', attrs: { type: 'button' } }, 'Reject');
  const approveButton = el('button', { className: 'btn btn-primary', attrs: { type: 'button' } }, 'Approve');

  function showFieldError(message) {
    fieldError.textContent = message;
    fieldError.hidden = false;
    field.classList.add('is-invalid');
    dateInput.setAttribute('aria-invalid', 'true');
    timeInput.setAttribute('aria-invalid', 'true');
  }
  function clearErrors() {
    fieldError.hidden = true;
    field.classList.remove('is-invalid');
    dateInput.removeAttribute('aria-invalid');
    timeInput.removeAttribute('aria-invalid');
    formError.hidden = true;
  }
  function showFormError(message) {
    formError.textContent = message;
    formError.hidden = false;
  }

  async function send(body) {
    clearErrors();
    rejectButton.disabled = true;
    approveButton.disabled = true;
    try {
      const data = await staffPost('/api/order-decision', body);
      const verb = body.action === 'approve' ? 'approved' : 'rejected';
      if (data.email_sent) {
        setStatus(`Order ${order.reference} ${verb}. Email sent to the customer.`);
        removeOrder(order.id);
      } else {
        setStatus(`Order ${order.reference} ${verb}.`);
        holdOrder(data.order);
      }
    } catch (err) {
      if (err.status === 401) return; // going to the login page
      if (err.status === 400 && err.message === BEFORE_DEPARTURE) showFieldError(BEFORE_DEPARTURE);
      else if (err.status === 409) {
        setStatus(`${err.message} The list was refreshed.`, { error: true });
        await loadOrders();
      } else showFormError(err.message || GENERIC_MESSAGE);
    } finally {
      rejectButton.disabled = false;
      approveButton.disabled = false;
    }
  }

  approveButton.addEventListener('click', () => {
    clearErrors();
    const changed = dateInput.value !== initial.date || timeInput.value !== initial.time;
    if (!changed) return send({ order_id: order.id, action: 'approve' }); // server uses the current recommended time
    const iso = israelInputToIso(dateInput.value, timeInput.value);
    if (!iso) return showFieldError(MISSING_TIME);
    if (Date.parse(iso) >= Date.parse(order.flight.departure_at)) return showFieldError(BEFORE_DEPARTURE);
    return send({ order_id: order.id, action: 'approve', final_time: iso });
  });
  rejectButton.addEventListener('click', () => send({ order_id: order.id, action: 'reject' }));

  return el('div', { className: 'decision' },
    field,
    el('div', { className: 'decision__actions' }, formError,
      el('div', { className: 'decision__buttons' }, rejectButton, approveButton)));
}

// After a decision: drop the order and select the one that took its place.
function removeOrder(id) {
  const index = orders.findIndex((o) => o.id === id);
  orders = orders.filter((o) => o.id !== id);
  const next = orders[Math.min(index, orders.length - 1)];
  selectedId = next ? next.id : null;
  renderList();
  renderDetails();
}

// After a decision whose email was not sent: drop it from the list, keep it open with the warning.
function holdOrder(decided) {
  orders = orders.filter((o) => o.id !== decided.id);
  heldOrder = decided;
  selectedId = decided.id;
  renderList();
  renderDetails();
}

// ---------- Loading ----------

async function loadOrders() {
  refreshButton.disabled = true;
  listError.hidden = true;
  try {
    const data = await staffGet('/api/orders?view=inbox');
    orders = data.orders;
    heldOrder = null;
    if (!orders.some((o) => o.id === selectedId)) selectedId = orders.length ? orders[0].id : null;
    renderList();
    renderDetails();
  } catch (err) {
    if (err.status === 401) return; // session.js is already going to the login page
    listError.textContent = err.message || 'Something went wrong. Please try again.';
    listError.hidden = false;
  } finally {
    listLoading.hidden = true;
    refreshButton.disabled = false;
  }
}

async function start() {
  bindLogout(document.getElementById('logout'));
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
