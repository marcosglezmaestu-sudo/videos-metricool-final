// Food model shared by the physics (Node) and the renderer (browser).
// Shapes: ellipsoid | cylinder (axis y) | box. Colours are computed in GLSL from the
// original position of a point inside the food, so every piece / grain keeps its real look.

export const SHAPES = { ellipsoid: 0, cylinder: 1, box: 2 };
export const SKIN_PAT = { solid: 0, stripes: 1, speckle: 2, dimples: 3, net: 4, spots: 5, blush: 6 };
export const CORE = { none: 0, segments: 1, rings: 2, seedring: 3, pit: 4, core_star: 5, seeds: 6, layers: 7, holes: 8, marble: 9, cavity: 10 };

export function shapeId(f) { return SHAPES[f.shape] ?? 0; }

// normalised depth: 1 on the surface, 0 at the centre
export function depth(f, x, y, z) {
  const [rx, ry, rz] = f.R;
  if (f.shape === 'cylinder') return Math.max(Math.hypot(x / rx, z / rz), Math.abs(y) / ry);
  if (f.shape === 'box') return Math.max(Math.abs(x) / rx, Math.abs(y) / ry, Math.abs(z) / rz);
  return Math.hypot(x / rx, y / ry, z / rz);
}
export const inside = (f, x, y, z) => depth(f, x, y, z) < 1;

// does the axis-aligned box [lo,hi] intersect the food?
export function boxHits(f, lo, hi) {
  const [rx, ry, rz] = f.R;
  const c = (a, b) => Math.max(a, Math.min(b, 0));
  const px = c(lo[0], hi[0]), py = c(lo[1], hi[1]), pz = c(lo[2], hi[2]);
  if (f.shape === 'box') return lo[0] < rx && hi[0] > -rx && lo[1] < ry && hi[1] > -ry && lo[2] < rz && hi[2] > -rz;
  if (f.shape === 'cylinder') return Math.hypot(px / rx, pz / rz) < 0.999 && lo[1] < ry && hi[1] > -ry;
  return Math.hypot(px / rx, py / ry, pz / rz) < 0.999;
}

// project a point outside the food back onto its surface; returns [point, normal|null]
export function project(f, q) {
  const [rx, ry, rz] = f.R;
  if (f.shape === 'ellipsoid') {
    const d = Math.hypot(q[0] / rx, q[1] / ry, q[2] / rz);
    if (d <= 1) return [q, null];
    const p = q.map(v => v / d); const g = [p[0] / rx / rx, p[1] / ry / ry, p[2] / rz / rz]; const l = Math.hypot(...g);
    return [p, g.map(v => v / l)];
  }
  if (f.shape === 'cylinder') {
    let p = q.slice(), n = null;
    const rr = Math.hypot(p[0] / rx, p[2] / rz);
    if (rr > 1) { p[0] /= rr; p[2] /= rr; const g = [p[0] / rx / rx, 0, p[2] / rz / rz]; const l = Math.hypot(...g); n = g.map(v => v / l); }
    if (Math.abs(p[1]) > ry) { p[1] = Math.sign(p[1]) * ry; n = [0, Math.sign(p[1]), 0]; }
    return [p, n];
  }
  const p = [Math.max(-rx, Math.min(rx, q[0])), Math.max(-ry, Math.min(ry, q[1])), Math.max(-rz, Math.min(rz, q[2]))];
  return [p, null];
}

// exact number of grid cells (nx, ny, nz) that intersect the food
export function countCells(f, nx, ny, nz) {
  const [rx, ry, rz] = f.R; const cx = 2 * rx / nx, cy = 2 * ry / ny, cz = 2 * rz / nz;
  if (f.shape === 'box') return nx * ny * nz;
  let n = 0;
  for (let i = 0; i < nx; i++) {
    const x0 = -rx + i * cx; const px = Math.max(x0, Math.min(x0 + cx, 0)) / rx;
    if (f.shape === 'cylinder') {
      const s = 1 - px * px; if (s <= 0) continue; const zm = rz * Math.sqrt(s);
      const k0 = Math.max(0, Math.floor((-zm + rz) / cz)), k1 = Math.min(nz - 1, Math.floor((zm + rz) / cz - 1e-9));
      n += Math.max(0, k1 - k0 + 1) * ny; continue;
    }
    for (let j = 0; j < ny; j++) {
      const y0 = -ry + j * cy; const py = Math.max(y0, Math.min(y0 + cy, 0)) / ry;
      const s = 1 - px * px - py * py; if (s <= 0) continue; const zm = rz * Math.sqrt(s);
      const k0 = Math.max(0, Math.floor((-zm + rz) / cz)), k1 = Math.min(nz - 1, Math.floor((zm + rz) / cz - 1e-9));
      n += Math.max(0, k1 - k0 + 1);
    }
  }
  return n;
}

