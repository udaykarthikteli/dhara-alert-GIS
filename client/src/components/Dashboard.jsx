import { useMemo } from 'react';
import { LevelStrip, ForecastMatrix } from './charts.jsx';
import { LEVEL_COLOR, ROAD_COLOR, colorOfLhi, ago, clock } from '../util.js';
import { useI18n } from '../i18n.jsx';
import { adminReport } from '../api.js';

const levelOfLhi = (v) => (v >= 80 ? 4 : v >= 60 ? 3 : v >= 40 ? 2 : v >= 20 ? 1 : 0);
const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });
const full = new Intl.NumberFormat('en-IN');
const km = (a, b) => { const r = (d) => (d * Math.PI) / 180, dl = r(b.lat - a.lat), dn = r(b.lng - a.lng); const h = Math.sin(dl / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dn / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
const Dot = ({ ok }) => <i className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: ok === true ? '#74ab78' : ok === false ? '#e0472f' : '#dcae52' }} />;

export default function Dashboard({ snap, reports = [], health, token, reload, onSelect, setView }) {
  const { t, level } = useI18n();
  const s = snap.summary;
  const now = Date.now();
  const top = [...snap.sites].sort((a, b) => b.priority - a.priority).slice(0, 10);
  const go = (id) => { onSelect(id); setView('map'); };

  // 1) people living at slopes that are at Warning or above (the population figure stored per site is approximate)
  const exposed = snap.sites.filter((x) => x.levelIndex >= 2).reduce((a, x) => a + (x.pop || 0), 0);

  // 2) state-wise summary
  const states = useMemo(() => {
    const m = new Map();
    for (const x of snap.sites) {
      const g = m.get(x.state) || { state: x.state, n: 0, warn: 0, max: -1, worst: null, people: 0 };
      g.n++; if (x.levelIndex >= 2) { g.warn++; g.people += x.pop || 0; }
      if (x.lhi > g.max) { g.max = x.lhi; g.worst = x; }
      m.set(x.state, g);
    }
    return [...m.values()].sort((a, b) => b.max - a.max);
  }, [snap]);

  // 3) next 24 hours: slopes forecast to reach Danger (hazard 60+), with the time and the lead time
  const outlook = snap.sites.map((x) => {
    const win = x.forecast.filter((f) => f.t >= now - 3600e3 && f.t - now <= 24 * 3600e3);
    if (!win.length) return null;
    const peak = win.reduce((a, b) => (b.lhi > a.lhi ? b : a));
    const first = win.find((f) => f.lhi >= 60 && f.t >= now - 3600e3);
    return peak.lhi >= 60 ? { x, peak, first } : null;
  }).filter(Boolean).sort((a, b) => b.peak.lhi - a.peak.lhi);

  // 4) citizen reports
  const recent = [...reports].filter((r) => r.status !== 'rejected').sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);
  const openCount = reports.filter((r) => r.status === 'unverified' && now - r.createdAt < 48 * 3600e3).length;
  const verifiedCount = reports.filter((r) => r.status === 'verified').length;
  const nearest = (r) => snap.sites.reduce((a, x) => (!a || km(r, x) < km(r, a) ? x : a), null);
  const act = async (id, status) => { try { await adminReport(token, id, status); reload(); } catch (e) { alert(e.message); } };

  // data health
  const src = snap.sources || {};
  const feed = (f, live, down) => (f?.ok ? { ok: true, text: `${live} · updated ${ago(f.at)}` } : { ok: f ? false : null, text: f?.error ? down : 'waiting for first data' });
  const rows = [
    ['Weather and soil moisture (Open-Meteo)', feed(src.weather, 'live', 'unavailable, showing the last data')],
    ['Earthquakes (USGS, last 30 days)', feed(src.quakes, 'live', 'unavailable')],
    ['Terrain and slope (Open-Meteo elevation)', feed(src.terrain, 'loaded', 'unavailable')],
    ['Risk model', { ok: null, text: snap.model === 'expert-prior' ? 'expert-set weights, not yet trained on past landslides' : snap.model }],
    ['Soil strength values', { ok: null, text: 'typical values per rock type, not surveyed' }],
    ['Phone alerts', { ok: health?.sms ? true : null, text: health?.sms ? 'SMS on' : 'SMS off, alerts show inside the app' }],
  ];

  return (
    <div className="mx-auto grid max-w-6xl gap-x-10 gap-y-8 px-5 pb-24 pt-24 md:grid-cols-[1.15fr_1fr] md:pb-10">
      <section className="panel md:col-span-2">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><h2 className="font-display text-3xl font-bold">{t('nav_dash')}</h2><p className="mt-1 text-sm text-bone/60">{s.monitored} slopes, {s.roadsTotal} road corridors, {s.quakes24h} earthquakes in the last 24 h.</p></div>
          <div className="flex flex-wrap gap-8">
            {[[s.atRisk, t('stat_warn')], [compact.format(exposed), 'People near them (approx.)'], [s.roadsAffected, t('stat_roads')], [Math.round(s.maxLhi), t('hazard_now')]].map(([v, k]) => <div key={k}><div className="font-display text-3xl font-extrabold tabular-nums">{v}</div><div className="text-[12.5px] text-bone/60">{k}</div></div>)}
          </div>
        </div>
        <div className="mt-5"><LevelStrip counts={s.counts} total={s.monitored} />
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-bone/70">{['low', 'watch', 'warning', 'danger', 'critical'].map((k, i) => <span key={k} className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5" style={{ background: LEVEL_COLOR[i] }} />{level(k)} {s.counts[k]}</span>)}</div></div>
      </section>

      <section className="panel">
        <h3 className="h3">Next 24 hours</h3>
        <p className="mt-1 text-[13px] text-bone/55">{outlook.length ? `${outlook.length} slope${outlook.length > 1 ? 's' : ''} forecast to reach Danger or above.` : 'No slope is forecast to reach Danger in the next 24 hours.'}</p>
        <ul className="mt-2 divide-y divide-bone/10">{outlook.slice(0, 8).map(({ x, peak, first }) => {
          const hrs = first ? Math.max(0, Math.round((first.t - now) / 3600e3)) : 0;
          return (<li key={x.id}><button onClick={() => go(x.id)} className="grid w-full grid-cols-[1fr_auto] items-center gap-3 py-2.5 text-left hover:bg-bone/[.04]">
            <span><span className="font-medium">{x.name}</span> <span className="text-[12.5px] text-bone/50">{x.state}</span>
              <span className="block text-[12.5px] text-bone/60">{x.levelIndex >= 3 ? `Already at ${level(x.level)}` : hrs === 0 ? 'Reaches Danger within the hour' : `Reaches Danger in about ${hrs} h`} · peak around {clock(peak.t)} IST</span></span>
            <span className="font-display text-sm font-bold tabular-nums"><span className="text-bone/50">{Math.round(x.lhi)} → </span><span style={{ color: colorOfLhi(peak.lhi) }}>{Math.round(peak.lhi)}</span></span>
          </button></li>); })}</ul>
      </section>

      <section className="panel">
        <h3 className="h3">Data health</h3>
        <ul className="mt-2 divide-y divide-bone/10 text-[14px]">{rows.map(([label, r]) => (
          <li key={label} className="py-2.5"><div><Dot ok={r.ok} />{label}</div><div className="pl-[18px] text-[12.5px] text-bone/55">{r.text}</div></li>))}</ul>
      </section>

      <section className="panel">
        <h3 className="h3">By state</h3>
        <div className="mt-2 overflow-x-auto"><table className="w-full text-left text-[14px]">
          <thead><tr className="text-[12px] uppercase tracking-wide text-bone/45"><th className="pb-1.5 pr-3 font-medium">State</th><th className="pb-1.5 pr-3 font-medium">At Warning+</th><th className="pb-1.5 pr-3 font-medium">Highest</th><th className="pb-1.5 text-right font-medium">People (approx.)</th></tr></thead>
          <tbody className="divide-y divide-bone/10">{states.map((g) => (
            <tr key={g.state} className="cursor-pointer hover:bg-bone/[.04]" onClick={() => go(g.worst.id)}>
              <td className="py-2.5 pr-3 font-medium">{g.state}</td>
              <td className="py-2.5 pr-3 tabular-nums">{g.warn} / {g.n}</td>
              <td className="py-2.5 pr-3 tabular-nums"><span className="px-1.5 font-display font-bold text-basalt" style={{ background: colorOfLhi(g.max) }}>{Math.round(g.max)}</span></td>
              <td className="py-2.5 text-right tabular-nums text-bone/75">{g.people ? full.format(g.people) : '–'}</td>
            </tr>))}</tbody></table></div>
      </section>

      <section className="panel">
        <div className="flex items-baseline justify-between"><h3 className="h3">Citizen reports</h3><button className="text-[13px] text-bone/60 underline" onClick={() => setView('report')}>Open reports page</button></div>
        <p className="mt-1 text-[13px] text-bone/55">{openCount} waiting for verification (last 48 h) · {verifiedCount} verified in total</p>
        {!recent.length && <p className="mt-3 text-[14px] text-bone/60">No reports yet. Reports from the public appear here.</p>}
        <ul className="mt-2 divide-y divide-bone/10">{recent.map((r) => { const n = nearest(r); return (
          <li key={r.id} className="py-2.5 text-[14px]">
            <div className="flex items-center justify-between gap-3"><span className="font-medium">{t('t_' + r.type)}</span><span className="chip" style={{ '--c': r.status === 'verified' ? '#74ab78' : '#dcae52' }}>{t(r.status)}</span></div>
            <div className="text-[12.5px] text-bone/55">{n && <button className="underline" onClick={() => go(n.id)}>near {n.name}</button>} · {ago(r.createdAt)}{r.note ? ` · ${r.note.slice(0, 70)}` : ''}</div>
            {token && r.status === 'unverified' && <div className="mt-1 flex gap-3 text-[13px]"><button className="text-moss underline" onClick={() => act(r.id, 'verified')}>{t('verify')}</button><button className="text-ember underline" onClick={() => act(r.id, 'rejected')}>{t('reject')}</button></div>}
          </li>); })}</ul>
        {!token && recent.some((r) => r.status === 'unverified') && <p className="mt-2 text-[12.5px] text-bone/45">Log in as Authority (top right) to verify or reject reports here.</p>}
      </section>

      <section className="panel">
        <h3 className="h3">{t('sites_title')}</h3>
        <ol className="mt-2 divide-y divide-bone/10">{top.map((x) => (
          <li key={x.id}><button onClick={() => go(x.id)} className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-3 py-2.5 text-left hover:bg-bone/[.04]">
            <span><span className="font-medium">{x.name}</span> <span className="text-[12.5px] text-bone/50">{x.state}</span></span>
            <span className="text-[12.5px] tabular-nums text-bone/60">LHI {Math.round(x.lhi)}</span>
            <span className="min-w-[2.6rem] px-2 py-0.5 text-center font-display text-sm font-bold tabular-nums text-basalt" style={{ background: LEVEL_COLOR[x.levelIndex] }}>{x.priority}</span>
          </button></li>))}</ol>
      </section>

      <section className="panel">
        <h3 className="h3">{t('roads_title')}</h3>
        <ul className="mt-2 divide-y divide-bone/10">{snap.roads.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-[14px]">
            <span>{r.name}{r.worstSite && <span className="block text-[12px] text-bone/50">worst: {r.worstSite} ({Math.round(r.maxLhi)}){r.source !== 'model' ? ` · by ${r.source}` : ''}</span>}</span>
            <span className="chip" style={{ '--c': ROAD_COLOR[r.status] }}>{t('road_' + r.status)}</span>
          </li>))}</ul>
      </section>

      <section className="panel md:col-span-2">
        <div className="flex items-baseline justify-between"><h3 className="h3">{t('forecast_matrix')}</h3><span className="text-[12.5px] text-bone/50">{t('next72')} · 3-hour steps</span></div>
        <div className="mt-3"><ForecastMatrix sites={snap.sites} /></div>
      </section>
    </div>
  );
}
