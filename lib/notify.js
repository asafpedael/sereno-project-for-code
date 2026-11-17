// Sends a notification event to the n8n webhook, which builds and sends the email.
// Never throws: returns true when n8n accepted the event, false otherwise.
// Logs never include the secret, the webhook URL or provider response bodies.

const TIMEOUT_MS = 8000;

export async function notify(payload) {
  const url = process.env.N8N_WEBHOOK_URL;
  const secret = process.env.N8N_WEBHOOK_SECRET;
  const type = payload && payload.type;
  if (!url || !secret) {
    console.error('notify: N8N_WEBHOOK_URL or N8N_WEBHOOK_SECRET is not set');
    return false;
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': secret },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`notify: webhook returned ${res.status} for type ${type}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`notify: request failed for type ${type} (${err.name})`);
    return false;
  }
}
