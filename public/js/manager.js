// Manager approvals screen: list of pending orders (left) and the selected order's details (right).
// All data text is set with textContent (dom.js). Times are shown in Israel time (time.js).
import { getJson } from './api.js';
import { el, clear } from './dom.js';
import {
  formatTimeIL, formatDateIL, isSameDayIL, toIsraelInputs, israelInputToIso,
} from './time.js';
import { requireRole, bindLogout, staffGet, staffPost } from './session.js';
import {
  orderTag, returningTag, plural, departureText, detailsGrid, aiPanel, missingFlightPanel, flightChangePanel,
  customerPanel, clearHistory, notesField, setLabels, loadAgents, agentField, agentNameFor,
} from './order-details.js';
import { filterInbox } from './inbox-filter.js';

const BEFORE_DEPARTURE = 'Meeting time must be before departure';
const MISSING_TIME = 'Please enter a date and time.';
const GENERIC_MESSAGE = 'Something went wrong. Please try again.';
const EMAIL_NOT_SENT = 'Decision saved, but the email to the customer was not sent.';
const CHANGE_EMAIL_NOT_SENT = 'Change saved, but the email to the customer was not sent.';
const CLARIFICATION_NOT_SENT = 'The clarification email was not sent. Please try again.';

const session = requireRole('manager');

const listNode = document.getElementById('order-list');
const listError = document.getElementById('list-error');
const listEmpty = document.getElementById('list-empty');
const listLoading = document.getElementById('list-loading');
const detailsNode = document.getElementById('details');
const refreshButton = document.getElementById('refresh');
const statusLine = document.getElementById('status-line');
const filterSelect = document.getElementById('status-filter');

const EMPTY_INBOX = 'No orders are waiting for a decision.';
const EMPTY_FILTER = 'No orders match this filter.';

let orders = [];
let selectedId = null;
// M9 (plan D11): the field agents for the "Field agent" menu ([{ id, name }] or 'error').
let agents = null;
// A just-decided order whose customer email was not sent: it left the list but stays open
// in the details with the warning, so the manager sees it (DESIGN, decision 10).
let heldOrder = null;
let heldMessage = '';
// Id of the missing-flight order whose clarification email just failed (shown until the next action).
let clarificationWarning = null;

function setStatus(message, { error = false } = {}) {
  statusLine.textContent = message;
  statusLine.classList.toggle('is-error', error);
}

// ---------- List ----------

// The orders the status menu keeps (M8, plan D14). `orders` always holds the whole inbox.
function shownOrders() {
  return filterInbox(orders, filterSelect.value);
}

// When the open order is not in the filtered list, it closes. Nothing opens by itself
// (M9 fix, Asaf 24.11.2026: the manager opens and closes orders). A held order (decided,
// email not sent) stays open.
function keepSelectionShown() {
  const shown = shownOrders();
  if (heldOrder && heldOrder.id === selectedId) return;
  if (!shown.some((o) => o.id === selectedId)) selectedId = null;
}

// Closes the open order: the list stays, with no order selected. Focus goes back to its row.
function closeDetails() {
  const id = selectedId;
  selectedId = null;
  heldOrder = null;
  renderList();
  renderDetails();
  const button = [...listNode.querySelectorAll('.order-item')].find((b) => b.dataset.id === id);
  if (button) button.focus();
}

