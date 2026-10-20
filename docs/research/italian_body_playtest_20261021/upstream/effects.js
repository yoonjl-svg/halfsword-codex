// ─────────────────────────────────────────────────────────────
//  타격감 연출: 피/불꽃 입자, 진동, 흔적(데칼). 효과음은 sound.js
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';

const MAX = 500;

export class Particles {
  constructor(scene) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    // 색 칸을 처음부터 만든다: 첫 입자 때 생기면 셰이더가 바뀌어 싸움 중에 새로 만든다 (판 시작 예열이 미리 만든다)
    this.mesh.setColorAt(0, new THREE.Color(0xffffff));
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.list = [];
    this.dirty = false; // 지난 올림 뒤로 바뀐 입자가 있나 (새로 붙음·움직임·사라짐)
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this.terrain = null; // 지형 무대(화산섬)만 main.js 가 땅 계약을 넣는다 — 없으면 바닥은 y 0 (아래 원래 길 그대로)
    this._up = new THREE.Vector3(0, 1, 0);
    this._n = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._c = new THREE.Color();
    this.bloodOn = true;
  }

  /**
   * 피(또는 피 끄기 설정이면 먼지). dir = 칼이 지나간 방향(단위벡터), amount = 세기, speed = 칼 속도
   * 피는 칼이 지나간 방향으로 흩뿌려진다.
   */
  blood(point, dir, amount, speed = 4) {
    const n = Math.min(60, Math.round(4 + amount));
    const color = this.bloodOn ? 0x8a0000 : 0xb3b0a9; // 피 끄기면 회색 모래 먼지
    for (let i = 0; i < n; i++) {
      const k = 0.15 + Math.random() * 0.45;
      const v = new THREE.Vector3(
        dir.x * speed * k + (Math.random() - 0.5) * 1.6,
        dir.y * speed * k + Math.random() * 1.8,
        dir.z * speed * k + (Math.random() - 0.5) * 1.6,
      );
      this.add(point, v, color, 0.012 + Math.random() * 0.025, 3 + Math.random() * 3, true);
    }
  }

  /**
   * 흙 알갱이 (병마용 — 샛별 저장소 901b1f39 clayChips 그대로): 피 대신 몇 알이 잠깐 튀었다 사라진다. 바닥 얼룩 없음 · 피 끄기 설정과 상관없음 · 난수 없음(차례로 정한 각).
   *  수 3 + E/18 (12 까지) · 크기 9~17 mm · 0.25~0.55 s · 흙빛 둘(#8b887a · #b0ac9a) — 값 샛별 그대로 (확인표 1420)
   */
  clayChips(point, dir, energy) {
    const n = Math.min(12, 3 + Math.floor(Math.max(0, energy) / 18));
    for (let i = 0; i < n; i++) {
      const angle = i * 2.399963, speed = 0.35 + Math.min(1.8, energy / 120);
      const v = new THREE.Vector3(dir.x * speed * 0.25 + Math.cos(angle) * 0.45, 0.35 + (i % 3) * 0.18, dir.z * speed * 0.25 + Math.sin(angle) * 0.45);
      this.add(point, v, i % 2 ? 0x8b887a : 0xb0ac9a, 0.009 + (i % 3) * 0.004, 0.25 + (i % 4) * 0.1, false);
    }
  }

  /** 상처에서 뚝뚝 떨어지는 핏방울 */
  drip(point) {
    if (!this.bloodOn) return;
    const v = new THREE.Vector3((Math.random() - 0.5) * 0.2, -0.2, (Math.random() - 0.5) * 0.2);
    this.add(point, v, 0x7a0000, 0.012 + Math.random() * 0.01, 6, true);
  }

  sparks(point, amount) {
    const n = Math.min(24, Math.round(6 + amount));
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3((Math.random() - 0.5) * 5, Math.random() * 4, (Math.random() - 0.5) * 3);
      this.add(point, v, 0xffd27a, 0.012 + Math.random() * 0.01, 0.25 + Math.random() * 0.3, false);
    }
  }

  /**
   * 흘려 받기(우케나가시) 불꽃 줄 (사장님 10/18 23:4x '흘림을 보이고 들리게'): 맞닿은 자리에서 받은 칼이 미끄러진 쪽(dir — combat.js lastNagashi.dir, 받는 칼 코등이 → 칼끝)으로
   *  길이 len(m)만큼 불꽃을 줄지어 흩뿌린다 — 보통 부딪힘(sparks)보다 길고 밝게, 미끄러진 방향을 따라 흐른다. 물리 · 판정과 무관(그림만)
   */
  flowSparks(point, dir, len = 0.32) {
    const d = dir && dir.lengthSq() > 1e-8 ? dir.clone().normalize() : new THREE.Vector3(0, -1, 0);
    const p = new THREE.Vector3();
    for (let i = 0; i < 22; i++) {
      const u = i / 21;
      p.copy(point).addScaledVector(d, u * len);
      const v = d.clone().multiplyScalar(3.5 + 4 * Math.random()).add(new THREE.Vector3((Math.random() - 0.5) * 1.6, Math.random() * 1.8, (Math.random() - 0.5) * 1.6));
      this.add(p, v, i % 3 ? 0xffe2a0 : 0xfff4d6, 0.013 + Math.random() * 0.012, 0.3 + 0.35 * Math.random() + 0.2 * (1 - u), false);
    }
  }

  add(p, v, color, size, life, sticks) {
    if (this.list.length >= MAX) this.list.shift();
    this.list.push({ p: p.clone(), v, color: new THREE.Color(color), size, life, sticks, stuck: false });
    this.dirty = true;
  }

  update(dt) {
    // 제자리에서 추린다 (매 프레임 새 배열을 만들지 않는다. 순서는 그대로)
    const list = this.list;
    let n = 0;
    for (const it of list) {
      it.life -= dt;
      if (it.life <= 0) continue;
      if (!it.stuck) {
        this.dirty = true;
        it.v.y -= 9.81 * dt;
        it.p.addScaledVector(it.v, dt);
        const T = this.terrain;
        if (T) {
          // 지형 무대: 용암면 밑으로 들어간 입자는 사라지고(용암 위엔 얼룩이 남지 않는다), 나머지는 그 자리 땅 위에 앉는다
          if (it.p.z >= T.lavaEdgeZ && it.p.y <= T.lavaLevel) {
            it.life = 0;
            continue;
          }
          const floorY = T.heightAt(it.p.x, it.p.z) + 0.002;
          if (it.p.y <= floorY) {
            if (it.sticks) {
              it.stuck = true;
              it.p.y = floorY;
              it.life = 12;
              it.size *= 1.8;
            } else it.life = 0;
          }
        } else if (it.p.y <= 0.002) {
          if (it.sticks) {
            // 바닥에 떨어진 피는 납작한 얼룩으로 남는다
            it.stuck = true;
            it.p.y = 0.002;
            it.life = 12;
            it.size *= 1.8;
          } else it.life = 0;
        }
      }
      list[n++] = it;
    }
    if (n !== list.length) this.dirty = true;
    list.length = n;
    // 바뀐 게 없으면(다 바닥에 붙어 가만히 있거나 하나도 없으면) 올리지 않는다. 올릴 때는 살아 있는 칸만
    if (!this.dirty) return;
    this.dirty = false;
    for (let i = 0; i < n; i++) {
      const it = list[i];
      const s = it.size;
      this._s.set(s, it.stuck ? 0.002 : s, s);
      if (this.terrain) {
        // 지형 무대: 바닥에 붙은 얼룩은 비탈과 나란히 눕힌다 (떠 있는 입자는 돌리지 않는다)
        if (it.stuck) {
          const n = this.terrain.normalAt(it.p.x, it.p.z);
          this._q.setFromUnitVectors(this._up, this._n.set(n.x, n.y, n.z));
        } else this._q.identity();
      }
      this._m.compose(it.p, this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);
      this.mesh.setColorAt(i, it.color);
    }
    this.mesh.count = n;
    if (n > 0) {
      const im = this.mesh.instanceMatrix;
      const ic = this.mesh.instanceColor;
      im.clearUpdateRanges();
      im.addUpdateRange(0, n * 16);
      im.needsUpdate = true;
      ic.clearUpdateRanges();
      ic.addUpdateRange(0, n * 3);
      ic.needsUpdate = true;
    }
  }

  clear() {
    this.list = [];
    this.mesh.count = 0;
    this.dirty = false;
    this._q.identity(); // 화산섬 판에서 비탈에 눕힌 회전이 다음 판(평지)에 남지 않게 (평지에선 늘 단위 회전 — 그림 그대로)
  }
}

