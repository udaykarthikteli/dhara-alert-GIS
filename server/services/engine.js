import { SITES, ROADS, GEOLOGY } from '../data/sites.js';
import { fetchWeather } from './openmeteo.js';
import { fetchQuakes } from './usgs.js';
import { ensureTerrain } from './terrain.js';
import { evaluate, levelOf, LEVELS, clamp, pgaG, seismicKh } from './risk.js';
import { haversineKm, pointPolylineKm } from './geo.js';
import { raiseAlert, bus } from './alerts.js';
import { loadModel } from './model.js';

const HOUR = 3600;
const status = { weather: { ok: null }, quakes: { ok: null }, terrain: { ok: null } };
const mem = { weather: null, quakes: [], running: null };

export function citizenScore(site, reports, now = Date.now()) {
  let s = 0;
  for (const r of reports) {
    if (r.status === 'rejected' || now - r.createdAt > 48 * 3600e3) continue;
    if (haversineKm(site, r) <= 3) s += r.status === 'verified' ? 1 : 0.35;
  }
  return clamp(s / 2.5);
}

function seismicFor(site, quakes, now) {
  let pga = 0;
  for (const q of quakes) {
    if (now - q.time > 48 * 3600e3) continue;
    const d = Math.hypot(haversineKm(site, q), q.depth || 10);
    pga = Math.max(pga, pgaG(q.mag, d));
  }
  return { kh: seismicKh(pga), pga };
}

export function computeSite(site, ctx) {
  const { terrain, weather, quakes, reports, model, now } = ctx;
  const geo = GEOLOGY[site.geology];
  const w = weather[site.id];
  const nowSec = Math.floor(now / 1000);
  let ni = 0;
  for (let i = 0; i < w.t.length; i++) if (w.t[i] <= nowSec) ni = i; else break;
  const { kh, pga } = seismicFor(site, quakes, now);
  const citizen = citizenScore(site, reports, now);
  const slopeDeg = terrain.slope;
  const cur = evaluate({ geology: geo, slopeDeg, past: w.rain.slice(0, ni + 1), theta: w.theta[ni], kh, citizen, model });

  const forecast = [];
  for (let k = 0; k <= 72; k += 3) {
    const i = ni + k;
    if (i >= w.t.length) break;
    const e = k === 0 ? cur : evaluate({ geology: geo, slopeDeg, past: w.rain.slice(0, i + 1), theta: w.theta[i], kh: 0, citizen, model });
    forecast.push({ t: w.t[i] * 1000, lhi: e.lhi, level: e.level, r24: Math.round(e.rain.r24 * 10) / 10 });
  }
  const peak = forecast.reduce((a, b) => (b.lhi > a.lhi ? b : a), forecast[0]);
  const from = Math.max(0, ni - 72), to = Math.min(w.t.length, ni + 73);
  const series = { t0: w.t[from] * 1000, rain: w.rain.slice(from, to).map((x) => Math.round(x * 10) / 10), nowIndex: ni - from };

  return {
    id: site.id, name: site.name, state: site.state, lat: site.lat, lng: site.lng, pop: site.pop,
    geology: geo.label, elev: terrain.elev, slope: terrain.slope,
    lhi: cur.lhi, level: LEVELS[cur.level], levelIndex: cur.level, fs: cur.fs, ratio: cur.ratio, saturation: cur.m,
    features: cur.features, rain: { ...cur.rain, r1: round1(cur.rain.r1), r3: round1(cur.rain.r3), r24: round1(cur.rain.r24), r72: round1(cur.rain.r72), r168: round1(cur.rain.r168) },
    seismic: { kh: Math.round(kh * 1e4) / 1e4, pga: Math.round(pga * 1e4) / 1e4 }, citizen: Math.round(citizen * 100) / 100,
    forecast, peak: { t: peak.t, lhi: peak.lhi, level: LEVELS[peak.level] }, series,
  };
}
const round1 = (x) => Math.round(x * 10) / 10;

function priorityOf(site, reports, onCorridor) {
  const E = clamp(Math.log10(Math.max(site.pop, 10)) / 6);
  let v = 0, u = 0;
  for (const r of reports) {
    if (r.status === 'rejected' || Date.now() - r.createdAt > 48 * 3600e3 || haversineKm(site, r) > 3) continue;
    r.status === 'verified' ? v++ : u++;
  }
  return Math.round(Math.min(100, site.lhi * (0.55 + 0.45 * E) + 6 * v + 2 * Math.min(u, 3) + (onCorridor ? 5 : 0)));
}

