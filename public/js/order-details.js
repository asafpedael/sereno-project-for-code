// Order details shared by the Approvals screen (manager.js) and the archive panel (archive.js),
// M8 plan D13. Moved from manager.js without changing what the Approvals screen shows.
// All data text is set with textContent (dom.js). Times are shown in Israel time (time.js).
import { el, clear } from './dom.js';
import { formatDayTimeIL, formatDateIL } from './time.js';
import { staffGet, staffPost } from './session.js';
import { servicesLabels } from './services-text.js';

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

export const STATUS_TAGS = {
  pending: { label: 'Pending', className: 'tag tag-pending' },
  approved: { label: 'Approved', className: 'tag tag-approved' },
  rejected: { label: 'Rejected', className: 'tag tag-rejected' },
  needs_clarification: { label: 'Needs clarification', className: 'tag tag-dark' },
  completed: { label: 'Completed', className: 'tag tag-approved' },
};

// Service and escort labels from /api/config (codes are shown until they are loaded).
let labels = { services: {}, escort_scopes: {} };

function labelMap(list) {
  return Object.fromEntries((list || []).map((item) => [item.code, item.label]));
}

export function setLabels(lists) {
  labels = { services: labelMap(lists && lists.services), escort_scopes: labelMap(lists && lists.escort_scopes) };
}

export function statusTag(status) {
  const tag = STATUS_TAGS[status] || { label: status, className: 'tag tag-pending' };
  return el('span', { className: tag.className }, tag.label);
}

// An approved order whose flight moved shows "Flight time changed" instead of "Approved".
export function orderTag(order) {
  if (order.flight_change_pending) return el('span', { className: 'tag tag-dark' }, 'Flight time changed');
  return statusTag(order.status);
}

export function returningTag() {
  return el('span', { className: 'tag tag-returning' }, 'Returning');
}

