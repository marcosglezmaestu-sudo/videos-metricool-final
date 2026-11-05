import * as THREE from 'three';
import { RoomEnvironment } from '/node_modules/three/examples/jsm/environments/RoomEnvironment.js';

const W = 1080, H = 1920, FPS = 30;
const RX = 1.0, RY = 0.93, RZ = 1.0;
const R = new THREE.Vector3(RX, RY, RZ);
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const SIM = await (await fetch('/sim.json')).json();
const BIN = new Float32Array(await (await fetch('/sim.bin')).arrayBuffer());
const N = SIM.n, NF = Math.round(SIM.dur * FPS);
const [CX, CY, CZ] = SIM.cell;
// knife: vertical chops from front to back, each one at the plane that frees the next slab
const KN = SIM.KN, KT0 = SIM.KT0, KDT = SIM.KDT;
const Q_CHOP = new THREE.Quaternion(); // blade along x, flat face toward camera, edge down
const _qt = new THREE.Quaternion(), _ax = new THREE.Vector3(0, 0, 1);
function chopZ(i) { return RZ - i * CZ; }
function knifePose(t) {
  const topY = 2 * RY + 0.22;
  if (t <= KT0) return { pos: new THREE.Vector3(1.55, topY + 0.25, chopZ(1)), q: Q_CHOP.clone().multiply(_qt.setFromAxisAngle(_ax, -0.35)) };
  const kf = (t - KT0) / KDT;
  if (kf >= KN) { // lift away after the last chop
    const u = clamp((t - (KT0 + KN * KDT)) / 0.45, 0, 1), e = u * u * (3 - 2 * u);
    return { pos: new THREE.Vector3(1.55 + e * 0.8, -0.005 + e * (topY + 1.2), chopZ(KN) - e * 0.6), q: Q_CHOP.clone().multiply(_qt.setFromAxisAngle(_ax, -0.35 * e)) };
  }
  const i = Math.floor(kf) + 1, ph = kf - (i - 1);        // heading to chop i, ph 0..1, hit at ph = 1
  const zPrev = i === 1 ? chopZ(1) : chopZ(i - 1), zNext = chopZ(i);
  let y, z, tilt, slide;
  if (ph < 0.38) {           // lift out of the previous cut, travel back to the next plane
    const u = ph / 0.38, e = u * u * (3 - 2 * u);
    y = (i === 1 ? topY + 0.25 : -0.005) + (topY - (i === 1 ? topY + 0.25 : -0.005)) * Math.sin(e * Math.PI / 2);
    z = zPrev + (zNext - zPrev) * e; tilt = -0.35 * e; slide = 0.25 * (1 - e);
  } else {                   // chop down through the orange, rocking from tip to heel and slicing along the blade
    const u = (ph - 0.38) / 0.62, e = u * u;
    y = topY + (-0.005 - topY) * e; z = zNext; tilt = -0.35 * (1 - e); slide = -0.25 * e;
  }
  return { pos: new THREE.Vector3(1.55 + slide, y, z), q: Q_CHOP.clone().multiply(_qt.setFromAxisAngle(_ax, tilt)) };
}
// ---------------- renderer / scene ----------------
const glCanvas = document.createElement('canvas'); glCanvas.width = W; glCanvas.height = H;
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.85;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1917);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45;
const camera = new THREE.PerspectiveCamera(50, W / H, 0.05, 60);

