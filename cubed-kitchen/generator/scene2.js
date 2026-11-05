import * as THREE from 'three';
import { RoomEnvironment } from '/node_modules/three/examples/jsm/environments/RoomEnvironment.js';

const W = 576, H = 1024, FPS = 30;
const RX = 1.0, RY = 0.93, RZ = 1.0;
const R = new THREE.Vector3(RX, RY, RZ);

function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------------- rounds (timing copied from reference) ----------------
// sets: [cuts ⟂x, cuts ⟂z, cuts ⟂y(horizontal)] ; times: [start,end] of each set
const DEF = [
  { sets: [4, 3, 3], t: [[0.15, 1.75], [2.0, 3.0], [3.3, 4.6]], end: 5.0, vis: null, zoom: 1.0 },
  { sets: [17, 16, 17], t: [[5.3, 8.4], [8.9, 11.9], [12.6, 17.0]], end: 18.0, vis: null, zoom: 0.88 },
  { sets: [33, 34, 33], t: [[18.3, 21.0], [21.5, 23.6], [24.0, 28.6]], end: 29.5, vis: 34, zoom: 0.78 },
  { sets: [84, 83, 83], t: [[29.8, 33.0], [33.4, 36.4], [36.9, 41.4]], end: 42.0, vis: 42, zoom: 0.70 },
  { sets: [167, 166, 167], t: [[42.3, 45.9], [46.3, 49.9], [50.4, 55.9]], end: 56.5, vis: 60, zoom: 0.62 },
  { sets: [334, 333, 333], t: [[56.8, 60.6], [61.1, 64.6], [65.1, 71.2]], end: 76.4, vis: 84, zoom: 0.55 },
];
const TOTAL = 76.4, NFRAMES = Math.round(TOTAL * FPS);

const rounds = DEF.map((d, idx) => {
  const r = { ...d, idx };
  r.start = idx ? DEF[idx - 1].end : 0;
  const [a, b, c] = d.sets;
  r.cx = 2 * RX / (a + 1); r.cz = 2 * RZ / (b + 1); r.cy = 2 * RY / (c + 1);
  r.ncut = a + b + c;
  // visual grid (exact for small rounds)
  if (d.vis) { r.vnx = d.vis; r.vnz = d.vis; r.vny = Math.round(d.vis * RY / RX); }
  else { r.vnx = a + 1; r.vnz = b + 1; r.vny = c + 1; }
  r.vcx = 2 * RX / r.vnx; r.vcy = 2 * RY / r.vny; r.vcz = 2 * RZ / r.vnz;
  r.raytrace = !d.vis;
  // exact cube count of the real grid
  r.total = countCells(a + 1, c + 1, b + 1);
  r.approx = r.total > 100000;
  return r;
});

function countCells(nx, ny, nz) {
  const cx = 2 * RX / nx, cy = 2 * RY / ny, cz = 2 * RZ / nz;
  let n = 0;
  for (let i = 0; i < nx; i++) {
    const x0 = -RX + i * cx, x1 = x0 + cx; const px = clamp(0, x0, x1) / RX;
    for (let j = 0; j < ny; j++) {
      const y0 = -RY + j * cy, y1 = y0 + cy; const py = clamp(0, y0, y1) / RY;
      const s = 1 - px * px - py * py; if (s <= 0) continue;
      const zm = RZ * Math.sqrt(s);
      const k0 = Math.floor((-zm + RZ) / cz), k1 = Math.min(nz - 1, Math.floor((zm + RZ) / cz - 1e-9));
      n += Math.max(0, k1 - Math.max(0, k0) + 1);
    }
  }
  return n;
}

// ---------------- cut schedule / knife ----------------
function setInfo(r, s) {
  const n = r.sets[s], [t0, t1] = r.t[s];
  return { n, t0, t1, dt: (t1 - t0) / n };
}
function cutsDoneAt(r, t) { // per set
  return [0, 1, 2].map(s => { const { n, t0, dt } = setInfo(r, s); return clamp(Math.floor((t - t0) / dt + 0.5), 0, n); });
}
function cutCoord(r, s, i) { // i in 1..n
  if (s === 0) return -RX + i * r.cx;
  if (s === 1) return -RZ + i * r.cz;
  return RY - i * r.cy; // horizontal cuts top→bottom (object-local y)
}

const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _ax = new THREE.Vector3();
// knife local frame: X = blade length (tip at -X), Y = up from edge, Z = blade normal
const Q_SET0 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2); // blade ⟂ x, tip toward +z? (local -X -> +z)
const Q_SET1 = new THREE.Quaternion(); // blade ⟂ z, along x
const Q_SET2 = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
  new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, -1, 0))); // horizontal, edge toward -x
const REST = { pos: new THREE.Vector3(-1.2, 3.2, 1.0), q: Q_SET0 };

