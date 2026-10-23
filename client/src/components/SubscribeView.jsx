import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n.jsx';
import { postSubscriber, deleteSubscriber } from '../api.js';

export default function SubscribeView({ snap, health }) {
  const { t, lang, LANGS } = useI18n();
  const [phone, setPhone] = useState('');
  const tgOn = Boolean(health?.telegram), mailOn = Boolean(health?.email);
  const [email, setEmail] = useState('');
  const [channel, setChannel] = useState('');            // '' = follow the default (Telegram when the server has a bot, else SMS)
  const ch = channel || (tgOn ? 'telegram' : mailOn ? 'email' : 'sms');
  const [link, setLink] = useState(null);
  const [slang, setSlang] = useState(lang === 'kha' || lang === 'mni' ? 'en' : lang);
  const [scope, setScope] = useState('all');
  const [value, setValue] = useState('');
  const [msg, setMsg] = useState(null);
  const [notify, setNotify] = useState(() => localStorage.getItem('dhara.notify') === '1');
  const [token, setToken] = useState(() => localStorage.getItem('dhara.subtoken'));
  const STATES = useMemo(() => [...new Set(snap.sites.map((x) => x.state))].sort(), [snap]);   // every state that has a monitored site
  useEffect(() => setValue(scope === 'state' ? STATES[0] : scope === 'site' ? snap.sites[0]?.id : ''), [scope]);

  const submit = async (e) => {
    e.preventDefault(); setMsg(null);
    setLink(null);
    try {
      const r = await postSubscriber({ channel: ch, phone, email, lang: slang, scope, value });
      localStorage.setItem('dhara.subtoken', r.token); setToken(r.token);
      if (r.telegramLink) { setLink(r.telegramLink); setMsg({ ok: true, text: 'Almost done: open Telegram and press Start. Alerts begin only after that.' }); }
      else if (r.channel === 'email') setMsg({ ok: true, text: r.confirmed ? t('subscribed') : 'Almost done: we sent you an email. Open it (check Spam too) and click the confirmation link. Alerts begin after that.' });
      else setMsg({ ok: true, text: t('subscribed') });
    }
    catch (err) { setMsg({ ok: false, text: err.message }); }
  };
  const toggleNotify = async () => {
    if (notify) { localStorage.setItem('dhara.notify', '0'); return setNotify(false); }
    if (!('Notification' in window)) return setMsg({ ok: false, text: 'This browser does not support notifications.' });
    const p = await Notification.requestPermission();
    if (p === 'granted') { localStorage.setItem('dhara.notify', '1'); setNotify(true); } else setMsg({ ok: false, text: 'Notifications are blocked in browser settings.' });
  };
  const adminToken = (() => { try { return sessionStorage.getItem('dhara.admin') || ''; } catch { return ''; } })();
  const sendTest = async () => {
    setMsg(null);
    try {
      const r = await fetch('/api/admin/test-alert', { method: 'POST', headers: { 'x-admin-token': adminToken, 'content-type': 'application/json' }, body: JSON.stringify({ scope, value }) });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(b.error || `HTTP ${r.status}`);
      setMsg({ ok: true, text: `Test alert for ${b.site}: delivered to ${b.sent} of ${b.attempted} subscriber(s).${b.attempted === 0 ? ' Nobody is subscribed to this area yet (or has not confirmed).' : ''}` });
    } catch (err) { setMsg({ ok: false, text: err.message }); }
  };
  const unsub = async () => { await deleteSubscriber(token); localStorage.removeItem('dhara.subtoken'); setToken(null); setMsg({ ok: true, text: 'Unsubscribed.' }); };
  const smsLangs = LANGS.filter((l) => ['en', 'hi', 'as', 'bn', 'ne', 'lus'].includes(l.code));

  return (
    <div className="mx-auto max-w-xl px-5 pb-24 pt-24 md:pb-10">
      <h2 className="font-display text-3xl font-bold">{t('nav_sms')}</h2>
      <p className="mt-1 text-sm text-bone/60">{ch === 'telegram' || ch === 'email' ? `You will get ${ch === 'email' ? 'an email' : 'a Telegram message'} when a slope in your area reaches Danger, or a Danger is forecast within 24 hours.` : (health?.sms ? t('sms_note_live') : t('sms_note_off'))}</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        {(tgOn || mailOn) && <label className="block"><span className="mb-1 block text-sm text-bone/70">Send alerts by</span><select value={ch} onChange={(e) => setChannel(e.target.value)} className="field w-full">{tgOn && <option value="telegram">Telegram (free)</option>}{mailOn && <option value="email">Email (free)</option>}<option value="sms">SMS</option></select></label>}
        {ch === 'email' && <label className="block"><span className="mb-1 block text-sm text-bone/70">Email address</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" className="field w-full" required /></label>}
        {ch === 'sms' && <label className="block"><span className="mb-1 block text-sm text-bone/70">{t('phone')}</span><input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="98765 43210" className="field w-full" required /></label>}
        <label className="block"><span className="mb-1 block text-sm text-bone/70">{t('language')}</span><select value={slang} onChange={(e) => setSlang(e.target.value)} className="field w-full">{smsLangs.map((l) => <option key={l.code} value={l.code}>{l.native} ({l.name}){l.status === 'draft' ? ' · draft' : ''}</option>)}</select></label>
        <label className="block"><span className="mb-1 block text-sm text-bone/70">{t('area')}</span>
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <select value={scope} onChange={(e) => setScope(e.target.value)} className="field"><option value="all">All India</option><option value="state">A state</option><option value="site">A slope</option></select>
            {scope === 'state' && <select value={value} onChange={(e) => setValue(e.target.value)} className="field">{STATES.map((s) => <option key={s}>{s}</option>)}</select>}
            {scope === 'site' && <select value={value} onChange={(e) => setValue(e.target.value)} className="field">{[...snap.sites].sort((a, b) => a.name.localeCompare(b.name)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
          </div></label>
        <button className="btn-primary">{t('subscribe')}</button>
        {token && <button type="button" onClick={unsub} className="btn-ghost ml-3 text-sm">Unsubscribe</button>}
        <div role="status" aria-live="polite" className={msg?.ok ? 'text-moss' : 'text-ember'}>{msg?.text}</div>
        {adminToken && <div><button type="button" onClick={sendTest} className="btn text-sm">Send test alert (authority)</button><p className="mt-1 text-[12.5px] text-bone/50">Sends a clearly marked TEST message to everyone subscribed to the area selected above.</p></div>}
        {link && <a href={link} target="_blank" rel="noreferrer" className="btn-primary inline-block">Open Telegram and press Start</a>}
      </form>
      <div className="mt-8 border-t border-bone/10 pt-6"><label className="flex cursor-pointer items-center gap-3"><input type="checkbox" checked={notify} onChange={toggleNotify} className="h-4 w-4 accent-[#c9531f]" /><span>{t('notify')}</span></label>
        <p className="mt-1 text-[13px] text-bone/50">Shows a notification on this device when a new alert arrives while the app is open.</p></div>
    </div>
  );
}
