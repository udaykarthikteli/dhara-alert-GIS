import { useEffect, useState } from 'react';
import { LEVEL_COLOR } from './util.js';

// First-visit tour. Waits for the intro animation to finish, shows once, and can be reopened with the "?" button.
const KEY = 'dhara.tour';
const STEPS = [
  { title: 'Read the map', body: 'Every marker is a monitored slope. Its colour is the current risk level. Rings and cracks around a marker get stronger as the risk rises.', legend: true },
  { title: 'Tap a site for the full picture', body: 'You get the risk score, what to do right now in plain words, and a 72-hour timeline with a countdown, such as “Danger expected in ~18 h”.' },
  { title: 'Report, compare and replay', body: 'Send a photo of a crack or a blocked road, get alerts by SMS, compare sites side by side, or replay a real past landslide to see what the system would have shown.' },
];

export default function Tour({ open, onClose }) {
  const [auto, setAuto] = useState(false);
  const [i, setI] = useState(0);
  useEffect(() => {
    let seen = false; try { seen = !!localStorage.getItem(KEY); } catch {}
    if (seen) return;
    const id = setInterval(() => { if (!document.querySelector('.sp-root')) { clearInterval(id); setTimeout(() => setAuto(true), 400); } }, 400);
    return () => clearInterval(id);
  }, []);
  const show = open || auto;
  const close = () => { try { localStorage.setItem(KEY, '1'); } catch {} setAuto(false); setI(0); onClose(); };
  useEffect(() => {
    if (!show) return;
    const k = (e) => { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') setI((n) => Math.min(STEPS.length - 1, n + 1)); if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1)); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });
  if (!show) return null;
  const s = STEPS[i], last = i === STEPS.length - 1;
  return (
    <div className="fixed inset-0 z-[950] grid place-items-center bg-basalt/75 px-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="How to use Dhara Alert" onClick={close}>
      <div className="w-full max-w-md border border-bone/15 bg-soil p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="text-[12px] uppercase tracking-[.2em] text-bone/50">Step {i + 1} of {STEPS.length}</div>
        <h2 className="mt-1 font-display text-2xl font-bold">{s.title}</h2>
        <p className="mt-2 text-[15.5px] leading-snug text-bone/85">{s.body}</p>
        {s.legend && <ul className="mt-4 grid grid-cols-5 gap-1 text-center text-[11.5px]">{['Low', 'Watch', 'Warning', 'Danger', 'Critical'].map((n, k) => <li key={n}><i className="mx-auto mb-1 block h-3 w-full" style={{ background: LEVEL_COLOR[k] }} />{n}</li>)}</ul>}
        <div className="mt-6 flex items-center justify-between">
          <div className="flex gap-1.5" aria-hidden="true">{STEPS.map((_, k) => <i key={k} className="h-1.5 w-6" style={{ background: k === i ? '#e8803a' : 'rgba(239,228,211,.2)' }} />)}</div>
          <div className="flex items-center gap-2">
            <button onClick={close} className="btn-ghost text-sm">Skip</button>
            {i > 0 && <button onClick={() => setI(i - 1)} className="btn">Back</button>}
            <button onClick={() => (last ? close() : setI(i + 1))} className="btn-primary !px-5 !py-2">{last ? 'Start' : 'Next'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
