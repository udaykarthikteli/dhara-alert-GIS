// Calibrates the hazard model on real, labelled historical events.
//
//   node scripts/build-training.js        (builds server/data/training.csv from the NASA Global Landslide Catalog)
//   npm run train                          (this file: learns the weights and writes server/data/model.json)
//
// CSV columns (header required, numbers only):  fs,rain,seis,cit,antec,sat,label
// Each row is one site-day built from the SAME feature definitions the live engine uses (see services/risk.js):
//   label = 1 if a landslide was recorded there that day, label = 0 for sampled non-event days.
//
// Features that carry no information in the historical rows (earthquake load and citizen reports are always 0 there)
// are NOT learned: they keep their expert weights, so the trained model still reacts to earthquakes and citizen reports.
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { FEATURES, PRIOR } from '../services/model.js';

const file = process.argv[2] || path.join(config.dataDir, 'training.csv');
if (!fs.existsSync(file)) { console.error(`No training data at ${file}. Run: node scripts/build-training.js`); process.exit(1); }
const [head, ...lines] = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/);
const cols = head.split(',').map((s) => s.trim());
const rows = lines.map((l) => l.split(',').map(Number)).filter((r) => r.every(Number.isFinite));
for (const f of [...FEATURES, 'label']) if (!cols.includes(f)) { console.error('Missing column: ' + f); process.exit(1); }
const X = rows.map((r) => FEATURES.map((f) => r[cols.indexOf(f)]));
const y = rows.map((r) => r[cols.indexOf('label')]);
const pos = y.filter(Boolean).length, neg = y.length - pos;
if (pos < 30 || neg < 30) { console.error(`Need at least 30 events and 30 non-events (have ${pos}/${neg}).`); process.exit(1); }

const sig = (z) => 1 / (1 + Math.exp(-z));
const variance = (j) => { const v = X.map((x) => x[j]), m = v.reduce((a, b) => a + b, 0) / v.length; return v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length; };
const frozen = FEATURES.map((_, j) => variance(j) < 1e-9);

// L2-regularised logistic regression, class-balanced, full-batch gradient descent. Learned weights are constrained >= 0
// so every factor keeps its physical (monotonic) meaning.
function fit(Xs, ys) {
  const n = ys.length, p = ys.filter(Boolean).length, wp = n / (2 * p), wn = n / (2 * (n - p)), lr = 0.3, lam = 0.01;
  let w = FEATURES.map((f, j) => (frozen[j] ? PRIOR.w[f] : 0.5)), b = -2;
  for (let it = 0; it < 4000; it++) {
    const gw = FEATURES.map(() => 0); let gb = 0;
    Xs.forEach((x, i) => {
      const e = (sig(b + x.reduce((s, v, j) => s + v * w[j], 0)) - ys[i]) * (ys[i] ? wp : wn);
      x.forEach((v, j) => { gw[j] += e * v; }); gb += e;
    });
    w = w.map((v, j) => (frozen[j] ? v : Math.max(0, v - lr * (gw[j] / n + lam * v)))); b -= lr * (gb / n);
  }
  return { w, b };
}
const score = (m, x) => sig(m.b + x.reduce((s, v, j) => s + v * m.w[j], 0));
function auc(s, labels) {
  let conc = 0, tot = 0;
  for (let i = 0; i < labels.length; i++) if (labels[i]) for (let j = 0; j < labels.length; j++) if (!labels[j]) { tot++; conc += s[i] > s[j] ? 1 : s[i] === s[j] ? 0.5 : 0; }
  return tot ? conc / tot : NaN;
}

// Honest check first: train on 3 of every 4 rows, test on the rest that the model never saw.
const test = (_, i) => i % 4 === 0;
const trX = X.filter((_, i) => !test(_, i)), trY = y.filter((_, i) => !test(_, i));
const teX = X.filter(test), teY = y.filter(test);
const m1 = fit(trX, trY), teScores = teX.map((x) => score(m1, x));
const heldAuc = auc(teScores, teY);
const hit = teScores.filter((s, i) => teY[i] && s * 100 >= 40).length, falseAl = teScores.filter((s, i) => !teY[i] && s * 100 >= 40).length;
const tePos = teY.filter(Boolean).length, teNeg = teY.length - tePos;

// Final model on all the data
const m = fit(X, y);
const scores = X.map((x) => score(m, x));
const model = {
  bias: m.b, w: Object.fromEntries(FEATURES.map((f, j) => [f, m.w[j]])),
  source: `trained on ${pos} landslide events / ${neg} non-event days (NASA GLC)` + (frozen.some(Boolean) ? `; ${FEATURES.filter((_, j) => frozen[j]).join(', ')} kept at expert weights` : ''),
  auc_train: auc(scores, y), auc_heldout: heldAuc, trainedAt: new Date().toISOString(),
};
fs.mkdirSync(config.dataDir, { recursive: true });
fs.writeFileSync(path.join(config.dataDir, 'model.json'), JSON.stringify(model, null, 2));
console.log(model);
console.log(`\nHeld-out check (rows the model did not train on): AUC ${heldAuc.toFixed(2)}  (0.5 = guessing, 1.0 = perfect)`);
console.log(`At Warning level (hazard 40+): flags ${hit} of ${tePos} real landslide days, and ${falseAl} of ${teNeg} ordinary days.`);
console.log(`Saved to ${path.join(config.dataDir, 'model.json')}. Commit that file to GitHub (folder server/data) to use it on the site.`);