// ---------------- GLSL ----------------
export const FOOD_GLSL = /* glsl */`
uniform int fShape; uniform vec3 fR;
uniform float fSkinT; uniform vec3 fSkinA; uniform vec3 fSkinB; uniform int fSkinPat; uniform float fSkinScale; uniform vec3 fSide; uniform int fHasSide;
uniform float fUnderT; uniform vec3 fUnder;
uniform vec3 fFleshA; uniform vec3 fFleshB; uniform float fFleshScale;
uniform int fCore; uniform vec3 fCoreA; uniform vec3 fCoreB; uniform vec4 fCoreP; uniform int fAxis;
uniform int fLayN; uniform float fLayY[8]; uniform vec3 fLayC[8];
float fh3(vec3 p){ p = fract(p*0.3183099+vec3(.1,.2,.3)); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float fvn(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(fh3(i),fh3(i+vec3(1,0,0)),f.x),mix(fh3(i+vec3(0,1,0)),fh3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(fh3(i+vec3(0,0,1)),fh3(i+vec3(1,0,1)),f.x),mix(fh3(i+vec3(0,1,1)),fh3(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fDepth(vec3 q){
  if(fShape==1) return max(length(q.xz/fR.xz), abs(q.y)/fR.y);
  if(fShape==2) return max(max(abs(q.x)/fR.x, abs(q.y)/fR.y), abs(q.z)/fR.z);
  return length(q/fR);
}
vec3 fAxisFrame(vec3 q){ // returns (radial distance, angle, along-axis) around the chosen axis
  vec3 a = fAxis==0 ? q.yzx : (fAxis==1 ? q.zxy : q);
  return vec3(length(a.xy), atan(a.y, a.x), a.z);
}
vec3 foodColor(vec3 q, out float rough){
  float d = fDepth(q);
  rough = 0.6;
  // skin
  if(d > 1.0 - fSkinT){
    rough = 0.45;
    bool side = false;
    if(fHasSide==1){
      if(fShape==1) side = !(q.y/fR.y > length(q.xz/fR.xz) - 0.02 && q.y > 0.0);
      else if(fShape==2) side = !(q.y/fR.y >= max(abs(q.x)/fR.x, abs(q.z)/fR.z) - 0.02 && q.y > 0.0);
      else side = q.y < 0.0;
    }
    if(side){ return fSide * (0.86 + 0.22*fvn(q*fSkinScale*0.7)); }
    float n = fvn(q*fSkinScale);
    vec3 c = fSkinA;
    if(fSkinPat==1){ float a = atan(q.z, q.y); float st = sin(a*9.0 + sin(q.x*2.2)*1.1 + (fvn(q*2.5)-.5)*3.0); c = mix(fSkinA, fSkinB, smoothstep(-0.1,0.45,st)); }
    else if(fSkinPat==2){ c = mix(fSkinA, fSkinB, step(0.82, fvn(q*fSkinScale*2.0))); }
    else if(fSkinPat==3){ c = fSkinA*(0.82+0.3*n); }
    else if(fSkinPat==4){ float w = abs(fvn(q*fSkinScale*0.6)-0.5); c = mix(fSkinB, fSkinA, smoothstep(0.02,0.07,w)); }
    else if(fSkinPat==5){ c = mix(fSkinA, fSkinB, step(0.72, fvn(q*fSkinScale*0.35))); }
    else if(fSkinPat==6){ c = mix(fSkinA, fSkinB, smoothstep(0.35,0.75, fvn(q*1.6) + 0.25*q.y/fR.y)); }
    return c * (0.9 + 0.15*n);
  }
  if(d > 1.0 - fSkinT - fUnderT) return fUnder * (0.92 + 0.12*fvn(q*30.0));
  // flesh
  vec3 c = mix(fFleshA, fFleshB, fvn(q*fFleshScale));
  vec3 ax = fAxisFrame(q);
  float rr = ax.x / (fAxis==1 ? fR.x : fR.y), ang = ax.y;
  if(fCore==1){ // citrus segments around the axis
    float s = fract(ang/6.2831853*fCoreP.x);
    float memb = min(s,1.0-s)*ax.x*6.2831853/fCoreP.x;
    float ves = fvn(vec3(ax.x*55.0, ang*14.0, ax.z*7.0));
    c = mix(fFleshA, fFleshB, ves);
    c = mix(c, fCoreA, (1.0 - smoothstep(0.004, 0.011, memb))*0.75);
    if(ax.x < fCoreP.y) c = fCoreB;
  } else if(fCore==2){ // onion rings
    float r = fract(d*fCoreP.x);
    c = mix(fFleshA, fFleshB, smoothstep(0.0, 0.5, r));
    c = mix(c, fCoreA, 1.0 - smoothstep(0.0, 0.08, min(r, 1.0-r)));
  } else if(fCore==3){ // kiwi: white centre + ring of black seeds
    if(rr < fCoreP.x) c = fCoreB;
    else {
      vec2 g = vec2(ang*fCoreP.z/6.2831853, ax.z*fCoreP.z*0.5); vec2 id = floor(g); vec2 fr = fract(g) - 0.5;
      float rad = fCoreP.y + (fh3(vec3(id,1.0))-0.5)*0.08;
      if(abs(rr - rad) < 0.05 && length(fr*vec2(1.0,0.6)) < 0.22 && fh3(vec3(id,3.0)) < 0.8) c = fCoreA;
      c = mix(c, mix(c, fCoreB, 0.35), 1.0 - smoothstep(fCoreP.x, fCoreP.x + 0.12, rr));
    }
  } else if(fCore==4){ // central pit
    float pd = length(q/(fR*fCoreP.x));
    if(pd < 1.0) c = fCoreA * (0.85 + 0.2*fvn(q*25.0));
    else if(pd < 1.12) c = fCoreB;
    else c = mix(c, fCoreB, (1.0 - smoothstep(1.12, 1.6, pd))*0.35);
  } else if(fCore==5){ // apple / pear core with seeds
    float cr = ax.x / fR.x;
    if(cr < fCoreP.x){
      c = mix(fCoreB, c, smoothstep(fCoreP.x*0.6, fCoreP.x, cr));
      float s = fract(ang/6.2831853*5.0);
      if(abs(s-0.5) < 0.12 && cr > fCoreP.x*0.35 && cr < fCoreP.x*0.8 && abs(ax.z) < fR.y*0.25) c = fCoreA;
    }
  } else if(fCore==6){ // scattered seeds (watermelon, tomato, dragon fruit, pomegranate)
    vec3 g = q*fCoreP.x; vec3 id = floor(g); vec3 fr = fract(g);
    vec3 sp = vec3(fh3(id), fh3(id+7.1), fh3(id+3.3))*0.56+0.22;
    vec3 dv = (fr - sp)*vec3(0.6,1.0,1.0);
    if(d > fCoreP.z && d < fCoreP.w && fh3(id+1.7) < 0.7 && length(dv) < fCoreP.y) c = fCoreA;
  } else if(fCore==7){ // horizontal layers (cakes, burgers, sandwiches)
    float yn = q.y / fR.y;
    c = fLayC[0];
    for(int i=0;i<8;i++){ if(i < fLayN && yn > fLayY[i]) c = fLayC[i]; }
    c *= 0.9 + 0.15*fvn(q*fFleshScale);
  } else if(fCore==8){ // cheese holes
    vec3 g = q*fCoreP.x; vec3 id = floor(g); vec3 fr = fract(g) - 0.5;
    if(fh3(id) < 0.35 && length(fr) < fCoreP.y) c = fCoreA;
  } else if(fCore==9){ // marble
    float m = sin(q.x*fCoreP.x + 4.0*fvn(q*2.0) + 2.0*fvn(q*6.0));
    c = mix(fFleshA, fFleshB, smoothstep(-0.3, 0.3, m));
  } else if(fCore==10){ // hollow-ish centre with seeds (pumpkin, pepper, melon)
    if(d < fCoreP.x){ c = fCoreA * (0.8 + 0.3*fvn(q*14.0)); if(fvn(q*fCoreP.y) > 0.78) c = fCoreB; }
  }
  return c;
}
// ray / food intersection in food space. Returns entry & exit; nOut = entry normal (food space)
bool foodRay(vec3 ro, vec3 rd, out float t0, out float t1, out vec3 nOut){
  if(fShape==2){
    vec3 inv = 1.0/rd; vec3 a = (-fR - ro)*inv, b = (fR - ro)*inv; vec3 mn = min(a,b), mx = max(a,b);
    t0 = max(max(mn.x,mn.y),mn.z); t1 = min(min(mx.x,mx.y),mx.z);
    if(t0 == mn.x) nOut = vec3(-sign(rd.x),0,0); else if(t0 == mn.y) nOut = vec3(0,-sign(rd.y),0); else nOut = vec3(0,0,-sign(rd.z));
    return t0 <= t1;
  }
  if(fShape==1){
    vec2 o = ro.xz/fR.xz, d = rd.xz/fR.xz;
    float a = dot(d,d), b = dot(o,d), c = dot(o,o)-1.0;
    float ca0 = -1e9, ca1 = 1e9;
    if(a > 1e-9){ float h = b*b - a*c; if(h < 0.0) return false; h = sqrt(h); ca0 = (-b-h)/a; ca1 = (-b+h)/a; }
    else if(c > 0.0) return false;
    float s0 = (-fR.y - ro.y)/rd.y, s1 = (fR.y - ro.y)/rd.y; float sy0 = min(s0,s1), sy1 = max(s0,s1);
    t0 = max(ca0, sy0); t1 = min(ca1, sy1);
    if(sy0 > ca0) nOut = vec3(0, -sign(rd.y), 0);
    else { vec3 p = ro + rd*ca0; nOut = normalize(vec3(p.x/(fR.x*fR.x), 0, p.z/(fR.z*fR.z))); }
    return t0 <= t1;
  }
  vec3 oc = ro/fR, dd = rd/fR;
  float a = dot(dd,dd), b = dot(oc,dd), c = dot(oc,oc)-1.0;
  float h = b*b - a*c; if(h < 0.0) return false; h = sqrt(h);
  t0 = (-b-h)/a; t1 = (-b+h)/a;
  vec3 p = ro + rd*t0; nOut = normalize(p/(fR*fR));
  return true;
}
`;

