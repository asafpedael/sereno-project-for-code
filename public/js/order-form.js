// Order form: four steps in one page, then the "Request received" screen.
// Form values live in the page (the step sections are only hidden), so Back never loses data.
import { getJson, postJson } from './api.js';
import { el, clear } from './dom.js';
import { formatTimeIL, formatDateIL, formatDateTimeIL, isSameDayIL, toIsraelInputs } from './time.js';
import { meetingTime } from './meeting-time.js';

const STEPS = 4;
const SEARCH_DELAY_MS = 300;
const PHONE_RE = /^[0-9+\-() ]{7,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/;

const $ = (id) => document.getElementById(id);

const state = {
  step: 1,
  flight: null, // { id, flight_no, airline, destination, departure_at }
  manual: false, // true when the customer types the flight instead of choosing it
  submitting: false,
};

const form = $('order-form');
const searchInput = $('flight-search');
const resultsBox = $('flight-results');
const searchStatus = $('flight-status');
const departureInput = $('departure-time');
const travelersInput = $('travelers');
const bagsInput = $('bags');
const btnBack = $('btn-back');
const btnNext = $('btn-next');
const btnNextLabel = $('btn-next-label');
const formError = $('form-error');

// ---------- Field errors ----------

function showFieldError(fieldId, errorId, inputs, message) {
  const field = $(fieldId);
  const error = $(errorId);
  field.classList.add('is-invalid');
  error.textContent = message;
  error.hidden = false;
  for (const input of inputs) input.setAttribute('aria-invalid', 'true');
}

function clearFieldError(fieldId, errorId, inputs) {
  $(fieldId).classList.remove('is-invalid');
  const error = $(errorId);
  error.textContent = '';
  error.hidden = true;
  for (const input of inputs) input.removeAttribute('aria-invalid');
}

function showFormError(message) {
  formError.textContent = message;
  formError.hidden = false;
}

function clearFormError() {
  formError.textContent = '';
  formError.hidden = true;
}

// ---------- Step 1: flight search ----------

let searchTimer = null;
let searchCounter = 0;

function flightLabel(flight) {
  return `${flight.flight_no} · ${flight.destination}`;
}

function renderFlights(flights) {
  clear(resultsBox);
  for (const flight of flights) {
    const selected = state.flight && state.flight.id === flight.id;
    const button = el('button', {
      className: 'option',
      attrs: { type: 'button', 'aria-pressed': selected ? 'true' : 'false', 'data-flight-id': flight.id },
    },
    el('span', {},
      el('span', { className: 'option__title' }, flightLabel(flight)),
      el('span', { className: 'option__sub' }, flight.airline || '')),
    el('span', { className: 'option__aside' }, formatDateTimeIL(flight.departure_at)));
    button.addEventListener('click', () => selectFlight(flight));
    resultsBox.append(button);
  }
  resultsBox.hidden = flights.length === 0;
}

async function searchFlights() {
  const requestId = ++searchCounter;
  const text = searchInput.value.trim();
  searchStatus.textContent = 'Loading flights…';
  try {
    const data = await getJson(`/api/flights?q=${encodeURIComponent(text)}`);
    if (requestId !== searchCounter) return; // a newer search has started
    renderFlights(data.flights);
    searchStatus.textContent = data.flights.length === 0
      ? 'No flights found. Try another flight number or destination.'
      : '';
  } catch (err) {
    if (requestId !== searchCounter) return;
    renderFlights([]);
    searchStatus.textContent = 'Could not load flights. Please try again.';
  }
}

// Choosing a flight closes the list and shows the choice in the search box.
// Typing in the box again reopens the list (and clears the choice).
function selectFlight(flight) {
  state.flight = flight;
  departureInput.value = formatDateTimeIL(flight.departure_at);
  searchInput.value = `${flightLabel(flight)} · ${formatDateIL(flight.departure_at)}`;
  searchCounter++; // ignore any search still on its way
  clearTimeout(searchTimer);
  resultsBox.hidden = true;
  searchStatus.textContent = `Selected: ${flightLabel(flight)}, ${formatDateTimeIL(flight.departure_at)}.`;
  clearFieldError('field-flight', 'flight-error', [searchInput]);
  updateMeetingTime();
}

function clearSelectedFlight() {
  state.flight = null;
  departureInput.value = '';
  updateMeetingTime();
}

searchInput.addEventListener('input', () => {
  if (state.flight) clearSelectedFlight();
  clearTimeout(searchTimer);
  searchTimer = setTimeout(searchFlights, SEARCH_DELAY_MS);
});
// Enter in the search box searches now instead of moving to the next step.
searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    if (state.flight) return; // a flight is chosen; Enter does nothing until the text changes
    clearTimeout(searchTimer);
    searchFlights();
  }
});

