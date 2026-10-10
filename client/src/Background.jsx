import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/*
  3D landslide scene (three.js). A real height-field mountain in monsoon dusk: rain, drifting fog, layered
  ridges, a village and a sensor mast. Every ~10-20 s the slope cracks, then rocks, mud and trees run
  down it under gravity and friction, carve a laterite scar, bury the road and pile up on the valley floor.
  The hill then heals and the cycle repeats. The live Landslide Hazard Index drives the weather:
  rain density, sky colour, fog, lightning and how often the slope lets go.
*/

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const rnd = (a, b) => a + Math.random() * (b - a);

// ---- deterministic value noise -------------------------------------------------------------
function makeNoise(seed = 7) {
  let s = seed; const rand = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const perm = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  const P = new Uint8Array(512), V = new Float32Array(256);
  for (let i = 0; i < 512; i++) P[i] = perm[i & 255];
  for (let i = 0; i < 256; i++) V[i] = rand();
  const fade = (t) => t * t * (3 - 2 * t);
  const n2 = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), u = fade(x - xi), v = fade(y - yi);
    const a = V[P[P[xi & 255] + (yi & 255)]], b = V[P[P[(xi + 1) & 255] + (yi & 255)]];
    const c = V[P[P[xi & 255] + ((yi + 1) & 255)]], d = V[P[P[(xi + 1) & 255] + ((yi + 1) & 255)]];
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  };
  const fbm = (x, y, o = 4) => { let a = 0.5, f = 1, t = 0, n = 0; for (let i = 0; i < o; i++) { t += a * n2(x * f, y * f); n += a; a *= 0.5; f *= 2.03; } return t / n; };
  return { n2, fbm };
}

const X0 = -100, X1 = 100, Z0 = -90, Z1 = 90;
const G = 18;
const WARN = 3.4, SLIDE = 3.8, RECOVER = 8;
const SKY = { calmTop: new THREE.Color('#0a1c22'), calmHor: new THREE.Color('#5f7a69'), stormTop: new THREE.Color('#150a0e'), stormHor: new THREE.Color('#b0501f') };
const ROCKS = ['#4a3322', '#6a4329', '#8a5634', '#3a2a20', '#5d3f2b', '#77695c'].map((c) => new THREE.Color(c));

export class World {
  constructor(aspect = 16 / 9, small = false) {
    this.small = small; this.t = 0; this.frame = 0; this.riskS = 0.3;
    this.phase = 'calm'; this.phaseT = 0; this.calmDur = 3.5; this.crack = 0; this.push = 0; this.shake = 0; this.flash = 0;
    this.rocks = []; this.sliding = []; this.src = null; this.spawnAcc = 0; this.cursor = 0; this.skyRs = -1;
    this.noise = makeNoise(7);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(52, aspect, 0.5, 1200);
    this.resize(aspect);
    this.buildSky(); this.buildLights(); this.buildTerrain(); this.buildBackdrop(); this.buildRoad();
    this.buildTrees(); this.buildRocks(); this.buildDust(); this.buildRain(); this.buildVillage(); this.buildMast();
    this.applyRisk(0.3, true); this.updateCamera(0);
  }

  resize(aspect) { this.aspect = aspect; this.camera.aspect = aspect; this.camera.fov = aspect < 0.8 ? 74 : aspect < 1.3 ? 62 : 52; this.camera.updateProjectionMatrix(); }