const SRGB = c => c.map(v => +v);
export function foodUniforms(f, THREE) {
  const v = a => new THREE.Vector3(...SRGB(a || [1, 1, 1]));
  const core = f.core || {};
  const lay = core.layers || [];
  const layY = new Array(8).fill(1.1), layC = new Array(8).fill(0).map(() => new THREE.Vector3(1, 1, 1));
  lay.slice(0, 8).forEach((l, i) => { layY[i] = l.from; layC[i] = v(l.color); });
  return {
    fShape: { value: shapeId(f) }, fR: { value: new THREE.Vector3(...f.R) },
    fSkinT: { value: f.skin.thick }, fSkinA: { value: v(f.skin.color) }, fSkinB: { value: v(f.skin.color2 || f.skin.color) },
    fSkinPat: { value: SKIN_PAT[f.skin.pattern] ?? 0 }, fSkinScale: { value: f.skin.scale || 20 },
    fSide: { value: v(f.skin.side || f.skin.color) }, fHasSide: { value: f.skin.side ? 1 : 0 },
    fUnderT: { value: f.under ? f.under.thick : 0 }, fUnder: { value: v(f.under ? f.under.color : f.flesh.color) },
    fFleshA: { value: v(f.flesh.color) }, fFleshB: { value: v(f.flesh.color2 || f.flesh.color) }, fFleshScale: { value: f.flesh.scale || 8 },
    fCore: { value: CORE[core.type || 'none'] ?? 0 }, fCoreA: { value: v(core.colorA) }, fCoreB: { value: v(core.colorB) },
    fCoreP: { value: new THREE.Vector4(...(core.p || [0, 0, 0, 0])) }, fAxis: { value: ({ x: 0, y: 1, z: 2 })[core.axis || 'z'] },
    fLayN: { value: lay.length }, fLayY: { value: layY }, fLayC: { value: layC },
  };
}
