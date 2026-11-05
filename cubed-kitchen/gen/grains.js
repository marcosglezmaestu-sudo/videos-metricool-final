// Granular physics (DEM) for rounds with tens of thousands of cubes, run in lock-step with the renderer.
// Real-world model: real gravity, Coulomb friction at every contact, rolling (angular velocity from the
// friction impulses), almost inelastic impacts, no artificial speed cap. Sub-steps are chosen each frame
// so that no grain moves more than ~40 % of its radius per step (no tunnelling).
import { PHYS, BOARD, releaseImpulse, mulberry, seedOf } from './rounds.js';

export class GrainSim {
  constructor(food, r, grains, fps) {
    this.n = grains.length; const n = this.n;
    this.r = Math.min(...r.vcell) * 0.5;
    this.p = new Float32Array(n * 3); this.v = new Float32Array(n * 3);
    this.q = new Float32Array(n * 4); this.w = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) this.q[i * 4 + 3] = 1;
    this.state = new Uint8Array(n);          // 0 still part of the food, 1 moving, 2 resting
    this.calm = new Uint16Array(n);
    this.release = new Float32Array(n);
    this.g = grains; this.rnd = mulberry(seedOf(food.name) + 7 * r.idx);
    const RY = food.R[1];
    grains.forEach((q, i) => { this.p.set([q.cx, q.cy + RY, q.cz], i * 3); this.release[i] = q.release; });
    this.order = grains.map((_, i) => i).sort((a, b) => this.release[a] - this.release[b]);
    this.next = 0; this.t = r.t[2][0] - 0.01; this.dtFrame = 1 / fps;
    this.h = this.r * 2.05; this.HS = 1 << 19;
    this.head = new Int32Array(this.HS); this.link = new Int32Array(n);
    this.awake = 0;
  }
  ground(x, z) { return (x > BOARD.x0 && x < BOARD.x1 && z > BOARD.z0 && z < BOARD.z1) ? BOARD.top : BOARD.counter; }
  maxSpeed() { let m = 0; const v = this.v, s = this.state; for (let i = 0; i < this.n; i++) if (s[i] === 1) { const o = i * 3; const q = v[o] * v[o] + v[o + 1] * v[o + 1] + v[o + 2] * v[o + 2]; if (q > m) m = q; } return Math.sqrt(m); }
  stepTo(t) {
    while (this.t < t - 1e-7) {
      const span = Math.min(this.dtFrame, t - this.t);
      // fastest grain after one more step of free fall
      const vmax = this.maxSpeed() + PHYS.G * span * 0.25 + 1;
      const sub = Math.max(6, Math.min(80, Math.ceil(vmax * span / (0.4 * this.r))));
      const dt = span / sub;
      for (let k = 0; k < sub; k++) { this.substep(dt); this.t += dt; }
    }
  }
  substep(dt) {
    const { p, v, q, w, state, n, r } = this;
    while (this.next < n && this.release[this.order[this.next]] <= this.t) {
      const i = this.order[this.next++]; state[i] = 1;
      const im = releaseImpulse(this.g[i], this.rnd); v.set(im.v, i * 3); w.set(im.w, i * 3);
    }
    const G = PHYS.G, mu = 0.85, e = PHYS.restitution;
    // integrate
    for (let i = 0; i < n; i++) {
      if (state[i] !== 1) continue; const o = i * 3;
      v[o + 1] -= G * dt;
      p[o] += v[o] * dt; p[o + 1] += v[o + 1] * dt; p[o + 2] += v[o + 2] * dt;
      // orientation: q += 0.5 * (w,0) * q * dt
      const a = i * 4, wx = w[o], wy = w[o + 1], wz = w[o + 2];
      const qx = q[a], qy = q[a + 1], qz = q[a + 2], qw = q[a + 3], hd = 0.5 * dt;
      q[a] += hd * (wx * qw + wy * qz - wz * qy); q[a + 1] += hd * (wy * qw + wz * qx - wx * qz);
      q[a + 2] += hd * (wz * qw + wx * qy - wy * qx); q[a + 3] += hd * (-wx * qx - wy * qy - wz * qz);
      const l = Math.hypot(q[a], q[a + 1], q[a + 2], q[a + 3]); q[a] /= l; q[a + 1] /= l; q[a + 2] /= l; q[a + 3] /= l;
    }
    // contacts: grain-grain and grain-ground, impulse model with Coulomb friction and rolling
    const head = this.head, link = this.link; head.fill(-1); const h = this.h, HS = this.HS - 1;
    for (let i = 0; i < n; i++) { const o = i * 3; const k = ((Math.floor(p[o] / h) * 73856093) ^ (Math.floor(p[o + 1] / h) * 19349663) ^ (Math.floor(p[o + 2] / h) * 83492791)) & HS; link[i] = head[k]; head[k] = i; }
    const d2 = 4 * r * r, kRot = 2.5 / r;  // solid sphere: dw = (5/2) (r n x J) / (m r^2)
    const contact = (i, j, nx, ny, nz, pen, other) => {
      const o = i * 3, mob = other >= 0 && state[other] === 1, s = mob ? 0.5 : 1;
      p[o] += nx * pen * s; p[o + 1] += ny * pen * s; p[o + 2] += nz * pen * s;
      let jx = 0, jy = 0, jz = 0, ox = 0, oy = 0, oz = 0, owx = 0, owy = 0, owz = 0;
      if (mob) { const c = other * 3; p[c] -= nx * pen * 0.5; p[c + 1] -= ny * pen * 0.5; p[c + 2] -= nz * pen * 0.5; ox = v[c]; oy = v[c + 1]; oz = v[c + 2]; owx = w[c]; owy = w[c + 1]; owz = w[c + 2]; }
      // velocity of the contact points: v + w x (-r n) for i, v + w x (r n) for j
      const cix = v[o] + (w[o + 1] * -nz * r - w[o + 2] * -ny * r), ciy = v[o + 1] + (w[o + 2] * -nx * r - w[o] * -nz * r), ciz = v[o + 2] + (w[o] * -ny * r - w[o + 1] * -nx * r);
      const cjx = ox + (owy * nz * r - owz * ny * r), cjy = oy + (owz * nx * r - owx * nz * r), cjz = oz + (owx * ny * r - owy * nx * r);
      const rx = cix - cjx, ry = ciy - cjy, rz = ciz - cjz;
      const vn = rx * nx + ry * ny + rz * nz;
      if (vn >= 0) return;
      const mEff = mob ? 0.5 : 1;
      const Jn = -(1 + (vn < -0.8 ? e : 0)) * vn * mEff;
      jx = Jn * nx; jy = Jn * ny; jz = Jn * nz;
      // friction (Coulomb, capped by mu * Jn); tangential mass includes rotation (2/7 for spheres)
      const tx = rx - vn * nx, ty = ry - vn * ny, tz = rz - vn * nz, tl = Math.hypot(tx, ty, tz);
      if (tl > 1e-6) { const Jt = Math.min(mu * Jn, tl * mEff * 2 / 7); jx -= Jt * tx / tl; jy -= Jt * ty / tl; jz -= Jt * tz / tl; }
      v[o] += jx; v[o + 1] += jy; v[o + 2] += jz;
      // torque from the tangential part: (-r n) x J
      w[o] += kRot * (-ny * jz + nz * jy); w[o + 1] += kRot * (-nz * jx + nx * jz); w[o + 2] += kRot * (-nx * jy + ny * jx);
      if (mob) { const c = other * 3; v[c] -= jx; v[c + 1] -= jy; v[c + 2] -= jz;
        w[c] += kRot * (-ny * jz + nz * jy); w[c + 1] += kRot * (-nz * jx + nx * jz); w[c + 2] += kRot * (-nx * jy + ny * jx); }
      else if (other >= 0 && state[other] === 2 && -vn > 3) { state[other] = 1; this.calm[other] = 0; }
    };
    for (let it = 0; it < 3; it++)
    for (let i = 0; i < n; i++) {
      if (state[i] !== 1) continue; const o = i * 3;
      const gy = this.ground(p[o], p[o + 2]) + r;
      let touching = false;
      if (p[o + 1] < gy) { contact(i, -1, 0, 1, 0, gy - p[o + 1], -1); touching = true; }
      const ix = Math.floor(p[o] / h), iy = Math.floor(p[o + 1] / h), iz = Math.floor(p[o + 2] / h);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
        let j = head[(((ix + a) * 73856093) ^ ((iy + b) * 19349663) ^ ((iz + c) * 83492791)) & HS];
        while (j !== -1) {
          if (j !== i) {
            const k = j * 3, dx = p[o] - p[k], dy = p[o + 1] - p[k + 1], dz = p[o + 2] - p[k + 2], dd = dx * dx + dy * dy + dz * dz;
            if (dd < d2 && dd > 1e-12) { const dl = Math.sqrt(dd); contact(i, j, dx / dl, dy / dl, dz / dl, 2 * r - dl, j); if (dy / dl > 0.3) touching = true; }
          }
          j = link[j];
        }
      }
      // cubes do not roll like balls: flat faces stop the rotation almost at once (strong rolling
      // resistance) and the contact grips while slow (static friction) -> real angle of repose ~35-40 deg
      if (touching) {
        const k = Math.max(0, 1 - 90 * dt); w[o] *= k; w[o + 1] *= k; w[o + 2] *= k;
        const hv = Math.hypot(v[o], v[o + 2]);
        if (hv < 0.6 && Math.abs(v[o + 1]) < 0.6) { const kk = Math.max(0, 1 - 120 * dt); v[o] *= kk; v[o + 2] *= kk; }
      }
      if (it < 2) continue;
      const sp = Math.hypot(v[o], v[o + 1], v[o + 2]);
      if (touching && sp < 0.25 && Math.hypot(w[o], w[o + 1], w[o + 2]) < 1.5) { if (++this.calm[i] > 6) { state[i] = 2; v[o] = v[o + 1] = v[o + 2] = 0; w[o] = w[o + 1] = w[o + 2] = 0; } }
      else this.calm[i] = 0;
    }
  }
}
