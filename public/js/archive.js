// Order archive (M7): past orders for the manager (every status) and the field agent
// (approved and completed only; the server decides what each role sees). Search, status,
// departure dates and 50 rows per page. Desktop screen. All data text is set with textContent.
// M8: summary cards from the reply's "stats" (per role), the "Returning" tag for the manager,
// and "View": a side panel with the order (manager: full details and "Manager notes";
// agent: only the fields of his card, read-only).
// M9: the manager changes the field agent of an approved order in the panel ("Save agent");
// the agent sees only his and unassigned orders, with "My orders only" (on by default).
import { getJson } from './api.js';
import { el, clear } from './dom.js';
import { formatTimeIL, formatDateIL, formatDayMonthIL, isSameDayIL } from './time.js';
import { requireRole, bindLogout, staffGet, staffPost } from './session.js';
import { showingText, totalPages, pageNumbers, GAP } from './paging.js';
import {
  returningTag, orderTag, dataItem, detailsGrid, aiPanel, missingFlightPanel, flightChangePanel,
  customerPanel, clearHistory, notesField, setLabels, servicesText, escortText, languageText, arrivalText,
  loadAgents, agentField, agentNameFor, NOT_ASSIGNED,
} from './order-details.js';

const GENERIC_MESSAGE = 'Orders could not be loaded. Please try again.';
const DATES_IN_ORDER = 'The From date must not be after the To date.';
const SEARCH_DELAY_MS = 300;

const STATUS_TAGS = {
  pending: { label: 'Pending', className: 'tag tag-pending' },
  approved: { label: 'Approved', className: 'tag tag-approved' },
  rejected: { label: 'Rejected', className: 'tag tag-rejected' },
  needs_clarification: { label: 'Needs clarification', className: 'tag tag-dark' },
  completed: { label: 'Completed', className: 'tag tag-approved' },
};

// Per role: the header tabs, the role name and the statuses in the menu (plan D2, D7).
const ROLES = {
  manager: {
    home: { label: 'Approvals', href: '/staff/manager.html' },
    name: 'Manager',
    statuses: ['pending', 'approved', 'rejected', 'needs_clarification', 'completed'],
    // M8 plan D4: [key in stats, card label]
    cards: [['total', 'Total orders'], ['approved', 'Approved'], ['returning_customers', 'Returning customers'], ['rejected', 'Rejected']],
  },
  agent: {
    home: { label: 'Orders', href: '/staff/agent.html' },
    name: 'Field agent',
    statuses: ['approved', 'completed'],
    // M8 plan D5: no Rejected (always 0) and no returning information for the agent.
    cards: [['total', 'Total orders'], ['approved', 'Approved'], ['completed', 'Completed']],
  },
};

const session = requireRole(['manager', 'agent']);

const form = document.getElementById('filters');
const searchInput = document.getElementById('q');
const statusSelect = document.getElementById('status');
const fromInput = document.getElementById('from');
const toInput = document.getElementById('to');
const filterError = document.getElementById('filter-error');
const listError = document.getElementById('list-error');
const listLoading = document.getElementById('list-loading');
const listEmpty = document.getElementById('list-empty');
const table = document.getElementById('table');
const rowsNode = document.getElementById('rows');
const showingNode = document.getElementById('showing');
const pagerNode = document.getElementById('pager');
const statsNode = document.getElementById('stats');
const panelNode = document.getElementById('order-panel');
const mineBox = document.getElementById('mine');

let agents = null; // M9: manager only, the names for the panel
let page = 1;
let requestId = 0;
let searchTimer = null;
let shownOrders = []; // the rows of the current page
let openId = null; // the order shown in the panel

// ---------- Header ----------

function drawHeader(role) {
  const config = ROLES[role];
  document.getElementById('brand-link').href = config.home.href;
  document.getElementById('role-label').textContent = config.name;
  const tabs = document.getElementById('tabs');
  tabs.replaceChildren(
    el('a', { className: 'tab', attrs: { href: config.home.href } }, config.home.label),
    el('a', { className: 'tab', attrs: { href: '/staff/archive.html', 'aria-current': 'page' } }, 'Archive'),
  );
  for (const code of config.statuses) {
    statusSelect.append(el('option', { attrs: { value: code } }, STATUS_TAGS[code].label));
  }
}

// ---------- Summary cards (M8, plan D4-D6) ----------

// stats: the reply's "stats", or null to show "–" (an error, or From after To).
function drawStats(stats) {
  const cards = ROLES[session.role].cards;
  statsNode.classList.toggle('archive-stats__list--three', cards.length === 3);
  statsNode.replaceChildren(...cards.map(([key, label]) => {
    const value = stats && Number.isFinite(stats[key]) ? String(stats[key]) : '–';
    return el('li', { className: 'archive-stat' },
      el('span', { className: 'archive-stat__number' }, value),
      el('span', { className: 'archive-stat__label' }, ` ${label}`));
  }));
}