function knifePose(r, t) {
  // which set are we in / between
  for (let s = 0; s < 3; s++) {
    const { n, t0, t1, dt } = setInfo(r, s);
    if (t < t0) {
      // travel from previous pose to this set's start
      const prevEnd = s === 0 ? null : knifeSetPose(r, s - 1, r.t[s - 1][1]);
      const tp = s === 0 ? r.start : r.t[s - 1][1];
      const a = prevEnd || REST;
      const b = knifeSetPose(r, s, t0);
      const u = clamp((t - tp) / Math.max(0.05, t0 - tp), 0, 1);
      const e = u * u * (3 - 2 * u);
      const lift = Math.sin(e * Math.PI) * 0.8;
      return { pos: a.pos.clone().lerp(b.pos, e).add(new THREE.Vector3(0, lift, 0)), q: a.q.clone().slerp(b.q, e) };
    }
    if (t <= t1) return knifeSetPose(r, s, t);
  }
  const a = knifeSetPose(r, 2, r.t[2][1]);
  const u = clamp((t - r.t[2][1]) / 0.6, 0, 1); const e = u * u * (3 - 2 * u);
  return { pos: a.pos.clone().lerp(new THREE.Vector3(-2.5, 3.0, 2.8), e), q: a.q.clone().slerp(Q_SET1, e) };
}
function knifeSetPose(r, s, t) {
  const { n, t0, dt } = setInfo(r, s);
  const k = (t - t0) / dt;            // continuous cut index (hit at k = i - 0.5 ... ) -> hit when frac=0.5
  const ph = ((k % 1) + 1) % 1;       // 0 top, 0.5 hit, 1 top
  const coordIdx = clamp(k + 0.5, 0.5, n + 0.5);
  const top = n > 60 ? 0.55 : n > 20 ? 0.9 : 1.35;
  const h = Math.abs(1 - 2 * ph);     // 1 at top, 0 at hit
  const lift = Math.pow(h, 1.6) * top;
  if (s === 0) {
    const x = -RX + coordIdx * r.cx;
    const pos = new THREE.Vector3(x, 0, -1.5);
    pos.y = Math.max(-0.005, h * (2 * RY + 0.15) + lift);
    const tilt = -0.42 * h;
    const q = Q_SET0.clone().multiply(_q1.setFromAxisAngle(_ax.set(0, 0, 1), tilt));
    return { pos, q };
  }
  if (s === 1) {
    const z = -RZ + coordIdx * r.cz;
    const pos = new THREE.Vector3(1.5, Math.max(-0.005, h * (2 * RY + 0.15) + lift), z);
    const q = Q_SET1.clone().multiply(_q1.setFromAxisAngle(_ax.set(0, 0, 1), 0.42 * h));
    return { pos, q };
  }
  const y = RY + RY - coordIdx * r.cy; // world-ish (object center at RY)
  const x = -RX - 0.2 + h * (2 * RX + 1.3);
  return { pos: new THREE.Vector3(x, y, -1.5), q: Q_SET2 };
}

// ---------------- orange colour (JS mirror of shader, for grain boxes) ----------------
function hash3(x, y, z) { let h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); }
function orangeJS(x, y, z, rnd) {
  const d = Math.sqrt((x / RX) ** 2 + (y / RY) ** 2 + (z / RZ) ** 2);
  const v = 0.9 + 0.2 * rnd;
  if (d > 0.93) return [1.0 * v, 0.47 * v, 0.04 * v];
  if (d > 0.89 && rnd < 0.3) return [0.98, 0.90, 0.74];
  const rr = Math.hypot(x, y);
  if (rr < 0.07) return [0.99, 0.93, 0.82];
  const ang = Math.atan2(y, x); const s = ((ang / (2 * Math.PI) * 11) % 1 + 1) % 1;
  const memb = Math.min(s, 1 - s) * rr * 2 * Math.PI / 11;
  if (memb < 0.006) return [1.0, 0.80, 0.50];
  const f = 0.72 + 0.35 * rnd;
  return [Math.min(1, 0.98 * f + 0.04), 0.46 * f, 0.03 * f];
}

