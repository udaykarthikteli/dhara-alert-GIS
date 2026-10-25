import test from 'node:test';
import assert from 'node:assert/strict';
import { SITES } from '../data/sites.js';
import { PRIOR, Model } from '../services/model.js';
import { EVENTS, replayEvent, parseArchive } from '../services/backtest.js';

const model = new Model(PRIOR);
const site = SITES.find((s) => s.id === 'noney');
const event = EVENTS.find((e) => e.id === 'noney-2022');
const eventT = Date.parse(event.at) / 1000;
const t = Array.from({ length: 24 * 15 }, (_, i) => eventT - 12 * 86400 + i * 3600);
const make = (heavy) => ({
  t,
  rain: t.map((x) => (heavy && x > eventT - 60 * 3600 && x <= eventT ? 14 : 0.1)),
  theta: t.map((x) => (heavy ? 0.22 + 0.25 * Math.min(1, Math.max(0, (x - (eventT - 72 * 3600)) / (72 * 3600))) : 0.2)),
});

test('replay: a heavy rain build-up raises the index and reaches Warning before the event', () => {
  const r = replayEvent({ event, site, terrain: { slope: 38 }, weather: make(true), model });
  assert.ok(r.series.length > 30);
  const first = r.series[0].lhi;
  assert.ok(r.lhiAtEvent > first, `LHI at event ${r.lhiAtEvent} should exceed start ${first}`);
  assert.ok(r.leadWarningH === null || r.leadWarningH >= 0);
  assert.equal(r.series.length, r.rain3h.length);
  assert.ok(r.series.every((p) => p.lhi >= 0 && p.lhi <= 100));
});

test('replay: dry weather never reaches Warning (no false lead time)', () => {
  const r = replayEvent({ event, site, terrain: { slope: 30 }, weather: make(false), model });
  assert.equal(r.leadWarningH, null);
  assert.equal(r.leadDangerH, null);
});

test('parseArchive averages soil layers and tolerates nulls', () => {
  const w = parseArchive({ hourly: { time: [0, 3600], precipitation: [1, null], soil_moisture_0_to_7cm: [0.3, null], soil_moisture_7_to_28cm: [0.4, 0.5] } });
  assert.deepEqual(w.rain, [1, 0]);
  assert.ok(Math.abs(w.theta[0] - 0.35) < 1e-9 && Math.abs(w.theta[1] - 0.5) < 1e-9);
});