export function computeRoads(sites, reports, overrides, now = Date.now()) {
  return ROADS.map((road) => {
    const near = sites.filter((s) => pointPolylineKm(s, road.pts) <= 30);
    const worst = near.reduce((a, b) => (!a || b.lhi > a.lhi ? b : a), null);
    const maxLhi = worst ? worst.lhi : 0;
    let state = maxLhi >= 80 ? 'blocked' : maxLhi >= 60 ? 'risk' : maxLhi >= 40 ? 'caution' : 'open';
    let source = 'model';
    if (state === 'blocked') state = 'blocked'; // "likely blocked" per model
    const blockedReports = reports.filter((r) => r.type === 'blocked' && r.status !== 'rejected' && now - r.createdAt < 24 * 3600e3 && pointPolylineKm(r, road.pts) <= 3);
    const verified = blockedReports.filter((r) => r.status === 'verified').length;
    if (verified >= 1 || blockedReports.length >= 2) { state = 'blocked'; source = 'reports'; }
    const o = overrides[road.id];
    if (o && (!o.until || o.until > now)) { state = o.status; source = 'authority'; }
    return { id: road.id, name: road.name, pts: road.pts, status: state, source, maxLhi, worstSite: worst ? worst.name : null, siteIds: near.map((s) => s.id), note: o && source === 'authority' ? o.note : undefined };
  });
}

export function createEngine(store) {
  const model = loadModel();
  let snapshot = store.get('snapshot', null);

  async function build({ refetch }) {
    const now = Date.now();
    const state = store.get('state', { levels: {}, forecastAlertAt: {}, overrides: {} });
    // terrain
    let terrain;
    try { terrain = await ensureTerrain(store, SITES); status.terrain = { ok: true, at: now }; }
    catch (e) { terrain = store.get('terrain', {}); status.terrain = { ok: false, at: now, error: e.message }; }
    // weather + quakes
    if (refetch || !mem.weather) {
      const [w, q] = await Promise.allSettled([fetchWeather(SITES), fetchQuakes()]);
      if (w.status === 'fulfilled') { mem.weather = w.value; status.weather = { ok: true, at: now }; }
      else status.weather = { ok: false, at: now, error: w.reason.message };
      if (q.status === 'fulfilled') { mem.quakes = q.value; status.quakes = { ok: true, at: now }; }
      else status.quakes = { ok: false, at: now, error: q.reason.message };
    }
    const usable = SITES.filter((s) => mem.weather && mem.weather[s.id] && terrain[s.id]);
    if (!usable.length) {
      snapshot = { ...(snapshot || { sites: [], roads: [], quakes: [], summary: null }), updatedAt: snapshot ? snapshot.updatedAt : null, stale: true, sources: { ...status }, model: model.source };
      store.set('snapshot', snapshot);
      return snapshot;
    }
    const reports = store.get('reports', []);
    const sites = usable.map((s) => computeSite(s, { terrain: terrain[s.id], weather: mem.weather, quakes: mem.quakes, reports, model, now }));
    const roads = computeRoads(sites, reports, state.overrides || {}, now);
    const onRoad = new Set(roads.flatMap((r) => r.siteIds));
    sites.forEach((s) => { s.priority = priorityOf(s, reports, onRoad.has(s.id)); });

    const counts = Object.fromEntries(LEVELS.map((l) => [l, 0]));
    sites.forEach((s) => counts[s.level]++);
    const quakes = mem.quakes.map((q) => ({ id: q.id, mag: q.mag, place: q.place, time: q.time, lat: q.lat, lng: q.lng, depth: q.depth }));
    const weatherOk = status.weather.ok;
    snapshot = {
      updatedAt: weatherOk ? now : snapshot?.updatedAt ?? now, stale: !weatherOk, sources: { ...status }, model: model.source,
      sites, roads, quakes,
      summary: {
        counts, atRisk: sites.filter((s) => s.levelIndex >= 2).length, monitored: sites.length,
        roadsAffected: roads.filter((r) => r.status !== 'open').length, roadsTotal: roads.length,
        maxLhi: Math.max(...sites.map((s) => s.lhi)), quakes24h: quakes.filter((q) => now - q.time < 864e5).length,
        reportsOpen: reports.filter((r) => r.status === 'unverified' && now - r.createdAt < 48 * 3600e3).length,
      },
    };
    store.set('snapshot', snapshot);

    // alerts: raise on upward level crossings (>= Warning) and on forecast Danger within 24 h
    for (const s of sites) {
      const prev = state.levels[s.id] ?? 0;
      if (s.levelIndex >= 2 && s.levelIndex > prev) await raiseAlert(store, s, { level: s.levelIndex, lhi: s.lhi, type: 'now' });
      state.levels[s.id] = s.levelIndex;
      const soon = s.forecast.filter((f) => f.t - now <= 24 * 3600e3).reduce((a, b) => (b.lhi > a.lhi ? b : a), s.forecast[0]);
      const last = state.forecastAlertAt[s.id] || 0;
      if (s.levelIndex < 3 && soon && levelOf(soon.lhi) >= 3 && now - last > 12 * 3600e3) {
        state.forecastAlertAt[s.id] = now;
        await raiseAlert(store, s, { level: levelOf(soon.lhi), lhi: soon.lhi, type: 'forecast', peakAt: soon.t });
      }
    }
    store.set('state', state);
    bus.emit('snapshot', { updatedAt: snapshot.updatedAt });
    return snapshot;
  }

  const refresh = (opts = { refetch: true }) => {
    if (mem.running) return mem.running;
    mem.running = build(opts).catch((e) => { console.error('[engine] refresh failed:', e.message); return snapshot; }).finally(() => { mem.running = null; });
    return mem.running;
  };
  return { refresh, get snapshot() { return snapshot; }, status, model };
}
