// Run AFTER the server has fetched live data at least once on your own computer (npm start, wait for "first refresh done (live)").
// Copies terrain + last weather + last snapshot into server/seed so a fresh deploy starts with real data instead of "fetching".
//   npm run export:seed
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server');
fs.mkdirSync(path.join(root, 'seed'), { recursive: true });
for (const n of ['terrain', 'weather-cache', 'snapshot']) {
  const from = path.join(root, 'data', n + '.json');
  if (fs.existsSync(from)) { fs.copyFileSync(from, path.join(root, 'seed', n + '.json')); console.log('copied', n + '.json'); }
  else console.log('missing', n + '.json (start the server and wait for live data first)');
}
