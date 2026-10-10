import { colorOfLhi } from './util.js';
const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Inverse-distance-weighted risk surface between the monitored sites, rendered to an image overlay. */
export function buildHeat(sites, b = { south: 21.8, west: 88, north: 29, east: 97.3 }, w = 170, h = 120) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'), img = ctx.createImageData(w, h);
  const R = 1.6;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const lat = b.north - (y / (h - 1)) * (b.north - b.south), lng = b.west + (x / (w - 1)) * (b.east - b.west);
    let sw = 0, sv = 0, md = 9;
    for (const s of sites) {
      const d = Math.hypot((s.lat - lat), (s.lng - lng) * Math.cos((lat * Math.PI) / 180));
      if (d > R) { md = Math.min(md, d); continue; }
      const wt = 1 / (d * d + 0.01); sw += wt; sv += wt * s.lhi; md = Math.min(md, d);
    }
    if (!sw) continue;
    const v = sv / sw, [r, g, bl] = hexRgb(colorOfLhi(v)), i = (y * w + x) * 4;
    img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = bl; img.data[i + 3] = Math.round(Math.max(0, 1 - md / R) * (60 + v * 1.4));
  }
  ctx.putImageData(img, 0, 0);
  return { url: c.toDataURL(), bounds: [[b.south, b.west], [b.north, b.east]] };
}
