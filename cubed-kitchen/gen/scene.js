import * as THREE from 'three';
import { RoomEnvironment } from '/node_modules/three/examples/jsm/environments/RoomEnvironment.js';
import { FOOD_GLSL, foodUniforms, project } from './food.js';
import { DEF, FPS, TOTAL, HOOK_T0, HOOK_LEN, buildRounds, buildPieces, setInfo, cutsDone, mulberry } from './rounds.js';
import { GrainSim } from './grains.js';

const W = 576, H = 1024;
const JOB = new URLSearchParams(location.search).get('job') || 'job';
const food = await (await fetch(`/${JOB}/food.json`)).json();
const simMeta = await (await fetch(`/${JOB}/sim.json`)).json();
const rigidData = {};
for (const m of simMeta) rigidData[m.round] = { ...m, buf: new Float32Array(await (await fetch(`/${JOB}/r${m.round}.bin`)).arrayBuffer()) };
const [RX, RY, RZ] = food.R;
const rounds = buildRounds(food);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const NFRAMES = Math.round(TOTAL * FPS);

// ---------------- renderer / scene ----------------
const glCanvas = document.createElement('canvas'); glCanvas.width = W; glCanvas.height = H;
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.85;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x1a1917);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.45;
const camera = new THREE.PerspectiveCamera(50, W / H, 0.05, 60);
const key = new THREE.DirectionalLight(0xfff0dc, 2.6);
key.position.set(-3.0, 7.5, 3.5); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -3.8, right: 3.8, top: 3.8, bottom: -3.8, near: 1, far: 20 });
key.shadow.bias = -0.0005; key.shadow.normalBias = 0.01; scene.add(key);
scene.add(new THREE.HemisphereLight(0xfff3e6, 0x3a3128, 0.55));
function mulb(a) { return mulberry(a); }
function canvasTex(w, h, draw, rep) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); } return t; }

// minimalist dark kitchen
const stoneTex = canvasTex(1024, 1024, (g, w, h) => { g.fillStyle = '#3d3b38'; g.fillRect(0, 0, w, h); const r = mulb(5); for (let i = 0; i < 9000; i++) { const v = 50 + r() * 30; g.fillStyle = `rgba(${v},${v - 3},${v - 8},0.35)`; g.fillRect(r() * w, r() * h, 2, 2); } }, [3, 3]);
const counterTop = new THREE.Mesh(new THREE.BoxGeometry(24, 0.12, 9), new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.45 }));
counterTop.position.set(0, -0.26, -0.8); counterTop.receiveShadow = true; scene.add(counterTop);
const cabMat = new THREE.MeshStandardMaterial({ color: 0x2b2a28, roughness: 0.8 });
const front = new THREE.Mesh(new THREE.BoxGeometry(24, 3, 0.2), cabMat); front.position.set(0, -1.8, 3.7); scene.add(front);
const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 14), new THREE.MeshStandardMaterial({ color: 0x3a3936, roughness: 0.95 })); wall.position.set(0, 4, -5.2); scene.add(wall);
const splashTex = canvasTex(1024, 256, (g, w, h) => { g.fillStyle = '#4a4844'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(30,30,28,0.6)'; g.lineWidth = 3; for (let x = 0; x <= w; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke(); }, [6, 1]);
const splash = new THREE.Mesh(new THREE.PlaneGeometry(30, 2.2), new THREE.MeshStandardMaterial({ map: splashTex, roughness: 0.5 })); splash.position.set(0, 1.1, -5.15); scene.add(splash);
for (let i = -6; i <= 6; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(1.96, 2.6, 0.6), cabMat); c.position.set(i * 2, 3.6, -4.85); scene.add(c); }
const led = new THREE.Mesh(new THREE.BoxGeometry(26, 0.04, 0.05), new THREE.MeshBasicMaterial({ color: 0xffd9a0 })); led.position.set(0, 2.27, -4.52); scene.add(led);
const warm = new THREE.PointLight(0xffc98a, 6, 9, 1.6); warm.position.set(0.5, 2.1, -4.2); scene.add(warm);
const warm2 = new THREE.PointLight(0xffc98a, 4, 8, 1.6); warm2.position.set(-4.5, 2.1, -4.2); scene.add(warm2);
const oak = new THREE.MeshStandardMaterial({ color: 0xb98a5a, roughness: 0.6 });
const shelf = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 0.5), oak); shelf.position.set(4.6, 3.0, -4.8); scene.add(shelf);
const cer = new THREE.MeshStandardMaterial({ color: 0xe9e4dc, roughness: 0.5 });
for (const [x, h, r] of [[3.6, .5, .22], [4.2, .32, .28], [5.3, .6, .16]]) { const v = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.85, h, 24), cer); v.position.set(x, 3.05 + h / 2, -4.8); scene.add(v); }
const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.28, 0.6, 28), cer); pot.position.set(-3.2, 0.1, -4.3); scene.add(pot);
const leafMat = new THREE.MeshStandardMaterial({ color: 0x4f6b3a, roughness: 0.8 }); const lr = mulb(11);
for (let i = 0; i < 26; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), leafMat); l.scale.set(1, 0.35, 2.2); l.position.set(-3.2 + (lr() - .5) * 0.8, 0.55 + lr() * 0.7, -4.3 + (lr() - .5) * 0.6); l.rotation.set(lr() * 3, lr() * 3, lr() * 3); scene.add(l); }
const jarMat = new THREE.MeshStandardMaterial({ color: 0x8a8278, roughness: 0.3 });
for (const [x, h] of [[2.4, .7], [2.95, .5]]) { const j = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, h, 24), jarMat); j.position.set(x, h / 2 - 0.2, -4.5); scene.add(j); }

