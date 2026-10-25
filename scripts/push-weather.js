// Keeps your HOSTED site live when the host's IP is blocked by Open-Meteo (HTTP 429).
// This runs on your own computer (home internet = its own IP), fetches the weather, and sends it to the hosted server.
//
//   Windows PowerShell:  $env:REMOTE_URL="https://dhara-alert-gis.onrender.com"; $env:ADMIN_TOKEN="your-token"; npm run push:weather
//   Windows cmd:         set REMOTE_URL=https://dhara-alert-gis.onrender.com && set ADMIN_TOKEN=your-token && npm run push:weather
//   Mac/Linux:           REMOTE_URL=https://... ADMIN_TOKEN=... npm run push:weather
//
// ADMIN_TOKEN must equal the ADMIN_TOKEN environment variable you set on the hosting service. Leave this window open.
// Add --once to send a single update and exit. Use PUSH_MINUTES to change the 15-minute interval.
import { SITES } from '../server/data/sites.js';
import { fetchWeather } from '../server/services/openmeteo.js';

const base = String(process.env.REMOTE_URL || '').replace(/\/+$/, '');
const token = process.env.ADMIN_TOKEN;
if (!base || !token) { console.log('Set REMOTE_URL and ADMIN_TOKEN first (see the comments at the top of scripts/push-weather.js).'); process.exit(1); }
const every = Math.max(5, Number(process.env.PUSH_MINUTES || 15)) * 60e3;
const stamp = () => new Date().toLocaleTimeString();

async function push() {
  try {
    const weather = await fetchWeather(SITES);
    const r = await fetch(`${base}/api/admin/weather`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify({ weather }), signal: AbortSignal.timeout(60000),
    });
    const body = await r.json().catch(() => ({}));
    if (r.ok) console.log(`${stamp()}  sent weather for ${body.accepted}/${body.of} sites - live data updated`);
    else console.log(`${stamp()}  server said HTTP ${r.status}: ${body.error || 'rejected'}${r.status === 401 ? ' (ADMIN_TOKEN does not match the one on the server)' : ''}`);
    return r.ok;
  } catch (e) {
    console.log(`${stamp()}  failed: ${e.message}${e.status === 429 ? ' (Open-Meteo is limiting this computer too - will retry)' : ''}`);
    return false;
  }
}

const ok = await push();
if (process.argv.includes('--once')) process.exit(ok ? 0 : 1);
console.log(`Will send an update every ${every / 60e3} minutes. Keep this window open.`);
setInterval(push, every);
