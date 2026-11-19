// Staff authentication and role checks for the API functions (ARCHITECTURE section 3).
// The token is always verified with Supabase Auth; the role is read from app_metadata only
// (users cannot change app_metadata themselves). Nothing the page sends about identity is trusted.
import { getSupabase } from './supabase.js';
import { sendError } from './http.js';

export const STAFF_ROLES = ['manager', 'agent'];

const TOKEN_RE = /^[A-Za-z0-9._~+/=-]{20,4096}$/;

// Returns 'manager' or 'agent' from a Supabase user, or null for anything else.
export function roleFromUser(user) {
  const role = user && user.app_metadata && user.app_metadata.role;
  return STAFF_ROLES.includes(role) ? role : null;
}

// Reads "Authorization: Bearer <token>". Returns the token or null.
export function bearerToken(req) {
  const header = req.headers && req.headers.authorization;
  if (typeof header !== 'string') return null;
  const match = /^Bearer (\S+)$/.exec(header.trim());
  if (!match || !TOKEN_RE.test(match[1])) return null;
  return match[1];
}

// Verifies the caller. Returns { user, role } when allowed; otherwise sends 401/403 and returns null.
export async function requireStaff(req, res, allowedRoles) {
  const token = bearerToken(req);
  if (!token) {
    sendError(res, 401, 'unauthorized', 'Please sign in.');
    return null;
  }

  const { data, error } = await getSupabase().auth.getUser(token);
  if (error || !data || !data.user) {
    if (error) console.error(`auth: token rejected (${error.status || 'no status'})`);
    sendError(res, 401, 'unauthorized', 'Please sign in.');
    return null;
  }

  const role = roleFromUser(data.user);
  if (!role) {
    sendError(res, 403, 'forbidden', 'Your account has no staff role.');
    return null;
  }
  if (!allowedRoles.includes(role)) {
    sendError(res, 403, 'forbidden', 'You do not have permission for this action.');
    return null;
  }
  return { user: data.user, role };
}
