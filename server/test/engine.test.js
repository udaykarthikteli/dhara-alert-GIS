// End-to-end engine test with a stubbed network that returns payloads shaped like the real Open-Meteo / USGS APIs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'dhara-'));
process.env.UPLOAD_DIR = path.join(process.env.DATA_DIR, 'up');

const nowSec = Math.floor(Date.now() / 3600e3) * 3600;
const times = Array.from({ length: 24 * 11 }, (_, i) => nowSec - 7 * 86400 + i * 3600);
globalThis.fetch = async (url) => {
  const u = new URL(url); const j = (o) => ({ ok: true, status: 200, json: async () => o });
  if (u.hostname === 'api.open-meteo.com' && u.pathname.endsWith('/forecast')) {
    const n = u.searchParams.get('latitude').split(',').length;
    const loc = (k) => ({ hourly: { time: times, precipitation: times.map((t) => (t > nowSec - 48 * 3600 && t < nowSec + 24 * 3600 ? 9 : 0.1)),
      soil_moisture_3_to_9cm: times.map(() => 0.4 + k * 0.001), soil_moisture_9_to_27cm: times.map(() => 0.41), soil_moisture_27_to_81cm: times.map(() => 0.42) } });
    return j(n === 1 ? loc(0) : Array.from({ length: n }, (_, k) => loc(k)));
  }
  if (u.pathname.endsWith('/elevation')) { const n = u.searchParams.get('latitude').split(',').length; return j({ elevation: Array.from({ length: n }, (_, i) => 1000 + (i % 17) * 60) }); }
  if (u.hostname === 'earthquake.usgs.gov') return j({ features: [{ id: 'q1', properties: { mag: 5.4, place: 'test', time: Date.now() - 3600e3 }, geometry: { coordinates: [91.9, 25.6, 15] } }] });
  throw new Error('unexpected fetch ' + url);
};

const { Store } = await import('../store.js');
const { createEngine } = await import('../services/engine.js');
const { config } = await import('../config.js');

test('refresh builds a complete snapshot, alerts and roads', async () => {
  const store = new Store(config.dataDir);
  const engine = createEngine(store);
  const snap = await engine.refresh();
  const { SITES, ROADS } = await import('../data/sites.js');
  assert.equal(snap.sites.length, SITES.length);
  assert.ok(snap.sources.weather.ok && snap.sources.quakes.ok && snap.sources.terrain.ok);
  const sh = snap.sites.find((s) => s.id === 'shillong');
  assert.ok(sh.lhi > 40, 'storm + M5.4 nearby should push Shillong high: ' + sh.lhi);
  assert.ok(sh.seismic.kh > 0.01);
  assert.ok(sh.forecast.length >= 20 && sh.series.rain.length > 100);
  assert.ok(snap.roads.length === ROADS.length && snap.roads.some((r) => r.status !== 'open'));
  assert.ok(store.get('alerts', []).length > 0, 'alerts raised');
  const again = await engine.refresh({ refetch: false });
  const n = store.get('alerts', []).length;
  await engine.refresh({ refetch: false });
  assert.equal(store.get('alerts', []).length, n, 'no duplicate alerts');
  store.flushAll();
});
