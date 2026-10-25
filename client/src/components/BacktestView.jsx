import { useEffect, useMemo, useState } from 'react';
import { LEVEL_COLOR, colorOfLhi } from '../util.js';
import { fmtH, LV } from '../outlook.js';

const fmt = (ms) => new Date(ms).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
const fmtDay = (ms) => new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

function Replay({ ev }) {
  const W = 680, H = 230, pl = 30, pr = 14, pt = 14, pb = 26;
  const s = ev.series, t0 = s[0].t, t1 = s[s.length - 1].t;
  const x = (t) => pl + ((t - t0) / (t1 - t0 || 1)) * (W - pl - pr);
  const y = (v) => pt + (1 - v / 100) * (H - pt - pb);
  const line = s.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.lhi).toFixed(1)}`).join(' ');
  const warnAt = ev.leadWarningH != null ? ev.eventAt - ev.leadWarningH * 3600e3 : null;
  const dangerAt = ev.leadDangerH != null ? ev.eventAt - ev.leadDangerH * 3600e3 : null;
  const maxRain = Math.max(1, ...ev.rain3h.map((r) => r.mm));
  const bw = Math.max(1.5, (W - pl - pr) / ev.rain3h.length - 1);
  const days = [];
  for (let d = Math.ceil(t0 / 864e5) * 864e5; d <= t1; d += 864e5) days.push(d);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Replay of the hazard index around ${ev.title}`}>
        {[[0, 20], [20, 40], [40, 60], [60, 80], [80, 100]].map(([a, b], i) => <rect key={i} x={pl} width={W - pl - pr} y={y(b)} height={y(a) - y(b)} fill={LEVEL_COLOR[i]} opacity=".08" />)}
        {[20, 40, 60, 80].map((v) => <g key={v}><line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} stroke="rgba(239,228,211,.14)" strokeDasharray="2 4" /><text x={pl - 5} y={y(v) + 3} textAnchor="end" fontSize="10" fill="rgba(239,228,211,.55)">{v}</text></g>)}
        <path d={`${line} L${x(t1)} ${y(0)} L${x(t0)} ${y(0)} Z`} fill="#e8803a" opacity=".14" />
        <path d={line} fill="none" stroke="#e8803a" strokeWidth="2.8" strokeLinejoin="round" />
        {warnAt && <g><line x1={x(warnAt)} x2={x(warnAt)} y1={pt} y2={H - pb} stroke={LEVEL_COLOR[2]} strokeDasharray="3 3" /><text x={x(warnAt)} y={pt + 9} textAnchor="middle" fontSize="10" fontWeight="700" fill={LEVEL_COLOR[2]}>Warning</text></g>}
        {dangerAt && <g><line x1={x(dangerAt)} x2={x(dangerAt)} y1={pt} y2={H - pb} stroke={LEVEL_COLOR[3]} strokeDasharray="3 3" /><text x={x(dangerAt)} y={pt + 21} textAnchor="middle" fontSize="10" fontWeight="700" fill={LEVEL_COLOR[3]}>Danger</text></g>}
        <line x1={x(ev.eventAt)} x2={x(ev.eventAt)} y1={pt} y2={H - pb} stroke="#efe4d3" strokeWidth="2" />
        <text x={x(ev.eventAt) - 5} y={pt + 9} textAnchor="end" fontSize="10.5" fontWeight="700" fill="#efe4d3">Landslide</text>
        {days.map((d) => <text key={d} x={x(d)} y={H - 8} textAnchor="middle" fontSize="9.5" fill="rgba(239,228,211,.6)">{fmtDay(d)}</text>)}
      </svg>
      <svg viewBox={`0 0 ${W} 70`} className="mt-1 w-full" role="img" aria-label="Rainfall per 3 hours">
        {ev.rain3h.map((r) => <rect key={r.t} x={x(r.t) - bw / 2} width={bw} y={64 - (r.mm / maxRain) * 52} height={(r.mm / maxRain) * 52} fill="#8fc4bb" opacity=".85" />)}
        <line x1={x(ev.eventAt)} x2={x(ev.eventAt)} y1="4" y2="64" stroke="#efe4d3" strokeWidth="2" />
        <text x={pl} y="10" fontSize="10" fill="rgba(239,228,211,.65)">Rain per 3 h (peak {Math.round(maxRain)} mm)</text>
      </svg>
    </div>
  );
}

