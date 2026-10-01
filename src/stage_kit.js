// ─────────────────────────────────────────────────────────────
//  스테이지 공용 도구: 난수·흔들기·재질별 합치기(Kit)·가지(limb)·캔버스 질감
//   산사(stage_temple.js)·성 안뜰(stage_castle.js)·대성당(stage_cathedral.js)이 같이 쓴다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function rng(seed) {
  let x = seed;
  return () => ((x = (x * 16807) % 2147483647) / 2147483647);
}
export function h3(x, y, z, s) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + s * 4.581) * 43758.5453;
  return n - Math.floor(n);
}
/** 꼭짓점을 제 위치로 정해지는 만큼 흔든다 (같은 자리의 꼭짓점은 같이 움직여 틈이 안 생긴다) */
export function roughen(g, amt, seed) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = Math.round(p.getX(i) * 1e4) / 1e4;
    const y = Math.round(p.getY(i) * 1e4) / 1e4;
    const z = Math.round(p.getZ(i) * 1e4) / 1e4;
    p.setXYZ(i, x + (h3(x, y, z, seed) - 0.5) * amt, y + (h3(y, z, x, seed + 1) - 0.5) * amt, z + (h3(z, x, y, seed + 2) - 0.5) * amt);
  }
}

export const UP = new THREE.Vector3(0, 1, 0);
export const _c = new THREE.Color();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
export const _v = new THREE.Vector3();
const _c2 = new THREE.Color();

/** 면마다 가장 가까운 축 평면으로 질감을 투사한다 (크기가 제각각인 돌도 무늬 크기가 같게) */
export function boxUV(g, s) {
  const p = g.attributes.position;
  const uv = g.attributes.uv;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i);
    b.fromBufferAttribute(p, i + 1).sub(a);
    c.fromBufferAttribute(p, i + 2).sub(a);
    b.cross(c);
    const ax = Math.abs(b.x);
    const ay = Math.abs(b.y);
    const az = Math.abs(b.z);
    for (let k = i; k < i + 3; k++) {
      const x = p.getX(k);
      const y = p.getY(k);
      const z = p.getZ(k);
      if (ay >= ax && ay >= az) uv.setXY(k, x * s, z * s);
      else if (ax >= az) uv.setXY(k, z * s, y * s);
      else uv.setXY(k, x * s, y * s);
    }
  }
}

/** 꼭짓점 색에 빛을 구워 넣는다: color *= 1 + light(x, y, z) */
export function bakeLight(g, light) {
  const p = g.attributes.position;
  const col = g.attributes.color;
  for (let i = 0; i < p.count; i++) {
    const L = light(p.getX(i), p.getY(i), p.getZ(i));
    col.setXYZ(i, col.getX(i) * (1 + L[0]), col.getY(i) * (1 + L[1]), col.getZ(i) * (1 + L[2]));
  }
  col.needsUpdate = true;
}

/** 점광원 여럿의 따뜻한 빛: lights = [{ x, y, z, r(반경), c: [r,g,b] 세기 }] */
export function pointGlow(lights) {
  return (x, y, z) => {
    let r = 0;
    let g = 0;
    let b = 0;
    for (const L of lights) {
      const d = Math.hypot(x - L.x, y - L.y, z - L.z) / L.r;
      if (d >= 1) continue;
      const f = (1 - d) * (1 - d);
      r += L.c[0] * f;
      g += L.c[1] * f;
      b += L.c[2] * f;
    }
    return [r, g, b];
  };
}
const _s = new THREE.Vector3();

/**
 * 재질별로 조각을 모았다가 한 메쉬로 합친다. 조각마다 꼭짓점 색(밝기 흔들림 + 자리 무늬)을 칠한다.
 * push/pop 으로 "지금 짓는 건물의 자리·방향"을 쌓아 두면 그 안에서는 건물 기준 좌표로 놓으면 된다.
 */
