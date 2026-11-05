// Round structure copied from the reference videos + piece/grain layout per food.
import { boxHits, inside, countCells } from './food.js';

export const FPS = 30;
// sets = [cuts ⟂x (vertical chops), cuts ⟂y (horizontal slide), cuts ⟂z (vertical chops front→back = collapse)]
export const DEF = [
  { sets: [4, 3, 3], t: [[0.15, 1.75], [2.0, 3.0], [3.3, 4.6]], end: 5.0, zoom: 1.0, mode: 'rigid' },
  { sets: [17, 16, 17], t: [[5.3, 8.4], [8.9, 11.9], [12.6, 17.0]], end: 18.0, zoom: 0.88, mode: 'rigid' },
  { sets: [33, 34, 33], t: [[18.3, 21.0], [21.5, 23.6], [24.0, 28.6]], end: 29.5, zoom: 0.78, mode: 'grain', vis: 34 },
  { sets: [84, 83, 83], t: [[29.8, 33.0], [33.4, 36.4], [36.9, 41.4]], end: 42.0, zoom: 0.70, mode: 'grain', vis: 42 },
  { sets: [167, 166, 167], t: [[42.3, 45.9], [46.3, 49.9], [50.4, 55.9]], end: 56.5, zoom: 0.62, mode: 'grain', vis: 50 },
  { sets: [334, 333, 333], t: [[56.8, 60.6], [61.1, 64.6], [65.1, 71.2]], end: 76.4, zoom: 0.55, mode: 'grain', vis: 60 },
];
export const TOTAL = 76.4;
export const HOOK_T0 = 68.6;   // 1 s from the last collapse, when the most cubes are falling
export const HOOK_LEN = 1.0;

export function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function seedOf(s) { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

export function setInfo(r, s) { const n = r.sets[s], [t0, t1] = r.t[s]; return { n, t0, t1, dt: (t1 - t0) / n }; }
export function cutsDone(r, t) { return [0, 1, 2].map(s => { const { n, t0, dt } = setInfo(r, s); return Math.max(0, Math.min(n, Math.floor((t - t0) / dt))); }); }
// time of the hit of cut i (1..n) of set s
export const hitTime = (r, s, i) => { const { t0, dt } = setInfo(r, s); return t0 + i * dt; };

export function buildRounds(food) {
  const [RX, RY, RZ] = food.R;
  return DEF.map((d, idx) => {
    const r = { ...d, idx };
    r.start = idx ? DEF[idx - 1].end : 0;
    const [a, b, c] = d.sets;                 // a ⟂x, b ⟂y, c ⟂z
    r.n = [a + 1, b + 1, c + 1];              // real grid (x, y, z)
    r.cell = [2 * RX / r.n[0], 2 * RY / r.n[1], 2 * RZ / r.n[2]];
    r.ncut = a + b + c;
    r.total = countCells(food, r.n[0], r.n[1], r.n[2]);
    r.approx = r.total > 100000;
    if (d.mode === 'rigid') { r.vn = r.n.slice(); }
    else { const v = d.vis; r.vn = [v, Math.max(4, Math.round(v * RY / RX)), Math.max(4, Math.round(v * RZ / RX))]; }
    r.vcell = [2 * RX / r.vn[0], 2 * RY / r.vn[1], 2 * RZ / r.vn[2]];
    return r;
  });
}

// pieces (rigid rounds) or grains (grain rounds) with their release time.
// Collapse rule: chop i of set 2 (front→back) frees the slab right in front of the blade.
export function buildPieces(food, r) {
  const [RX, RY, RZ] = food.R;
  const rnd = mulberry(seedOf(food.name) + r.idx * 977);
  const [nx, ny, nz] = r.vn, [cx, cy, cz] = r.vcell;
  const s3 = setInfo(r, 2);
  const out = [];
  const SS = r.mode === 'rigid' ? 5 : 0;
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
    const x = -RX + (i + .5) * cx, y = -RY + (j + .5) * cy, z = -RZ + (k + .5) * cz;
    const lo = [x - cx / 2, y - cy / 2, z - cz / 2], hi = [x + cx / 2, y + cy / 2, z + cz / 2];
    if (r.mode === 'grain') { if (!inside(food, x, y, z)) continue; }
    else if (!boxHits(food, lo, hi)) continue;
    const p = { i, j, k, cx: x, cy: y, cz: z };
    if (SS) { // material bounds inside the cell (rigid colliders)
      let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9], cnt = 0; const cv = [cx, cy, cz];
      for (let a = 0; a < SS; a++) for (let b = 0; b < SS; b++) for (let c = 0; c < SS; c++) {
        const l = [((a + .5) / SS - .5) * cx, ((b + .5) / SS - .5) * cy, ((c + .5) / SS - .5) * cz];
        if (inside(food, x + l[0], y + l[1], z + l[2])) { cnt++; for (let q = 0; q < 3; q++) { mn[q] = Math.min(mn[q], l[q] - cv[q] / SS / 2); mx[q] = Math.max(mx[q], l[q] + cv[q] / SS / 2); } }
      }
      if (!cnt) continue;
      p.mn = mn; p.mx = mx;
    }
    const slabFromFront = nz - 1 - k;
    const chop = Math.min(s3.n, Math.ceil((slabFromFront + 1) / nz * s3.n - 1e-9));
    p.release = s3.t0 + chop * s3.dt + 0.012 + rnd() * 0.02;
    p.hy = j / Math.max(1, ny - 1);
    out.push(p);
  }
  return out;
}

// initial velocity / spin given by the blade when a piece is freed (approved "light cubes" look)
export function releaseImpulse(p, rnd) {
  const hy = p.hy;
  return {
    v: [(rnd() - .5) * 0.9 + p.cx * 0.55, rnd() * 0.25, 0.25 + 0.95 * hy + rnd() * 0.35],
    w: [2 + 5 * hy * rnd(), (rnd() - .5) * 4, (rnd() - .5) * 6],
  };
}
export const PHYS = { G: 26, density: 0.4, friction: 0.42, restitution: 0.3, linDamp: 0.04, angDamp: 0.25 };
// cutting board (group space) and countertop below it
export const BOARD = { x0: -2.5, x1: 2.5, z0: -2.15, z1: 3.05, top: 0, counter: -0.2 };