// ---------- Table ----------

function statusTag(status) {
  const tag = STATUS_TAGS[status] || { label: status, className: 'tag tag-pending' };
  return el('span', { className: tag.className }, tag.label);
}

function flightText(flight) {
  return flight.destination ? `${flight.flight_no} ${flight.destination}` : flight.flight_no;
}

function departureText(flight) {
  if (!flight.departure_at) return '–';
  return `${formatDayMonthIL(flight.departure_at)} ${formatTimeIL(flight.departure_at)}`;
}

// The meeting time; its date is added when it is not the departure day (e.g. 23:40 · 30 Nov).
function meetingText(order) {
  const meeting = order.final_time;
  if (!meeting) return '–';
  const departure = order.flight.departure_at;
  if (departure && isSameDayIL(meeting, departure)) return formatTimeIL(meeting);
  return `${formatTimeIL(meeting)} · ${formatDayMonthIL(meeting)}`;
}

function row(order) {
  const open = order.id === openId;
  const view = el('button', {
    className: 'link-button archive-table__view',
    attrs: {
      type: 'button', 'aria-label': `View order ${order.reference}`,
      'aria-controls': 'order-panel', 'aria-expanded': String(open), 'data-id': order.id,
    },
  }, 'View');
  view.addEventListener('click', () => openOrder(order.id));
  return el('tr', { className: open ? 'is-selected' : '' },
    el('td', { className: 'archive-table__ref' }, order.reference),
    el('td', { className: 'archive-table__customer' }, order.customer.full_name,
      // Manager rows only: the agent's rows never carry the flag (ADR-22, plan D9).
      order.is_returning_customer ? returningTag() : null),
    el('td', {}, flightText(order.flight)),
    el('td', {}, departureText(order.flight)),
    el('td', { className: 'archive-table__time' }, meetingText(order)),
    el('td', {}, statusTag(order.status)),
    el('td', { className: 'archive-table__action' }, view));
}

function drawPager(current, pages) {
  clear(pagerNode);
  if (pages <= 1) return;
  const button = (label, target, { name, currentPage = false, disabled = false } = {}) => {
    const attrs = { type: 'button' };
    if (name) attrs['aria-label'] = name;
    if (currentPage) attrs['aria-current'] = 'page';
    const b = el('button', { className: 'pager__button', attrs }, label);
    b.disabled = disabled;
    b.addEventListener('click', () => {
      page = target;
      load({ focusTable: true });
    });
    return el('li', {}, b);
  };
  pagerNode.append(button('‹', current - 1, { name: 'Previous page', disabled: current <= 1 }));
  for (const n of pageNumbers(current, pages)) {
    if (n === GAP) pagerNode.append(el('li', { className: 'pager__gap', attrs: { 'aria-hidden': 'true' } }, GAP));
    else pagerNode.append(button(String(n), n, { name: `Page ${n}`, currentPage: n === current }));
  }
  pagerNode.append(button('›', current + 1, { name: 'Next page', disabled: current >= pages }));
}

function draw(data) {
  shownOrders = data.orders;
  clear(rowsNode);
  data.orders.forEach((order) => rowsNode.append(row(order)));
  listEmpty.hidden = data.orders.length > 0;
  drawStats(data.stats);
  table.hidden = data.orders.length === 0;
  showingNode.textContent = showingText(data.page, data.page_size, data.total);
  drawPager(data.page, totalPages(data.page_size, data.total));
}

// ---------- Loading ----------

// Query string with %20 for spaces (never "+").
function queryString() {
  const params = { view: 'archive', page: String(page) };
  const q = searchInput.value.trim();
  if (q) params.q = q;
  if (statusSelect.value) params.status = statusSelect.value;
  if (fromInput.value) params.from = fromInput.value;
  if (toInput.value) params.to = toInput.value;
  if (session.role === 'agent' && mineBox.checked) params.mine = '1';
  return Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
}

function datesInOrder() {
  const ok = !(fromInput.value && toInput.value && fromInput.value > toInput.value);
  filterError.textContent = ok ? '' : DATES_IN_ORDER;
  filterError.hidden = ok;
  for (const input of [fromInput, toInput]) {
    if (ok) input.removeAttribute('aria-invalid');
    else input.setAttribute('aria-invalid', 'true');
  }
  return ok;
}

