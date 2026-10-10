// Open-Meteo: free, keyless weather + soil-moisture + elevation API (https://open-meteo.com).
// Optional: point at Open-Meteo's paid host with a key if the free API throttles your server's shared IP.
//   OPEN_METEO_BASE=https://customer-api.open-meteo.com   OPEN_METEO_API_KEY=...
const BASE = (process.env.OPEN_METEO_BASE || 'https://api.open-meteo.com').replace(/\/$/, '');
const KEY = process.env.OPEN_METEO_API_KEY || '';
const FORECAST = BASE + '/v1/forecast';
const ELEVATION = BASE + '/v1/elevation';
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));

// Retries rate limits (429) and server errors with backoff, and reports WHY a request failed.
async function getJson(url, tries = 5) {
  if (KEY) url += '&apikey=' + encodeURIComponent(KEY);
  let err;
  for (let i = 0; i < tries; i++) {
    let wait = 1500 * 2 ** i;
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'DharaAlert/1.0' }, signal: AbortSignal.timeout(25000) });
      if (r.ok) return await r.json();
      let reason = ''; try { reason = (await r.json()).reason || ''; } catch {}
      err = new Error(`HTTP ${r.status} from ${new URL(url).hostname}${reason ? ': ' + reason : ''}`);
      if (r.status < 429 && r.status !== 408) throw Object.assign(err, { fatal: true });   // 4xx (not 429): retrying will not help
      const ra = Number(r.headers.get('retry-after')); if (ra > 0) wait = Math.min(ra * 1000, 20000);
    } catch (e) { if (e.fatal) throw e; err = e.cause ? new Error(`${e.message} (${e.cause.code || e.cause.message})`) : e; }
    if (i < tries - 1) await sleep(Math.min(wait, 20000));
  }
  throw err;
}
const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, (i + 1) * n));

/** Returns { [siteId]: { t:[unix s], rain:[mm/h], theta:[m3/m3] } } covering 7 days past + 4 days forecast. */
export async function fetchWeather(sites) {
  const out = {}; let lastErr;
  for (const group of chunk(sites, 10)) {            // small requests are far less likely to be throttled
    try {
      const url = `${FORECAST}?latitude=${group.map((s) => s.lat).join(',')}&longitude=${group.map((s) => s.lng).join(',')}` +
        '&hourly=precipitation,soil_moisture_3_to_9cm,soil_moisture_9_to_27cm,soil_moisture_27_to_81cm' +
        '&past_days=7&forecast_days=4&timeformat=unixtime&timezone=GMT';
      const json = await getJson(url);
      const arr = Array.isArray(json) ? json : [json];
      group.forEach((site, i) => { out[site.id] = parseHourly(arr[i]); });
    } catch (e) { lastErr = e; }
    await sleep(400);
  }
  if (!Object.keys(out).length) throw lastErr || new Error('No weather data');   // partial results are still used
  return out;
}

export function parseHourly(loc) {
  const h = loc && loc.hourly;
  if (!h || !Array.isArray(h.time)) throw new Error('Unexpected Open-Meteo response');
  const layers = ['soil_moisture_3_to_9cm', 'soil_moisture_9_to_27cm', 'soil_moisture_27_to_81cm'].map((k) => h[k]).filter(Boolean);
  let last = 0.3;
  const theta = h.time.map((_, i) => {
    const v = layers.map((l) => l[i]).filter((x) => typeof x === 'number');
    if (v.length) last = v.reduce((a, b) => a + b, 0) / v.length;
    return last;
  });
  return { t: h.time, rain: h.precipitation.map((x) => (typeof x === 'number' ? x : 0)), theta };
}

/** Elevation (m) for many points; Copernicus 90 m DEM. */
export async function fetchElevations(points) {
  const out = [];
  for (const group of chunk(points, 90)) {
    await sleep(300);
    const url = `${ELEVATION}?latitude=${group.map((p) => p.lat.toFixed(5)).join(',')}&longitude=${group.map((p) => p.lng.toFixed(5)).join(',')}`;
    const json = await getJson(url);
    if (!Array.isArray(json.elevation)) throw new Error('Unexpected elevation response');
    out.push(...json.elevation);
  }
  return out;
}
