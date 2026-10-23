// Email delivery through Brevo's HTTP API (free plan: ~300 emails/day). No extra npm package needed.
// Setup: create a free Brevo account, verify your sender address (Senders & IP), create an API key,
// then set BREVO_API_KEY and EMAIL_FROM (the verified address) in the environment.
import { config } from '../config.js';

export async function sendEmail(to, subject, text) {
  if (!config.emailEnabled) return { ok: false, status: 'no-provider' };
  try {
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': config.email.apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender: { name: config.email.name, email: config.email.from }, to: [{ email: to }], subject, textContent: text }),
      signal: AbortSignal.timeout(15000),
    });
    return { ok: r.ok, status: r.ok ? 'sent' : `http-${r.status}` };
  } catch { return { ok: false, status: 'error' }; }
}
