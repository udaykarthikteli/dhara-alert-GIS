// Calibrates the hazard model on real, labelled historical events.
//
//   npm run train -- path/to/training.csv
//
// CSV columns (header required):  fs,rain,seis,cit,antec,sat,label
// Each row is one site-day built from the SAME feature definitions the live engine uses (see services/risk.js):
//   label = 1 if a landslide was recorded at the site that day (e.g. NASA Global Landslide Catalog / GSI / NDMA records),
//   label = 0 for sampled non-event days. The output is written to server/data/model.json and loaded on next start.
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { FEATURES } from '../services/model.js';

const file = process.argv[2] || path.join(config.dataDir, 'training.csv');
if (!fs.existsSync(file)) { console.error(`No training data at ${file}. See header comment for the CSV format.`); process.exit(1); }
const [head, ...lines] = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/);
const cols = head.split(',').map((s) => s.trim());
const rows = lines.map((l) => l.split(',').map(Number)).filter((r) => r.every(Number.isFinite));
for (const f of [...FEATURES, 'label']) if (!cols.includes(f)) { console.error('Missing column: ' + f); process.exit(1); }
const X = rows.map((r) => FEATURES.map((f) => r[cols.indexOf(f)]));
const y = rows.map((r) => r[cols.indexOf('label')]);
const pos = y.filter(Boolean).length, neg = y.length - pos;
if (pos < 30 || neg < 30) { console.error(`Need at least 30 events and 30 non-events (have ${pos}/${neg}).`); process.exit(1); }

// L2-regularised logistic regression, class-balanced, full-batch gradient descent. Weights constrained >= 0
// so every factor keeps its physical (monotonic) meaning.
const sig = (z) => 1 / (1 + Math.exp(-z));
let w = FEATURES.map(() => 0.5), b = -2;
const wp = y.length / (2 * pos), wn = y.length / (2 * neg), lr = 0.3, lam = 0.01;
for (let it = 0; it < 4000; it++) {
  const gw = FEATURES.map(() => 0); let gb = 0;
  X.forEach((x, i) => {
    const p = sig(b + x.reduce((s, v, j) => s + v * w[j], 0));
    const e = (p - y[i]) * (y[i] ? wp : wn);
    x.forEach((v, j) => { gw[j] += e * v; }); gb += e;
  });
  w = w.map((v, j) => Math.max(0, v - lr * (gw[j] / y.length + lam * v))); b -= lr * (gb / y.length);
}
// Hold-out style sanity metric (AUC on the training set; use a spatial/temporal split for a proper validation)
const scores = X.map((x) => sig(b + x.reduce((s, v, j) => s + v * w[j], 0)));
let conc = 0, tot = 0;
for (let i = 0; i < y.length; i++) if (y[i]) for (let j = 0; j < y.length; j++) if (!y[j]) { tot++; conc += scores[i] > scores[j] ? 1 : scores[i] === scores[j] ? 0.5 : 0; }
const model = { bias: b, w: Object.fromEntries(FEATURES.map((f, j) => [f, w[j]])), source: `trained on ${pos} events / ${neg} non-events`, auc_train: conc / tot, trainedAt: new Date().toISOString() };
fs.mkdirSync(config.dataDir, { recursive: true });
fs.writeFileSync(path.join(config.dataDir, 'model.json'), JSON.stringify(model, null, 2));
console.log(model);
