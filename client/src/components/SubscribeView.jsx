import { useEffect, useState } from 'react';
import { useI18n } from '../i18n.jsx';
import { postSubscriber, deleteSubscriber } from '../api.js';
import { STATES } from '../states.js';

export default function SubscribeView({ snap, health }) {
  const { t, lang, LANGS } = useI18n();
  const [phone, setPhone] = useState('');
  const [slang, setSlang] = useState(lang === 'kha' || lang === 'mni' ? 'en' : lang);
  const [scope, setScope] = useState('all');
  const [value, setValue] = useState('');
  const [msg, setMsg] = useState(null);
  const [notify, setNotify] = useState(() => localStorage.getItem('dhara.notify') === '1');
  const [token, setToken] = useState(() => localStorage.getItem('dhara.subtoken'));
  useEffect(() => setValue(scope === 'state' ? STATES[0] : scope === 'site' ? snap.sites[0]?.id : ''), [scope]);

  const submit = async (e) => {
    e.preventDefault(); setMsg(null);
    try { const r = await postSubscriber({ phone, lang: slang, scope, value }); localStorage.setItem('dhara.subtoken', r.token); setToken(r.token); setMsg({ ok: true, text: t('subscribed') }); }
    catch (err) { setMsg({ ok: false, text: err.message }); }
  };
  const toggleNotify = async () => {
    if (notify) { localStorage.setItem('dhara.notify', '0'); return setNotify(false); }
    if (!('Notification' in window)) return setMsg({ ok: false, text: 'This browser does not support notifications.' });
    const p = await Notification.requestPermission();
    if (p === 'granted') { localStorage.setItem('dhara.notify', '1'); setNotify(true); } else setMsg({ ok: false, text: 'Notifications are blocked in browser settings.' });
  };
  const unsub = async () => { await deleteSubscriber(token); localStorage.removeItem('dhara.subtoken'); setToken(null); setMsg({ ok: true, text: 'Unsubscribed.' }); };
  const smsLangs = LANGS.filter((l) => ['en', 'hi', 'as', 'bn', 'ne', 'lus'].includes(l.code));

  return (
    <div className="mx-auto max-w-xl px-5 pb-24 pt-24 md:pb-10">
      <h2 className="font-display text-3xl font-bold">{t('nav_sms')}</h2>
      <p className="mt-1 text-sm text-bone/60">{health?.sms ? t('sms_note_live') : t('sms_note_off')}</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block"><span className="mb-1 block text-sm text-bone/70">{t('phone')}</span><input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="98765 43210" className="field w-full" required /></label>
        <label className="block"><span className="mb-1 block text-sm text-bone/70">{t('language')}</span><select value={slang} onChange={(e) => setSlang(e.target.value)} className="field w-full">{smsLangs.map((l) => <option key={l.code} value={l.code}>{l.native} ({l.name}){l.status === 'draft' ? ' · draft' : ''}</option>)}</select></label>
        <label className="block"><span className="mb-1 block text-sm text-bone/70">{t('area')}</span>
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <select value={scope} onChange={(e) => setScope(e.target.value)} className="field"><option value="all">All NE India</option><option value="state">A state</option><option value="site">A slope</option></select>
            {scope === 'state' && <select value={value} onChange={(e) => setValue(e.target.value)} className="field">{STATES.map((s) => <option key={s}>{s}</option>)}</select>}
            {scope === 'site' && <select value={value} onChange={(e) => setValue(e.target.value)} className="field">{[...snap.sites].sort((a, b) => a.name.localeCompare(b.name)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
          </div></label>
        <button className="btn-primary">{t('subscribe')}</button>
        {token && <button type="button" onClick={unsub} className="btn-ghost ml-3 text-sm">Unsubscribe this phone</button>}
        <div role="status" aria-live="polite" className={msg?.ok ? 'text-moss' : 'text-ember'}>{msg?.text}</div>
      </form>
      <div className="mt-8 border-t border-bone/10 pt-6"><label className="flex cursor-pointer items-center gap-3"><input type="checkbox" checked={notify} onChange={toggleNotify} className="h-4 w-4 accent-[#c9531f]" /><span>{t('notify')}</span></label>
        <p className="mt-1 text-[13px] text-bone/50">Shows a notification on this device when a new alert arrives while the app is open.</p></div>
    </div>
  );
}