// ─────────────────────────────────────────────────────────────
//  진동(햅틱). 안드로이드는 표준 진동 기능, 아이폰(사파리)은 막혀 있어서
//  iOS 18부터 되는 우회: "스위치" 체크박스를 누르면 기기가 톡 하고 진동한다.
// ─────────────────────────────────────────────────────────────
let iosLabel = null;
let lastHaptic = 0;
let pending = null; // 아이폰: 다음 손가락 떼는 순간 울릴 진동

function iosTap() {
  if (!iosLabel) {
    iosLabel = document.createElement('label');
    iosLabel.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    iosLabel.appendChild(input);
    document.body.appendChild(iosLabel);
  }
  iosLabel.click();
}

export function haptic(strength = 1) {
  const now = performance.now();
  try {
    if (navigator.vibrate) {
      if (now - lastHaptic < 60) return;
      lastHaptic = now;
      navigator.vibrate(Math.round(10 + 30 * Math.min(1, strength)));
      return;
    }
    // 아이폰 사파리는 손가락이 화면을 누르거나 뗀 "그 순간"에만 진동을 허락한다.
    // 그래서 예약해 두었다가 곧 손가락을 뗄 때 울린다 (flushHaptic).
    pending = { strength: Math.max(pending?.strength || 0, strength), until: now + 600 };
  } catch {
    /* 지원 안 하면 조용히 넘어감 */
  }
}

