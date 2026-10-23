// Run on your own computer:   node scripts/build-training.js [path/to/catalog.csv] [--accuracy 10km] [--max 300]
//
// Builds server/data/training.csv from REAL landslide records:
//   1. reads NASA's Global Landslide Catalog (downloads it, or pass the CSV you saved yourself)
//   2. keeps rainfall-type events in North-East India whose location is accurate to the chosen distance
//   3. for each event, downloads the real hourly rain and soil moisture before it (Open-Meteo archive)
//      and the slope at that spot, and computes the same features the live engine uses
//   4. adds ordinary days from the same place and season (30 days before and after) as "no landslide" examples
// It is slow on purpose (the free weather service limits requests) and it SAVES PROGRESS: if it stops, run it again.
// Afterwards run:  npm run train
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../server/config.js';
import { evaluate } from '../server/services/risk.js';
import { ringPoints, slopeFromElevations } from '../server/services/terrain.js';
import { SITES, GEOLOGY } from '../server/data/sites.js';

const args = process.argv.slice(2);
const opt = (name, d) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : d; };
const csvArg = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const ACC = ['exact', '1km', '5km', '10km', '25km', '50km'];
const maxAcc = ACC.indexOf(opt('accuracy', '10km'));
const MAX = Number(opt('max', 300));
const BOX = { latMin: 21.5, latMax: 29.6, lngMin: 87.5, lngMax: 97.6 };   // North-East India
const URLS = ['https://data.nasa.gov/api/views/dd9e-wu2v/rows.csv?accessType=DOWNLOAD', 'https://data.nasa.gov/docs/legacy/Global_Landslide_Catalog_Export/Global_Landslide_Catalog_Export_rows.csv'];
const dir = config.dataDir, cacheFile = path.join(dir, 'training-cache.json'), outFile = path.join(dir, 'training.csv'), glcFile = path.join(dir, 'glc.csv');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseCsv(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; if (row.length > 1 || row[0] !== '') rows.push(row); row = []; }
    else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows;
}
async function getJson(url) {
  for (let i = 0; i < 6; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(40000) });
      if (r.ok) return await r.json();
      if (r.status !== 429 && r.status < 500) { const j = await r.json().catch(() => ({})); throw Object.assign(new Error(`HTTP ${r.status}: ${j.reason || ''}`), { fatal: true }); }
      console.log(`  weather service says wait (HTTP ${r.status})...`);
    } catch (e) { if (e.fatal) throw e; }
    await sleep(Math.min(20000 * (i + 1), 120000));
  }
  throw new Error('rate limit: stop here and run the script again in an hour (progress is saved)');
}
const ymd = (s) => { const t = String(s).trim(); let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`; m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : null; };
const shift = (d, n) => new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10) + n)).toISOString().slice(0, 10);
const rad = (d) => (d * Math.PI) / 180;
const km = (a, b) => { const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };

// ---- 1. the catalog
let text;
const given = csvArg && fs.existsSync(csvArg) ? csvArg : fs.existsSync(glcFile) ? glcFile : null;
if (given) text = fs.readFileSync(given, 'utf8');
else {
  for (const u of URLS) { try { const r = await fetch(u, { signal: AbortSignal.timeout(60000) }); if (r.ok) { text = await r.text(); break; } } catch {} }
  if (!text) { console.error('Could not download the catalog. Open https://data.nasa.gov/dataset/global-landslide-catalog-export, download the CSV,\nthen run:  node scripts/build-training.js path/to/that-file.csv'); process.exit(1); }
  fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(glcFile, text);
}
const table = parseCsv(text);
const header = table[0].map((h) => h.trim().toLowerCase());
const col = (...names) => header.findIndex((h) => names.includes(h));
const C = { lat: col('latitude', 'lat'), lng: col('longitude', 'lng', 'lon', 'long'), date: col('event_date', 'date'), acc: col('location_accuracy'), trig: col('landslide_trigger'), id: col('event_id', 'id') };
if (C.lat < 0 || C.lng < 0 || C.date < 0) { console.error('Could not find latitude / longitude / event_date columns. Columns in this file:\n' + header.join(', ')); process.exit(1); }

const today = new Date().toISOString().slice(0, 10), seen = new Set(), events = [];
for (const r of table.slice(1)) {
  const lat = Number(r[C.lat]), lng = Number(r[C.lng]), date = ymd(r[C.date]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !date) continue;
  if (lat < BOX.latMin || lat > BOX.latMax || lng < BOX.lngMin || lng > BOX.lngMax) continue;
  if (date < '2000-03-01' || date > shift(today, -12)) continue;                                   // the archive trails real time by a few days
  if (C.acc >= 0) { const a = ACC.indexOf(String(r[C.acc]).trim().toLowerCase()); if (a < 0 || a > maxAcc) continue; }
  if (C.trig >= 0 && /earthquake|mining|construction|volcan|leaking|dam_|no_apparent/i.test(r[C.trig])) continue;
  const key = `${lat.toFixed(3)},${lng.toFixed(3)},${date}`; if (seen.has(key)) continue; seen.add(key);
  events.push({ key, lat, lng, date });
}
console.log(`Catalog: ${table.length - 1} records worldwide, ${events.length} usable events in North-East India (location accuracy within ${ACC[maxAcc]}).`);
if (events.length < 30) console.log('Fewer than 30 events. Try:  --accuracy 25km   (accepts less exact locations)');
events.sort((a, b) => a.key.localeCompare(b.key)); events.length = Math.min(events.length, MAX);

// ---- 2. features for each event and its comparison days
fs.mkdirSync(dir, { recursive: true });
const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};
const dummy = { predict: () => 0.5 };
const FEAT = ['fs', 'rain', 'seis', 'cit', 'antec', 'sat'];
async function rowsFor(ev) {
  const pts = ringPoints(ev);
  const el = await getJson(`https://api.open-meteo.com/v1/elevation?latitude=${pts.map((p) => p.lat.toFixed(5)).join(',')}&longitude=${pts.map((p) => p.lng.toFixed(5)).join(',')}`);
  await sleep(700);
  const slope = slopeFromElevations(el.elevation);
  const start = shift(ev.date, -67), end = shift(ev.date, 31) > shift(today, -6) ? shift(today, -6) : shift(ev.date, 31);
  const w = await getJson(`https://archive-api.open-meteo.com/v1/archive?latitude=${ev.lat.toFixed(4)}&longitude=${ev.lng.toFixed(4)}&start_date=${start}&end_date=${end}&hourly=precipitation,soil_moisture_0_to_7cm,soil_moisture_7_to_28cm,soil_moisture_28_to_100cm&timezone=GMT`);
  await sleep(700);
  const h = w.hourly, rain = h.precipitation.map((x) => (typeof x === 'number' ? x : 0));
  const lay = ['soil_moisture_0_to_7cm', 'soil_moisture_7_to_28cm', 'soil_moisture_28_to_100cm'].map((k) => h[k]).filter(Boolean);
  let last = 0.3; const theta = h.time.map((_, i) => { const v = lay.map((l) => l[i]).filter((x) => typeof x === 'number'); if (v.length) last = v.reduce((a, b) => a + b, 0) / v.length; return last; });
  const site = SITES.reduce((a, s) => (!a || km(ev, s) < km(ev, a) ? s : a), null);     // nearest monitored site gives the rock/soil class
  const geology = GEOLOGY[site.geology];
  const at = (day) => { const idx = h.time.indexOf(`${day}T23:00`); if (idx < 167) return null; const e = evaluate({ geology, slopeDeg: slope, past: rain.slice(0, idx + 1), theta: theta[idx], kh: 0, citizen: 0, model: dummy }); return FEAT.map((f) => Math.round(e.features[f] * 1e4) / 1e4); };
  const out = [];
  for (const [day, label] of [[ev.date, 1], [shift(ev.date, -30), 0], [shift(ev.date, 30), 0]]) { const f = at(day); if (f) out.push([...f, label]); }
  return out;
}

let done = 0, failed = 0;
try {
  for (const ev of events) {
    if (cache[ev.key]) { done++; continue; }
    try { cache[ev.key] = await rowsFor(ev); done++; fs.writeFileSync(cacheFile, JSON.stringify(cache)); process.stdout.write(`\r${done}/${events.length} events processed   `); }
    catch (e) { failed++; console.log(`\n  skipped one event: ${e.message}`); if (/rate limit/.test(e.message)) break; }
  }
} finally {
  const rows = Object.values(cache).flat();
  const pos = rows.filter((r) => r[6] === 1).length, neg = rows.length - pos;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outFile, ['fs,rain,seis,cit,antec,sat,label', ...rows.map((r) => r.join(','))].join('\n') + '\n');
  console.log(`\n\nSaved ${rows.length} rows (${pos} landslide days, ${neg} ordinary days) to ${outFile}${failed ? `; ${failed} events were skipped, run the script again to retry them` : ''}.`);
  console.log(pos >= 30 && neg >= 30 ? 'Next step:  npm run train' : 'Not enough rows yet to train (need 30 of each). Run again, or use --accuracy 25km.');
}
