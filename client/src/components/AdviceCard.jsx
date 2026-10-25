import { LEVEL_COLOR, ACTIONS } from '../util.js';
import { LV, outlook } from '../outlook.js';

// Plain-language guidance for residents, one set per hazard level (the technical action list stays under "For officials").
const DO = [
  ['No action needed right now.', 'Keep drains and ditches near your home clear.', 'Know where the nearest safe, higher ground is.'],
  ['Stay alert and watch the slope above and below your home.', 'Look for new cracks, muddy water or leaning trees and poles.', 'Keep your phone charged and a torch ready.'],
  ['Be ready to move at short notice.', 'Pack a small bag: documents, medicines, water, torch, phone charger.', 'Avoid travelling on hill roads at night, and check on elderly neighbours.'],
  ['If you live below or on a steep slope, move to safer ground now.', 'Do not cross flooded roads or roads covered with mud and rocks.', 'Follow instructions from your district disaster office and local officials.'],
  ['Leave now and go to the nearest relief shelter on high, stable ground.', 'Do not go back until the authorities say it is safe.', 'Call 112 for emergency help.'],
];
const SIGNS = 'New cracks in the ground or walls, tilting trees or poles, sudden muddy water from a spring, or a rumbling sound: leave immediately and call 112.';

export default function AdviceCard({ site }) {
  const lvl = site.levelIndex, col = LEVEL_COLOR[lvl];
  const o = outlook(site.forecast);
  const worse = o && o.peak.level > lvl;
  return (
    <section className="px-5 pt-4" aria-label="What to do right now">
      <div className="border border-bone/12 bg-bone/[.03]" style={{ borderTopColor: col, borderTopWidth: 3 }}>
        <div className="flex items-center justify-between px-4 pt-3">
          <h3 className="font-display text-[16px] font-bold">What to do right now</h3>
          <span className="chip" style={{ '--c': col }}>{LV[lvl]}</span>
        </div>
        <ul className="space-y-1.5 px-4 pb-1 pt-2 text-[14px] leading-snug text-bone/90">
          {DO[lvl].map((x) => <li key={x} className="flex gap-2"><i className="mt-[7px] inline-block h-1.5 w-1.5 shrink-0" style={{ background: col }} />{x}</li>)}
        </ul>
        {worse && <p className="mx-4 mb-1 mt-1.5 text-[13px] text-ember">Conditions are expected to get worse in the next 72 h. Plan for {LV[o.peak.level]} level.</p>}
        <p className="mx-4 mt-2 border-t border-bone/10 pt-2 text-[12.5px] leading-snug text-bone/70"><b className="text-bone/90">Warning signs:</b> {SIGNS}</p>
        <details className="px-4 pb-3 pt-2 text-[12.5px] text-bone/70">
          <summary className="cursor-pointer select-none text-bone/80">For officials</summary>
          <p className="mt-1.5 leading-snug">{ACTIONS[lvl]}</p>
        </details>
      </div>
    </section>
  );
}
