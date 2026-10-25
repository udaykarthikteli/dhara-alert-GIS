import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'dhara-inj-'));
process.env.UPLOAD_DIR = path.join(process.env.DATA_DIR, 'up');
process.env.TERRAIN_PAUSE_MS = '0';

// Open-Meteo is blocked (429) for this "server"; only USGS answers.
globalThis.fetch = async (url) => {
  const u = new URL(url);
  if (u.hostname === 'earthquake.usgs.gov') return { ok: true, status: 200, json: async () => ({ features: [] }) };
  return { ok: false, status: 429, headers: new Headers(), json: async () => ({}) };
};

const { Store } = await import('../store.js');
const { createEngine } = await import('../services/engine.js');
const { config } = await import('../config.js');
const { SITES } = await import('../data/sites.js');

const nowSec = Math.floor(Date.now() / 3600e3) * 3600;
const t = Array.from({ length: 24 * 11 }, (_, i) => nowSec - 7 * 86400 + i * 3600);
const good = Object.fromEntries(SITES.map((s) => [s.id, { t, rain: t.map(() => 0.2), theta: t.map(() => 0.3) }]));

test('pushed weather makes the site live even though Open-Meteo blocks the server', async () => {
  const engine = createEngine(new Store(config.dataDir));
  await engine.refresh();
  assert.ok(!engine.snapshot || !engine.snapshot.sites?.length, 'nothing to show while blocked');
  const out = engine.injectWeather(good);
  assert.deepEqual([out.ok, out.accepted], [true, SITES.length]);
  await new Promise((r) => setTimeout(r, 300));
  await engine.refresh({ refetch: false });
  assert.equal(engine.snapshot.sites.length, SITES.length);
  assert.equal(engine.snapshot.stale, false);
  assert.ok(engine.snapshot.updatedAt > 0);
});

test('bad or stale payloads are rejected', () => {
  const engine = createEngine(new Store(config.dataDir));
  assert.equal(engine.injectWeather(null).ok, false);
  assert.equal(engine.injectWeather({ [SITES[0].id]: { t, rain: t.map(() => -5), theta: t.map(() => 0.3) } }).ok, false);   // negative rain
  assert.equal(engine.injectWeather({ [SITES[0].id]: { t, rain: t.map(() => 1), theta: t.map(() => 7) } }).ok, false);      // impossible soil moisture
  const old = t.map((x) => x - 30 * 86400);
  assert.equal(engine.injectWeather({ [SITES[0].id]: { t: old, rain: old.map(() => 1), theta: old.map(() => 0.3) } }).ok, false); // old data
});
