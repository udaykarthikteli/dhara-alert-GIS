import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { buildHeat } from '../heat.js';
import { LEVEL_COLOR, ROAD_COLOR, ago } from '../util.js';
import { useI18n } from '../i18n.jsx';

const REF = { referrerPolicy: 'origin' };   // some tile servers refuse requests that carry no Referer
const BASES = {
  Terrain: ['https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: 'Map: &copy; OpenStreetMap contributors, SRTM | Style: &copy; OpenTopoMap (CC-BY-SA)', ...REF }],
  Dark: ['https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', { maxZoom: 17, maxNativeZoom: 16, attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ', ...REF }],
  Street: ['https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors', ...REF }],
  Satellite: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics', ...REF }],
};
// Area the app is about, and a much wider pan limit around it.
const INDIA = [[6.5, 68], [37.5, 97.6]];
const PAN_LIMIT = [[0, 60], [42, 105]];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** A site is drawn as a hole in the ground: soil rim, dark pit, swirling inside, falling debris,
 *  and (for higher levels) cracks and ripples in the level colour. All animation is CSS. */
function holeIcon(s) {
  const lvl = s.levelIndex, size = 30 + lvl * 6, box = size + 30;
  const html =
    `<div class="hole${lvl >= 3 ? ' hole-hot' : ''}" style="--c:${LEVEL_COLOR[lvl]};--s:${size}px">` +
    (lvl >= 3 ? '<i class="hole-wave"></i><i class="hole-wave w2"></i>' : '') +
    (lvl >= 2 ? '<i class="hole-cracks"></i>' : '') +
    '<i class="hole-rim"></i><i class="hole-pit"><i class="hole-swirl"></i></i>' +
    '<b class="deb d1"></b><b class="deb d2"></b><b class="deb d3"></b><b class="deb d4"></b>' +
    `<span class="hole-num">${Math.round(s.lhi)}</span></div>`;
  return L.divIcon({ className: 'hole-icon', iconSize: [box, box], iconAnchor: [box / 2, box / 2], html });
}

export default function MapView({ snap, reports, selectedId, onSelect }) {
  const el = useRef(null), map = useRef(null), layers = useRef({}), markers = useRef({}), sigs = useRef({}), sel = useRef(null);
  const { t } = useI18n();
  sel.current = selectedId;

  const applySel = () => {
    for (const [id, mk] of Object.entries(markers.current)) {
      const h = mk.getElement()?.querySelector('.hole');
      if (h) h.classList.toggle('sel', id === sel.current);
    }
  };

  useEffect(() => {
    const m = L.map(el.current, { zoomControl: true, zoomSnap: 0.5, maxBounds: PAN_LIMIT, maxBoundsViscosity: 0.9 });
    const base = Object.fromEntries(Object.entries(BASES).map(([k, [u, o]]) => [k, L.tileLayer(u, { keepBuffer: 4, updateWhenIdle: false, ...o })]));
    // CARTO's free dark map now needs an API key, so the dark basemap is Esri's keyless Dark Gray canvas plus its place-name labels.
    const dark = base.Dark;
    const labels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', { maxZoom: 17, maxNativeZoom: 16, ...REF });
    base.Dark = L.layerGroup([dark, labels]);
    base.Dark.addTo(m);
    // If the dark basemap never loads a single tile (blocked network, tile server down), fall back to the street map.
    let loaded = 0, failed = 0;
    dark.on('tileload', () => { loaded++; });
    dark.on('tileerror', () => { failed++; if (!loaded && failed >= 6 && m.hasLayer(base.Dark)) { m.removeLayer(base.Dark); base.Street.addTo(m); } });
    layers.current = { sites: L.layerGroup().addTo(m), roads: L.layerGroup().addTo(m), reports: L.layerGroup().addTo(m), quakes: L.layerGroup(), heat: L.layerGroup().addTo(m) };
    L.control.layers(base, { 'Risk surface': layers.current.heat, Roads: layers.current.roads, 'Citizen reports': layers.current.reports, 'Earthquakes (30 d)': layers.current.quakes }, { collapsed: true, position: 'topright' }).addTo(m);
    map.current = m;

    // Keep the map filling its box: re-measure on every size change and never let the view zoom out past the pan limit
    // (that is what used to leave grey/empty bands on wide screens).
    let alive = true, raf = 0, fitted = false;
    const fit = () => {
      if (!alive) return;
      m.invalidateSize({ pan: false });
      m.setMinZoom(Math.max(3, m.getBoundsZoom(PAN_LIMIT, true)));
      if (!fitted && el.current && el.current.clientWidth > 0 && el.current.clientHeight > 0) { m.fitBounds(INDIA, { padding: [16, 16], animate: false }); fitted = true; }
    };
    m.setView([22.5, 80], 5);   // Leaflet draws nothing until the map has a view
    fit();
    const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(fit); });
    ro.observe(el.current);
    window.addEventListener('orientationchange', fit);
    const late = setTimeout(fit, 300);

    return () => { alive = false; clearTimeout(late); cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener('orientationchange', fit); m.remove(); map.current = null; markers.current = {}; sigs.current = {}; };
  }, []);

  // sites + heat + roads + quakes
  useEffect(() => {
    if (!map.current || !snap) return;
    const { sites, roads, heat, quakes } = layers.current;
    roads.clearLayers(); heat.clearLayers(); quakes.clearLayers();
    const h = buildHeat(snap.sites); heat.addLayer(L.imageOverlay(h.url, h.bounds, { opacity: 0.8, interactive: false }));
    for (const r of snap.roads) {
      const line = L.polyline(r.pts.map((p) => [p.lat, p.lng]), { color: ROAD_COLOR[r.status], weight: 4, opacity: 0.9, dashArray: r.status === 'blocked' ? '2 8' : r.status === 'caution' ? '10 6' : null, lineCap: 'round' });
      line.bindPopup(`<b>${esc(r.name)}</b><br>${esc(t('road_' + r.status))}${r.worstSite ? `<br><span style="opacity:.7">Worst nearby: ${esc(r.worstSite)} (${Math.round(r.maxLhi)})</span>` : ''}${r.note ? `<br>${esc(r.note)}` : ''}`);
      roads.addLayer(line);
    }

    // Update markers in place so the hole animations keep running between refreshes.
    const seen = new Set();
    for (const s of snap.sites) {
      seen.add(s.id);
      const sig = `${s.levelIndex}:${Math.round(s.lhi)}`;
      let mk = markers.current[s.id];
      if (!mk) {
        mk = L.marker([s.lat, s.lng], { icon: holeIcon(s), title: s.name, riseOnHover: true, zIndexOffset: s.levelIndex * 100 }).on('click', () => onSelect(s.id));
        sites.addLayer(mk); markers.current[s.id] = mk; sigs.current[s.id] = sig;
      } else if (sigs.current[s.id] !== sig) {
        mk.setIcon(holeIcon(s)); mk.setZIndexOffset(s.levelIndex * 100); sigs.current[s.id] = sig;
      }
    }
    for (const id of Object.keys(markers.current)) if (!seen.has(id)) { sites.removeLayer(markers.current[id]); delete markers.current[id]; delete sigs.current[id]; }
    applySel();

    for (const q of snap.quakes) {
      L.circleMarker([q.lat, q.lng], { radius: 3 + q.mag * 1.6, color: '#8fc4bb', weight: 1.2, fillColor: '#8fc4bb', fillOpacity: 0.12 })
        .bindPopup(`<b>M ${q.mag.toFixed(1)}</b> · ${esc(q.place || '')}<br>${ago(q.time)} · depth ${Math.round(q.depth)} km`).addTo(quakes);
    }
  }, [snap]);

  useEffect(() => {
    if (!map.current) return;
    const g = layers.current.reports; g.clearLayers();
    for (const r of reports) {
      const col = r.status === 'verified' ? '#74ab78' : '#dcae52';
      const icon = L.divIcon({ className: '', iconSize: [18, 18], iconAnchor: [9, 9], html: `<div class="rep" style="--c:${col}"></div>` });
      const media = r.media ? (r.mediaType === 'video' ? `<video src="${esc(r.media)}" controls preload="none" style="width:200px;margin-top:6px"></video>` : `<img src="${esc(r.media)}" alt="" style="width:200px;margin-top:6px"/>`) : '';
      L.marker([r.lat, r.lng], { icon }).bindPopup(`<b>${esc(t('t_' + r.type))}</b><br>${esc(r.note || '')}<br><span style="opacity:.7">${esc(t(r.status))} · ${ago(r.createdAt)}</span>${media}`).addTo(g);
    }
  }, [reports, t]);

  useEffect(() => {
    applySel();
    if (!map.current || !selectedId || !markers.current[selectedId]) return;
    const s = snap?.sites.find((x) => x.id === selectedId);
    if (s) map.current.flyTo([s.lat, s.lng], Math.max(map.current.getZoom(), 9), { duration: 0.9 });
  }, [selectedId]);

  return <div ref={el} className="h-full w-full" />;
}