// Only the newest request is drawn; an older, slower answer is ignored (plan D11).
async function load({ focusTable = false } = {}) {
  const id = ++requestId; // also drops any answer still on its way
  closePanel(); // the open order may not be in the new rows (plan D8)
  clearHistory();
  if (!datesInOrder()) {
    // Nothing to show until the dates are fixed.
    clear(rowsNode);
    clear(pagerNode);
    table.hidden = true;
    showingNode.textContent = '';
    drawStats(null);
    listEmpty.hidden = true;
    listError.hidden = true;
    listLoading.hidden = true;
    return;
  }
  listError.hidden = true;
  listLoading.hidden = false;
  try {
    const data = await staffGet(`/api/orders?${queryString()}`);
    if (id !== requestId) return;
    draw(data);
    if (focusTable) table.focus();
  } catch (err) {
    if (id !== requestId || err.status === 401) return; // 401: session.js opens the sign-in page
    listError.textContent = err.status === 400 && err.message ? err.message : GENERIC_MESSAGE;
    drawStats(null);
    listError.hidden = false;
  } finally {
    if (id === requestId) listLoading.hidden = true;
  }
}

// A new search or filter starts again at page 1.
function filtersChanged() {
  clearTimeout(searchTimer);
  page = 1;
  load();
}

// ---------- Order panel (M8, plan D8, D10-D12) ----------

function markRows() {
  for (const tr of rowsNode.querySelectorAll('tr')) {
    const button = tr.querySelector('.archive-table__view');
    const open = Boolean(button) && button.dataset.id === openId;
    tr.classList.toggle('is-selected', open);
    if (button) button.setAttribute('aria-expanded', String(open));
  }
}

function viewButton(id) {
  return [...rowsNode.querySelectorAll('.archive-table__view')].find((b) => b.dataset.id === id) || null;
}

function closePanel({ returnFocus = false } = {}) {
  if (!openId) return;
  const button = viewButton(openId);
  openId = null;
  clear(panelNode);
  panelNode.hidden = true;
  markRows();
  if (returnFocus && button) button.focus();
}

function openOrder(id) {
  const order = shownOrders.find((o) => o.id === id);
  if (!order) return;
  openId = id;
  markRows();
  drawPanel(order);
  panelNode.hidden = false;
  document.getElementById('panel-heading').focus();
  // Narrow screens: the panel sits above the table, so bring it into view.
  if (!window.matchMedia('(min-width: 1200px)').matches) panelNode.scrollIntoView({ block: 'start' });
}

function panelHead(order) {
  const close = el('button', {
    className: 'archive-panel__close',
    attrs: { type: 'button', 'aria-label': 'Close order details' },
  }, '×');
  close.addEventListener('click', () => closePanel({ returnFocus: true }));
  return el('div', { className: 'archive-panel__head' },
    el('h2', { className: 'h3', attrs: { id: 'panel-heading', tabindex: '-1' } }, `Order ${order.reference}`),
    el('div', { className: 'archive-panel__tags' },
      orderTag(order),
      order.is_returning_customer ? returningTag() : null,
      order.assigned_to_me ? assignedTag() : null,
      close));
}

// M9 (plan D13, O5): the agent's own orders.
function assignedTag() {
  return el('span', { className: 'tag tag-returning' }, 'Assigned to you');
}

// M9 (plan D12): "Field agent" with "Save agent" for an approved order (assign_agent).
function agentArea(order, message) {
  const field = agentField(agents, order.assigned_agent_id);
  const error = el('p', { className: 'field__error', attrs: { hidden: '' } });
  const save = el('button', { className: 'btn btn-small btn-secondary', attrs: { type: 'button' } }, 'Save agent');
  save.addEventListener('click', async () => {
    error.hidden = true;
    save.disabled = true;
    try {
      const data = await staffPost('/api/order-decision', { order_id: order.id, action: 'assign_agent', agent_id: field.value() });
      order.assigned_agent_id = data.order.assigned_agent_id || null;
      message.textContent = order.assigned_agent_id
        ? `Agent saved for order ${order.reference}.`
        : `Order ${order.reference} is now open to all agents.`;
    } catch (err) {
      if (err.status === 401) return;
      if (err.status === 409) {
        load(); // the order changed: reload the table (closes the panel)
        return;
      }
      error.textContent = err.message || 'Something went wrong. Please try again.';
      error.hidden = false;
    } finally {
      save.disabled = false;
    }
  });
  return el('div', { className: 'agent-area' }, field.node,
    el('div', { className: 'notes-field__actions' }, save), error);
}

