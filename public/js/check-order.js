// Order lookup for the customer (Milestone 14, FR-47): order number + email -> the order,
// shown as the boarding-pass card. Nothing is remembered in the browser.
import { postJson } from './api.js';
import { el, clear } from './dom.js';
import { formatTimeIL, formatDateIL, isSameDayIL } from './time.js';
import { boardingPass } from './boarding-pass.js';

const $ = (id) => document.getElementById(id);
const ORDER_NUMBER_RE = /^[0-9A-F]{8}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/;
const NUMBER_MESSAGE = 'Please enter the 8-character order number.';
const EMAIL_MESSAGE = 'Please enter a valid email address.';

const form = $('lookup-form');
const numberInput = $('order-number');
const emailInput = $('lookup-email');
const submitBtn = $('lookup-submit');
const submitLabel = $('lookup-submit-label');
const formError = $('lookup-error');
const result = $('lookup-result');

// Heading, line and tag per customer status (plan D3).
const STATUS_TEXT = {
  pending: { heading: 'Awaiting manager review', line: 'We will email you the decision.', tag: 'Pending', tagClass: 'tag tag-pending' },
  check_email: { heading: 'Please check your email', line: 'We sent you an email asking you to confirm your flight details.', tag: 'Pending', tagClass: 'tag tag-pending' },
  approved: { heading: 'Your escort is confirmed', line: '', tag: 'Approved', tagClass: 'tag tag-approved' },
  rejected: { heading: 'Not approved', line: 'We’re sorry, we could not approve this booking. Please check your email for details.', tag: 'Not approved', tagClass: 'tag tag-rejected' },
  completed: { heading: 'Completed', line: 'Thank you for travelling with Sereno.', tag: 'Completed', tagClass: 'tag tag-pending' },
};
const CHANGE_LINE = 'Your flight time has changed. We will email you your updated meeting time.';

function setFieldError(input, fieldId, errorId, message) {
  const error = $(errorId);
  $(fieldId).classList.toggle('is-invalid', Boolean(message));
  error.textContent = message || '';
  error.hidden = !message;
  if (message) input.setAttribute('aria-invalid', 'true');
  else input.removeAttribute('aria-invalid');
}

function showFormError(message) {
  formError.textContent = message || '';
  formError.hidden = !message;
}

// Same rules and messages as the server (lib/validate.js, validateLookupBody).
function validate() {
  const number = numberInput.value.trim().toUpperCase();
  const email = emailInput.value.trim();
  const numberError = ORDER_NUMBER_RE.test(number) ? '' : NUMBER_MESSAGE;
  const emailError = email.length <= 254 && EMAIL_RE.test(email) ? '' : EMAIL_MESSAGE;
  setFieldError(numberInput, 'field-order-number', 'order-number-error', numberError);
  setFieldError(emailInput, 'field-lookup-email', 'lookup-email-error', emailError);
  if (numberError) numberInput.focus();
  else if (emailError) emailInput.focus();
  return !numberError && !emailError;
}

// The stub's meeting time: the approved time (with the date when it is not the departure day),
// "Being updated" during a flight change, "After approval" before a decision, nothing when rejected.
function meetingText(order) {
  if (order.status === 'approved' && order.flight_change_pending) return 'Being updated';
  if (!order.meeting_time) return order.status === 'rejected' ? '' : 'After approval';
  const time = formatTimeIL(order.meeting_time);
  const departure = order.flight.departure_at;
  return departure && !isSameDayIL(order.meeting_time, departure)
    ? `${formatDateIL(order.meeting_time)}, ${time}` : time;
}

function item(label, value) {
  return value ? el('div', { className: 'lookup-items__item' },
    el('dt', { className: 'pass__key' }, label), el('dd', {}, value)) : null;
}

// A typed date "YYYY-MM-DD" shown like the other dates ("Thu 10 Dec"), read at noon UTC so the
// Israel day is the same.
function typedDateText(dateKey) {
  return dateKey ? formatDateIL(`${dateKey}T12:00:00Z`) : '';
}

function showResult(order) {
  const text = STATUS_TEXT[order.status] || STATUS_TEXT.pending;
  $('result-number').textContent = `Order ${order.reference}`;
  $('result-heading').textContent = text.heading;
  const line = order.status === 'approved' && order.flight_change_pending ? CHANGE_LINE : text.line;
  $('result-line').textContent = line;
  $('result-line').hidden = !line;

  const pass = $('result-pass');
  clear(pass);
  pass.append(boardingPass({
    flight: order.flight.destination ? order.flight : null,
    typedNo: order.flight.flight_no || '',
    typedDate: typedDateText(order.flight.date),
    stub: [['Meeting time', meetingText(order), Boolean(order.meeting_time)]],
    tag: el('span', { className: `${text.tagClass} pass__tag` }, text.tag),
  }));

  $('result-point').hidden = !order.meeting_point;
  $('result-point-value').textContent = order.meeting_point || '';

  const items = $('result-items');
  clear(items);
  items.append(...[
    item('Travellers · Bags', `${order.travelers} · ${order.bags}`),
    item('Escort', order.escort),
    // Milestone 16 (plan D14): never the names (the server does not send them).
    item('Escort language', order.escort_language),
    item('Getting there', order.arrival_method),
    item('Services', order.services),
    item('Estimated price', order.estimated_price),
  ].filter(Boolean));

  form.hidden = true;
  result.hidden = false;
  document.title = `Order ${order.reference} · Sereno`;
  window.scrollTo(0, 0);
  $('result-heading').focus();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  showFormError('');
  if (!validate()) return;
  submitBtn.disabled = true;
  submitLabel.textContent = 'Checking…';
  try {
    const data = await postJson('/api/order-lookup', {
      order_number: numberInput.value.trim().toUpperCase(),
      email: emailInput.value.trim(),
      website: $('website').value,
    });
    showResult(data.order);
  } catch (err) {
    // 404 and 400 carry a plain message from the server; anything else gets a generic one.
    showFormError(err.message);
  } finally {
    submitBtn.disabled = false;
    submitLabel.textContent = 'Check order';
  }
});

$('lookup-again').addEventListener('click', () => {
  form.reset();
  setFieldError(numberInput, 'field-order-number', 'order-number-error', '');
  setFieldError(emailInput, 'field-lookup-email', 'lookup-email-error', '');
  showFormError('');
  result.hidden = true;
  form.hidden = false;
  document.title = 'Check your order · Sereno';
  numberInput.focus();
});
