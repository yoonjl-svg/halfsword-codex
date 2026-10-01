// ─────────────────────────────────────────────────────────────
//  배경 5: 어두운 성의 큰 홀 (밤)
//   검은 대리석 바닥 한가운데 금테 두른 붉은 카펫 고리(경기장 경계) · 입구 문에서 옥좌 단까지 이어지는 붉은 카펫 ·
//   뾰족 궁륭 천장에 매달린 쇠 샹들리에 셋(촛불) · 벽마다 촛대의 일렁이는 초 · 달빛 드는 긴 창 · 늘어진 붉은 천(깃발·휘장) ·
//   큰 벽난로의 불 · 붉은 휘장 앞 옥좌 · 먼지 앉은 긴 식탁 · 빈 갑옷들 · 어두운 초상화 · 구석의 거미줄 · 천장을 도는 박쥐.
//  고풍스럽지만 적막하고 불길하게: 빛은 촛불·난로·달빛뿐, 멀리는 어둠에 잠긴다.
//  물리와는 무관한 그림만 만든다. 카메라가 도는 반지름(10.5m) 안에는 바닥·카펫만 둔다 (샹들리에는 머리 위 높이).
//  불빛은 실제 조명 대신 꼭짓점 색에 구워 넣는다 (폰에서 가볍게).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { ARENA } from './config.js';
import { rng, h3, _v, Kit, box, cyl, limb, canvasTex, pointGlow } from './stage_kit.js';

const C = {
  stone: 0x8a8490, // 어두운 석벽 (질감에 곱해짐)
  stoneDark: 0x5e5964,
  wood: 0x3a2418,
  woodDark: 0x24160f,
  iron: 0x26242a,
  gold: 0xb08a3a,
  red: 0x7a1018, // 카펫·천
  redDark: 0x4e0a10,
  wax: 0xe8dfc8,
  moon: 0x6f86c4, // 달빛 창
};
const TEX_AVG = 0.55;

function stoneTexture() {
  const r = rng(41);
  return canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#5a5660';
    x.fillRect(0, 0, w, h);
    const rows = 5;
    const rh = h / rows;
    for (let j = 0; j < rows; j++) {
      let u = -r() * 70;
      while (u < w) {
        const bw = 56 + r() * 64;
        const v = 170 + Math.floor(r() * 45);
        x.fillStyle = `rgb(${v - 6},${v - 8},${v})`;
        x.fillRect(u + 2, j * rh + 2, bw - 4, rh - 4);
        for (let k = 0; k < 8; k++) {
          x.fillStyle = `rgba(40,36,44,${0.06 + r() * 0.1})`;
          x.fillRect(u + 3 + r() * (bw - 12), j * rh + 3 + r() * (rh - 10), 3 + r() * 10, 2 + r() * 6);
        }
        u += bw;
      }
    }
  });
}
/** 검은 대리석 바둑판 (1장 = 2×2칸) + 흰 결 */
function marbleTexture() {
  const r = rng(42);
  return canvasTex(256, 256, (x, w, h) => {
    const s = w / 2;
    for (let j = 0; j < 2; j++)
      for (let i = 0; i < 2; i++) {
        const dark = (i + j) % 2 === 0;
        x.fillStyle = dark ? '#1f1c22' : '#4c4652';
        x.fillRect(i * s, j * s, s, s);
        x.strokeStyle = dark ? 'rgba(150,140,150,0.25)' : 'rgba(220,215,220,0.35)';
        x.lineWidth = 1;
        for (let k = 0; k < 3; k++) {
          x.beginPath();
          let px = i * s + r() * s;
          let py = j * s;
          x.moveTo(px, py);
          for (let q = 0; q < 6; q++) {
            px += (r() - 0.5) * 30;
            py += s / 6;
            x.lineTo(px, py);
          }
          x.stroke();
        }
        x.fillStyle = 'rgba(0,0,0,0.5)';
        x.fillRect(i * s, j * s, s, 2);
        x.fillRect(i * s, j * s, 2, s);
      }
  });
}
/** 거미줄: 바큇살 + 나선, 가장자리가 투명 */
function webTexture() {
  return canvasTex(128, 128, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.strokeStyle = 'rgba(220,220,230,0.55)';
    x.lineWidth = 1;
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = (i / (n - 1)) * (Math.PI / 2);
      x.beginPath();
      x.moveTo(0, 0);
      x.lineTo(Math.cos(a) * w, Math.sin(a) * h);
      x.stroke();
    }
    for (let k = 1; k < 9; k++) {
      x.beginPath();
      const rr = k * 14;
      for (let i = 0; i < n; i++) {
        const a = (i / (n - 1)) * (Math.PI / 2);
        const sag = i % 2 ? 0.93 : 1;
        const px = Math.cos(a) * rr * sag;
        const py = Math.sin(a) * rr * sag;
        i ? x.lineTo(px, py) : x.moveTo(px, py);
      }
      x.stroke();
    }
  });
}
function flameTexture() {
  return canvasTex(32, 32, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,220,150,1)');
    g.addColorStop(0.4, 'rgba(255,150,60,0.5)');
    g.addColorStop(1, 'rgba(255,120,40,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
  });
}

/** 뾰족 아치 반쪽 원의 중심·반지름·꼭대기 각 */
function pointed(s, rise) {
  const cx = (s * s - rise * rise) / (2 * s);
  return { cx, R: s - cx, th: Math.atan2(rise, -cx) };
}
/** 뾰족 아치 위의 점: u 0 → 왼쪽 어깨(−s), 0.5 → 꼭대기, 1 → 오른쪽 어깨(+s). 반환 [가로, 높이] */
function archPt(s, rise, u) {
  const { cx, R, th } = pointed(s, rise);
  if (u <= 0.5) {
    const a = Math.PI - 2 * u * th;
    return [-cx + R * Math.cos(a), R * Math.sin(a)];
  }
  const a = (1 - u) * 2 * th;
  return [cx + R * Math.cos(a), R * Math.sin(a)];
}
function windowShape(w, hs, rise) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, hs);
  const { cx, R, th } = pointed(w / 2, rise);
  s.absarc(cx, hs, R, 0, th, false);
  s.absarc(-cx, hs, R, Math.PI - th, Math.PI, false);
  s.lineTo(-w / 2, 0);
  return s;
}

