// Open-Meteo: free, keyless weather + soil-moisture + elevation API (https://open-meteo.com).
// Optional paid key (OPEN_METEO_API_KEY) switches to the dedicated, non-shared endpoint.
const KEY = process.env.OPEN_METEO_API_KEY;
const HOST = KEY ? 'https://customer-api.open-meteo.com' : 'https://api.open-meteo.com';
const FORECAST = HOST + '/v1/forecast';
const ELEVATION = HOST + '/v1/elevation';
const withKey = (u) => (KEY ? `${u}&apikey=${encodeURIComponent(KEY)}` : u);

// A 429 is NOT retried: retrying inside the same minute only burns more quota. The engine enters a cool-down instead.
async function getJson(url, tries = 3) {
  let err;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(withKey(url), { headers: { 'user-agent': 'DharaAlert/1.0' }, signal: AbortSignal.timeout(25000) });
      if (!r.ok) {
        const e = new Error(`HTTP ${r.status} from ${new URL(url).hostname}`); e.status = r.status;
        e.retryAfterMs = Number(r.headers.get('retry-after')) * 1000 || 0;
        throw e;
      }
      return await r.json();
    } catch (e) {
      err = e;
      if (e.status === 429) throw e;
      if (i < tries - 1) await new Promise((s) => setTimeout(s, 700 * (i + 1)));
    }
  }
  throw err;
}
const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, (i + 1) * n));

/** Returns { [siteId]: { t:[unix s], rain:[mm/h], theta:[m3/m3] } } covering 7 days past + 4 days forecast. */
export async function fetchWeather(sites) {
  const out = {};
  let first = true;
  for (const group of chunk(sites, 25)) {
    if (!first) await new Promise((r) => setTimeout(r, process.env.NODE_ENV === 'test' ? 0 : 2000));
    first = false;
    const url = `${FORECAST}?latitude=${group.map((s) => s.lat).join(',')}&longitude=${group.map((s) => s.lng).join(',')}` +
      '&hourly=precipitation,soil_moisture_3_to_9cm,soil_moisture_9_to_27cm,soil_moisture_27_to_81cm' +
      '&past_days=7&forecast_days=4&timeformat=unixtime&timezone=GMT';
    const json = await getJson(url);
    const arr = Array.isArray(json) ? json : [json];
    group.forEach((site, i) => { out[site.id] = parseHourly(arr[i]); });
  }
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
    const url = `${ELEVATION}?latitude=${group.map((p) => p.lat.toFixed(5)).join(',')}&longitude=${group.map((p) => p.lng.toFixed(5)).join(',')}`;
    const json = await getJson(url);
    if (!Array.isArray(json.elevation)) throw new Error('Unexpected elevation response');
    out.push(...json.elevation);
  }
  return out;
}
