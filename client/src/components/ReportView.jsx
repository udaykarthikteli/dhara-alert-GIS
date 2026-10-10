import { useState } from 'react';
import LocationPicker from './LocationPicker.jsx';
import { useI18n } from '../i18n.jsx';
import { postReport } from '../api.js';
import { compressImage, queueReport, toFormData } from '../offline.js';
import { REPORT_TYPES, ago } from '../util.js';
import { adminReport } from '../api.js';

export default function ReportView({ reports, token, reload, setReports }) {
  const { t } = useI18n();
  const [type, setType] = useState('crack');
  const [pos, setPos] = useState(null);
  const [note, setNote] = useState('');
  const [file, setFile] = useState(null);
  const [state, setState] = useState({ kind: 'idle' });

  const locate = () => {
    if (!navigator.geolocation) return setState({ kind: 'error', msg: 'This browser cannot read your location. Tap the map instead.' });
    navigator.geolocation.getCurrentPosition((p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }), () => setState({ kind: 'error', msg: 'Location blocked. Tap the map to place the pin.' }), { enableHighAccuracy: true, timeout: 12000 });
  };
  const submit = async () => {
    if (!pos) return setState({ kind: 'error', msg: 'Place the pin on the map or use your location first.' });
    setState({ kind: 'sending' });
    const media = file ? await compressImage(file) : null;
    const fields = { lat: pos.lat, lng: pos.lng, type, note, takenAt: Date.now() };
    const done = (kind) => { setState({ kind }); setNote(''); setFile(null); };
    if (!navigator.onLine) { await queueReport(fields, media); return done('queued'); }
    try { const r = await postReport(toFormData(fields, media)); setReports((x) => [r, ...x]); reload(); done('sent'); }
    catch (e) {
      if (!e.status) { await queueReport(fields, media); return done('queued'); }   // network failure -> keep it
      setState({ kind: 'error', msg: e.message });
    }
  };
  const act = async (id, status) => { await adminReport(token, id, status); reload(); };

  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-5 pb-24 pt-24 md:grid-cols-[1.1fr_1fr] md:pb-10">
      <div>
        <h2 className="font-display text-3xl font-bold">{t('report_title')}</h2>
        <p className="mt-1 text-sm text-bone/60">{t('report_hint')}</p>
        <fieldset className="mt-6"><legend className="mb-2 font-medium">{t('report_what')}</legend>
          <div className="flex flex-wrap gap-2">{REPORT_TYPES.map((k) => <button type="button" key={k} onClick={() => setType(k)} aria-pressed={type === k} className={`chip-btn ${type === k ? 'chip-on' : ''}`}>{t('t_' + k)}</button>)}</div>
        </fieldset>
        <div className="mt-5"><LocationPicker value={pos} onChange={setPos} /></div>
        <div className="mt-2 flex items-center gap-3"><button type="button" onClick={locate} className="btn">{t('use_location')}</button><span className="text-[13px] tabular-nums text-bone/60">{pos ? `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}` : 'Tap the map to place the pin'}</span></div>
        <label className="mt-5 block"><span className="mb-1 block text-sm text-bone/70">{t('note')}</span><textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} className="field w-full" /></label>
        <label className="mt-4 block"><span className="mb-1 block text-sm text-bone/70">{t('attach')}</span><input type="file" accept="image/*,video/*" capture="environment" onChange={(e) => setFile(e.target.files?.[0] || null)} className="field w-full file:mr-3 file:border-0 file:bg-laterite file:px-3 file:py-1.5 file:text-bone" /></label>
        <button onClick={submit} disabled={state.kind === 'sending'} className="btn-primary mt-6">{state.kind === 'sending' ? '…' : t('send')}</button>
        <div role="status" aria-live="polite" className="mt-3 min-h-[1.5rem] text-[14px]">
          {state.kind === 'sent' && <span className="text-moss">{t('sent')}</span>}
          {state.kind === 'queued' && <span className="text-ochre">{t('queued')}</span>}
          {state.kind === 'error' && <span className="text-ember">{state.msg}</span>}
        </div>
      </div>

      <div>
        <h3 className="font-display text-xl font-semibold">Recent reports</h3>
        {!reports.length && <p className="mt-3 text-sm text-bone/50">No reports in the last 7 days.</p>}
        <ul className="mt-3 divide-y divide-bone/10">
          {reports.slice(0, 20).map((r) => (
            <li key={r.id} className="flex gap-3 py-3 text-[13.5px]">
              {r.media && r.mediaType === 'image' ? <img src={r.media} alt="" className="h-14 w-14 shrink-0 object-cover" loading="lazy" /> : <div className="h-14 w-14 shrink-0 bg-bone/10" />}
              <div className="min-w-0 flex-1"><div className="font-medium">{t('t_' + r.type)} <span className={r.status === 'verified' ? 'text-moss' : 'text-ochre'}>· {t(r.status)}</span></div>
                <div className="truncate text-bone/60">{r.note}</div><div className="text-bone/40">{ago(r.createdAt)} · {r.lat.toFixed(3)}, {r.lng.toFixed(3)}</div>
                {token && <div className="mt-1 flex gap-3"><button className="text-moss underline" onClick={() => act(r.id, 'verified')}>{t('verify')}</button><button className="text-ember underline" onClick={() => act(r.id, 'rejected')}>{t('reject')}</button></div>}</div>
            </li>))}
        </ul>
      </div>
    </div>
  );
}
