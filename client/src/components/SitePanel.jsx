import { Gauge, ForecastChart, RainBars, FactorBar } from './charts.jsx';
import { LEVEL_COLOR, ACTIONS, ago, clock } from '../util.js';
import { useI18n } from '../i18n.jsx';
import { haversineKm } from '../geo.js';

export default function SitePanel({ site, reports, onClose }) {
  const { t, level } = useI18n();
  if (!site) return null;
  const near = reports.filter((r) => haversineKm(site, r) <= 3).slice(0, 4);
  const f = site.features;
  const peakSoon = site.peak && site.peak.lhi > site.lhi + 5;
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-start justify-between gap-3 border-b border-bone/10 px-5 py-4">
        <div>
          <h2 className="font-display text-2xl font-bold leading-tight">{site.name}</h2>
          <p className="mt-0.5 text-sm text-bone/60">{site.state} · {site.elev} m · steepest nearby slope {Math.round(site.slope)}°</p>
        </div>
        <button onClick={onClose} className="btn-ghost -mr-2" aria-label="Close">✕</button>
      </div>

      <section className="px-5 pt-4">
        <div className="flex items-center gap-4">
          <Gauge value={site.lhi} />
          <div>
            <div className="font-display text-xl font-bold" style={{ color: LEVEL_COLOR[site.levelIndex] }}>{level(site.level)}</div>
            <div className="text-[13px] text-bone/60">{t('lhi')}</div>
            <div className="mt-1 text-[13px] text-bone/60">{t('priority')}: <b className="text-bone">{site.priority}</b>/100</div>
          </div>
        </div>
        <p className="mt-3 border-l-2 pl-3 text-[14px] leading-snug text-bone/85" style={{ borderColor: LEVEL_COLOR[site.levelIndex] }}>{ACTIONS[site.levelIndex]}</p>
      </section>

      <section className="grid grid-cols-3 gap-px px-5 pt-5 text-center">
        {[[t('fos'), site.fs.toFixed(2), site.fs < 1 ? 'text-crimson' : site.fs < 1.3 ? 'text-ember' : 'text-moss'], [t('rain24'), site.rain.r24 + ' mm', ''], [t('saturation'), Math.round(site.saturation * 100) + '%', '']].map(([k, v, c]) => (
          <div key={k} className="bg-bone/[.04] px-1 py-3"><div className={`font-display text-xl font-bold tabular-nums ${c}`}>{v}</div><div className="mt-0.5 text-[11.5px] leading-tight text-bone/60">{k}</div></div>
        ))}
      </section>

      <section className="px-5 pt-5">
        <h3 className="mb-1 font-display text-[15px] font-semibold">{t('forecast72')}</h3>
        <ForecastChart forecast={site.forecast} />
        {peakSoon && <p className="mt-1 text-[13px] text-ember">Peak {Math.round(site.peak.lhi)} expected {clock(site.peak.t)} IST.</p>}
        <div className="mt-3"><RainBars series={site.series} /></div>
      </section>

      <section className="space-y-3 px-5 pt-5">
        <h3 className="font-display text-[15px] font-semibold">Why this score</h3>
        <FactorBar label="Slope close to failure (Mohr-Coulomb)" value={f.fs} hint="Hazard from the Factor of Safety" />
        <FactorBar label={`Rain vs. Caine threshold (${site.ratio.toFixed(2)}×)`} value={f.rain} hint="Intensity–duration exceedance" />
        <FactorBar label="Soil wetness" value={f.sat} />
        <FactorBar label="Last 7 days of rain" value={f.antec} />
        <FactorBar label={`Ground shaking (kh ${site.seismic.kh})`} value={f.seis} />
        <FactorBar label="Nearby citizen reports" value={f.cit} />
        <p className="pt-1 text-[12px] leading-snug text-bone/45">Soil: {site.geology}. Strength values are typical for this rock type, not surveyed on this slope.</p>
      </section>

      <section className="px-5 pb-6 pt-5">
        <h3 className="mb-2 font-display text-[15px] font-semibold">Reports within 3 km</h3>
        {!near.length && <p className="text-[13px] text-bone/50">None in the last 7 days.</p>}
        <ul className="space-y-2">{near.map((r) => (
          <li key={r.id} className="flex gap-3 text-[13px]">
            {r.media && r.mediaType === 'image' ? <img src={r.media} alt="" className="h-12 w-12 object-cover" loading="lazy" /> : <div className="h-12 w-12 bg-bone/10" />}
            <div><div className="font-medium">{t('t_' + r.type)} <span className={r.status === 'verified' ? 'text-moss' : 'text-ochre'}>· {t(r.status)}</span></div><div className="text-bone/60">{r.note || ' '}</div><div className="text-bone/40">{ago(r.createdAt)}</div></div>
          </li>))}</ul>
      </section>
    </div>
  );
}
