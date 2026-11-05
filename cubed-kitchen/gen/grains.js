// Particle (DEM / position-based) physics for rounds with tens of thousands of cubes.
// Runs in lock-step with the renderer. Same "light cubes" feel as the rigid rounds:
// bouncy, low friction, spinning, spreading over the board.
import { PHYS, BOARD, releaseImpulse, mulberry, seedOf } from './rounds.js';

export class GrainSim {
  constructor(food, r, grains, fps) {
    this.n = grains.length; const n = this.n;
    this.r = Math.min(...r.vcell) * 0.5;
    this.p = new Float32Array(n * 3); this.v = new Float32Array(n * 3);
    this.e = new Float32Array(n * 3); this.w = new Float32Array(n * 3);
    this.state = new Uint8Array(n);          // 0 fixed (still part of the food), 1 awake, 2 asleep
    this.calm = new Uint16Array(n);
    this.release = new Float32Array(n);
    this.g = grains; this.rnd = mulberry(seedOf(food.name) + 7 * r.idx);
    const RY = food.R[1];
    grains.forEach((q, i) => { this.p.set([q.cx, q.cy + RY, q.cz], i * 3); this.release[i] = q.release; });
    this.order = grains.map((_, i) => i).sort((a, b) => this.release[a] - this.release[b]);
    this.next = 0; this.t = r.t[2][0] - 0.01;
    this.sub = 6; this.dtFrame = 1 / fps;
    // spatial hash
    this.h = this.r * 2.05; this.HS = 1 << 19;
    this.head = new Int32Array(this.HS); this.link = new Int32Array(n);
    this.impacts = 0; this.impactE = 0;
    this.maxV = 3.2;                           // light cubes: air drag caps the speed
  }
  key(x, y, z) { const h = this.h; return ((Math.floor(x / h) * 73856093) ^ (Math.floor(y / h) * 19349663) ^ (Math.floor(z / h) * 83492791)) & (this.HS - 1); }
  ground(x, z) { return (x > BOARD.x0 && x < BOARD.x1 && z > BOARD.z0 && z < BOARD.z1) ? BOARD.top : BOARD.counter; }
  stepTo(t) {
    this.impacts = 0; this.impactE = 0;
    while (this.t < t - 1e-6) { const dt = Math.min(this.dtFrame / this.sub, t - this.t); this.substep(dt); this.t += dt; }
  }
  substep(dt) {
    const { p, v, e, w, state, n, r } = this;
    // releases
    while (this.next < n && this.release[this.order[this.next]] <= this.t) {
      const i = this.order[this.next++]; state[i] = 1;
      const im = releaseImpulse(this.g[i], this.rnd);
      v.set(im.v.map(x => x * 0.6), i * 3); w.set(im.w, i * 3);
    }
    // integrate awake grains
    const G = PHYS.G, ld = 1 - PHYS.linDamp * dt, ad = 1 - PHYS.angDamp * dt, mv = this.maxV;
    for (let i = 0; i < n; i++) {
      if (state[i] !== 1) continue; const o = i * 3;
      v[o + 1] -= G * dt;
      let sp = Math.hypot(v[o], v[o + 1], v[o + 2]); if (sp > mv) { const k = mv / sp; v[o] *= k; v[o + 1] *= k; v[o + 2] *= k; }
      v[o] *= ld; v[o + 1] *= ld; v[o + 2] *= ld;
      p[o] += v[o] * dt; p[o + 1] += v[o + 1] * dt; p[o + 2] += v[o + 2] * dt;
      e[o] += w[o] * dt; e[o + 1] += w[o + 1] * dt; e[o + 2] += w[o + 2] * dt;
      w[o] *= ad; w[o + 1] *= ad; w[o + 2] *= ad;
      // ground
      const gy = this.ground(p[o], p[o + 2]) + r;
      if (p[o + 1] < gy) {
        p[o + 1] = gy;
        if (v[o + 1] < 0) { const vn = -v[o + 1]; if (vn > 0.35) { this.impacts++; this.impactE += vn; } v[o + 1] = vn > 0.25 ? vn * PHYS.restitution : 0; }
        const fr = 1 - Math.min(1, 9 * PHYS.friction * dt * 2.2); v[o] *= fr; v[o + 2] *= fr;
        w[o] *= 0.82; w[o + 1] *= 0.82; w[o + 2] *= 0.82;
      }
    }
    // hash every solid grain
    const head = this.head, link = this.link; head.fill(-1);
    for (let i = 0; i < n; i++) { const o = i * 3; const k = this.key(p[o], p[o + 1], p[o + 2]); link[i] = head[k]; head[k] = i; }
    // resolve contacts for awake grains
    const d2 = 4 * r * r, h = this.h, e_ = PHYS.restitution;
    for (let i = 0; i < n; i++) {
      if (state[i] !== 1) continue; const o = i * 3;
      const x = p[o], y = p[o + 1], z = p[o + 2];
      const ix = Math.floor(x / h), iy = Math.floor(y / h), iz = Math.floor(z / h);
      let touching = y <= this.ground(x, z) + r + 1e-4;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
        let j = head[(((ix + a) * 73856093) ^ ((iy + b) * 19349663) ^ ((iz + c) * 83492791)) & (this.HS - 1)];
        while (j !== -1) {
          if (j !== i) {
            const q = j * 3; const dx = p[o] - p[q], dy = p[o + 1] - p[q + 1], dz = p[o + 2] - p[q + 2];
            const dd = dx * dx + dy * dy + dz * dz;
            if (dd < d2 && dd > 1e-12) {
              const dl = Math.sqrt(dd), nx = dx / dl, ny = dy / dl, nz = dz / dl, pen = 2 * r - dl;
              const mobile = state[j] === 1;
              const share = mobile ? 0.5 : 1;
              p[o] += nx * pen * share; p[o + 1] += ny * pen * share; p[o + 2] += nz * pen * share;
              if (mobile) { p[q] -= nx * pen * 0.5; p[q + 1] -= ny * pen * 0.5; p[q + 2] -= nz * pen * 0.5; }
              const rvx = v[o] - (mobile ? v[q] : 0), rvy = v[o + 1] - (mobile ? v[q + 1] : 0), rvz = v[o + 2] - (mobile ? v[q + 2] : 0);
              const vn = rvx * nx + rvy * ny + rvz * nz;
              if (vn < 0) {
                if (-vn > 0.45) { this.impacts++; this.impactE += -vn; if (state[j] === 2 && -vn > 0.9) { state[j] = 1; this.calm[j] = 0; } }
                const jn = -(1 + e_) * vn * share;
                v[o] += jn * nx; v[o + 1] += jn * ny; v[o + 2] += jn * nz;
                if (mobile) { v[q] -= jn * nx; v[q + 1] -= jn * ny; v[q + 2] -= jn * nz; }
                // tangential friction
                const tx = rvx - vn * nx, ty = rvy - vn * ny, tz = rvz - vn * nz; const f = PHYS.friction * 0.25 * share;
                v[o] -= tx * f; v[o + 1] -= ty * f; v[o + 2] -= tz * f;
                if (mobile) { v[q] += tx * f; v[q + 1] += ty * f; v[q + 2] += tz * f; }
              }
              if (ny > 0.5) touching = true;
            }
          }
          j = link[j];
        }
      }
      // sleep when resting
      const sp = Math.hypot(v[o], v[o + 1], v[o + 2]);
      if (touching && sp < 0.12) { if (++this.calm[i] > 12) { state[i] = 2; v[o] = v[o + 1] = v[o + 2] = 0; w[o] = w[o + 1] = w[o + 2] = 0; } }
      else this.calm[i] = 0;
      if (touching) { w[o] *= 0.9; w[o + 1] *= 0.9; w[o + 2] *= 0.9; }
    }
  }
  released() { return this.next; }
}
