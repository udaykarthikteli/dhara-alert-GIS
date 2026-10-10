import { LEVEL_COLOR, levelIdx, ago, clock } from '../util.js';
import { useI18n } from '../i18n.jsx';

export default function AlertsView({ alerts, onSelect, setView }) {
  const { t, lang, level } = useI18n();
  return (
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-24 md:pb-10">
      <h2 className="font-display text-3xl font-bold">{t('alerts_title')}</h2>
      {!alerts.length && <p className="mt-6 text-bone/60">{t('no_alerts')}</p>}
      <ul className="mt-6 divide-y divide-bone/10 border-y border-bone/10">
        {alerts.map((a) => (
          <li key={a.id} className="py-4">
            <div className="flex items-center justify-between gap-3">
              <button className="text-left font-display text-lg font-semibold hover:underline" onClick={() => { onSelect(a.siteId); setView('map'); }}>{a.site}, {a.state}</button>
              <span className="chip" style={{ '--c': LEVEL_COLOR[levelIdx(a.level)] }}>{level(a.level)}</span>
            </div>
            <p className="mt-1 text-[14px] leading-snug text-bone/85">{a.texts[lang] || a.texts.en}</p>
            <p className="mt-1.5 text-[12.5px] text-bone/50">
              {a.type === 'forecast' ? `Forecast: reaches ${a.level} around ${clock(a.peakAt)} IST` : 'Reached now'} · {ago(a.createdAt)}
              {a.sms.provider ? ` · SMS ${a.sms.sent}/${a.sms.attempted}` : ''}
            </p>
          </li>))}
      </ul>
    </div>
  );
}
