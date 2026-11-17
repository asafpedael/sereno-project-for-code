// Shared response helpers for the API functions.
// Success: { ok: true, data }. Failure: { ok: false, error: { code, message } }.

export function sendOk(res, data, status = 200) {
  res.status(status).json({ ok: true, data });
}

export function sendError(res, status, code, message) {
  res.status(status).json({ ok: false, error: { code, message } });
}

// Wraps a handler: checks the HTTP method and turns any thrown error into a plain 500.
// Error details go to the server log only, never to the client.
export function withHandler(methods, fn) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!methods.includes(req.method)) {
      res.setHeader('Allow', methods.join(', '));
      return sendError(res, 405, 'method_not_allowed', 'This method is not allowed.');
    }
    try {
      await fn(req, res);
    } catch (err) {
      console.error(err);
      sendError(res, 500, 'server_error', 'Something went wrong. Please try again.');
    }
  };
}