const group = new THREE.Group(); group.rotation.y = -0.38; scene.add(group); group.updateMatrixWorld();
const woodTex = canvasTex(2048, 1024, (g, w, h) => { const r = mulb(7); g.fillStyle = '#d7aa72'; g.fillRect(0, 0, w, h); for (let i = 0; i < 300; i++) { const y = r() * h, a = 0.04 + r() * 0.09; g.strokeStyle = r() < .5 ? `rgba(150,100,55,${a})` : `rgba(255,235,200,${a})`; g.lineWidth = 1 + r() * 4; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 64) g.lineTo(x, y + Math.sin(x * .003 + i) * 5); g.stroke(); } });
const board = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.2, 5.2), new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.55 }));
board.position.set(0, -0.1, 0.45); board.receiveShadow = true; group.add(board);

// knife with motion-blur ghosts
function makeKnife(opacity) {
  const k = new THREE.Group(); const sh = new THREE.Shape();
  sh.moveTo(0, 0); sh.lineTo(-2.2, 0); sh.quadraticCurveTo(-2.75, 0.02, -2.95, 0.2); sh.quadraticCurveTo(-2.4, 0.42, -1.6, 0.5); sh.lineTo(0, 0.52); sh.lineTo(0, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.022, bevelEnabled: false }); g.translate(0, 0, -0.011);
  const steel = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 0.92, roughness: 0.2, transparent: true, opacity, depthWrite: false });
  k.add(new THREE.Mesh(g, steel));
  const hm = new THREE.MeshStandardMaterial({ color: 0x3b2417, roughness: 0.5, transparent: true, opacity, depthWrite: false });
  const handle = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.2, 0.09), hm); handle.position.set(0.6, 0.38, 0); k.add(handle);
  return k;
}
const NG = 16, ghosts = [];
for (let i = 0; i < NG; i++) { const g = makeKnife(0.17); g.traverse(o => { if (o.isMesh) o.castShadow = i === 0; }); group.add(g); ghosts.push(g); }

// ---------------- food uniforms (shared) ----------------
const FU = foodUniforms(food, THREE);

// whole food (ray-traced, clipped at the current front plane, with cut lines)
const wholeVert = `
out vec3 vLocal; out vec3 vCamLocal; out vec3 vWorld;
void main(){ vec4 w = modelMatrix*vec4(position,1.0); vWorld = w.xyz; mat3 Rm = mat3(modelMatrix);
  vCamLocal = transpose(Rm)*(cameraPosition - modelMatrix[3].xyz); vLocal = position; gl_Position = projectionMatrix*viewMatrix*w; }`;
