import fs from 'node:fs';
import path from 'node:path';

/** Minimal durable JSON store (atomic writes). Swap for PostgreSQL/PostGIS at scale. */
export class Store {
  constructor(dir) {
    this.dir = dir; this.cache = new Map(); this.timers = new Map();
    fs.mkdirSync(dir, { recursive: true });
  }
  get(name, fallback) {
    if (this.cache.has(name)) return this.cache.get(name);
    let v = fallback;
    try { v = JSON.parse(fs.readFileSync(path.join(this.dir, name + '.json'), 'utf8')); } catch {}
    this.cache.set(name, v);
    return v;
  }
  set(name, value) {
    this.cache.set(name, value);
    clearTimeout(this.timers.get(name));
    this.timers.set(name, setTimeout(() => this.flush(name), 250));
  }
  flush(name) {
    const file = path.join(this.dir, name + '.json');
    const tmp = file + '.tmp';
    try { fs.writeFileSync(tmp, JSON.stringify(this.cache.get(name))); fs.renameSync(tmp, file); }
    catch (e) { console.error('[store] write failed', name, e.message); }
  }
  flushAll() { for (const n of this.cache.keys()) this.flush(n); }
}
