import { useEffect, useState } from 'react';

// Intro animation shown once per browser session (add ?splash to the address to force it).
// The app loads underneath it, so it never delays real data. Click, Esc, Enter or "Skip" closes it.
const SHOW_MS = 3200;   // time before fade-out starts
const FADE_MS = 600;

const css = `
.sp-root{position:fixed;inset:0;z-index:100;display:grid;place-items:center;background:#120d0a;overflow:hidden;cursor:pointer;transition:opacity ${FADE_MS}ms ease,transform ${FADE_MS}ms ease}
.sp-root.sp-out{opacity:0;transform:scale(1.04);pointer-events:none}
.sp-glow{position:absolute;inset:0;background:radial-gradient(ellipse 55% 45% at 50% 46%,rgba(201,83,31,.30),transparent 70%),radial-gradient(ellipse 80% 60% at 50% 110%,rgba(220,174,82,.10),transparent 70%);animation:sp-glow 3s ease-out both}
.sp-contours{position:absolute;inset:-10%;opacity:.07;background:repeating-radial-gradient(ellipse at 50% 120%,transparent 0 22px,#efe4d3 22px 23px);animation:sp-drift 6s linear both}
.sp-stack{position:relative;display:flex;flex-direction:column;align-items:center;gap:22px;padding:24px;text-align:center}
.sp-mark{width:clamp(120px,22vw,168px);height:auto;overflow:visible;filter:drop-shadow(0 10px 30px rgba(201,83,31,.35));animation:sp-pop .9s cubic-bezier(.2,.9,.25,1.15) both}
.sp-ring{stroke-dasharray:240;stroke-dashoffset:240;animation:sp-draw 1.1s .1s ease-out forwards}
.sp-land{animation:sp-rise .8s .15s cubic-bezier(.2,.8,.2,1) both}
.sp-block{animation:sp-slip 1.15s 1.05s cubic-bezier(.5,0,.3,1) both}
.sp-shake{animation:sp-shake .5s 1.0s linear both}
.sp-d{opacity:0;animation:sp-fall 1s ease-in both}
.sp-d1{animation-delay:1.35s}.sp-d2{animation-delay:1.5s}.sp-d3{animation-delay:1.65s}
.sp-arc{opacity:0;animation:sp-ping .55s ease-out both}
.sp-a0{animation-delay:1.9s}.sp-a1{animation-delay:2.05s}.sp-a2{animation-delay:2.2s}
.sp-word{font-family:'Bricolage Grotesque','Hind',system-ui,sans-serif;font-weight:800;font-size:clamp(34px,6.5vw,56px);line-height:1;color:#efe4d3;animation:sp-word 1.1s .8s cubic-bezier(.2,.8,.2,1) both}
.sp-word b{color:#e8803a;font-weight:800}
.sp-tag{font-family:'Hind',system-ui,sans-serif;font-size:clamp(11px,1.9vw,14px);letter-spacing:.28em;text-transform:uppercase;color:rgba(239,228,211,.65);animation:sp-fade .9s 1.5s ease-out both}
.sp-bar{position:absolute;left:0;bottom:0;height:3px;width:100%;background:rgba(239,228,211,.08)}
.sp-bar i{display:block;height:100%;width:100%;transform-origin:left;background:linear-gradient(90deg,#c9531f,#e8803a,#dcae52);animation:sp-bar ${SHOW_MS}ms linear both}
.sp-skip{position:absolute;right:18px;bottom:22px;background:none;border:1px solid rgba(239,228,211,.25);color:rgba(239,228,211,.8);padding:6px 14px;font:500 13px 'Hind',system-ui,sans-serif;letter-spacing:.06em;cursor:pointer;animation:sp-fade .6s .5s both}
.sp-skip:hover{border-color:#e8803a;color:#efe4d3}
@keyframes sp-glow{from{opacity:0}to{opacity:1}}
@keyframes sp-drift{from{transform:translateY(0)}to{transform:translateY(-30px)}}
@keyframes sp-pop{from{opacity:0;transform:scale(.7) translateY(12px)}to{opacity:1;transform:none}}
@keyframes sp-draw{to{stroke-dashoffset:0}}
@keyframes sp-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes sp-slip{0%{transform:translate(0,0)}100%{transform:translate(2.2px,2.6px)}}
@keyframes sp-shake{0%,100%{transform:translate(0,0)}20%{transform:translate(-.6px,.3px)}40%{transform:translate(.7px,-.3px)}60%{transform:translate(-.5px,.4px)}80%{transform:translate(.4px,-.2px)}}
@keyframes sp-fall{0%{opacity:0;transform:translate(-4px,-10px)}25%{opacity:1}100%{opacity:1;transform:translate(0,0)}}
@keyframes sp-ping{0%{opacity:0;transform:scale(.6)}60%{opacity:1}100%{opacity:1;transform:scale(1)}}
@keyframes sp-word{from{opacity:0;letter-spacing:.35em;transform:translateY(10px)}to{opacity:1;letter-spacing:.01em;transform:none}}
@keyframes sp-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes sp-bar{from{transform:scaleX(0)}to{transform:scaleX(1)}}
`;

