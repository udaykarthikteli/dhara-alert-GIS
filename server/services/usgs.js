import { config } from '../config.js';
// USGS FDSN event service: real earthquakes in/around NE India (last 30 days, M>=2.5).
export async function fetchQuakes() {
  const b = config.bounds;
  const start = new Date(Date.now() - 30 * 864e5).toISOString();
  const url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&orderby=time&minmagnitude=2.5' +
    `&starttime=${start}&minlatitude=${b.south - 1}&maxlatitude=${b.north + 1}&minlongitude=${b.west - 1}&maxlongitude=${b.east + 1}`;
  const r = await fetch(url, { headers: { 'user-agent': 'DharaAlert/1.0' }, signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error(`USGS HTTP ${r.status}`);
  return parseQuakes(await r.json());
}
export function parseQuakes(json) {
  return (json.features || []).map((f) => ({
    id: f.id, mag: f.properties.mag, place: f.properties.place, time: f.properties.time,
    lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], depth: f.geometry.coordinates[2] ?? 10,
  })).filter((q) => typeof q.mag === 'number');
}
