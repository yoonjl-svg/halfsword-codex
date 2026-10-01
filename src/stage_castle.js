// ─────────────────────────────────────────────────────────────
//  배경 3: 눈 내리는 중세 성의 안뜰, 해 질 녘
//   다져진 눈밭 한가운데 말뚝과 밧줄로 두른 결투 자리(경기장 경계) · 네 모서리의 둥근 탑(고깔 지붕) ·
//   흉벽을 두른 높은 성벽 · 서쪽(−x) 성문(내리닫이 쇠창살)과 양옆 반원탑 · 동쪽(+x) 우뚝한 본성(창에 불빛) ·
//   북쪽 담에 기댄 헛간(건초·통·나무상자) · 남쪽 우물과 훈련장(허수아비·창 걸이·장작더미) ·
//   네 귀퉁이의 화로와 벽 횃불 · 노을이 남은 푸른 하늘 · 흩날리는 눈 (큰 타격이 나오면 눈보라).
//  물리와는 무관한 그림만 만든다. 카메라가 도는 반지름(10.5m) 안에는 낮은 말뚝과 밧줄만 둔다.
//  횃불·화로 빛은 실제 조명 대신 꼭짓점 색에 구워 넣는다 (폰에서 가볍게).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { ARENA } from './config.js';
import { rng, h3, _c, _v, Kit, box, cyl, limb, canvasTex, pointGlow } from './stage_kit.js';
import { weaponEnv } from './weapon_looks.js';

const C = {
  stone: 0xb0aea9, // 성벽 돌 (질감에 곱해짐)
  stoneDark: 0x8d877f,
  slate: 0x3c4556, // 탑 지붕 (슬레이트)
  wood: 0x6b4a32,
  woodDark: 0x4a3526,
  woodLight: 0x8c6a48,
  iron: 0x2c2c30,
  straw: 0xc9a85a,
  rope: 0x9c8660,
  snow: 0xe9eef5,
  dark: 0x0f0f14, // 문간·화살 구멍 안쪽
  win: 0xffb65c, // 불 켜진 창
};
const STONE_TEX_AVG = 0.62; // 돌 질감 평균 밝기(선형): 재질 색을 1/이만큼 올려 원래 색이 나오게

/** 마름돌 쌓기: 가로로 긴 돌을 줄눈으로 엇갈려 쌓은 무늬 */
function ashlarTexture() {
  const r = rng(12);
  return canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#7d7973';
    x.fillRect(0, 0, w, h);
    const rows = 6;
    const rh = h / rows;
    for (let j = 0; j < rows; j++) {
      let u = -r() * 60;
      while (u < w) {
        const bw = 44 + r() * 52;
        const v = 196 + Math.floor(r() * 40);
        x.fillStyle = `rgb(${v},${v - 3},${v - 8})`;
        x.fillRect(u + 2, j * rh + 2, bw - 4, rh - 4);
        // 돌 표면 얼룩
        for (let k = 0; k < 6; k++) {
          x.fillStyle = `rgba(80,76,70,${0.05 + r() * 0.08})`;
          x.fillRect(u + 2 + r() * (bw - 10), j * rh + 2 + r() * (rh - 8), 3 + r() * 8, 2 + r() * 5);
        }
        u += bw;
      }
    }
  });
}
function snowTexture() {
  const r = rng(31);
  return canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#f2f2f2';
    x.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i++) {
      const v = 200 + Math.floor(r() * 55);
      x.fillStyle = `rgba(${v},${v},${v + 4},${0.3 + r() * 0.4})`;
      x.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
    }
    for (let i = 0; i < 60; i++) {
      x.fillStyle = `rgba(170,175,190,${0.05 + r() * 0.07})`;
      x.beginPath();
      x.ellipse(r() * w, r() * h, 8 + r() * 24, 4 + r() * 10, r() * 3, 0, Math.PI * 2);
      x.fill();
    }
  });
}
const SNOW_TEX_AVG = 0.86;
function skyTexture(sunAz) {
  const r = rng(4);
  return canvasTex(512, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1b2440');
    g.addColorStop(0.25, '#2e3a60');
    g.addColorStop(0.42, '#5d6688');
    g.addColorStop(0.49, '#8d8aa2');
    g.addColorStop(0.5, '#6e7390');
    g.addColorStop(1, '#4a5270');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    // 해 진 쪽 수평선의 노을
    const u = ((((Math.PI - sunAz) / (Math.PI * 2)) % 1) + 1) % 1;
    for (const ux of [u * w, u * w - w, u * w + w]) {
      const rg = x.createRadialGradient(ux, h * 0.49, 0, ux, h * 0.49, w * 0.3);
      rg.addColorStop(0, 'rgba(255,160,90,0.85)');
      rg.addColorStop(0.35, 'rgba(230,120,90,0.35)');
      rg.addColorStop(1, 'rgba(200,110,110,0)');
      x.fillStyle = rg;
      x.fillRect(0, 0, w, h * 0.5);
    }
    // 눈구름 띠
    for (let i = 0; i < 50; i++) {
      x.fillStyle = `rgba(${40 + r() * 30},${48 + r() * 30},${75 + r() * 30},${0.25 + r() * 0.3})`;
      x.beginPath();
      x.ellipse(r() * w, h * (0.05 + r() * 0.38), 40 + r() * 120, 4 + r() * 12, 0, 0, Math.PI * 2);
      x.fill();
    }
  });
}
function flakeTexture() {
  return canvasTex(32, 32, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
  });
}

/**
 * 성 안뜰 경기장을 만든다. 반환: { update(dt), excite(amount), sunOffset }
 *  lights: main.js 의 { hemi, sun } — 해 질 녘 빛으로 바꾼다
 */