const key = new THREE.DirectionalLight(0xfff0dc, 2.6);
key.position.set(-3.0, 7.5, 3.5); key.castShadow = true; key.shadow.mapSize.set(4096, 4096);
Object.assign(key.shadow.camera, { left: -2.8, right: 2.8, top: 2.8, bottom: -2.8, near: 1, far: 20 });
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
  } else {
    vec3 e = uHalf - abs(p); float m = 1e3;
    for(int ax=0; ax<3; ax++){ if(!face || abs(nl[ax]) < 0.5) m = min(m, e[ax]); }
    if(face) alb *= mix(0.78, 1.0, smoothstep(0.0, uHalf.x*0.16, m));
    else alb *= mix(0.45, 1.0, smoothstep(0.0012, 0.0042, m));
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



// ---- real geometry per piece (box ∩ ellipsoid), standard material => real shadows between cubes ----
const RV = [RX, RY, RZ], CV = [CX, CY, CZ];
function pieceGeo(p) {
  const c = [p.cx, p.cy, p.cz], h = [CX / 2, CY / 2, CZ / 2];
  let rind = false;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const X = (c[0] + sx * h[0]) / RX, Y = (c[1] + sy * h[1]) / RY, Z = (c[2] + sz * h[2]) / RZ;
    if (X * X + Y * Y + Z * Z > 1) rind = true;
  }
  const Nn = rind ? 6 : 1;
  const pos = [], nrm = [], obj = [], idx = [];
  for (let a = 0; a < 3; a++) for (const sg of [1, -1]) {
    const b = (a + 1) % 3, cc = (a + 2) % 3; const u = sg > 0 ? b : cc, v = sg > 0 ? cc : b;
    const base = pos.length / 3;
    for (let iu = 0; iu <= Nn; iu++) for (let iv = 0; iv <= Nn; iv++) {
      const l = [0, 0, 0]; l[a] = sg * h[a]; l[u] = (-1 + 2 * iu / Nn) * h[u]; l[v] = (-1 + 2 * iv / Nn) * h[v];
      let o = [c[0] + l[0], c[1] + l[1], c[2] + l[2]];
      let n = [0, 0, 0]; n[a] = sg;
      const d = Math.hypot(o[0] / RX, o[1] / RY, o[2] / RZ);
      if (d > 1) {
        o = o.map(x => x / d);
        const g = [o[0] / (RX * RX), o[1] / (RY * RY), o[2] / (RZ * RZ)]; const gl = Math.hypot(...g); n = g.map(x => x / gl);
      }
      pos.push(o[0] - c[0], o[1] - c[1], o[2] - c[2]); nrm.push(...n); obj.push(...o);
    }
    for (let iu = 0; iu < Nn; iu++) for (let iv = 0; iv < Nn; iv++) {
      const i0 = base + iu * (Nn + 1) + iv, i1 = i0 + 1, i2 = i0 + Nn + 1, i3 = i2 + 1;
      idx.push(i0, i2, i1, i1, i2, i3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('aObj', new THREE.Float32BufferAttribute(obj, 3));
  geo.setIndex(idx);
  return geo;
}
const geos = SIM.pieces.map(pieceGeo);
// fix winding: ensure triangles face along their normal
geos.forEach(geo => {
  const P = geo.attributes.position.array, Nr = geo.attributes.normal.array, I = geo.index.array;
  for (let k = 0; k < I.length; k += 3) {
    const [i0, i1, i2] = [I[k], I[k + 1], I[k + 2]];
    const ax = P[i1 * 3] - P[i0 * 3], ay = P[i1 * 3 + 1] - P[i0 * 3 + 1], az = P[i1 * 3 + 2] - P[i0 * 3 + 2];
    const bx = P[i2 * 3] - P[i0 * 3], by = P[i2 * 3 + 1] - P[i0 * 3 + 1], bz = P[i2 * 3 + 2] - P[i0 * 3 + 2];
    const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    const nx = Nr[i0 * 3] + Nr[i1 * 3] + Nr[i2 * 3], ny = Nr[i0 * 3 + 1] + Nr[i1 * 3 + 1] + Nr[i2 * 3 + 1], nz = Nr[i0 * 3 + 2] + Nr[i1 * 3 + 2] + Nr[i2 * 3 + 2];
    if (cx * nx + cy * ny + cz * nz < 0) { I[k + 1] = i2; I[k + 2] = i1; }
  }
});
let vtot = 0, itot = 0; geos.forEach(g => { vtot += g.attributes.position.count; itot += g.index.count; });
const pieceMat = new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0 });
pieceMat.onBeforeCompile = sh => {
  sh.uniforms.uR = { value: new THREE.Vector3(RX, RY, RZ) };
  sh.uniforms.uCellV = { value: new THREE.Vector3(CX, CY, CZ) };
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aObj;\nvarying vec3 vObj;\nvarying vec3 vONrm;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = aObj;\nvONrm = normal;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vObj; varying vec3 vONrm; uniform vec3 uR; uniform vec3 uCellV;
float h3(vec3 p){ p = fract(p*0.3183099+vec3(.1,.2,.3)); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vn(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z); }
vec3 orangeCol(vec3 q, out float rough){
  float d = length(q/uR); rough = 0.6;
  if(d > 0.978){ rough = 0.42; return vec3(1.0,0.40,0.0) * (0.80 + 0.25*vn(q*38.0)); }
  if(d > 0.958) return mix(vec3(0.99,0.88,0.70), vec3(1.0,0.60,0.22), smoothstep(0.962,0.978,d));
  float rr = length(q.xy);
  if(rr < 0.06) return vec3(0.99,0.92,0.80);
  float ang = atan(q.y,q.x); float s = fract(ang/6.2831853*11.0);
  float memb = min(s,1.0-s)*rr*6.2831853/11.0;
  float mm = 1.0 - smoothstep(0.004, 0.011, memb);
  float ves = vn(vec3(rr*55.0, ang*14.0, q.z*7.0));
  vec3 flesh = mix(vec3(0.93,0.30,0.01), vec3(1.0,0.50,0.05), ves);
  return mix(flesh, vec3(1.0,0.74,0.45), mm*0.7);
}`).replace('vec4 diffuseColor = vec4( diffuse, opacity );', `float pr; vec3 oc = orangeCol(vObj, pr);
  float ln = 1.0;
  for(int ax=0; ax<3; ax++){
    if(abs(vONrm[ax]) > 0.999) continue;
    float sc = (vObj[ax] + uR[ax]) / uCellV[ax];
    float dd = abs(fract(sc + 0.5) - 0.5) * uCellV[ax];
    float fw = fwidth(vObj[ax]);
    float isFlat = step(0.999, max(max(abs(vONrm.x),abs(vONrm.y)),abs(vONrm.z)));
    ln = min(ln, mix(mix(0.42, 0.8, isFlat), 1.0, smoothstep(0.0012, 0.0012 + fw*1.5 + 0.002, dd)));
  }
  vec4 diffuseColor = vec4( pow(oc, vec3(2.2)) * ln, opacity );`)
  .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = pr;');
};
const pm = new THREE.BatchedMesh(geos.length, vtot, itot, pieceMat);
const ids = geos.map(g => pm.addInstance(pm.addGeometry(g)));
pm.castShadow = true; pm.receiveShadow = true; pm.frustumCulled = false; pm.perObjectFrustumCulled = false; pm.sortObjects = false;
group.add(pm);
wholeMesh.visible = false; shadowCaster.visible = false;
const rel = SIM.pieces.map(p => p.r).sort((a, b) => a - b);

const out = document.createElement('canvas'); out.width = W; out.height = H; document.body.appendChild(out);
const ctx = out.getContext('2d');
const fmt = n => n.toLocaleString('en-US');
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
const CAM_DIR = new THREE.Vector3(-1.15, 3.1, 5.0).normalize();
function renderAt(f) {
  f = Math.min(f, NF - 1); const t = f / FPS;
  const o = f * N * 7;
  for (let i = 0; i < N; i++) {
    const b = o + i * 7;
    _p.set(BIN[b], BIN[b + 1], BIN[b + 2]); _q.set(BIN[b + 3], BIN[b + 4], BIN[b + 5], BIN[b + 6]);
    _m.compose(_p, _q, _s); pm.setMatrixAt(ids[i], _m);
  }
  const sh = 1 / FPS;
  ghosts.forEach((gk, i) => { const kp = knifePose(Math.max(0, t - sh * (i / (NG - 1)))); gk.position.copy(kp.pos); gk.quaternion.copy(kp.q); });
  const tgt = new THREE.Vector3(0.05, 0.55, 0.3);
  camera.position.copy(tgt).addScaledVector(CAM_DIR, 9.5 * 0.80);
  camera.lookAt(tgt.x, tgt.y - 0.25, tgt.z);
  renderer.render(scene, camera);
  ctx.drawImage(glCanvas, 0, 0);
  let gr = ctx.createLinearGradient(0, 0, 0, 375); gr.addColorStop(0, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, 375);
  gr = ctx.createLinearGradient(0, H - 325, 0, H); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.5)'); ctx.fillStyle = gr; ctx.fillRect(0, H - 325, W, 325);
  const S = W / 576;
  const cuts = 33 + clamp(Math.floor((t - KT0) / KDT), 0, KN);
  let lo = 0, hi = rel.length; while (lo < hi) { const m = (lo + hi) >> 1; if (rel[m] <= t) lo = m + 1; else hi = m; }
  ctx.textAlign = 'center'; ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 12;
  ctx.fillStyle = '#f4efe6'; ctx.font = `800 ${108 * S}px "Inter Display"`; ctx.fillText(fmt(cuts), W / 2, 178 * S);
  ctx.fillStyle = '#dca548'; ctx.font = `800 ${36 * S}px "Inter Display"`; ctx.fillText('CUTS', W / 2, 224 * S);
  ctx.fillStyle = '#f4efe6'; ctx.font = `800 ${47 * S}px "Inter Display"`; ctx.fillText(fmt(lo), W / 2, 922 * S);
  ctx.fillStyle = '#dca548'; ctx.font = `800 ${26 * S}px "Inter Display"`; ctx.fillText('CUBES', W / 2, 958 * S);
  ctx.shadowBlur = 0;
}
window.SCENE = { nframes: NF, fps: FPS, total: SIM.dur, info: [{ n: N }], events: () => SIM.impacts, frame(f) { renderAt(f); return out.toDataURL('image/jpeg', 0.94); } };
document.fonts.load('800 40px "Inter Display"').then(() => { window.READY = true; });
