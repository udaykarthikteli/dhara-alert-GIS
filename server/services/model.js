import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { sigmoid } from './risk.js';

export const FEATURES = ['fs', 'rain', 'seis', 'cit', 'antec', 'sat'];

// Expert-prior weights: used until a model is trained on historical events (npm run train).
// They are deliberately transparent: every term has a physical meaning and a monotonic effect.
export const PRIOR = { bias: -4.6, w: { fs: 3.2, rain: 2.6, seis: 1.2, cit: 2.0, antec: 0.8, sat: 0.6 }, source: 'expert-prior' };

export class Model {
  constructor(params = PRIOR) { this.params = params; }
  predict(f) {
    let z = this.params.bias;
    for (const k of FEATURES) z += (this.params.w[k] || 0) * (f[k] || 0);
    return sigmoid(z);
  }
  get source() { return this.params.source || 'trained'; }
}

export function loadModel() {
  try {
    const p = JSON.parse(fs.readFileSync(path.join(config.dataDir, 'model.json'), 'utf8'));
    if (p && typeof p.bias === 'number' && p.w) return new Model(p);
  } catch {}
  return new Model(PRIOR);
}
