import { LEVEL_COLOR, colorOfLhi, clock } from '../util.js';

export function Gauge({ value, size = 132 }) {
  const r = 52, c = Math.PI * r, v = Math.max(0, Math.min(100, value));
  const col = colorOfLhi(v);
  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 130 80" role="img" aria-label={`Hazard index ${Math.round(v)} of 100`}>
      <path d="M13 70 A52 52 0 0 1 117 70" fill="none" stroke="rgba(239,228,211,.12)" strokeWidth="11" strokeLinecap="round" />
      <path d="M13 70 A52 52 0 0 1 117 70" fill="none" stroke={col} strokeWidth="11" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} style={{ transition: 'stroke-dasharray .8s cubic-bezier(.2,.8,.2,1), stroke .4s' }} />
      <text x="65" y="62" textAnchor="middle" className="font-display" fontSize="30" fontWeight="800" fill="#efe4d3">{Math.round(v)}</text>
    </svg>
  );
}

export function ForecastChart({ forecast, height = 130 }) {
  if (!forecast?.length) return null;
  const W = 340, H = height, pl = 26, pr = 8, pt = 8, pb = 20;
  const t0 = forecast[0].t, t1 = forecast[forecast.length - 1].t;
  const x = (t) => pl + ((t - t0) / (t1 - t0 || 1)) * (W - pl - pr);
  const y = (v) => pt + (1 - v / 100) * (H - pt - pb);
  const line = forecast.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.lhi).toFixed(1)}`).join(' ');
  const area = `${line} L${x(t1)} ${y(0)} L${x(t0)} ${y(0)} Z`;
  const peak = forecast.reduce((a, b) => (b.lhi > a.lhi ? b : a), forecast[0]);
  const bands = [[0, 20], [20, 40], [40, 60], [60, 80], [80, 100]];
  const ticks = [0, 24, 48, 72].map((h) => t0 + h * 3600e3).filter((t) => t <= t1 + 1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="72 hour hazard forecast">
      {bands.map(([a, b], i) => <rect key={i} x={pl} width={W - pl - pr} y={y(b)} height={y(a) - y(b)} fill={LEVEL_COLOR[i]} opacity=".07" />)}
      {[20, 40, 60, 80].map((v) => <g key={v}><line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} stroke="rgba(239,228,211,.1)" strokeDasharray="2 4" /><text x={pl - 4} y={y(v) + 3} textAnchor="end" fontSize="8" fill="rgba(239,228,211,.5)">{v}</text></g>)}
      <path d={area} fill={colorOfLhi(peak.lhi)} opacity=".18" />
      <path d={line} fill="none" stroke={colorOfLhi(peak.lhi)} strokeWidth="2.2" strokeLinejoin="round" />
      <circle cx={x(peak.t)} cy={y(peak.lhi)} r="3.6" fill={colorOfLhi(peak.lhi)} stroke="#120d0a" strokeWidth="1.5" />
      <text x={Math.min(x(peak.t), W - 40)} y={Math.max(y(peak.lhi) - 8, 10)} textAnchor="middle" fontSize="10" fontWeight="600" fill="#efe4d3">{Math.round(peak.lhi)}</text>
      <line x1={x(t0)} x2={x(t0)} y1={pt} y2={H - pb} stroke="#efe4d3" opacity=".5" />
      {ticks.map((t, i) => <text key={t} x={Math.min(x(t), W - 24)} y={H - 5} textAnchor={i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle'} fontSize="8.5" fill="rgba(239,228,211,.6)">{i === 0 ? 'now' : clock(t).replace(/^\w+ /, (m) => m)}</text>)}
    </svg>
  );
}

export function RainBars({ series, height = 84 }) {
  if (!series?.rain?.length) return null;
  const n = series.rain.length, W = 340, H = height, pl = 26, pr = 6, pt = 6, pb = 16;
  const max = Math.max(10, ...series.rain), bw = (W - pl - pr) / n;
  const nowX = pl + series.nowIndex * bw + bw / 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Hourly rainfall, 72 hours past and 72 hours forecast">
      <text x={pl - 4} y={pt + 6} textAnchor="end" fontSize="8" fill="rgba(239,228,211,.5)">{Math.round(max)}</text>
      <text x={pl - 4} y={H - pb} textAnchor="end" fontSize="8" fill="rgba(239,228,211,.5)">0</text>
      {series.rain.map((v, i) => {
        const h = (v / max) * (H - pt - pb);
        return <rect key={i} x={pl + i * bw + 0.3} y={H - pb - h} width={Math.max(bw - 0.6, 0.6)} height={h} fill={i <= series.nowIndex ? '#8fc4bb' : '#5fb1cc'} opacity={i <= series.nowIndex ? 0.9 : 0.55} />;
      })}
      <line x1={nowX} x2={nowX} y1={pt} y2={H - pb} stroke="#efe4d3" opacity=".6" strokeDasharray="2 3" />
      <text x={pl} y={H - 3} fontSize="8.5" fill="rgba(239,228,211,.6)">-72 h</text>
      <text x={nowX} y={H - 3} fontSize="8.5" textAnchor="middle" fill="rgba(239,228,211,.8)">now</text>
      <text x={W - pr} y={H - 3} fontSize="8.5" textAnchor="end" fill="rgba(239,228,211,.6)">+72 h</text>
    </svg>
  );
}

export function FactorBar({ label, value, hint }) {
  const v = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const col = v >= 80 ? LEVEL_COLOR[4] : v >= 60 ? LEVEL_COLOR[3] : v >= 40 ? LEVEL_COLOR[2] : v >= 20 ? LEVEL_COLOR[1] : LEVEL_COLOR[0];
  return (
    <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-2 text-[13px]" title={hint}>
      <span className="text-bone/80">{label}</span><span className="tabular-nums text-bone/60">{v}%</span>
      <div className="col-span-2 mt-1 h-[5px] bg-bone/10"><div className="h-full transition-all duration-700" style={{ width: `${v}%`, background: col }} /></div>
    </div>
  );
}

export function LevelStrip({ counts, total }) {
  const keys = ['low', 'watch', 'warning', 'danger', 'critical'];
  return (
    <div>
      <div className="flex h-3 overflow-hidden">{keys.map((k, i) => counts[k] ? <div key={k} style={{ width: `${(counts[k] / total) * 100}%`, background: LEVEL_COLOR[i] }} title={`${k}: ${counts[k]}`} /> : null)}</div>
    </div>
  );
}

export function ForecastMatrix({ sites, steps = 24 }) {
  const rows = [...sites].sort((a, b) => b.peak.lhi - a.peak.lhi).slice(0, 12);
  if (!rows.length) return null;
  const head = rows[0].forecast.slice(0, steps);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate text-[12px]" style={{ borderSpacing: '0 2px' }}>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id}>
              <td className="sticky left-0 whitespace-nowrap bg-[#161009] pr-3 text-bone/85">{s.name}</td>
              {s.forecast.slice(0, steps).map((f, i) => <td key={i} title={`${s.name} · ${clock(f.t)} · ${Math.round(f.lhi)}`} className="h-5 min-w-[14px] border-r border-[#161009]" style={{ background: LEVEL_COLOR[f.level], opacity: 0.35 + Math.min(f.lhi, 100) / 160 }} />)}
              <td className="pl-3 text-right tabular-nums text-bone/70">{Math.round(s.peak.lhi)}</td>
            </tr>
          ))}
          <tr><td /><td colSpan={head.length} className="pt-1 text-[11px] text-bone/50"><div className="flex justify-between"><span>now</span><span>+24 h</span><span>+48 h</span><span>+72 h</span></div></td><td /></tr>
        </tbody>
      </table>
    </div>
  );
}
