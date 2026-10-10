import { LevelStrip, ForecastMatrix } from './charts.jsx';
import { LEVEL_COLOR, ROAD_COLOR } from '../util.js';
import { useI18n } from '../i18n.jsx';

export default function Dashboard({ snap, onSelect, setView }) {
  const { t, level } = useI18n();
  const s = snap.summary;
  const top = [...snap.sites].sort((a, b) => b.priority - a.priority).slice(0, 10);
  return (
    <div className="mx-auto grid max-w-6xl gap-x-10 gap-y-8 px-5 pb-24 pt-24 md:grid-cols-[1.15fr_1fr] md:pb-10">
      <section className="panel md:col-span-2">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><h2 className="font-display text-3xl font-bold">{t('nav_dash')}</h2><p className="mt-1 text-sm text-bone/60">{s.monitored} slopes, {s.roadsTotal} road corridors, {s.quakes24h} earthquakes in the last 24 h.</p></div>
          <div className="flex gap-8">
            {[[s.atRisk, t('stat_warn')], [s.roadsAffected, t('stat_roads')], [Math.round(s.maxLhi), t('hazard_now')]].map(([v, k]) => <div key={k}><div className="font-display text-3xl font-extrabold tabular-nums">{v}</div><div className="text-[12.5px] text-bone/60">{k}</div></div>)}
          </div>
        </div>
        <div className="mt-5"><LevelStrip counts={s.counts} total={s.monitored} />
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-bone/70">{['low', 'watch', 'warning', 'danger', 'critical'].map((k, i) => <span key={k} className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5" style={{ background: LEVEL_COLOR[i] }} />{level(k)} {s.counts[k]}</span>)}</div></div>
      </section>

      <section className="panel">
        <h3 className="h3">{t('sites_title')}</h3>
        <ol className="mt-2 divide-y divide-bone/10">{top.map((x) => (
          <li key={x.id}><button onClick={() => { onSelect(x.id); setView('map'); }} className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-3 py-2.5 text-left hover:bg-bone/[.04]">
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
