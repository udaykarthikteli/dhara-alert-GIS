// Offline report queue (IndexedDB). Photos/videos are stored as Blobs and sent when the network returns.
import { postReport } from './api.js';
const DB = 'dhara-offline', STORE = 'queue';
const open = () => new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction(STORE, mode); const out = fn(t.objectStore(STORE)); t.oncomplete = () => res(out.result); t.onerror = () => rej(t.error); }); };

export const queueReport = (fields, file) => tx('readwrite', (s) => s.add({ fields, file: file || null, at: Date.now() }));
export const queued = () => tx('readonly', (s) => s.getAll()).catch(() => []);
const remove = (id) => tx('readwrite', (s) => s.delete(id));

export function toFormData(fields, file) {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
  if (file) fd.append('media', file, file.name || 'media');
  return fd;
}
export async function flushQueue() {
  let sent = 0;
  for (const item of await queued()) {
    try { await postReport(toFormData(item.fields, item.file)); await remove(item.id); sent++; }
    catch (e) { if (e.status && e.status >= 400 && e.status < 500 && e.status !== 429) await remove(item.id); else break; }
  }
  return sent;
}
/** Downscale photos before upload: saves mobile data on weak networks. */
export async function compressImage(file, max = 1600) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.8));
    return blob && blob.size < file.size ? new File([blob], 'photo.jpg', { type: 'image/jpeg' }) : file;
  } catch { return file; }
}
