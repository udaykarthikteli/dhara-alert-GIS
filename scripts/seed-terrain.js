// Builds server/seed/terrain.json (elevation + slope for every site) ONCE, slowly, from your own computer.
// Commit the result: the deployed server then needs zero elevation calls.
//   npm run seed:terrain        (safe to re-run / resume; if you hit a 429, wait an hour and run again)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITES } from '../server/data/sites.js';
import { fetchElevations } from '../server/services/openmeteo.js';
import { ringPoints, slopeFromElevations } from '../server/services/terrain.js';

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server', 'seed', 'terrain.json');
fs.mkdirSync(path.dirname(file), { recursive: true });
const cache = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
const per = ringPoints(SITES[0]).length;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
for (const s of SITES) {
  if (cache[s.id]) continue;
  try {
    const e = await fetchElevations(ringPoints(s));
    cache[s.id] = { elev: Math.round(e[0]), slope: Math.round(slopeFromElevations(e.slice(0, per)) * 10) / 10 };
    fs.writeFileSync(file, JSON.stringify(cache));
    console.log(`ok   ${s.id} (${Object.keys(cache).length}/${SITES.length})`);
  } catch (err) {
    console.log(`stop ${s.id}: ${err.message}. Progress saved - re-run later to resume.`);
    process.exit(1);
  }
  await pause(3000);
}
console.log('Done. Commit server/seed/terrain.json');
