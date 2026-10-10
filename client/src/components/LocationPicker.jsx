import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function LocationPicker({ value, onChange }) {
  const el = useRef(null), map = useRef(null), mk = useRef(null), cb = useRef(onChange); cb.current = onChange;
  useEffect(() => {
    const m = L.map(el.current, { zoomControl: false, attributionControl: false }).setView(value ? [value.lat, value.lng] : [26.2, 92.6], value ? 12 : 6);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 19 }).addTo(m);
    L.control.zoom({ position: 'bottomright' }).addTo(m);
    m.on('click', (e) => cb.current({ lat: e.latlng.lat, lng: e.latlng.lng }));
    map.current = m; setTimeout(() => m.invalidateSize(), 50);
    return () => m.remove();
  }, []);
  useEffect(() => {
    const m = map.current; if (!m || !value) return;
    if (!mk.current) {
      mk.current = L.marker([value.lat, value.lng], { draggable: true, icon: L.divIcon({ className: '', iconSize: [26, 26], iconAnchor: [13, 13], html: '<div class="pin pin-hot" style="--c:#e8803a"><span>+</span></div>' }) }).addTo(m);
      mk.current.on('dragend', () => { const p = mk.current.getLatLng(); cb.current({ lat: p.lat, lng: p.lng }); });
    } else mk.current.setLatLng([value.lat, value.lng]);
    if (m.getZoom() < 10) m.setView([value.lat, value.lng], 12);
  }, [value]);
  return <div ref={el} className="h-56 w-full border border-bone/15" role="application" aria-label="Pick the location on the map" />;
}
