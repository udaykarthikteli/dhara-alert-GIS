// Telegram delivery: free replacement for SMS. A person picks language + area on the website, taps the Telegram link,
// presses Start in the bot, and from then on the bot messages them. The server learns about "Start" by long-polling
// getUpdates, so no public webhook or extra setup is needed.
import { config } from '../config.js';
import { SITES } from '../data/sites.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (method, body = {}, ms = 15000) =>
  fetch(`https://api.telegram.org/bot${config.telegram.token}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(ms),
  }).then((r) => r.json());

/** Sends one message. `blocked` is true when the person blocked the bot or deleted the chat (so we can drop them). */
export async function sendTelegram(chatId, text) {
  if (!config.telegramEnabled) return { ok: false, status: 'no-provider' };
  try {
    const j = await api('sendMessage', { chat_id: chatId, text, disable_web_page_preview: true });
    if (j.ok) return { ok: true, status: 'sent' };
    return { ok: false, status: `tg-${j.error_code}`, blocked: j.error_code === 403 };
  } catch { return { ok: false, status: 'error' }; }
}

const areaLabel = (sub) => (sub.scope === 'all' ? 'all of India' : sub.scope === 'state' ? sub.value : (SITES.find((s) => s.id === sub.value)?.name || sub.value));

/** Handles one Telegram update (exported so it can be tested without the network loop). */
export async function handleUpdate(store, u, reply = (chatId, text) => sendTelegram(chatId, text)) {
  const m = u.message;
  if (!m || typeof m.text !== 'string') return;
  const chatId = m.chat.id, text = m.text.trim();
  if (text.startsWith('/start')) {
    const tok = text.split(/\s+/)[1];
    const subs = store.get('subscribers', []);
    const sub = tok && subs.find((s) => s.token === tok && s.channel === 'telegram');
    if (!sub) return void (await reply(chatId, 'Welcome to Dhara Alert. To get landslide alerts here, open the Dhara Alert website, go to "Get alerts", pick your area and tap the Telegram button.'));
    const dup = subs.find((s) => s !== sub && s.channel === 'telegram' && s.chatId === chatId && s.scope === sub.scope && s.value === sub.value);
    sub.chatId = chatId;
    store.set('subscribers', dup ? subs.filter((s) => s !== dup) : subs);
    return void (await reply(chatId, `Subscribed. You will get Dhara Alert warnings for ${areaLabel(sub)} when a slope reaches Danger or a Danger is forecast within 24 hours.\n\nSend /stop to unsubscribe.`));
  }
  if (/^\/stop\b/.test(text)) {
    const subs = store.get('subscribers', []);
    store.set('subscribers', subs.filter((s) => !(s.channel === 'telegram' && s.chatId === chatId)));
    return void (await reply(chatId, 'Unsubscribed. You will not get Dhara Alert messages any more.'));
  }
}

export function startTelegram(store) {
  if (!config.telegramEnabled) return;
  (async () => {
    let ready = false, offset = 0;
    for (;;) {
      try {
        if (!ready) {
          const me = await api('getMe');
          if (!me.ok) { console.error('[telegram] token rejected by Telegram - check TELEGRAM_BOT_TOKEN'); return; }
          config.telegram.username = config.telegram.username || me.result.username;
          await api('deleteWebhook');
          ready = true; console.log(`[telegram] bot @${config.telegram.username} is listening`);
        }
        const j = await api('getUpdates', { offset, timeout: 30, allowed_updates: ['message'] }, 40000);
        if (!j.ok) { await sleep(10000); continue; }       // e.g. 409: another copy of the server is polling during a deploy
        for (const u of j.result) { offset = u.update_id + 1; try { await handleUpdate(store, u); } catch (e) { console.error('[telegram]', e.message); } }
      } catch { await sleep(5000); }
    }
  })();
}
