const R = 6371.0088;
const rad = (d) => (d * Math.PI) / 180;
export function haversineKm(a, b) {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
/** Distance (km) from point p to segment a-b using a local equirectangular projection. */
export function pointSegmentKm(p, a, b) {
  const k = Math.cos(rad(p.lat));
  const X = (q) => [(q.lng - p.lng) * 111.32 * k, (q.lat - p.lat) * 110.57];
  const [ax, ay] = X(a), [bx, by] = X(b);
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  return Math.hypot(ax + t * dx, ay + t * dy);
}
export function pointPolylineKm(p, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) best = Math.min(best, pointSegmentKm(p, pts[i], pts[i + 1]));
  return best;
}
