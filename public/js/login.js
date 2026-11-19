// Staff sign-in: email + password sent directly to Supabase Auth (password grant) with the
// publishable key from /api/config. No Supabase library in the page (ARCHITECTURE section 3).
import { getJson } from './api.js';
import { getSession, saveSession, pageForRole } from './session.js';

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';
const WRONG_CREDENTIALS = 'Incorrect email or password';
const NO_ROLE = 'This account has no staff access.';

const form = document.getElementById('login-form');
const emailInput = document.getElementById('login-email');
const passwordInput = document.getElementById('login-password');
const submitButton = document.getElementById('login-submit');
const formError = document.getElementById('login-error');

const fields = [
  { input: emailInput, field: document.getElementById('field-email'), error: document.getElementById('email-error'),
    message: 'Please enter your email.' },
  { input: passwordInput, field: document.getElementById('field-password'), error: document.getElementById('password-error'),
    message: 'Please enter your password.' },
];

// Already signed in: go straight to the role's screen.
const existing = getSession();
if (existing) location.replace(pageForRole(existing.role));

function showFormError(message) {
  formError.textContent = message;
  formError.hidden = false;
}

function clearErrors() {
  formError.hidden = true;
  formError.textContent = '';
  for (const f of fields) {
    f.field.classList.remove('is-invalid');
    f.input.removeAttribute('aria-invalid');
    f.error.hidden = true;
    f.error.textContent = '';
  }
}

function validate() {
  let firstInvalid = null;
  for (const f of fields) {
    if (f.input.value.trim() === '') {
      f.field.classList.add('is-invalid');
      f.input.setAttribute('aria-invalid', 'true');
      f.error.textContent = f.message;
      f.error.hidden = false;
      firstInvalid = firstInvalid || f.input;
    }
  }
  if (firstInvalid) firstInvalid.focus();
  return !firstInvalid;
}

async function signIn(email, password) {
  const config = await getJson('/api/config');
  let res;
  try {
    res = await fetch(`${config.supabase_url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: config.supabase_publishable_key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return { error: GENERIC_MESSAGE };
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  // Supabase answers 400 (invalid_credentials) for a wrong email or password; 401 means a key problem.
  if (res.status === 400) return { error: WRONG_CREDENTIALS };
  if (!res.ok || !body || typeof body.access_token !== 'string') return { error: GENERIC_MESSAGE };

  const role = body.user && body.user.app_metadata && body.user.app_metadata.role;
  if (!pageForRole(role)) return { error: NO_ROLE };

  const expiresAt = typeof body.expires_at === 'number'
    ? body.expires_at
    : Math.floor(Date.now() / 1000) + (Number(body.expires_in) || 3600);
  return { session: { access_token: body.access_token, expires_at: expiresAt, role, email: body.user.email } };
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearErrors();
  if (!validate()) return;

  submitButton.disabled = true;
  try {
    const result = await signIn(emailInput.value.trim(), passwordInput.value);
    if (result.error) {
      showFormError(result.error);
      if (result.error === WRONG_CREDENTIALS) passwordInput.value = '';
      return;
    }
    if (!saveSession(result.session)) {
      showFormError('Please allow this site to store data for this tab, then try again.');
      return;
    }
    location.replace(pageForRole(result.session.role));
  } catch {
    showFormError(GENERIC_MESSAGE);
  } finally {
    submitButton.disabled = false;
  }
});

for (const f of fields) {
  f.input.addEventListener('input', () => {
    if (f.input.value.trim() !== '') {
      f.field.classList.remove('is-invalid');
      f.input.removeAttribute('aria-invalid');
      f.error.hidden = true;
    }
  });
}