// ---------------- pieces ----------------
function buildPieces(r) {
  const rnd = mulberry(99 + r.idx);
  const list = [];
  const { vnx, vny, vnz, vcx, vcy, vcz } = r;
  for (let i = 0; i < vnx; i++) for (let j = 0; j < vny; j++) for (let k = 0; k < vnz; k++) {
    const cx = -RX + (i + .5) * vcx, cy = -RY + (j + .5) * vcy, cz = -RZ + (k + .5) * vcz;
    const px = clamp(0, (cx - vcx / 2) / RX, (cx + vcx / 2) / RX), py = clamp(0, (cy - vcy / 2) / RY, (cy + vcy / 2) / RY), pz = clamp(0, (cz - vcz / 2) / RZ, (cz + vcz / 2) / RZ);
    if (px * px + py * py + pz * pz >= 0.999) continue;
    if (!r.raytrace) { // drop slivers for grain look
      const X = cx / RX, Y = cy / RY, Z = cz / RZ; if (X * X + Y * Y + Z * Z > 1.02) continue;
    }
    list.push({ cx, cy, cz, k });
  }
  // release: slab k (front = high k) released when slabs released >= vnz - k
  const s3 = setInfo(r, 2);
  for (const p of list) {
    const order = vnz - 1 - p.k;                     // 0 = front slab
    const frac = (order + 1) / vnz;                  // set3 progress fraction needed
    const cutIdx = Math.ceil(frac * s3.n - 1e-9);    // set3 cut that frees it
    p.release = s3.t0 + (cutIdx - 0.5) * s3.dt + 0.02 + ((p.cy + RY) / (2 * RY)) * 0.06 + rnd() * 0.05;
  }
  list.sort((a, b) => a.release - b.release || a.cy - b.cy);
  // pile: heightmap stacking with downhill settling, pieces move forward/sideways only
  const bs = Math.max(vcx, vcz);
  const hmap = new Map(); const H = (a, b) => hmap.get(a * 4096 + b) || 0;
  const limx = Math.floor(2.0 / bs), zmax = Math.floor(2.3 / bs);
  for (const p of list) {
    const hy = (p.cy + RY) / (2 * RY);
    const big = r.raytrace;
    let tx = p.cx * (big ? 1.02 : 1.08 + 0.1 * hy) + (rnd() - .5) * bs * (big ? 0.3 : 2);
    let tz = p.cz + (big ? 0.05 + 0.25 * hy * rnd() : 0.15 + (0.25 + 0.45 * hy) * (0.6 + 0.8 * rnd()));
    let bx = clamp(Math.round(tx / bs), -limx, limx), bz = clamp(Math.round(tz / bs), -zmax, zmax);
    const zmin = Math.round((p.cz - vcz) / bs);
    for (let it = 0; it < 14; it++) {
      const h0 = H(bx, bz); let best = null, bh = h0 - bs * 0.9; const off = Math.floor(rnd() * 8);
      for (let q = 0; q < 8; q++) {
        const [dx, dz] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]][(q + off) % 8];
        const nx = bx + dx, nz = bz + dz;
        if (Math.abs(nx) > limx || nz > zmax || nz < zmin) continue;
        const hh = H(nx, nz); if (hh < bh) { bh = hh; best = [nx, nz]; }
      }
      if (!best) break; [bx, bz] = best;
    }
    const h = H(bx, bz);
    const ph = r.raytrace ? vcy : vcy;
    hmap.set(bx * 4096 + bz, h + ph * 0.92);
    p.tx = bx * bs + (rnd() - .5) * bs * 0.3; p.tz = bz * bs + (rnd() - .5) * bs * 0.3; p.ty = h + vcy / 2;
    p.rx = (rnd() - .5) * 0.6; p.ry = (rnd() - .5) * 1.2; p.rz = (rnd() - .5) * 0.6;
    const drop = Math.max(0.05, (p.cy + RY) - p.ty);
    p.dur = 0.09 + 0.15 * Math.sqrt(drop) + rnd() * 0.04;
    if (r.raytrace) {
      const col = [0, 0, 0];
      p.col = col;
    } else p.col = orangeJS(p.cx, p.cy, p.cz, rnd());
  }
  r.pieces = list;
  r.releaseTimes = list.map(p => p.release);
  r.landTimes = list.map(p => p.release + p.dur).sort((a, b) => a - b);
}
rounds.forEach(buildPieces);

// ---------------- renderer / scene ----------------
const glCanvas = document.createElement('canvas'); glCanvas.width = W; glCanvas.height = H;
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1917);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45;
const camera = new THREE.PerspectiveCamera(50, W / H, 0.05, 60);

const key = new THREE.DirectionalLight(0xfff0dc, 2.6);
key.position.set(-3.0, 7.5, 3.5); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -3.5, right: 3.5, top: 3.5, bottom: -3.5, near: 1, far: 20 });
key.shadow.bias = -0.0005; key.shadow.normalBias = 0.01; scene.add(key);
scene.add(new THREE.HemisphereLight(0xfff3e6, 0x3a3128, 0.55));

