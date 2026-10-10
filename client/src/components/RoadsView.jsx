import { useState } from 'react';
import { ROAD_COLOR } from '../util.js';
import { useI18n } from '../i18n.jsx';
import { adminRoad, adminRoadClear } from '../api.js';

export default function RoadsView({ snap, token, reload }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState('');
  const set = async (id, status) => { setBusy(id); try { await adminRoad(token, id, { status, hours: 12, note: 'Set by district authority' }); await reload(); } finally { setBusy(''); } };
  const clear = async (id) => { setBusy(id); try { await adminRoadClear(token, id); await reload(); } finally { setBusy(''); } };
  return (
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-24 md:pb-10">
      <h2 className="font-display text-3xl font-bold">{t('roads_title')}</h2>
      <p className="mt-1 text-sm text-bone/60">Status comes from the worst slope within 30 km of each corridor, citizen "road blocked" reports, and authority overrides. Corridors are approximate alignments.</p>
      <ul className="mt-6 divide-y divide-bone/10 border-y border-bone/10">
        {snap.roads.map((r) => (
          <li key={r.id} className="py-4">
            <div className="flex items-center justify-between gap-3"><h3 className="font-display text-lg font-semibold">{r.name}</h3><span className="chip" style={{ '--c': ROAD_COLOR[r.status] }}>{t('road_' + r.status)}</span></div>
            <p className="mt-1 text-[13px] text-bone/60">{r.worstSite ? `Worst nearby slope: ${r.worstSite} (hazard ${Math.round(r.maxLhi)}).` : 'No monitored slope nearby.'} Source: {r.source}.{r.note ? ` ${r.note}` : ''}</p>
            {token && <div className="mt-3 flex flex-wrap gap-2">{['open', 'caution', 'risk', 'blocked'].map((s) => <button key={s} disabled={busy === r.id} onClick={() => set(r.id, s)} className="btn-ghost chip" style={{ '--c': ROAD_COLOR[s] }}>{t('road_' + s)}</button>)}{r.source === 'authority' && <button onClick={() => clear(r.id)} className="btn-ghost text-sm">Clear override</button>}</div>}
          </li>))}
      </ul>
    </div>
  );
}
