import { clock } from './util.js';

export const LV = ['Low', 'Watch', 'Warning', 'Danger', 'Critical'];
export const fmtH = (h) => (h < 24 ? `${h} h` : `${Math.floor(h / 24)} d${h % 24 ? ` ${h % 24} h` : ''}`);

/** Countdown to the next threshold crossing in a 72 h forecast: [{ t (ms), lhi, level }, ...] (first point = the snapshot time). */
export function outlook(forecast, nowTs = Date.now()) {
  if (!forecast || !forecast.length) return null;
  const ref = forecast[0].t, cur = forecast[0];
  const staleH = Math.max(0, Math.round((nowTs - ref) / 3600e3));
  const peak = forecast.reduce((a, b) => (b.lhi > a.lhi ? b : a), forecast[0]);
  const first = (min) => forecast.find((p, i) => i > 0 && p.lhi >= min);
  const hrs = (p) => Math.max(3, Math.round((p.t - ref) / 3600e3));
  let out;
  if (cur.lhi >= 60) out = { kind: 'now', level: cur.level, headline: `${LV[cur.level]} level now`, sub: peak.lhi > cur.lhi + 3 ? `Peak ${Math.round(peak.lhi)} expected around ${clock(peak.t)} IST.` : 'Conditions are not expected to ease in the next 72 h.', point: null };
  else if (first(60)) { const p = first(60); out = { kind: 'danger', level: 3, hours: hrs(p), headline: `Danger expected in ~${fmtH(hrs(p))}`, sub: `Around ${clock(p.t)} IST.`, point: p }; }
  else if (first(40)) { const p = first(40); out = { kind: 'warning', level: 2, hours: hrs(p), headline: `Warning expected in ~${fmtH(hrs(p))}`, sub: `Around ${clock(p.t)} IST.`, point: p }; }
  else out = { kind: 'calm', level: cur.level, headline: 'No Warning expected in the next 72 h', sub: `Highest forecast value ${Math.round(peak.lhi)} (${LV[peak.level]}) around ${clock(peak.t)} IST.`, point: null };
  return { ...out, peak, ref, staleH, stale: staleH > 3 };
}
