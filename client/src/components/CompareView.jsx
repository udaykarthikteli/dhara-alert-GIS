import { useMemo, useState } from 'react';
import { LEVEL_COLOR } from '../util.js';
import { LV, outlook } from '../outlook.js';

const LINE = ['#e8803a', '#8fc4bb', '#dcae52'];
const ROWS = [
  ['Hazard index (0-100)', (s) => Math.round(s.lhi), 'max'],
  ['Factor of safety', (s) => s.fs.toFixed(2), 'min', (s) => s.fs],
  ['Rain, last 24 h (mm)', (s) => s.rain.r24, 'max'],
  ['Rain, last 72 h (mm)', (s) => Math.round(s.rain.r72), 'max', (s) => s.rain.r72],
  ['Rain, last 7 days (mm)', (s) => Math.round(s.rain.r168), 'max', (s) => s.rain.r168],
  ['Soil wetness', (s) => Math.round(s.saturation * 100) + '%', 'max', (s) => s.saturation],
  ['Steepest nearby slope', (s) => Math.round(s.slope) + '°', 'max', (s) => s.slope],
  ['Elevation', (s) => (s.elev == null ? '–' : s.elev + ' m'), null],
  ['Soil type', (s) => s.geology, null],
  ['Population (approx.)', (s) => (s.pop || 0).toLocaleString('en-IN'), null],
];

function Overlay({ sites }) {
  const W = 640, H = 210, pl = 30, pr = 12, pt = 12, pb = 24;
  const f0 = sites[0].forecast, t0 = f0[0].t, t1 = f0[f0.length - 1].t;
  const x = (t) => pl + ((t - t0) / (t1 - t0 || 1)) * (W - pl - pr);
  const y = (v) => pt + (1 - v / 100) * (H - pt - pb);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="72 hour hazard forecast for the selected sites">
      {[[0, 20], [20, 40], [40, 60], [60, 80], [80, 100]].map(([a, b], i) => <rect key={i} x={pl} width={W - pl - pr} y={y(b)} height={y(a) - y(b)} fill={LEVEL_COLOR[i]} opacity=".07" />)}
      {[20, 40, 60, 80].map((v) => <g key={v}><line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} stroke="rgba(239,228,211,.14)" strokeDasharray="2 4" /><text x={pl - 5} y={y(v) + 3} textAnchor="end" fontSize="10" fill="rgba(239,228,211,.55)">{v}</text></g>)}
      {sites.map((s, k) => <path key={s.id} d={s.forecast.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.lhi).toFixed(1)}`).join(' ')} fill="none" stroke={LINE[k]} strokeWidth="2.6" strokeLinejoin="round" />)}
      {[0, 24, 48, 72].map((h, i) => <text key={h} x={Math.min(x(t0 + h * 3600e3), W - pr)} y={H - 7} textAnchor={i === 0 ? 'start' : i === 3 ? 'end' : 'middle'} fontSize="10" fill="rgba(239,228,211,.65)">{i === 0 ? 'now' : `+${h} h`}</text>)}
    </svg>
  );
}

export default function CompareView({ snap, ids, setIds }) {
  const [copied, setCopied] = useState(false);
  const ranked = useMemo(() => [...snap.sites].sort((a, b) => b.priority - a.priority), [snap]);
  const byId = useMemo(() => Object.fromEntries(snap.sites.map((s) => [s.id, s])), [snap]);
  const chosen = (ids || []).filter((i) => byId[i]).slice(0, 3);
  const eff = chosen.length ? chosen : ranked.slice(0, 3).map((s) => s.id);
  const sites = eff.map((i) => byId[i]);
  const set = (slot, id) => { const n = [...eff]; if (id === '') n.splice(slot, 1); else n[slot] = id; setIds([...new Set(n)].slice(0, 3)); };
  const copy = async () => {
    const url = `${window.location.origin}${window.location.pathname}#compare=${eff.map(encodeURIComponent).join(',')}`;
    try { await navigator.clipboard.writeText(url); } catch { window.prompt('Copy this link', url); }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  const worst = (row) => {
    const [, , mode, num] = row; if (!mode || sites.length < 2) return -1;
    const vals = sites.map((s) => (num ? num(s) : s.lhi));
    const best = mode === 'max' ? Math.max(...vals) : Math.min(...vals);
    return vals.every((v) => v === vals[0]) ? -1 : vals.indexOf(best);
  };
  return (
    <main className="mx-auto max-w-5xl px-4 pb-28 pt-24 md:pb-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-display text-3xl font-extrabold">Compare sites</h1><p className="mt-1 text-bone/65">Put up to three sites side by side. The riskiest value in each row is highlighted.</p></div>
        <button onClick={copy} className="btn">{copied ? 'Link copied' : 'Share this comparison'}</button>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((slot) => (
          <label key={slot} className="block text-[13px] text-bone/60"><span className="mb-1 flex items-center gap-2"><i className="inline-block h-2.5 w-5" style={{ background: LINE[slot] }} />Site {slot + 1}{slot === 2 ? ' (optional)' : ''}</span>
            <select value={eff[slot] || ''} onChange={(e) => set(slot, e.target.value)} className="field w-full text-[15px] text-bone">
              {slot > 1 && <option value="">None</option>}
              {ranked.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.state}</option>)}
            </select></label>))}
      </div>
      <section className="panel mt-6"><h2 className="h3 mb-2">Hazard forecast, next 72 h</h2>
        <Overlay sites={sites} />
        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">{sites.map((s, k) => <li key={s.id} className="flex items-center gap-2"><i className="inline-block h-[3px] w-5" style={{ background: LINE[k] }} />{s.name}</li>)}</ul>
      </section>
      <section className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-left text-[15px]">
          <thead><tr className="border-b border-bone/20"><th className="py-2 pr-3 font-normal text-bone/55"> </th>{sites.map((s, k) => <th key={s.id} className="px-3 py-2 align-bottom"><div className="font-display text-lg font-bold" style={{ borderBottom: `3px solid ${LINE[k]}` }}>{s.name}</div><div className="pt-1 text-[12px] font-normal text-bone/55">{s.state}</div></th>)}</tr></thead>
          <tbody>
            <tr className="border-b border-bone/10"><td className="py-2.5 pr-3 text-bone/65">Risk level</td>{sites.map((s) => <td key={s.id} className="px-3 py-2.5 font-display text-lg font-bold" style={{ color: LEVEL_COLOR[s.levelIndex] }}>{LV[s.levelIndex]}</td>)}</tr>
            <tr className="border-b border-bone/10"><td className="py-2.5 pr-3 text-bone/65">Outlook</td>{sites.map((s) => { const o = outlook(s.forecast); return <td key={s.id} className="px-3 py-2.5 text-[14px]" style={{ color: o ? LEVEL_COLOR[o.level] : undefined }}>{o ? o.headline : '–'}</td>; })}</tr>
            {ROWS.map((row) => { const w = worst(row); return (
              <tr key={row[0]} className="border-b border-bone/10"><td className="py-2.5 pr-3 text-bone/65">{row[0]}</td>
                {sites.map((s, k) => <td key={s.id} className={`px-3 py-2.5 tabular-nums ${k === w ? 'bg-ember/10 font-semibold text-ember' : ''}`}>{row[1](s)}</td>)}</tr>); })}
          </tbody>
        </table>
      </section>
    </main>
  );
}
