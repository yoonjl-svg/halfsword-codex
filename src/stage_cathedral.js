// ─────────────────────────────────────────────────────────────
//  배경 4: 무너진 고딕 대성당의 안
//   긴 신랑(身廊, +x 쪽 끝이 둥근 제단부)의 교차부 바닥에 원형 상감 띠를 두른 결투 자리(경기장 경계) ·
//   다발 기둥과 뾰족 아치가 이어지는 아케이드 · 높은 창의 깨진 스테인드글라스(몇 칸은 빠져 하늘이 보인다) ·
//   서쪽(−x) 정면의 장미창과 열린 정문 · 무너져 내린 궁륭 천장(갈비뼈 몇 줄만 남았다) · 쏟아지는 빛줄기와 떠도는 먼지 ·
//   쓰러진 신도석 · 돌무더기와 굴러다니는 기둥 토막 · 벽을 타고 오른 담쟁이 · 빈 제단과 촛대.
//  물리와는 무관한 그림만 만든다. 카메라가 도는 반지름(10.5m) 안에는 바닥 상감과 아주 낮은 부스러기만 둔다.
//  빛줄기·유리빛은 조명 없이 더하기 섞기(additive) 반투명 면으로 흉내 낸다 (폰에서 가볍게).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { ARENA } from './config.js';
import { rng, h3, Kit, box, cyl, limb, canvasTex } from './stage_kit.js';
import { weaponEnv } from './weapon_looks.js';

const C = {
  stone: 0xcfc7b6, // 석회암 (질감에 곱해짐)
  stoneDark: 0xa39b8b,
  floor: 0xb8b0a0,
  wood: 0x5a3e2a,
  woodDark: 0x3e2b1e,
  iron: 0x2e2c2a,
  ivy: 0x3d5a2e,
  inlay: 0x3b3532, // 바닥 상감 (검은 대리석)
  brass: 0x8f7a4e,
};
const GLASS = [0x1f3f9e, 0x2753c4, 0xb3202a, 0xd8a72a, 0x2a7d4a, 0x6a2f8f, 0x1f3f9e, 0xb3202a, 0xe6d9b0];
const TEX_AVG = 0.62;

