// Customer chat "Ask Sereno" (Milestone 15, FR-48), shared by the landing page, the order
// form and the order lookup page. Answers are always Asaf's text from data/faq.json (sent with
// /api/config): a tapped question is answered here; a typed one goes to /api/chat, which only
// returns the id of the matching question, or "none". Nothing is saved in the browser.
import { el, clear } from './dom.js';
import { getJson, postJson, ApiError } from './api.js';

const MAX_QUESTION = 200;
const COUNTER_FROM = 150;
const MAX_TYPED = 20; // typed questions per opening of the chat (plan D6)
const PHONE = window.matchMedia('(max-width: 599px)');
const LINKS = {
  'check-order': { href: '/check-order.html', label: 'Check your order' },
  book: { href: '/order.html', label: 'Book your escort' },
};
const ERROR_TEXT = 'Something went wrong. Please try again.';

const icon = () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', 'chat-launcher__icon');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M4 5h16v11H9l-5 4z');
  svg.append(path);
  return svg;
};

// ---------- the parts ----------

const launcher = el('button', {
  className: 'chat-launcher',
  // A small round button with the chat icon only (Asaf, 27.11.2026); the name is read out and
  // shown as a tooltip.
  attrs: {
    type: 'button', 'aria-expanded': 'false', 'aria-controls': 'chat-panel',
    'aria-label': 'Questions? Ask Sereno', title: 'Questions? Ask Sereno',
  },
}, icon());

