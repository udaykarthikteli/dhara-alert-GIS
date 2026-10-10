import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { alertText, levelName } from '../../shared/i18n.js';
import { LEVELS } from './risk.js';

export const bus = new EventEmitter();
bus.setMaxListeners(0);

export async function sendSms(to, body) {
  if (!config.smsEnabled) return { ok: false, status: 'no-provider' };
  const { sid, token, from } = config.twilio;
  try {
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'), 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
      signal: AbortSignal.timeout(15000),
    });
    return { ok: r.ok, status: r.ok ? 'sent' : `http-${r.status}` };
  } catch (e) { return { ok: false, status: 'error' }; }
}

const matches = (sub, site) => sub.scope === 'all' || (sub.scope === 'state' && sub.value === site.state) || (sub.scope === 'site' && sub.value === site.id);

/** Creates an alert record, notifies SSE listeners and (optionally) sends SMS in each subscriber's language. */
export async function raiseAlert(store, site, { level, lhi, type = 'now', peakAt = null }) {
  const alerts = store.get('alerts', []);
  const alert = {
    id: crypto.randomUUID(), siteId: site.id, site: site.name, state: site.state, lat: site.lat, lng: site.lng,
    level: LEVELS[level], lhi, type, peakAt, createdAt: Date.now(),
    texts: Object.fromEntries(['en', 'hi', 'as', 'bn', 'ne', 'lus'].map((l) => [l, alertText(l, { level: LEVELS[level], site: site.name, lhi })])),
    sms: { attempted: 0, sent: 0, provider: config.smsEnabled },
  };
  alerts.unshift(alert);
  store.set('alerts', alerts.slice(0, 500));
  bus.emit('alert', alert);

  if (level >= 3 || type === 'forecast') {
    const subs = store.get('subscribers', []).filter((s) => matches(s, site));
    for (const s of subs) {
      alert.sms.attempted++;
      const body = alertText(s.lang, { level: LEVELS[level], site: site.name, lhi }) + (type === 'forecast' ? '' : '');
      const res = await sendSms(s.phone, body);
      if (res.ok) alert.sms.sent++;
    }
    store.set('alerts', store.get('alerts', []));
  }
  return alert;
}
export { levelName };
