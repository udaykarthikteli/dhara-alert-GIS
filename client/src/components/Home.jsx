import { LEVEL_COLOR } from '../util.js';
import { useI18n } from '../i18n.jsx';

export default function Home({ snap, error, onEnter, onSelect, onGo = () => {} }) {
  const { t, level } = useI18n();
  const s = snap?.summary;
  const top = snap ? [...snap.sites].sort((a, b) => b.priority - a.priority).slice(0, 4) : [];
  return (
    <main className="relative mx-auto flex min-h-screen max-w-6xl flex-col justify-end px-6 pb-28 pt-28 md:justify-center md:pb-16">
      <div className="max-w-2xl">
        <h1 className="font-display text-[2.6rem] font-extrabold leading-[1.02] tracking-tight sm:text-6xl md:text-7xl" style={{ textShadow: '0 2px 30px rgba(0,0,0,.55)' }}>{t('tagline')}</h1>
        <p className="mt-5 max-w-xl text-lg leading-snug text-bone/85" style={{ textShadow: '0 1px 12px rgba(0,0,0,.7)' }}>{t('home_sub')}</p>
        <button onClick={onEnter} className="btn-primary mt-8 px-7 py-3.5 text-lg">{t('enter')}</button>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[15px] text-bone/80" style={{ textShadow: '0 1px 10px rgba(0,0,0,.7)' }}>
          <button onClick={() => onGo('compare')} className="underline-offset-4 hover:text-bone hover:underline">Compare sites</button>
          <button onClick={() => onGo('backtest')} className="underline-offset-4 hover:text-bone hover:underline">See a real past landslide replayed</button>
        </div>
      </div>
      <div className="mt-12 flex flex-wrap items-end gap-x-12 gap-y-6 md:mt-14">
        {s ? (<>
          {[[s.monitored, t('stat_sites')], [s.atRisk, t('stat_warn')], [s.roadsAffected, t('stat_roads')]].map(([v, k]) => (
            <div key={k}><div className="font-display text-5xl font-extrabold tabular-nums" style={{ textShadow: '0 2px 20px rgba(0,0,0,.6)' }}>{v}</div><div className="mt-0.5 text-sm text-bone/75">{k}</div></div>))}
          <ul className="min-w-[14rem] space-y-1.5 border-l border-bone/25 pl-6">
            {top.map((x) => (<li key={x.id}><button onClick={() => { onSelect(x.id); onEnter(); }} className="flex items-center gap-3 text-left text-[15px] hover:underline">
              <i className="inline-block h-2.5 w-2.5 shrink-0" style={{ background: LEVEL_COLOR[x.levelIndex] }} /><span>{x.name}</span><span className="tabular-nums text-bone/60">{Math.round(x.lhi)}</span></button></li>))}
          </ul></>
        ) : <p className="text-bone/70">{error === 'weather-down' ? 'The weather data source is not reachable from the server right now. Retrying…' : t('loading')}</p>}
      </div>
    </main>
  );
}
