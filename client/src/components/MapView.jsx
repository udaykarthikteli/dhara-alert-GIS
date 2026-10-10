import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { buildHeat } from '../heat.js';
import { LEVEL_COLOR, ROAD_COLOR, colorOfLhi, ago } from '../util.js';
import { useI18n } from '../i18n.jsx';

const BASES = {
  Terrain: ['https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: 'Map: &copy; OpenStreetMap contributors, SRTM | Style: &copy; OpenTopoMap (CC-BY-SA)' }],
  Dark: ['https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd', attribution: '&copy; OpenStreetMap contributors &copy; CARTO' }],
  Satellite: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics' }],
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default function MapView({ snap, reports, selectedId, onSelect }) {
  const el = useRef(null), map = useRef(null), layers = useRef({}), markers = useRef({});
  const { t, level } = useI18n();

  useEffect(() => {
    const m = L.map(el.current, { zoomControl: true, minZoom: 5, maxZoom: 17, zoomSnap: 0.5 }).setView([26.2, 92.6], 6.5);
    m.setMaxBounds([[17, 82], [33, 102]]);
    const base = Object.fromEntries(Object.entries(BASES).map(([k, [u, o]]) => [k, L.tileLayer(u, o)]));
    base.Dark.addTo(m);
    layers.current = { sites: L.layerGroup().addTo(m), roads: L.layerGroup().addTo(m), reports: L.layerGroup().addTo(m), quakes: L.layerGroup(), heat: L.layerGroup().addTo(m) };
    L.control.layers(base, { 'Risk surface': layers.current.heat, Roads: layers.current.roads, 'Citizen reports': layers.current.reports, 'Earthquakes (30 d)': layers.current.quakes }, { collapsed: true, position: 'topright' }).addTo(m);
    map.current = m;
    setTimeout(() => m.invalidateSize(), 50);
    return () => { m.remove(); map.current = null; };
  }, []);

  // sites + heat + roads + quakes
  useEffect(() => {
    if (!map.current || !snap) return;
    const { sites, roads, heat, quakes } = layers.current;
    sites.clearLayers(); roads.clearLayers(); heat.clearLayers(); quakes.clearLayers(); markers.current = {};
    const h = buildHeat(snap.sites); heat.addLayer(L.imageOverlay(h.url, h.bounds, { opacity: 0.8, interactive: false }));
    for (const r of snap.roads) {
      const line = L.polyline(r.pts.map((p) => [p.lat, p.lng]), { color: ROAD_COLOR[r.status], weight: 4, opacity: 0.9, dashArray: r.status === 'blocked' ? '2 8' : r.status === 'caution' ? '10 6' : null, lineCap: 'round' });
      line.bindPopup(`<b>${esc(r.name)}</b><br>${esc(t('road_' + r.status))}${r.worstSite ? `<br><span style="opacity:.7">Worst nearby: ${esc(r.worstSite)} (${Math.round(r.maxLhi)})</span>` : ''}${r.note ? `<br>${esc(r.note)}` : ''}`);
      roads.addLayer(line);
    }
    for (const s of snap.sites) {
      const hot = s.levelIndex >= 3;
      const icon = L.divIcon({ className: '', iconSize: [34, 34], iconAnchor: [17, 17], html: `<div class="pin ${hot ? 'pin-hot' : ''}" style="--c:${LEVEL_COLOR[s.levelIndex]}"><span>${Math.round(s.lhi)}</span></div>` });
      const mk = L.marker([s.lat, s.lng], { icon, title: s.name, riseOnHover: true, zIndexOffset: s.levelIndex * 100 }).on('click', () => onSelect(s.id));
      sites.addLayer(mk); markers.current[s.id] = mk;
    }
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
    if (!map.current || !selectedId || !markers.current[selectedId]) return;
    const s = snap?.sites.find((x) => x.id === selectedId);
    if (s) map.current.flyTo([s.lat, s.lng], Math.max(map.current.getZoom(), 9), { duration: 0.9 });
  }, [selectedId]);

  return <div ref={el} className="h-full w-full" />;
}