// "12 Dec 2026" from "2026-12-12".
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function formatDateOnly(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function departureText(order) {
  return order.flight.departure_at ? formatDayTimeIL(order.flight.departure_at) : 'Not found';
}

export function servicesText(order) {
  if (!order.services.length) return 'No extra services';
  // "Wheelchair × 2" from 2 wheelchairs (Milestone 11, plan D7).
  return servicesLabels(order.services, order.wheelchairs, labels.services).join(', ');
}

export function escortText(order) {
  return labels.escort_scopes[order.escort_scope] || order.escort_scope;
}

export function flightText(order) {
  return order.flight.destination ? `${order.flight.flight_no} · ${order.flight.destination}` : order.flight.flight_no;
}

export function dataItem(label, value) {
  return el('div', {},
    el('span', { className: 'details-grid__label' }, label),
    el('span', { className: 'details-grid__value' }, value));
}

export function panel(title, text) {
  return el('div', { className: 'panel stack' },
    el('h3', { className: 'panel__title' }, title),
    el('p', { className: 'panel__text' }, text));
}

// The six data items of the manager's order details. extraItems go at the end (the archive
// adds the meeting time).
export function detailsGrid(order, extraItems = []) {
  return el('div', { className: 'details-grid' },
    dataItem('Customer', order.customer.full_name),
    dataItem('Phone / Email', `${order.customer.phone} · ${order.customer.email}`),
    dataItem('Flight', flightText(order)),
    dataItem('Departure', departureText(order)),
    dataItem('Travellers · Bags', `${order.travelers} · ${order.bags}`),
    dataItem('Services · Escort', `${servicesText(order)} · ${escortText(order)}`),
    ...extraItems);
}

// AI panel: the recommended services (M6, plan D5; the server keeps only porter / wheelchair)
// and the personal email draft (M4), when the AI output passed every check.
export function aiPanel(order) {
  const ai = order.ai_output;
  if (!ai || ai.status !== 'ok' || !ai.customer_paragraph) return panel('AI recommendations', 'AI suggestions unavailable');
  const recommended = ai.recommended_services.length
    ? ai.recommended_services.map((code) => labels.services[code] || code).join(', ')
    : 'None';
  return el('div', { className: 'panel stack' },
    el('h3', { className: 'panel__title' }, 'AI recommendations'),
    el('p', { className: 'panel__text' }, `Recommended services: ${recommended}`),
    el('p', { className: 'panel__text' }, 'Email draft:'),
    el('p', { className: 'panel__text ai-draft' }, `“${ai.customer_paragraph}”`));
}

// ---------- Exceptions (M5): missing flight and flight time changed ----------

export function missingFlightPanel(order) {
  const typed = order.submitted_flight || { flight_no: order.flight.flight_no, date: null };
  return el('div', { className: 'panel stack' },
    el('h3', { className: 'panel__title' }, 'Flight not found in our schedule'),
    el('div', { className: 'details-grid' },
      dataItem('Flight number entered', typed.flight_no),
      dataItem('Departure date entered', typed.date ? formatDateOnly(typed.date) : 'Not given')));
}

export function flightChangePanel(order) {
  return el('div', { className: 'panel stack' },
    el('h3', { className: 'panel__title' }, 'Flight time changed'),
    el('div', { className: 'details-grid' },
      dataItem('Previous departure', formatDayTimeIL(order.previous_departure_at)),
      dataItem('New departure', formatDayTimeIL(order.flight.departure_at))));
}

// ---------- Customer notes and history (M6, plan D7) ----------

// Customer history per order id: an array of previous orders, 'loading' or 'error'.
// Loaded from GET /api/orders?id= when an order is opened; cleared with clearHistory().
const historyById = new Map();

export function clearHistory() {
  historyById.clear();
}

// "Customer notes" and "Customer history" in one panel, as the mockup. The history is
// filled in place when GET /api/orders?id= answers, so typed inputs are not redrawn.
// isCurrent(id): whether that order is still the one shown when the answer arrives.
export function customerPanel(order, isCurrent) {
  const historyBody = el('div', { className: 'stack history', attrs: { id: 'history-body' } });
  fillHistory(historyBody, order);
  if (!historyById.has(order.id)) loadHistory(order, isCurrent);
  return el('div', { className: 'panel stack' },
    el('h3', { className: 'panel__title' }, 'Customer notes'),
    el('p', { className: 'panel__text' }, order.customer_notes || 'No notes'),
    el('h3', { className: 'panel__title' }, 'Customer history'),
    historyBody);
}

const STATUS_WORDS = {
  pending: 'Pending', approved: 'Approved', rejected: 'Rejected',
  needs_clarification: 'Needs clarification', completed: 'Completed',
};

function historyLine(item) {
  const parts = [item.flight_no];
  if (item.destination) parts.push(item.destination);
  if (item.departure_at) parts.push(formatDateIL(item.departure_at));
  else if (item.flight_date_submitted) parts.push(formatDateOnly(item.flight_date_submitted));
  parts.push(STATUS_WORDS[item.status] || item.status);
  return parts.join(' · ');
}

function fillHistory(node, order) {
  clear(node);
  const history = historyById.get(order.id);
  if (history === undefined || history === 'loading') {
    node.append(el('p', { className: 'panel__text text-soft' }, 'Loading history…'));
    return;
  }
  if (history === 'error') {
    node.append(el('p', { className: 'panel__text' }, 'History could not be loaded.'));
    return;
  }
  const count = history.length;
  let summary;
  if (count === 0) summary = order.is_returning_customer ? 'Returning customer' : 'No previous orders';
  else summary = `${order.is_returning_customer ? 'Returning customer · ' : ''}${plural(count, 'previous order')}`;
  node.append(el('p', { className: 'panel__text' }, summary));
  if (count) {
    node.append(el('ul', { className: 'history__list' },
      ...history.map((item) => el('li', { className: 'panel__text text-soft' }, historyLine(item)))));
  }
}

async function loadHistory(order, isCurrent) {
  historyById.set(order.id, 'loading');
  try {
    const data = await staffGet(`/api/orders?id=${encodeURIComponent(order.id)}`);
    historyById.set(order.id, Array.isArray(data.order.previous_orders) ? data.order.previous_orders : []);
  } catch (err) {
    if (err.status === 401) return; // going to the login page
    historyById.set(order.id, 'error');
  }
  const node = document.getElementById('history-body');
  if (node && isCurrent(order.id)) fillHistory(node, order);
}

// ---------- Field agent (M9, plan D11, D12) ----------

export const NOT_ASSIGNED = 'Not assigned (all agents)';

// The agents from GET /api/agents ([{ id, name }]); null until loaded, 'error' if it failed.
export async function loadAgents() {
  try {
    const data = await staffGet('/api/agents');
    return Array.isArray(data.agents) ? data.agents : [];
  } catch (err) {
    if (err.status === 401) return null; // going to the login page
    return 'error';
  }
}

// The name of an order's agent, "–" when none, "Unknown agent" when the user is gone.
export function agentNameFor(agentId, agents) {
  if (!agentId) return '–';
  const found = Array.isArray(agents) ? agents.find((a) => a.id === agentId) : null;
  return found ? found.name : 'Unknown agent';
}

// "Field agent" menu: "Not assigned (all agents)" first, then the agents. selectedId keeps an
// agent that is no longer in the list as "Unknown agent", so saving does not change it by
// accident. value() is the chosen id, or null.
export function agentField(agents, selectedId = null) {
  const list = Array.isArray(agents) ? agents : [];
  const select = el('select', { className: 'input select', attrs: { id: 'agent-select', 'aria-describedby': 'agent-hint' } },
    el('option', { attrs: { value: '' } }, NOT_ASSIGNED),
    ...list.map((a) => el('option', { attrs: { value: a.id } }, a.name)));
  if (selectedId && !list.some((a) => a.id === selectedId)) {
    select.append(el('option', { attrs: { value: selectedId } }, 'Unknown agent'));
  }
  select.value = selectedId || '';
  const hint = el('p', { className: 'field__hint', attrs: { id: 'agent-hint' } },
    agents === 'error' ? 'Agent list could not be loaded.' : '');
  const node = el('div', { className: 'field agent-field' },
    el('label', { className: 'field__label', attrs: { for: 'agent-select' } }, 'Field agent'),
    select,
    hint);
  return { node, select, value: () => select.value || null };
}

// ---------- Manager notes (M6, plan D11) ----------

// "Manager notes" box with "Save note" (add_note, any status). value() is what Approve and
// Reject send with the decision; an empty box there keeps any earlier note.
// onSaved(notes, message): called after a save with the stored note (or null) and the
// success text to show.
export function notesField(order, onSaved) {
  const textarea = el('textarea', {
    className: 'textarea',
    attrs: { id: 'manager-notes', maxlength: '500', placeholder: 'Add a note for the field agent', 'aria-describedby': 'notes-error' },
  });
  textarea.value = order.manager_notes || '';
  const error = el('p', { className: 'field__error', attrs: { id: 'notes-error', hidden: '' } });
  const saveButton = el('button', { className: 'btn btn-small btn-secondary', attrs: { type: 'button' } }, 'Save note');

  saveButton.addEventListener('click', async () => {
    error.hidden = true;
    saveButton.disabled = true;
    try {
      const data = await staffPost('/api/order-decision', { order_id: order.id, action: 'add_note', manager_notes: textarea.value });
      const notes = data.order.manager_notes || null;
      order.manager_notes = notes;
      textarea.value = notes || '';
      onSaved(notes, notes ? `Note saved for order ${order.reference}.` : `Note cleared for order ${order.reference}.`);
    } catch (err) {
      if (err.status === 401) return;
      error.textContent = err.message || GENERIC_MESSAGE;
      error.hidden = false;
    } finally {
      saveButton.disabled = false;
    }
  });

  const node = el('div', { className: 'field notes-field' },
    el('label', { className: 'field__label', attrs: { for: 'manager-notes' } }, 'Manager notes'),
    textarea,
    el('div', { className: 'notes-field__actions' }, saveButton),
    error);
  return { node, value: () => textarea.value };
}
