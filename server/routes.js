import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { bus } from './services/alerts.js';
import { haversineKm } from './services/geo.js';
import { ROADS } from './data/sites.js';

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

  r.get('/health', (_q, res) => res.json({ ok: true, updatedAt: engine.snapshot?.updatedAt ?? null, sources: engine.status, sms: config.smsEnabled, model: engine.model.source }));
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
      if (!inBounds(lat, lng)) return cleanupFail(req, res, 422, 'location outside North-East India coverage');
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

  r.post('/subscribers', writeLimit, express.json(), (req, res) => {
    let phone = String(req.body.phone || '').replace(/[\s-]/g, '');
    if (/^\d{10}$/.test(phone)) phone = '+91' + phone;
    if (!/^\+[1-9]\d{9,14}$/.test(phone)) return res.status(422).json({ error: 'Enter a valid mobile number, e.g. 98765 43210 or +91...' });
    const scope = ['all', 'state', 'site'].includes(req.body.scope) ? req.body.scope : 'all';
    const value = clean(req.body.value, 60);
    const lang = ['en', 'hi', 'as', 'bn', 'ne', 'lus'].includes(req.body.lang) ? req.body.lang : 'en';
    const subs = store.get('subscribers', []);
    let sub = subs.find((s) => s.phone === phone && s.scope === scope && s.value === value);
    if (!sub) { sub = { token: crypto.randomBytes(16).toString('hex'), phone, lang, scope, value, createdAt: Date.now() }; subs.push(sub); }
    else sub.lang = lang;
    store.set('subscribers', subs);
    res.status(201).json({ token: sub.token, smsLive: config.smsEnabled });
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
  r.get('/admin/check', admin, (_q, res) => res.json({ ok: true }));
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
