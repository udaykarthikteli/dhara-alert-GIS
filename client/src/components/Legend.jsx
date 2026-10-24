import { useState } from 'react';
import { LEVEL_COLOR, ROAD_COLOR, LEVELS, ago } from '../util.js';
import { useI18n } from '../i18n.jsx';

// Map key + headline numbers: what each colour means, how many sites sit at each level, and when the data was last updated.
const ROADS = [['open', 'Open', null], ['caution', 'Caution', '10 6'], ['risk', 'At risk', null], ['blocked', 'Blocked', '2 6']];

export default function Legend({ snap }) {
  const { t, level } = useI18n();
  const [open, setOpen] = useState(() => (typeof window === 'undefined' ? true : window.innerWidth >= 768));
  const s = snap?.summary;
  if (!s) return null;
  return (
    <div className="absolute bottom-7 right-3 z-[500] w-[13.5rem] border border-bone/15 bg-basalt/88 text-[13px] shadow-xl backdrop-blur-sm" role="region" aria-label="Map legend">
      <button onClick={() => setOpen((x) => !x)} aria-expanded={open} className="flex w-full items-center justify-between px-3 py-2 font-display text-[14px] font-semibold">
        <span>Risk levels</span><span className="text-bone/60" aria-hidden="true">{open ? '–' : '+'}</span>
      </button>
      {open && (
        <div className="border-t border-bone/10 px-3 pb-3 pt-2">
          <ul className="space-y-1">
            {LEVELS.map((l, i) => (
              <li key={l} className="flex items-center gap-2">
                <i className="inline-block h-3 w-3 shrink-0" style={{ background: LEVEL_COLOR[i] }} />
                <span className="flex-1">{level(l)}</span>
                <span className="tabular-nums text-bone/70">{s.counts?.[l] ?? 0}</span>
              </li>))}
          </ul>
          <ul className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-bone/10 pt-2.5 text-[12px] text-bone/80">
            {ROADS.map(([k, label, dash]) => (
              <li key={k} className="flex items-center gap-1.5">
                <svg width="22" height="6" aria-hidden="true"><line x1="1" y1="3" x2="21" y2="3" stroke={ROAD_COLOR[k]} strokeWidth="3" strokeLinecap="round" strokeDasharray={dash || undefined} /></svg>{label}
              </li>))}
          </ul>
          <div className="mt-2.5 grid grid-cols-3 gap-1 border-t border-bone/10 pt-2.5 text-center">
            {[[s.monitored, t('stat_sites')], [s.atRisk, t('stat_warn')], [s.roadsAffected, t('stat_roads')]].map(([v, k]) => (
              <div key={k}><div className="font-display text-lg font-extrabold leading-none tabular-nums">{v}</div><div className="mt-1 text-[10px] leading-tight text-bone/60">{k}</div></div>))}
          </div>
          {snap.updatedAt && <p className="mt-2 text-center text-[11px] text-bone/55">Updated {ago(snap.updatedAt)}</p>}
        </div>
      )}
    </div>
  );
}