function renderList() {
  clear(listNode);
  const shown = shownOrders();
  listEmpty.textContent = orders.length ? EMPTY_FILTER : EMPTY_INBOX;
  listEmpty.hidden = shown.length > 0;
  for (const order of shown) {
    const sub = order.status === 'needs_clarification'
      ? `Flight not found · ${plural(order.travelers, 'traveller')}`
      : `${order.flight.destination || 'Flight not found'} · ${departureText(order)} · ${plural(order.travelers, 'traveller')}`;
    const button = el('button', {
      className: 'order-item',
      attrs: { type: 'button', 'aria-pressed': String(order.id === selectedId), 'data-id': order.id },
    },
    el('span', { className: 'order-item__title' }, `${order.customer.full_name} · ${order.flight.flight_no}`),
    el('span', { className: 'order-item__sub' }, sub),
    el('span', { className: 'order-item__tags' }, orderTag(order),
      order.is_returning_customer ? returningTag() : null));
    button.addEventListener('click', () => {
      // A second click on the open order closes it.
      if (order.id === selectedId) {
        closeDetails();
        return;
      }
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

function renderDetails() {
  clear(detailsNode);
  const order = orders.find((o) => o.id === selectedId) || (heldOrder && heldOrder.id === selectedId ? heldOrder : null);
  const placeholder = document.getElementById('details-empty');
  if (!order) {
    detailsNode.hidden = true;
    placeholder.hidden = orders.length === 0;
    return;
  }
  detailsNode.hidden = false;
  placeholder.hidden = true;

  const close = el('button', {
    className: 'archive-panel__close',
    attrs: { type: 'button', 'aria-label': 'Close order details' },
  }, '×');
  close.addEventListener('click', closeDetails);

  const missing = order.status === 'needs_clarification';
  detailsNode.append(
    el('div', { className: 'details__head' },
      el('h2', { className: 'h3' }, `Order ${order.reference}`),
      el('div', { className: 'details__head-tags' }, orderTag(order), close)),
    detailsGrid(order),
    el('div', { className: 'details-panels' },
      customerPanel(order, (id) => selectedId === id),
      // No AI box for a missing flight (DESIGN): the flight panel takes its place.
      missing ? missingFlightPanel(order) : order.flight_change_pending ? flightChangePanel(order) : aiPanel(order)),
  );
  if (order === heldOrder) {
    detailsNode.append(el('div', { className: 'decision' },
      el('p', { className: 'alert-error', attrs: { role: 'alert' } }, heldMessage)));
  } else if (order.status === 'pending') {
    detailsNode.append(decisionArea(order));
  } else if (missing) {
    detailsNode.append(clarificationArea(order));
  } else if (order.flight_change_pending) {
    detailsNode.append(flightChangeArea(order));
  }
}

// After "Save note": the order in the list keeps the new note, so the other inputs keep what
// the manager typed (no redraw).
function noteSaved(order) {
  return (notes, message) => {
    orders = orders.map((o) => (o.id === order.id ? { ...o, manager_notes: notes } : o));
    setStatus(message);
  };
}

// The shared error handling of every decision request.
async function handleDecisionError(err, { showFieldError, showFormError }) {
  if (err.status === 401) return; // going to the login page
  if (err.status === 400 && err.message === BEFORE_DEPARTURE && showFieldError) showFieldError(BEFORE_DEPARTURE);
  else if (err.status === 409) {
    setStatus(`${err.message} The list was refreshed.`, { error: true });
    await loadOrders();
  } else showFormError(err.message || GENERIC_MESSAGE);
}

// Missing flight: Reject or Confirm flight missing. Once the clarification email was sent,
// the line "Clarification email sent" replaces the primary button and the order stays.
function clarificationArea(order) {
  const formError = el('p', { className: 'alert-error', attrs: { role: 'alert', hidden: '' } });
  if (clarificationWarning === order.id) {
    formError.textContent = CLARIFICATION_NOT_SENT;
    formError.hidden = false;
  }
  const rejectButton = el('button', { className: 'btn btn-secondary', attrs: { type: 'button' } }, 'Reject');
  const sent = order.clarification && order.clarification.sent;
  const confirmButton = sent
    ? null
    : el('button', { className: 'btn btn-primary', attrs: { type: 'button' } }, 'Confirm flight missing');
  const buttons = [rejectButton, confirmButton].filter(Boolean);
  const showFormError = (message) => { formError.textContent = message; formError.hidden = false; };
  const notes = notesField(order, noteSaved(order));

  async function send(action) {
    formError.hidden = true;
    clarificationWarning = null;
    for (const b of buttons) b.disabled = true;
    try {
      const body = { order_id: order.id, action };
      if (action === 'reject') body.manager_notes = notes.value();
      const data = await staffPost('/api/order-decision', body);
      if (action === 'reject') {
        if (data.email_sent) {
          setStatus(`Order ${order.reference} rejected. Email sent to the customer.`);
          removeOrder(order.id);
        } else {
          setStatus(`Order ${order.reference} rejected.`);
          holdOrder(data.order, EMAIL_NOT_SENT);
        }
        return;
      }
      // Confirm flight missing: the order stays in the list, updated.
      if (data.email_sent) setStatus(`Clarification email sent for order ${order.reference}.`);
      else {
        setStatus('');
        clarificationWarning = order.id;
      }
      replaceOrder(data.order);
    } catch (err) {
      await handleDecisionError(err, { showFormError });
    } finally {
      for (const b of buttons) b.disabled = false;
    }
  }

  rejectButton.addEventListener('click', () => send('reject'));
  if (confirmButton) confirmButton.addEventListener('click', () => send('confirm_flight_missing'));

  return el('div', { className: 'decision' },
    el('div', { className: 'decision__fields' }, notes.node),
    el('div', { className: 'decision__actions' }, formError,
      el('div', { className: 'decision__buttons' },
        rejectButton,
        sent ? el('p', { className: 'decision__done' }, 'Clarification email sent') : confirmButton)));
}

// Flight time changed: the meeting time is filled with the new recommended time and can be
// edited; Ignore or Approve change. After either, the order leaves the list.
function flightChangeArea(order) {
  const meeting = meetingField(order.new_recommended_time, order.flight.departure_at);
  const formError = el('p', { className: 'alert-error', attrs: { role: 'alert', hidden: '' } });
  const ignoreButton = el('button', { className: 'btn btn-secondary', attrs: { type: 'button' } }, 'Ignore');
  const approveButton = el('button', { className: 'btn btn-primary', attrs: { type: 'button' } }, 'Approve change');
  const showFormError = (message) => { formError.textContent = message; formError.hidden = false; };
  const notes = notesField(order, noteSaved(order));
  // M9 fix (Asaf, 24.11.2026): a new flight time may need another agent. The menu starts on
  // the current agent; a different choice is saved (assign_agent) before Ignore / Approve change.
  const current = order.assigned_agent_id || null;
  const agent = agentField(agents, current);

  async function send(body) {
    meeting.clearErrors();
    formError.hidden = true;
    ignoreButton.disabled = true;
    approveButton.disabled = true;
    try {
      const chosenAgent = agent.value();
      let agentNote = '';
      if (chosenAgent !== current) {
        await staffPost('/api/order-decision', { order_id: order.id, action: 'assign_agent', agent_id: chosenAgent });
        agentNote = chosenAgent ? ` Agent: ${agentNameFor(chosenAgent, agents)}.` : ' Open to all agents.';
      }
      const data = await staffPost('/api/order-decision', body);
      if (body.action === 'ignore_flight_change') {
        setStatus(`Flight change ignored for order ${order.reference}.${agentNote}`);
        removeOrder(order.id);
      } else if (data.email_sent) {
        setStatus(`Order ${order.reference} updated. Email sent to the customer.${agentNote}`);
        removeOrder(order.id);
      } else {
        setStatus(`Order ${order.reference} updated.${agentNote}`);
        holdOrder(data.order, CHANGE_EMAIL_NOT_SENT);
      }
    } catch (err) {
      await handleDecisionError(err, { showFieldError: meeting.showFieldError, showFormError });
    } finally {
      ignoreButton.disabled = false;
      approveButton.disabled = false;
    }
  }

  approveButton.addEventListener('click', () => {
    const chosen = meeting.read();
    if (chosen.error) return meeting.showFieldError(chosen.error);
    const body = { order_id: order.id, action: 'approve_flight_change' };
    if (chosen.iso) body.final_time = chosen.iso;
    return send(body);
  });
  ignoreButton.addEventListener('click', () => send({ order_id: order.id, action: 'ignore_flight_change' }));

  return el('div', { className: 'decision' },
    el('div', { className: 'decision__fields' }, meeting.node, notes.node, agent.node),
    el('div', { className: 'decision__actions' }, formError,
      el('div', { className: 'decision__buttons' }, ignoreButton, approveButton)));
}

// "Meeting time" date + time inputs filled with a recommended time, with the hint
// "Recommended HH:MM". read() gives { iso: null } when unchanged (the server then uses the
// current recommended time), { iso } when changed, or { error }.
function meetingField(recommendedIso, departureIso) {
  const initial = recommendedIso ? toIsraelInputs(recommendedIso) : { date: '', time: '' };
  const dateInput = el('input', {
    className: 'input', attrs: { type: 'date', id: 'meeting-date', 'aria-label': 'Meeting date', 'aria-describedby': 'meeting-hint meeting-error' },
  });
  const timeInput = el('input', {
    className: 'input', attrs: { type: 'time', id: 'meeting-time', 'aria-label': 'Meeting time of day', 'aria-describedby': 'meeting-hint meeting-error' },
  });
  dateInput.value = initial.date;
  timeInput.value = initial.time;
  const fieldError = el('p', { className: 'field__error', attrs: { id: 'meeting-error', hidden: '' } });
  const hint = recommendedIso
    ? `Recommended ${departureIso && isSameDayIL(recommendedIso, departureIso) ? '' : `${formatDateIL(recommendedIso)} `}${formatTimeIL(recommendedIso)}`
    : '';
  const node = el('fieldset', { className: 'field meeting-field' },
    el('legend', { className: 'fieldset__legend' }, 'Meeting time'),
    el('div', { className: 'meeting-field__inputs' }, dateInput, timeInput),
    el('p', { className: 'field__hint', attrs: { id: 'meeting-hint' } }, hint),
    fieldError);

  return {
    node,
    showFieldError(message) {
      fieldError.textContent = message;
      fieldError.hidden = false;
      node.classList.add('is-invalid');
      dateInput.setAttribute('aria-invalid', 'true');
      timeInput.setAttribute('aria-invalid', 'true');
    },
    clearErrors() {
      fieldError.hidden = true;
      node.classList.remove('is-invalid');
      dateInput.removeAttribute('aria-invalid');
      timeInput.removeAttribute('aria-invalid');
    },
    read() {
      if (dateInput.value === initial.date && timeInput.value === initial.time) return { iso: null };
      const iso = israelInputToIso(dateInput.value, timeInput.value);
      if (!iso) return { error: MISSING_TIME };
      if (Date.parse(iso) >= Date.parse(departureIso)) return { error: BEFORE_DEPARTURE };
      return { iso };
    },
  };
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

  const notes = notesField(order, noteSaved(order));
  // M9 (plan D11): optional; "Not assigned" leaves the order to all agents.
  const agent = agentField(agents);

  async function send(body) {
    clearErrors();
    rejectButton.disabled = true;
    approveButton.disabled = true;
    try {
      // The note goes with the decision (an empty box keeps any earlier note).
      const request = { ...body, manager_notes: notes.value() };
      const agentId = body.action === 'approve' ? agent.value() : null;
      if (agentId) request.agent_id = agentId;
      const data = await staffPost('/api/order-decision', request);
      const verb = body.action === 'approve' ? 'approved' : 'rejected';
      const forAgent = agentId ? ` for ${agentNameFor(agentId, agents)}` : '';
      if (data.email_sent) {
        setStatus(`Order ${order.reference} ${verb}${forAgent}. Email sent to the customer.`);
        removeOrder(order.id);
      } else {
        setStatus(`Order ${order.reference} ${verb}${forAgent}.`);
        holdOrder(data.order, EMAIL_NOT_SENT);
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
    el('div', { className: 'decision__fields' }, field, notes.node, agent.node),
    el('div', { className: 'decision__actions' }, formError,
      el('div', { className: 'decision__buttons' }, rejectButton, approveButton)));
}

// After a decision: drop the order; no other order opens by itself (M9 fix).
function removeOrder(id) {
  orders = orders.filter((o) => o.id !== id);
  selectedId = null;
  renderList();
  renderDetails();
}

// After "Confirm flight missing": the order stays in the list with its new state.
function replaceOrder(updated) {
  orders = orders.map((o) => (o.id === updated.id ? updated : o));
  selectedId = updated.id;
  renderList();
  renderDetails();
}

// After a decision whose email was not sent: drop it from the list, keep it open with the warning.
function holdOrder(decided, message) {
  orders = orders.filter((o) => o.id !== decided.id);
  heldOrder = decided;
  heldMessage = message;
  selectedId = decided.id;
  renderList();
  renderDetails();
}

// ---------- Loading ----------

async function loadOrders() {
  refreshButton.disabled = true;
  listError.hidden = true;
  try {
    // M9: the agent list is read again with every Refresh (a new agent user shows up).
    const [data, agentList] = await Promise.all([staffGet('/api/orders?view=inbox'), loadAgents()]);
    if (agentList !== null) agents = agentList;
    orders = data.orders;
    heldOrder = null;
    clearHistory(); // Refresh also reloads the customer history
    keepSelectionShown();
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
  filterSelect.addEventListener('change', () => {
    keepSelectionShown();
    renderList();
    renderDetails();
  });
  refreshButton.addEventListener('click', () => {
    setStatus('');
    loadOrders();
  });
  document.addEventListener('keydown', (event) => {
    // Not while typing in a field, so a half-written note or time is not lost by accident.
    const typing = event.target.closest && event.target.closest('input, textarea, select');
    if (event.key === 'Escape' && selectedId && !typing) closeDetails();
  });
  try {
    const config = await getJson('/api/config');
    setLabels(config.lists);
  } catch {
    // Labels are optional: codes are shown instead.
  }
  await loadOrders();
}

if (session) start();
