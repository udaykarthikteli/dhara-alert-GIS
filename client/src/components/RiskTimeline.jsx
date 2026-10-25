import { LEVEL_COLOR, colorOfLhi } from '../util.js';
import { outlook } from '../outlook.js';

// 72-hour hazard timeline with a plain-language countdown ("Danger expected in ~18 h").
export default function RiskTimeline({ site }) {
  const f = site.forecast;
  const o = outlook(f);
  if (!o) return null;
  const W = 340, H = 156, pl = 26, pr = 44, pt = 10, pb = 22;
  const t0 = f[0].t, t1 = f[f.length - 1].t;
  const x = (t) => pl + ((t - t0) / (t1 - t0 || 1)) * (W - pl - pr);
  const y = (v) => pt + (1 - v / 100) * (H - pt - pb);
  const line = f.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.lhi).toFixed(1)}`).join(' ');
  const area = `${line} L${x(t1)} ${y(0)} L${x(t0)} ${y(0)} Z`;
  const col = LEVEL_COLOR[o.level];
  const bands = [[0, 20], [20, 40], [40, 60], [60, 80], [80, 100]];
  const names = ['Low', 'Watch', 'Warning', 'Danger', 'Critical'];
  return (
    <div>
      <div className="border-l-4 bg-bone/[.04] px-3 py-2.5" style={{ borderColor: col }}>
        <div className="font-display text-[19px] font-bold leading-tight" style={{ color: col }}>{o.headline}</div>
        <div className="mt-0.5 text-[13px] text-bone/75">{o.sub}</div>
        {o.stale && <div className="mt-1 text-[12px] text-ochre">Based on data from about {o.staleH} h ago. Live weather is temporarily unavailable.</div>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label={`72 hour hazard timeline. ${o.headline}.`}>
        {bands.map(([a, b], i) => <rect key={i} x={pl} width={W - pl - pr} y={y(b)} height={y(a) - y(b)} fill={LEVEL_COLOR[i]} opacity=".08" />)}
        {[20, 40, 60, 80].map((v, i) => (
          <g key={v}>
            <line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} stroke="rgba(239,228,211,.14)" strokeDasharray="2 4" />
            <text x={pl - 4} y={y(v) + 3} textAnchor="end" fontSize="8" fill="rgba(239,228,211,.5)">{v}</text>
            <text x={W - pr + 4} y={y(v + 10) + 3} fontSize="8.5" fill={LEVEL_COLOR[i + 1]}>{names[i + 1]}</text>
          </g>))}
        <text x={W - pr + 4} y={y(10) + 3} fontSize="8.5" fill={LEVEL_COLOR[0]}>Low</text>
        <path d={area} fill={colorOfLhi(o.peak.lhi)} opacity=".18" />
        <path d={line} fill="none" stroke={colorOfLhi(o.peak.lhi)} strokeWidth="2.4" strokeLinejoin="round" />
        {o.point && <g>
          <line x1={x(o.point.t)} x2={x(o.point.t)} y1={pt} y2={H - pb} stroke={LEVEL_COLOR[o.level]} strokeDasharray="3 3" />
          <circle cx={x(o.point.t)} cy={y(o.point.lhi)} r="4" fill={LEVEL_COLOR[o.level]} stroke="#120d0a" strokeWidth="1.5" />
          <text x={Math.min(x(o.point.t), W - pr - 14)} y={pt + 8} textAnchor="middle" fontSize="9.5" fontWeight="700" fill={LEVEL_COLOR[o.level]}>+{o.hours} h</text>
        </g>}
        <circle cx={x(t0)} cy={y(f[0].lhi)} r="3.6" fill="#efe4d3" stroke="#120d0a" strokeWidth="1.5" />
        <line x1={x(t0)} x2={x(t0)} y1={pt} y2={H - pb} stroke="#efe4d3" opacity=".45" />
        {[0, 24, 48, 72].map((h, i) => <text key={h} x={Math.min(x(t0 + h * 3600e3), W - pr)} y={H - 6} textAnchor={i === 0 ? 'start' : i === 3 ? 'end' : 'middle'} fontSize="8.5" fill="rgba(239,228,211,.6)">{i === 0 ? 'now' : `+${h} h`}</text>)}
      </svg>
    </div>
  );
}