/** 손가락을 뗄 때(input.js가 부른다) 예약된 진동을 울린다 */
export function flushHaptic() {
  if (!pending) return;
  const p = pending;
  pending = null;
  if (performance.now() > p.until) return;
  try {
    iosTap();
    if (p.strength > 0.7) setTimeout(iosTap, 70);
  } catch {
    /* 무시 */
  }
}

// ─────────────────────────────────────────────────────────────
//  흔적(데칼): 상처, 옷 찢김, 번지는 핏자국, 멍, 투구 긁힘/찌그러짐.
//  그림을 몸 표면에 "투사"해서 붙인다 → 곡면·모서리를 따라 딱 붙고, 부위와 함께 움직인다.
//  그림은 파일 없이 캔버스에 코드로 그린다.
// ─────────────────────────────────────────────────────────────
const texCache = {};
function rand(seed) {
  let x = seed;
  return () => ((x = (x * 16807) % 2147483647) / 2147483647);
}
function texture(kind) {
  if (texCache[kind]) return texCache[kind];
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = rand(kind.length * 977 + 13);
  const blob = (x, y, rad, color) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, color);
    gr.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
  };
  if (kind === 'soak') {
    for (let i = 0; i < 18; i++) blob(64 + (r() - 0.5) * 50, 64 + (r() - 0.5) * 50, 14 + r() * 26, 'rgba(70,4,4,0.55)');
    blob(64, 64, 34, 'rgba(60,2,2,0.8)');
  } else if (kind === 'cut' || kind === 'tear') {
    // 가운데 벌어진 틈(어두움) + 붉은 속살 + 가장자리 번짐
    for (let i = 0; i < 10; i++) blob(64 + (r() - 0.5) * 16, 10 + i * 11, 12 + r() * 8, 'rgba(90,6,6,0.35)');
    g.strokeStyle = 'rgba(25,4,4,0.95)';
    g.lineWidth = kind === 'tear' ? 14 : 8;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(64, 8);
    for (let y = 8; y <= 120; y += 8) g.lineTo(64 + (r() - 0.5) * 6, y);
    g.stroke();
    g.strokeStyle = 'rgba(150,20,15,0.95)';
    g.lineWidth = kind === 'tear' ? 6 : 3;
    g.beginPath();
    g.moveTo(64, 14);
    g.lineTo(64, 114);
    g.stroke();
  } else if (kind === 'stab') {
    blob(64, 64, 40, 'rgba(90,6,6,0.5)');
    blob(64, 64, 14, 'rgba(20,2,2,1)');
  } else if (kind === 'clay') {
    // 흙 몸(병마용)의 잔금 — 샛별 901b1f39 그대로: 밝은 테(2 px 비낀) 위 짙은 금 한 줄 + 갈래 하나. 붉은빛·번짐 없음, 난수 없음
    g.lineCap = 'butt';
    g.lineJoin = 'miter';
    for (const [offset, color, width] of [[2, 'rgba(190,187,168,.6)', 3], [0, 'rgba(65,63,54,.85)', 2]]) {
      g.strokeStyle = color;
      g.lineWidth = width;
      g.beginPath();
      for (const [i, point] of [[57, 9], [64, 35], [55, 56], [71, 84], [62, 120]].entries()) {
        if (!i) g.moveTo(point[0] + offset, point[1]);
        else g.lineTo(point[0] + offset, point[1]);
      }
      g.moveTo(55 + offset, 56);
      g.lineTo(37 + offset, 68);
      g.lineTo(31 + offset, 85);
      g.stroke();
    }
  } else if (kind === 'bruise') {
    for (let i = 0; i < 6; i++) blob(64 + (r() - 0.5) * 30, 64 + (r() - 0.5) * 30, 20 + r() * 18, 'rgba(70,35,70,0.35)');
  } else if (kind === 'scratch') {
    g.strokeStyle = 'rgba(245,248,250,0.95)';
    g.lineWidth = 3;
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.moveTo(58 + k * 5 + (r() - 0.5) * 4, 6);
      g.lineTo(60 + k * 4 + (r() - 0.5) * 4, 122);
      g.stroke();
    }
  } else if (kind === 'dent') {
    blob(64, 64, 50, 'rgba(20,22,25,0.75)');
    blob(52, 52, 16, 'rgba(230,235,240,0.5)');
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  texCache[kind] = t;
  return t;
}
const decalMats = new WeakSet(); // 자국마다 새로 만든 재질 (판이 끝나면 푼다 — 그림(texCache)은 종류별로 같이 써서 두고)
function decalMaterial(kind, map = texture(kind)) {
  const metal = kind === 'scratch' || kind === 'dent';
  const m = new THREE.MeshStandardMaterial({
    map,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    roughness: metal ? 0.2 : 0.7,
    metalness: metal ? 0.9 : 0,
  });
  decalMats.add(m);
  return m;
}