const closeButton = el('button', { className: 'chat__close', attrs: { type: 'button', 'aria-label': 'Close chat' } });
const log = el('div', { className: 'chat__log', attrs: { role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions' } });
const input = el('input', {
  className: 'chat__input',
  attrs: { id: 'chat-question', type: 'text', maxlength: String(MAX_QUESTION), autocomplete: 'off', placeholder: 'Type your question', enterkeyhint: 'send' },
});
const website = el('input', { attrs: { type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' } });
const sendButton = el('button', { className: 'chat__send', attrs: { type: 'submit' } }, 'Send');
const counter = el('p', { className: 'chat__count', attrs: { id: 'chat-count', hidden: '' } });
const form = el('form', { className: 'chat__form', attrs: { novalidate: '' } },
  el('label', { className: 'visually-hidden', attrs: { for: 'chat-question' } }, 'Your question'),
  el('div', { className: 'visually-hidden', attrs: { 'aria-hidden': 'true' } }, website),
  el('div', { className: 'chat__row' }, input, sendButton),
  counter);
input.setAttribute('aria-describedby', 'chat-count');

const panel = el('section', {
  className: 'chat',
  attrs: { id: 'chat-panel', role: 'dialog', 'aria-labelledby': 'chat-title', hidden: '' },
},
el('div', { className: 'chat__head' },
  el('div', { className: 'chat__titles' },
    el('h2', { className: 'chat__title', attrs: { id: 'chat-title' } }, 'Ask Sereno'),
    el('p', { className: 'chat__note' }, "Answers from our service guide. Please don't type personal details.")),
  closeButton),
log,
form);

closeButton.append(el('span', { className: 'chat__close-x', attrs: { 'aria-hidden': 'true' } }));

// ---------- state ----------

let faq = null;
let loading = null;
let typed = 0;
let busy = false;

function scrollDown() {
  log.scrollTop = log.scrollHeight;
}

function bubble(who, ...children) {
  const node = el('div', { className: `chat__bubble chat__bubble--${who}` }, ...children);
  log.append(node);
  scrollDown();
  return node;
}

function linkButton(item) {
  const link = item.link && LINKS[item.link];
  if (!link || window.location.pathname === link.href) return null;
  return el('a', { className: 'chat__link', attrs: { href: link.href } }, link.label);
}

function questionChip(item) {
  const chip = el('button', { className: 'chat__chip', attrs: { type: 'button' } }, item.question);
  chip.addEventListener('click', () => askListed(item));
  return chip;
}

// The suggested questions, and a button that shows every question on the list (Asaf, 27.11.2026).
function chips() {
  const all = el('button', { className: 'chat__chip chat__chip--all', attrs: { type: 'button' } }, faq.all_label);
  all.addEventListener('click', showAll);
  return el('div', { className: 'chat__chips' }, ...faq.items.filter((item) => item.suggested).map(questionChip), all);
}

function showAll() {
  bubble('customer', faq.all_label);
  bubble('sereno', el('p', {}, faq.all_intro), el('div', { className: 'chat__chips' }, ...faq.items.map(questionChip)));
}

function showAnswer(item) {
  bubble('sereno', el('p', {}, item.answer), linkButton(item));
}

function showNoAnswer() {
  bubble('sereno', el('p', {}, faq.no_answer), chips());
}

// A tapped question: answered here, no request.
function askListed(item) {
  bubble('customer', item.question);
  showAnswer(item);
}

function updateCounter() {
  const length = Array.from(input.value).length;
  counter.hidden = length < COUNTER_FROM;
  counter.textContent = `${length} / ${MAX_QUESTION}`;
}

function reachLimit() {
  form.hidden = true;
  bubble('sereno', el('p', {}, faq.limit_reached), chips());
}

async function askTyped(question) {
  typed += 1;
  bubble('customer', question);
  const waiting = bubble('sereno', el('span', { className: 'chat__dots', attrs: { 'aria-label': 'Sereno is answering' } }, '…'));
  busy = true;
  sendButton.disabled = true;
  try {
    const data = await postJson('/api/chat', { question, website: website.value });
    waiting.remove();
    const item = faq.items.find((i) => i.id === data.answer_id);
    if (item) showAnswer(item); else showNoAnswer();
  } catch (err) {
    waiting.remove();
    if (err instanceof ApiError && (err.status === 429 || err.status === 400)) {
      bubble('sereno', el('p', {}, err.message), chips());
    } else {
      showNoAnswer();
    }
  } finally {
    busy = false;
    sendButton.disabled = false;
    if (typed >= MAX_TYPED) reachLimit(); else input.focus();
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (busy || !faq) return;
  const question = input.value.trim();
  if (!question) {
    input.focus();
    return;
  }
  if (Array.from(question).length > MAX_QUESTION) return;
  input.value = '';
  updateCounter();
  askTyped(question);
});
input.addEventListener('input', updateCounter);

// ---------- open / close ----------

async function load() {
  if (faq) return true;
  if (!loading) {
    loading = getJson('/api/config').then((data) => {
      faq = data.faq;
      return true;
    }).catch(() => {
      loading = null;
      return false;
    });
  }
  return loading;
}

async function open() {
  panel.hidden = false;
  launcher.setAttribute('aria-expanded', 'true');
  document.body.classList.add('chat-is-open');
  if (!faq) {
    clear(log);
    const waiting = bubble('sereno', el('span', { className: 'chat__dots' }, '…'));
    const ok = await load();
    waiting.remove();
    if (!ok) {
      bubble('sereno', el('p', {}, ERROR_TEXT));
      form.hidden = true;
      return;
    }
    form.hidden = false;
    bubble('sereno', el('p', {}, faq.greeting), chips());
  } else if (typed >= MAX_TYPED) {
    // A new opening of the chat starts a new count (plan D6).
    typed = 0;
    form.hidden = false;
  }
  input.focus();
}

function close() {
  panel.hidden = true;
  launcher.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('chat-is-open');
  if (!faq) clear(log); // a failed load is tried again on the next opening
  launcher.focus();
}

launcher.addEventListener('click', () => (panel.hidden ? open() : close()));
closeButton.addEventListener('click', close);

panel.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    close();
    return;
  }
  // On phones the chat covers the page: Tab stays inside it.
  if (event.key === 'Tab' && PHONE.matches) {
    const focusable = [...panel.querySelectorAll('button:not([disabled]), a[href], input:not([tabindex="-1"])')]
      .filter((node) => node.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});

document.body.append(launcher, panel);