  // ---------------------------------------------------------------- sky, lights, backdrop
  buildSky() {
    this.skyCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (this.skyCanvas) { this.skyCanvas.width = 2; this.skyCanvas.height = 256; this.skyTex = new THREE.CanvasTexture(this.skyCanvas); this.skyTex.colorSpace = THREE.SRGBColorSpace; this.scene.background = this.skyTex; }
    else this.scene.background = new THREE.Color('#17383a');
    this.scene.fog = new THREE.FogExp2('#5f7a69', 0.0034);
  }
  buildLights() {
    this.hemi = new THREE.HemisphereLight('#9fb8b0', '#2a1d14', 0.75); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#ffd9a8', 1.6); this.sun.position.set(-140, 70, 60); this.scene.add(this.sun);
    this.fill = new THREE.DirectionalLight('#6f9aa8', 0.35); this.fill.position.set(90, 40, 120); this.scene.add(this.fill);
  }
  applyRisk(rs, force) {
    const top = SKY.calmTop.clone().lerp(SKY.stormTop, clamp(rs * 1.1)), hor = SKY.calmHor.clone().lerp(SKY.stormHor, clamp(rs * 1.05));
    this.horizon = hor;
    this.scene.fog.color.copy(hor); this.scene.fog.density = lerp(0.0032, 0.0056, rs);
    this.sun.color.set('#ffe0b0').lerp(new THREE.Color('#ff7a35'), rs); this.sun.intensity = lerp(1.7, 1.15, rs);
    this.hemi.intensity = lerp(0.8, 0.55, rs) + this.flash * 2.2;
    this.backdrop?.forEach((m, i) => m.material.color.copy(hor).lerp(new THREE.Color('#0b0806'), 0.35 + i * 0.22 - 0.1));
    if (this.skyCanvas && (force || Math.abs(rs - this.skyRs) > 0.015)) {
      const ctx = this.skyCanvas.getContext('2d'), g = ctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, '#' + top.getHexString()); g.addColorStop(0.55, '#' + top.clone().lerp(hor, 0.55).getHexString()); g.addColorStop(1, '#' + hor.getHexString());
      ctx.fillStyle = g; ctx.fillRect(0, 0, 2, 256); this.skyTex.needsUpdate = true; this.skyRs = rs;
    }
  }
  buildBackdrop() {
    this.backdrop = [];
    [[-150, 50, 40, 0.012], [-205, 68, 46, 0.009], [-260, 85, 42, 0.007]].forEach(([z, base, amp, f], li) => {
      const N = 160, pos = new Float32Array(N * 2 * 3), idx = [];
      for (let i = 0; i < N; i++) {
        const x = -450 + (900 * i) / (N - 1), y = base + amp * (this.noise.fbm(x * f + li * 31, li * 7, 4) - 0.25) * 1.6;
        pos.set([x, y, z, x, -30, z], i * 6);
        if (i < N - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#1a2a28', side: THREE.DoubleSide, fog: true })); this.scene.add(m); this.backdrop.push(m);
    });
  }

  // ---------------------------------------------------------------- terrain (height-field)
  baseHeight(x, z) {
    const u = (z - Z0) / (Z1 - Z0);
    let y = 58 * (1 - smooth((u - 0.08) / 0.78));
    y += 0.0042 * x * x * (0.35 + 0.65 * u);
    y += (this.noise.fbm(x * 0.025 + 3, z * 0.025, 4) - 0.5) * 15 * (1 - 0.5 * u) + (this.noise.fbm(x * 0.12, z * 0.12, 3) - 0.5) * 2.2;
    y += 50 * smooth((Math.abs(x) - 60) / 50) * (0.5 + 0.5 * (1 - u));
    return Math.max(y, 0);
  }
  buildTerrain() {
    const nx = (this.nx = this.small ? 121 : 161), nz = (this.nz = this.small ? 109 : 145), n = nx * nz;
    this.dx = (X1 - X0) / (nx - 1); this.dz = (Z1 - Z0) / (nz - 1);
    this.h0 = new Float32Array(n); this.h = new Float32Array(n); this.slp = new Float32Array(n); this.tone = new Float32Array(n); this.crackAmt = new Float32Array(n);
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = j * nx + i, x = X0 + i * this.dx, z = Z0 + j * this.dz; this.h0[k] = this.h[k] = this.baseHeight(x, z); pos[k * 3] = x; pos[k * 3 + 2] = z; this.tone[k] = this.noise.fbm(x * 0.2 + 50, z * 0.2, 3); }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i, gx = (this.h0[j * nx + Math.min(i + 1, nx - 1)] - this.h0[j * nx + Math.max(i - 1, 0)]) / (2 * this.dx), gz = (this.h0[Math.min(j + 1, nz - 1) * nx + i] - this.h0[Math.max(j - 1, 0) * nx + i]) / (2 * this.dz);
      this.slp[k] = Math.hypot(gx, gz); pos[k * 3 + 1] = this.h0[k];
    }
    const idx = new Uint16Array((nx - 1) * (nz - 1) * 6); let q = 0;
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx.set([a, b, c, b, d, c], q); q += 6; }
    // make sure triangles face up
    const e1 = [pos[idx[1] * 3] - pos[idx[0] * 3], pos[idx[1] * 3 + 1] - pos[idx[0] * 3 + 1], pos[idx[1] * 3 + 2] - pos[idx[0] * 3 + 2]], e2 = [pos[idx[2] * 3] - pos[idx[0] * 3], pos[idx[2] * 3 + 1] - pos[idx[0] * 3 + 1], pos[idx[2] * 3 + 2] - pos[idx[0] * 3 + 2]];
    const ny = e1[2] * e2[0] - e1[0] * e2[2];
    if (ny < 0) for (let t = 0; t < idx.length; t += 3) { const tmp = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = tmp; }
    this.geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(pos, 3); this.colAttr = new THREE.BufferAttribute(col, 3);
    this.geo.setAttribute('position', this.posAttr); this.geo.setAttribute('color', this.colAttr); this.geo.setIndex(new THREE.BufferAttribute(idx, 1));
    for (let k = 0; k < n; k++) this.paint(k);
    this.geo.computeVertexNormals();
    this.mesh = new THREE.Mesh(this.geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 }));
    this.scene.add(this.mesh);
    this.resetDirty(); this.tb = { i0: nx, i1: 0, j0: nz, j1: 0 };
  }
  paint(k) {
    const d = this.h[k] - this.h0[k], s = this.slp[k], n = this.tone[k], c = this.colAttr.array;
    const veg = clamp(1 - (s - 0.5) / 0.55);
    let r = lerp(0.3, 0.12 + 0.07 * n, veg), g = lerp(0.24, 0.2 + 0.1 * n, veg), b = lerp(0.2, 0.1 + 0.03 * n, veg);
    if (this.h0[k] < 5) { const m = clamp(1 - this.h0[k] / 5) * 0.7; r = lerp(r, 0.2, m); g = lerp(g, 0.31, m); b = lerp(b, 0.12, m); }
    if (d > 0.3) { const a = clamp(d / 2.6), m = clamp(d / 0.9); r = lerp(r, lerp(0.62, 0.4, a), m); g = lerp(g, lerp(0.27, 0.17, a), m); b = lerp(b, lerp(0.1, 0.08, a), m); }
    else if (d < -0.3) { const m = clamp(-d / 0.9); r = lerp(r, 0.34, m); g = lerp(g, 0.23, m); b = lerp(b, 0.15, m); }
    const cr = 1 - 0.88 * this.crackAmt[k];
    c[k * 3] = r * cr; c[k * 3 + 1] = g * cr; c[k * 3 + 2] = b * cr;
  }
  resetDirty() { this.dirty = false; this.dr = { i0: 1e9, i1: -1, j0: 1e9, j1: -1 }; }
  touch(i0, i1, j0, j1) {
    const r = this.dr, t = this.tb; this.dirty = true;
    r.i0 = Math.min(r.i0, i0); r.i1 = Math.max(r.i1, i1); r.j0 = Math.min(r.j0, j0); r.j1 = Math.max(r.j1, j1);
    t.i0 = Math.min(t.i0, i0); t.i1 = Math.max(t.i1, i1); t.j0 = Math.min(t.j0, j0); t.j1 = Math.max(t.j1, j1);
  }
  flush() {
    if (!this.dirty) return;
    const { i0, i1, j0, j1 } = this.dr, p = this.posAttr.array;
    for (let j = Math.max(0, j0); j <= Math.min(this.nz - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(this.nx - 1, i1); i++) { const k = j * this.nx + i; p[k * 3 + 1] = this.h[k]; this.paint(k); }
    this.posAttr.needsUpdate = true; this.colAttr.needsUpdate = true; this.geo.computeVertexNormals(); this.resetDirty();
  }
  hAt(x, z) {
    const fx = clamp((x - X0) / this.dx, 0, this.nx - 1.001), fz = clamp((z - Z0) / this.dz, 0, this.nz - 1.001), i = fx | 0, j = fz | 0, a = fx - i, b = fz - j, k = j * this.nx + i, h = this.h;
    return lerp(lerp(h[k], h[k + 1], a), lerp(h[k + this.nx], h[k + this.nx + 1], a), b);
  }
  bump(x, z, amp, sigma) {
    const ci = (x - X0) / this.dx, cj = (z - Z0) / this.dz, ri = Math.ceil((sigma * 3) / this.dx), rj = Math.ceil((sigma * 3) / this.dz);
    const i0 = Math.max(0, Math.floor(ci) - ri), i1 = Math.min(this.nx - 1, Math.ceil(ci) + ri), j0 = Math.max(0, Math.floor(cj) - rj), j1 = Math.min(this.nz - 1, Math.ceil(cj) + rj);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * this.nx + i, dx = (i - ci) * this.dx, dz = (j - cj) * this.dz, w = Math.exp(-(dx * dx + dz * dz) / (2 * sigma * sigma));
      this.h[k] = clamp(this.h[k] + amp * w, this.h0[k] - 5.5, this.h0[k] + 5);
    }
    this.touch(i0, i1, j0, j1);
  }

  // ---------------------------------------------------------------- props
  buildRoad() {
    const pts = [], W = 1.7;
    for (let x = -80; x <= 80; x += 2) { const z = 34 + 5 * Math.sin(x * 0.045); pts.push([x, this.hAt(x, z) + 0.12, z]); }
    const pos = [], idx = [];
    pts.forEach(([x, y, z], i) => { pos.push(x, y, z - W, x, y, z + W); if (i < pts.length - 1) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#34312c', roughness: 1, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    this.scene.add(m); this.road = m;
  }
  buildTrees() {
    const parts = [];
    const add = (geo, y, rgb) => { geo.translate(0, y, 0); const n = geo.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) c.set(rgb, i * 3); geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); parts.push(geo.toNonIndexed()); };
    add(new THREE.CylinderGeometry(0.14, 0.2, 1.4, 5), 0.7, [0.16, 0.1, 0.06]);
    add(new THREE.ConeGeometry(1.5, 3.0, 7), 2.4, [0.07, 0.16, 0.09]); add(new THREE.ConeGeometry(1.15, 2.6, 7), 3.8, [0.09, 0.2, 0.11]); add(new THREE.ConeGeometry(0.8, 2.2, 7), 5.0, [0.11, 0.24, 0.13]);
    const geo = mergeGeometries(parts);
    const count = this.small ? 420 : 760;
    this.treeMesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }), count);
    this.trees = []; this.dummy = new THREE.Object3D();
    let tries = 0;
    while (this.trees.length < count && tries++ < count * 30) {
      const x = rnd(-88, 88), z = rnd(-82, 62), u = (z - Z0) / (Z1 - Z0);
      const k = Math.round((z - Z0) / this.dz) * this.nx + Math.round((x - X0) / this.dx);
      if (this.slp[k] > 0.85 || Math.abs(z - (34 + 5 * Math.sin(x * 0.045))) < 4 || (z > 40 && x > 22 && x < 72)) continue;
      if (this.noise.fbm(x * 0.05 + 9, z * 0.05, 3) < 0.38 - 0.1 * u) continue;
      this.trees.push({ x, z, s: rnd(0.9, 2.1), ry: rnd(0, 6.28), state: 0, t: 0, y: this.h0[k] - 0.15, p: null });
    }
    this.treeMesh.count = this.trees.length;
    const tint = new THREE.Color();
    this.trees.forEach((tr, i) => { this.setTree(i, tr.x, tr.y, tr.z, tr.s, 0, tr.ry); tint.setHSL(rnd(0.24, 0.33), rnd(0.2, 0.4), rnd(0.55, 0.95)); this.treeMesh.setColorAt(i, tint); });
    this.treeMesh.instanceMatrix.needsUpdate = true; this.treeMesh.instanceColor.needsUpdate = true; this.treeDirty = false;
    this.scene.add(this.treeMesh);
  }
  setTree(i, x, y, z, s, tilt, ry) { const d = this.dummy; d.position.set(x, y, z); d.rotation.set(tilt, ry, 0, 'YXZ'); d.scale.setScalar(s); d.updateMatrix(); this.treeMesh.setMatrixAt(i, d.matrix); this.treeDirty = true; }
  buildRocks() {
    this.MAXR = this.small ? 220 : 380;
    this.rockMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ roughness: 0.92, flatShading: true }), this.MAXR);
    this.rockMesh.count = 0; this.rockMesh.frustumCulled = false; this.scene.add(this.rockMesh);
    this.rockMesh.setColorAt(0, new THREE.Color()); this.rockMesh.instanceColor.needsUpdate = true;
  }
  buildDust() {
    const N = (this.N = 200); this.dpos = new Float32Array(N * 3); this.dsize = new Float32Array(N); this.dalpha = new Float32Array(N); this.dlife = new Float32Array(N); this.dmax = new Float32Array(N).fill(1); this.dvx = new Float32Array(N);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.dpos, 3)); g.setAttribute('size', new THREE.BufferAttribute(this.dsize, 1)); g.setAttribute('alpha', new THREE.BufferAttribute(this.dalpha, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { col: { value: new THREE.Color('#b99a78') } },
      vertexShader: 'attribute float size; attribute float alpha; varying float vA; void main(){ vA=alpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*(320.0/-mv.z); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform vec3 col; varying float vA; void main(){ float d=length(gl_PointCoord-0.5)*2.0; float a=smoothstep(1.0,0.0,d)*vA; if(a<0.01) discard; gl_FragColor=vec4(col,a); }',
    });
    this.dust = new THREE.Points(g, m); this.dust.frustumCulled = false; this.scene.add(this.dust);
  }
  puff(x, y, z, s = 1) { const i = this.cursor++ % this.N; this.dpos.set([x, y, z], i * 3); this.dsize[i] = rnd(3, 6) * s; this.dlife[i] = this.dmax[i] = rnd(1.6, 3.2); this.dvx[i] = rnd(-1.5, 1); this.dalpha[i] = 0.3; }
  buildRain() {
    const N = (this.RN = this.small ? 1300 : 2800); this.rpos = new Float32Array(N * 6); this.rv = new Float32Array(N);
    for (let i = 0; i < N; i++) { this.rv[i] = rnd(50, 75); const x = rnd(-140, 140), y = rnd(0, 100), z = rnd(-170, 140); this.rpos.set([x, y, z, x - 0.25, y + 2.2, z], i * 6); }
    this.rainGeo = new THREE.BufferGeometry(); this.rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rpos, 3));
    this.rain = new THREE.LineSegments(this.rainGeo, new THREE.LineBasicMaterial({ color: '#b4cbcd', transparent: true, opacity: 0.32, fog: false })); this.rain.frustumCulled = false; this.scene.add(this.rain);
  }
  buildVillage() {
    this.village = new THREE.Group();
    const body = new THREE.MeshStandardMaterial({ color: '#2a1d15', roughness: 1 }), roof = new THREE.MeshStandardMaterial({ color: '#3b2a1e', roughness: 1 }), win = new THREE.MeshBasicMaterial({ color: '#f6c470', fog: false });
    for (let i = 0; i < 7; i++) {
      const x = rnd(32, 70), z = rnd(47, 66), w = rnd(3.2, 5.2), h = rnd(2.4, 3.4), y = this.hAt(x, z), g = new THREE.Group();
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.8), body); b.position.y = h / 2;
      const r = new THREE.Mesh(new THREE.ConeGeometry(w * 0.78, h * 0.55, 4), roof); r.position.y = h + h * 0.27; r.rotation.y = Math.PI / 4;
      g.add(b, r);
      if (Math.random() < 0.8) { const wd = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.22, h * 0.32), win); wd.position.set(rnd(-w * 0.2, w * 0.2), h * 0.55, w * 0.4 + 0.02); g.add(wd); }
      g.position.set(x, y, z); this.village.add(g);
    }
    this.scene.add(this.village);
  }
  buildMast() {
    const x = -50, z = -4, y = this.h0[Math.round((z - Z0) / this.dz) * this.nx + Math.round((x - X0) / this.dx)];
    this.mast = new THREE.Group(); this.mast.position.set(x, y, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 10, 6), new THREE.MeshStandardMaterial({ color: '#20170f', roughness: 1 })); pole.position.y = 5;
    this.lamp = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 12), new THREE.MeshBasicMaterial({ color: '#8fc4bb', fog: false })); this.lamp.position.y = 10.3;
    this.lampLight = new THREE.PointLight('#8fc4bb', 0, 30, 2); this.lampLight.position.y = 10.5;
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: '#ff5a3a', transparent: true, opacity: 0, side: THREE.DoubleSide, fog: false })); this.ring.position.y = 10.3; this.ring.rotation.x = -Math.PI / 2 + 0.5;
    this.mast.add(pole, this.lamp, this.lampLight, this.ring); this.scene.add(this.mast); this.ringT = 0;
  }

  // ---------------------------------------------------------------- landslide logic
  startWarning() {
    const cx = rnd(-22, 22), cz = rnd(-26, -8), rx = rnd(16, 23), rz = rnd(11, 16);
    this.src = { cx, cz, rx, rz, depth: rnd(3.2, 4.6) }; this.phase = 'warn'; this.phaseT = 0; this.crack = 0; this.ringT = 0;
    this.crackCells = [];
    for (let t = -1; t <= 1.0001; t += 0.015) {
      const x = cx + t * rx * 0.97, z = cz - rz * 0.92 * Math.sqrt(Math.max(0, 1 - t * t)) - 1.5 + Math.sin(t * 9) * 0.5;
      const i = Math.round((x - X0) / this.dx), j = Math.round((z - Z0) / this.dz);
      for (let a = 0; a <= 1; a++) this.crackCells.push({ k: j * this.nx + i + a, i: i + a, j, t: (t + 1) / 2 });
    }
  }
  startSlide() {
    this.phase = 'slide'; this.phaseT = 0; this.spawnAcc = 0; this.shake = 1.4; this.nTotal = this.small ? 170 : 300;
    const s = this.src;
    this.trees.forEach((tr) => { const e = ((tr.x - s.cx) / s.rx) ** 2 + ((tr.z - s.cz) / s.rz) ** 2; tr.slideAt = e < 1 && tr.state === 0 ? ((tr.z - (s.cz - s.rz)) / (2 * s.rz)) * SLIDE * 0.8 + rnd(0, 0.5) : -1; });
  }
  spawnRock(x, z, tiny) {
    if (this.rocks.length >= this.MAXR) return;
    const r = tiny ? rnd(0.25, 0.55) : rnd(0.7, 2.3), s = this.src;
    const prof = clamp(1 - ((x - s.cx) / s.rx) ** 2 - ((z - s.cz) / s.rz) ** 2);
    const k = Math.round((z - Z0) / this.dz) * this.nx + Math.round((x - X0) / this.dx);
    if (!tiny && this.h0[k] - this.h[k] > -s.depth * prof) this.bump(x, z, -r * 0.55, r * 1.1 + 1);
    this.rocks.push({ x, y: this.hAt(x, z) + r, z, vx: rnd(-0.6, 0.6), vy: 0, vz: tiny ? rnd(0.2, 2) : rnd(4, 8), age: 0, r, sx: rnd(0.8, 1.25), sy: rnd(0.7, 1.1), rx: rnd(0, 6), rz: rnd(0, 6), mu: tiny ? rnd(0.25, 0.35) : rnd(0.11, 0.22), still: 0, col: ROCKS[(Math.random() * ROCKS.length) | 0], mud: Math.random() < 0.3 });
  }
  // shared body physics on the height-field; returns true when the body has come to rest / left the map
  stepBody(p, dt) {
    p.vy -= G * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    const gy = this.hAt(p.x, p.z) + p.r * 0.7; let contact = false;
    if (p.y < gy) {
      p.y = gy; contact = true;
      const e = 0.8, gx = (this.hAt(p.x + e, p.z) - this.hAt(p.x - e, p.z)) / (2 * e), gz = (this.hAt(p.x, p.z + e) - this.hAt(p.x, p.z - e)) / (2 * e), nl = Math.hypot(gx, 1, gz), nx = -gx / nl, ny = 1 / nl, nz = -gz / nl;
      let vn = p.vx * nx + p.vy * ny + p.vz * nz;
      const vn0 = vn;
      if (vn < -4) vn *= -0.2; else vn = Math.max(0, vn);
      let tx = p.vx - vn0 * nx, ty = p.vy - vn0 * ny, tz = p.vz - vn0 * nz;
      const ts = Math.hypot(tx, ty, tz), mu = p.mu * (ny > 0.97 ? 2.3 : 1), dec = mu * G * ny * dt;
      if (ts <= dec) { tx = ty = tz = 0; } else { const f = 1 - dec / ts; tx *= f; ty *= f; tz *= f; }
      p.vx = tx + vn * nx; p.vy = ty + vn * ny; p.vz = tz + vn * nz;
      if (p.kind !== 'tree' && Math.hypot(p.vx, p.vz) > 8 && Math.random() < 0.22) this.puff(p.x, p.y, p.z, p.r * 0.5);
    }
    const sp = Math.hypot(p.vx, p.vy, p.vz);
    p.age = (p.age || 0) + dt; p.still = contact && sp < 0.9 && p.age > 1.5 ? p.still + dt : 0;
    p.rx += (p.vz * dt) / p.r; p.rz -= (p.vx * dt) / p.r;
    return p.still > 0.4 || p.z > Z1 - 3 || Math.abs(p.x) > X1 - 3 || p.y < -30;
  }

  update(dt, risk) {
    dt = Math.min(dt, 0.05); this.t += dt; this.phaseT += dt; this.frame++;
    this.riskS += (risk - this.riskS) * Math.min(1, dt * 0.8); const rs = this.riskS;
    const s = this.src;

    if (this.phase === 'calm' && this.phaseT > this.calmDur) this.startWarning();
    else if (this.phase === 'warn') {
      const prog = clamp(this.phaseT / WARN); this.crack = prog; this.shake = Math.max(this.shake, prog * 0.25);
      for (const c of this.crackCells) if (c.t <= prog && !this.crackAmt[c.k]) { this.crackAmt[c.k] = 1; this.touch(c.i - 1, c.i + 1, c.j - 1, c.j + 1); }
      if (Math.random() < dt * 16 * prog) this.spawnRock(rnd(s.cx - s.rx * 0.6, s.cx + s.rx * 0.6), s.cz - s.rz * rnd(0.3, 0.9), true);
      if (this.phaseT > WARN) this.startSlide();
    } else if (this.phase === 'slide') {
      const prog = clamp(this.phaseT / SLIDE);
      if (this.phaseT < SLIDE) {
        this.spawnAcc += (this.nTotal / SLIDE) * dt;
        while (this.spawnAcc >= 1) {
          this.spawnAcc -= 1;
          const a = rnd(0, 6.283), rr = Math.sqrt(Math.random()), zf = clamp(prog * 0.85 + Math.random() * 0.3, 0, 1) * 2 - 1;
          const x = s.cx + Math.cos(a) * rr * s.rx * Math.sqrt(Math.max(0, 1 - zf * zf)), z = s.cz + zf * s.rz;
          this.spawnRock(x, z, false);
        }
      }
      for (const tr of this.trees) if (tr.state === 0 && tr.slideAt >= 0 && this.phaseT >= tr.slideAt) {
        tr.state = 1; tr.t = 0; tr.p = { kind: 'tree', x: tr.x, y: this.hAt(tr.x, tr.z) + 1, z: tr.z, vx: 0, vy: 0, vz: rnd(1, 3), r: 1.1, rx: 0, rz: 0, mu: 0.4, still: 0 }; this.sliding.push(tr);
      }
      if (this.phaseT > SLIDE) { this.phase = 'settle'; this.phaseT = 0; }
    } else if (this.phase === 'settle') {
      if ((this.phaseT > 1.2 && !this.rocks.length && !this.sliding.length) || this.phaseT > 11) {
        for (const p of this.rocks) this.bump(p.x, p.z, p.r * 0.5, p.r * 1.1 + 0.8);
        this.rocks.length = 0;
        this.sliding.forEach((tr) => { tr.state = 2; tr.t = 0; tr.x2 = tr.p.x; tr.z2 = tr.p.z; tr.y2 = this.hAt(tr.p.x, tr.p.z) - 0.2; }); this.sliding.length = 0;
        this.phase = 'recover'; this.phaseT = 0;
      }
    } else if (this.phase === 'recover') {
      const k = Math.min(1, dt * 0.5), tb = this.tb;
      for (let j = Math.max(0, tb.j0); j <= Math.min(this.nz - 1, tb.j1); j++) for (let i = Math.max(0, tb.i0); i <= Math.min(this.nx - 1, tb.i1); i++) { const q = j * this.nx + i; this.h[q] += (this.h0[q] - this.h[q]) * k; this.crackAmt[q] *= 1 - Math.min(1, dt * 1.5); }
      this.touch(tb.i0, tb.i1, tb.j0, tb.j1);
      if (this.phaseT > RECOVER) {
        const tb2 = this.tb; for (let j = Math.max(0, tb2.j0); j <= Math.min(this.nz - 1, tb2.j1); j++) for (let i = Math.max(0, tb2.i0); i <= Math.min(this.nx - 1, tb2.i1); i++) { const q = j * this.nx + i; this.h[q] = this.h0[q]; this.crackAmt[q] = 0; }
        this.touch(tb2.i0, tb2.i1, tb2.j0, tb2.j1); this.flush(); this.tb = { i0: this.nx, i1: 0, j0: this.nz, j1: 0 };
        this.phase = 'calm'; this.phaseT = 0; this.calmDur = lerp(15, 5, rs) * rnd(0.85, 1.25); this.crack = 0;
      }
    }

    // physics
    const steps = Math.max(1, Math.ceil(dt / (1 / 60))), sdt = dt / steps;
    for (let st = 0; st < steps; st++) {
      for (let i = this.rocks.length - 1; i >= 0; i--) { const p = this.rocks[i]; if (this.stepBody(p, sdt)) { if (p.x > X0 + 3 && p.x < X1 - 3 && p.z < Z1 - 3) this.bump(p.x, p.z, p.r * 0.5, p.r * 1.1 + 0.8); if (p.r > 1.4) this.puff(p.x, p.y, p.z, 1.3); this.rocks[i] = this.rocks[this.rocks.length - 1]; this.rocks.pop(); } }
      for (let i = this.sliding.length - 1; i >= 0; i--) { const tr = this.sliding[i]; tr.t += sdt; if (this.stepBody(tr.p, sdt)) { tr.state = 2; tr.x2 = tr.p.x; tr.z2 = tr.p.z; tr.y2 = this.hAt(tr.p.x, tr.p.z) - 0.2; tr.t = 0; this.bump(tr.p.x, tr.p.z, 0.5, 2); this.sliding[i] = this.sliding[this.sliding.length - 1]; this.sliding.pop(); } }
    }

    // instanced rocks
    const rm = this.rockMesh, d = this.dummy, n = this.rocks.length; rm.count = n;
    for (let i = 0; i < n; i++) { const p = this.rocks[i]; d.position.set(p.x, p.y, p.z); d.rotation.set(p.rx, 0, p.rz); d.scale.set(p.r * p.sx, p.r * p.sy, p.r); d.updateMatrix(); rm.setMatrixAt(i, d.matrix); rm.setColorAt(i, p.mud ? ROCKS[3] : p.col); }
    if (n) { rm.instanceMatrix.needsUpdate = true; rm.instanceColor.needsUpdate = true; }

    // trees that slide, lie, regrow
    this.trees.forEach((tr, i) => {
      if (tr.state === 1) { const p = tr.p; this.setTree(i, p.x, p.y - 0.6, p.z, tr.s, Math.min(1.35, tr.t * 0.7), tr.ry); }
      else if (tr.state === 2) { if (this.phase === 'recover') { tr.t += dt; const sc = Math.max(0, 1 - tr.t / 1.5); this.setTree(i, tr.x2, tr.y2, tr.z2, tr.s * sc, 1.3, tr.ry); if (sc <= 0) { tr.state = 3; tr.t = 0; } } else this.setTree(i, tr.x2, tr.y2, tr.z2, tr.s, 1.3, tr.ry); }
      else if (tr.state === 3) { tr.t += dt; const g = clamp(tr.t / 5); this.setTree(i, tr.x, tr.y, tr.z, tr.s * g, 0, tr.ry); if (g >= 1) tr.state = 0; }
    });
    if (this.treeDirty) { this.treeMesh.instanceMatrix.needsUpdate = true; this.treeDirty = false; }

    if (this.dirty && this.frame % 2 === 0) this.flush();

    // dust
    for (let i = 0; i < this.N; i++) { if (this.dlife[i] <= 0) { this.dalpha[i] = 0; continue; } this.dlife[i] -= dt; this.dsize[i] += dt * 3.2; this.dpos[i * 3 + 1] += dt * 1.6; this.dpos[i * 3] += dt * this.dvx[i]; this.dalpha[i] = clamp(this.dlife[i] / this.dmax[i]) * 0.32; }
    this.dust.geometry.attributes.position.needsUpdate = true; this.dust.geometry.attributes.size.needsUpdate = true; this.dust.geometry.attributes.alpha.needsUpdate = true;

    // rain
    const vis = Math.round(this.RN * (0.3 + 0.7 * rs)); this.rainGeo.setDrawRange(0, vis * 2); const rp = this.rpos, w = 8 + rs * 8;
    for (let i = 0; i < vis; i++) { const o = i * 6, fall = this.rv[i] * dt; rp[o + 1] -= fall; rp[o + 4] -= fall; rp[o] -= w * dt; rp[o + 3] -= w * dt; if (rp[o + 1] < 0) { const x = rnd(-140, 140), y = 100 + rnd(0, 10), z = rnd(-170, 140); rp[o] = x; rp[o + 1] = y; rp[o + 2] = z; rp[o + 3] = x - 0.25; rp[o + 4] = y + 2.2; rp[o + 5] = z; } }
    this.rainGeo.attributes.position.needsUpdate = true; this.rain.material.opacity = 0.2 + rs * 0.22;

    // lightning, mast
    this.flash *= Math.pow(0.0004, dt); if (rs > 0.55 && Math.random() < dt * 0.1 * rs) this.flash = 1;
    const alarm = this.phase === 'warn' || this.phase === 'slide', col = alarm ? '#ff4a3a' : rs > 0.5 ? '#e8803a' : '#8fc4bb';
    const blink = alarm ? (Math.sin(this.t * 12) > 0 ? 1 : 0.2) : 0.5 + 0.5 * Math.sin(this.t * 2.2);
    this.lamp.material.color.set(col); this.lamp.material.color.multiplyScalar(0.35 + blink * 0.65); this.lampLight.color.set(col); this.lampLight.intensity = (alarm ? 60 : 12) * blink;
    if (alarm || (rs > 0.6 && Math.random() < dt * 0.3)) this.ringT = this.ringT > 0 ? this.ringT : 0.001;
    if (this.ringT > 0) { this.ringT += dt * 0.75; const k = this.ringT; this.ring.scale.setScalar(1 + k * 22); this.ring.material.opacity = clamp(1 - k) * 0.8; if (k > 1) this.ringT = alarm ? 0.001 : 0; if (!this.ringT) this.ring.material.opacity = 0; }

    this.applyRisk(rs, false); this.updateCamera(dt);
  }

  updateCamera(dt) {
    const t = this.t, tgtPush = this.phase === 'calm' || this.phase === 'recover' ? 0 : 14; this.push += (tgtPush - this.push) * Math.min(1, dt * 0.6);
    const portrait = this.aspect < 0.9 ? 1 : 0, sway = Math.sin(t * 0.055) * 16, lift = Math.sin(t * 0.08) * 2.2;
    this.shake *= Math.pow(0.05, dt);
    const sx = this.shake > 0.02 ? rnd(-1, 1) * this.shake : 0, sy = this.shake > 0.02 ? rnd(-1, 1) * this.shake : 0;
    this.camera.position.set(sway + sx, 26 + lift + sy + portrait * 6, 118 - this.push + portrait * 26);
    this.camera.lookAt(sway * 0.3, 22, -30);
  }

  dispose() { this.scene.traverse((o) => { o.geometry?.dispose?.(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose?.()); }); this.skyTex?.dispose(); }
}