/**
 * 어두운 성의 큰 홀을 만든다. 반환: { update(dt), excite(amount), sunOffset }
 *  lights: main.js 의 { hemi, sun } — 어두운 밤의 촛불빛으로 바꾼다 (해 = 가운데 샹들리에 불빛, 거의 바로 위에서)
 */
export function buildDarkHall(scene, lights = {}) {
  const r = rng(666);
  const K = new Kit(1313);
  const FOG = 0x0e0b12;
  const sunOffset = { x: 0.6, y: 9, z: 0.8 };
  scene.background = new THREE.Color(FOG);
  scene.fog = new THREE.Fog(FOG, 18, 85);
  if (lights.hemi) {
    lights.hemi.color.set(0x3b3552);
    lights.hemi.groundColor.set(0x1c1210);
    lights.hemi.intensity = 0.55;
  }
  if (lights.sun) {
    lights.sun.color.set(0xffb070);
    lights.sun.intensity = 1.0;
    lights.sun.position.set(sunOffset.x, sunOffset.y, sunOffset.z);
  }

  // ── 크기 ──
  const HX = 28; // 홀 길이 반 (±x). 입구 문 −x, 옥좌 +x
  const HZ = 16; // 홀 폭 반 (±z). 벽난로 −z, 달빛 창 +z (−z 에도 창)
  const WH = 15; // 벽 높이 (궁륭 어깨)
  const VR = 8; // 궁륭이 솟는 높이
  const BAY = 5.6;
  const bays = [];
  for (let x = -HX; x < HX - 0.01; x += BAY) bays.push([x, Math.min(HX, x + BAY)]);
  const st = { uv: 'box', uvScale: 0.26, vary: 0.06, noise: 0.05 };

  // ── 불빛 자리 (꼭짓점 색에 구울 것) ──
  const lightPts = [];
  const flames = []; // { x, y, z, s }
  const addCandle = (x, y, z, s = 1, glowR = 0) => {
    K.put('wax', cyl(0.035 * s, 0.04 * s, 0.26 * s, 7), C.wax, [x, y + 0.13 * s, z], [0, 0, 0], 1, { vary: 0.08 });
    K.put('wax', new THREE.SphereGeometry(0.03 * s, 5, 3), C.wax, [x + 0.03 * s, y + 0.2 * s, z], [0, 0, 0], [1, 1.6, 1]); // 흘러내린 촛농
    flames.push({ x, y: y + 0.27 * s, z, s: 0.55 * s, ph: r() * 6.3 });
    if (glowR) lightPts.push({ x, y: y + 0.3, z, r: glowR, c: [0.55, 0.3, 0.1] });
  };

  // ── 바닥: 검은 대리석 바둑판 ──
  {
    const nx = Math.round((2 * HX) / 0.8);
    const nz = Math.round((2 * HZ) / 0.8);
    const pos = [];
    const uv = [];
    for (let j = 0; j <= nz; j++)
      for (let i = 0; i <= nx; i++) {
        const x = -HX + (2 * HX * i) / nx;
        const z = -HZ + (2 * HZ * j) / nz;
        pos.push(x, 0, z);
        uv.push(x / 2, z / 2);
      }
    const idx = [];
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const a = j * (nx + 1) + i;
        idx.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    K.floorGeo = g; // 빛은 불빛 자리를 다 모은 뒤 굽는다
  }

  // ── 카펫: 결투 자리 고리 + 입구~고리, 고리~옥좌 긴 카펫 (금테) ──
  {
    const R0 = ARENA.radius;
    const flat = (geo, color, y, rotY = 0) => K.put('cloth', geo, color, [0, y, 0], [-Math.PI / 2, rotY, 0], 1, { vary: 0, noise: 0.08 });
    flat(new THREE.RingGeometry(R0 + 0.05, R0 + 0.95, 96, 1), C.red, 0.012);
    flat(new THREE.RingGeometry(R0 + 0.12, R0 + 0.18, 96, 1), C.gold, 0.016);
    flat(new THREE.RingGeometry(R0 + 0.82, R0 + 0.88, 96, 1), C.gold, 0.016);
    // 고리 위 무늬: 작은 금빛 마름모
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      K.put('cloth', new THREE.CircleGeometry(0.12, 4), C.gold, [Math.cos(a) * (R0 + 0.5), 0.017, Math.sin(a) * (R0 + 0.5)], [-Math.PI / 2, 0, a], 1, { vary: 0 });
    }
    const runner = (x0, x1) => {
      const L = x1 - x0;
      K.put('cloth', new THREE.PlaneGeometry(L, 3, 1, 1), C.red, [(x0 + x1) / 2, 0.012, 0], [-Math.PI / 2, 0, 0], 1, { vary: 0, noise: 0.1 });
      for (const s of [-1, 1]) K.put('cloth', new THREE.PlaneGeometry(L, 0.08, 1, 1), C.gold, [(x0 + x1) / 2, 0.016, s * 1.35], [-Math.PI / 2, 0, 0], 1, { vary: 0 });
    };
    runner(-HX + 0.6, -R0 - 0.9);
    runner(R0 + 0.9, HX - 6.2);
    // 가운데 희미한 팔각 별 상감
    flat(new THREE.RingGeometry(1.3, 1.38, 8, 1), C.gold, 0.006);
    flat(new THREE.RingGeometry(2.6, 2.66, 8, 1), 0x6a5a3a, 0.006, Math.PI / 8);
  }

  // ── 긴 벽 (±z): 칸마다 달빛 창, 칸 사이 벽기둥과 촛대 ──
  const moonWins = [];
  for (const side of [-1, 1]) {
    const z = side * HZ;
    for (let b = 0; b < bays.length; b++) {
      const [xa, xb] = bays[b];
      const w = xb - xa;
      const xm = (xa + xb) / 2;
      const fire = side < 0 && Math.abs(xm) < BAY; // 벽난로 칸은 창 없음
      const sh = new THREE.Shape();
      sh.moveTo(-w / 2, 0);
      sh.lineTo(w / 2, 0);
      sh.lineTo(w / 2, WH);
      sh.lineTo(-w / 2, WH);
      sh.lineTo(-w / 2, 0);
      const winY = 5.5;
      if (!fire) {
        const hole = windowShape(1.8, 5.2, 1.6);
        const path = new THREE.Path(hole.getPoints(10).map((p) => new THREE.Vector2(p.x, p.y + winY)));
        sh.holes.push(path);
        moonWins.push({ x: xm, z, side });
      }
      const g = new THREE.ExtrudeGeometry(sh, { depth: 1.2, bevelEnabled: false, curveSegments: 8 });
      g.translate(0, 0, -0.6);
      K.put('stone', g, C.stone, [xm, 0, z], [0, 0, 0], 1, st);
      if (!fire) {
        // 창살 (마름모꼴 납 격자 대신 굵은 쇠 가로·세로) + 창턱
        K.put('iron', box(0.06, 6.8, 0.06), C.iron, [xm, winY + 3.4, z]);
        for (let k = 1; k < 5; k++) K.put('iron', box(1.8, 0.05, 0.06), C.iron, [xm, winY + k * 1.2, z]);
        K.put('stone', box(2.3, 0.25, 1.6), C.stoneDark, [xm, winY - 0.12, z - side * 0.1], [0, 0, 0], 1, st);
        K.put('moon', new THREE.ShapeGeometry(windowShape(1.8, 5.2, 1.6), 8), side > 0 ? C.moon : 0x3a4670, [xm, winY, z + side * 0.3], [0, 0, 0], 1, { vary: 0.1, noise: 0.15 });
      }
      // 벽기둥 + 촛대 (칸 경계마다)
      if (b > 0) {
        K.put('stone', box(1.0, WH, 0.7), C.stoneDark, [xa, WH / 2, z - side * 0.9], [0, 0, 0], 1, st);
        const sx = xa;
        const sz = z - side * 1.3;
        K.put('iron', box(0.08, 0.08, 0.6), C.iron, [sx, 3.2, z - side * 1.05]);
        K.put('iron', box(0.8, 0.05, 0.05), C.iron, [sx, 3.35, sz]);
        for (const dx of [-0.35, 0, 0.35]) {
          K.put('iron', cyl(0.07, 0.03, 0.08, 8), C.iron, [sx + dx, 3.42, sz]);
          addCandle(sx + dx, 3.46 + (dx === 0 ? 0.1 : 0), sz, 1);
        }
        lightPts.push({ x: sx, y: 3.7, z: sz, r: 5, c: [0.9, 0.5, 0.18] });
      }
    }
    // 창 사이 드리운 붉은 천 (끝이 제비꼬리로 해진 깃발, 문장 없음)
    for (let b = 1; b < bays.length; b += 2) {
      const x = bays[b][0];
      const L = 6.5 + r() * 2;
      const sh = new THREE.Shape();
      sh.moveTo(-0.55, 0);
      sh.lineTo(0.55, 0);
      sh.lineTo(0.55, -L);
      sh.lineTo(0.1, -L + 0.9 + r() * 0.4);
      sh.lineTo(-0.1, -L + 0.5);
      sh.lineTo(-0.55, -L - 0.3);
      sh.lineTo(-0.55, 0);
      const g = new THREE.ShapeGeometry(sh, 1);
      // 천이 살짝 물결치게
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 4 + p.getY(i) * 0.7) * 0.06);
      g.computeVertexNormals();
      K.put('cloth', g, C.red, [x, WH - 0.8, side * (HZ - 1.3)], [0, side > 0 ? Math.PI : 0, 0], 1, { vary: 0.08, noise: 0.12 });
      K.put('cloth', box(1.2, 0.12, 0.05), C.gold, [x, WH - 0.8, side * (HZ - 1.32)]);
      K.put('iron', cyl(0.04, 0.04, 1.5, 6), C.iron, [x, WH - 0.7, side * (HZ - 1.3)], [0, 0, Math.PI / 2]);
    }
  }

  // ── 짧은 벽 (±x): 입구 쪽 큰 문, 옥좌 쪽 붉은 휘장과 둥근 창 ──
  for (const end of [-1, 1]) {
    const x = end * HX;
    const sh = new THREE.Shape();
    const W2 = HZ + 0.6;
    sh.moveTo(-W2, 0);
    sh.lineTo(W2, 0);
    sh.lineTo(W2, WH);
    for (let i = 0; i <= 12; i++) {
      const [px, py] = archPt(HZ, VR, 1 - i / 12);
      sh.lineTo(px, WH + py);
    }
    sh.lineTo(-W2, WH);
    sh.lineTo(-W2, 0);
    const rose = new THREE.Path();
    rose.absarc(0, WH + 2.2, 2.4, 0, Math.PI * 2, false);
    sh.holes.push(rose);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 1.4, bevelEnabled: false, curveSegments: 12 });
    g.translate(0, 0, -0.7);
    K.put('stone', g, C.stone, [x, 0, 0], [0, Math.PI / 2, 0], 1, st);
    // 둥근 창 (핏빛 유리)
    const rg = [];
    for (let k = 0; k < 3; k++)
      for (let i = 0; i < 8 * (k + 1); i++) {
        const a0 = (i / (8 * (k + 1))) * Math.PI * 2 + 0.03;
        const a1 = ((i + 1) / (8 * (k + 1))) * Math.PI * 2 - 0.03;
        const r0 = k * 0.8 + 0.06;
        const r1 = (k + 1) * 0.8 - 0.06;
        const pp = (rr, a) => new THREE.Vector2(Math.cos(a) * rr, Math.sin(a) * rr);
        const s2 = new THREE.Shape([pp(r0, a0), pp(r1, a0), pp(r1, a1), pp(r0, a1)]);
        rg.push(new THREE.ShapeGeometry(s2, 1));
      }
    for (const gg of rg) K.put('moon', gg, end > 0 ? 0x7a1a24 : 0x3a2a5a, [x + end * 0.3, WH + 2.2, 0], [0, Math.PI / 2, 0], 1, { vary: 0.3, noise: 0.1 });
  }
  // 입구 문: 뾰족 아치 속 두 짝 나무문 + 쇠 징과 띠
  {
    const x = -HX + 0.72;
    const dw = 5;
    const g = new THREE.ShapeGeometry(windowShape(dw, 5, 3), 10);
    K.put('wood', g, C.woodDark, [x, 0, 0], [0, Math.PI / 2, 0], 1, { vary: 0.05 });
    K.put('wood', box(0.12, 7.6, 0.14), C.iron, [x + 0.05, 3.8, 0]);
    for (let k = 0; k < 4; k++) K.put('iron', box(0.08, 0.14, dw - 0.2), C.iron, [x + 0.06, 0.8 + k * 1.4, 0]);
    for (let k = 0; k < 4; k++)
      for (let i = -3; i <= 3; i++) if (i) K.put('iron', new THREE.SphereGeometry(0.05, 5, 3), 0x3a3634, [x + 0.1, 0.8 + k * 1.4, i * 0.7]);
    for (const s of [-1, 1]) K.put('iron', new THREE.TorusGeometry(0.22, 0.04, 5, 12), C.iron, [x + 0.12, 3, s * 0.6], [0, Math.PI / 2, 0]); // 문고리
    K.put('stone', new THREE.TorusGeometry(dw / 2 + 0.35, 0.35, 5, 14, Math.PI), C.stoneDark, [x + 0.1, 5, 0], [0, Math.PI / 2, 0], 1, st);
  }

  // ── 옥좌 단: 붉은 카펫 덮은 세 단 + 높은 등받이 옥좌 + 뒤의 휘장 + 촛대 ──
  {
    const x0 = HX - 6.4;
    for (let k = 0; k < 3; k++) {
      const w = 6.4 - k * 1.3;
      const d = 9 - k * 2;
      K.put('stone', box(w, 0.35, d), C.stoneDark, [HX - w / 2, 0.175 + k * 0.35, 0], [0, 0, 0], 1, st);
      K.put('cloth', box(w + 0.02, 0.02, 3), C.red, [HX - w / 2, 0.36 + k * 0.35, 0], [0, 0, 0], 1, { vary: 0 });
    }
    const tx = HX - 2.4;
    const ty = 1.05;
    K.put('wood', box(1.1, 0.55, 1.3), C.wood, [tx, ty + 0.28, 0]);
    K.put('cloth', box(0.95, 0.12, 1.15), C.redDark, [tx - 0.05, ty + 0.6, 0]);
    // 등받이: 뾰족한 꼭대기
    const back = new THREE.ExtrudeGeometry(windowShape(1.3, 2.4, 1.2), { depth: 0.18, bevelEnabled: false, curveSegments: 6 });
    back.translate(0, 0, -0.09);
    K.put('wood', back, C.wood, [tx + 0.5, ty + 0.55, 0], [0, Math.PI / 2, 0]);
    K.put('cloth', new THREE.ShapeGeometry(windowShape(0.9, 2.0, 0.8), 6), C.red, [tx + 0.4, ty + 0.75, 0], [0, -Math.PI / 2, 0]);
    for (const s of [-1, 1]) {
      K.put('wood', box(1.1, 0.12, 0.16), C.wood, [tx - 0.05, ty + 1.1, s * 0.62]); // 팔걸이
      K.put('gold', new THREE.SphereGeometry(0.1, 8, 6), C.gold, [tx - 0.58, ty + 1.18, s * 0.62]);
      K.put('gold', new THREE.ConeGeometry(0.08, 0.35, 6), C.gold, [tx + 0.5, ty + 0.55 + 2.4 + 1.2 + 0.15, s * 0.0]);
    }
    // 뒤 벽의 큰 붉은 휘장 (주름진 천)
    const cw = 12;
    const ch = 12;
    const cg = new THREE.PlaneGeometry(cw, ch, 48, 4);
    const p = cg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i);
      const v = p.getY(i);
      p.setZ(i, Math.sin(u * 3.2) * 0.18 * (0.6 + 0.4 * (1 - (v + ch / 2) / ch)) + Math.sin(u * 7.1) * 0.05);
    }
    cg.computeVertexNormals();
    K.put('cloth', cg, C.redDark, [HX - 0.9, ch / 2, 0], [0, -Math.PI / 2, 0], 1, { vary: 0, noise: 0.1 });
    K.put('gold', box(0.2, 0.3, cw + 0.4), C.gold, [HX - 0.95, ch + 0.1, 0]);
    // 옥좌 옆 키 큰 촛대 둘
    for (const s of [-1, 1]) {
      const cx = x0 + 1.2;
      const cz = s * 3.6;
      K.put('iron', cyl(0.05, 0.22, 2.2, 8), C.iron, [cx, 0.35 + 1.1, cz]); // 단 첫 층(0.35m) 위에 선다
      K.put('iron', cyl(0.3, 0.06, 0.12, 8), C.iron, [cx, 2.6, cz]);
      for (const [dx, dz] of [
        [0, 0],
        [0.22, 0],
        [-0.22, 0],
        [0, 0.22],
        [0, -0.22],
      ])
        addCandle(cx + dx, 2.66, cz + dz, 1.2);
      lightPts.push({ x: cx, y: 3.0, z: cz, r: 6.5, c: [1.0, 0.55, 0.2] });
    }
  }

  // ── 벽난로 (−z 벽 가운데): 큰 돌 아궁이, 불꽃과 잉걸불 ──
  {
    const z = -HZ + 0.6;
    K.put('stone', box(5.6, 0.5, 2.2), C.stoneDark, [0, 0.25, z + 0.6], [0, 0, 0], 1, st); // 앞 돌판
    for (const s of [-1, 1]) K.put('stone', box(0.9, 3.6, 1.6), C.stoneDark, [s * 2.3, 1.8, z + 0.4], [0, 0, 0], 1, st);
    K.put('stone', box(6.2, 0.9, 1.9), C.stoneDark, [0, 4.0, z + 0.45], [0, 0, 0], 1, st); // 선반
    K.put('stone', box(5.0, 7, 1.2), C.stone, [0, 4.5 + 3.5, z], [0, 0, 0], 1, st); // 굴뚝 가슴
    K.put('dark', box(3.7, 3.2, 0.2), 0x0a0706, [0, 1.6 + 0.5, z + 0.05]);
    for (let i = 0; i < 5; i++) K.put('wood', cyl(0.12, 0.12, 1.6, 6), C.woodDark, [(i - 2) * 0.45, 0.62 + (i % 2) * 0.18, z + 0.55], [0, 0.3 * (i - 2), Math.PI / 2]);
    K.put('ember', new THREE.PlaneGeometry(3.2, 0.9), 0xff5a1a, [0, 0.52, z + 0.6], [-Math.PI / 2, 0, 0], 1, { vary: 0, noise: 0.3 });
    for (let i = 0; i < 7; i++) flames.push({ x: (i - 3) * 0.42, y: 0.6, z: z + 0.6, s: 2.2 - Math.abs(i - 3) * 0.4, ph: r() * 6.3 });
    lightPts.push({ x: 0, y: 1.2, z: z + 1.6, r: 12, c: [1.4, 0.6, 0.18] });
    // 선반 위 촛대와 해골 대신 모래시계
    for (const s of [-1, 1]) addCandle(s * 2.4, 4.45, z + 0.7, 1.1);
    K.put('gold', cyl(0.14, 0.14, 0.05, 8), C.gold, [0.8, 4.47, z + 0.8]);
    K.put('gold', cyl(0.14, 0.14, 0.05, 8), C.gold, [0.8, 4.95, z + 0.8]);
    K.put('glassDim', new THREE.ConeGeometry(0.12, 0.22, 8), 0x9a8a6a, [0.8, 4.61, z + 0.8], [Math.PI, 0, 0]);
    K.put('glassDim', new THREE.ConeGeometry(0.12, 0.22, 8), 0x9a8a6a, [0.8, 4.81, z + 0.8]);
    // 선반 위 큰 초상화 (어두운 그림)
    K.put('gold', box(0.15, 3.2, 2.5), C.gold, [0, 6.8, z + 0.62], [0, Math.PI / 2, 0]);
    K.put('dark', box(0.1, 2.8, 2.1), 0x2a1c1e, [0, 6.8, z + 0.68], [0, Math.PI / 2, 0]);
  }

  // ── 궁륭 천장: 뾰족 원통 + 칸마다 갈비뼈 ──
  {
    const na = 20;
    const nx = Math.round((2 * HX) / 1.4);
    const pos = [];
    for (let i = 0; i < nx; i++) {
      const x0 = -HX + (2 * HX * i) / nx;
      const x1 = -HX + (2 * HX * (i + 1)) / nx;
      for (let k = 0; k < na; k++) {
        const [z0, y0] = archPt(HZ, VR, k / na);
        const [z1, y1] = archPt(HZ, VR, (k + 1) / na);
        pos.push(x0, WH + y0, z0, x1, WH + y0, z0, x0, WH + y1, z1, x0, WH + y1, z1, x1, WH + y0, z0, x1, WH + y1, z1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    K.put('stoneIn', g, C.stoneDark, [0, 0, 0], [0, 0, 0], 1, { ...st, vary: 0 });
    for (const [xa] of bays.slice(1)) {
      const pts = [];
      for (let k = 0; k <= 16; k++) {
        const [z, y] = archPt(HZ - 0.9, VR - 0.4, k / 16);
        pts.push(new THREE.Vector3(xa, WH + y - 0.25, z));
      }
      K.put('stone', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.32, 5, false), C.stoneDark, [0, 0, 0], [0, 0, 0], 1, { vary: 0.04 });
    }
  }

  // ── 샹들리에 셋: 쇠고리 두 겹 + 사슬 + 촛불 ──
  const chandelier = (cx, cy, cz, R) => {
    const top = WH + VR - 0.4;
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      limb(K, 'iron', [cx + Math.cos(a) * R, cy + 0.05, cz + Math.sin(a) * R], [cx, cy + 2.2, cz], 0.015, 0.015, C.iron, {}, 3);
    }
    limb(K, 'iron', [cx, cy + 2.2, cz], [cx, top, cz], 0.03, 0.03, C.iron, {}, 4); // 긴 사슬
    for (let k = 0; k < Math.floor((top - cy - 2.2) / 0.5); k++) K.put('iron', new THREE.TorusGeometry(0.06, 0.018, 4, 6), C.iron, [cx, cy + 2.4 + k * 0.5, cz], [0, k * 1.57, 0]);
    K.put('iron', new THREE.TorusGeometry(R, 0.06, 5, 32), C.iron, [cx, cy, cz], [Math.PI / 2, 0, 0]);
    K.put('iron', new THREE.TorusGeometry(R * 0.55, 0.05, 5, 24), C.iron, [cx, cy + 0.9, cz], [Math.PI / 2, 0, 0]);
    K.put('iron', cyl(0.12, 0.2, 1.2, 8), C.iron, [cx, cy + 0.5, cz]);
    K.put('iron', new THREE.ConeGeometry(0.2, 0.5, 8), C.iron, [cx, cy - 0.3, cz], [Math.PI, 0, 0]);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      limb(K, 'iron', [cx, cy + 0.2, cz], [cx + Math.cos(a) * R, cy, cz + Math.sin(a) * R], 0.03, 0.03, C.iron, {}, 4);
    }
    const n1 = Math.round(R * 7);
    for (let k = 0; k < n1; k++) {
      const a = (k / n1) * Math.PI * 2;
      addCandle(cx + Math.cos(a) * R, cy + 0.04, cz + Math.sin(a) * R, 1.1);
    }
    const n2 = Math.round(R * 4);
    for (let k = 0; k < n2; k++) {
      const a = (k / n2) * Math.PI * 2 + 0.2;
      addCandle(cx + Math.cos(a) * R * 0.55, cy + 0.94, cz + Math.sin(a) * R * 0.55, 1);
    }
    lightPts.push({ x: cx, y: cy + 0.5, z: cz, r: 9, c: [0.6, 0.32, 0.1] });
    lightPts.push({ x: cx, y: 0, z: cz, r: 12, c: [0.25, 0.13, 0.04] }); // 바닥에 떨어지는 옅은 빛
  };
  chandelier(0, 9.5, 0, 2.3);
  chandelier(-15.5, 8.2, 0, 1.7);
  chandelier(15.5, 8.2, 0, 1.7);

  // ── 긴 식탁 (+z 쪽): 먼지 앉은 식탁, 높은 등받이 의자, 촛대 하나만 켜져 있다 ──
  {
    const tz = 11.6;
    const x0 = -21;
    const x1 = -8.5;
    const L = x1 - x0;
    const xm = (x0 + x1) / 2;
    K.put('wood', box(L, 0.12, 1.6), C.wood, [xm, 0.9, tz]);
    K.put('cloth', box(L + 0.02, 0.02, 0.5), C.redDark, [xm, 0.97, tz]);
    for (const dx of [-L / 2 + 0.4, -L / 6, L / 6, L / 2 - 0.4]) for (const s of [-1, 1]) K.put('wood', box(0.14, 0.84, 0.14), C.woodDark, [xm + dx, 0.42, tz + s * 0.6]);
    for (let i = 0; i < 8; i++) {
      const x = x0 + 0.9 + i * ((L - 1.8) / 7);
      for (const s of [-1, 1]) {
        if (s > 0 && i % 3 === 1) continue;
        const fallen = i === 5 && s < 0;
        const cz = tz + s * 1.15;
        if (fallen) {
          K.put('wood', box(0.5, 0.06, 0.5), C.woodDark, [x, 0.25, cz - 0.6], [1.3, 0.4, 0]);
          K.put('wood', box(0.5, 1.3, 0.06), C.woodDark, [x + 0.1, 0.08, cz - 1.1], [Math.PI / 2, 0.4, 0]);
          continue;
        }
        K.put('wood', box(0.5, 0.06, 0.5), C.woodDark, [x, 0.5, cz]);
        K.put('wood', box(0.5, 1.5, 0.06), C.woodDark, [x, 1.25, cz + s * 0.24]);
        K.put('cloth', box(0.44, 0.05, 0.44), C.redDark, [x, 0.55, cz]);
        for (const dx of [-0.2, 0.2]) K.put('wood', box(0.05, 0.5, 0.05), C.woodDark, [x + dx, 0.25, cz - s * 0.2]);
      }
      // 빈 접시와 잔
      K.put('gold', cyl(0.18, 0.15, 0.02, 10), 0x8c8a86, [x, 0.97, tz + 0.45]);
      if (i % 2) K.put('gold', cyl(0.05, 0.03, 0.18, 8), C.gold, [x + 0.3, 1.05, tz + 0.3]);
    }
    // 가운데 촛대 (셋 중 하나만 켜짐)
    for (const [i, lit] of [
      [0.25, false],
      [0.5, true],
      [0.75, false],
    ]) {
      const x = x0 + L * i;
      K.put('iron', cyl(0.04, 0.12, 0.5, 8), C.gold, [x, 1.21, tz]);
      if (lit) addCandle(x, 1.46, tz, 1.1, 3.5);
      else K.put('wax', cyl(0.035, 0.04, 0.12, 7), C.wax, [x, 1.52, tz]);
    }
  }

  // ── 빈 갑옷들 (벽기둥 앞) ──
  const armor = (x, z, rotY) => {
    K.push([x, 0, z], rotY);
    const m = 0x5d6068;
    K.put('stone', box(0.8, 0.25, 0.8), C.stoneDark, [0, 0.125, 0]);
    for (const s of [-0.13, 0.13]) {
      K.put('steel', cyl(0.08, 0.07, 0.85, 8), m, [0, 0.7, s]);
      K.put('steel', box(0.28, 0.1, 0.14), m, [-0.06, 0.3, s]);
    }
    K.put('steel', cyl(0.2, 0.17, 0.35, 10), m, [0, 1.3, 0]);
    K.put('steel', cyl(0.23, 0.2, 0.55, 10), m, [0, 1.72, 0]);
    for (const s of [-1, 1]) {
      K.put('steel', new THREE.SphereGeometry(0.13, 8, 6), m, [0, 1.95, s * 0.3]);
      K.put('steel', cyl(0.06, 0.055, 0.6, 7), m, [0.05, 1.6, s * 0.32], [0, 0, 0.15]);
    }
    K.put('steel', cyl(0.13, 0.15, 0.32, 10), m, [0, 2.2, 0]);
    K.put('steel', new THREE.SphereGeometry(0.14, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), m, [0, 2.35, 0]);
    K.put('dark', box(0.02, 0.03, 0.18), 0x050505, [-0.15, 2.22, 0]); // 투구 눈구멍
    K.put('steel', box(0.03, 1.6, 0.03), 0x7a7e86, [-0.25, 1.1, 0.34]); // 세운 칼
    K.put('steel', box(0.04, 0.03, 0.3), 0x7a7e86, [-0.25, 1.75, 0.34]);
    K.pop();
  };
  for (const [x, side] of [
    [-bays[2][0], 1],
    [bays[2][0], 1],
    [-bays[3][0], -1],
    [bays[3][0], -1],
    [bays[1][0], 1],
    [bays[1][0], -1],
  ])
    armor(x, side * (HZ - 1.9), side > 0 ? -Math.PI / 2 : Math.PI / 2); // 홀 가운데를 본다

  // ── 어두운 초상화들 (창 없는 벽 쪽 높이) ──
  for (const [x, z, w, h] of [
    [-HX + 0.75, -9.5, 1.6, 2.2],
    [-HX + 0.75, 9.5, 1.6, 2.2],
    [HX - 0.8, -9.8, 1.4, 2],
    [HX - 0.8, 9.8, 1.4, 2],
  ]) {
    K.put('gold', box(0.12, h + 0.3, w + 0.3), C.gold, [x, 4.5, z]);
    K.put('dark', box(0.1, h, w), 0x241a1c, [x - Math.sign(x) * 0.03, 4.5, z]);
    K.put('glassDim', box(0.1, h * 0.3, w * 0.4), 0x4a3a34, [x - Math.sign(x) * 0.05, 4.5 + h * 0.15, z]); // 어렴풋한 얼굴 자리
  }

  // ── 거미줄 (위쪽 구석과 창틀 구석) ──
  //  (판 하나 = 벽면에 붙은 부채꼴, 왼쪽 위 모서리가 거미줄 중심. rotY 로 붙을 벽면과 뻗는 방향을 정한다)
  const webs = [];
  const web = (x, y, z, s, rotY) => webs.push({ x, y, z, s, rotY });
  for (const ex of [-1, 1]) for (const sz of [-1, 1]) web(ex * (HX - 0.72), WH, sz * (HZ - 0.62), 2.4, sz > 0 ? Math.PI / 2 : -Math.PI / 2);
  for (const wn of moonWins.filter((_, i) => i % 3 === 1)) web(wn.x - 0.9, 5.5 + 5.2, wn.z - wn.side * 0.61, 0.8, 0);

  // ── 불빛 굽기 + 재질 ──
  const glow = pointGlow(lightPts);
  // 바닥
  {
    const g = K.floorGeo;
    const p = g.attributes.position;
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const L = glow(x, 0, z);
      const k = (0.6 + 0.08 * h3(Math.round(x), 0, Math.round(z), 2)) / TEX_AVG;
      col[i * 3] = k * (1 + L[0]);
      col[i * 3 + 1] = k * (1 + L[1]);
      col[i * 3 + 2] = k * (1 + L[2]);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const floor = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: marbleTexture(), vertexColors: true, roughness: 0.35, metalness: 0.1 }));
    floor.receiveShadow = true;
    scene.add(floor);
  }
  const std = (p) => new THREE.MeshStandardMaterial({ vertexColors: true, ...p });
  const stoneMat = std({ map: stoneTexture(), roughness: 0.95 });
  stoneMat.color.setScalar(1 / TEX_AVG);
  const stoneInMat = std({ map: stoneMat.map, roughness: 0.95, side: THREE.DoubleSide });
  stoneInMat.color.setScalar(1 / TEX_AVG);
  const meshes = [
    K.mesh('stone', stoneMat, { light: glow }),
    K.mesh('stoneIn', stoneInMat, { light: glow }),
    K.mesh('wood', std({ roughness: 0.8 }), { light: glow }),
    K.mesh('cloth', std({ roughness: 1, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }), { light: glow }),
    K.mesh('iron', std({ roughness: 0.55, metalness: 0.6 }), { light: glow }),
    K.mesh('steel', std({ roughness: 0.35, metalness: 0.75 }), { light: glow }),
    K.mesh('gold', std({ roughness: 0.4, metalness: 0.8 }), { light: glow }),
    K.mesh('wax', std({ roughness: 0.7, emissive: 0x3a2610, emissiveIntensity: 0.8 })),
    K.mesh('dark', std({ roughness: 1 }), { light: glow }),
    K.mesh('glassDim', std({ roughness: 0.6 }), { light: glow }),
    K.mesh('moon', new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide })),
    K.mesh('ember', new THREE.MeshBasicMaterial({ vertexColors: true })),
  ];
  for (const m of meshes) if (m) scene.add(m);

  // 거미줄 (반투명 판 하나로)
  {
    const parts = [];
    for (const w of webs) {
      const g = new THREE.PlaneGeometry(w.s, w.s);
      g.translate(w.s / 2, -w.s / 2, 0);
      g.rotateY(w.rotY);
      g.translate(w.x, w.y, w.z);
      parts.push(g.toNonIndexed());
    }
    const n = parts.reduce((s, g) => s + g.attributes.position.count, 0);
    const pos = new Float32Array(n * 3);
    const uv = new Float32Array(n * 2);
    let o = 0;
    for (const g of parts) {
      pos.set(g.attributes.position.array, o * 3);
      uv.set(g.attributes.uv.array, o * 2); // 판의 왼쪽 위 = 캔버스 왼쪽 위 = 거미줄 중심
      o += g.attributes.position.count;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: webTexture(), transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.6 })));
  }

  // ── 달빛 줄기: +z 창에서 비스듬히 바닥으로 (옅은 푸른 더하기 섞기) ──
  {
    const pos = [];
    const col = [];
    const mc = new THREE.Color(0x7d93d6);
    const dir = new THREE.Vector3(0.2, -1, -0.7).normalize();
    for (const wn of moonWins.filter((w) => w.side > 0 && w.x > -HX + 3 && w.x < HX - 7)) {
      const top = new THREE.Vector3(wn.x, 8.6, wn.z - 0.6);
      const len = (top.y - 0.02) / -dir.y;
      const w = 1.6;
      const h = 5.6;
      // 창 모양을 따라 비스듬한 판 두 장 (윗변: 창, 아랫변: 바닥 위 빛자리)
      const q = [
        [top.x - w / 2, top.y - h / 2, top.z],
        [top.x + w / 2, top.y - h / 2, top.z],
        [top.x - w / 2, top.y + h / 2, top.z],
        [top.x + w / 2, top.y + h / 2, top.z],
      ];
      const b = q.map(([x, y, z]) => [x + dir.x * len * (y / top.y), y + dir.y * len * (y / top.y), z + dir.z * len * (y / top.y)]);
      const quad = (a0, a1, b0, b1) => {
        pos.push(...a0, ...a1, ...b0, ...b0, ...a1, ...b1);
        col.push(mc.r, mc.g, mc.b, 0.1, mc.r, mc.g, mc.b, 0.1, mc.r, mc.g, mc.b, 0.02, mc.r, mc.g, mc.b, 0.02, mc.r, mc.g, mc.b, 0.1, mc.r, mc.g, mc.b, 0.02);
      };
      quad(q[0], q[1], b[0], b[1]);
      quad(q[2], q[3], b[2], b[3]);
      quad(q[0], q[2], b[0], b[2]);
      quad(q[1], q[3], b[1], b[3]);
      // 바닥의 창 모양 달빛
      const fl = [b[0], b[1], b[2], b[3]].map(([x, , z]) => [x, 0.02, z]);
      pos.push(...fl[0], ...fl[1], ...fl[2], ...fl[2], ...fl[1], ...fl[3]);
      for (let k = 0; k < 6; k++) col.push(mc.r, mc.g, mc.b, 0.22);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })));
  }

  // ── 촛불 불꽃 (빛 번짐 판 + 속불꽃 원뿔) ──
  const NF = flames.length;
  const flameGeo = new THREE.ConeGeometry(0.05, 0.2, 5);
  flameGeo.translate(0, 0.1, 0);
  const flameMesh = new THREE.InstancedMesh(flameGeo, new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), NF);
  scene.add(flameMesh);
  const haloPos = new Float32Array(NF * 3);
  const haloGeo = new THREE.BufferGeometry();
  haloGeo.setAttribute('position', new THREE.BufferAttribute(haloPos, 3));
  const halos = new THREE.Points(haloGeo, new THREE.PointsMaterial({ size: 0.5, map: flameTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55, fog: false }));
  halos.frustumCulled = false;
  scene.add(halos);

  // ── 박쥐: 천장 가까이 원을 그리며 난다 (몸 + 날개 둘, 날갯짓) ──
  const BATS = 7;
  const bodyGeo = new THREE.SphereGeometry(0.07, 6, 4);
  bodyGeo.scale(1.6, 0.8, 0.8);
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -0.1, 0, 0.32, 0.12, 0, 0.24, 0, 0, 0, 0.12, 0, 0.24, 0.16, 0, 0.05], 3));
  wingGeo.computeVertexNormals();
  const batMat = new THREE.MeshBasicMaterial({ color: 0x0a080c, side: THREE.DoubleSide });
  const batBody = new THREE.InstancedMesh(bodyGeo, batMat, BATS);
  const batWing = new THREE.InstancedMesh(wingGeo, batMat, BATS * 2);
  scene.add(batBody, batWing);
  const bats = Array.from({ length: BATS }, () => ({ rad: 5 + r() * 9, cx: (r() - 0.5) * 20, y: 13 + r() * 6, sp: (0.25 + r() * 0.3) * (r() < 0.5 ? -1 : 1), ph: r() * 6.3, fl: 9 + r() * 5 }));

  const m4 = new THREE.Matrix4();
  const q4 = new THREE.Quaternion();
  const s4 = new THREE.Vector3();
  const e4 = new THREE.Euler();
  let t = 0;
  let gust = 0;
  const step = (dt) => {
    // 불꽃: 일렁이다, 큰 타격이 나오면 한순간 숨죽인다
    for (let i = 0; i < NF; i++) {
      const f = flames[i];
      const w = (1 + 0.2 * Math.sin(t * 12 + f.ph) + 0.12 * Math.sin(t * 27 + f.ph * 1.7)) * (1 - gust * 0.45);
      s4.set(f.s * 2, f.s * 2 * w, f.s * 2);
      q4.setFromEuler(e4.set(0.1 * Math.sin(t * 5 + f.ph) * (1 + gust * 3), 0, 0.1 * Math.cos(t * 4 + f.ph) * (1 + gust * 3)));
      m4.compose(_v.set(f.x, f.y, f.z), q4, s4);
      flameMesh.setMatrixAt(i, m4);
      haloPos[i * 3] = f.x;
      haloPos[i * 3 + 1] = f.y + 0.1 * f.s;
      haloPos[i * 3 + 2] = f.z;
    }
    flameMesh.instanceMatrix.needsUpdate = true;
    haloGeo.attributes.position.needsUpdate = true;
    halos.material.opacity = 0.5 + 0.08 * Math.sin(t * 9) - gust * 0.2;
    // 박쥐: 큰 타격에 놀라 빠르게 흩어진다
    for (let i = 0; i < BATS; i++) {
      const b = bats[i];
      b.ph += b.sp * dt * (1 + gust * 3);
      const rad = b.rad * (1 + gust * 0.4);
      const x = b.cx + Math.cos(b.ph) * rad * 1.3;
      const z = Math.sin(b.ph) * Math.min(rad, HZ - 2.5);
      const y = b.y + Math.sin(t * 1.3 + i) * 0.6;
      const yaw = Math.atan2(-Math.cos(b.ph) * Math.sign(b.sp), -Math.sin(b.ph) * Math.sign(b.sp) * 1.3);
      m4.compose(_v.set(x, y, z), q4.setFromEuler(e4.set(0, yaw, 0)), s4.set(1, 1, 1));
      batBody.setMatrixAt(i, m4);
      const flap = Math.sin(t * b.fl * (1 + gust)) * 0.9;
      for (const s of [-1, 1]) {
        q4.setFromEuler(e4.set(s * flap, yaw, 0, 'YXZ'));
        m4.compose(_v.set(x, y, z), q4, s4.set(1, 1, s));
        batWing.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), m4);
      }
    }
    batBody.instanceMatrix.needsUpdate = true;
    batWing.instanceMatrix.needsUpdate = true;
  };
  step(0);

  return {
    sunOffset,
    /** 큰 타격: 촛불이 숨죽이듯 흔들리고, 박쥐들이 놀라 빠르게 돈다 */
    excite(amount) {
      gust = Math.min(1, gust + amount * 0.5);
    },
    update(dt) {
      t += dt;
      gust = Math.max(0, gust - dt * 0.6);
      step(dt);
    },
  };
}