export function buildCastle(scene, lights = {}) {
  const r = rng(1417);
  const K = new Kit(313);
  const FOG = 0x4e5876;
  const sunOffset = { x: -7, y: 3.6, z: 4 }; // 서쪽 성문 너머로 지는 해
  scene.background = new THREE.Color(FOG);
  scene.fog = new THREE.Fog(FOG, 35, 420);
  if (lights.hemi) {
    lights.hemi.color.set(0x8a9ac2);
    lights.hemi.groundColor.set(0xd3dae6); // 눈에 되비친 빛
    lights.hemi.intensity = 1.1;
  }
  if (lights.sun) {
    lights.sun.color.set(0xffc49a);
    lights.sun.intensity = 1.05;
    lights.sun.position.set(sunOffset.x, sunOffset.y, sunOffset.z);
  }
  scene.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(600, 48, 24),
      new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, depthWrite: false, map: skyTexture(Math.atan2(sunOffset.z, sunOffset.x)) }),
    ),
  );

  const IN = 19; // 안뜰 안쪽 벽면 (±19m 네모)
  const WT = 3; // 성벽 두께
  const WH = 9; // 성벽 높이
  const snowy = { snow: 0.95 };
  const st = { uv: 'box', uvScale: 0.24, vary: 0.08, noise: 0.05 };

  // ── 불빛: 화로 넷 + 벽 횃불 + 본성 창 (꼭짓점 색에 구워 넣는다) ──
  const braziers = [
    [8.5, 8.5],
    [-8.5, 8.5],
    [8.5, -8.5],
    [-8.5, -8.5],
  ];
  const torches = [
    // [x, z, 벽을 보는 방향(바깥 법선)]
    [-IN, -10, -1, 0],
    [-IN, 10, -1, 0],
    [12, IN, 0, 1],
    [-12, IN, 0, 1],
    [12, -IN, 0, -1],
    [-12, -IN, 0, -1],
    [IN, -9, 1, 0],
    [IN, 3.2, 1, 0],
  ];
  const glowPts = [
    ...braziers.map(([x, z]) => ({ x, y: 1.3, z, r: 8, c: [0.95, 0.5, 0.18] })),
    ...torches.map(([x, z, nx, nz]) => ({ x: x - nx * 0.5, y: 3.3, z: z - nz * 0.5, r: 5.5, c: [1.0, 0.52, 0.18] })),
  ];
  const glow = pointGlow(glowPts);

  // ── 땅: 눈 덮인 안뜰, 결투 자리와 성문~본성 길은 밟혀서 거뭇하다 ──
  {
    // 네모 격자 (1m 칸): 부채꼴 격자는 밟힌 자리 얼룩이 한가운데서 햇살처럼 번진다
    const HALF = 42;
    const N = 84;
    const pos = [];
    const uv = [];
    const col = [];
    const cSnow = new THREE.Color(C.snow);
    const cTrod = new THREE.Color(0xbfc3cc);
    const cMud = new THREE.Color(0x8a8480);
    const tmp = new THREE.Color();
    const colorAt = (x, z) => {
      const rr = Math.hypot(x, z);
      const n1 = h3(Math.round(x * 0.5), 0, Math.round(z * 0.5), 4) * 0.5 + h3(x * 0.8, 2, z * 0.8, 6) * 0.5;
      let trod = THREE.MathUtils.clamp((8.2 - rr) / 1.8, 0, 1);
      trod = Math.max(trod, THREE.MathUtils.clamp((1.8 - Math.abs(z)) / 0.8, 0, 1) * (x > -IN && x < IN ? 0.8 : 0));
      tmp.copy(cSnow).lerp(cTrod, trod * (0.6 + 0.4 * n1));
      tmp.lerp(cMud, trod * THREE.MathUtils.clamp((n1 - 0.6) * 2.5, 0, 1) * 0.5);
      for (const [bx, bz] of braziers) {
        const d = Math.hypot(x - bx, z - bz);
        if (d < 1.6) tmp.lerp(cMud, (1 - d / 1.6) * 0.6); // 화로 둘레는 눈이 녹았다
      }
      const L = glow(x, 0, z);
      col.push((tmp.r / SNOW_TEX_AVG) * (1 + L[0]), (tmp.g / SNOW_TEX_AVG) * (1 + L[1]), (tmp.b / SNOW_TEX_AVG) * (1 + L[2]));
    };
    for (let j = 0; j <= N; j++)
      for (let i = 0; i <= N; i++) {
        const x = -HALF + (2 * HALF * i) / N;
        const z = -HALF + (2 * HALF * j) / N;
        pos.push(x, 0, z);
        uv.push(x / 4, z / 4);
        colorAt(x, z);
      }
    const idx = [];
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const a0 = j * (N + 1) + i;
        idx.push(a0, a0 + N + 1, a0 + 1, a0 + 1, a0 + N + 1, a0 + N + 2);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: snowTexture(), vertexColors: true, roughness: 0.92 }));
    ground.receiveShadow = true;
    scene.add(ground);
    // 눈 더미: 벽 밑에 쌓인 눈
    for (let i = 0; i < 70; i++) {
      const side = i % 4;
      const t = (r() - 0.5) * 2 * (IN - 2);
      const x = side === 0 ? -IN + 0.6 : side === 1 ? IN - 0.6 : t;
      const z = side === 2 ? -IN + 0.6 : side === 3 ? IN - 0.6 : t;
      if (side === 1 && Math.abs(z) < 8) continue; // 본성 계단 앞은 비운다
      if (side === 0 && Math.abs(z) < 3.2) continue; // 성문 앞도
      if (side === 3 && Math.abs(x) < 10) continue; // 헛간(마구간) 안
      if (side === 2 && Math.abs(x) < 3.5) continue; // 종탑 밑
      K.put('snow', new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), C.snow, [x, -0.05, z], [0, r() * 3, 0], [1.2 + r() * 1.4, 0.35 + r() * 0.35, 1 + r() * 1.2], { vary: 0.04, noise: 0.03 });
    }
  }

  // ── 결투 자리: 낮은 말뚝과 밧줄 (경기장 경계) ──
  {
    const R0 = ARENA.radius + 0.45;
    const n = 20;
    const posts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.08;
      const x = Math.cos(a) * R0;
      const z = Math.sin(a) * R0;
      const h = 0.55 + r() * 0.08;
      K.put('wood', cyl(0.05, 0.065, h, 6), C.woodDark, [x, h / 2, z], [(r() - 0.5) * 0.08, 0, (r() - 0.5) * 0.08], 1, { vary: 0.15, snow: 0.8 });
      posts.push([x, h - 0.07, z]);
    }
    for (let i = 0; i < n; i++) {
      const a = posts[i];
      const b = posts[(i + 1) % n];
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.09, (a[2] + b[2]) / 2];
      limb(K, 'wood', a, m, 0.016, 0.016, C.rope, {}, 4);
      limb(K, 'wood', m, b, 0.016, 0.016, C.rope, {}, 4);
    }
  }

  // ── 성벽 네 면 (흉벽 + 눈 덮인 성벽 길) ──
  const merlons = (x0, z0, x1, z1, y, nx, nz) => {
    // 바깥 가장자리를 따라 톱니 흉벽
    const L = Math.hypot(x1 - x0, z1 - z0);
    const rot = Math.atan2(-(z1 - z0), x1 - x0);
    const n = Math.floor(L / 1.8);
    K.push([(x0 + x1) / 2, y, (z0 + z1) / 2], rot);
    K.put('stone', box(L, 0.7, 0.6, Math.ceil(L / 3), 1, 1), C.stone, [0, 0.35, 0], [0, 0, 0], 1, { ...st, ...snowy });
    for (let i = 0; i < n; i++) K.put('stone', box(1.0, 1.2, 0.6), C.stone, [-L / 2 + 0.9 + i * 1.8 + (L - n * 1.8) / 2, 1.3, 0], [0, 0, 0], 1, { ...st, ...snowy, rough: 0.03 });
    K.pop();
  };
  const wallSide = (cx, cz, len, rotY) => {
    K.push([cx, 0, cz], rotY);
    // 성벽 몸 (건물 기준 x = 두께 방향, 안뜰 쪽이 −x 가 되게 돌려 놓는다)
    K.put('stone', box(WT, WH, len, 2, 5, Math.ceil(len / 2)), C.stone, [0, WH / 2, 0], [0, 0, 0], 1, { ...st, ...snowy });
    K.put('stone', box(WT + 0.6, 1.2, len, 1, 1, Math.ceil(len / 2)), C.stoneDark, [0.3, 0.6, 0], [0, 0, 0], 1, { ...st, ...snowy }); // 굽도리
    K.put('stone', box(0.35, 0.8, len), C.stone, [-WT / 2 + 0.18, WH + 0.4, 0], [0, 0, 0], 1, { ...st, ...snowy }); // 안쪽 낮은 난간
    K.pop();
  };
  wallSide(-IN - WT / 2, 0, 2 * IN + 2 * WT, Math.PI);
  wallSide(IN + WT / 2, 0, 2 * IN + 2 * WT, 0);
  wallSide(0, IN + WT / 2, 2 * IN + 2 * WT, -Math.PI / 2);
  wallSide(0, -IN - WT / 2, 2 * IN + 2 * WT, Math.PI / 2);
  const E = IN + WT - 0.3;
  merlons(-E, -IN, -E, IN, WH, -1, 0);
  merlons(E, -IN, E, IN, WH, 1, 0);
  merlons(-IN, E, IN, E, WH, 0, 1);
  merlons(-IN, -E, IN, -E, WH, 0, -1);

  // ── 모서리의 둥근 탑 (고깔 지붕, 화살 구멍) ──
  const tower = (x, z, R, H, roofH) => {
    K.put('stone', new THREE.CylinderGeometry(R, R * 1.06, H, 20, 6), C.stone, [x, H / 2, z], [0, 0, 0], 1, { ...st, ...snowy });
    K.put('stone', new THREE.CylinderGeometry(R * 1.12, R * 1.12, 0.5, 20), C.stoneDark, [x, H + 0.25, z], [0, 0, 0], 1, { ...st, ...snowy });
    K.put('slate', new THREE.ConeGeometry(R * 1.2, roofH, 20, 3), C.slate, [x, H + 0.5 + roofH / 2, z], [0, 0, 0], 1, { vary: 0.05, noise: 0.08, snow: 0.55 });
    K.put('iron', cyl(0.04, 0.05, 1.4, 5), C.iron, [x, H + 0.5 + roofH + 0.6, z]);
    // 안뜰 쪽을 보는 화살 구멍
    const a = Math.atan2(-z, -x);
    for (const [hy, da] of [
      [4.5, 0],
      [8.5, 0.35],
      [8.5, -0.35],
    ])
      K.put('dark', box(0.2, 1.3, 0.2), C.dark, [x + Math.cos(a + da) * (R - 0.05), hy, z + Math.sin(a + da) * (R - 0.05)], [0, -(a + da), 0]);
  };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) tower(sx * (IN + WT / 2), sz * (IN + WT / 2), 4.2, 14, 6.5);

  // ── 서쪽 성문: 양옆 반원탑 + 아치 + 내리닫이 쇠창살 ──
  {
    const gx = -IN;
    for (const s of [-1, 1]) tower(gx - 1.2, s * 5.2, 3.0, 12, 4.5);
    const gw = 4.2;
    const gh = 4.4;
    const sh = new THREE.Shape();
    sh.moveTo(-gw / 2, 0);
    sh.lineTo(gw / 2, 0);
    sh.lineTo(gw / 2, gh);
    sh.absarc(0, gh, gw / 2, 0, Math.PI, false);
    sh.lineTo(-gw / 2, 0);
    K.put('dark', new THREE.ShapeGeometry(sh, 10), 0x121216, [gx + 0.02, 0, 0], [0, Math.PI / 2, 0]);
    // 아치 테두리 돌
    K.put('stone', new THREE.TorusGeometry(gw / 2 + 0.25, 0.32, 5, 12, Math.PI), C.stoneDark, [gx + 0.05, gh, 0], [0, Math.PI / 2, 0], 1, { rough: 0.03, snow: 0.6 });
    for (const s of [-1, 1]) K.put('stone', box(0.5, gh, 0.6), C.stoneDark, [gx + 0.1, gh / 2, s * (gw / 2 + 0.25)], [0, 0, 0], 1, { rough: 0.02, snow: 0.6 });
    // 쇠창살 (반쯤 올라가 있다)
    const lift = 1.6;
    for (let i = -3; i <= 3; i++) K.put('iron', box(0.08, gh + gw / 2 - lift - 0.2, 0.08), C.iron, [gx + 0.3, lift + (gh + gw / 2 - lift - 0.2) / 2, i * 0.58]);
    for (let j = 0; j < 5; j++) K.put('iron', box(0.08, 0.08, gw), C.iron, [gx + 0.3, lift + 0.1 + j * 0.9, 0]);
    for (let i = -3; i <= 3; i++) K.put('iron', new THREE.ConeGeometry(0.06, 0.25, 4), C.iron, [gx + 0.3, lift - 0.1, i * 0.58], [Math.PI, 0, 0]);
  }

  // ── 동쪽 본성 (우뚝한 네모 탑, 모서리 망루, 불 켜진 창, 바깥 돌계단) ──
  const winPts = [];
  {
    const kx = IN + 6;
    const kw = 14;
    const kd = 12;
    const kh = 22;
    K.put('stone', box(kd, kh, kw, 4, 8, 5), C.stone, [kx, kh / 2, 0], [0, 0, 0], 1, { ...st, ...snowy });
    K.put('stone', box(kd + 0.8, 1.4, kw + 0.8, 4, 1, 5), C.stoneDark, [kx, 0.7, 0], [0, 0, 0], 1, { ...st, ...snowy });
    // 꼭대기 흉벽
    merlons(kx - kd / 2 + 0.3, -kw / 2 + 0.3, kx - kd / 2 + 0.3, kw / 2 - 0.3, kh, -1, 0);
    merlons(kx - kd / 2 + 0.3, kw / 2 - 0.3, kx + kd / 2 - 0.3, kw / 2 - 0.3, kh, 0, 1);
    merlons(kx - kd / 2 + 0.3, -kw / 2 + 0.3, kx + kd / 2 - 0.3, -kw / 2 + 0.3, kh, 0, -1);
    // 모서리 망루
    for (const sz of [-1, 1]) {
      const tx = kx - kd / 2;
      const tz = sz * (kw / 2);
      K.put('stone', new THREE.CylinderGeometry(1.3, 0.6, 5.5, 12, 3), C.stone, [tx, kh - 1.2, tz], [0, 0, 0], 1, { ...st, ...snowy });
      K.put('slate', new THREE.ConeGeometry(1.55, 3.4, 12, 2), C.slate, [tx, kh + 1.55 + 1.7, tz], [0, 0, 0], 1, { snow: 0.55 });
    }
    // 빈 깃대 둘
    for (const sz of [-1, 1]) K.put('wood', cyl(0.07, 0.09, 6, 6), C.woodDark, [kx + 2, kh + 3, sz * 3]);
    // 창: 아치꼴, 몇 개는 불이 켜져 있다
    const archWin = (w, h) => {
      const s = new THREE.Shape();
      s.moveTo(-w / 2, 0);
      s.lineTo(w / 2, 0);
      s.lineTo(w / 2, h - w / 2);
      s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false);
      s.lineTo(-w / 2, 0);
      return new THREE.ShapeGeometry(s, 6);
    };
    const fx = IN - 0.03;
    const lit = [
      [9, -4, 1],
      [9, 0, 0],
      [9, 4, 1],
      [14, -3, 0],
      [14, 3, 1],
      [18.5, 0, 1],
    ];
    for (const [wy, wz, on] of lit) {
      K.put(on ? 'glow' : 'dark', archWin(1.0, 2.1), on ? C.win : C.dark, [fx, wy, wz], [0, -Math.PI / 2, 0], 1, { vary: 0.15, noise: 0.1 });
      K.put('stone', box(0.3, 0.2, 1.4), C.stoneDark, [fx - 0.12, wy - 0.1, wz], [0, 0, 0], 1, { snow: 0.9 }); // 창턱
      if (on) winPts.push({ x: fx - 0.5, y: wy + 1, z: wz, r: 3.2, c: [0.9, 0.5, 0.2] });
    }
    // 바깥 돌계단: 남쪽에서 올라가 5m 높이의 문으로
    const doorY = 5;
    const n = 14;
    for (let k = 1; k <= n; k++) {
      const zz = -7.5 + (k - 0.5) * (6.5 / n);
      K.put('stone', box(1.8, (doorY * k) / n, 6.5 / n + 0.01), C.stoneDark, [IN - 0.9, (doorY * k) / n / 2, zz], [0, 0, 0], 1, { ...st, snow: 0.9 });
    }
    K.put('stone', box(1.8, doorY, 2.4), C.stoneDark, [IN - 0.9, doorY / 2, 0.2], [0, 0, 0], 1, { ...st, snow: 0.9 }); // 문 앞 층계참
    K.put('stone', box(0.25, 0.9, 8.9), C.stone, [IN - 1.7, doorY + 0.45, -2.9], [0, 0, 0], 1, { ...st, snow: 0.9 }); // 난간
    K.put('wood', archWin(1.6, 2.8), 0x3a2618, [fx, doorY, 0.3], [0, -Math.PI / 2, 0]); // 나무 문
    for (let j = 0; j < 3; j++) K.put('iron', box(0.04, 0.08, 1.5), C.iron, [fx - 0.03, doorY + 0.5 + j * 0.9, 0.3]);
  }

  /**
   * 말 한 마리 (기본 도형으로 만든 모습). 머리가 +z(벽)를 보고 선다. 등에 천을 덮고, 굴레에서 벽 가로대로 밧줄.
   * pose 0: 고개를 들고 조금 돌렸다, 1: 고개를 숙여 건초를 먹는다
   */
  function horse(x, z, coat, mane, blanket, pose) {
    K.push([x, 0, z], -Math.PI / 2, 1.18); // 건물 기준 +x 가 머리 쪽, 조금 크게
    const o = { vary: 0.05, noise: 0.06 };
    const sph = (p, s, c = coat) => K.put('horse', new THREE.SphereGeometry(1, 12, 8), c, p, [0, 0, 0], s, o);
    sph([0, 1.2, 0], [0.84, 0.43, 0.38]); // 몸통 (통통하게)
    sph([-0.58, 1.26, 0], [0.46, 0.43, 0.39]); // 엉덩이
    sph([0.6, 1.22, 0], [0.42, 0.43, 0.37]); // 가슴
    const nb = [0.78, 1.35, 0];
    const hd = pose ? [1.12, 1.25, 0.05] : [1.1, 1.9, 0.12];
    const mz = pose ? [1.35, 0.7, 0.08] : [1.55, 1.55, 0.22];
    limb(K, 'horse', nb, hd, 0.27, 0.16, coat, o, 10); // 목
    limb(K, 'horse', [nb[0] - 0.05, nb[1] + 0.2, 0], [hd[0] - 0.05, hd[1] + 0.12, hd[2]], 0.05, 0.04, mane, o, 5); // 갈기
    sph(hd, [0.19, 0.17, 0.15]);
    limb(K, 'horse', hd, mz, 0.15, 0.1, coat, o, 10); // 머리 (얼굴)
    sph(mz, [0.12, 0.11, 0.11], coat);
    for (const s of [-1, 1]) {
      K.put('horse', new THREE.ConeGeometry(0.04, 0.14, 5), coat, [hd[0] - 0.03, hd[1] + 0.16, hd[2] + s * 0.07], [0, 0, 0.2], 1, o); // 귀
      K.put('horse', new THREE.SphereGeometry(0.025, 6, 4), 0x0a0808, [hd[0] + 0.12 + (mz[0] - hd[0]) * 0.15, hd[1] + (mz[1] - hd[1]) * 0.15 + 0.04, hd[2] + s * 0.1]); // 눈
    }
    // 굴레(검은 띠)와 밧줄
    K.put('horse', new THREE.TorusGeometry(0.11, 0.015, 4, 10), 0x1a1410, [mz[0] - 0.08, mz[1] + 0.03, mz[2]], [0, 0, Math.atan2(mz[1] - hd[1], mz[0] - hd[0]) + Math.PI / 2]);
    limb(K, 'wood', [mz[0] - 0.08, mz[1] - 0.08, mz[2]], [1.78, 1.15, (pose ? -0.1 : 0.1)], 0.012, 0.012, C.rope, {}, 3);
    // 다리 (앞다리 곧게, 뒷다리는 뒤꿈치가 꺾인다)
    for (const s of [-1, 1]) {
      const fz = s * 0.19;
      const legs = [
        [
          [0.55, 1.0, fz],
          [0.58, 0.52, fz],
          [0.56, 0.1, fz],
        ],
        [
          [-0.62, 1.05, fz],
          [-0.76, 0.56, fz],
          [-0.64, 0.1, fz],
        ],
      ];
      for (const [a, b, c] of legs) {
        limb(K, 'horse', a, b, 0.12, 0.07, coat, o, 7);
        limb(K, 'horse', b, c, 0.065, 0.05, coat, o, 7);
        sph(b, [0.075, 0.075, 0.075]); // 무릎 (위아래 다리 이음매를 덮는다)
        K.put('horse', cyl(0.07, 0.085, 0.12, 8), 0x1a1612, [c[0], 0.06, c[2]]); // 발굽
      }
    }
    // 꼬리
    limb(K, 'horse', [-0.95, 1.35, 0], [-1.1, 1.0, 0.04], 0.07, 0.06, mane, o, 6);
    limb(K, 'horse', [-1.1, 1.0, 0.04], [-1.12, 0.55, 0.1], 0.06, 0.03, mane, o, 6);
    // 등 덮개 (천)
    K.put('horse', box(0.95, 0.04, 0.8), blanket, [-0.05, 1.64, 0], [0, 0, 0], 1, o);
    for (const s of [-1, 1]) K.put('horse', box(0.95, 0.45, 0.03), blanket, [-0.05, 1.44, s * 0.4], [s * 0.18, 0, 0], 1, o);
    K.pop();
  }

  // ── 북쪽: 성벽에 기댄 헛간 (건초·통·나무상자) ──
  {
    const z0 = IN;
    const z1 = IN - 4.2;
    const xs = [-9, -4.5, 0, 4.5, 9];
    for (const x of xs) K.put('wood', box(0.25, 3.3, 0.25), C.wood, [x, 1.65, z1], [0, 0, 0], 1, { vary: 0.12, snow: 0.8 });
    K.put('wood', box(18.6, 0.3, 0.3), C.wood, [0, 3.35, z1], [0, 0, 0], 1, { snow: 0.8 });
    const slope = Math.atan2(4.6 - 3.3, z0 - z1);
    const rl = Math.hypot(z0 - z1, 1.3) + 0.8;
    for (let i = 0; i < 24; i++) {
      const x = -9.4 + (i + 0.5) * (18.8 / 24);
      K.put('wood', box(18.8 / 24 - 0.02, 0.1, rl), C.woodLight, [x, 4.0, (z0 + z1) / 2 - 0.35], [-slope, 0, 0], 1, { vary: 0.2 });
    }
    K.put('snow', box(18.9, 0.22, rl - 0.1), C.snow, [0, 4.17, (z0 + z1) / 2 - 0.3], [-slope, 0, 0], 1, { vary: 0.02, noise: 0.03, rough: 0.06 });
    // 건초 더미
    for (let i = 0; i < 7; i++)
      K.put('straw', box(1.2, 0.6, 0.7, 2, 1, 1), C.straw, [-9.1 + (i % 4) * 1.3 + (i > 3 ? 0.6 : 0), 0.3 + (i > 3 ? 0.6 : 0), IN - 1.2], [0, (r() - 0.5) * 0.2, 0], 1, { vary: 0.15, rough: 0.05, noise: 0.15 });
    // 통
    const barrel = (x, z, up = true) => {
      const g = new THREE.CylinderGeometry(0.34, 0.34, 0.9, 12, 3);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        const k = 1 + 0.14 * (1 - (y / 0.45) ** 2);
        p.setX(i, p.getX(i) * k);
        p.setZ(i, p.getZ(i) * k);
      }
      g.computeVertexNormals();
      K.put('wood', g, C.wood, [x, up ? 0.45 : 0.38, z], up ? [0, 0, 0] : [0, r() * 3, Math.PI / 2], 1, { vary: 0.15, snow: up ? 0.9 : 0.5 });
      for (const hy of [-0.3, 0.3])
        K.put('iron', new THREE.TorusGeometry(0.37, 0.02, 4, 14), C.iron, up ? [x, 0.45 + hy, z] : [x, 0.38, z], up ? [Math.PI / 2, 0, 0] : [0, 0, 0], 1);
    };
    barrel(3.4, IN - 1.0);
    barrel(4.2, IN - 1.3);
    barrel(3.7, IN - 2.0);
    barrel(5.5, IN - 2.6, false);
    for (const [x, z, s] of [
      [7, IN - 1.1, 0.9],
      [7.9, IN - 1.2, 0.7],
      [7.3, IN - 1.1, 0.6],
    ])
      K.put('wood', box(s, s, s), C.woodLight, [x, s / 2 + (s < 0.7 ? 0.9 : 0), z], [0, r() * 0.5, 0], 1, { vary: 0.2, snow: 0.9 });
    // 물통 (구유)
    K.put('wood', box(2.4, 0.6, 0.8), C.woodDark, [-6.6, 0.3, IN - 3.1], [0, 0, 0], 1, { snow: 0.3 });
    K.put('ice', box(2.2, 0.05, 0.6), 0xaec4d6, [-6.6, 0.56, IN - 3.1]);

    // 마구간 칸막이 + 벽에 붙은 말 매는 가로대 + 묶여 있는 말 둘
    for (const x of [-3.4, -0.75, 1.95]) {
      K.put('wood', box(0.08, 1.3, 2.8), C.woodLight, [x, 0.75, IN - 1.5], [0, 0, 0], 1, { vary: 0.15 });
      K.put('wood', box(0.14, 1.6, 0.14), C.wood, [x, 0.8, IN - 2.9]);
    }
    K.put('wood', box(5.6, 0.1, 0.1), C.woodDark, [-0.7, 1.15, IN - 0.3]);
    for (const x of [-3.2, 1.7]) K.put('wood', box(0.1, 0.5, 0.25), C.woodDark, [x, 1.15, IN - 0.15]);
    horse(-2.1, IN - 2.4, 0x6b4127, 0x1e1510, 0x7a1a1a, 0);
    horse(0.6, IN - 2.4, 0x9a948c, 0x3a3634, 0x2a3f6a, 1);
    K.put('straw', new THREE.CylinderGeometry(0.9, 1.1, 0.25, 10), C.straw, [0.6, 0.12, IN - 0.9], [0, 0, 0], [0.7, 1, 0.6], { rough: 0.1, noise: 0.2 });
  }

  // ── 남쪽: 우물 · 훈련장(허수아비·말뚝) · 창 걸이 · 장작더미 ──
  {
    const wx = -5;
    const wz = -15;
    K.put('stone', new THREE.CylinderGeometry(1.2, 1.3, 0.95, 16, 1, true), C.stone, [wx, 0.47, wz], [0, 0, 0], 1, { ...st, snow: 0.9 });
    K.put('stone', new THREE.TorusGeometry(1.2, 0.16, 5, 16), C.stoneDark, [wx, 0.95, wz], [Math.PI / 2, 0, 0], 1, { snow: 0.95 });
    K.put('dark', new THREE.CircleGeometry(1.1, 16), 0x0a0c10, [wx, 0.5, wz], [-Math.PI / 2, 0, 0]);
    for (const s of [-1, 1]) K.put('wood', box(0.18, 2.6, 0.18), C.wood, [wx + s * 1.3, 1.3, wz], [0, 0, 0], 1, { snow: 0.8 });
    K.put('wood', cyl(0.1, 0.1, 2.8, 8), C.woodDark, [wx, 2.1, wz], [0, 0, Math.PI / 2]);
    for (const s of [-1, 1]) K.put('wood', box(1.5, 0.08, 3.1), C.woodLight, [wx + s * 0.62, 2.85, wz], [0, 0, s * -0.55], 1, { snow: 0.95 });
    limb(K, 'wood', [wx, 2.05, wz], [wx, 1.2, wz], 0.012, 0.012, C.rope, {}, 3);
    K.put('wood', cyl(0.18, 0.14, 0.3, 10), C.wood, [wx, 1.05, wz]);

    // 허수아비 (짚 몸통 + 가로 막대 팔)
    const dummy = (x, z, rot) => {
      K.put('wood', box(0.14, 2.1, 0.14), C.woodDark, [x, 1.05, z]);
      K.put('wood', box(0.12, 0.12, 1.5), C.woodDark, [x, 1.55, z], [0, rot, 0]);
      K.put('straw', new THREE.CylinderGeometry(0.28, 0.24, 0.8, 8, 2), 0x9c8a62, [x, 1.3, z], [0, 0, 0], 1, { rough: 0.05, snow: 0.6 });
      K.put('straw', new THREE.SphereGeometry(0.2, 8, 6), 0x9c8a62, [x, 1.95, z], [0, 0, 0], 1, { rough: 0.03, snow: 0.9 });
    };
    dummy(4, -14.2, 0.2);
    dummy(7.5, -15.5, -0.3);
    for (const x of [10.5, 11.3]) K.put('wood', cyl(0.12, 0.14, 1.5, 7), C.wood, [x, 0.75, -14], [0, 0, 0], 1, { snow: 0.9 }); // 베기 연습 말뚝
    // 창 걸이: 벽에 기대 선 창들
    K.put('wood', box(3, 0.12, 0.12), C.woodDark, [13, 1.6, -IN + 0.35]);
    K.put('wood', box(3, 0.12, 0.12), C.woodDark, [13, 0.4, -IN + 0.35]);
    for (let i = 0; i < 6; i++) {
      const x = 11.8 + i * 0.48;
      K.put('wood', cyl(0.025, 0.03, 3.2, 5), C.woodLight, [x, 1.6, -IN + 0.55], [0.12, 0, 0]);
      K.put('iron', new THREE.ConeGeometry(0.05, 0.3, 4), 0x8a8e94, [x, 3.3, -IN + 0.35], [0.12, 0, 0]);
    }
    // 장작더미
    for (let j = 0; j < 4; j++)
      for (let i = 0; i < 9 - j; i++)
        K.put('wood', cyl(0.12, 0.12, 1.1, 7), j % 2 ? C.woodLight : C.wood, [-13 + i * 0.25 + j * 0.12, 0.12 + j * 0.22, -IN + 0.8], [Math.PI / 2, 0, 0], 1, { vary: 0.25, snow: j === 3 ? 0.9 : 0.3 });
  }

  // ── 남쪽 성벽 가운데의 종탑 (네모난 탑 위 트인 종루, 눈 덮인 뾰족 지붕) ──
  const BELL = { x: 0, y: 22.1, z: -(IN + WT / 2) };
  {
    const bx = 0;
    const bz = BELL.z;
    const S = 6;
    K.put('stone', box(S, 18, S, 3, 9, 3), C.stone, [bx, 9, bz], [0, 0, 0], 1, { ...st, ...snowy });
    K.put('stone', box(S + 0.5, 0.6, S + 0.5), C.stoneDark, [bx, 18.3, bz], [0, 0, 0], 1, { ...st, snow: 0.95 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.put('stone', box(1.1, 4.6, 1.1), C.stone, [bx + sx * (S / 2 - 0.55), 20.9, bz + sz * (S / 2 - 0.55)], [0, 0, 0], 1, st);
    K.put('stone', box(S + 0.6, 0.7, S + 0.6), C.stoneDark, [bx, 23.55, bz], [0, 0, 0], 1, { ...st, snow: 0.95 });
    K.put('slate', new THREE.ConeGeometry(S * 0.78, 7, 4, 3), C.slate, [bx, 23.9 + 3.5, bz], [0, Math.PI / 4, 0], 1, { snow: 0.6 });
    K.put('iron', cyl(0.05, 0.07, 1.6, 5), C.iron, [bx, 23.9 + 7 + 0.7, bz]);
    K.put('wood', box(S - 1.4, 0.3, 0.3), C.woodDark, [bx, 22.5, bz]); // 종을 매단 들보
    // 안뜰 쪽 화살 구멍과 아치 창
    for (const hy of [6, 11, 15]) K.put('dark', box(0.25, 1.5, 0.2), C.dark, [bx, hy, bz + S / 2 + 0.01]);
  }

  // ── 화로와 횃불 받침 ──
  for (const [x, z] of braziers) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      limb(K, 'iron', [x + Math.cos(a) * 0.55, 0, z + Math.sin(a) * 0.55], [x + Math.cos(a) * 0.2, 0.95, z + Math.sin(a) * 0.2], 0.035, 0.03, C.iron, {}, 5);
    }
    K.put('iron', new THREE.CylinderGeometry(0.55, 0.32, 0.36, 12, 1, true), C.iron, [x, 1.1, z]);
    K.put('embers', new THREE.CircleGeometry(0.5, 12), 0xff5a1a, [x, 1.2, z], [-Math.PI / 2, 0, 0]);
  }
  for (const [x, z, nx, nz] of torches) {
    const tx = x - nx * 0.35;
    const tz = z - nz * 0.35;
    K.put('iron', box(0.08, 0.08, 0.5), C.iron, [x - nx * 0.18, 2.9, z - nz * 0.18], [0, nx ? Math.PI / 2 : 0, 0]);
    K.put('wood', cyl(0.05, 0.035, 0.6, 6), C.woodDark, [tx, 3.05, tz]);
    K.put('iron', new THREE.CylinderGeometry(0.1, 0.06, 0.18, 8, 1, true), C.iron, [tx, 3.35, tz]);
  }

  // ── 먼 설산 (성벽 너머로 봉우리만 보인다) ──
  {
    const layers = [
      { R: 160, base: 48, amp: 42, top: 0xb9c4d6, seed: 7 },
      { R: 260, base: 70, amp: 60, top: 0x8c98b2, seed: 8 },
    ];
    const fogC = new THREE.Color(FOG);
    for (const L of layers) {
      const NA = 240;
      const rr = rng(L.seed * 97);
      const ph = [rr() * 6, rr() * 6, rr() * 6, rr() * 6];
      const pos = [];
      const col = [];
      const top = new THREE.Color(L.top);
      for (let i = 0; i <= NA; i++) {
        const a = (i / NA) * Math.PI * 2;
        const n = 0.35 * Math.sin(3 * a + ph[0]) + 0.45 * Math.abs(Math.sin(7 * a + ph[1])) + 0.25 * Math.abs(Math.sin(17 * a + ph[2])) + 0.1 * Math.sin(41 * a + ph[3]);
        const hr = L.base + L.amp * n;
        const c = Math.cos(a);
        const s = Math.sin(a);
        pos.push(c * L.R * 0.8, -10, s * L.R * 0.8, c * L.R * 0.95, hr * 0.7, s * L.R * 0.95, c * L.R, hr, s * L.R);
        const mid = top.clone().lerp(fogC, 0.55);
        col.push(fogC.r, fogC.g, fogC.b, mid.r, mid.g, mid.b, top.r, top.g, top.b);
      }
      const idx = [];
      for (let i = 0; i < NA; i++) {
        const a = i * 3;
        const b = (i + 1) * 3;
        idx.push(a, b, a + 1, b, b + 1, a + 1, a + 1, b + 1, a + 2, b + 1, b + 2, a + 2);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx);
      scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));
    }
  }

  // ── 재질 (횃불·화로·창빛을 꼭짓점 색에 구워 넣는다) ──
  const warm = pointGlow([...glowPts, ...winPts]);
  const std = (p) => new THREE.MeshStandardMaterial({ vertexColors: true, ...p });
  const stoneMat = std({ map: ashlarTexture(), roughness: 0.95 });
  stoneMat.color.setScalar(1 / STONE_TEX_AVG);
  const meshes = [
    K.mesh('stone', stoneMat, { light: warm }),
    K.mesh('slate', std({ roughness: 0.7, flatShading: true }), { light: warm }),
    K.mesh('wood', std({ roughness: 0.9 }), { light: warm, cast: true }),
    K.mesh('straw', std({ roughness: 1, flatShading: true }), { light: warm }),
    K.mesh('horse', std({ roughness: 0.75 }), { light: warm }),
    K.mesh('iron', std({ roughness: 0.5, metalness: 0.6 }), { light: warm }),
    K.mesh('snow', std({ roughness: 0.9 }), { light: warm }),
    K.mesh('ice', std({ roughness: 0.15, metalness: 0.2 })),
    K.mesh('dark', std({ roughness: 1 })),
    K.mesh('glow', new THREE.MeshBasicMaterial({ vertexColors: true })),
    K.mesh('embers', new THREE.MeshBasicMaterial({ vertexColors: true })),
  ];
  for (const m of meshes) if (m) scene.add(m);

  // 종: 따로 매달아 흔든다 (큰 타격이 나오면 크게 울린다)
  const bellPivot = new THREE.Group();
  bellPivot.position.set(BELL.x, BELL.y, BELL.z);
  bellPivot.scale.setScalar(1.45);
  {
    const pts = [
      [0.02, 0],
      [0.4, 0.02],
      [0.46, -0.12],
      [0.5, -0.6],
      [0.62, -1.15],
      [0.72, -1.35],
      [0.66, -1.36],
    ].map(([a, b]) => new THREE.Vector2(a, b));
    // 오래된 청동: 은은한 광택 (반사 환경맵은 약하게), 해 질 녘에도 형태가 보일 만큼만 아주 약하게 스스로 빛난다
    const bellMat = new THREE.MeshStandardMaterial({ color: 0xaa8c4d, roughness: 0.35, metalness: 0.88, envMap: weaponEnv(), envMapIntensity: 1.15, emissive: 0x432d0e, emissiveIntensity: 0.35, side: THREE.DoubleSide });
    const bell = new THREE.Mesh(new THREE.LatheGeometry(pts, 24), bellMat);
    const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), bell.material);
    clapper.position.y = -1.15;
    bellPivot.add(bell, clapper);
  }
  scene.add(bellPivot);
  let bellAmp = 0.08;

  // ── 불꽃 (화로 셋씩, 횃불 둘씩): 인스턴싱 원뿔, 매 프레임 일렁인다 ──
  const flames = [];
  for (const [x, z] of braziers) for (let i = 0; i < 3; i++) flames.push({ x: x + (i - 1) * 0.16, y: 1.2, z: z + ((i % 2) - 0.5) * 0.14, s: 0.9 - Math.abs(i - 1) * 0.25, ph: r() * 6 });
  for (const [x, z, nx, nz] of torches) for (let i = 0; i < 2; i++) flames.push({ x: x - nx * 0.35, y: 3.42, z: z - nz * 0.35, s: 0.45 - i * 0.15, ph: r() * 6 });
  const flameGeo = new THREE.ConeGeometry(0.16, 0.7, 7);
  flameGeo.translate(0, 0.35, 0);
  const flameMesh = new THREE.InstancedMesh(
    flameGeo,
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
    flames.length * 2,
  );
  for (let i = 0; i < flames.length; i++) {
    flameMesh.setColorAt(i * 2, _c.set(0xff7a22));
    flameMesh.setColorAt(i * 2 + 1, _c.set(0xffd27a));
  }
  scene.add(flameMesh);

  // ── 눈송이 ──
  const FLAKES = 3200;
  const fr = rng(88);
  const fpos = new Float32Array(FLAKES * 3);
  const fsp = new Float32Array(FLAKES);
  const BOX = 24;
  for (let i = 0; i < FLAKES; i++) {
    fpos[i * 3] = (fr() - 0.5) * 2 * BOX;
    fpos[i * 3 + 1] = fr() * 16;
    fpos[i * 3 + 2] = (fr() - 0.5) * 2 * BOX;
    fsp[i] = 0.6 + fr() * 0.7;
  }
  const flakeGeo = new THREE.BufferGeometry();
  flakeGeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
  const flakes = new THREE.Points(flakeGeo, new THREE.PointsMaterial({ size: 0.085, map: flakeTexture(), transparent: true, depthWrite: false, color: 0xf2f5ff }));
  flakes.frustumCulled = false;
  scene.add(flakes);

  const fm = new THREE.Matrix4();
  const fq = new THREE.Quaternion();
  const fsc = new THREE.Vector3();
  let t = 0;
  let gust = 0;
  const step = (dt) => {
    // 불꽃
    for (let i = 0; i < flames.length; i++) {
      const f = flames[i];
      const w = 1 + 0.18 * Math.sin(t * 11 + f.ph) + 0.1 * Math.sin(t * 23 + f.ph * 2) + gust * 0.3;
      for (let k = 0; k < 2; k++) {
        const s = f.s * (k ? 0.55 : 1);
        fsc.set(s * (1 + 0.1 * Math.sin(t * 17 + f.ph)), s * w, s);
        fq.setFromAxisAngle(_v.set(Math.sin(t * 3 + f.ph), 0, Math.cos(t * 2.3 + f.ph)).normalize(), 0.12 * Math.sin(t * 7 + f.ph) + gust * 0.3);
        fm.compose(_v.set(f.x, f.y, f.z), fq, fsc);
        flameMesh.setMatrixAt(i * 2 + k, fm);
      }
    }
    flameMesh.instanceMatrix.needsUpdate = true;
    // 눈: 천천히 내리며 흔들리고, 큰 타격이 나오면 바람에 휘몰아친다
    const wx = 0.35 + gust * 4;
    const wz = 0.15 + gust * 1.5;
    for (let i = 0; i < FLAKES; i++) {
      const j = i * 3;
      fpos[j + 1] -= fsp[i] * dt * (1 - gust * 0.4);
      fpos[j] += (wx + Math.sin(t * 0.8 + i) * 0.3) * dt;
      fpos[j + 2] += (wz + Math.cos(t * 0.6 + i * 1.3) * 0.3) * dt;
      if (fpos[j + 1] < 0) fpos[j + 1] += 16;
      if (fpos[j] > BOX) fpos[j] -= 2 * BOX;
      if (fpos[j + 2] > BOX) fpos[j + 2] -= 2 * BOX;
    }
    flakeGeo.attributes.position.needsUpdate = true;
  };
  step(0);

  // 종 치기: 크게 흔들리는 동안 흔들림의 양 끝(잠깐 멈추는 때)마다 추가 종을 친다 → onEvent('bell') 로 알린다 (main.js → 소리).
  //  바람에 살짝 흔들리는 정도(0.05~0.08)로는 치지 않는다
  const BELL_RING = 0.1; // 이보다 크게 흔들려야 추가 닿는다 (라디안)
  const bellPos = { x: BELL.x, y: BELL.y - 1.1, z: BELL.z }; // 소리 자리: 종 입 언저리
  let bellCos = 1;

  const api = {
    sunOffset,
    onEvent: null, // main.js 가 채운다: (name, data) => …
    /** 큰 타격: 눈보라가 휘몰아치고 불꽃이 크게 일렁이고 종이 크게 흔들린다 */
    excite(amount) {
      gust = Math.min(1, gust + amount * 0.5);
      bellAmp = Math.min(0.55, bellAmp + amount * 0.4);
    },
    update(dt) {
      t += dt;
      gust = Math.max(0, gust - dt * 0.45);
      bellAmp = Math.max(0.05, bellAmp - dt * 0.08); // 바람에 늘 살짝 흔들린다
      bellPivot.rotation.x = bellAmp * Math.sin(t * 2.1);
      const c = Math.cos(t * 2.1);
      if (c > 0 !== bellCos > 0 && bellAmp > BELL_RING) api.onEvent?.('bell', { amp: bellAmp, max: 0.55, pos: bellPos });
      bellCos = c;
      step(dt);
    },
  };
  return api;
}