const wholeFrag = `
uniform mat4 projectionMatrix; out vec4 fragOut;
uniform float uClipZ; uniform vec3 uDone; uniform vec3 uCell; uniform vec3 uL; uniform vec3 uRot0; uniform vec3 uRot1; uniform vec3 uRot2;
in vec3 vLocal; in vec3 vCamLocal; in vec3 vWorld;
${FOOD_GLSL}
void main(){
  vec3 ro = vCamLocal, rd = normalize(vLocal - vCamLocal);
  float t0, t1; vec3 n;
  if(!foodRay(ro, rd, t0, t1, n)) discard;
  // clip: keep z <= uClipZ
  float tz = (uClipZ - ro.z)/rd.z;
  if(rd.z < 0.0){ if(tz > t0){ t0 = tz; n = vec3(0,0,1); } }
  else { t1 = min(t1, tz); }
  if(t0 > t1 || t1 < 0.0) discard;
  vec3 q = ro + rd*t0;
  float rough; vec3 alb = foodColor(q, rough);
  float line = 0.0;
  for(int ax=0; ax<3; ax++){
    if(uDone[ax] < 0.5) continue;
    float cell = uCell[ax];
    float s = ax==0 ? q.x + fR.x : (ax==1 ? fR.y - q.y : fR.z - q.z);
    float id = floor(s/cell + 0.5);
    if(id < 1.0 || id > uDone[ax]) continue;
    if(ax == 2 && abs(q.z - uClipZ) < 2e-3) continue;   // the clip face itself is not a line
    float dist = abs(s - id*cell), aa = fwidth(s), w = min(0.003, cell*0.15);
    float l = (aa > cell*0.6) ? 0.2 : (1.0 - smoothstep(w, w + aa*1.2, dist)) * mix(1.0, 0.35, smoothstep(cell*0.15, cell*0.6, aa));
    line = max(line, l);
  }
  alb = mix(alb, alb*0.4, clamp(line,0.0,1.0)*0.75);
  bool cutFace = abs(q.z - uClipZ) < 1e-3 || fDepth(q) < 0.995;
  if(!cutFace) n = foodBumpN(q, n);
  vec3 wn = normalize(uRot0*n.x + uRot1*n.y + uRot2*n.z);
  vec3 wd = normalize(vWorld - cameraPosition); vec3 wp = cameraPosition + wd*t0;
  vec3 L = normalize(uL); float dif = max(dot(wn,L),0.0); vec3 Hh = normalize(L - wd);
  float spec = pow(max(dot(wn,Hh),0.0), 70.0) * (1.0-rough) * 0.5;
  vec3 lin = pow(alb, vec3(2.2));
  float wrap = max(dot(wn,L)*0.5 + 0.5, 0.0);
  float ao = mix(0.55, 1.0, smoothstep(0.0, 0.45*fR.y, q.y + fR.y));
  vec3 col = lin*(mix(vec3(0.10,0.085,0.07), vec3(0.40,0.37,0.33), 0.5+0.5*wn.y)*ao + dif*vec3(1.45,1.36,1.22) + wrap*wrap*vec3(0.10,0.12,0.06)) + spec;
  fragOut = vec4(pow(col, vec3(1.0/2.2)), 1.0);
  vec4 clip = projectionMatrix*viewMatrix*vec4(wp,1.0); gl_FragDepth = clamp(clip.z/clip.w*0.5+0.5, 0.0, 1.0);
}`;
const wholeMat = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: wholeVert, fragmentShader: wholeFrag,
  uniforms: { ...FU, uClipZ: { value: RZ }, uDone: { value: new THREE.Vector3() }, uCell: { value: new THREE.Vector3(1, 1, 1) }, uL: { value: key.position.clone().normalize() },
    uRot0: { value: new THREE.Vector3() }, uRot1: { value: new THREE.Vector3() }, uRot2: { value: new THREE.Vector3() } } });
const whole = new THREE.Mesh(new THREE.BoxGeometry(2 * RX + .02, 2 * RY + .02, 2 * RZ + .02), wholeMat);
whole.position.set(0, RY, 0); group.add(whole);
{ const m = new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationY(group.rotation.y)); const e = m.elements;
  wholeMat.uniforms.uRot0.value.set(e[0], e[1], e[2]); wholeMat.uniforms.uRot1.value.set(e[3], e[4], e[5]); wholeMat.uniforms.uRot2.value.set(e[6], e[7], e[8]); }
// shadow of the whole food: proxy clipped at the front plane
const clipPlaneW = new THREE.Plane();
const proxyGeo = food.shape === 'box' ? new THREE.BoxGeometry(2 * RX, 2 * RY, 2 * RZ) : food.shape === 'cylinder' ? new THREE.CylinderGeometry(1, 1, 2 * RY, 48) : new THREE.SphereGeometry(1, 48, 32);
const caster = new THREE.Mesh(proxyGeo, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
if (food.shape === 'ellipsoid') caster.scale.set(RX, RY, RZ); else if (food.shape === 'cylinder') caster.scale.set(RX, 1, RZ);
caster.position.y = RY; caster.castShadow = true; caster.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, clippingPlanes: [clipPlaneW] });
group.add(caster); renderer.localClippingEnabled = true;

