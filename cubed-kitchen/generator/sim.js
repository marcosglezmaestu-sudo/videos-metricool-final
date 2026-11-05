// Rigid-body simulation of the orange cubes collapsing (Rapier).
// Output: sim.json (pieces + events) and sim.bin (per-frame transforms).
const RAPIER = require('@dimforge/rapier3d-compat');
const fs = require('fs');

const RX = 1.0, RY = 0.93, RZ = 1.0;
const NX = 18, NY = 18, NZ = 17;           // 17 + 17 + 16 cuts = 50
const CX = 2 * RX / NX, CY = 2 * RY / NY, CZ = 2 * RZ / NZ;
const FPS = 30, DUR = 5.0, SUB = 10;        // 240 Hz physics
const G = 26;                              // scene units / s^2 (looks like the reference)
const KN = 17, KT0 = 0.25, KDT = 0.205;   // 17 vertical chops, front -> back; chop i frees slab NZ-i

function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rnd = mulberry(2026);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

(async () => {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -G, z: 0 });
  world.timestep = 1 / (FPS * SUB);
  world.integrationParameters.numSolverIterations = 6;

  // board (top at y = 0) + low invisible rim far away so cubes stay on the board
  world.createCollider(RAPIER.ColliderDesc.cuboid(12, 0.06, 6).setTranslation(0, -0.26, -0.8).setFriction(0.5).setRestitution(0.25));
  world.createCollider(RAPIER.ColliderDesc.cuboid(2.5, 0.1, 2.6).setTranslation(0, -0.1, 0.45).setFriction(0.45).setRestitution(0.3));

  // pieces
  const pieces = [];
  const SS = 5;
  for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) for (let k = 0; k < NZ; k++) {
    const cx = -RX + (i + .5) * CX, cy = -RY + (j + .5) * CY, cz = -RZ + (k + .5) * CZ;
    // material bounds inside the cell
    let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9], cnt = 0;
    for (let a = 0; a < SS; a++) for (let b = 0; b < SS; b++) for (let c = 0; c < SS; c++) {
      const lx = ((a + .5) / SS - .5) * CX, ly = ((b + .5) / SS - .5) * CY, lz = ((c + .5) / SS - .5) * CZ;
      const X = (cx + lx) / RX, Y = (cy + ly) / RY, Z = (cz + lz) / RZ;
      if (X * X + Y * Y + Z * Z < 1) { cnt++; const v = [lx, ly, lz]; for (let q = 0; q < 3; q++) { mn[q] = Math.min(mn[q], v[q] - [CX, CY, CZ][q] / SS / 2); mx[q] = Math.max(mx[q], v[q] + [CX, CY, CZ][q] / SS / 2); } }
    }
    if (cnt === 0) continue;
    pieces.push({ i, j, k, cx, cy, cz, mn, mx, fill: cnt / SS ** 3 });
  }
  // each chop frees the slab right in front of the blade
  for (const p of pieces) {
    const i = NZ - p.k;                              // chop index that frees this slab (1 = front)
    p.release = KT0 + Math.min(i, KN) * KDT + 0.012 + rnd() * 0.02;
  }
  const bodies = pieces.map(p => {
    const bd = RAPIER.RigidBodyDesc.fixed().setTranslation(p.cx, p.cy + RY, p.cz)
      .setLinearDamping(0.04).setAngularDamping(0.25).setCcdEnabled(false).setCanSleep(true);
    const b = world.createRigidBody(bd);
    const hx = (p.mx[0] - p.mn[0]) / 2 * 0.97, hy = (p.mx[1] - p.mn[1]) / 2 * 0.97, hz = (p.mx[2] - p.mn[2]) / 2 * 0.97;
    const ox = (p.mx[0] + p.mn[0]) / 2, oy = (p.mx[1] + p.mn[1]) / 2, oz = (p.mx[2] + p.mn[2]) / 2;
    const cd = RAPIER.ColliderDesc.cuboid(Math.max(hx, 0.004), Math.max(hy, 0.004), Math.max(hz, 0.004))
      .setTranslation(ox, oy, oz).setDensity(0.4).setFriction(0.42).setRestitution(0.3)
      .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(0.02);
    world.createCollider(cd, b);
    return b;
  });

  const order = pieces.map((p, i) => i).sort((a, b) => pieces[a].release - pieces[b].release);
  let next = 0;
  const NF = Math.round(DUR * FPS);
  const n = pieces.length;
  const buf = new Float32Array(NF * n * 7);
  const events = [];
  const eq = new RAPIER.EventQueue(true);
  const t0 = Date.now();
  for (let f = 0; f < NF; f++) {
    for (let s = 0; s < SUB; s++) {
      const t = (f + s / SUB) / FPS;
      while (next < order.length && pieces[order[next]].release <= t) {
        const idx = order[next++]; const b = bodies[idx]; const p = pieces[idx];
        b.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
        // gentle nudge forward/outward + a little spin so cubes tumble like a real collapse
        const hy = p.j / (NY - 1);
        // the blade wedge pushes the freed slab forward: the top leans out more, so it topples and crumbles
        b.setLinvel({ x: (rnd() - .5) * 0.9 + p.cx * 0.55, y: rnd() * 0.25, z: 0.25 + 0.95 * hy + rnd() * 0.35 }, true);
        b.setAngvel({ x: 2 + 5 * hy * rnd(), y: (rnd() - .5) * 4, z: (rnd() - .5) * 6 }, true);
      }
      world.step(eq);
      eq.drainContactForceEvents(ev => {
        const m = ev.maxForceMagnitude();
        if (m > 0.05) events.push({ t: +t.toFixed(4), m: +m.toFixed(3), c: ev.collider1() });
      });
    }
    for (let i = 0; i < n; i++) {
      const tr = bodies[i].translation(), q = bodies[i].rotation();
      buf.set([tr.x, tr.y, tr.z, q.x, q.y, q.z, q.w], (f * n + i) * 7);
    }
    if (f % 15 === 0) console.log('frame', f, '/', NF, ((Date.now() - t0) / 1000).toFixed(1) + 's', 'released', next);
  }
  // keep loudest impacts (cap) for audio
  events.sort((a, b) => b.m - a.m);
  const ev = events.slice(0, 12000).sort((a, b) => a.t - b.t);
  fs.writeFileSync('sim.bin', Buffer.from(buf.buffer));
  fs.writeFileSync('sim.json', JSON.stringify({
    fps: FPS, dur: DUR, n, R: [RX, RY, RZ], cell: [CX, CY, CZ], grid: [NX, NY, NZ], KN, KT0, KDT,
    pieces: pieces.map(p => ({ cx: p.cx, cy: p.cy, cz: p.cz, r: +p.release.toFixed(4) })), impacts: ev,
  }));
  console.log('done', n, 'pieces', events.length, 'impacts', ((Date.now() - t0) / 1000).toFixed(1) + 's');
})();