export default function BacktestView({ eventId, setEventId }) {
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading');
  useEffect(() => {
    let off = false;
    fetch('/api/backtest').then(async (r) => { if (r.status === 404) return off || setState('missing'); if (!r.ok) throw new Error(); const d = await r.json(); if (!off) { setData(d); setState('ok'); } }).catch(() => !off && setState('error'));
    return () => { off = true; };
  }, []);
  const ev = useMemo(() => (data ? data.events.find((e) => e.id === eventId) || data.events[0] : null), [data, eventId]);

  return (
    <main className="mx-auto max-w-4xl px-4 pb-28 pt-24 md:pb-12">
      <h1 className="font-display text-3xl font-extrabold">Past event replay</h1>
      <p className="mt-1 max-w-2xl text-bone/70">What would Dhara Alert have shown in the days before a real landslide? Each replay runs historical rain and soil-moisture data through the same model the live map uses.</p>

      {state === 'loading' && <p className="mt-8 text-bone/60">Loading…</p>}
      {state === 'error' && <p className="mt-8 text-bone/70">Could not load the replays. Check that the server is running.</p>}
      {state === 'missing' && (
        <div className="mt-8 border border-ochre/40 bg-bone/[.04] p-4 text-[15px] leading-relaxed">
          <p className="font-medium text-ochre">Replays have not been built yet.</p>
          <p className="mt-1 text-bone/80">On a computer that can reach Open-Meteo, run <code className="bg-basalt px-1.5 py-0.5">npm run build:backtest</code>, then commit <code className="bg-basalt px-1.5 py-0.5">server/seed/backtest.json</code> and redeploy.</p>
        </div>)}

      {state === 'ok' && ev && (<>
        <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Past events">
          {data.events.map((e) => <button key={e.id} role="tab" aria-selected={e.id === ev.id} onClick={() => setEventId(e.id)} className={`chip-btn ${e.id === ev.id ? 'chip-on' : ''}`}>{e.title.split(',')[0]}</button>)}
        </div>
        <section className="panel mt-5">
          <h2 className="font-display text-xl font-bold">{ev.title}</h2>
          <p className="mt-1 text-[15px] text-bone/80">{ev.summary}</p>
          <p className="mt-1 text-[12.5px] text-bone/50">Monitored site: {ev.siteName}, {ev.state}. {ev.dateNote}</p>
          <div className="mt-4 grid gap-px sm:grid-cols-3">
            {[
              ['Warning reached', ev.leadWarningH != null ? `${fmtH(ev.leadWarningH)} before` : 'Not reached', ev.leadWarningH != null ? LEVEL_COLOR[2] : '#c0264b'],
              ['Danger reached', ev.leadDangerH != null ? `${fmtH(ev.leadDangerH)} before` : 'Not reached', ev.leadDangerH != null ? LEVEL_COLOR[3] : '#c0264b'],
              ['Index at the event', ev.lhiAtEvent != null ? `${Math.round(ev.lhiAtEvent)} (${LV[ev.lhiAtEvent >= 80 ? 4 : ev.lhiAtEvent >= 60 ? 3 : ev.lhiAtEvent >= 40 ? 2 : ev.lhiAtEvent >= 20 ? 1 : 0]})` : '–', colorOfLhi(ev.lhiAtEvent || 0)],
            ].map(([k, v, c]) => <div key={k} className="bg-bone/[.04] px-4 py-3"><div className="font-display text-2xl font-extrabold" style={{ color: c }}>{v}</div><div className="mt-0.5 text-[13px] text-bone/60">{k}</div></div>)}
          </div>
          <div className="mt-5"><Replay ev={ev} /></div>
          <p className="mt-3 text-[14px] leading-snug text-bone/85">
            {ev.leadWarningH != null
              ? `The index was already at Warning or above ${fmtH(ev.leadWarningH)} before the landslide${ev.leadDangerH != null ? `, and at Danger ${fmtH(ev.leadDangerH)} before` : ''}.`
              : 'The index stayed below Warning at the time of the landslide. This is a miss for this event with the current settings, and it is useful evidence of what to improve.'}
          </p>
        </section>
        <section className="mt-5 border-l-2 border-ochre/60 pl-4 text-[13.5px] leading-relaxed text-bone/75">
          <p className="font-medium text-bone/90">How to read this honestly</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>One event is an illustration, not proof of accuracy. A fair test needs many events and many quiet days, to count false alarms too.</li>
            <li>The model weights are an expert estimate ({ev.model}), and soil strength is typical for the rock type, not surveyed.</li>
            <li>Weather is reanalysis (ERA5-Land) at about 9 km resolution, and event times come from reports, so exact lead times are approximate.</li>
          </ul>
        </section>
      </>)}
    </main>
  );
}