/** root 아래 상처 자국의 재질을 푼다 (판을 치울 때. 장면에서 뗀 뒤에 부른다. 모양은 부르는 쪽이 푼다) */
export function disposeDecals(root) {
  root.traverse((o) => {
    if (decalMats.has(o.material)) o.material.dispose();
  });
}

/**
 * 판 시작 예열용: 진짜 자국과 같은 셰이더가 나오는 작은 판 하나 (종류마다 거칠기·금속성 값만 달라 셰이더는 하나).
 *  그림은 빈 질감 — 셰이더는 그림이 있다는 것만 보고, compile 은 그림을 올리지 않는다 (자국 그림은 처음 쓸 때 그대로 만든다)
 */
let warm = null;
export function decalWarmMesh() {
  warm ??= { geo: new THREE.PlaneGeometry(0.001, 0.001), tex: new THREE.Texture() }; // 자국 모양처럼 위치·법선·uv
  return new THREE.Mesh(warm.geo, decalMaterial('cut', warm.tex));
}

/** 표면 방향(법선) 어림: 상자는 가장 가까운 면, 캡슐은 옆면, 구는 바깥쪽 */
function surfaceNormal(mesh, p) {
  const t = mesh.geometry.type;
  const P = mesh.geometry.parameters || {};
  if (t === 'BoxGeometry') {
    const rx = Math.abs(p.x) / (P.width / 2);
    const ry = Math.abs(p.y) / (P.height / 2);
    const rz = Math.abs(p.z) / (P.depth / 2);
    if (rx >= ry && rx >= rz) return new THREE.Vector3(Math.sign(p.x) || 1, 0, 0);
    if (ry >= rz) return new THREE.Vector3(0, Math.sign(p.y) || 1, 0);
    return new THREE.Vector3(0, 0, Math.sign(p.z) || 1);
  }
  if (t === 'CapsuleGeometry') {
    const half = (P.height || 0) / 2;
    if (Math.abs(p.y) > half) return new THREE.Vector3(p.x, p.y - Math.sign(p.y) * half, p.z).normalize();
    const n = new THREE.Vector3(p.x, 0, p.z);
    return n.lengthSq() > 1e-8 ? n.normalize() : new THREE.Vector3(1, 0, 0);
  }
  const n = p.clone();
  return n.lengthSq() > 1e-8 ? n.normalize() : new THREE.Vector3(1, 0, 0);
}