// ---- minimalist kitchen (dark matte cabinets, oak, warm LED) ----
const kitchen = new THREE.Group(); scene.add(kitchen);
function canvasTex(w, h, draw, rep) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); } return t; }
const stoneTex = canvasTex(1024, 1024, (g, w, h) => {
  g.fillStyle = '#3d3b38'; g.fillRect(0, 0, w, h); const r = mulberry(5);
  for (let i = 0; i < 9000; i++) { const v = 50 + r() * 30; g.fillStyle = `rgba(${v},${v - 3},${v - 8},0.35)`; g.fillRect(r() * w, r() * h, 2, 2); }
  g.strokeStyle = 'rgba(110,105,100,0.25)'; g.lineWidth = 2;
  for (let i = 0; i < 6; i++) { g.beginPath(); let x = r() * w, y = 0; g.moveTo(x, y); while (y < h) { x += (r() - .5) * 60; y += 40; g.lineTo(x, y); } g.stroke(); }
}, [3, 3]);
const counterTop = new THREE.Mesh(new THREE.BoxGeometry(24, 0.12, 9), new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.45 }));
counterTop.position.set(0, -0.26, -0.8); counterTop.receiveShadow = true; kitchen.add(counterTop);
const cabMat = new THREE.MeshStandardMaterial({ color: 0x2b2a28, roughness: 0.8 });
const front = new THREE.Mesh(new THREE.BoxGeometry(24, 3, 0.2), cabMat); front.position.set(0, -1.8, 3.7); kitchen.add(front);
// back wall + backsplash
const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a3936, roughness: 0.95 });
const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 14), wallMat); wall.position.set(0, 4, -5.2); wall.receiveShadow = true; kitchen.add(wall);
const splashTex = canvasTex(1024, 256, (g, w, h) => { g.fillStyle = '#4a4844'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(30,30,28,0.6)'; g.lineWidth = 3; for (let x = 0; x <= w; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke(); }, [6, 1]);
const splash = new THREE.Mesh(new THREE.PlaneGeometry(30, 2.2), new THREE.MeshStandardMaterial({ map: splashTex, roughness: 0.5 })); splash.position.set(0, 1.1, -5.15); kitchen.add(splash);
// upper cabinets with handle-less seams
for (let i = -6; i <= 6; i++) {
  const c = new THREE.Mesh(new THREE.BoxGeometry(1.96, 2.6, 0.6), cabMat); c.position.set(i * 2, 3.6, -4.85); c.castShadow = true; kitchen.add(c);
}
const led = new THREE.Mesh(new THREE.BoxGeometry(26, 0.04, 0.05), new THREE.MeshBasicMaterial({ color: 0xffd9a0 })); led.position.set(0, 2.27, -4.52); kitchen.add(led);
const ledLight = new THREE.RectAreaLight ? null : null;
const warm = new THREE.PointLight(0xffc98a, 6, 9, 1.6); warm.position.set(0.5, 2.1, -4.2); kitchen.add(warm);
const warm2 = new THREE.PointLight(0xffc98a, 4, 8, 1.6); warm2.position.set(-4.5, 2.1, -4.2); kitchen.add(warm2);
// oak open shelf with ceramics
const oak = new THREE.MeshStandardMaterial({ color: 0xb98a5a, roughness: 0.6 });
const shelf = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 0.5), oak); shelf.position.set(4.6, 3.0, -4.8); kitchen.add(shelf);
const cer = new THREE.MeshStandardMaterial({ color: 0xe9e4dc, roughness: 0.5 });
for (const [x, h, r] of [[3.6, .5, .22], [4.2, .32, .28], [5.3, .6, .16]]) { const v = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.85, h, 24), cer); v.position.set(x, 3.05 + h / 2, -4.8); kitchen.add(v); }
// back counter props: plant pot, oil bottle, jars
const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.28, 0.6, 28), cer); pot.position.set(-3.2, 0.3, -4.3); pot.castShadow = true; kitchen.add(pot);
const leafMat = new THREE.MeshStandardMaterial({ color: 0x4f6b3a, roughness: 0.8 });
const lr = mulberry(11); for (let i = 0; i < 26; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), leafMat); l.scale.set(1, 0.35, 2.2); l.position.set(-3.2 + (lr() - .5) * 0.8, 0.75 + lr() * 0.7, -4.3 + (lr() - .5) * 0.6); l.rotation.set(lr() * 3, lr() * 3, lr() * 3); kitchen.add(l); }
const jarMat = new THREE.MeshStandardMaterial({ color: 0x8a8278, roughness: 0.3, metalness: 0.0 });
for (const [x, h] of [[2.4, .7], [2.95, .5]]) { const j = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, h, 24), jarMat); j.position.set(x, h / 2, -4.5); kitchen.add(j); }
const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.9, 20), new THREE.MeshStandardMaterial({ color: 0x55602a, roughness: 0.15, transparent: true, opacity: 0.85 }));
bottle.position.set(-2.3, 0.45, -4.6); kitchen.add(bottle);

// ---- board + object group ----
const group = new THREE.Group(); group.rotation.y = -0.38; scene.add(group);
const woodTex = canvasTex(2048, 1024, (g, w, h) => {
  const r = mulberry(7); g.fillStyle = '#d7aa72'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 300; i++) { const y = r() * h, a = 0.04 + r() * 0.09; g.strokeStyle = r() < .5 ? `rgba(150,100,55,${a})` : `rgba(255,235,200,${a})`; g.lineWidth = 1 + r() * 4; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 64) g.lineTo(x, y + Math.sin(x * .003 + i) * 5); g.stroke(); }
});
const board = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.2, 5.2), new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.55 }));
board.position.set(0, -0.1, 0.45); board.receiveShadow = true; board.castShadow = true; group.add(board);