// material for pieces / grains: standard PBR + food colour from the original position
function grainMaterial() {
  // grains: one colour per cube, computed once per vertex; Lambert lighting (cubes are tiny)
  const m = new THREE.MeshLambertMaterial();
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, FU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\nattribute vec3 aObj;\nvarying vec3 vGCol;\n${FOOD_GLSL}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nfloat gr; vec3 fc = foodColor(aObj, gr); fc = mix(fc, vec3(dot(fc, vec3(0.333))), 0.0) * 1.05; vGCol = pow(fc, vec3(2.2));`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vGCol;`)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( vGCol, opacity );')
      // fill light: real kitchens bounce light everywhere, a cube side in shadow is never black
      .replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = emissive + vGCol * 0.28;');
  };
  return m;
}
function foodMaterial(attrName) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0 });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, FU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\nattribute vec3 ${attrName};\nvarying vec3 vObj;\nvarying vec3 vONrm;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvObj = ${attrName === 'aObj' ? 'aObj' : attrName + ' + position'};\nvONrm = normal;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vObj; varying vec3 vONrm;\n${FOOD_GLSL}`)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `float pr; vec3 oc = foodColor(vObj, pr);
        vec4 diffuseColor = vec4( pow(oc, vec3(2.2)), opacity );`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = pr;');
  };
  return m;
}

// ---------------- rigid pieces (rounds 1-2) ----------------
function pieceGeo(p, c) {
  const h = [c[0] / 2, c[1] / 2, c[2] / 2], C = [p.cx, p.cy, p.cz];
  let curved = false;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) { const q = [C[0] + sx * h[0], C[1] + sy * h[1], C[2] + sz * h[2]]; if (project(food, q)[1]) curved = true; }
  const Nn = curved ? 6 : 1, pos = [], nrm = [], obj = [], idx = [];
  for (let a = 0; a < 3; a++) for (const sg of [1, -1]) {
    const b = (a + 1) % 3, cc = (a + 2) % 3, u = sg > 0 ? b : cc, v = sg > 0 ? cc : b; const base = pos.length / 3;
    for (let iu = 0; iu <= Nn; iu++) for (let iv = 0; iv <= Nn; iv++) {
      const l = [0, 0, 0]; l[a] = sg * h[a]; l[u] = (-1 + 2 * iu / Nn) * h[u]; l[v] = (-1 + 2 * iv / Nn) * h[v];
      let [o, n] = project(food, [C[0] + l[0], C[1] + l[1], C[2] + l[2]]);
      if (!n) { n = [0, 0, 0]; n[a] = sg; }
      pos.push(o[0] - C[0], o[1] - C[1], o[2] - C[2]); nrm.push(...n); obj.push(...o);
    }
    for (let iu = 0; iu < Nn; iu++) for (let iv = 0; iv < Nn; iv++) { const i0 = base + iu * (Nn + 1) + iv, i1 = i0 + 1, i2 = i0 + Nn + 1, i3 = i2 + 1; idx.push(i0, i2, i1, i1, i2, i3); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); geo.setAttribute('aObj', new THREE.Float32BufferAttribute(obj, 3)); geo.setIndex(idx);
  const P = geo.attributes.position.array, Nr = geo.attributes.normal.array, I = geo.index.array;
  for (let k = 0; k < I.length; k += 3) { const [i0, i1, i2] = [I[k], I[k + 1], I[k + 2]];
    const ax = P[i1 * 3] - P[i0 * 3], ay = P[i1 * 3 + 1] - P[i0 * 3 + 1], az = P[i1 * 3 + 2] - P[i0 * 3 + 2], bx = P[i2 * 3] - P[i0 * 3], by = P[i2 * 3 + 1] - P[i0 * 3 + 1], bz = P[i2 * 3 + 2] - P[i0 * 3 + 2];
    const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    if (cx * (Nr[i0 * 3] + Nr[i1 * 3] + Nr[i2 * 3]) + cy * (Nr[i0 * 3 + 1] + Nr[i1 * 3 + 1] + Nr[i2 * 3 + 1]) + cz * (Nr[i0 * 3 + 2] + Nr[i1 * 3 + 2] + Nr[i2 * 3 + 2]) < 0) { I[k + 1] = i2; I[k + 2] = i1; } }
  return geo;
}

// ---------------- per-round render objects ----------------
let active = null;
function setupRound(r) {
  if (active && active.r === r) return active;
  if (active) { group.remove(active.mesh); active.mesh.geometry.dispose(); if (active.mesh.dispose) active.mesh.dispose(); }
  const pieces = buildPieces(food, r);
  const a = { r, pieces };
  if (r.mode === 'rigid') {
    const geos = pieces.map(p => pieceGeo(p, r.vcell));
    let vt = 0, it = 0; geos.forEach(g => { vt += g.attributes.position.count; it += g.index.count; });
    const bm = new THREE.BatchedMesh(geos.length, vt, it, foodMaterial('aObj'));
    a.ids = geos.map(g => bm.addInstance(bm.addGeometry(g)));
    bm.castShadow = true; bm.receiveShadow = true; bm.frustumCulled = false; bm.perObjectFrustumCulled = false; bm.sortObjects = false;
    a.mesh = bm; a.data = rigidData[r.idx];
  } else {
    a.sim = new GrainSim(food, r, pieces, FPS);
    const s = Math.min(...r.vcell) * 0.98;
    const bg = new THREE.BoxGeometry(s, s, s);
    const cen = new Float32Array(pieces.length * 3); pieces.forEach((p, i) => cen.set([p.cx, p.cy, p.cz], i * 3));
    bg.setAttribute('aObj', new THREE.InstancedBufferAttribute(cen, 3));
    const im = new THREE.InstancedMesh(bg, grainMaterial(), pieces.length);
    im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
    a.mesh = im;
  }
  group.add(a.mesh);
  active = a; return a;
}

// ---------------- knife ----------------
const Q0 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);   // blade ⟂ x
const Q1 = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, -1, 0))); // horizontal
const Q2 = new THREE.Quaternion();                                                                // blade ⟂ z
const _qt = new THREE.Quaternion(), _az = new THREE.Vector3(0, 0, 1);
const topY = () => 2 * RY + 0.22;
const AWAY = { pos: new THREE.Vector3(-0.6, 2 * RY + 1.4, 1.0), q: Q0 };
function poseSet(r, s, k) { // k: continuous position in cut units; integer k = hit of cut k
  const { n } = setInfo(r, s);
  const i = clamp(Math.ceil(k), 1, n), ph = clamp(k - (i - 1), 0, 1);
  const [cx, cy, cz] = r.cell;
  const coord = j => s === 0 ? -RX + j * cx : s === 1 ? 2 * RY - j * cy : RZ - j * cz;
  const prev = coord(Math.max(1, i - 1)), nxt = coord(i), first = i === 1;
  const lift = ph < 0.38, u = lift ? ph / 0.38 : (ph - 0.38) / 0.62, e = u * u * (3 - 2 * u);
  if (s === 1) { // horizontal slice: blade slides through the food along x at height y
    const y = lift ? (first ? nxt : prev + (nxt - prev) * e) : nxt;
    const x = lift ? (-RX - 0.25) + ((RX + 1.4) - (-RX - 0.25)) * e : (RX + 1.4) + ((-RX - 0.25) - (RX + 1.4)) * u * u;
    return { pos: new THREE.Vector3(x, y, -(RZ + 0.55)), q: Q1 };
  }
  const T = topY();
  let y, c, tilt, slide;
  if (lift) { y = -0.005 + (T + 0.005) * Math.sin(e * Math.PI / 2); c = prev + (nxt - prev) * e; tilt = -0.35 * e; slide = 0.25 * (1 - e); }
  else { y = T + (-0.005 - T) * u * u; c = nxt; tilt = -0.35 * (1 - u * u); slide = -0.25 * u * u; }
  if (s === 0) return { pos: new THREE.Vector3(c, y, -(RZ + 0.55) + slide), q: Q0.clone().multiply(_qt.setFromAxisAngle(_az, tilt)) };
  return { pos: new THREE.Vector3(RX + 0.55 + slide, y, c), q: Q2.clone().multiply(_qt.setFromAxisAngle(_az, tilt)) };
}
function knifePose(t) {
  const r = rounds.find(rr => t < rr.end) || rounds[rounds.length - 1];
  for (let s = 0; s < 3; s++) {
    const si = setInfo(r, s);
    if (t < si.t0) {
      const from = s === 0 ? AWAY : poseSet(r, s - 1, setInfo(r, s - 1).n);
      const to = poseSet(r, s, 0.0);
      const tp = s === 0 ? r.start : r.t[s - 1][1];
      const u = clamp((t - tp) / Math.max(0.05, si.t0 - tp), 0, 1), e = u * u * (3 - 2 * u);
      return { pos: from.pos.clone().lerp(to.pos, e).add(new THREE.Vector3(0, Math.sin(e * Math.PI) * 0.6, 0)), q: from.q.clone().slerp(to.q, e) };
    }
    if (t <= si.t1) return poseSet(r, s, (t - si.t0) / si.dt);
  }
  const end = poseSet(r, 2, setInfo(r, 2).n);
  const u = clamp((t - r.t[2][1]) / 0.5, 0, 1), e = u * u * (3 - 2 * u);
  return { pos: end.pos.clone().lerp(AWAY.pos, e), q: end.q.clone().slerp(AWAY.q, e) };
}

// ---------------- frame ----------------
const out = document.createElement('canvas'); out.width = W; out.height = H; document.body.appendChild(out);
const ctx = out.getContext('2d'); const fmt = n => n.toLocaleString('en-US');
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler();
const CAM_DIR = new THREE.Vector3(-1.15, 3.1, 5.0).normalize();
const grainLog = [];
let lastRound = -1;

function renderAt(f) {
  const t = Math.min(f / FPS, TOTAL - 1e-4);
  const r = rounds.find(rr => t < rr.end) || rounds[rounds.length - 1];
  const done = cutsDone(r, t);
  const s3 = setInfo(r, 2);
  // front clip: slabs released so far (visual grid)
  const slabs = Math.floor(done[2] / s3.n * r.vn[2] + 1e-9);
  const clipZ = RZ - slabs * r.vcell[2];
  const wholeVis = clipZ > -RZ + 1e-4;
  whole.visible = wholeVis;
  // whole-food shadow only while it is intact: once slabs fall, the cubes cast their own shadows
  caster.visible = wholeVis && slabs === 0;
  wholeMat.uniforms.uClipZ.value = clipZ;
  wholeMat.uniforms.uDone.value.set(done[0], done[1], done[2]);
  wholeMat.uniforms.uCell.value.set(...r.cell);
  clipPlaneW.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, -1).applyQuaternion(group.quaternion), new THREE.Vector3(0, 0, clipZ).applyMatrix4(group.matrixWorld));
  let released = 0;
  if (t >= s3.t0 - 0.02) {
    const a = setupRound(r); a.mesh.visible = true;
    if (r.mode === 'rigid') {
      const d = a.data, n = a.pieces.length; const fi = clamp(f - d.f0, 0, d.f1 - d.f0 - 1);
      for (let i = 0; i < n; i++) {
        const vis = a.pieces[i].release <= t; a.mesh.setVisibleAt(a.ids[i], vis); if (!vis) continue; released++;
        const o = (fi * n + i) * 7; _p.set(d.buf[o], d.buf[o + 1], d.buf[o + 2]); _q.set(d.buf[o + 3], d.buf[o + 4], d.buf[o + 5], d.buf[o + 6]);
        _m.compose(_p, _q, _s); a.mesh.setMatrixAt(a.ids[i], _m);
      }
    } else {
      const sim = a.sim; const _t0 = performance.now(); sim.stepTo(t); window.TSIM = performance.now() - _t0;
      const { p, q, state } = sim, n = sim.n;
      for (let i = 0; i < n; i++) {
        if (state[i] === 0) { _m.makeScale(0, 0, 0); a.mesh.setMatrixAt(i, _m); continue; }
        released++; const o = i * 3; _p.set(p[o], p[o + 1], p[o + 2]); _q.set(q[i * 4], q[i * 4 + 1], q[i * 4 + 2], q[i * 4 + 3]);
        _m.compose(_p, _q, _s); a.mesh.setMatrixAt(i, _m);
      }
      a.mesh.instanceMatrix.needsUpdate = true;
    }
  } else if (active) active.mesh.visible = false;
  lastRound = f;
  // knife
  const sh = 1 / FPS;
  // fast knife = light streak (real motion blur averages the blade with the background) and no hard shadow
  let kdt = 1; for (let s = 0; s < 3; s++) { const si = setInfo(r, s); if (t >= si.t0 - 0.05 && t <= si.t1 + 0.05) kdt = si.dt; }
  const speedK = clamp(kdt / 0.08, 0.25, 1);
  ghosts.forEach((g, i) => {
    const kp = knifePose(Math.max(0, t - sh * (i / (NG - 1)))); g.position.copy(kp.pos); g.quaternion.copy(kp.q);
    g.traverse(o => { if (o.isMesh) { o.material.opacity = 0.17 * speedK; o.castShadow = i === 0 && kdt >= 0.08; } });
  });
  // camera (fixed inside a round, closer every round)
  const tgt = new THREE.Vector3(0.05, Math.max(0.25, RY * 0.66), 0.15);
  camera.position.copy(tgt).addScaledVector(CAM_DIR, 9.5 * r.zoom);
  camera.lookAt(tgt.x, tgt.y - 0.25, tgt.z);
  const _t1 = performance.now(); renderer.render(scene, camera); window.TGL = performance.now() - _t1;
  // HUD
  ctx.drawImage(glCanvas, 0, 0);
  let g = ctx.createLinearGradient(0, 0, 0, 300); g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, 300);
  g = ctx.createLinearGradient(0, H - 260, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.5)'); ctx.fillStyle = g; ctx.fillRect(0, H - 260, W, 260);
  const cuts = done[0] + done[1] + done[2];
  const nVis = active && active.r === r ? active.pieces.length : 1;
  let cubes = Math.round(r.total * released / nVis);
  if (r.approx) cubes = Math.round(cubes / 1000) * 1000;
  ctx.textAlign = 'center'; ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 10;
  // same style for both counters; the bottom one sits right under the food being cut (never over it)
  const drawCounter = (txt, label, baseY) => {
    let size = 108; ctx.font = `800 ${size}px "Inter Display"`;
    const wTxt = ctx.measureText(txt).width; if (wTxt > W - 36) { size = Math.floor(size * (W - 36) / wTxt); ctx.font = `800 ${size}px "Inter Display"`; }
    ctx.fillStyle = '#f4efe6'; ctx.fillText(txt, W / 2, baseY);
    ctx.fillStyle = '#dca548'; ctx.font = '800 36px "Inter Display"'; ctx.fillText(label, W / 2, baseY + 46);
  };
  drawCounter(fmt(cuts), 'CUTS', 178);
  const bottomPt = new THREE.Vector3(0, 0, RZ * (1 + 1.3 * (wholeMat.uniforms.fLump ? wholeMat.uniforms.fLump.value : 0)) + 0.04).applyMatrix4(group.matrixWorld).project(camera);
  const foodBottom = (1 - bottomPt.y) / 2 * H;
  const capTop = 0.74 * 108;
  const baseY = Math.min(H - 70, Math.max(560, foodBottom + 14 + capTop));
  drawCounter((r.approx && cubes > 0 ? '≈ ' : '') + fmt(cubes), 'CUBES', baseY);
  ctx.shadowBlur = 0;
}

function cutEvents() {
  const ev = [];
  rounds.forEach(r => { for (let s = 0; s < 3; s++) { const { n, t0, dt } = setInfo(r, s); for (let i = 1; i <= n; i++) ev.push({ t: +(t0 + i * dt).toFixed(4), set: s, dt: +dt.toFixed(4), r: r.idx }); } });
  return ev;
}
window.SCENE = {
  nframes: NFRAMES, fps: FPS, total: TOTAL, food: food.name,
  hook: [Math.round(HOOK_T0 * FPS), Math.round((HOOK_T0 + HOOK_LEN) * FPS)],
  segments: rounds.map((r, k) => [Math.round(r.start * FPS), k === rounds.length - 1 ? NFRAMES : Math.round(r.end * FPS)]),
  info: rounds.map(r => ({ cuts: r.ncut, total: r.total, vn: r.vn })),
  frame(f) { renderAt(f); return out.toDataURL('image/jpeg', 0.93); },
  rawFrame() { return glCanvas.toDataURL('image/jpeg', 0.93); },   // same frame without HUD/text (hook)
  audioLog() { return { cuts: cutEvents(), grains: grainLog, rigid: simMeta.map(m => ({ round: m.round, impacts: m.impacts })), total: TOTAL, hook: [HOOK_T0, HOOK_LEN] }; },
};
document.fonts.load('800 40px "Inter Display"').then(() => { window.READY = true; });
