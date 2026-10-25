// Builds server/seed/backtest.json: replays real past landslide events through the live risk engine.
// Run on a computer that can reach Open-Meteo (your laptop), then commit server/seed/backtest.json.
//   npm run build:backtest      (resumes if interrupted; if you hit HTTP 429 wait an hour and run again)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITES } from '../server/data/sites.js';
import { loadModel } from '../server/services/model.js';
import { EVENTS, fetchArchive, replayEvent } from '../server/services/backtest.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server');
const out = path.join(root, 'seed', 'backtest.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const terrain = { ...readJson(path.join(root, 'data', 'terrain.json'), {}), ...readJson(path.join(root, 'seed', 'terrain.json'), {}) };
const model = loadModel();
const prev = readJson(out, { events: [] });
const done = new Map(prev.events.map((e) => [e.id, e]));
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

for (const ev of EVENTS) {
  if (done.has(ev.id) && done.get(ev.id).model === model.source) { console.log('have ', ev.id); continue; }
  const site = SITES.find((s) => s.id === ev.siteId);
  if (!site) { console.log('skip ', ev.id, '- site not in the current region (set REGION=india?)'); continue; }
  try {
    const weather = await fetchArchive(site, Date.parse(ev.at));
    const tr = terrain[site.id] || { slope: 25, estimated: true };
    const r = replayEvent({ event: ev, site, terrain: tr, weather, model });
    done.set(ev.id, r);
    console.log(`ok   ${ev.id}: LHI at event ${r.lhiAtEvent}, Warning lead ${r.leadWarningH ?? 'none'} h, Danger lead ${r.leadDangerH ?? 'none'} h${r.terrainEstimated ? ' (estimated slope - run npm run seed:terrain first)' : ''}`);
  } catch (e) {
    console.log(`stop ${ev.id}: ${e.message}. Progress saved - run again later.`);
    break;
  }
  fs.writeFileSync(out, JSON.stringify({ generatedAt: Date.now(), model: model.source, events: [...done.values()] }));
  await pause(4000);
}
fs.writeFileSync(out, JSON.stringify({ generatedAt: Date.now(), model: model.source, events: [...done.values()] }));
console.log(`Wrote ${done.size} event(s) to server/seed/backtest.json. Commit that file.`);
