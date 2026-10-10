// Verifies that the three live data sources respond with the shapes the engine expects.
//   npm run check:live
import { SITES } from '../server/data/sites.js';
import { fetchWeather, fetchElevations } from '../server/services/openmeteo.js';
import { fetchQuakes } from '../server/services/usgs.js';
const step = async (name, fn) => { try { console.log('OK  ', name, '-', await fn()); } catch (e) { console.log('FAIL', name, '-', e.message); process.exitCode = 1; } };
await step('Open-Meteo forecast + soil moisture', async () => { const w = await fetchWeather(SITES.slice(0, 3)); const s = w[SITES[0].id]; return `${s.t.length} hourly steps, last rain ${s.rain.at(-1)} mm, soil moisture ${s.theta.at(-1).toFixed(3)}`; });
await step('Open-Meteo elevation', async () => (await fetchElevations([{ lat: 25.5788, lng: 91.8933 }, { lat: 27.3389, lng: 88.6065 }])).join(' m, ') + ' m');
await step('USGS earthquakes (NE India, 30 d)', async () => `${(await fetchQuakes()).length} events M>=2.5`);