// ---------- Step 1: manual flight entry (same rules as the server) ----------

const manualNoInput = $('manual-flight-no');
const manualDateInput = $('manual-flight-date');
const MANUAL_NO_RE = /^[A-Za-z0-9 -]+$/;
const MAX_DAYS_AHEAD = 365;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "LY315" from "ly 315" (upper case, spaces and '-' removed).
function normalizeFlightNo(text) {
  return text.replace(/[ -]/g, '').toUpperCase();
}

// "YYYY-MM-DD" moved by a number of days (plain calendar dates, no time zone).
function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// "12 Dec 2026" from "2026-12-12".
function formatDateOnly(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function isRealDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function manualDateLimits() {
  const today = toIsraelInputs(new Date()).date;
  return { min: today, max: addDays(today, MAX_DAYS_AHEAD) };
}

function setManualMode(manual) {
  state.manual = manual;
  $('flight-list-mode').hidden = manual;
  $('flight-manual-mode').hidden = !manual;
  if (manual) {
    clearSelectedFlight();
    searchInput.value = '';
    searchStatus.textContent = '';
    resultsBox.hidden = true;
    clearFieldError('field-flight', 'flight-error', [searchInput]);
    const { min, max } = manualDateLimits();
    manualDateInput.min = min;
    manualDateInput.max = max;
    manualNoInput.focus();
  } else {
    manualNoInput.value = '';
    manualDateInput.value = '';
    clearFieldError('field-flight-no', 'flight-no-error', [manualNoInput]);
    clearFieldError('field-flight-date', 'flight-date-error', [manualDateInput]);
    searchFlights();
    searchInput.focus();
  }
}

$('btn-manual').addEventListener('click', () => setManualMode(true));
$('btn-search').addEventListener('click', () => setManualMode(false));
manualNoInput.addEventListener('input', () => clearFieldError('field-flight-no', 'flight-no-error', [manualNoInput]));
manualDateInput.addEventListener('input', () => clearFieldError('field-flight-date', 'flight-date-error', [manualDateInput]));

// Returns the problem inputs (empty when both fields are fine).
function validateManualFlight() {
  const problems = [];
  const raw = manualNoInput.value;
  const normalized = normalizeFlightNo(raw);
  let noError = null;
  if (raw.trim() === '') noError = 'Please enter your flight number.';
  else if (!MANUAL_NO_RE.test(raw) || normalized.length < 2 || normalized.length > 10) {
    noError = 'Enter a flight number with letters and digits only.';
  }
  if (noError) {
    showFieldError('field-flight-no', 'flight-no-error', [manualNoInput], noError);
    problems.push(manualNoInput);
  }

  const date = manualDateInput.value;
  const { min, max } = manualDateLimits();
  let dateError = null;
  if (!isRealDate(date)) dateError = 'Please choose your departure date.';
  else if (date < min) dateError = 'Choose a date from today on.';
  else if (date > max) dateError = 'Choose a date within the next 12 months.';
  if (dateError) {
    showFieldError('field-flight-date', 'flight-date-error', [manualDateInput], dateError);
    problems.push(manualDateInput);
  }
  return problems;
}

// ---------- Step 2: travellers, bags, services, meeting time ----------

const LIMITS = { travelers: { min: 1, max: 10 }, bags: { min: 0, max: 10 } };

// Returns the whole number in the box, or null if it is empty, not whole, or out of range.
function readCount(name) {
  const input = $(name);
  const raw = input.value.trim();
  if (!/^\d{1,2}$/.test(raw)) return null;
  const value = Number(raw);
  const { min, max } = LIMITS[name];
  return value >= min && value <= max ? value : null;
}

function updateStepperButtons(name) {
  const input = $(name);
  const value = Number(input.value);
  const { min, max } = LIMITS[name];
  const [minus, plus] = form.querySelectorAll(`[data-target="${name}"]`);
  minus.disabled = !(Number.isFinite(value) && value > min);
  plus.disabled = Number.isFinite(value) && value >= max;
}

function updateMeetingTime() {
  const panel = $('meeting-panel');
  const timeEl = $('meeting-time');
  const dateEl = $('meeting-date');
  const travelers = readCount('travelers');
  const bags = readCount('bags');
  // A typed flight has no known departure yet: the box shows a note instead of a time.
  const manual = state.manual;
  timeEl.hidden = manual;
  $('meeting-note').hidden = manual;
  $('meeting-manual').hidden = !manual;
  if (manual) {
    dateEl.hidden = true;
    panel.hidden = false;
    return;
  }
  if (!state.flight || travelers === null || bags === null) {
    panel.hidden = true;
    return;
  }
  const departure = new Date(state.flight.departure_at);
  const meeting = meetingTime(departure, travelers, bags);
  timeEl.textContent = formatTimeIL(meeting);
  if (isSameDayIL(meeting, departure)) {
    dateEl.hidden = true;
    dateEl.textContent = '';
  } else {
    dateEl.textContent = `${formatDateIL(meeting)} (day before departure)`;
    dateEl.hidden = false;
  }
  panel.hidden = false;
}

for (const button of form.querySelectorAll('.stepper__btn')) {
  button.addEventListener('click', () => {
    const name = button.dataset.target;
    const input = $(name);
    const { min, max } = LIMITS[name];
    const current = Number.parseInt(input.value, 10);
    const base = Number.isFinite(current) ? current : min;
    input.value = String(Math.min(max, Math.max(min, base + Number(button.dataset.delta))));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

for (const name of ['travelers', 'bags']) {
  $(name).addEventListener('input', () => {
    updateStepperButtons(name);
    if (readCount(name) !== null) clearFieldError(`field-${name}`, `${name}-error`, [$(name)]);
    updateMeetingTime();
  });
}

function selectedServices() {
  return [...form.querySelectorAll('input[name="services"]:checked')].map((input) => input.value);
}

// ---------- Step 3 and 4 inputs ----------

function selectedEscort() {
  const checked = form.querySelector('input[name="escort_scope"]:checked');
  return checked ? checked.value : null;
}

for (const radio of form.querySelectorAll('input[name="escort_scope"]')) {
  radio.addEventListener('change', () => clearFieldError('field-escort', 'escort-error', []));
}

const DETAIL_FIELDS = [
  ['full-name', 'field-full-name', 'full-name-error'],
  ['phone', 'field-phone', 'phone-error'],
  ['email', 'field-email', 'email-error'],
  ['notes', 'field-notes', 'notes-error'],
];
for (const [inputId, fieldId, errorId] of DETAIL_FIELDS) {
  $(inputId).addEventListener('input', () => clearFieldError(fieldId, errorId, [$(inputId)]));
}
// Consent (Milestone 10): ticking the box clears its error.
const ackInput = $('approval-ack');
ackInput.addEventListener('change', () => {
  if (ackInput.checked) clearFieldError('field-ack', 'ack-error', [ackInput]);
});

// ---------- Validation per step (same rules as the server) ----------

function charLength(text) {
  return Array.from(text).length;
}

const STEP_FIELDS = {
  1: [
    ['field-flight', 'flight-error', () => [searchInput]],
    ['field-flight-no', 'flight-no-error', () => [manualNoInput]],
    ['field-flight-date', 'flight-date-error', () => [manualDateInput]],
  ],
  2: [['field-travelers', 'travelers-error', () => [travelersInput]], ['field-bags', 'bags-error', () => [bagsInput]]],
  3: [['field-escort', 'escort-error', () => []]],
  4: [
    ...DETAIL_FIELDS.map(([inputId, fieldId, errorId]) => [fieldId, errorId, () => [$(inputId)]]),
    ['field-ack', 'ack-error', () => [ackInput]],
  ],
};

function validateStep(step) {
  const problems = []; // [focusTarget]
  // Start clean, so only the current problems are shown.
  for (const [fieldId, errorId, inputs] of STEP_FIELDS[step]) clearFieldError(fieldId, errorId, inputs());

  if (step === 1 && state.manual) {
    problems.push(...validateManualFlight());
  } else if (step === 1 && !state.flight) {
    showFieldError('field-flight', 'flight-error', [searchInput], 'Please select your flight from the list.');
    problems.push(searchInput);
  }

  if (step === 2) {
    if (readCount('travelers') === null) {
      showFieldError('field-travelers', 'travelers-error', [travelersInput], 'Enter a whole number from 1 to 10.');
      problems.push(travelersInput);
    }
    if (readCount('bags') === null) {
      showFieldError('field-bags', 'bags-error', [bagsInput], 'Enter a whole number from 0 to 10.');
      problems.push(bagsInput);
    }
  }

  if (step === 3 && !selectedEscort()) {
    showFieldError('field-escort', 'escort-error', [], 'Please choose an escort scope.');
    problems.push(form.querySelector('input[name="escort_scope"]'));
  }

  if (step === 4) {
    const name = $('full-name').value.trim();
    if (charLength(name) < 2 || charLength(name) > 80) {
      showFieldError('field-full-name', 'full-name-error', [$('full-name')],
        name ? 'Full name must be 2 to 80 characters.' : 'Please enter your full name.');
      problems.push($('full-name'));
    }
    const phone = $('phone').value.trim();
    if (!PHONE_RE.test(phone) || (phone.match(/\d/g) || []).length < 7) {
      showFieldError('field-phone', 'phone-error', [$('phone')],
        phone ? 'Enter a valid phone number (digits, +, -, spaces).' : 'Please enter your phone number.');
      problems.push($('phone'));
    }
    const email = $('email').value.trim();
    if (email.length > 254 || !EMAIL_RE.test(email)) {
      showFieldError('field-email', 'email-error', [$('email')],
        email ? 'Enter a full email address.' : 'Please enter your email address.');
      problems.push($('email'));
    }
    if (charLength($('notes').value.trim()) > 500) {
      showFieldError('field-notes', 'notes-error', [$('notes')], 'Notes must be 500 characters or fewer.');
      problems.push($('notes'));
    }
    // Last, so a wrong contact field still gets the focus first.
    if (!ackInput.checked) {
      showFieldError('field-ack', 'ack-error', [ackInput], 'Please confirm to send your request.');
      problems.push(ackInput);
    }
  }

  if (problems.length > 0) {
    problems[0].focus();
    return false;
  }
  return true;
}

// ---------- Step 4: review (M6, plan D3, D4) ----------

// Same text as data/lists.json (the escort labels are also written in the page).
const ESCORT_LABELS = { full: 'Full (to the gate)', partial: 'Partial (to security)' };

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function flightSummary() {
  if (state.manual) {
    const date = isRealDate(manualDateInput.value) ? ` · ${formatDateOnly(manualDateInput.value)}` : '';
    return `${normalizeFlightNo(manualNoInput.value)}${date}`;
  }
  return state.flight ? `${flightLabel(state.flight)} · ${formatDateTimeIL(state.flight.departure_at)}` : '';
}

// The review shows the page's own state, the same values the submit sends.
function renderReview() {
  $('review-flight').textContent = flightSummary();
  $('review-travellers').textContent =
    `${plural(readCount('travelers'), 'traveller')} · ${plural(readCount('bags'), 'bag')}`;
  const services = [...form.querySelectorAll('input[name="services"]:checked')]
    .map((input) => input.closest('label').textContent.trim());
  $('review-services').textContent = services.length ? services.join(', ') : 'None';
  $('review-escort').textContent = ESCORT_LABELS[selectedEscort()] || '';
}

// "Edit" opens that step with every value kept; Next walks forward again to step 4.
for (const button of form.querySelectorAll('[data-edit-step]')) {
  button.addEventListener('click', () => {
    if (!state.submitting) showStep(Number(button.dataset.editStep));
  });
}

// ---------- Navigation ----------

function showStep(step, { moveFocus = true } = {}) {
  state.step = step;
  for (const section of form.querySelectorAll('.form-step')) {
    section.hidden = Number(section.dataset.step) !== step;
  }
  for (const item of form.querySelectorAll('.progress__step')) {
    const n = Number(item.dataset.progress);
    item.classList.toggle('is-done', n < step);
    item.classList.toggle('is-current', n === step);
    if (n === step) item.setAttribute('aria-current', 'step');
    else item.removeAttribute('aria-current');
  }
  $('step-counter').textContent = `Step ${step} of ${STEPS}`;
  btnBack.hidden = step === 1;
  btnNextLabel.textContent = step === STEPS ? 'Submit request' : 'Next';
  clearFormError();
  if (step === 2) updateMeetingTime();
  if (step === 4) renderReview();
  if (moveFocus) {
    window.scrollTo(0, 0);
    $(`heading-${step}`).focus();
  }
}

btnBack.addEventListener('click', () => {
  if (state.step > 1 && !state.submitting) showStep(state.step - 1);
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (state.submitting) return;
  clearFormError();
  if (!validateStep(state.step)) return;
  if (state.step < STEPS) showStep(state.step + 1);
  else submitOrder();
});

// ---------- Submit and "Request received" ----------

async function submitOrder() {
  state.submitting = true;
  btnNext.disabled = true;
  btnBack.disabled = true;
  btnNextLabel.textContent = 'Sending…';

  const payload = {
    flight_id: state.manual ? null : state.flight.id,
    flight_no: state.manual ? manualNoInput.value.trim() : state.flight.flight_no,
    flight_date: state.manual ? manualDateInput.value : null,
    travelers: readCount('travelers'),
    bags: readCount('bags'),
    services: selectedServices(),
    escort_scope: selectedEscort(),
    full_name: $('full-name').value.trim(),
    phone: $('phone').value.trim(),
    email: $('email').value.trim(),
    notes: $('notes').value.trim(),
    approval_ack: ackInput.checked, // the server refuses anything but true (FR-44)
    website: $('website').value,
  };

  try {
    const result = await postJson('/api/submit-order', payload);
    showReceived(result.reference);
  } catch (err) {
    // 429 and 400 carry a plain message from the server; anything else gets a generic one.
    showFormError(err.message);
    state.submitting = false;
    btnNext.disabled = false;
    btnBack.disabled = false;
    btnNextLabel.textContent = 'Submit request';
  }
}

function showReceived(reference) {
  const flight = state.flight;
  $('received-reference').textContent = reference;
  $('received-flight').textContent = state.manual
    ? `${normalizeFlightNo(manualNoInput.value)} · ${formatDateOnly(manualDateInput.value)}`
    : `${flightLabel(flight)} · ${formatDateTimeIL(flight.departure_at)}`;
  form.hidden = true;
  form.reset();
  state.flight = null;
  $('step-counter').hidden = true;
  $('received').hidden = false;
  document.title = 'Request received · Sereno';
  window.scrollTo(0, 0);
  $('heading-received').focus();
}

// ---------- Start ----------

showStep(1, { moveFocus: false });
updateStepperButtons('travelers');
updateStepperButtons('bags');
searchFlights();
