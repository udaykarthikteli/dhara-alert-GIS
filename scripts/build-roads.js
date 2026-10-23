// Run ONCE on your own computer:   node scripts/build-roads.js
// Replaces the hand-drawn road lines with real roads. For each corridor it asks the free OpenStreetMap routing
// service (OSRM) for the driving route between the corridor's towns and saves it to server/data/roads.json.
// Commit that file to GitHub (folder server/data). Delete it to go back to the hand-drawn lines.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROAD_WAYPOINTS } from '../server/data/sites.js';

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server', 'data', 'roads.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rad = (d) => (d * Math.PI) / 180;
const km = (a, b) => { const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
const lineKm = (pts) => pts.slice(1).reduce((s, p, i) => s + km(pts[i], p), 0);

// Douglas-Peucker: drop points that sit within ~40 m of the straight line between their neighbours
function simplify(pts, eps = 0.0004) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let idx = 0, max = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const dx = b.lng - a.lng, dy = b.lat - a.lat, len = dx * dx + dy * dy || 1e-12;
    const t = Math.max(0, Math.min(1, ((pts[i].lng - a.lng) * dx + (pts[i].lat - a.lat) * dy) / len));
    const d = Math.hypot(pts[i].lng - (a.lng + t * dx), pts[i].lat - (a.lat + t * dy));
    if (d > max) { max = d; idx = i; }
  }
  if (max <= eps) return [a, b];
  return [...simplify(pts.slice(0, idx + 1), eps).slice(0, -1), ...simplify(pts.slice(idx), eps)];
}

async function route(pts) {
  const coords = pts.map((p) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&alternatives=false`;
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'DharaAlert-road-builder/1.0' }, signal: AbortSignal.timeout(60000) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.code === 'Ok' && j.routes?.[0]) return j.routes[0].geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
      if (j.code && j.code !== 'Ok') throw Object.assign(new Error(`${j.code}: ${j.message || ''}`), { fatal: true });
    } catch (e) { if (e.fatal) throw e; }
    await sleep(3000 * (i + 1));
  }
  throw new Error('routing service did not answer');
}

const result = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : {};
for (const road of ROAD_WAYPOINTS) {
  process.stdout.write(`${road.name} ... `);
  try {
    const line = simplify(await route(road.pts)).map((p) => ({ lat: Math.round(p.lat * 1e5) / 1e5, lng: Math.round(p.lng * 1e5) / 1e5 }));
    const ratio = lineKm(line) / lineKm(road.pts);
    // A mountain road is longer than the straight line between towns, but not wildly so. Anything else means the router picked a wrong road.
    if (ratio < 0.95 || ratio > 2.2) { console.log(`skipped (route is ${ratio.toFixed(2)}x the straight-line length, looks wrong; kept the hand-drawn line)`); continue; }
    result[road.id] = line;
    console.log(`ok: ${Math.round(lineKm(line))} km, ${line.length} points`);
  } catch (e) { console.log('failed: ' + e.message); }
  await sleep(1500);   // be polite to the free service
}
fs.writeFileSync(out, JSON.stringify(result));
console.log(`\nSaved ${Object.keys(result).length} of ${ROAD_WAYPOINTS.length} roads to server/data/roads.json`);