// ---- knife (chef's knife) ----
function makeKnife(opacity) {
  const k = new THREE.Group();
  const sh = new THREE.Shape();
  sh.moveTo(0, 0); sh.lineTo(-2.2, 0); sh.quadraticCurveTo(-2.75, 0.02, -2.95, 0.2); sh.quadraticCurveTo(-2.4, 0.42, -1.6, 0.5); sh.lineTo(0, 0.52); sh.lineTo(0, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.022, bevelEnabled: false }); g.translate(0, 0, -0.011);
  const tr = opacity < 1;
  const steel = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 0.92, roughness: 0.2, transparent: tr, opacity, depthWrite: !tr });
  const blade = new THREE.Mesh(g, steel); k.add(blade);
  const hm = new THREE.MeshStandardMaterial({ color: 0x3b2417, roughness: 0.5, transparent: tr, opacity, depthWrite: !tr });
  const hg = new THREE.BoxGeometry(1.15, 0.2, 0.09); const handle = new THREE.Mesh(hg, hm); handle.position.set(0.6, 0.38, 0); k.add(handle);
  const bol = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, 0.07), steel); bol.position.set(0.02, 0.38, 0); k.add(bol);
  return k;
}
const NG = 16; const ghosts = [];
for (let i = 0; i < NG; i++) { const g = makeKnife(0.17); g.traverse(o => { if (o.isMesh) o.castShadow = i === 0; }); group.add(g); ghosts.push(g); }