export default function Background({ risk = 0.3, fps = 60 }) {
  const ref = useRef(null), riskRef = useRef(risk), fpsRef = useRef(fps);
  riskRef.current = risk; fpsRef.current = fps;
  const [noGL, setNoGL] = useState(false);

  useEffect(() => {
    const canvas = ref.current; let renderer;
    const small = window.innerWidth < 720;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, powerPreference: 'high-performance' }); } catch { setNoGL(true); return undefined; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.25 : 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.outputColorSpace = THREE.SRGBColorSpace;
    const world = new World(window.innerWidth / window.innerHeight, small);
    const size = () => { renderer.setSize(window.innerWidth, window.innerHeight, false); world.resize(window.innerWidth / window.innerHeight); };
    size();
    let timer; const onResize = () => { clearTimeout(timer); timer = setTimeout(size, 120); }; window.addEventListener('resize', onResize);
    const onLost = (e) => e.preventDefault(); canvas.addEventListener('webglcontextlost', onLost);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf, last = performance.now();
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden) { last = now; return; }
      if (now - last < 1000 / fpsRef.current - 1) return;
      const dt = (now - last) / 1000; last = now;
      world.update(dt, riskRef.current); renderer.render(world.scene, world.camera);
    };
    if (reduce) { world.update(0.016, riskRef.current); renderer.render(world.scene, world.camera); } else raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); window.removeEventListener('resize', onResize); canvas.removeEventListener('webglcontextlost', onLost); world.dispose(); renderer.dispose(); renderer.forceContextLoss?.(); };
  }, []);

  if (noGL) return <div aria-hidden="true" className="fixed inset-0 -z-10" style={{ background: 'linear-gradient(#0b1f24, #17383a 55%, #3a2a1c)' }} />;
  return <canvas ref={ref} aria-hidden="true" className="fixed inset-0 -z-10 h-full w-full" />;
}