// Pure, testable hazard maths. No I/O here.
//
//  1. Infinite-slope Mohr-Coulomb Factor of Safety with pore pressure and a pseudo-static seismic term
//  2. Rainfall intensity-duration exceedance vs. the Caine (1980) global threshold  I = 14.82 D^-0.39
//  3. Antecedent rainfall (7 d) and soil saturation
//  4. A logistic model (see model.js) fuses these into the Landslide Hazard Index (0-100)

export const LEVELS = ['low', 'watch', 'warning', 'danger', 'critical'];
export const LEVEL_MIN = [0, 20, 40, 60, 80];
export const levelOf = (lhi) => LEVEL_MIN.reduce((acc, m, i) => (lhi >= m ? i : acc), 0);

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const rad = (d) => (d * Math.PI) / 180;
const GAMMA_W = 9.81; // kN/m3

/**
 * Factor of Safety of an infinite slope (translational slide of a soil slab of thickness z).
 * m = fraction of the slab that is saturated (0 dry .. 1 fully saturated, water table at surface).
 * kh = horizontal seismic coefficient (pseudo-static).
 */
export function factorOfSafety({ slopeDeg, c, phi, gamma, z, m, kh = 0 }) {
  const b = rad(slopeDeg), ph = rad(phi);
  const cos2 = Math.cos(b) ** 2, sc = Math.sin(b) * Math.cos(b);
  const normal = gamma * z * cos2 - kh * gamma * z * sc - m * GAMMA_W * z * cos2;
  const resisting = c + Math.max(0, normal) * Math.tan(ph);
  const driving = gamma * z * (sc + kh * cos2);
  return resisting / driving;
}
/** Maps FS to 0..1 hazard (0.5 at FS 1.25, ~0.82 at FS 1.0). */
export const fsScore = (fs) => sigmoid(-6 * (fs - 1.25));

export const caineThreshold = (hours) => 14.82 * Math.pow(hours, -0.39); // mm/h
const DURATIONS = [1, 3, 6, 12, 24, 48, 72, 120];
/** `past` = hourly rainfall (mm) ending at the evaluation hour (newest last). Returns max I/I_thr ratio. */
export function rainRatio(past) {
  let best = 0;
  for (const D of DURATIONS) {
    if (past.length < D) continue;
    let s = 0;
    for (let i = past.length - D; i < past.length; i++) s += past[i] || 0;
    best = Math.max(best, s / D / caineThreshold(D));
  }
  return best;
}
export const rainScore = (ratio) => sigmoid(5 * (ratio - 0.7));
export const sum = (a, n) => { let s = 0; for (let i = Math.max(0, a.length - n); i < a.length; i++) s += a[i] || 0; return s; };

/** Seismic: Fukushima & Tanaka (1990) PGA attenuation, kh = 0.5 PGA (Hynes-Griffin & Franklin 1984). */
export function pgaG(mag, distKm) {
  const logA = 0.41 * mag - Math.log10(distKm + 0.032 * Math.pow(10, 0.41 * mag)) - 0.0034 * distKm + 1.3; // cm/s2
  return Math.pow(10, logA) / 980.665;
}
export const seismicKh = (pga) => 0.5 * pga;

/**
 * Evaluate one site at one instant.
 * past: hourly rain array ending now. theta: volumetric soil moisture (m3/m3) now.
 */
export function evaluate({ geology, slopeDeg, past, theta, kh = 0, citizen = 0, model }) {
  const thetaR = 0.12;
  const mSoil = clamp((theta - thetaR) / (geology.thetaSat - thetaR));
  const r72 = sum(past, 72), r168 = sum(past, 168);
  // Saturation blends the soil-moisture signal with an antecedent-rainfall wetness index.
  const m = clamp(0.6 * mSoil + 0.4 * clamp(r72 / 180));
  const fs = factorOfSafety({ slopeDeg, c: geology.c, phi: geology.phi, gamma: geology.gamma, z: geology.z, m, kh });
  const ratio = rainRatio(past);
  const features = {
    fs: fsScore(fs), rain: rainScore(ratio), seis: clamp(kh / 0.1), cit: clamp(citizen),
    antec: clamp(r168 / 400), sat: m,
  };
  const p = model.predict(features);
  const lhi = Math.round(p * 1000) / 10;
  return {
    lhi, level: levelOf(lhi), fs: Math.round(fs * 100) / 100, features, m: Math.round(m * 100) / 100,
    ratio: Math.round(ratio * 100) / 100,
    rain: { r1: sum(past, 1), r3: sum(past, 3), r24: sum(past, 24), r72, r168 },
  };
}
