// Calls to the site's own /api functions. Every response is { ok, data } or { ok: false, error }.

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request(path, options) {
  let res;
  try {
    res = await fetch(path, options);
  } catch {
    throw new ApiError(0, 'network_error', GENERIC_MESSAGE);
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok || !body || body.ok !== true) {
    const error = body && body.error ? body.error : {};
    throw new ApiError(res.status, error.code || 'server_error', error.message || GENERIC_MESSAGE);
  }
  return body.data;
}

// token (optional): a staff access token, sent as "Authorization: Bearer <token>".
function headers(extra, token) {
  const result = { Accept: 'application/json', ...extra };
  if (token) result.Authorization = `Bearer ${token}`;
  return result;
}

export function getJson(path, token) {
  return request(path, { headers: headers({}, token) });
}

export function postJson(path, data, token) {
  return request(path, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }, token),
    body: JSON.stringify(data),
  });
}
