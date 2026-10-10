import { useCallback, useMemo, useState } from 'react';
import Background from './Background.jsx';
import MapView from './components/MapView.jsx';
import SitePanel from './components/SitePanel.jsx';
import Dashboard from './components/Dashboard.jsx';
import RoadsView from './components/RoadsView.jsx';
import ReportView from './components/ReportView.jsx';
import AlertsView from './components/AlertsView.jsx';
import SubscribeView from './components/SubscribeView.jsx';
import Home from './components/Home.jsx';
import { useLive } from './useLive.js';
import { useI18n } from './i18n.jsx';
import { LEVEL_COLOR, ago } from './util.js';
import { adminCheck } from './api.js';

const NAV = [['map', 'nav_map', 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z'], ['dash', 'nav_dash', 'M4 20V10m6 10V4m6 16v-7m4 7H2'], ['roads', 'nav_roads', 'M8 3L4 21M16 3l4 18M12 4v3m0 4v3m0 4v3'], ['report', 'nav_report', 'M12 5v14M5 12h14'], ['alerts', 'nav_alerts', 'M6 9a6 6 0 1112 0c0 6 2 7 2 7H4s2-1 2-7zm4 10a2 2 0 004 0'], ['sms', 'nav_sms', 'M4 5h16v11H9l-5 4z']];
const Icon = ({ d }) => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;

export default function App() {
  const { t, lang, setLang, LANGS } = useI18n();
  const [view, setView] = useState('home');
  const [selectedId, setSelectedId] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [token, setToken] = useState(() => sessionStorage.getItem('dhara.admin') || '');
  const [authOpen, setAuthOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);

  const onAlert = useCallback((a) => {
    const text = a.texts?.[lang] || a.texts?.en || `${a.site}: ${a.level}`;
    setToasts((x) => [{ id: a.id, text, level: a.level, siteId: a.siteId }, ...x].slice(0, 3));
    if (localStorage.getItem('dhara.notify') === '1' && 'Notification' in window && Notification.permission === 'granted') new Notification('Dhara Alert · ' + a.site, { body: text, icon: '/icon.svg' });
  }, [lang]);
  const { snap, offline, error, reports, alerts, health, flushed, reload, setReports } = useLive(onAlert);

  const risk = snap?.summary ? Math.min(1, snap.summary.maxLhi / 100) : 0.3;
  const selected = useMemo(() => snap?.sites.find((s) => s.id === selectedId) || null, [snap, selectedId]);
  const ranked = useMemo(() => (snap ? [...snap.sites].sort((a, b) => b.priority - a.priority) : []), [snap]);
  const live = snap && !snap.stale && !offline;
  const go = (v) => { setView(v); setListOpen(false); window.scrollTo(0, 0); };

  const tryAuth = async (e) => {
    e.preventDefault(); const v = new FormData(e.target).get('token');
    try { await adminCheck(v); sessionStorage.setItem('dhara.admin', v); setToken(v); setAuthOpen(false); } catch { alert('That authority token was not accepted.'); }
  };
  const logout = () => { sessionStorage.removeItem('dhara.admin'); setToken(''); setAuthOpen(false); };

  const needSnap = !['home'].includes(view);
  return (
    <div className="min-h-screen text-bone">
      <Background risk={risk} fps={view === 'home' ? 60 : 30} />
      <div className={`fixed inset-0 -z-[5] ${view === 'home' ? 'bg-gradient-to-t from-basalt/85 via-transparent to-basalt/30' : 'bg-basalt/70'}`} />

      <header className="fixed inset-x-0 top-0 z-30 flex items-center gap-3 border-b border-bone/10 bg-basalt/80 px-4 py-2.5 backdrop-blur-sm" style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}>
        <button onClick={() => go('home')} className="flex items-center gap-2.5" aria-label="Home">
          <img src="/icon.svg" alt="" className="h-8 w-8" /><span className="font-display text-xl font-bold tracking-tight">{t('title')}</span>
        </button>
        <nav className="ml-6 hidden gap-1 md:flex" aria-label="Main">
          {NAV.map(([k, label]) => <button key={k} onClick={() => go(k)} aria-current={view === k ? 'page' : undefined} className={`navlink ${view === k ? 'navlink-on' : ''}`}>{k === 'sms' ? t('nav_sms') : t(label)}</button>)}
        </nav>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <span className="hidden items-center gap-2 text-[13px] text-bone/70 sm:flex" title={snap?.updatedAt ? new Date(snap.updatedAt).toLocaleString() : ''}>
            <i className={`inline-block h-2 w-2 rounded-full ${live ? 'animate-pulse bg-moss' : 'bg-ochre'}`} />{live ? t('live') : t('stale')}{snap?.updatedAt ? ` · ${ago(snap.updatedAt)}` : ''}
          </span>
          <label className="sr-only" htmlFor="lang">{t('language')}</label>
          <select id="lang" value={lang} onChange={(e) => setLang(e.target.value)} className="field !py-1 text-sm">{LANGS.map((l) => <option key={l.code} value={l.code}>{l.native}{l.status !== 'reviewed' ? ' •' : ''}</option>)}</select>
          <div className="relative">
            <button onClick={() => (token ? logout() : setAuthOpen((x) => !x))} className={`btn-ghost text-sm ${token ? 'text-ochre' : ''}`} aria-expanded={authOpen}>{token ? `${t('authority')} ✓` : t('authority')}</button>
            {authOpen && !token && <form onSubmit={tryAuth} className="absolute right-0 top-11 w-64 border border-bone/15 bg-basalt p-3 shadow-xl"><label className="text-sm text-bone/70">Authority token<input name="token" type="password" autoFocus className="field mt-1 w-full" /></label><button className="btn-primary mt-2 w-full">Sign in</button></form>}
          </div>
        </div>
      </header>

      {(offline || flushed > 0) && <div className="fixed inset-x-0 top-[57px] z-20 bg-ochre px-4 py-1.5 text-center text-sm font-medium text-basalt">{offline ? t('offline') : `${flushed} queued report(s) sent.`}</div>}

      <div className="pointer-events-none fixed right-3 top-16 z-40 flex w-[min(24rem,92vw)] flex-col gap-2">
        {toasts.map((x) => (
          <div key={x.id} className="pointer-events-auto border-l-4 bg-basalt/95 p-3 text-[14px] shadow-2xl" style={{ borderColor: LEVEL_COLOR[['low', 'watch', 'warning', 'danger', 'critical'].indexOf(x.level)] }} role="alert">
            <p>{x.text}</p><div className="mt-2 flex gap-4 text-[13px]"><button className="underline" onClick={() => { setSelectedId(x.siteId); go('map'); setToasts((a) => a.filter((y) => y.id !== x.id)); }}>{t('nav_map')}</button><button className="text-bone/60" onClick={() => setToasts((a) => a.filter((y) => y.id !== x.id))}>Dismiss</button></div>
          </div>))}
      </div>

      {view === 'home' && <Home snap={snap} error={error} onEnter={() => go('map')} onSelect={setSelectedId} />}

      {needSnap && !snap && <div className="grid min-h-screen place-items-center px-6 text-center"><div><p className="font-display text-2xl">{error === 'unreachable' ? 'Cannot reach the Dhara Alert server.' : t('loading')}</p>{error === 'weather-down' && <p className="mt-2 text-bone/60">The weather source is not reachable from the server yet. Retrying automatically.</p>}</div></div>}

      {needSnap && snap && view === 'map' && (
        <div className="fixed inset-0 top-[53px] grid grid-cols-1 md:grid-cols-[19rem_1fr_auto]" style={{ bottom: 'var(--nav-h)' }}>
          <aside className={`${listOpen ? 'absolute inset-0 z-20' : 'hidden'} overflow-y-auto border-r border-bone/10 bg-basalt/90 md:static md:block md:bg-basalt/75`}>
            <h2 className="sticky top-0 border-b border-bone/10 bg-basalt/95 px-4 py-3 font-display text-base font-semibold">{t('sites_title')}</h2>
            <ol>{ranked.map((x) => (
              <li key={x.id}><button onClick={() => { setSelectedId(x.id); setListOpen(false); }} className={`grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-bone/[.07] px-4 py-2.5 text-left hover:bg-bone/[.05] ${selectedId === x.id ? 'bg-bone/[.08]' : ''}`}>
                <i className="h-8 w-1" style={{ background: LEVEL_COLOR[x.levelIndex] }} /><span><span className="block font-medium leading-tight">{x.name}</span><span className="text-[12px] text-bone/50">{x.state}</span></span>
                <span className="font-display text-lg font-bold tabular-nums">{Math.round(x.lhi)}</span></button></li>))}</ol>
          </aside>
          <div className="relative min-h-0"><MapView snap={snap} reports={reports} selectedId={selectedId} onSelect={setSelectedId} />
            <button onClick={() => setListOpen((x) => !x)} className="btn absolute bottom-4 left-3 z-[500] bg-basalt/90 md:hidden">{t('sites_title')}</button></div>
          {selected && <aside className="absolute inset-x-0 bottom-0 z-[600] max-h-[68%] border-t border-bone/15 bg-basalt/95 md:static md:max-h-none md:w-[24rem] md:border-l md:border-t-0 md:bg-basalt/85"><SitePanel site={selected} reports={reports} onClose={() => setSelectedId(null)} /></aside>}
        </div>
      )}
      {needSnap && snap && view === 'dash' && <Dashboard snap={snap} onSelect={setSelectedId} setView={go} />}
      {needSnap && snap && view === 'roads' && <RoadsView snap={snap} token={token} reload={reload} />}
      {view === 'report' && <ReportView reports={reports} token={token} reload={reload} setReports={setReports} />}
      {view === 'alerts' && <AlertsView alerts={alerts} onSelect={setSelectedId} setView={go} />}
      {needSnap && snap && view === 'sms' && <SubscribeView snap={snap} health={health} />}

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-bone/10 bg-basalt/92 backdrop-blur-sm md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} aria-label="Main">
        {NAV.map(([k, label, d]) => <button key={k} onClick={() => go(k)} aria-current={view === k ? 'page' : undefined} className={`flex flex-col items-center gap-0.5 py-2 text-[10.5px] ${view === k ? 'text-ember' : 'text-bone/65'}`}><Icon d={d} /><span className="max-w-full truncate px-0.5">{k === 'sms' ? 'SMS' : t(label)}</span></button>)}
      </nav>
    </div>
  );
}