export class Kit {
  constructor(seed) {
    this.bins = {};
    this.r = rng(seed);
    this.frame = new THREE.Matrix4();
    this.stack = [];
    this.n = 0;
  }
  push(pos, rotY = 0, scale = 1) {
    this.stack.push(this.frame.clone());
    this.frame.multiply(new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromAxisAngle(UP, rotY), new THREE.Vector3(scale, scale, scale)));
  }
  pop() {
    this.frame = this.stack.pop();
  }
  /**
   * rot: [x, y, z] (YXZ 순서), scale: 숫자나 [x,y,z]. opt.rough: 모서리 깨짐(m) · opt.vary: 조각마다 밝기 차 · opt.noise: 자리 얼룩
   * opt.uv: 'box' 면 제자리(월드) 기준으로 면마다 가까운 축 평면에 질감을 투사 (opt.uvScale: 질감 1장 = 1/uvScale m)
   * opt.snow: 0~1, 위를 보는 면을 눈 색(opt.snowColor)으로 덮는 정도
   */
  put(bin, geo, color, pos = [0, 0, 0], rot = [0, 0, 0], scale = 1, opt = {}) {
    typeof scale === 'number' ? _s.setScalar(scale) : _s.set(...scale);
    _m.compose(_v.set(...pos), _q.setFromEuler(_e.set(rot[0], rot[1], rot[2], 'YXZ')), _s);
    return this.putM(bin, geo, color, _m, opt);
  }
  putM(bin, geo, color, m, opt = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.clearGroups();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(m);
    g.applyMatrix4(this.frame);
    if (opt.rough) {
      roughen(g, opt.rough, 11 + this.n * 7);
      g.computeVertexNormals();
    }
    if (opt.uv === 'box') boxUV(g, opt.uvScale ?? 0.5);
    _c.set(color);
    const j = 1 + (this.r() - 0.5) * (opt.vary ?? 0.1);
    const na = opt.noise ?? 0.06;
    const p = g.attributes.position;
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const k = j * (1 + (h3(p.getX(i) * 2.3, p.getY(i) * 2.3, p.getZ(i) * 2.3, 5) - 0.5) * 2 * na);
      col[i * 3] = _c.r * k;
      col[i * 3 + 1] = _c.g * k;
      col[i * 3 + 2] = _c.b * k;
    }
    if (opt.snow) {
      const nrm = g.attributes.normal;
      _c2.set(opt.snowColor ?? 0xe9eef5);
      for (let i = 0; i < p.count; i++) {
        const a = opt.snow * THREE.MathUtils.smoothstep(nrm.getY(i), 0.45, 0.8);
        const n = 1 + (h3(p.getX(i) * 3.7, p.getY(i), p.getZ(i) * 3.7, 8) - 0.5) * 0.08;
        col[i * 3] += (_c2.r * n - col[i * 3]) * a;
        col[i * 3 + 1] += (_c2.g * n - col[i * 3 + 1]) * a;
        col[i * 3 + 2] += (_c2.b * n - col[i * 3 + 2]) * a;
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    (this.bins[bin] ??= []).push(g);
    this.n++;
    return g;
  }
  /** light(x, y, z) → [r, g, b] 를 주면 꼭짓점 색에 (1 + 그 값) 을 곱해 둔다 (횃불·창빛 같은 따뜻한 빛을 미리 구워 넣기) */
  mesh(bin, mat, { cast = false, receive = true, light = null } = {}) {
    if (!this.bins[bin]) return null;
    const g = mergeGeometries(this.bins[bin], false);
    if (light) bakeLight(g, light);
    const m = new THREE.Mesh(g, mat);
    m.castShadow = cast;
    m.receiveShadow = receive;
    return m;
  }
}

export const box = (w, h, d, sx = 1, sy = 1, sz = 1) => new THREE.BoxGeometry(w, h, d, sx, sy, sz);
export const cyl = (rt, rb, h, seg = 8, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);

/** a → b 로 뻗은 원뿔대 (가지·밧줄·마루) */
export function limb(K, bin, a, b, r0, r1, color, opt = {}, seg = 7) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const dir = B.clone().sub(A);
  const len = dir.length();
  const m = new THREE.Matrix4().compose(A.add(B).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()), new THREE.Vector3(1, 1, 1));
  K.putM(bin, cyl(r1, r0, len, seg, true), color, m, opt);
}

// ── 질감 (캔버스) ──
export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
