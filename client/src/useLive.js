import { useCallback, useEffect, useRef, useState } from 'react';
import { getSnapshot, getReports, getAlerts, getHealth } from './api.js';
import { flushQueue } from './offline.js';

export function useLive(onAlert) {
  const [snap, setSnap] = useState(null);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [error, setError] = useState(null);
  const [reports, setReports] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [health, setHealth] = useState(null);
  const [flushed, setFlushed] = useState(0);
  const alertRef = useRef(onAlert); alertRef.current = onAlert;

  const load = useCallback(async () => {
    try {
      const { data, offline: off } = await getSnapshot();
      setSnap(data); setOffline(off || !navigator.onLine); setError(null);
    } catch (e) { setError(e.status === 503 ? (e.body?.sources?.weather?.error ? 'weather-down' : 'warming') : 'unreachable'); }
    getReports().then(setReports); getAlerts().then(setAlerts);
  }, []);

  useEffect(() => {
    load(); getHealth().then(setHealth);
    const poll = setInterval(load, 60000);
    const warm = setInterval(() => setError((e) => { if (e === 'warming') load(); return e; }), 4000);
    const onOnline = () => { setOffline(false); flushQueue().then((n) => { if (n) { setFlushed(n); load(); } }); load(); };
    const onOffline = () => setOffline(true);
    window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline);
    flushQueue().then((n) => n && setFlushed(n));
    let es;
    try {
      es = new EventSource('/api/stream');
      es.addEventListener('snapshot', load);
      es.addEventListener('alert', (ev) => { const a = JSON.parse(ev.data); alertRef.current?.(a); getAlerts().then(setAlerts); });
    } catch {}
    return () => { clearInterval(poll); clearInterval(warm); window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); es && es.close(); };
  }, [load]);

  return { snap, offline, error, reports, alerts, health, flushed, reload: load, setReports };
}
