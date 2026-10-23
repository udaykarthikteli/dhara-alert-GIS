import { fetchElevations } from './openmeteo.js';

// Steepest local gradient around each site from the 90 m DEM: 8 bearings x 2 radii (250 m, 500 m).
// We want the steepest slope that could fail near the settlement, not the town-average slope.
const RADII = [250, 500];
const BEARINGS = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);

export function ringPoints(site) {
  const pts = [{ lat: site.lat, lng: site.lng }];
  const mLat = 1 / 110574, mLng = 1 / (111320 * Math.cos((site.lat * Math.PI) / 180));
  for (const r of RADII) for (const b of BEARINGS) pts.push({ lat: site.lat + Math.cos(b) * r * mLat, lng: site.lng + Math.sin(b) * r * mLng });
  return pts;
}
export function slopeFromElevations(elev) {
  const z0 = elev[0]; let best = 0, k = 1;
  for (const r of RADII) for (let i = 0; i < BEARINGS.length; i++, k++) best = Math.max(best, Math.atan(Math.abs(elev[k] - z0) / r));
  return Math.min(55, Math.max(8, (best * 180) / Math.PI));
}

/** Returns { [id]: { elev, slope } }, cached in the store so the DEM is queried once per site. */
// Done in small batches (5 sites = 85 points = one elevation call) with a pause between them, and progress is saved after
// every batch, so a rate-limit (HTTP 429) part-way through never throws away what was already fetched.
const BATCH = 5;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
export async function ensureTerrain(store, sites) {
  const cache = store.get('terrain', {});
  const missing = sites.filter((s) => !cache[s.id]);
  if (!missing.length) return cache;
  const per = 1 + RADII.length * BEARINGS.length;
  const gap = Number(process.env.TERRAIN_PAUSE_MS ?? 1500);
  for (let i = 0; i < missing.length; i += BATCH) {
    const group = missing.slice(i, i + BATCH);
    try {
      const elev = await fetchElevations(group.flatMap(ringPoints));
      group.forEach((s, k) => {
        const e = elev.slice(k * per, (k + 1) * per);
        cache[s.id] = { elev: Math.round(e[0]), slope: Math.round(slopeFromElevations(e) * 10) / 10 };
      });
      store.set('terrain', cache);
    } catch (err) {
      store.set('terrain', cache);                     // keep the batches that did succeed
      if (!Object.keys(cache).length) throw err;       // nothing at all -> report failure
      err.message = `terrain partial (${Object.keys(cache).length}/${sites.length} sites): ${err.message}`;
      throw err;
    }
    if (i + BATCH < missing.length && gap) await pause(gap);
  }
  return cache;
}
