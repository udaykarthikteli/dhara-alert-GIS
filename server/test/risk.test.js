import test from 'node:test';
import assert from 'node:assert/strict';
import { factorOfSafety, rainRatio, caineThreshold, levelOf, pgaG, seismicKh, evaluate } from '../services/risk.js';
import { Model } from '../services/model.js';
import { pointSegmentKm, haversineKm } from '../services/geo.js';
import { slopeFromElevations } from '../services/terrain.js';
import { GEOLOGY } from '../data/sites.js';

const soil = { slopeDeg: 30, c: 10, phi: 28, gamma: 18.5, z: 3 };

test('FS falls as the slope saturates', () => {
  const dry = factorOfSafety({ ...soil, m: 0 }), wet = factorOfSafety({ ...soil, m: 1 });
  assert.ok(dry > 1 && wet < dry && wet < 1, `dry=${dry} wet=${wet}`);
});
test('FS matches the closed-form infinite-slope result', () => {
  // dry, c=0: FS = tan(phi)/tan(beta)
  const fs = factorOfSafety({ slopeDeg: 30, c: 0, phi: 30, gamma: 18, z: 2, m: 0 });
  assert.ok(Math.abs(fs - 1) < 1e-9);
});
test('seismic shaking lowers FS', () => {
  assert.ok(factorOfSafety({ ...soil, m: 0.5, kh: 0.15 }) < factorOfSafety({ ...soil, m: 0.5 }));
});
test('Caine threshold and exceedance ratio', () => {
  assert.ok(Math.abs(caineThreshold(24) - 14.82 * Math.pow(24, -0.39)) < 1e-9);
  const heavy = Array(24).fill(10); // 10 mm/h for 24 h = far above threshold
  assert.ok(rainRatio(heavy) > 1);
  assert.equal(rainRatio(Array(24).fill(0)), 0);
});
test('levels', () => { assert.deepEqual([0, 19.9, 20, 45, 61, 95].map(levelOf), [0, 0, 1, 2, 3, 4]); });
test('PGA decreases with distance and increases with magnitude', () => {
  assert.ok(pgaG(6, 20) > pgaG(6, 80)); assert.ok(pgaG(6.5, 30) > pgaG(5, 30)); assert.ok(seismicKh(0.2) === 0.1);
});
test('dry calm day is Low, storm on a steep wet slope is Danger or worse', () => {
  const model = new Model(); const geology = GEOLOGY.sandstone_shale;
  const calm = evaluate({ geology, slopeDeg: 20, past: Array(168).fill(0), theta: 0.2, model });
  const storm = evaluate({ geology, slopeDeg: 35, past: Array(168).fill(0).concat(Array(72).fill(8)), theta: 0.44, model });
  assert.ok(calm.level === 0, JSON.stringify(calm)); assert.ok(storm.level >= 3, JSON.stringify(storm));
});
test('geo helpers', () => {
  assert.ok(Math.abs(haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }) - 111.2) < 0.5);
  assert.ok(pointSegmentKm({ lat: 0.1, lng: 0.5 }, { lat: 0, lng: 0 }, { lat: 0, lng: 1 }) < 11.2);
});
test('slope from a synthetic DEM', () => {
  const z = [100, ...Array(8).fill(100 + 250 * Math.tan((20 * Math.PI) / 180)), ...Array(8).fill(100)];
  assert.ok(Math.abs(slopeFromElevations(z) - 20) < 0.5);
});
