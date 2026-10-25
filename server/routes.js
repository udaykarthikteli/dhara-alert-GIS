import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { bus, raiseAlert } from './services/alerts.js';
import { haversineKm } from './services/geo.js';
import { ROADS } from './data/sites.js';
import { sendEmail } from './services/email.js';

const REPORT_TYPES = ['crack', 'move', 'blocked', 'debris', 'seep'];
const MEDIA = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov' };
const inBounds = (lat, lng) => lat >= config.bounds.south && lat <= config.bounds.north && lng >= config.bounds.west && lng <= config.bounds.east;
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);

export function buildRouter(store, engine) {
  const r = express.Router();
  fs.mkdirSync(config.uploadDir, { recursive: true });

  const upload = multer({
    storage: multer.diskStorage({
      destination: config.uploadDir,
      filename: (_req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + (MEDIA[file.mimetype] || '.bin')),
    }),
    limits: { fileSize: 15 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => cb(MEDIA[file.mimetype] ? null : new Error('unsupported-media'), !!MEDIA[file.mimetype]),
  });
  const writeLimit = rateLimit({ windowMs: 3600e3, limit: 30, standardHeaders: true, legacyHeaders: false });
  const admin = (req, res, next) => {
    const t = Buffer.from(String(req.get('x-admin-token') || ''));
    const k = Buffer.from(config.adminToken);
    if (t.length === k.length && crypto.timingSafeEqual(t, k)) return next();
    res.status(401).json({ error: 'authority token required' });
  };

  r.get('/health', (_q, res) => res.json({ ok: true, updatedAt: engine.snapshot?.updatedAt ?? null, sources: engine.status, sms: config.smsEnabled, telegram: config.telegramEnabled, email: config.emailEnabled, model: engine.model.source }));
  // Pre-built replays of real past events (server/seed/backtest.json, made by `npm run build:backtest`).
  r.get('/backtest', (_q, res) => {
    const b = store.get('backtest', null);
    if (!b || !Array.isArray(b.events) || !b.events.length) return res.status(404).json({ error: 'not-built' });
    res.json(b);
  });
  r.get('/snapshot', (_q, res) => {
    if (!engine.snapshot || !engine.snapshot.sites?.length) return res.status(503).json({ error: 'warming-up', sources: engine.status });
    res.json(engine.snapshot);
  });

  // ---- citizen / field reports -------------------------------------------------------------
  const publicReport = (x) => ({ id: x.id, lat: x.lat, lng: x.lng, type: x.type, note: x.note, media: x.media, mediaType: x.mediaType, status: x.status, createdAt: x.createdAt, role: x.role });
  r.get('/reports', (_q, res) => {
    const cutoff = Date.now() - 7 * 864e5;
    res.json(store.get('reports', []).filter((x) => x.status !== 'rejected' && x.createdAt > cutoff).slice(0, 300).map(publicReport));
  });
  r.post('/reports', writeLimit, (req, res) => {
    upload.single('media')(req, res, (err) => {
      if (err) return res.status(err.message === 'unsupported-media' ? 415 : 400).json({ error: err.message });
      const lat = Number(req.body.lat), lng = Number(req.body.lng), type = String(req.body.type || '');
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return cleanupFail(req, res, 422, 'location required');
      if (!inBounds(lat, lng)) return cleanupFail(req, res, 422, 'location outside India coverage');
      if (!REPORT_TYPES.includes(type)) return cleanupFail(req, res, 422, 'unknown report type');
      const t = Number(req.body.takenAt);
      const report = {
        id: crypto.randomUUID(), lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5, type,
        note: clean(req.body.note, 500), media: req.file ? '/uploads/' + req.file.filename : null, mediaType: req.file ? req.file.mimetype.split('/')[0] : null,
        status: 'unverified', role: 'citizen', createdAt: Number.isFinite(t) && t > Date.now() - 3 * 864e5 && t <= Date.now() ? t : Date.now(),
      };
      const reports = store.get('reports', []);
      reports.unshift(report); store.set('reports', reports.slice(0, 2000));
      engine.refresh({ refetch: false }); // re-score nearby sites with this report
      res.status(201).json(publicReport(report));
    });
  });
  function cleanupFail(req, res, code, msg) { if (req.file) fs.unlink(req.file.path, () => {}); res.status(code).json({ error: msg }); }

  r.patch('/reports/:id', admin, express.json(), (req, res) => {
    const reports = store.get('reports', []);
    const item = reports.find((x) => x.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'not found' });
    if (!['verified', 'rejected', 'unverified'].includes(req.body.status)) return res.status(422).json({ error: 'bad status' });
    item.status = req.body.status; store.set('reports', reports);
    engine.refresh({ refetch: false });
    res.json(publicReport(item));
  });

  // ---- alerts & subscriptions ----------------------------------------------------------------
  r.get('/alerts', (req, res) => res.json(store.get('alerts', []).slice(0, Math.min(100, Number(req.query.limit) || 40))));

  r.post('/subscribers', writeLimit, express.json(), async (req, res) => {
    const scope = ['all', 'state', 'site'].includes(req.body.scope) ? req.body.scope : 'all';
    const value = clean(req.body.value, 60);
    const lang = ['en', 'hi', 'as', 'bn', 'ne', 'lus'].includes(req.body.lang) ? req.body.lang : 'en';
    if (req.body.channel === 'telegram') {
      if (!config.telegramEnabled || !config.telegram.username) return res.status(503).json({ error: 'Telegram alerts are not available yet. Try again in a minute.' });
      const cutoff = Date.now() - 24 * 3600e3;   // drop sign-ups that never pressed Start
      const kept = store.get('subscribers', []).filter((s) => !(s.channel === 'telegram' && !s.chatId && s.createdAt < cutoff));
      const tsub = { token: crypto.randomBytes(16).toString('hex'), channel: 'telegram', chatId: null, lang, scope, value, createdAt: Date.now() };
      kept.push(tsub); store.set('subscribers', kept);
      return res.status(201).json({ token: tsub.token, channel: 'telegram', telegramLink: `https://t.me/${config.telegram.username}?start=${tsub.token}` });
    }
    if (req.body.channel === 'email') {
      if (!config.emailEnabled) return res.status(503).json({ error: 'Email alerts are not switched on for this deployment.' });
      const email = String(req.body.email || '').trim().toLowerCase();
      if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(422).json({ error: 'Enter a valid email address.' });
      const base = `${req.protocol}://${req.get('host')}`;
      const subs = store.get('subscribers', []);
      let es = subs.find((s) => s.channel === 'email' && s.email === email && s.scope === scope && s.value === value);
      if (!es) { es = { token: crypto.randomBytes(16).toString('hex'), channel: 'email', email, confirmed: false, lang, scope, value, base, createdAt: Date.now() }; subs.push(es); }
      else { es.lang = lang; es.base = base; }
      store.set('subscribers', subs);
      if (!es.confirmed) await sendEmail(email, 'Confirm your Dhara Alert subscription', `Click to confirm you want landslide alerts from Dhara Alert:\n\n${base}/api/subscribers/confirm/${es.token}\n\nIf you did not ask for this, ignore this email and nothing will be sent.`);
      return res.status(201).json({ token: es.token, channel: 'email', confirmed: es.confirmed });
    }
    let phone = String(req.body.phone || '').replace(/[\s-]/g, '');
    if (/^\d{10}$/.test(phone)) phone = '+91' + phone;
    if (!/^\+[1-9]\d{9,14}$/.test(phone)) return res.status(422).json({ error: 'Enter a valid mobile number, e.g. 98765 43210 or +91...' });
    const subs = store.get('subscribers', []);
    let sub = subs.find((s) => s.phone === phone && s.scope === scope && s.value === value);
    if (!sub) { sub = { token: crypto.randomBytes(16).toString('hex'), phone, lang, scope, value, createdAt: Date.now() }; subs.push(sub); }
    else sub.lang = lang;
    store.set('subscribers', subs);
    res.status(201).json({ token: sub.token, smsLive: config.smsEnabled });
  });
  const page = (res, msg) => res.type('html').send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dhara Alert</title><body style="font-family:system-ui;background:#120d0a;color:#efe4d3;display:grid;place-items:center;min-height:100vh;margin:0"><div style="max-width:30rem;padding:1.5rem"><h2>Dhara Alert</h2><p>${msg}</p><p><a style="color:#e8803a" href="/">Open the live map</a></p></div>`);
  r.get('/subscribers/confirm/:token', (req, res) => {
    const subs = store.get('subscribers', []);
    const s = subs.find((x) => x.channel === 'email' && x.token === req.params.token);
    if (!s) return page(res.status(404), 'This confirmation link is not valid any more.');
    s.confirmed = true; store.set('subscribers', subs);
    page(res, 'Confirmed. You will get an email when a slope in your area reaches Danger or a Danger is forecast.');
  });
  r.get('/subscribers/unsub/:token', (req, res) => {
    const subs = store.get('subscribers', []);
    store.set('subscribers', subs.filter((x) => x.token !== req.params.token));
    page(res, 'You are unsubscribed. No more Dhara Alert emails will be sent to this address.');
  });
  r.delete('/subscribers/:token', (req, res) => {
    const subs = store.get('subscribers', []);
    const n = subs.length;
    store.set('subscribers', subs.filter((s) => s.token !== req.params.token));
    res.json({ removed: n - store.get('subscribers', []).length });
  });

  // ---- live push (Server-Sent Events) ----------------------------------------------------------
  r.get('/stream', (req, res) => {
    res.set({ 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no' });
    res.flushHeaders();
    const send = (ev, data) => res.write(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`);
    send('hello', { t: Date.now() });
    const onAlert = (a) => send('alert', { id: a.id, site: a.site, siteId: a.siteId, level: a.level, lhi: a.lhi, type: a.type, texts: a.texts });
    const onSnap = (s) => send('snapshot', s);
    bus.on('alert', onAlert); bus.on('snapshot', onSnap);
    const hb = setInterval(() => res.write(': hb\n\n'), 25000);
    req.on('close', () => { clearInterval(hb); bus.off('alert', onAlert); bus.off('snapshot', onSnap); });
  });

  // ---- authority tools --------------------------------------------------------------------------
  // Weather pushed by a trusted machine (scripts/push-weather.js) when this host's IP is rate-limited by Open-Meteo.
  r.post('/admin/weather', admin, express.json({ limit: '6mb' }), (req, res) => {
    const out = engine.injectWeather(req.body && req.body.weather);
    res.status(out.ok ? 200 : 422).json(out);
  });
  r.get('/admin/check', admin, (_q, res) => res.json({ ok: true }));
  // Sends a clearly-labelled TEST alert to everyone subscribed to the chosen area (to check Telegram / email / SMS delivery).
  r.post('/admin/test-alert', admin, express.json(), async (req, res) => {
    const sites = engine.snapshot?.sites || [];
    if (!sites.length) return res.status(503).json({ error: 'data is still loading' });
    const { scope, value } = req.body || {};
    const site = (scope === 'site' && sites.find((s) => s.id === value)) || (scope === 'state' && sites.find((s) => s.state === value)) || sites[0];
    const a = await raiseAlert(store, site, { level: 3, lhi: Math.max(80, Math.round(site.lhi)), type: 'now', test: true });
    res.json({ site: site.name, attempted: a.sms.attempted, sent: a.sms.sent });
  });
  r.post('/admin/refresh', admin, async (_q, res) => { await engine.refresh({ refetch: true }); res.json({ updatedAt: engine.snapshot?.updatedAt }); });
  r.post('/admin/roads/:id/override', admin, express.json(), (req, res) => {
    if (!ROADS.find((x) => x.id === req.params.id)) return res.status(404).json({ error: 'unknown road' });
    if (!['open', 'caution', 'risk', 'blocked'].includes(req.body.status)) return res.status(422).json({ error: 'bad status' });
    const state = store.get('state', { levels: {}, forecastAlertAt: {}, overrides: {} });
    state.overrides = state.overrides || {};
    state.overrides[req.params.id] = { status: req.body.status, note: clean(req.body.note, 200), until: Date.now() + Math.min(72, Number(req.body.hours) || 12) * 3600e3, by: 'authority' };
    store.set('state', state); engine.refresh({ refetch: false });
    res.json({ ok: true });
  });
  r.delete('/admin/roads/:id/override', admin, (req, res) => {
    const state = store.get('state', { levels: {}, forecastAlertAt: {}, overrides: {} });
    if (state.overrides) delete state.overrides[req.params.id];
    store.set('state', state); engine.refresh({ refetch: false });
    res.json({ ok: true });
  });
  return r;
}
