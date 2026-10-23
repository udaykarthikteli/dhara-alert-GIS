// Open-Meteo: free, keyless weather + soil-moisture + elevation API (https://open-meteo.com).
const FORECAST = 'https://api.open-meteo.com/v1/forecast';
const ELEVATION = 'https://api.open-meteo.com/v1/elevation';

async function getJson(url, tries = 4) {
  let err;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'DharaAlert/1.0' }, signal: AbortSignal.timeout(25000) });
      if (!r.ok) { const e = new Error(`HTTP ${r.status} from ${new URL(url).hostname}`); e.status = r.status; throw e; }
      return await r.json();
    } catch (e) {
      err = e;
      if (i < tries - 1) await new Promise((s) => setTimeout(s, e.status === 429 ? Math.min(process.env.NODE_ENV === 'test' ? 0 : 20000, 8000 * (i + 1)) : 700 * (i + 1)));   // rate-limited: wait much longer
    }
  }
  throw err;
}
const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, (i + 1) * n));

/** Returns { [siteId]: { t:[unix s], rain:[mm/h], theta:[m3/m3] } } covering 7 days past + 4 days forecast. */
export async function fetchWeather(sites) {
  const out = {};
  for (const group of chunk(sites, 40)) {
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