function ashlarTexture() {
  const r = rng(22);
  return canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#827c72';
    x.fillRect(0, 0, w, h);
    const rows = 5;
    const rh = h / rows;
    for (let j = 0; j < rows; j++) {
      let u = -r() * 70;
      while (u < w) {
        const bw = 60 + r() * 60;
        const v = 200 + Math.floor(r() * 36);
        x.fillStyle = `rgb(${v},${v - 4},${v - 12})`;
        x.fillRect(u + 1.5, j * rh + 1.5, bw - 3, rh - 3);
        for (let k = 0; k < 8; k++) {
          x.fillStyle = `rgba(90,82,70,${0.04 + r() * 0.08})`;
          x.fillRect(u + 2 + r() * (bw - 12), j * rh + 2 + r() * (rh - 10), 4 + r() * 10, 2 + r() * 6);
        }
        u += bw;
      }
    }
  });
}
/** 바닥 판석: 큰 네모 돌 + 금 + 얼룩 */
function flagTexture() {
  const r = rng(23);
  return canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#6f6960';
    x.fillRect(0, 0, w, h);
    const n = 4;
    const s = w / n;
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const v = 196 + Math.floor(r() * 40);
        x.fillStyle = `rgb(${v},${v - 4},${v - 10})`;
        x.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
        for (let k = 0; k < 10; k++) {
          x.fillStyle = `rgba(80,72,62,${0.04 + r() * 0.07})`;
          x.beginPath();
          x.ellipse(i * s + r() * s, j * s + r() * s, 3 + r() * 12, 2 + r() * 7, r() * 3, 0, Math.PI * 2);
          x.fill();
        }
        if (r() < 0.35) {
          // 금
          x.strokeStyle = 'rgba(60,54,48,0.6)';
          x.lineWidth = 1;
          x.beginPath();
          let px = i * s + r() * s;
          let py = j * s + 2;
          x.moveTo(px, py);
          for (let k = 0; k < 5; k++) {
            px += (r() - 0.5) * 18;
            py += s / 5;
            x.lineTo(px, py);
          }
          x.stroke();
        }
      }
  });
}
function skyTexture() {
  const r = rng(6);
  return canvasTex(512, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#7fa3c9');
    g.addColorStop(0.35, '#b3c8dc');
    g.addColorStop(0.5, '#e4e8e6');
    g.addColorStop(1, '#cfd2cc');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      x.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.35})`;
      x.beginPath();
      x.ellipse(r() * w, h * (0.05 + r() * 0.4), 20 + r() * 70, 6 + r() * 16, 0, 0, Math.PI * 2);
      x.fill();
    }
  });
}
function dustTexture() {
  return canvasTex(32, 32, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,240,210,1)');
    g.addColorStop(1, 'rgba(255,240,210,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
  });
}

/** 뾰족 아치 곡선 한쪽 (s: 반폭, rise: 솟는 높이). 반환: 오른쪽 원의 중심 x 와 반지름, 꼭대기 각 */
function pointed(s, rise) {
  const cx = (s * s - rise * rise) / (2 * s);
  const R = s - cx;
  const th = Math.atan2(rise, -cx);
  return { cx, R, th };
}
/** 뾰족 아치 모양 경로를 shape/path 에 이어 그린다: (s, y0) 에서 시작해 꼭대기를 지나 (−s, y0) 까지 */
function arcTo(p, s, y0, rise) {
  const { cx, R, th } = pointed(s, rise);
  p.absarc(cx, y0, R, 0, th, false);
  p.absarc(-cx, y0, R, Math.PI - th, Math.PI, false);
}
/** 뾰족 창 구멍 (가운데 x0, 아래 y0, 폭 w, 어깨 높이 hs, 뾰족 높이 rise) */
function windowPath(x0, y0, w, hs, rise) {
  const p = new THREE.Path();
  p.moveTo(x0 - w / 2, y0);
  p.lineTo(x0 + w / 2, y0);
  p.lineTo(x0 + w / 2, y0 + hs);
  const { cx, R, th } = pointed(w / 2, rise);
  p.absarc(x0 + cx, y0 + hs, R, 0, th, false);
  p.absarc(x0 - cx, y0 + hs, R, Math.PI - th, Math.PI, false);
  p.lineTo(x0 - w / 2, y0);
  return p;
}
/** 점이 뾰족 창 안인가 (창 기준 좌표) */
function insideWindow(x, y, w, hs, rise) {
  if (y < 0 || Math.abs(x) > w / 2) return false;
  if (y <= hs) return true;
  const { cx, R } = pointed(w / 2, rise);
  return Math.hypot(Math.abs(x) + cx, y - hs) <= R && y <= hs + rise;
}

/** 스테인드글라스: 창 모양 안을 작은 칸으로 채우고 칸마다 보석 색. broken: 빠진 칸 비율 */
function glassGeo(w, hs, rise, r, broken, cell = 0.3) {
  const pos = [];
  const col = [];
  const tmp = new THREE.Color();
  const gap = 0.035;
  // 가운데 세로줄을 기준으로 좌우 대칭 무늬 (색 번호를 |열| 과 행으로 정한다)
  const pal = GLASS.map((c) => new THREE.Color(c));
  const nx = Math.ceil(w / cell);
  const ny = Math.ceil((hs + rise) / cell);
  const seedA = Math.floor(r() * 7);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const x0 = -w / 2 + i * cell;
      const y0 = j * cell;
      const xc = x0 + cell / 2;
      const yc = y0 + cell / 2;
      if (!insideWindow(xc, yc, w, hs, rise)) continue;
      if (r() < broken * (0.4 + (j / ny) * 1.2)) continue; // 위쪽이 더 많이 깨졌다
      const sym = Math.abs(i - (nx - 1) / 2);
      const band = Math.floor(j / 3);
      const k = (Math.floor(sym) * 3 + band * 5 + seedA + (band % 2 ? 2 : 0)) % pal.length;
      tmp.copy(pal[k]).multiplyScalar(0.85 + r() * 0.3);
      const a = [x0 + gap, y0 + gap, 0];
      const b = [x0 + cell - gap, y0 + gap, 0];
      const c = [x0 + gap, y0 + cell - gap, 0];
      const d = [x0 + cell - gap, y0 + cell - gap, 0];
      pos.push(...a, ...b, ...c, ...c, ...b, ...d);
      for (let q = 0; q < 6; q++) col.push(tmp.r, tmp.g, tmp.b);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
/** 장미창: 동심원 고리를 부채꼴 칸으로 나눠 대칭으로 칠한다 */
function roseGeo(R, r) {
  const pos = [];
  const col = [];
  const pal = GLASS.map((c) => new THREE.Color(c));
  const tmp = new THREE.Color();
  const rings = [0.5, 1.15, 1.9, 2.6, 3.3, 4.0, R];
  for (let k = 0; k < rings.length - 1; k++) {
    const r0 = rings[k] + 0.05;
    const r1 = rings[k + 1] - 0.05;
    const nseg = k === 0 ? 8 : 12 * (k < 3 ? 1 : 2);
    for (let i = 0; i < nseg; i++) {
      if (k > 3 && r() < 0.18) continue; // 바깥 고리 몇 칸은 깨졌다
      const a0 = (i / nseg) * Math.PI * 2 + 0.03;
      const a1 = ((i + 1) / nseg) * Math.PI * 2 - 0.03;
      const ci = (k * 3 + (i % (k === 0 ? 2 : 3))) % pal.length;
      tmp.copy(pal[ci]).multiplyScalar(0.9 + r() * 0.2);
      const steps = 3;
      for (let s = 0; s < steps; s++) {
        const b0 = a0 + ((a1 - a0) * s) / steps;
        const b1 = a0 + ((a1 - a0) * (s + 1)) / steps;
        const p = (rr, a) => [Math.cos(a) * rr, Math.sin(a) * rr, 0];
        pos.push(...p(r0, b0), ...p(r0, b1), ...p(r1, b0), ...p(r1, b0), ...p(r0, b1), ...p(r1, b1));
        for (let q = 0; q < 6; q++) col.push(tmp.r, tmp.g, tmp.b);
      }
    }
  }
  // 가운데 금빛 원
  const cc = new THREE.Color(0xe0b64a);
  for (let i = 0; i < 12; i++) {
    const a0 = (i / 12) * Math.PI * 2;
    const a1 = ((i + 1) / 12) * Math.PI * 2;
    pos.push(0, 0, 0, Math.cos(a0) * 0.45, Math.sin(a0) * 0.45, 0, Math.cos(a1) * 0.45, Math.sin(a1) * 0.45, 0);
    for (let q = 0; q < 3; q++) col.push(cc.r, cc.g, cc.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

/**
 * 대성당 경기장을 만든다. 반환: { update(dt), excite(amount), sunOffset }
 *  lights: main.js 의 { hemi, sun } — 어둑한 실내빛으로 바꾼다 (해는 무너진 천장으로 든다)
 */
export function buildCathedral(scene, lights = {}) {
  const r = rng(1163);
  const K = new Kit(515);
  const FOG = 0x8f887d;
  const sunOffset = { x: -3, y: 9, z: 2.2 };
  scene.background = new THREE.Color(FOG);
  scene.fog = new THREE.Fog(FOG, 28, 190);
  if (lights.hemi) {
    lights.hemi.color.set(0xc3c8d2);
    lights.hemi.groundColor.set(0x5e5448);
    lights.hemi.intensity = 0.8;
  }
  if (lights.sun) {
    lights.sun.color.set(0xfff0d6);
    lights.sun.intensity = 1.25;
    lights.sun.position.set(sunOffset.x, sunOffset.y, sunOffset.z);
  }
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, depthWrite: false, map: skyTexture() })));

  // ── 크기 ──
  const NZ = 12.5; // 아케이드 벽(기둥 줄) 위치 ±z
  const AZ = 21; // 옆 복도 바깥벽 ±z
  const WX = -44; // 서쪽 정면
  const EX = 22; // 제단부(반원) 중심 x
  const BAY = 6.5;
  const PX = []; // 기둥 x
  for (let x = WX + 5; x <= EX + 0.01; x += BAY) PX.push(x);
  const TOP = 24; // 아케이드 벽 윗면
  const SPRING = 8.2; // 아치 어깨
  const APEX = 13.2; // 아치 꼭대기
  const st = { uv: 'box', uvScale: 0.26, vary: 0.07, noise: 0.05 };

  // ── 바닥: 판석 + 결투 자리 상감 ──
  {
    const x0 = WX - 1;
    const x1 = EX + 14;
    const z0 = -AZ - 1;
    const z1 = AZ + 1;
    const nx = Math.round((x1 - x0) / 1.5);
    const nz = Math.round((z1 - z0) / 1.5);
    const pos = [];
    const uv = [];
    const col = [];
    const tmp = new THREE.Color();
    for (let j = 0; j <= nz; j++)
      for (let i = 0; i <= nx; i++) {
        const x = x0 + ((x1 - x0) * i) / nx;
        const z = z0 + ((z1 - z0) * j) / nz;
        pos.push(x, 0, z);
        uv.push(x / 4, z / 4);
        tmp.set(C.floor);
        // 옆 복도와 벽 밑은 어둡고, 무너진 천장 밑 신랑 가운데는 밝다
        let k = Math.abs(z) > NZ ? 0.72 : 1 - 0.18 * THREE.MathUtils.smoothstep(Math.abs(z), 7, NZ);
        k *= 0.9 + 0.2 * h3(Math.round(x * 0.25), 0, Math.round(z * 0.25), 3);
        // 이끼·물 얼룩
        const m = h3(x * 0.13, 1, z * 0.13, 5);
        if (m > 0.72) tmp.lerp(new THREE.Color(0x6d7458), (m - 0.72) * 1.6);
        col.push((tmp.r * k) / TEX_AVG, (tmp.g * k) / TEX_AVG, (tmp.b * k) / TEX_AVG);
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
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const floor = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: flagTexture(), vertexColors: true, roughness: 0.85 }));
    floor.receiveShadow = true;
    scene.add(floor);
    // 상감: 검은 대리석 고리 + 가는 놋쇠 선 + 고리를 나누는 마디
    const R0 = ARENA.radius;
    const ring = (a, b, c, y, seg = 96) => K.put('inlay', new THREE.RingGeometry(a, b, seg, 1), c, [0, y, 0], [-Math.PI / 2, 0, 0], 1, { vary: 0, noise: 0.08 });
    ring(R0 + 0.05, R0 + 0.6, C.inlay, 0.006);
    ring(R0 + 0.72, R0 + 0.8, C.brass, 0.006);
    ring(R0 - 0.2, R0 - 0.13, C.brass, 0.006);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      K.put('inlay', box(0.56, 0.004, 0.05), C.brass, [Math.cos(a) * (R0 + 0.33), 0.009, Math.sin(a) * (R0 + 0.33)], [0, -a, 0], 1, { vary: 0 });
    }
    // 가운데 팔각 별 무늬
    ring(0.9, 1.05, C.brass, 0.006, 8);
    ring(1.8, 1.92, C.inlay, 0.006, 8);
  }

  // ── 기둥 (다발 기둥: 굵은 몸 + 네 가닥 가는 기둥) ──
  const pier = (x, z, h, nave = 0) => {
    K.put('stone', new THREE.CylinderGeometry(0.85, 0.85, h, 14), C.stone, [x, h / 2, z], [0, 0, 0], 1, st);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      K.put('stone', new THREE.CylinderGeometry(0.26, 0.26, h, 8), C.stone, [x + Math.cos(a) * 0.82, h / 2, z + Math.sin(a) * 0.82], [0, 0, 0], 1, st);
    }
    K.put('stone', new THREE.CylinderGeometry(1.35, 1.35, 0.5, 8), C.stoneDark, [x, 0.25, z], [0, Math.PI / 8, 0], 1, st); // 받침
    K.put('stone', new THREE.CylinderGeometry(1.3, 1.0, 0.55, 8), C.stoneDark, [x, h + 0.27, z], [0, Math.PI / 8, 0], 1, st); // 주두
    if (nave) K.put('stone', new THREE.CylinderGeometry(0.3, 0.3, TOP - h, 8), C.stone, [x, h + (TOP - h) / 2, z - nave * 0.75], [0, 0, 0], 1, st); // 궁륭을 받치던 가는 기둥
  };

  // ── 아케이드 벽: 기둥 사이 뾰족 아치 + 위쪽 높은 창. 몇 칸은 위가 무너져 들쭉날쭉하다 ──
  const glassBins = [];
  const addGlass = (g, x, y, z, rotY, lit = 1) => glassBins.push({ g, x, y, z, rotY, lit });
  const bays = [];
  for (let i = 0; i < PX.length - 1; i++) bays.push([PX[i], PX[i + 1]]);
  for (const side of [-1, 1]) {
    const z = side * NZ;
    for (let b = 0; b < bays.length; b++) {
      const [xa, xb] = bays[b];
      const w = xb - xa;
      const xm = (xa + xb) / 2;
      const broken = r() < 0.4;
      const sh = new THREE.Shape();
      const s = w / 2 - 0.85;
      sh.moveTo(-w / 2, 0);
      if (broken) {
        // 들쭉날쭉 무너진 윗선
        const n = 7;
        sh.lineTo(-w / 2, TOP - 3 - r() * 5);
        for (let k = 1; k < n; k++) sh.lineTo(-w / 2 + (w * k) / n, 15.2 + r() * 6);
        sh.lineTo(w / 2, TOP - 3 - r() * 5);
      } else {
        sh.lineTo(-w / 2, TOP);
        sh.lineTo(w / 2, TOP);
      }
      sh.lineTo(w / 2, 0);
      sh.lineTo(s, 0);
      sh.lineTo(s, SPRING);
      arcTo(sh, s, SPRING, APEX - SPRING);
      sh.lineTo(-s, 0);
      sh.lineTo(-w / 2, 0);
      if (!broken) sh.holes.push(windowPath(0, 16.2, 2.4, 4.2, 2.2));
      const g = new THREE.ExtrudeGeometry(sh, { depth: 1.2, bevelEnabled: false, curveSegments: 8 });
      g.translate(0, 0, -0.6);
      K.put('stone', g, C.stone, [xm, 0, z], [0, 0, 0], 1, st);
      if (!broken) addGlass(glassGeo(2.4, 4.2, 2.2, r, 0.25), xm, 16.2, z, side > 0 ? Math.PI : 0);
      // 아치 테두리 돌림띠
      K.put('stone', box(w, 0.35, 1.5), C.stoneDark, [xm, 14.6, z], [0, 0, 0], 1, st);
      bays[b].broken = bays[b].broken || broken;
      // 무너진 칸 밑에는 돌무더기
      if (broken)
        for (let k = 0; k < 9; k++) {
          const sz = 0.3 + r() * 0.9;
          const x = xm + (r() - 0.5) * w;
          const zz = z - side * (1.2 + r() * 2.6);
          if (Math.hypot(x, zz) < 11.6) continue;
          K.put('stone', box(sz * 1.3, sz * 0.8, sz), C.stone, [x, sz * 0.3, zz], [r(), r() * 3, r()], 1, { ...st, rough: 0.08 * sz });
        }
    }
    for (const x of PX) pier(x, z, SPRING, side);
  }

  // ── 옆 복도 바깥벽: 칸마다 스테인드글라스 긴 창 ──
  for (const side of [-1, 1]) {
    const z = side * AZ;
    for (const [xa, xb] of bays) {
      const w = xb - xa;
      const xm = (xa + xb) / 2;
      const sh = new THREE.Shape();
      sh.moveTo(-w / 2, 0);
      sh.lineTo(w / 2, 0);
      sh.lineTo(w / 2, 12.5);
      sh.lineTo(-w / 2, 12.5);
      sh.lineTo(-w / 2, 0);
      sh.holes.push(windowPath(0, 2.6, 2.6, 5.4, 2.4));
      const g = new THREE.ExtrudeGeometry(sh, { depth: 1.1, bevelEnabled: false, curveSegments: 8 });
      g.translate(0, 0, -0.55);
      K.put('stone', g, C.stone, [xm, 0, z], [0, 0, 0], 1, st);
      addGlass(glassGeo(2.6, 5.4, 2.4, r, 0.12), xm, 2.6, z, side > 0 ? Math.PI : 0, 0.8);
      // 버팀벽 (바깥쪽) 과 벽기둥 (안쪽)
      K.put('stone', box(0.9, 12.5, 0.6), C.stone, [xa, 6.25, z - side * 0.8], [0, 0, 0], 1, st);
    }
    // 옆 복도 지붕: 돌판 경사 지붕, 군데군데 빠져 빛이 든다
    for (const [xa, xb] of bays) {
      if (r() < 0.35) continue;
      const w = xb - xa;
      const dz = AZ - NZ;
      const ang = Math.atan2(15.5 - 12.5, dz);
      K.put('stone', box(w, 0.35, Math.hypot(dz, 3) + 0.4), C.stoneDark, [(xa + xb) / 2, 14.1, side * (NZ + dz / 2)], [side * ang, 0, 0], 1, { ...st, vary: 0.12 });
    }
    // 복도 동쪽 끝 막음벽
    K.put('stone', box(1.2, 12.5, AZ - NZ), C.stone, [EX + 0.6, 6.25, side * (NZ + AZ) / 2], [0, 0, 0], 1, st);
  }

  // ── 양 끝의 막힌 벽 조각 (정면~첫 기둥, 마지막 기둥~제단부) ──
  for (const side of [-1, 1]) {
    for (const [xa, xb] of [
      [WX, PX[0]],
      [PX[PX.length - 1], EX + 0.3],
    ]) {
      K.put('stone', box(xb - xa, TOP, 1.2, 2, 6, 1), C.stone, [(xa + xb) / 2, TOP / 2, side * NZ], [0, 0, 0], 1, st);
      K.put('stone', box(xb - xa, 12.5, 1.1, 2, 3, 1), C.stone, [(xa + xb) / 2, 6.25, side * AZ], [0, 0, 0], 1, st);
    }
  }

  // ── 서쪽 정면: 장미창 + 열린 정문 (밖의 햇빛이 환하다) ──
  {
    const W2 = AZ + 1;
    const sh = new THREE.Shape();
    sh.moveTo(W2, 0);
    sh.lineTo(3, 0);
    sh.lineTo(3, 6.5);
    arcTo(sh, 3, 6.5, 4.2); // 정문: 오른쪽 어깨에서 꼭대기를 지나 왼쪽 어깨로
    sh.lineTo(-3, 0);
    sh.lineTo(-W2, 0);
    sh.lineTo(-W2, 28);
    sh.lineTo(0, 37);
    sh.lineTo(W2, 28);
    sh.lineTo(W2, 0);
    const rose = new THREE.Path();
    rose.absarc(0, 20.5, 4.6, 0, Math.PI * 2, false);
    sh.holes.push(rose);
    sh.holes.push(windowPath(-12, 6, 2.2, 6, 2));
    sh.holes.push(windowPath(12, 6, 2.2, 6, 2));
    const g = new THREE.ExtrudeGeometry(sh, { depth: 1.6, bevelEnabled: false, curveSegments: 16 });
    g.translate(0, 0, -0.8);
    K.put('stone', g, C.stone, [WX, 0, 0], [0, Math.PI / 2, 0], 1, st);
    const rg = roseGeo(4.6, r);
    addGlass(rg, WX + 0.1, 20.5, 0, Math.PI / 2);
    K.put('stone', new THREE.TorusGeometry(4.75, 0.3, 6, 32), C.stoneDark, [WX + 0.8, 20.5, 0], [0, Math.PI / 2, 0], 1, st);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      K.put('stone', box(0.2, 4.1, 0.18), C.stoneDark, [WX + 0.75, 20.5 + Math.sin(a) * 2.5, Math.cos(a) * 2.5], [a, 0, 0], 1, st); // 장미창 살
    }
    for (const zz of [-12, 12]) addGlass(glassGeo(2.2, 6, 2, r, 0.2), WX + 0.1, 6, zz, Math.PI / 2, 0.8);
    // 열린 문 너머의 환한 바깥
    const door = new THREE.Shape();
    door.moveTo(-3, 0);
    door.lineTo(3, 0);
    door.lineTo(3, 6.5);
    const { cx, R, th } = pointed(3, 4.2);
    door.absarc(cx, 6.5, R, 0, th, false);
    door.absarc(-cx, 6.5, R, Math.PI - th, Math.PI, false);
    door.lineTo(-3, 0);
    K.put('glow', new THREE.ShapeGeometry(door, 10), 0xe9e6dc, [WX - 1.2, 0, 0], [0, Math.PI / 2, 0]);
    // 문 한 짝은 떨어져 기울어 있다
    K.put('wood', box(0.2, 7, 2.9), C.woodDark, [WX + 1.6, 3.2, -1.6], [0.1, 0.3, -0.35], 1, { vary: 0.1 });
  }

  // ── 동쪽 제단부: 반원으로 도는 벽, 칸마다 긴 창 ──
  {
    const R = NZ + 0.2;
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + ((i + 0.5) * Math.PI) / n;
      const w = 2 * R * Math.sin(Math.PI / (2 * n)) + 0.3;
      const sh = new THREE.Shape();
      sh.moveTo(-w / 2, 0);
      sh.lineTo(w / 2, 0);
      sh.lineTo(w / 2, TOP - (i === 5 ? 7 : 0));
      sh.lineTo(-w / 2, TOP);
      sh.lineTo(-w / 2, 0);
      sh.holes.push(windowPath(0, 4.5, 2.0, 9, 2.2));
      const g = new THREE.ExtrudeGeometry(sh, { depth: 1.2, bevelEnabled: false, curveSegments: 8 });
      g.translate(0, 0, -0.6);
      const x = EX + Math.cos(a) * R;
      const z = Math.sin(a) * R;
      K.put('stone', g, C.stone, [x, 0, z], [0, Math.PI / 2 - a, 0], 1, st);
      addGlass(glassGeo(2.0, 9, 2.2, r, i === 5 ? 0.5 : 0.15, 0.28), x, 4.5, z, Math.PI / 2 - a + Math.PI, 1);
      pier(EX + Math.cos(a + Math.PI / (2 * n)) * (R - 0.9), Math.sin(a + Math.PI / (2 * n)) * (R - 0.9), SPRING + 3);
    }
    // 제단: 두 단 위의 돌 제단, 촛대
    K.put('stone', box(6, 0.3, 8), C.stoneDark, [EX + 5, 0.15, 0], [0, 0, 0], 1, st);
    K.put('stone', box(4.5, 0.3, 6), C.stoneDark, [EX + 5.4, 0.45, 0], [0, 0, 0], 1, st);
    K.put('stone', box(1.6, 1.1, 3.4), C.stone, [EX + 5.8, 1.15, 0], [0, 0, 0], 1, st);
    K.put('stone', box(1.8, 0.15, 3.6), C.stoneDark, [EX + 5.8, 1.77, 0], [0, 0, 0], 1, st);
    for (const zz of [-1.2, 1.2]) {
      K.put('iron', cyl(0.05, 0.12, 0.6, 8), C.brass, [EX + 5.8, 2.15, zz]);
      K.put('candle', cyl(0.05, 0.05, 0.3, 8), 0xefe6cf, [EX + 5.8, 2.6, zz]);
    }
    for (const zz of [-3.6, 3.6]) {
      K.put('iron', cyl(0.06, 0.2, 1.8, 8), C.iron, [EX + 4, 0.9, zz]);
      K.put('candle', cyl(0.07, 0.07, 0.4, 8), 0xefe6cf, [EX + 4, 2.0, zz]);
    }
  }

  // ── 남은 궁륭 갈비뼈 (아케이드 벽 위를 가로지르는 뾰족 아치). 하나는 반만 남았다 ──
  const rib = (x, frac = 1) => {
    const { cx, R, th } = pointed(NZ, 10);
    const pts = [];
    const n = 16;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      if (u > frac + 1e-6) break;
      // 왼쪽 어깨(−NZ) → 꼭대기 → 오른쪽 어깨(+NZ)
      const p = u <= 0.5 ? [-cx + R * Math.cos(Math.PI - 2 * u * th), R * Math.sin(Math.PI - 2 * u * th)] : [cx + R * Math.cos((1 - u) * 2 * th), R * Math.sin((1 - u) * 2 * th)];
      pts.push(new THREE.Vector3(x, TOP + p[1], p[0]));
    }
    if (pts.length < 2) return;
    K.put('stone', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, 0.38, 6, false), C.stone, [0, 0, 0], [0, 0, 0], 1, { vary: 0.05 });
  };
  rib(PX[3]);
  rib(PX[6], 0.55);
  rib(PX[9]);
  // 궁륭 조각: 아케이드 벽 윗면에 걸쳐 안쪽으로 비스듬히 솟은 채 남은 돌 판 몇 장 (온전한 칸 위에만)
  for (let i = 0; i < 6; i++) {
    const b = bays[1 + Math.floor(r() * (bays.length - 2))];
    const side = i % 2 ? -1 : 1;
    if (b.broken) continue;
    const x = (b[0] + b[1]) / 2 + (r() - 0.5) * 2;
    K.put('stone', box(2.6 + r() * 1.5, 0.4, 2.6), C.stoneDark, [x, TOP + 0.55, side * (NZ - 0.9)], [side * 0.4, r() * 0.2, 0], 1, { ...st, rough: 0.15 });
  }

  // ── 바닥의 잔해: 떨어진 갈비뼈 토막, 기둥 토막, 궁륭 덩어리 (결투 자리 밖) ──
  const debris = [
    [-17, -6, 1.3],
    [-15.5, 7.5, 0.9],
    [15, -8.5, 1.1],
    [13, 9.5, 0.8],
    [2, -13.5, 0.7],
    [-4, 14, 0.9],
  ];
  for (const [x, z, s] of debris) {
    for (let k = 0; k < 7; k++) {
      const sz = s * (0.3 + r() * 0.7);
      const xx = x + (r() - 0.5) * 3 * s;
      const zz = z + (r() - 0.5) * 3 * s;
      if (Math.hypot(xx, zz) < 11.6) continue;
      K.put('stone', box(sz * 1.4, sz * 0.7, sz), C.stone, [xx, sz * 0.25, zz], [r(), r() * 3, r() * 0.5], 1, { ...st, rough: 0.07 * sz });
    }
  }
  // 쓰러진 기둥 토막
  for (const [x, z, a] of [
    [-19, 3, 0.4],
    [16.5, 3.5, -0.9],
  ]) {
    for (let k = 0; k < 3; k++)
      K.put('stone', new THREE.CylinderGeometry(0.85, 0.85, 1.1, 14), C.stone, [x + Math.cos(a) * k * 1.25, 0.82, z + Math.sin(a) * k * 1.25], [0, -a, Math.PI / 2 + (r() - 0.5) * 0.1], 1, { ...st, rough: 0.05 });
  }
  // 떨어진 갈비뼈 토막 (바닥에 누운 굽은 돌)
  for (const [x, z, a] of [
    [-12, -10.5, 0.3],
    [9, 12, 2.4],
  ]) {
    const pts = [];
    for (let i = 0; i <= 6; i++) pts.push(new THREE.Vector3(x + Math.cos(a) * i * 0.7, 0.35 + Math.sin(i * 0.5) * 0.9, z + Math.sin(a) * i * 0.7));
    K.put('stone', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.36, 6, false), C.stone, [0, 0, 0], [0, 0, 0], 1, { vary: 0.05 });
  }
  // 결투 자리 둘레(반지름 7.5~11)의 낮은 부스러기 (카메라 높이보다 한참 낮다)
  for (let i = 0; i < 40; i++) {
    const a = r() * Math.PI * 2;
    const d = 7.8 + r() * 3;
    const sz = 0.06 + r() * 0.16;
    K.put('stone', box(sz * 1.4, sz * 0.6, sz), C.stone, [Math.cos(a) * d, sz * 0.2, Math.sin(a) * d], [r(), r() * 3, r()], 1, { ...st, rough: 0.03 });
  }

  // ── 신도석: 서쪽 신랑에 줄지어 있고, 몇 개는 넘어지거나 없다 ──
  const pew = (x, z, L, rotY, fallen) => {
    K.push([x, 0, z], rotY);
    if (fallen) {
      K.put('wood', box(0.45, 0.06, L), C.wood, [0, 0.3, 0], [0, 0, Math.PI / 2 - 0.15], 1, { vary: 0.12 });
      K.put('wood', box(0.06, 0.5, L), C.wood, [-0.25, 0.05, 0], [0, 0, Math.PI / 2], 1, { vary: 0.12 });
      for (const s of [-1, 1]) K.put('wood', box(0.5, 0.06, 0.08), C.woodDark, [0.1, 0.06, (s * L) / 2.2]);
    } else {
      K.put('wood', box(0.45, 0.06, L), C.wood, [0, 0.45, 0], [0, 0, 0], 1, { vary: 0.12 });
      K.put('wood', box(0.06, 0.55, L), C.wood, [0.22, 0.78, 0], [0, 0, 0], 1, { vary: 0.12 });
      for (const s of [-1, 0, 1]) K.put('wood', box(0.42, 0.45, 0.07), C.woodDark, [0, 0.22, (s * (L - 0.2)) / 2]);
    }
    K.pop();
  };
  for (let x = WX + 3; x < -22; x += 1.25)
    for (const zc of [-5.2, 5.2]) {
      const q = r();
      if (q < 0.12) continue;
      pew(x + (r() - 0.5) * 0.25, zc + (r() - 0.5) * 0.4, 6.4, (r() - 0.5) * (q < 0.35 ? 0.5 : 0.08), q < 0.3);
    }

  // ── 담쟁이: 무너진 벽 윗선과 창틀, 기둥 밑동 ──
  //  (창 구멍·아치 구멍에 떠 있지 않게: 복도 바깥벽은 창 옆 벽면에, 아케이드 벽은 아치 위쪽 벽면에만)
  for (let i = 0; i < 60; i++) {
    const side = r() < 0.5 ? -1 : 1;
    const onOuter = r() < 0.45;
    const b = bays[Math.floor(r() * bays.length)];
    const x = onOuter ? b[0] + (r() < 0.5 ? 0.4 + r() * 1.3 : b[1] - b[0] - 0.4 - r() * 1.3) : b[0] + 0.5 + r() * (b[1] - b[0] - 1);
    const z = side * (onOuter ? AZ - 0.7 : NZ - 0.7);
    const y = onOuter ? 0.8 + r() * 11 : 14.4 + r() * (b.broken ? 0.6 : 7);
    const s = 0.5 + r() * 0.9;
    K.put('ivy', new THREE.IcosahedronGeometry(1, 1), C.ivy, [x, y, z - side * 0.1], [0, r() * 3, 0], [s, s * 1.4, s * 0.35], { vary: 0.25, noise: 0.2, rough: 0.2 * s });
  }
  for (let i = 0; i < 50; i++) {
    const a = r() * Math.PI * 2;
    const d = 12 + r() * 9;
    const x = Math.cos(a) * d * 1.3 - 6;
    const z = Math.sin(a) * Math.min(d, AZ - 1);
    if (x < WX + 1 || x > EX + 10) continue;
    K.put('ivy', new THREE.ConeGeometry(0.18, 0.35, 4), 0x56703a, [x, 0.15, z], [0, r() * 3, 0], 1, { vary: 0.3 }); // 판석 틈 풀
  }

  // ── 북쪽(+z) 한쪽을 뒤덮은 담쟁이와 장미 덩굴 ──
  //  가는 줄기를 벽을 따라 구불구불 올리고(또는 무너진 윗선에서 늘어뜨리고), 줄기를 따라
  //  잎(인스턴싱 마름모)과 장미(인스턴싱 꽃송이)를 단다. 기둥에는 나선으로 감아 오른다.
  {
    const vr = rng(404);
    const LEAF = [0x2f4a24, 0x3a5a2a, 0x46662f, 0x2a4020, 0x557236];
    const ROSE = [0x9e1624, 0xb01a2a, 0x8a1020, 0xa3172a, 0x7a0e1a]; // 붉은 장미 한 가지 (짙기만 조금씩 다르게)
    const leaves = [];
    const roses = [];
    const Z = new THREE.Vector3(0, 0, 1);
    const tq = new THREE.Quaternion();
    const tq2 = new THREE.Quaternion();
    const te = new THREE.Euler();
    const tc = new THREE.Color();
    const leaf = (p, nrm, dark) => {
      tq.setFromUnitVectors(Z, nrm).multiply(tq2.setFromEuler(te.set((vr() - 0.5) * 1.0, (vr() - 0.5) * 1.0, vr() * 6.28)));
      const s = 1.4 + vr() * 1.1;
      leaves.push([new THREE.Matrix4().compose(p.clone(), tq.clone(), new THREE.Vector3(s, s, s)), tc.set(LEAF[Math.floor(vr() * LEAF.length)]).multiplyScalar(dark * (0.85 + vr() * 0.3)).clone()]);
    };
    const rose = (p, dark) => {
      const s = 1.2 + vr() * 0.8;
      tq.setFromEuler(te.set(vr() * 6, vr() * 6, vr() * 6));
      roses.push([new THREE.Matrix4().compose(p.clone(), tq.clone(), new THREE.Vector3(s, s * 0.8, s)), tc.set(ROSE[Math.floor(vr() * ROSE.length)]).multiplyScalar(dark).clone()]);
    };
    /** 덩굴 한 가닥: start 에서 dir 쪽으로 자라며 옆(side)으로 구불거린다. nrm: 벽에서 방 쪽으로 향한 방향 */
    const vine = (start, dir, side, nrm, len, hasRoses, dark, branch = true) => {
      const p = start.clone();
      let wob = vr() * 6;
      let prev = p.clone();
      const n = Math.floor(len / 0.2);
      for (let i = 1; i <= n; i++) {
        wob += (vr() - 0.5) * 0.9;
        p.addScaledVector(dir, 0.2).addScaledVector(side, Math.sin(wob) * 0.12);
        if (i % 2 === 0) {
          limb(K, 'vine', prev.toArray(), p.toArray(), 0.022, 0.018, 0x4a3a26, { vary: 0.2 }, 4);
          prev = p.clone();
        }
        // 아래쪽일수록 잎이 무성하다
        const lush = 3 + Math.round(3 * (1 - i / n));
        for (let k = 0; k < lush; k++) leaf(p.clone().addScaledVector(side, (vr() - 0.5) * (0.5 + 0.5 * (1 - i / n))).addScaledVector(dir, (vr() - 0.5) * 0.25).addScaledVector(nrm, 0.02 + vr() * 0.12), nrm, dark);
        if (hasRoses && vr() < 0.28) rose(p.clone().addScaledVector(side, (vr() - 0.5) * 0.4).addScaledVector(nrm, 0.08 + vr() * 0.06), dark);
        if (branch && vr() < 0.05) vine(p.clone(), dir.clone().addScaledVector(side, vr() < 0.5 ? -1.2 : 1.2).normalize(), side, nrm, 0.8 + vr() * 1.6, hasRoses, dark, false);
      }
    };
    const up = new THREE.Vector3(0, 1, 0);
    const down = new THREE.Vector3(0, -1, 0);
    const sideX = new THREE.Vector3(1, 0, 0);
    const toRoom = new THREE.Vector3(0, 0, -1);
    // 덩굴은 북서쪽 구석(서쪽 정면 × 북쪽 옆 복도)에 몰려 있다: 구석에서 멀어질수록 성기다가 x = ZE 쯤에서 끊긴다
    const ZE = -16;
    const wX = (x) => THREE.MathUtils.clamp((ZE - x) / (ZE - WX), 0, 1);
    const toEast = new THREE.Vector3(1, 0, 0);
    const sideZ = new THREE.Vector3(0, 0, 1);
    // 옆 복도 바깥벽(+z) 안쪽 면: 바닥에서 타고 오른다
    for (let x = WX + 1; x < ZE + 4; ) {
      const w = wX(x);
      if (w > 0 || vr() < 0.35) vine(new THREE.Vector3(x, 0.05, AZ - 0.6), up, sideX, toRoom, 2 + w * 10.5 + vr() * 2, vr() < 0.3 + 0.45 * w, 0.72);
      x += 0.45 + (1 - w) * 2.6 + vr() * 0.5;
    }
    // 서쪽 정면 안쪽 면(북쪽 절반): 구석으로 갈수록 높이 덮는다
    for (let z = 3.8; z < AZ - 0.8; ) {
      const w = THREE.MathUtils.clamp((z - 3) / (AZ - 5), 0, 1);
      vine(new THREE.Vector3(WX + 0.85, 0.05, z), up, sideZ, toEast, 2.5 + w * 11 + vr() * 2, vr() < 0.35 + 0.4 * w, 0.8);
      z += 0.45 + (1 - w) * 1.6 + vr() * 0.5;
    }
    // 구석의 장미 덤불: 두 벽을 따라 겹겹이
    const bush = (x, bz, s) => {
      K.put('ivy', new THREE.SphereGeometry(1, 7, 5), 0x2c4422, [x, s * 0.45, bz], [0, vr() * 3, 0], [s * 1.3, s, s * 1.1], { vary: 0.2, noise: 0.2, rough: 0.12 });
      for (let k = 0; k < 12; k++) {
        // 덤불(타원체) 겉면 위에 꽃을 얹는다
        const a = vr() * 6.28;
        const h = 0.2 + vr() * 0.75;
        const k2 = Math.sqrt(1 - h * h) + 0.08;
        rose(new THREE.Vector3(x + Math.cos(a) * s * 1.3 * k2, s * 0.45 + h * s + 0.04, bz + Math.sin(a) * s * 1.1 * k2), 0.85);
      }
    };
    for (let x = WX + 1.6; x < ZE; x += 0.9 + (1 - wX(x)) * 2.2 + vr() * 0.6) bush(x, AZ - 1.1 - vr() * 0.5, 0.5 + wX(x) * 0.5 + vr() * 0.25);
    for (let z = 6; z < AZ - 1.5; z += 1.0 + vr() * 0.8) bush(WX + 1.5 + vr() * 0.4, z, 0.5 + vr() * 0.35);
    // 아케이드 벽(+z) 신랑 쪽 면: 구석 쪽 칸의 무너진 윗선에서 늘어진 덩굴
    for (const [xa, xb] of bays) {
      const w = wX((xa + xb) / 2);
      if (w <= 0) continue;
      const n = 1 + Math.round(w * 4);
      for (let k = 0; k < n; k++) {
        const x = xa + 0.8 + vr() * (xb - xa - 1.6);
        vine(new THREE.Vector3(x, 15 + vr() * 5, NZ - 0.66), down, sideX, toRoom, 2 + w * 6 + vr() * 2, vr() < 0.5, 1);
      }
    }
    // 구석 쪽 기둥을 감아 오르는 덩굴: 도는 빠르기·오르는 빠르기가 들쭉날쭉하고, 가다가 방향을 틀기도 한다
    for (const px of PX) {
      const w = wX(px);
      if (w <= 0.1) continue;
      const strands = w > 0.6 ? 2 : 1;
      for (let sN = 0; sN < strands; sN++) {
        let a = vr() * 6.28;
        let y = 0.15 + sN * vr() * 2;
        let turn = vr() < 0.5 ? -1 : 1;
        const top = y + 1.5 + w * 6 * (0.5 + vr() * 0.5);
        let prev = null;
        let i = 0;
        while (y < top) {
          a += turn * (0.04 + vr() * 0.34);
          y += 0.03 + vr() * 0.14;
          if (vr() < 0.05) turn = -turn;
          const nrm = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
          const p = new THREE.Vector3(px, y, NZ).addScaledVector(nrm, 1.12 + (vr() - 0.5) * 0.08);
          if (prev && i % 2 === 0) limb(K, 'vine', prev.toArray(), p.toArray(), 0.022, 0.02, 0x4a3a26, { vary: 0.2 }, 4);
          if (i % 2 === 0) prev = p.clone();
          const lush = vr() < 0.15 ? 7 : 2 + Math.floor(vr() * 3); // 가끔 잎이 뭉쳐 있다
          for (let k = 0; k < lush; k++) leaf(p.clone().add(new THREE.Vector3((vr() - 0.5) * 0.35, (vr() - 0.5) * 0.25, (vr() - 0.5) * 0.35)).addScaledVector(nrm, 0.05), nrm, 0.95);
          if (vr() < 0.12 * w) rose(p.clone().addScaledVector(nrm, 0.1), 0.95);
          i++;
        }
      }
    }
    // ── 오래 안치된 유해와 바닥에 꽂힌 칼 (장미 구석, 북쪽 옆 복도) ──
    //  낮은 돌 관대 위에 누운 백골: 두 손을 가슴에 모았고, 바랜 천이 다리를 덮었다. 머리맡에는 녹슨 투구.
    //  관대 앞 판석 틈에는 장식 없는 롱소드 한 자루가 꽂힌 채 녹슬었고, 장미 덩굴이 코등이를 감았다.
    {
      const tx = -22.75; // 가운데 결투 자리에서 아케이드 아치 사이로 보이는 칸
      const tz = AZ - 4.2;
      const bone = 0xf1ebdc; // 바닥보다 확실히 흰 뼈
      const bh = 0.42; // 관대 높이 (낮게: 누운 유해가 보이게)
      K.put('stone', box(2.6, bh - 0.1, 1.15), C.stoneDark, [tx, (bh - 0.1) / 2, tz], [0, 0, 0], 1, { ...st, rough: 0.02 });
      K.put('stone', box(2.75, 0.1, 1.3), C.stone, [tx, bh - 0.05, tz], [0, 0, 0], 1, { ...st, rough: 0.015 });
      K.put('stone', box(0.4, 0.12, 0.5), C.stone, [tx - 1.05, bh + 0.06, tz], [0, 0, 0.08], 1, st); // 돌 베개
      const y = bh + 0.07;
      const B = (g, pos, rot = [0, 0, 0], sc = 1) => K.put('bone', g, bone, pos, rot, sc, { vary: 0.08, noise: 0.12 });
      // 반듯이 누운 사람 뼈대 (머리 −x, 발 +x). 얼굴·가슴이 위(+y)를 본다
      const hx = tx - 1.0;
      const tube = (pts, r) => B(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...q))), 10, r, 5, false));
      // 머리뼈: 둥근 머리 + 턱뼈 + 이 + 눈구멍·코구멍
      B(new THREE.SphereGeometry(0.11, 12, 9), [hx, y + 0.11, tz], [0, 0, 0], [1.12, 1, 0.92]);
      B(new THREE.SphereGeometry(0.07, 10, 6), [hx + 0.09, y + 0.07, tz], [0, 0, 0], [0.8, 0.75, 1]); // 광대·위턱
      B(box(0.07, 0.035, 0.1), [hx + 0.15, y + 0.035, tz], [0, 0, -0.35]); // 아래턱
      for (let k = -3; k <= 3; k++) B(box(0.012, 0.02, 0.011), [hx + 0.155, y + 0.07, tz + k * 0.013]); // 이
      for (const sd of [-1, 1]) K.put('dark', new THREE.SphereGeometry(0.024, 8, 6), 0x0c0908, [hx + 0.07, y + 0.185, tz + sd * 0.04], [0, 0, 0], [1, 0.8, 1]); // 눈구멍
      K.put('dark', new THREE.ConeGeometry(0.016, 0.03, 3), 0x0c0908, [hx + 0.12, y + 0.16, tz], [0, 0, -Math.PI / 2]); // 코구멍
      // 등뼈 (목~허리)
      for (let i = 0; i < 13; i++) B(box(0.04, 0.045, 0.05 + (i > 2 ? 0.01 : 0)), [hx + 0.17 + i * 0.047, y + 0.025, tz]);
      // 갈비뼈 7쌍: 등뼈에서 옆으로 둥글게 돌아 가슴 위 복장뼈로 모인다 (조금씩 발 쪽으로 기울었다)
      for (let i = 0; i < 7; i++) {
        const x = hx + 0.27 + i * 0.052;
        const w = 0.1 + Math.min(i, 4) * 0.012 - Math.max(0, i - 4) * 0.01;
        const top = 0.17 + Math.min(i, 3) * 0.012;
        for (const sd of [-1, 1])
          tube(
            [
              [x, y + 0.04, tz + sd * 0.03],
              [x + 0.02, y + 0.06, tz + sd * (w * 0.85)],
              [x + 0.04, y + top * 0.65, tz + sd * w],
              [x + 0.06, y + top, tz + sd * (w * 0.55)],
              [x + 0.07, y + top + 0.02, tz + sd * 0.03],
            ],
            0.011,
          );
      }
      B(box(0.26, 0.018, 0.04), [hx + 0.44, y + 0.205, tz], [0, 0, -0.08]); // 복장뼈
      // 빗장뼈·어깨뼈
      for (const sd of [-1, 1]) {
        tube([[hx + 0.26, y + 0.19, tz + sd * 0.03], [hx + 0.24, y + 0.17, tz + sd * 0.11], [hx + 0.22, y + 0.12, tz + sd * 0.19]], 0.012);
        B(box(0.14, 0.01, 0.08), [hx + 0.3, y + 0.03, tz + sd * 0.14], [0, sd * 0.3, 0]);
      }
      // 팔: 위팔뼈는 몸 옆, 아래팔은 배 위로 모여 두 손을 포갰다
      for (const sd of [-1, 1]) {
        const sh = [hx + 0.24, y + 0.08, tz + sd * 0.21];
        const el = [hx + 0.55, y + 0.06, tz + sd * 0.22];
        const wr = [hx + 0.72, y + 0.19, tz + sd * 0.05];
        limb(K, 'bone', sh, el, 0.024, 0.02, bone, {}, 6);
        B(new THREE.SphereGeometry(0.03, 6, 5), el);
        limb(K, 'bone', el, wr, 0.016, 0.015, bone, {}, 5);
        limb(K, 'bone', [el[0], el[1] + 0.015, el[2] - sd * 0.02], [wr[0], wr[1] + 0.012, wr[2] - sd * 0.02], 0.012, 0.011, bone, {}, 5);
        for (let f = 0; f < 4; f++) B(box(0.07, 0.012, 0.012), [wr[0] + 0.05, wr[1] + 0.01, tz + sd * (0.035 - f * 0.018)], [0, sd * 0.3, 0]);
      }
      // 골반
      for (const sd of [-1, 1]) B(new THREE.SphereGeometry(0.08, 8, 6), [hx + 0.82, y + 0.05, tz + sd * 0.09], [0, sd * 0.4, 0], [0.9, 0.55, 0.45]);
      B(box(0.1, 0.03, 0.08), [hx + 0.8, y + 0.03, tz]); // 엉치뼈
      // 다리: 넙다리뼈·무릎·정강이뼈·발 (발끝이 위로)
      for (const sd of [-1, 1]) {
        const hip = [hx + 0.88, y + 0.05, tz + sd * 0.1];
        const kn = [hx + 1.32, y + 0.05, tz + sd * 0.085];
        const an = [hx + 1.74, y + 0.04, tz + sd * 0.08];
        limb(K, 'bone', hip, kn, 0.027, 0.024, bone, {}, 6);
        B(new THREE.SphereGeometry(0.035, 6, 5), kn);
        limb(K, 'bone', kn, an, 0.022, 0.019, bone, {}, 6);
        limb(K, 'bone', [kn[0], kn[1], kn[2] + sd * 0.025], [an[0], an[1], an[2] + sd * 0.022], 0.011, 0.01, bone, {}, 4);
        B(box(0.05, 0.14, 0.07), [an[0] + 0.04, y + 0.09, an[2]], [0, 0, -0.25]); // 발
      }
      // 바랜 천 조각: 한쪽 정강이 위에만 걸쳐 있다
      K.put('cloth', box(0.45, 0.02, 0.26, 4, 1, 2), 0x5a3a36, [hx + 1.48, y + 0.08, tz + 0.1], [0.15, 0.3, 0], 1, { rough: 0.03, noise: 0.25 });
      // 머리맡의 녹슨 투구
      K.put('rust', new THREE.SphereGeometry(0.17, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0x6a4a36, [tx - 1.55, bh + 0.02, tz + 0.35], [0.9, 0.4, 0.2], 1, { vary: 0.1, noise: 0.25 });
      // 관대 둘레로 기어오른 장미
      for (let k = 0; k < 6; k++) {
        const along = (k < 3 ? -1 : 1) * (0.95 + vr() * 0.3); // 관대 양 끝에만
        const p = new THREE.Vector3(tx + along, 0.1 + vr() * (bh - 0.1), tz - 0.62);
        leaf(p.clone(), toRoom, 0.8);
        leaf(p.clone().add(new THREE.Vector3(0.1, 0.05, 0)), toRoom, 0.8);
        if (vr() < 0.5) rose(p.clone().addScaledVector(toRoom, 0.07), 0.85);
      }
      // 판석 틈에 꽂힌 칼: 장식 없는 롱소드, 조금 기울었다
      const sx = tx + 0.5;
      const sz = tz - 1.9;
      K.push([sx, 0, sz], 0.35);
      const tilt = [0.1, 0, -0.07];
      const steel = 0xd2d5da;
      const at = (h) => [Math.sin(-tilt[2]) * h, Math.cos(tilt[0]) * h, Math.sin(tilt[0]) * h];
      K.put('sword', box(0.065, 1.02, 0.016), steel, at(0.51), tilt, 1, { vary: 0.04, noise: 0.18 }); // 드러난 칼날
      K.put('sword', box(0.024, 1.0, 0.018), 0xa9adb3, at(0.51), tilt, 1, { vary: 0 }); // 피 홈
      K.put('sword', box(0.36, 0.045, 0.045), 0x9a958c, at(1.04), tilt, 1, { vary: 0.05 }); // 코등이
      K.put('rust', cyl(0.024, 0.027, 0.28, 7), 0x3a2a20, at(1.2), tilt); // 손잡이 (가죽이 삭았다)
      K.put('sword', new THREE.SphereGeometry(0.048, 8, 6), 0x9a958c, at(1.37), tilt); // 폼멜
      K.pop();
      // 칼이 박힌 자리의 깨진 판석 조각
      for (let k = 0; k < 6; k++) {
        const a = vr() * 6.28;
        const d = 0.08 + vr() * 0.25;
        K.put('stone', box(0.12 + vr() * 0.1, 0.03, 0.1), C.floor, [sx + Math.cos(a) * d, 0.015, sz + Math.sin(a) * d], [vr() * 0.3, vr() * 3, 0], 1, { rough: 0.02 });
      }
      // 코등이를 감은 장미 덩굴
      for (let k = 0; k < 4; k++) {
        const a = k * 1.3;
        const p = new THREE.Vector3(sx + Math.cos(a) * 0.07, 0.08 + k * 0.12, sz + Math.sin(a) * 0.07);
        leaf(p, new THREE.Vector3(Math.cos(a), 0.3, Math.sin(a)).normalize(), 0.9);
      }
      rose(new THREE.Vector3(sx + 0.06, 0.4, sz - 0.05), 0.9); // 칼날 밑동에 한 송이
    }

    // 인스턴싱
    const leafGeo = new THREE.BufferGeometry();
    leafGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.1, 0, -0.065, 0, 0, 0, -0.07, 0, 0.065, 0, 0], 3));
    leafGeo.setIndex([0, 1, 2, 0, 2, 3]);
    leafGeo.computeVertexNormals();
    const inst = (geo, mat, list) => {
      const m = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach(([mm, cc], i) => {
        m.setMatrixAt(i, mm);
        m.setColorAt(i, cc);
      });
      scene.add(m);
    };
    inst(leafGeo, new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide }), leaves);
    const roseGeo = new THREE.IcosahedronGeometry(0.075, 0);
    inst(roseGeo, new THREE.MeshStandardMaterial({ roughness: 0.6, flatShading: true }), roses);
  }

  // ── 재질 ──
  const std = (p) => new THREE.MeshStandardMaterial({ vertexColors: true, ...p });
  const stoneMat = std({ map: ashlarTexture(), roughness: 0.92 });
  stoneMat.color.setScalar(1 / TEX_AVG);
  // 실내 그늘: 옆 복도와 아래쪽은 어둡고, 무너진 천장 가까운 위쪽은 밝다 (구워 넣기)
  const shade = (x, y, z) => {
    const inAisle = Math.abs(z) > NZ + 0.7 ? -0.3 : 0;
    const low = -0.22 * (1 - THREE.MathUtils.clamp(y / 16, 0, 1));
    return [inAisle + low, inAisle + low, inAisle + low * 1.05];
  };
  const meshes = [
    K.mesh('stone', stoneMat, { light: shade }),
    K.mesh('inlay', std({ roughness: 0.35, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2 })),
    K.mesh('wood', std({ roughness: 0.9 }), { light: shade }),
    K.mesh('iron', std({ roughness: 0.5, metalness: 0.6 })),
    K.mesh('ivy', std({ roughness: 1, flatShading: true }), { light: shade }),
    K.mesh('vine', std({ roughness: 1 }), { light: shade }),
    K.mesh('bone', std({ roughness: 0.7, emissive: 0x2a2622, emissiveIntensity: 0.5 })), // 그늘을 굽지 않고 살짝 밝혀 희게 보이게
    K.mesh('cloth', std({ roughness: 1, flatShading: true }), { light: shade }),
    K.mesh('dark', std({ roughness: 1 })),
    K.mesh('rust', std({ roughness: 0.9, metalness: 0.3 }), { light: shade }),
    K.mesh('sword', std({ roughness: 0.18, metalness: 0.95, envMap: weaponEnv(), envMapIntensity: 2.2, emissive: 0x1c2026, emissiveIntensity: 0.6 })), // 어둑한 복도에서도 칼날이 빛나게
    K.mesh('candle', std({ roughness: 0.6, emissive: 0x3a2a10, emissiveIntensity: 0.6 })),
    K.mesh('glow', new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })),
  ];
  for (const m of meshes) if (m) scene.add(m);

  // ── 스테인드글라스 (빛을 받지 않고 스스로 빛나 보이게) ──
  {
    const parts = [];
    for (const G of glassBins) {
      const g = G.g.clone();
      const m = new THREE.Matrix4().compose(new THREE.Vector3(G.x, G.y, G.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), G.rotY), new THREE.Vector3(1, 1, 1));
      g.applyMatrix4(m);
      const c = g.attributes.color;
      for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * G.lit, c.getY(i) * G.lit, c.getZ(i) * G.lit);
      parts.push(g);
    }
    const all = new THREE.BufferGeometry();
    const n = parts.reduce((s, g) => s + g.attributes.position.count, 0);
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    let o = 0;
    for (const g of parts) {
      pos.set(g.attributes.position.array, o * 3);
      col.set(g.attributes.color.array, o * 3);
      o += g.attributes.position.count;
    }
    all.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    all.setAttribute('color', new THREE.BufferAttribute(col, 3));
    scene.add(new THREE.Mesh(all, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false })));
  }

  // ── 빛줄기 (무너진 천장 틈으로 쏟아지는 햇빛) + 바닥에 떨어진 빛 웅덩이, 창빛 얼룩 ──
  const sunDir = new THREE.Vector3(sunOffset.x, sunOffset.y, sunOffset.z).normalize();
  const shafts = [];
  {
    const spots = [
      [-26, 3.5, 3.2],
      [-9, -9.5, 2.4],
      [8, 8.5, 2.8],
      [-38, -3, 2.2],
      [17, -6, 2.6],
    ];
    const pos = [];
    const col = [];
    const warm = new THREE.Color(0xffe6b8);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), sunDir);
    for (const [x, z, rad] of spots) {
      const g = new THREE.CylinderGeometry(rad * 1.15, rad, 44, 14, 4, true).toNonIndexed();
      g.translate(0, 22, 0);
      g.applyQuaternion(q);
      g.translate(x, 0, z);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        pos.push(p.getX(i), p.getY(i), p.getZ(i));
        const y = p.getY(i);
        const a = 0.13 * THREE.MathUtils.smoothstep(y, 0, 3) * (1 - THREE.MathUtils.smoothstep(y, TOP, TOP + 14));
        col.push(warm.r, warm.g, warm.b, a);
      }
      shafts.push({ x, z, rad });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })));
    // 바닥 빛 웅덩이 + 옆 복도 창 아래 색 얼룩
    const pp = [];
    const pc = [];
    const disc = (x, z, rx, rz, c, a) => {
      const n = 20;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2;
        const a1 = ((i + 1) / n) * Math.PI * 2;
        pp.push(x, 0.02, z, x + Math.cos(a1) * rx, 0.02, z + Math.sin(a1) * rz, x + Math.cos(a0) * rx, 0.02, z + Math.sin(a0) * rz);
        pc.push(c.r, c.g, c.b, a, c.r, c.g, c.b, 0, c.r, c.g, c.b, 0);
      }
    };
    for (const s of shafts) disc(s.x, s.z, s.rad * 1.3, s.rad * 1.3, warm, 0.5);
    const pal = GLASS.map((c) => new THREE.Color(c));
    for (const side of [-1, 1])
      for (const [xa, xb] of bays) {
        const xm = (xa + xb) / 2;
        for (let k = 0; k < 3; k++) disc(xm + 0.9 + (k - 1) * 0.7, side * (AZ - 3.2 - k * 0.3), 0.7, 1.4, pal[(Math.floor(xm) + k * 3 + 99) % pal.length], 0.35);
      }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3));
    dg.setAttribute('color', new THREE.Float32BufferAttribute(pc, 4));
    scene.add(new THREE.Mesh(dg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -3 })));
  }

  // ── 촛불 ──
  const flames = [
    [EX + 5.8, 2.78, -1.2, 0.4],
    [EX + 5.8, 2.78, 1.2, 0.4],
    [EX + 4, 2.23, -3.6, 0.5],
    [EX + 4, 2.23, 3.6, 0.5],
  ].map(([x, y, z, s]) => ({ x, y, z, s, ph: r() * 6 }));
  const flameGeo = new THREE.ConeGeometry(0.05, 0.2, 6);
  flameGeo.translate(0, 0.1, 0);
  const flameMesh = new THREE.InstancedMesh(flameGeo, new THREE.MeshBasicMaterial({ color: 0xffc46a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }), flames.length);
  scene.add(flameMesh);

  // ── 떠도는 먼지 (빛줄기 안에서 반짝인다) ──
  const DUST = 700;
  const dr = rng(77);
  const dpos = new Float32Array(DUST * 3);
  const dph = new Float32Array(DUST);
  const home = [];
  for (let i = 0; i < DUST; i++) {
    const s = shafts[i % shafts.length];
    const h = dr() * 14;
    const x = s.x + sunDir.x * (h / sunDir.y) + (dr() - 0.5) * s.rad * 2;
    const z = s.z + sunDir.z * (h / sunDir.y) + (dr() - 0.5) * s.rad * 2;
    home.push([x, h + 0.2, z]);
    dpos.set([x, h + 0.2, z], i * 3);
    dph[i] = dr() * 6.3;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.05, map: dustTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xfff0d0, opacity: 0.7 }));
  dust.frustumCulled = false;
  scene.add(dust);

  const fm = new THREE.Matrix4();
  const fq = new THREE.Quaternion();
  const fs = new THREE.Vector3();
  const fp = new THREE.Vector3();
  let t = 0;
  let gust = 0;
  const step = () => {
    for (let i = 0; i < flames.length; i++) {
      const f = flames[i];
      const w = 1 + 0.2 * Math.sin(t * 13 + f.ph) + 0.1 * Math.sin(t * 29 + f.ph);
      fs.set(f.s * 2, f.s * 2 * w, f.s * 2);
      fq.setFromAxisAngle(fp.set(1, 0, 0), 0.08 * Math.sin(t * 5 + f.ph));
      fm.compose(fp.set(f.x, f.y, f.z), fq, fs);
      flameMesh.setMatrixAt(i, fm);
    }
    flameMesh.instanceMatrix.needsUpdate = true;
    // 먼지: 제자리 둘레를 천천히 떠돌고, 큰 타격이 나오면 크게 흩어졌다 돌아온다
    const spread = 0.35 + gust * 2.2;
    for (let i = 0; i < DUST; i++) {
      const h = home[i];
      const p = dph[i];
      dpos[i * 3] = h[0] + Math.sin(t * 0.21 + p) * spread;
      dpos[i * 3 + 1] = h[1] + Math.sin(t * 0.13 + p * 2) * 0.4 + gust * Math.sin(p * 3) * 1.2;
      dpos[i * 3 + 2] = h[2] + Math.cos(t * 0.17 + p) * spread;
    }
    dustGeo.attributes.position.needsUpdate = true;
  };
  step();

  return {
    sunOffset,
    /** 큰 타격: 빛줄기 속 먼지가 크게 일었다 가라앉는다 */
    excite(amount) {
      gust = Math.min(1, gust + amount * 0.5);
    },
    update(dt) {
      t += dt;
      gust = Math.max(0, gust - dt * 0.35);
      step();
    },
  };
}