const _Z = new THREE.Vector3(0, 0, 1);
const _mw = new THREE.Matrix4();

/**
 * 메쉬 표면에 흔적을 붙인다.
 * @param {THREE.Mesh} mesh 대상(부위의 옷/피부 메쉬)
 * @param {THREE.Vector3} p  메쉬 기준 위치
 * @param {THREE.Vector3|null} along 메쉬 기준 방향 — 베인 자국이 이 방향으로 길게 남는다
 * @param {number} w,h 크기(m)
 */
export function stickDecal(mesh, p, along, kind, w, h) {
  const n = surfaceNormal(mesh, p);
  const q = new THREE.Quaternion().setFromUnitVectors(_Z, n);
  if (along) {
    const xA = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const yA = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const b = along.clone().addScaledVector(n, -along.dot(n));
    if (b.lengthSq() > 1e-6) q.multiply(new THREE.Quaternion().setFromAxisAngle(_Z, Math.atan2(-b.dot(xA), b.dot(yA))));
  }
  const decal = new THREE.Mesh(new THREE.BufferGeometry(), decalMaterial(kind));
  decal.userData = { mesh, p: p.clone(), rot: new THREE.Euler().setFromQuaternion(q), kind, w, h };
  rebuildDecal(decal, w, h);
  mesh.add(decal);
  return decal;
}

/** 크기를 바꿔 다시 투사 (핏자국이 번질 때) */
export function rebuildDecal(decal, w, h) {
  const { mesh, p, rot } = decal.userData;
  // 메쉬 자기 좌표계에서 투사하려고 잠깐 월드 행렬을 단위행렬로 바꾼다
  _mw.copy(mesh.matrixWorld);
  mesh.matrixWorld.identity();
  const geo = new DecalGeometry(mesh, p, rot, new THREE.Vector3(w, h, Math.max(w, h) * 1.5 + 0.05));
  mesh.matrixWorld.copy(_mw);
  decal.geometry.dispose();
  decal.geometry = geo;
  decal.userData.w = w;
  decal.userData.h = h;
}