// Manager (plan D10, D11): the Approvals details, read-only, plus the meeting time and the
// "Manager notes" box. No decision buttons: decisions stay on the Approvals screen.
function managerPanel(order) {
  const message = el('p', { className: 'archive-panel__status text-small', attrs: { role: 'status' } });
  // notesField updates order.manager_notes (the row object), so reopening shows the new note.
  const notes = notesField(order, (_notes, text) => { message.textContent = text; });
  let side = aiPanel(order);
  if (order.status === 'needs_clarification') side = missingFlightPanel(order);
  else if (order.flight_change_pending) side = flightChangePanel(order);
  const extra = [dataItem('Meeting time', meetingText(order))];
  // M9: a completed order shows who did it (read-only).
  if (order.status === 'completed') {
    extra.push(dataItem('Field agent', order.assigned_agent_id ? agentNameFor(order.assigned_agent_id, agents) : NOT_ASSIGNED));
  }
  panelNode.append(
    panelHead(order),
    detailsGrid(order, extra),
    el('div', { className: 'details-panels' },
      customerPanel(order, (id) => openId === id),
      side),
    notes.node,
    order.status === 'approved' ? agentArea(order, message) : null,
    message);
}

// Phone link: keep digits and a leading + only (as on the agent screen).
function telHref(phone) {
  const cleaned = String(phone).replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  return `tel:${cleaned}`;
}

function agentItem(label, value) {
  return el('div', {},
    el('span', { className: 'agent-card__label' }, label),
    el('span', { className: 'agent-card__value' }, value));
}

// Agent (plan D12): only the fields of his card (toAgentView, already in the row), read-only.
function agentPanel(order) {
  const meeting = order.final_time;
  const departure = order.flight.departure_at;
  let departureTime = '–';
  if (departure) {
    departureTime = meeting && isSameDayIL(meeting, departure)
      ? formatTimeIL(departure)
      : `${formatDateIL(departure)} ${formatTimeIL(departure)}`;
  }
  const card = el('div', { className: 'agent-card archive-panel__card' },
    el('div', { className: 'agent-card__top' },
      el('div', {},
        el('span', { className: 'agent-card__label' }, 'Meeting time'),
        el('span', { className: 'agent-card__time' }, meeting ? formatTimeIL(meeting) : '–'),
        el('span', { className: 'agent-card__date' }, meeting ? formatDateIL(meeting) : '')),
      el('div', { className: 'agent-card__departure' },
        el('span', { className: 'agent-card__label' }, 'Departure'),
        el('span', { className: 'agent-card__departure-time' }, departureTime))),
    el('div', { className: 'agent-card__person' },
      el('span', { className: 'agent-card__name' }, order.customer.full_name),
      el('a', { className: 'agent-card__phone', attrs: { href: telHref(order.customer.phone) } }, order.customer.phone)),
    // Milestone 16 (plan D13): the same names line and items as the agent's card.
    order.traveller_names
      ? el('div', { className: 'agent-card__also' },
        el('span', { className: 'agent-card__label' }, 'Also travelling'),
        el('span', { className: 'agent-card__value' }, order.traveller_names))
      : null,
    el('div', { className: 'agent-card__grid' },
      agentItem('Flight', flightText(order.flight)),
      // The short forms of the agent card: "–" for no services, "Full" for "Full (to the gate)".
      agentItem('Services', order.services.length ? servicesText(order) : '–'),
      agentItem('Travellers · Bags', `${order.travelers} · ${order.bags}`),
      agentItem('Escort', escortText(order).replace(/\s*\(.*\)\s*$/, '')),
      order.escort_language ? agentItem('Language', languageText(order)) : null,
      order.arrival_method ? agentItem('Getting there', arrivalText(order)) : null));
  if (order.manager_notes) {
    card.append(el('div', { className: 'agent-card__notes' },
      el('span', { className: 'agent-card__label' }, 'Manager notes'),
      el('span', { className: 'agent-card__value' }, order.manager_notes)));
  }
  panelNode.append(panelHead(order), card);
}

function drawPanel(order) {
  clear(panelNode);
  if (session.role === 'manager') managerPanel(order);
  else agentPanel(order);
}

async function start() {
  drawHeader(session.role);
  drawStats(null);
  bindLogout(document.getElementById('logout'));
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(filtersChanged, SEARCH_DELAY_MS);
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    filtersChanged();
  });
  for (const input of [statusSelect, fromInput, toInput]) input.addEventListener('change', filtersChanged);
  // M9 (plan D14, O2): "My orders only" for the agent, checked when the page opens.
  if (session.role === 'agent') {
    mineBox.checked = true;
    mineBox.closest('.archive__mine').hidden = false;
    mineBox.addEventListener('change', filtersChanged);
  }
  if (session.role === 'manager') {
    const list = await loadAgents(); // before the rows, so the panel has the names
    if (list !== null) agents = list;
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && openId) closePanel({ returnFocus: true });
  });
  try {
    const config = await getJson('/api/config');
    setLabels(config.lists);
  } catch {
    // Labels are optional: codes are shown instead.
  }
  load();
}

if (session) start();
