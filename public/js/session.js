// Staff session in sessionStorage (one tab, cleared when the tab closes).
// The stored role only chooses which page to open; the server checks the token on every call.
import { getJson, postJson, ApiError } from './api.js';

const KEY = 'sereno_session';
const LOGIN_PAGE = '/staff/login.html';
const ROLE_PAGES = { manager: '/staff/manager.html', agent: '/staff/agent.html' };

export function pageForRole(role) {
  return ROLE_PAGES[role] || null;
}

export function saveSession({ access_token, expires_at, role, email }) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ access_token, expires_at, role, email }));
    return true;
  } catch {
    return false;
  }
}

// Returns the session, or null when missing, unreadable or expired.
export function getSession() {
  let session;
  try {
    session = JSON.parse(sessionStorage.getItem(KEY));
  } catch {
    return null;
  }
  if (!session || typeof session.access_token !== 'string' || !pageForRole(session.role)) return null;
  if (typeof session.expires_at !== 'number' || session.expires_at * 1000 <= Date.now()) {
    clearSession();
    return null;
  }
  return session;
}

export function clearSession() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Storage blocked: nothing stored, nothing to clear.
  }
}

export function goToLogin() {
  location.replace(LOGIN_PAGE);
}

// For staff pages: returns the session, or redirects (to login, or to the other role's page).
export function requireRole(role) {
  const session = getSession();
  if (!session) {
    goToLogin();
    return null;
  }
  if (session.role !== role) {
    location.replace(pageForRole(session.role));
    return null;
  }
  return session;
}

export function logout() {
  clearSession();
  goToLogin();
}

// API calls with the staff token. A 401 (expired or invalid token) ends the session.
async function withToken(call) {
  const session = getSession();
  if (!session) {
    goToLogin();
    throw new ApiError(401, 'unauthorized', 'Please sign in.');
  }
  try {
    return await call(session.access_token);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      clearSession();
      goToLogin();
    }
    throw err;
  }
}

export function staffGet(path) {
  return withToken((token) => getJson(path, token));
}

export function staffPost(path, data) {
  return withToken((token) => postJson(path, data, token));
}

// Wires a "Log out" button.
export function bindLogout(button) {
  if (button) button.addEventListener('click', logout);
}
