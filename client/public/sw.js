// Offline-first service worker: app shell + last API snapshot + map tiles you have already looked at.
const SHELL = 'dhara-shell-v1', DATA = 'dhara-data-v1', TILES = 'dhara-tiles-v1';
self.addEventListener('install', (e) => { e.waitUntil(caches.open(SHELL).then((c) => c.addAll(['/', '/icon.svg', '/manifest.webmanifest']).catch(() => {})).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => ![SHELL, DATA, TILES].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });

async function trim(cacheName, max) { const c = await caches.open(cacheName); const ks = await c.keys(); if (ks.length > max) await Promise.all(ks.slice(0, ks.length - max).map((k) => c.delete(k))); }

self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname === '/api/stream') return;
  if (url.origin === location.origin && url.pathname.startsWith('/api/')) {            // network first, fall back to last copy
    e.respondWith(fetch(req).then((r) => { if (r.ok) caches.open(DATA).then((c) => c.put(req, r.clone())); return r; }).catch(() => caches.match(req).then((m) => m || new Response(JSON.stringify({ error: 'offline' }), { status: 503, headers: { 'content-type': 'application/json' } }))));
    return;
  }
  if (/\.(png|jpg|jpeg)$/.test(url.pathname) && url.origin !== location.origin) {       // map tiles: cache first
    e.respondWith(caches.open(TILES).then(async (c) => { const m = await c.match(req); if (m) return m; try { const r = await fetch(req); c.put(req, r.clone()); trim(TILES, 600); return r; } catch { return m || Response.error(); } }));
    return;
  }
  if (url.origin === location.origin) {                                                  // shell: stale-while-revalidate
    e.respondWith(caches.open(SHELL).then(async (c) => { const m = await c.match(req); const net = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => m || (req.mode === 'navigate' ? c.match('/') : Response.error())); return m || net; }));
  }
});
