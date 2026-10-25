// Replays real past landslide events through the SAME risk engine the live system uses.
// Weather comes from Open-Meteo's historical archive (ERA5-Land reanalysis). Built offline by scripts/build-backtest.js
// into server/seed/backtest.json, so the running server never needs the archive API (no rate-limit risk during a demo).
import { evaluate } from './risk.js';
import { GEOLOGY } from '../data/sites.js';

// Dates come from news reports / memory and MUST be confirmed (NASA Global Landslide Catalog, GSI, state disaster authorities)
// before you quote them. Add more events here: `at` is the approximate time of failure in UTC, `siteId` is a monitored site.
export const EVENTS = [
  {
    id: 'noney-2022', siteId: 'noney', at: '2022-06-29T19:00:00Z',
    title: 'Noney (Tupul) landslide, Manipur, 30 June 2022',
    summary: 'A very large landslide hit the Tupul railway-construction area in Noney district after several days of heavy monsoon rain.',
    dateNote: 'Struck in the night of 29-30 June 2022 (about 00:30 IST). Confirm the exact time before citing.',
  },
  {
    id: 'aizawl-2024', siteId: 'aizawl', at: '2024-05-28T00:00:00Z',
    title: 'Aizawl landslides during Cyclone Remal, Mizoram, 28 May 2024',
    summary: 'Heavy rain from Cyclone Remal triggered landslides around Aizawl, including a quarry collapse.',
    dateNote: 'Early morning of 28 May 2024 (approximate time used). Confirm before citing.',
  },
  {
    id: 'north-sikkim-2024', siteId: 'lachung', at: '2024-06-13T00:00:00Z',
    title: 'North Sikkim (Mangan district) landslides, June 2024',
    summary: 'Days of extreme rain in June 2024 triggered several landslides in Mangan district that cut road access to Lachung and Lachen.',
    dateNote: 'Several slides happened between 10 and 13 June 2024; 13 June is used as the reference. Confirm before citing.',
  },
];

const ARCHIVE_VARS = 'precipitation,soil_moisture_0_to_7cm,soil_moisture_7_to_28cm,soil_moisture_28_to_100cm';
const KEY = process.env.OPEN_METEO_API_KEY;
const ARCHIVE = KEY ? 'https://customer-archive-api.open-meteo.com/v1/archive' : 'https://archive-api.open-meteo.com/v1/archive';
const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Hourly rain + soil moisture from 12 days before to 2 days after the event. */
export async function fetchArchive(site, eventMs) {
  const url = `${ARCHIVE}?latitude=${site.lat}&longitude=${site.lng}&start_date=${ymd(eventMs - 12 * 864e5)}&end_date=${ymd(eventMs + 2 * 864e5)}` +
    `&hourly=${ARCHIVE_VARS}&timeformat=unixtime&timezone=GMT${KEY ? '&apikey=' + encodeURIComponent(KEY) : ''}`;
  const r = await fetch(url, { headers: { 'user-agent': 'DharaAlert/1.0' }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) { const e = new Error(`HTTP ${r.status} from ${new URL(url).hostname}`); e.status = r.status; throw e; }
  return parseArchive(await r.json());
}

export function parseArchive(json) {
  const h = json && json.hourly;
  if (!h || !Array.isArray(h.time)) throw new Error('Unexpected archive response');
  const layers = ['soil_moisture_0_to_7cm', 'soil_moisture_7_to_28cm', 'soil_moisture_28_to_100cm'].map((k) => h[k]).filter(Boolean);
  let last = 0.3;
  const theta = h.time.map((_, i) => {
    const v = layers.map((l) => l[i]).filter((x) => typeof x === 'number');
    if (v.length) last = v.reduce((a, b) => a + b, 0) / v.length;
    return last;
  });
  return { t: h.time, rain: (h.precipitation || []).map((x) => (typeof x === 'number' ? x : 0)), theta };
}

// Hours before the event during which the index was continuously at or above `threshold` (null if it was not at event time).
function lead(series, eventMs, threshold) {
  let k = -1;
  for (let j = 0; j < series.length; j++) if (series[j].t <= eventMs) k = j;
  if (k < 0 || series[k].lhi < threshold) return null;
  let j = k;
  while (j > 0 && series[j - 1].lhi >= threshold) j--;
  return Math.round((eventMs - series[j].t) / 3600e3);
}

/** weather = { t:[unix s], rain:[mm/h], theta:[m3/m3] } (hourly). Returns the 3-hourly hazard history around the event. */
export function replayEvent({ event, site, terrain, weather, model, stepH = 3, beforeDays = 5, afterH = 12 }) {
  const geo = GEOLOGY[site.geology];
  const eventMs = Date.parse(event.at), eventT = eventMs / 1000;
  const { t, rain, theta } = weather;
  const series = [], rain3h = [];
  let i = 0;
  for (let ts = eventT - beforeDays * 86400; ts <= eventT + afterH * 3600; ts += stepH * 3600) {
    while (i + 1 < t.length && t[i + 1] <= ts) i++;
    if (t[i] > ts) continue;
    const e = evaluate({ geology: geo, slopeDeg: terrain.slope, past: rain.slice(0, i + 1), theta: theta[i], model });
    series.push({ t: ts * 1000, lhi: e.lhi, level: e.level, fs: e.fs, r24: Math.round(e.rain.r24 * 10) / 10 });
    rain3h.push({ t: ts * 1000, mm: Math.round(rain.slice(Math.max(0, i - 2), i + 1).reduce((a, b) => a + b, 0) * 10) / 10 });
  }
  let k = -1;
  for (let j = 0; j < series.length; j++) if (series[j].t <= eventMs) k = j;
  const before = series.filter((p) => p.t <= eventMs);
  return {
    id: event.id, title: event.title, summary: event.summary, dateNote: event.dateNote,
    siteId: site.id, siteName: site.name, state: site.state, eventAt: eventMs,
    series, rain3h,
    leadWarningH: lead(series, eventMs, 40), leadDangerH: lead(series, eventMs, 60),
    lhiAtEvent: k >= 0 ? series[k].lhi : null,
    peakBefore: before.length ? Math.max(...before.map((p) => p.lhi)) : null,
    terrainEstimated: !!terrain.estimated, model: model.source,
  };
}