function Mark() {
  return (
    <svg className="sp-mark" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="spbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#26180f" /><stop offset="1" stopColor="#120d0a" /></linearGradient>
        <linearGradient id="spmt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8a5c42" /><stop offset="1" stopColor="#3a261b" /></linearGradient>
        <linearGradient id="spmt2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b98562" /><stop offset="1" stopColor="#5e3f2d" /></linearGradient>
        <linearGradient id="spsl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f29a50" /><stop offset="1" stopColor="#c9531f" /></linearGradient>
        <clipPath id="sprr"><rect width="64" height="64" rx="15" /></clipPath>
      </defs>
      <g clipPath="url(#sprr)">
        <rect width="64" height="64" fill="url(#spbg)" />
        <g className="sp-land">
          <path d="M-2 54 L25 17 L36 31 L46 22 L66 50 L66 66 L-2 66Z" fill="url(#spmt)" />
          <path d="M36 31 L46 22 L66 50 L66 66 L40 66 L38 44Z" fill="url(#spmt2)" opacity=".55" />
          <path d="M25 17 L36 31 L30 40 L21 29Z" fill="#2a170e" />
        </g>
      </g>
      <g className="sp-shake">
        <g className="sp-block">
          <path d="M25 17 L36 31 L30 40 L21 29Z" fill="url(#spsl)" />
          <path d="M25 17 L29.5 23 L25.5 25 L28 31 L21 29Z" fill="#c9531f" opacity=".85" />
        </g>
      </g>
      <g style={{ transformBox: 'fill-box' }}>
        <circle className="sp-d sp-d1" cx="41.5" cy="46" r="3.4" fill="#dcae52" />
        <circle className="sp-d sp-d2" cx="50.5" cy="51" r="2.4" fill="#e8803a" />
        <circle className="sp-d sp-d3" cx="34" cy="51" r="2" fill="#8fc4bb" />
      </g>
      <g fill="none" stroke="#e8803a" strokeWidth="2.4" strokeLinecap="round" style={{ transformOrigin: '47px 17.5px' }}>
        <circle className="sp-arc sp-a0" cx="47" cy="17.5" r="2" fill="#e8803a" stroke="none" style={{ transformOrigin: '47px 17.5px' }} />
        <path className="sp-arc sp-a1" d="M47 12.5 a4.6 4.6 0 0 1 5 5" style={{ transformOrigin: '47px 17.5px' }} />
        <path className="sp-arc sp-a2" d="M47 7.5 a9.6 9.6 0 0 1 10 10" style={{ transformOrigin: '47px 17.5px' }} />
      </g>
      <rect className="sp-ring" x=".6" y=".6" width="62.8" height="62.8" rx="14.5" fill="none" stroke="#e8803a" strokeOpacity=".55" strokeWidth="1.2" pathLength="240" />
    </svg>
  );
}

export default function Splash() {
  const [phase, setPhase] = useState(() => {
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'gone';
      if (/[?&]splash\b/.test(window.location.search)) return 'in';
      return sessionStorage.getItem('dhara.splash') ? 'gone' : 'in';
    } catch { return 'in'; }
  });

  useEffect(() => {
    if (phase === 'in') { try { sessionStorage.setItem('dhara.splash', '1'); } catch {} }
    if (phase === 'in') { const t = setTimeout(() => setPhase('out'), SHOW_MS); return () => clearTimeout(t); }
    if (phase === 'out') { const t = setTimeout(() => setPhase('gone'), FADE_MS + 50); return () => clearTimeout(t); }
  }, [phase]);

  useEffect(() => {
    if (phase !== 'in') return;
    const onKey = (e) => { if (['Escape', 'Enter', ' '].includes(e.key)) setPhase('out'); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase]);

  if (phase === 'gone') return null;
  return (
    <div className={`sp-root ${phase === 'out' ? 'sp-out' : ''}`} onClick={() => setPhase('out')} role="status" aria-label="Dhara Alert is loading">
      <style>{css}</style>
      <div className="sp-glow" />
      <div className="sp-contours" />
      <div className="sp-stack">
        <Mark />
        <div className="sp-word">Dhara <b>Alert</b></div>
        <div className="sp-tag">Landslide early warning · North-East India</div>
      </div>
      <div className="sp-bar"><i /></div>
      <button className="sp-skip" onClick={(e) => { e.stopPropagation(); setPhase('out'); }}>Skip</button>
    </div>
  );
}