// ---- ray-traced orange piece shader ----
const vert = `
in vec3 iCenter;
out vec3 vLocal; out vec3 vCamLocal; out vec3 vWorld; out vec3 vCenter; out vec3 vR0; out vec3 vR1; out vec3 vR2;
void main(){
  mat4 M = modelMatrix * instanceMatrix;
  vec4 w = M * vec4(position,1.0);
  vWorld = w.xyz; mat3 Rm = mat3(M);
  vCamLocal = transpose(Rm) * (cameraPosition - M[3].xyz);
  vLocal = position; vCenter = iCenter; vR0 = Rm[0]; vR1 = Rm[1]; vR2 = Rm[2];
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const frag = `
uniform mat4 projectionMatrix;
out vec4 fragOut;
uniform vec3 uHalf; uniform vec3 uR; uniform vec3 uL; uniform int uWhole;
uniform vec3 uDone; uniform vec3 uCell; uniform float uLineW;
in vec3 vLocal; in vec3 vCamLocal; in vec3 vWorld; in vec3 vCenter; in vec3 vR0; in vec3 vR1; in vec3 vR2;
float hash(vec3 p){ p = fract(p*0.3183099+vec3(.1,.2,.3)); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vnoise(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
vec3 orange(vec3 q, out float gloss){
  float d = length(q/uR);
  gloss = 0.3;
  if(d > 0.955){
    float dim = vnoise(q*38.0);
    gloss = 0.55;
    return vec3(1.0,0.47,0.04) * (0.80 + 0.28*dim);
  }
  if(d > 0.90) return mix(vec3(0.99,0.93,0.80), vec3(1.0,0.75,0.45), smoothstep(0.93,0.955,d));
  float rr = length(q.xy);
  if(rr < 0.07) return vec3(0.99,0.93,0.82);
  float ang = atan(q.y,q.x);
  float s = fract(ang/6.2831853*11.0);
  float memb = min(s,1.0-s)*rr*6.2831853/11.0;
  float mm = 1.0 - smoothstep(0.006, 0.016, memb);
  float ves = vnoise(vec3(rr*55.0, ang*14.0, q.z*7.0));
  vec3 flesh = mix(vec3(0.98,0.42,0.02), vec3(1.0,0.66,0.16), ves);
  flesh = mix(flesh, vec3(1.0,0.84,0.58), mm);
  gloss = 0.6;
  return flesh;
}
void main(){
  vec3 ro = vCamLocal; vec3 rd = normalize(vLocal - vCamLocal);
  vec3 inv = 1.0/rd;
  vec3 t0 = (-uHalf - ro)*inv, t1 = (uHalf - ro)*inv;
  vec3 tmn = min(t0,t1), tmx = max(t0,t1);
  float tb0 = max(max(tmn.x,tmn.y),tmn.z);
  float tb1 = min(min(tmx.x,tmx.y),tmx.z);
  vec3 oc = (ro + vCenter)/uR; vec3 dd = rd/uR;
  float a = dot(dd,dd), b = dot(oc,dd), c = dot(oc,oc)-1.0;
  float h = b*b - a*c; if(h < 0.0) discard; h = sqrt(h);
  float te0 = (-b - h)/a, te1 = (-b + h)/a;
  float tin = max(tb0, te0), tout = min(tb1, te1);
  if(tin > tout || tout < 0.0) discard;
  vec3 p = ro + rd*tin; vec3 q = p + vCenter;
  vec3 nl; bool face = false;
  if(te0 >= tb0){ nl = normalize(q/(uR*uR)); }
  else { face = true;
    if(tb0 == tmn.x) nl = vec3(-sign(rd.x),0.,0.); else if(tb0 == tmn.y) nl = vec3(0.,-sign(rd.y),0.); else nl = vec3(0.,0.,-sign(rd.z)); }
  float gloss; vec3 alb = orange(q, gloss);
  if(uWhole == 1){
    float line = 0.0;
    for(int ax=0; ax<3; ax++){
      if(uDone[ax] < 0.5) continue;
      float cell = uCell[ax];
      float s = (ax==1) ? (uR.y - q.y) : (q[ax] + uR[ax]);
      float id = floor(s/cell + 0.5);
      bool ok = id >= 1.0 && id <= uDone[ax];
      if(!ok) continue;
      float dist = abs(s - id*cell);
      float aa = fwidth(s);
      float w = min(uLineW, cell*0.22);
      float l = (aa > cell*0.6) ? 0.22 : (1.0 - smoothstep(w, w+aa*1.2, dist)) * mix(1.0, 0.35, smoothstep(cell*0.15, cell*0.6, aa));
      line = max(line, l);
    }
    alb = mix(alb, alb*0.22, clamp(line,0.0,1.0)*0.85);
  } else if(face){
    vec3 e = uHalf - abs(p); float m = 1e3;
    for(int ax=0; ax<3; ax++){ if(abs(nl[ax]) < 0.5) m = min(m, e[ax]); }
    alb *= mix(0.8, 1.0, smoothstep(0.0, uHalf.x*0.15, m));
  }
  vec3 n = normalize(vR0*nl.x + vR1*nl.y + vR2*nl.z);
  vec3 wd = normalize(vWorld - cameraPosition);
  vec3 wp = cameraPosition + wd*tin;
  vec3 L = normalize(uL);
  float dif = max(dot(n,L),0.0);
  vec3 Hh = normalize(L - wd);
  float spec = pow(max(dot(n,Hh),0.0), 70.0) * gloss * 0.6;
  float hemiT = 0.5 + 0.5*n.y;
  vec3 lin = pow(alb, vec3(2.2));
  vec3 col = lin * (mix(vec3(0.10,0.085,0.07), vec3(0.40,0.37,0.33), hemiT) + dif*vec3(1.45,1.36,1.22)) + spec*vec3(1.0,0.96,0.9);
  col = pow(col, vec3(1.0/2.2));
  fragOut = vec4(col, 1.0);
  vec4 clip = projectionMatrix * viewMatrix * vec4(wp,1.0);
  gl_FragDepth = clamp(clip.z/clip.w*0.5+0.5, 0.0, 1.0);
}`;
function makeRayMat() {
  return new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: vert, fragmentShader: frag, uniforms: {
    uHalf: { value: new THREE.Vector3() }, uR: { value: R.clone() }, uL: { value: key.position.clone().normalize() }, uWhole: { value: 1 },
    uDone: { value: new THREE.Vector3() }, uCell: { value: new THREE.Vector3(1, 1, 1) }, uLineW: { value: 0.0045 } } });
}
const wholeMat = makeRayMat();
const wholeGeo = new THREE.BoxGeometry(2 * RX + .02, 2 * RY + .02, 2 * RZ + .02);
wholeGeo.setAttribute('iCenter', new THREE.InstancedBufferAttribute(new Float32Array(3), 3));
const wholeMesh = new THREE.InstancedMesh(wholeGeo, wholeMat, 1); wholeMesh.frustumCulled = false; group.add(wholeMesh);
// smooth shadow caster clipped by front plane
const clipPlaneW = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
const shadowCaster = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
shadowCaster.scale.copy(R); shadowCaster.position.y = RY; shadowCaster.castShadow = true; group.add(shadowCaster);
const casterDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, clippingPlanes: [clipPlaneW] });
shadowCaster.customDepthMaterial = casterDepth;
renderer.localClippingEnabled = true;

const pieceMesh = [];
const blobTex = canvasTex(256, 256, (g, w, h) => { const gr = g.createRadialGradient(128, 128, 10, 128, 128, 128); gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
blob.rotation.x = -Math.PI / 2; blob.position.y = 0.003; blob.visible = false; group.add(blob);
rounds.forEach(r => { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; r.pieces.forEach(p => { x0 = Math.min(x0, p.tx); x1 = Math.max(x1, p.tx); z0 = Math.min(z0, p.tz); z1 = Math.max(z1, p.tz); }); r.blob = [(x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) * 1.15, (z1 - z0) * 1.15]; });
function getPieceMesh(r) {
  if (pieceMesh[r.idx]) return pieceMesh[r.idx];
  let m;
  if (r.raytrace) {
    const g = new THREE.BoxGeometry(r.vcx, r.vcy, r.vcz);
    const cen = new Float32Array(r.pieces.length * 3); r.pieces.forEach((p, i) => cen.set([p.cx, p.cy, p.cz], i * 3));
    g.setAttribute('iCenter', new THREE.InstancedBufferAttribute(cen, 3));
    const mat = makeRayMat(); mat.uniforms.uWhole.value = 0; mat.uniforms.uHalf.value.set(r.vcx / 2, r.vcy / 2, r.vcz / 2);
    m = new THREE.InstancedMesh(g, mat, r.pieces.length);
  } else if (r.idx >= 4) {
    const g = new THREE.BufferGeometry();
    r.pos = new Float32Array(r.pieces.length * 3);
    const col = new Float32Array(r.pieces.length * 3); const c = new THREE.Color(); const rr = mulberry(31);
    r.pieces.forEach((p, i) => { const sh = 0.72 + 0.4 * rr(); c.setRGB(p.col[0] * sh, p.col[1] * sh, p.col[2] * sh, THREE.SRGBColorSpace); col.set([c.r, c.g, c.b], i * 3); });
    g.setAttribute('position', new THREE.BufferAttribute(r.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    m = new THREE.Points(g, new THREE.PointsMaterial({ size: r.vcx * 1.25, vertexColors: true, sizeAttenuation: true }));
    m.isPts = true;
  } else {
    const s = Math.min(r.vcx, r.vcy, r.vcz) * 0.98;
    const bg = new THREE.BoxGeometry(s, s, s); const idx = bg.index.array; const keep = [];
    for (const gi of [0, 2, 4]) for (let k = 0; k < 6; k++) keep.push(idx[gi * 6 + k]);
    bg.setIndex(keep); bg.clearGroups();
    m = new THREE.InstancedMesh(bg, new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0, envMapIntensity: 0.35 }), r.pieces.length);
    const c = new THREE.Color();
    r.pieces.forEach((p, i) => { c.setRGB(p.col[0], p.col[1], p.col[2], THREE.SRGBColorSpace); m.setColorAt(i, c); });
    m.instanceColor.needsUpdate = true;
  }
  m.castShadow = r.raytrace; m.receiveShadow = false; m.frustumCulled = false; m.visible = false; group.add(m);
  pieceMesh[r.idx] = m; return m;
}

// ---------------- HUD ----------------
const out = document.createElement('canvas'); out.width = W; out.height = H; document.body.appendChild(out);
const ctx = out.getContext('2d');
const fmt = n => n.toLocaleString('en-US');

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
const CAM_DIR = new THREE.Vector3(-1.15, 3.1, 5.0).normalize();
function bsearch(arr, t) { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] <= t) lo = m + 1; else hi = m; } return lo; }

function renderAt(f) {
  const t = Math.min(f / FPS, TOTAL - 1e-6);
  let r = rounds.find(rr => t < rr.end) || rounds[rounds.length - 1];
  pieceMesh.forEach(m => m && (m.visible = false));
  const done = cutsDoneAt(r, t);
  const cuts = done[0] + done[1] + done[2];
  // whole object clip (front slabs released)
  const s3 = setInfo(r, 2);
  const prog = clamp(Math.floor((t - s3.t0) / s3.dt + 0.5), 0, s3.n) / s3.n; // set3 fraction done
  const slabs = Math.floor(prog * r.vnz + 1e-9);
  const clipZ = RZ - slabs * r.vcz;
  const wholeVis = clipZ > -RZ + 1e-4;
  wholeMesh.visible = wholeVis; shadowCaster.visible = wholeVis;
  if (wholeVis) {
    const hz = (clipZ + RZ) / 2, cz = (clipZ - RZ) / 2;
    wholeMat.uniforms.uHalf.value.set(RX + .005, RY + .005, hz + (slabs ? 0 : .005));
    wholeGeo.attributes.iCenter.array.set([0, 0, cz]); wholeGeo.attributes.iCenter.needsUpdate = true;
    _m.compose(_p.set(0, RY, cz), _q.identity(), _s); wholeMesh.setMatrixAt(0, _m); wholeMesh.instanceMatrix.needsUpdate = true;
    wholeMat.uniforms.uDone.value.set(done[0], done[2], done[1]);
    wholeMat.uniforms.uCell.value.set(r.cx, r.cy, r.cz);
    wholeMat.uniforms.uL.value.copy(key.position).normalize();
    // shadow caster clip (world-space plane from group-local z <= clipZ)
    const n = new THREE.Vector3(0, 0, -1).applyQuaternion(group.quaternion);
    const pt = new THREE.Vector3(0, 0, clipZ).applyMatrix4(group.matrixWorld);
    clipPlaneW.setFromNormalAndCoplanarPoint(n, pt);
  }
  // pieces
  let released = 0; blob.visible = false;
  if (t >= s3.t0) {
    const m = getPieceMesh(r); m.visible = true;
    const ps = r.pieces;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      const u = (t - p.release) / p.dur;
      let x, y, z, rx = 0, ry = 0, rz = 0;
      if (u <= 0) { x = p.cx; y = p.cy + RY; z = p.cz; if (t < p.release) { if (m.isPts) { r.pos[i * 3 + 1] = -50; } else { _m.makeScale(0, 0, 0); m.setMatrixAt(i, _m); } continue; } }
      else if (u >= 1) { x = p.tx; y = p.ty; z = p.tz; rx = p.rx; ry = p.ry; rz = p.rz; }
      else {
        const e = easeOut(u); x = p.cx + (p.tx - p.cx) * e; z = p.cz + (p.tz - p.cz) * e;
        y = (p.cy + RY) + (p.ty - (p.cy + RY)) * u * u; rx = p.rx * u; ry = p.ry * u; rz = p.rz * u;
      }
      if (m.isPts) { r.pos[i * 3] = x; r.pos[i * 3 + 1] = y; r.pos[i * 3 + 2] = z; continue; }
      _q.setFromEuler(_e.set(rx, ry, rz)); _p.set(x, y, z); _m.compose(_p, _q, _s); m.setMatrixAt(i, _m);
    }
    if (m.isPts) m.geometry.attributes.position.needsUpdate = true; else m.instanceMatrix.needsUpdate = true;
    released = bsearch(r.releaseTimes, t);
    if (!r.raytrace) { const fr = bsearch(r.landTimes, t) / r.pieces.length; blob.visible = fr > 0; blob.material.opacity = Math.min(1, fr * 1.5);
      blob.position.set(r.blob[0], 0.003, r.blob[1]); blob.scale.set(r.blob[2] * Math.sqrt(fr), r.blob[3] * Math.sqrt(fr), 1); }
  }
  // knife (motion blur via sub-frame ghosts across one frame interval)
  const sh = 1 / FPS;
  ghosts.forEach((g, i) => {
    const tt = t - sh * (i / (NG - 1));
    const rr = tt >= r.start ? r : (rounds[r.idx - 1] || r);
    const kp = knifePose(rr, Math.max(tt, 0));
    g.position.copy(kp.pos); g.quaternion.copy(kp.q);
  });
  // camera
  const tgt = new THREE.Vector3(0.05, 0.62, 0.15);
  const dist = 9.5 * r.zoom;
  camera.position.copy(tgt).addScaledVector(CAM_DIR, dist);
  camera.lookAt(tgt.x, tgt.y - 0.25, tgt.z);
  renderer.render(scene, camera);

  // HUD
  ctx.drawImage(glCanvas, 0, 0);
  let g = ctx.createLinearGradient(0, 0, 0, 300); g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, 300);
  g = ctx.createLinearGradient(0, H - 260, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.5)'); ctx.fillStyle = g; ctx.fillRect(0, H - 260, W, 260);
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 10;
  ctx.fillStyle = '#f4efe6'; ctx.font = '800 108px "Inter Display"'; ctx.fillText(fmt(cuts), W / 2, 178);
  ctx.fillStyle = '#dca548'; ctx.font = '800 36px "Inter Display"'; ctx.fillText('CUTS', W / 2, 224);
  let cubes = r.raytrace || !r.approx ? Math.round(r.total * released / r.pieces.length) : Math.round(r.total * released / r.pieces.length / 1000) * 1000;
  if (released === r.pieces.length) cubes = r.approx ? Math.round(r.total / 1000) * 1000 : r.total;
  const ctext = (r.approx && cubes > 0 ? '≈ ' : '') + fmt(cubes);
  ctx.fillStyle = '#f4efe6'; ctx.font = '800 47px "Inter Display"'; ctx.fillText(ctext, W / 2, 922);
  ctx.fillStyle = '#dca548'; ctx.font = '800 26px "Inter Display"'; ctx.fillText('CUBES', W / 2, 958);
  ctx.shadowBlur = 0;
}

function events() {
  const ev = [];
  rounds.forEach(r => {
    for (let s = 0; s < 3; s++) { const { n, t0, dt } = setInfo(r, s); for (let i = 1; i <= n; i++) ev.push({ type: 'cut', t: t0 + (i - 0.5) * dt, set: s, r: r.idx, dt }); }
    const step = Math.max(1, Math.floor(r.landTimes.length / 3000));
    ev.push({ type: 'lands', r: r.idx, times: r.landTimes.filter((_, i) => i % step === 0), total: r.pieces.length, chunky: r.raytrace });
    ev.push({ type: 'roundstart', t: r.start, r: r.idx });
  });
  return ev;
}

window.SCENE = { nframes: NFRAMES, fps: FPS, total: TOTAL, info: rounds.map(r => ({ cuts: r.ncut, total: r.total, vis: r.pieces.length })), events, frame(f) { renderAt(f); return out.toDataURL('image/jpeg', 0.93); } };
document.fonts.load('800 40px "Inter Display"').then(() => { window.READY = true; });
