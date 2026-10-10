export const LEVELS = ['low', 'watch', 'warning', 'danger', 'critical'];
export const LEVEL_COLOR = ['#74ab78', '#dcae52', '#e8803a', '#e0472f', '#c0264b'];
export const levelIdx = (l) => LEVELS.indexOf(l);
export const colorOfLhi = (v) => LEVEL_COLOR[v >= 80 ? 4 : v >= 60 ? 3 : v >= 40 ? 2 : v >= 20 ? 1 : 0];
export const ROAD_COLOR = { open: '#74ab78', caution: '#dcae52', risk: '#e8803a', blocked: '#e0472f' };

export const ACTIONS = [
  'Routine monitoring. No action needed.',
  'Inspect drains and cut slopes. Brief field teams.',
  'Pre-position excavators and rescue teams. Warn nearby communities. Avoid night travel on the corridor.',
  'Evacuate vulnerable households. Close the worst road sections. Activate the district control room.',
  'Evacuate now. Close the corridor. Request SDRF / NDRF support.',
];

const rtf = typeof Intl !== 'undefined' && Intl.RelativeTimeFormat ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }) : null;
export function ago(ts) {
  if (!ts) return '';
  const s = Math.round((ts - Date.now()) / 1000), a = Math.abs(s);
  if (!rtf) return new Date(ts).toLocaleString();
  if (a < 60) return rtf.format(Math.round(s / 1), 'second');
  if (a < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (a < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  return rtf.format(Math.round(s / 86400), 'day');
}
export const clock = (ts) => new Date(ts).toLocaleString('en-IN', { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const REPORT_TYPES = ['crack', 'move', 'blocked', 'debris', 'seep'];
