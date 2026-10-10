const LS = 'dhara.snapshot';
const j = async (url, opts) => {
  const r = await fetch(url, opts);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(body.error || `HTTP ${r.status}`); e.status = r.status; e.body = body; throw e; }
  return body;
};

export async function getSnapshot() {
  try {
    const data = await j('/api/snapshot');
    try { localStorage.setItem(LS, JSON.stringify(data)); } catch {}
    return { data, offline: false };
  } catch (e) {
    if (e.status === 503 && e.body?.error === 'warming-up') throw e;
    let cached = null; try { cached = JSON.parse(localStorage.getItem(LS)); } catch {}
    if (cached) return { data: cached, offline: true };
    throw e;
  }
}
export const getReports = () => j('/api/reports').catch(() => []);
export const getAlerts = () => j('/api/alerts?limit=60').catch(() => []);
export const getHealth = () => j('/api/health').catch(() => null);
export const postSubscriber = (body) => j('/api/subscribers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
export const deleteSubscriber = (token) => j('/api/subscribers/' + token, { method: 'DELETE' });
export const postReport = (fd) => j('/api/reports', { method: 'POST', body: fd });

const auth = (token) => ({ 'x-admin-token': token, 'content-type': 'application/json' });
export const adminCheck = (token) => j('/api/admin/check', { headers: auth(token) });
export const adminReport = (token, id, status) => j('/api/reports/' + id, { method: 'PATCH', headers: auth(token), body: JSON.stringify({ status }) });
export const adminRoad = (token, id, body) => j(`/api/admin/roads/${id}/override`, { method: 'POST', headers: auth(token), body: JSON.stringify(body) });
export const adminRoadClear = (token, id) => j(`/api/admin/roads/${id}/override`, { method: 'DELETE', headers: auth(token) });
