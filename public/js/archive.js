// Order archive (M7): past orders for the manager (every status) and the field agent
// (approved and completed only; the server decides what each role sees). Search, status,
// departure dates and 50 rows per page. Desktop screen. All data text is set with textContent.
import { el, clear } from './dom.js';
import { formatTimeIL, formatDayMonthIL, isSameDayIL } from './time.js';
import { requireRole, bindLogout, staffGet } from './session.js';
import { showingText, totalPages, pageNumbers, GAP } from './paging.js';

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
  },
  agent: {
    home: { label: 'Orders', href: '/staff/agent.html' },
    name: 'Field agent',
    statuses: ['approved', 'completed'],
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

let page = 1;
let requestId = 0;
let searchTimer = null;

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
  return el('tr', {},
    el('td', { className: 'archive-table__ref' }, order.reference),
    el('td', {}, order.customer.full_name),
    el('td', {}, flightText(order.flight)),
    el('td', {}, departureText(order.flight)),
    el('td', { className: 'archive-table__time' }, meetingText(order)),
    el('td', {}, statusTag(order.status)));
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
  clear(rowsNode);
  data.orders.forEach((order) => rowsNode.append(row(order)));
  listEmpty.hidden = data.orders.length > 0;
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
  if (!datesInOrder()) {
    // Nothing to show until the dates are fixed.
    clear(rowsNode);
    clear(pagerNode);
    table.hidden = true;
    showingNode.textContent = '';
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

function start() {
  drawHeader(session.role);
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
  load();
}

if (session) start();
