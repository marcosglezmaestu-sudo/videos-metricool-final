// Rigid-body physics (Rapier) for the rounds with few big pieces.
// usage: node simulate.js <food.json> <outdir>
import RAPIER from '@dimforge/rapier3d-compat';
import fs from 'fs';
import { buildRounds, buildPieces, setInfo, releaseImpulse, PHYS, BOARD, FPS, mulberry, seedOf } from './rounds.js';

const food = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const outDir = process.argv[3]; fs.mkdirSync(outDir, { recursive: true });
const SUB = 16;   // 480 Hz: needed with real gravity
await RAPIER.init();
const rounds = buildRounds(food);
const meta = [];
for (const r of rounds) {
  if (r.mode !== 'rigid') continue;
  const t0 = Date.now();
  const pieces = buildPieces(food, r);
  const world = new RAPIER.World({ x: 0, y: -PHYS.G, z: 0 });
  world.timestep = 1 / (FPS * SUB);
  world.integrationParameters.numSolverIterations = 6;
  const bw = (BOARD.x1 - BOARD.x0) / 2, bd = (BOARD.z1 - BOARD.z0) / 2;
  world.createCollider(RAPIER.ColliderDesc.cuboid(bw, 0.1, bd).setTranslation((BOARD.x0 + BOARD.x1) / 2, BOARD.top - 0.1, (BOARD.z0 + BOARD.z1) / 2).setFriction(0.55).setRestitution(PHYS.restitution));
  world.createCollider(RAPIER.ColliderDesc.cuboid(14, 0.06, 8).setTranslation(0, BOARD.counter - 0.06, -0.5).setFriction(0.55).setRestitution(PHYS.restitution));
  const RY = food.R[1];
  const bodies = pieces.map(p => {
    const b = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(p.cx, p.cy + RY, p.cz).setLinearDamping(PHYS.linDamp).setAngularDamping(PHYS.angDamp));
    const h = [0, 1, 2].map(q => Math.max(0.004, (p.mx[q] - p.mn[q]) / 2 * 0.97)), o = [0, 1, 2].map(q => (p.mx[q] + p.mn[q]) / 2);
    world.createCollider(RAPIER.ColliderDesc.cuboid(h[0], h[1], h[2]).setTranslation(o[0], o[1], o[2]).setDensity(PHYS.density)
      .setFriction(PHYS.friction).setRestitution(PHYS.restitution).setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(0.01), b);
    return b;
  });
  const rnd = mulberry(seedOf(food.name) + 31 * r.idx);
  const order = pieces.map((_, i) => i).sort((a, b) => pieces[a].release - pieces[b].release);
  const f0 = Math.floor(setInfo(r, 2).t0 * FPS), f1 = Math.ceil(r.end * FPS);
  const n = pieces.length, NF = f1 - f0;
  const buf = new Float32Array(NF * n * 7);
  const impacts = []; const eq = new RAPIER.EventQueue(true);
  const lastHit = new Map();
  let next = 0;
  for (let f = f0; f < f1; f++) {
    for (let s = 0; s < SUB; s++) {
      const t = (f + s / SUB) / FPS;
      while (next < n && pieces[order[next]].release <= t) {
        const idx = order[next++]; const b = bodies[idx];
        b.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
        const im = releaseImpulse(pieces[idx], rnd);
        im.v[0] += (rnd() - .5) * 0.5; im.v[2] += (rnd() - .5) * 0.5; im.w[0] += (rnd() - .5) * 4; im.w[2] += (rnd() - .5) * 4;
        b.setLinvel({ x: im.v[0], y: im.v[1], z: im.v[2] }, true); b.setAngvel({ x: im.w[0], y: im.w[1], z: im.w[2] }, true);
      }
      world.step(eq);
      eq.drainContactForceEvents(ev => {
        const m = ev.maxForceMagnitude(), c = ev.collider1();
        if (m < 0.03) return; const lh = lastHit.get(c); if (lh !== undefined && t - lh < 0.06) return;
        lastHit.set(c, t); impacts.push([+t.toFixed(4), +m.toFixed(3)]);
      });
    }
    for (let i = 0; i < n; i++) { const tr = bodies[i].translation(), q = bodies[i].rotation(); buf.set([tr.x, tr.y, tr.z, q.x, q.y, q.z, q.w], ((f - f0) * n + i) * 7); }
  }
  fs.writeFileSync(`${outDir}/r${r.idx}.bin`, Buffer.from(buf.buffer));
  impacts.sort((a, b) => b[1] - a[1]);
  meta.push({ round: r.idx, n, f0, f1, impacts: impacts.slice(0, 8000).sort((a, b) => a[0] - b[0]) });
  console.log(`round ${r.idx + 1}: ${n} pieces, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
fs.writeFileSync(`${outDir}/sim.json`, JSON.stringify(meta));
