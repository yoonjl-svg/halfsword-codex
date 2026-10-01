// ─────────────────────────────────────────────────────────────
//  배경 2: 한국의 산 속 절 (산사) — 대웅전 앞마당
//   마사토 앞마당 · 박석을 둥글게 깐 결투 자리(경기장 경계) · 정면의 대웅전(팔작지붕·단청·창호지 꽃살문·연등) ·
//   대웅전 앞 쌍탑(삼층 석탑)과 석등 · 한쪽 높은 축대 위의 사당(맞배지붕)과 붉은 홍살문 · 반대쪽 종각 ·
//   뒤쪽 일주문과 기와 얹은 돌담 · 담 너머 소나무·단풍, 겹겹이 물러나는 안개 낀 산등성이 · 떨어지는 단풍잎.
//  물리와는 무관한 그림만 만든다 (바닥·경계 벽은 main.js 가 그대로 만든다). 결투 자리 반지름은 ARENA.radius.
//  카메라가 도는 반지름(10.5m) 안에는 바닥에 붙은 납작한 돌만 둔다 — 높은 것은 전부 그 바깥.
//  폰에서도 가볍게: 재질별로 하나로 합치고(merge), 먼 숲은 인스턴싱. 질감은 캔버스에 코드로 그린 기와·흙 두 장뿐.
//  난수는 자체 rng 만 쓴다 (전역 Math.random 을 건드리지 않음).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { ARENA } from './config.js';
import { rng, h3, roughen, UP, _c, _v, Kit, box, cyl, limb, canvasTex } from './stage_kit.js';


// ── 색 ──
const C = {
  granite: 0xbdb6a8, // 화강암
  graniteDark: 0x9f998d,
  pillar: 0x7a2c20, // 기둥 (주칠)
  green: 0x3b7d6a, // 단청 뇌록·녹청
  greenDeep: 0x2c6150,
  red: 0x9b2d22,
  blue: 0x2c5b8c,
  white: 0xe9e4d8,
  gold: 0xc9a24a,
  paper: 0xece4cf, // 창호지
  lattice: 0x8a6440, // 문살
  plaster: 0xe3dccb, // 흰 회벽
  woodDark: 0x5b3a26,
  tile: 0xdfe1e4, // 기와 (질감에 곱해짐)
  ridge: 0x34373b, // 용마루·내림마루
  underside: 0x2f6a58, // 처마 밑 서까래 (녹청)
  bronze: 0x55624f, // 푸른 녹이 앉은 청동
  pine: 0x2e4630,
  bark: 0x7e4b33,
  wall: 0x9d9282, // 돌담
};

/** 기와: 가로(u) 한 장 = 볼록한 수키와 한 줄 + 오목한 암키와 골, 세로(v) 한 장 = 기와 한 장 길이 */
function tileTexture() {
  return canvasTex(64, 64, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#34373b');
    g.addColorStop(0.12, '#4d5156');
    g.addColorStop(0.27, '#6b6f74'); // 수키와 등(빛 받는 곳)
    g.addColorStop(0.42, '#4d5156');
    g.addColorStop(0.52, '#2e3134'); // 골
    g.addColorStop(0.75, '#43464a'); // 암키와
    g.addColorStop(1, '#34373b');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(0,0,0,0.28)';
    x.fillRect(0, h - 5, w, 5); // 기와 이음매
    x.fillStyle = 'rgba(255,255,255,0.06)';
    x.fillRect(0, h - 7, w, 2);
  });
}
const EARTH_AVG = 0.8; // 흙 질감의 평균 밝기(선형) — 꼭짓점 색을 이만큼 나눠서 원하는 색이 나오게
function earthTexture() {
  const r = rng(7);
  return canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#e8e8e8';
    x.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const v = 150 + Math.floor(r() * 105);
      x.fillStyle = `rgba(${v},${v},${v},${0.25 + r() * 0.4})`;
      const s = 0.8 + r() * 2.2;
      x.fillRect(r() * w, r() * h, s, s);
    }
    for (let i = 0; i < 90; i++) {
      x.fillStyle = `rgba(90,90,90,${0.05 + r() * 0.08})`;
      x.beginPath();
      x.ellipse(r() * w, r() * h, 6 + r() * 20, 3 + r() * 10, r() * 3, 0, Math.PI * 2);
      x.fill();
    }
  });
}
function skyTexture(sunAz) {
  const r = rng(3);
  return canvasTex(512, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#93aabd');
    g.addColorStop(0.3, '#b9c8d0');
    g.addColorStop(0.47, '#dde2de'); // 수평선 바로 위: 산 안개
    g.addColorStop(0.5, '#d6dbd7');
    g.addColorStop(1, '#c9cfcb');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    // 옅은 새털구름
    for (let i = 0; i < 40; i++) {
      x.fillStyle = `rgba(255,255,255,${0.05 + r() * 0.08})`;
      x.beginPath();
      x.ellipse(r() * w, h * (0.08 + r() * 0.32), 30 + r() * 90, 3 + r() * 7, 0, 0, Math.PI * 2);
      x.fill();
    }
    // 해 쪽 하늘이 조금 밝다 (구 안쪽에서 보는 u: 방위각 a → u = (π − a) / 2π)
    const u = ((((Math.PI - sunAz) / (Math.PI * 2)) % 1) + 1) % 1;
    for (const ux of [u * w, u * w - w, u * w + w]) {
      const rg = x.createRadialGradient(ux, h * 0.2, 0, ux, h * 0.2, h * 0.5);
      rg.addColorStop(0, 'rgba(255,248,230,0.45)');
      rg.addColorStop(1, 'rgba(255,248,230,0)');
      x.fillStyle = rg;
      x.fillRect(0, 0, w, h);
    }
  });
}

/**
 * 한국 지붕: 처마 곡선(안쪽으로 오목하게 내려앉는 지붕면) + 추녀 끝이 들리는 앙곡 + 모서리가 밖으로 뻗는 안허리.
 *  건물 기준으로 앞(−x)·뒤(+x)가 긴 지붕면, 옆(±z)이 합각/추녀 쪽. 원점 = 처마 끝 높이의 가운데.
 *  hip=false 면 맞배지붕, gable>0 이면 팔작지붕(위쪽이 합각 벽), gable=0 이면 우진각.
 *  반환: top(기와면, uv 있음) · under(처마 밑) · skirt(처마 끝 두께) · at(x0, z0, yOff) · Yf · Zg · Hg
 */
function roofGeo({ Ax, Az, H, lift = 0.8, flare = 0.07, t = 0.3, gable = 0.5, hip = true, step = 0.32 }) {
  const P = 1.45;
  const Yf = (d) => H * Math.pow(THREE.MathUtils.clamp(d / Ax, 0, 1), P);
  const dzg = gable * Ax;
  const Zg = Az - dzg;
  const Hg = Yf(dzg);
  const inner = (z0) => hip && gable > 0 && Math.abs(z0) < Zg - 1e-6;
  const baseY = (x0, z0) => {
    const dx = Ax - Math.abs(x0);
    if (!hip || inner(z0)) return Yf(dx);
    return Math.min(Yf(dx), Yf(Az - Math.abs(z0)));
  };
  const at = (x0, z0, yOff = 0) => {
    const y = baseY(x0, z0);
    const ex = Math.abs(x0) / Ax;
    const ez = Math.abs(z0) / Az;
    const e = hip ? Math.min(ex, ez) : ez;
    const low = 1 - y / H;
    const s = 1 + flare * e * e * low;
    return [x0 * s, y + lift * e ** 3 * low * low + yOff, z0 * s];
  };
  const lin = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
  const xs = lin(-Ax, Ax, 2 * Math.max(2, Math.ceil(Ax / step)));
  let zs;
  if (hip && gable > 0) {
    const nOut = Math.max(2, Math.ceil(dzg / step));
    const nIn = 2 * Math.max(1, Math.ceil(Zg / step));
    zs = [...lin(-Az, -Zg, nOut), ...lin(-Zg + 0.002, Zg - 0.002, nIn), ...lin(Zg, Az, nOut)];
  } else zs = lin(-Az, Az, 2 * Math.max(2, Math.ceil(Az / step)));
  const nx = xs.length;
  const nz = zs.length;
  const top = [];
  const bot = [];
  const uv = [];
  for (const x0 of xs)
    for (const z0 of zs) {
      const p = at(x0, z0);
      top.push(...p);
      bot.push(p[0], p[1] - t, p[2]);
      const dx = Ax - Math.abs(x0);
      const dz = Az - Math.abs(z0);
      const front = !hip || inner(z0) || dx <= dz;
      uv.push((front ? z0 : x0) / 0.34, (front ? dx : dz) / 0.42);
    }
  const idxTop = [];
  const idxBot = [];
  for (let i = 0; i < nx - 1; i++)
    for (let k = 0; k < nz - 1; k++) {
      const a = i * nz + k;
      const b = (i + 1) * nz + k;
      idxTop.push(a, a + 1, b, b, a + 1, b + 1);
      idxBot.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const mk = (pos, idx, uvs) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    if (uvs) g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  // 처마 끝 두께: 격자 가장자리를 한 바퀴 돌며 위·아래 면을 잇는다
  const loop = [];
  for (let k = 0; k < nz; k++) loop.push(k);
  for (let i = 1; i < nx; i++) loop.push(i * nz + nz - 1);
  for (let k = nz - 2; k >= 0; k--) loop.push((nx - 1) * nz + k);
  for (let i = nx - 2; i > 0; i--) loop.push(i * nz);
  const sk = [];
  for (let n = 0; n < loop.length; n++) {
    const p = loop[n];
    const q = loop[(n + 1) % loop.length];
    const T = (v) => top.slice(v * 3, v * 3 + 3);
    const Bm = (v) => bot.slice(v * 3, v * 3 + 3);
    sk.push(...T(p), ...Bm(p), ...T(q), ...T(q), ...Bm(p), ...Bm(q));
  }
  const skirt = new THREE.BufferGeometry();
  skirt.setAttribute('position', new THREE.Float32BufferAttribute(sk, 3));
  skirt.computeVertexNormals();
  return { top: mk(top, idxTop, uv), under: mk(bot, idxBot), skirt, at, Yf, Zg, Hg, dzg, Ax, Az, H, t };
}

/** 지붕 + 용마루·내림마루·추녀마루·합각을 얹는다. base: 처마 끝 높이. 반환: roofGeo 결과 */
function roof(K, o, base) {
  const R = roofGeo(o);
  const up = [0, base, 0];
  K.put('tile', R.top, C.tile, up, [0, 0, 0], 1, { vary: 0.04, noise: 0.05 });
  K.put('paint', R.under, C.underside, up, [0, 0, 0], 1, { vary: 0.03 });
  K.put('paint', R.skirt, 0x2d3033, up, [0, 0, 0], 1, { vary: 0.02 });
  const P = (x0, z0, dy = 0) => {
    const p = R.at(x0, z0, dy);
    return [p[0], p[1] + base, p[2]];
  };
  const rr = o.ridgeR ?? 0.12;
  const hip = o.hip ?? true;
  const gable = o.gable ?? 0.5;
  // 용마루: 흰 회반죽 띠 위에 검은 기와를 쌓은 마루, 양 끝이 살짝 치켜 올라간다
  const zr = hip ? (gable > 0 ? R.Zg : Math.max(0.05, R.Az - R.Ax)) : R.Az;
  const rh = o.ridgeH ?? 0.42;
  K.put('paint', box(rr * 3.4, rh, 2 * zr + rr * 2), C.ridge, [0, base + R.H + rh * 0.4, 0]);
  K.put('plaster', box(rr * 4, rh * 0.25, 2 * zr), C.white, [0, base + R.H + rh * 0.02, 0]);
  for (const s of [-1, 1]) K.put('paint', box(rr * 3.6, rh * 1.5, rr * 3), C.ridge, [0, base + R.H + rh * 0.9, s * (zr + rr * 0.6)], [s * -0.35, 0, 0]);
  const tubeAlong = (pts) => {
    for (let i = 0; i < pts.length - 1; i++) limb(K, 'paint', pts[i], pts[i + 1], rr, rr, C.ridge, { vary: 0 }, 6);
  };
  const N = 6;
  for (const sz of [-1, 1])
    for (const sx of [-1, 1]) {
      if (hip && gable > 0) {
        // 합각의 비탈진 가장자리(내림마루) + 합각 밑에서 추녀 끝까지 내려가는 추녀마루
        const w = R.Ax - R.dzg;
        tubeAlong(Array.from({ length: N + 1 }, (_, i) => P((sx * w * i) / N, sz * (R.Zg - 0.002), rr * 0.6)));
        tubeAlong(Array.from({ length: N + 1 }, (_, i) => {
          const s = R.dzg * (1 - i / N);
          return P(sx * (R.Ax - s), sz * (R.Az - s), rr * 0.6);
        }));
      } else if (hip) {
        tubeAlong(Array.from({ length: N + 1 }, (_, i) => {
          const s = R.Ax * (1 - i / N);
          return P(sx * (R.Ax - s), sz * (R.Az - s), rr * 0.6);
        }));
      } else {
        tubeAlong(Array.from({ length: N + 1 }, (_, i) => P((sx * R.Ax * i) / N, sz * R.Az, rr * 0.6)));
      }
    }
  // 합각 벽: 기와면이 끊기는 자리(z = ±Zg)에 세운 세모 널판 (검붉은 널 + 흰 테)
  if (hip && gable > 0) {
    const w = R.Ax - R.dzg;
    for (const sz of [-1, 1]) {
      const pos = [];
      const n = 8;
      for (let i = 0; i < n; i++) {
        const x0 = -w + (2 * w * i) / n;
        const x1 = -w + (2 * w * (i + 1)) / n;
        const a = P(x0, sz * (R.Zg - 0.002));
        const b = P(x1, sz * (R.Zg - 0.002));
        const c = P(x0, sz * R.Zg);
        const d = P(x1, sz * R.Zg);
        for (const q of [a, b, c, d]) q[2] += sz * 0.03;
        pos.push(...a, ...c, ...b, ...b, ...c, ...d);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      K.put('paint', g, 0x6e2a1f, [0, 0, 0], [0, 0, 0], 1, { vary: 0.04 });
    }
  }
  return R;
}

/**
 * 목조 건물 한 채 (건물 기준: 정면이 −x). pos: [x, y, z] (y = 땅 높이), rotY: 정면 방향 돌리기
 *  o: W(정면 기둥 폭) · D(옆 깊이) · bays(정면 칸) · sideBays · colH(기둥 높이) · plat(기단 높이) · over(처마 내밀기)
 *     roofH · gable · hip · doors('paper' | 'red' | null) · walls(false면 기둥만) · lanterns · plaque
 */
function building(K, pos, rotY, o) {
  K.push(pos, rotY);
  const { W, D, colH } = o;
  const P = o.plat ?? 0.9;
  const m = o.margin ?? 1.2;
  const pz = Array.from({ length: o.bays + 1 }, (_, i) => -W / 2 + (W * i) / o.bays);
  const px = Array.from({ length: (o.sideBays ?? 2) + 1 }, (_, i) => -D / 2 + (D * i) / (o.sideBays ?? 2));

  // ── 기단: 장대석을 한두 단 쌓고 앞에 돌계단 ──
  const tiers = P > 0.7 ? 2 : P > 0.05 ? 1 : 0;
  for (let j = 0; j < tiers; j++) {
    const grow = (tiers - 1 - j) * 0.7;
    const bx = D + 2 * m + grow;
    const bz = W + 2 * m + grow;
    const h = P / tiers;
    const ns = Math.max(2, Math.round(bz / 2.1));
    for (let s = 0; s < ns; s++) {
      const len = bz / ns;
      K.put('stone', box(bx, h - 0.015, len - 0.02, 2, 1, 2), C.granite, [0, h * (j + 0.5), -bz / 2 + len * (s + 0.5)], [0, 0, 0], 1, { rough: 0.02, vary: 0.12 });
    }
  }
  if (P > 0.2) {
    const n = Math.max(2, Math.round(P / 0.24));
    const sw = o.stairW ?? 3.2;
    const xf = -(D / 2 + m);
    for (let k = 1; k <= n; k++) {
      const x1 = xf - (n - k) * 0.36;
      K.put('stone', box(0.36, (P * k) / n, sw, 1, 1, 3), C.granite, [x1 - 0.18, (P * k) / n / 2, 0], [0, 0, 0], 1, { rough: 0.015, vary: 0.1 });
    }
    const L = n * 0.36;
    const th = Math.atan2(P, L);
    for (const s of [-1, 1])
      K.put('stone', box(Math.hypot(L, P) + 0.2, 0.28, 0.3), C.graniteDark, [xf - L / 2, P / 2 + 0.12, s * (sw / 2 + 0.15)], [0, 0, th], 1, { rough: 0.02 });
  }

  // ── 주춧돌 + 배흘림 기둥 ──
  const colPts = [];
  for (const x of px)
    for (const z of pz) if (x === px[0] || x === px[px.length - 1] || z === pz[0] || z === pz[pz.length - 1]) colPts.push([x, z]);
  const cr = o.colR ?? 0.25;
  const colGeo = new THREE.LatheGeometry(
    [new THREE.Vector2(cr * 0.9, 0), new THREE.Vector2(cr * 1.04, colH * 0.3), new THREE.Vector2(cr * 0.98, colH * 0.65), new THREE.Vector2(cr * 0.86, colH)],
    10,
  );
  for (const [x, z] of colPts) {
    K.put('stone', cyl(cr * 1.45, cr * 1.7, 0.26, 8), C.graniteDark, [x, P + 0.13, z], [0, 0.4, 0], 1, { rough: 0.03 });
    K.put('wood', colGeo, o.pillar ?? C.pillar, [x, P + 0.26, z], [0, 0, 0], 1, { vary: 0.06 });
  }
  const y0 = P + 0.26 + colH; // 기둥 머리

  // ── 네 면: 창방·평방(단청) · 공포 · 벽/문 ──
  const faces = [
    { rot: 0, half: D / 2, cols: pz, front: true },
    { rot: Math.PI, half: D / 2, cols: pz.slice().reverse().map((z) => -z), front: false },
    { rot: Math.PI / 2, half: W / 2, cols: px.map((x) => -x).sort((a, b) => a - b), front: false },
    { rot: -Math.PI / 2, half: W / 2, cols: px.slice().sort((a, b) => a - b), front: false },
  ];
  const bh = o.bracketH ?? 0.8;
  for (const f of faces) {
    K.push([0, 0, 0], f.rot);
    const x = -f.half;
    const len = f.cols[f.cols.length - 1] - f.cols[0];
    // 창방 (녹청 바탕) + 기둥 머리마다 머리초 (붉은·흰·파란 띠)
    K.put('paint', box(0.3, 0.36, len + 0.3), C.green, [x, y0 - 0.18, 0]);
    for (const cz of f.cols)
      for (const s of [-1, 1]) {
        if ((s < 0 && cz === f.cols[0]) || (s > 0 && cz === f.cols[f.cols.length - 1])) continue;
        K.put('paint', box(0.31, 0.34, 0.3), C.red, [x, y0 - 0.18, cz + s * 0.32]);
        K.put('paint', box(0.315, 0.34, 0.06), C.white, [x, y0 - 0.18, cz + s * 0.5]);
        K.put('paint', box(0.31, 0.34, 0.12), C.blue, [x, y0 - 0.18, cz + s * 0.59]);
      }
    // 평방
    K.put('paint', box(0.38, 0.2, len + 0.5), C.greenDeep, [x - 0.02, y0 + 0.1, 0]);
    // 공포 (다포): 기둥 위와 사이마다 층층이 내민 받침
    const nb = Math.max(2, Math.round(len / (o.bracketGap ?? 1.0)));
    for (let i = 0; i <= nb; i++) {
      const z = f.cols[0] + (len * i) / nb;
      K.put('paint', box(0.34, 0.16, 0.34), C.green, [x, y0 + 0.28, z]);
      K.put('paint', box(0.24, 0.14, 0.8), C.greenDeep, [x - 0.02, y0 + 0.43, z]);
      K.put('paint', box(0.62, 0.14, 0.22), C.green, [x - 0.22, y0 + 0.43, z]);
      K.put('paint', box(0.06, 0.12, 0.2), C.red, [x - 0.54, y0 + 0.43, z]);
      K.put('paint', box(0.24, 0.14, 1.05), C.greenDeep, [x - 0.14, y0 + 0.59, z]);
      K.put('paint', box(0.95, 0.14, 0.22), C.green, [x - 0.4, y0 + 0.59, z]);
      K.put('paint', box(0.06, 0.12, 0.2), C.red, [x - 0.88, y0 + 0.59, z]);
    }
    K.put('paint', box(0.5, bh - 0.66, len + 0.6), C.greenDeep, [x - 0.1, y0 + 0.68 + (bh - 0.66) / 2, 0]);

    // 벽·문
    if (o.walls !== false) {
      const lo = P + 0.26;
      for (let i = 0; i < f.cols.length - 1; i++) {
        const z0 = f.cols[i] + cr;
        const z1 = f.cols[i + 1] - cr;
        const bw = z1 - z0;
        const zc = (z0 + z1) / 2;
        K.put('wood', box(0.14, 0.16, bw), C.woodDark, [x + 0.05, lo + 0.08, zc]); // 하인방
        if (f.front && o.doors) {
          const top = y0 - 0.62;
          K.put('wood', box(0.14, 0.14, bw), C.woodDark, [x + 0.05, top + 0.07, zc]); // 상인방
          K.put('plaster', box(0.1, y0 - 0.36 - (top + 0.14), bw), C.plaster, [x + 0.1, (y0 - 0.36 + top + 0.14) / 2, zc]);
          const nd = bw > 2.1 ? 4 : bw > 1.4 ? 3 : 2;
          const dw = bw / nd;
          const dh = top - (lo + 0.16);
          const frame = o.doors === 'red' ? C.red : C.lattice;
          for (let d = 0; d < nd; d++) {
            const dz = z0 + dw * (d + 0.5);
            const yc = lo + 0.16 + dh / 2;
            K.put('plaster', box(0.04, dh - 0.08, dw - 0.08), C.paper, [x + 0.1, yc, dz]); // 창호지
            K.put('wood', box(0.08, dh * 0.24, dw - 0.08), frame, [x + 0.07, lo + 0.16 + dh * 0.12, dz]); // 궁창 (아래 널)
            // 문틀
            for (const s of [-1, 1]) K.put('wood', box(0.1, dh, 0.06), frame, [x + 0.06, yc, dz + s * (dw / 2 - 0.03)]);
            K.put('wood', box(0.1, 0.06, dw), frame, [x + 0.06, lo + 0.16 + dh - 0.03, dz]);
            // 살: 세로 3 + 가로 6 (띠살)
            const ly0 = lo + 0.16 + dh * 0.24;
            const lh = dh * 0.76 - 0.06;
            for (let v = 1; v <= 3; v++) K.put('wood', box(0.05, lh, 0.03), frame, [x + 0.06, ly0 + lh / 2, dz - dw / 2 + (dw * v) / 4]);
            for (let hN = 1; hN <= 6; hN++) K.put('wood', box(0.05, 0.03, dw - 0.08), frame, [x + 0.06, ly0 + (lh * hN) / 7, dz]);
          }
        } else {
          // 흰 회벽 + 가운데 중인방 (나무)
          const hgt = y0 - 0.36 - (lo + 0.16);
          K.put('plaster', box(0.16, hgt, bw), C.plaster, [x + 0.08, lo + 0.16 + hgt / 2, zc], [0, 0, 0], 1, { noise: 0.03 });
          K.put('wood', box(0.2, 0.14, bw), C.woodDark, [x + 0.06, lo + 0.16 + hgt * 0.45, zc]);
        }
      }
    }
    // 처마 밑 연등 (정면)
    if (f.front && o.lanterns) {
      const cols = [0xd8485a, 0xe8a63a, 0x4c9a6a, 0xe86a8a, 0x3f6fb5, 0xd8485a, 0xf0d060];
      const n = Math.round(len / 1.05);
      for (let i = 0; i <= n; i++) {
        const z = f.cols[0] + (len * i) / n;
        const ly = y0 - 0.9 - (i % 2) * 0.2;
        const lx = x - 1.05;
        K.put('lamp', new THREE.IcosahedronGeometry(0.21, 1), cols[i % cols.length], [lx, ly, z], [0, 0, 0], [1, 0.85, 1], { vary: 0.05, noise: 0.1 });
        K.put('lamp', cyl(0.05, 0.02, 0.18, 5), 0xf0ece0, [lx, ly - 0.26, z]);
        limb(K, 'wood', [lx, ly + 0.17, z], [lx, y0 + 0.66, z], 0.008, 0.008, 0x2b2622, {}, 3);
      }
    }
    K.pop();
  }

  // 현판 (글씨 대신 금빛 테두리와 무늬만)
  if (o.plaque) {
    const pw = o.plaque;
    K.put('paint', box(0.08, 0.72, pw), 0x2b2420, [-D / 2 - 0.62, y0 + 0.12, 0], [0, 0, 0.18]);
    K.put('paint', box(0.06, 0.82, pw + 0.12), C.gold, [-D / 2 - 0.58, y0 + 0.12, 0], [0, 0, 0.18]);
    for (let i = -1; i <= 1; i++) K.put('paint', box(0.03, 0.38, 0.08), C.gold, [-D / 2 - 0.66, y0 + 0.13, i * pw * 0.26], [0, 0, 0.18]);
  }

  // ── 지붕 ──
  const over = o.over ?? 1.9;
  const Ax = D / 2 + over;
  const Az = W / 2 + over;
  const rH = o.roofH ?? Ax * 0.8;
  const t = o.roofT ?? 0.3;
  const Yf = (d) => rH * Math.pow(d / Ax, 1.45);
  const base = y0 + bh - Yf(over) + t;
  const R = roof(K, { Ax, Az, H: rH, t, lift: o.lift ?? 0.75, gable: o.gable ?? 0.5, hip: o.hip ?? true, flare: 0.07, ridgeR: o.ridgeR }, base);

  // 추녀 끝 풍경 (청동 종 + 물고기)
  if (o.hip !== false)
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const p = R.at(sx * Ax * 0.97, sz * Az * 0.97);
        const bx = p[0];
        const by = p[1] + base - t - 0.25;
        const bz = p[2];
        limb(K, 'wood', [bx, by + 0.2, bz], [bx, by + 0.05, bz], 0.008, 0.008, 0x2b2622, {}, 3);
        K.put('bronze', cyl(0.035, 0.08, 0.16, 8), C.bronze, [bx, by - 0.03, bz]);
        K.put('bronze', box(0.01, 0.12, 0.16), C.bronze, [bx, by - 0.25, bz]);
      }
  K.pop();
  return { y0, base, R };
}

/** 삼층 석탑 */
function pagoda(K, x, y, z) {
  K.push([x, y, z], 0.0);
  let h = 0;
  const b = (w, hh, c = C.granite, rough = 0.018) => {
    K.put('stone', box(w, hh, w, 2, 1, 2), c, [0, h + hh / 2, 0], [0, 0, 0], 1, { rough, vary: 0.07 });
    h += hh;
  };
  b(3.5, 0.25, C.graniteDark);
  b(2.9, 0.75);
  b(3.1, 0.18);
  b(2.3, 0.95);
  b(2.55, 0.2);
  const stories = [
    [1.3, 1.15, 2.2],
    [1.05, 0.6, 1.85],
    [0.88, 0.55, 1.55],
  ];
  for (const [bw, bhh, rw] of stories) {
    b(bw + 0.14, 0.08);
    const y1 = h;
    b(bw, bhh);
    // 우주(모서리 기둥 조각)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.put('stone', box(0.12, bhh, 0.12), C.granite, [(sx * bw) / 2, y1 + bhh / 2, (sz * bw) / 2], [0, 0, 0], 1, { vary: 0.03 });
    // 층급받침 4단
    for (let s = 0; s < 4; s++) b(bw + 0.1 + (s * (rw - bw - 0.3)) / 3, 0.055, C.granite, 0.008);
    const R = roofGeo({ Ax: rw / 2, Az: rw / 2, H: rw * 0.17, t: 0.13, lift: 0.1, flare: 0.05, gable: 0, step: 0.12 });
    for (const g of [R.top, R.under, R.skirt]) K.put('stone', g, C.granite, [0, h + 0.13, 0], [0, 0, 0], 1, { vary: 0.03 });
    h += 0.13 + rw * 0.17 * 0.45;
  }
  // 상륜부
  b(0.46, 0.22);
  K.put('stone', new THREE.SphereGeometry(0.26, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), C.granite, [0, h, 0]);
  h += 0.22;
  K.put('stone', cyl(0.3, 0.14, 0.16, 8), C.granite, [0, h + 0.08, 0]);
  h += 0.16;
  for (let i = 0; i < 5; i++) K.put('bronze', cyl(0.17 - i * 0.012, 0.17 - i * 0.012, 0.05, 10), 0x4a4a40, [0, h + 0.05 + i * 0.13, 0]);
  K.put('bronze', cyl(0.03, 0.035, 1.0, 6), 0x3c3a36, [0, h + 0.5, 0]);
  K.put('bronze', new THREE.SphereGeometry(0.08, 8, 6), 0x4a4a40, [0, h + 1.02, 0]);
  K.pop();
}

/** 석등 (팔각) */
function stoneLantern(K, x, y, z) {
  K.push([x, y, z], Math.PI / 8);
  const o = { rough: 0.012, vary: 0.05 };
  K.put('stone', box(1.1, 0.16, 1.1), C.graniteDark, [0, 0.08, 0], [0, 0, 0], 1, o);
  K.put('stone', cyl(0.42, 0.48, 0.28, 8), C.granite, [0, 0.3, 0], [0, 0, 0], 1, o);
  K.put('stone', cyl(0.3, 0.44, 0.12, 8), C.granite, [0, 0.5, 0], [0, 0, 0], 1, o); // 복련
  K.put('stone', cyl(0.13, 0.14, 1.1, 8), C.granite, [0, 1.11, 0], [0, 0, 0], 1, o); // 간주석
  K.put('stone', cyl(0.44, 0.24, 0.22, 8), C.granite, [0, 1.77, 0], [0, 0, 0], 1, o); // 앙련
  K.put('stone', cyl(0.27, 0.27, 0.55, 8), C.granite, [0, 2.155, 0], [0, 0, 0], 1, o); // 화사석
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    K.put('lampGlow', box(0.05, 0.3, 0.16), 0x3a2410, [Math.cos(a) * 0.25, 2.16, Math.sin(a) * 0.25], [0, -a, 0]);
  }
  K.put('stone', cyl(0.12, 0.66, 0.3, 8), C.granite, [0, 2.58, 0], [0, 0, 0], 1, o); // 옥개석
  K.put('stone', cyl(0.62, 0.6, 0.07, 8), C.granite, [0, 2.44, 0], [0, 0, 0], 1, o);
  K.put('stone', cyl(0.07, 0.1, 0.16, 8), C.granite, [0, 2.8, 0]);
  K.put('stone', new THREE.SphereGeometry(0.1, 8, 6), C.granite, [0, 2.95, 0]);
  K.pop();
}

/** 홍살문: 붉은 기둥 둘, 가로대 둘, 위로 촘촘한 붉은 살 */
function hongsalmun(K, pos, rotY, span = 4.6) {
  K.push(pos, rotY);
  const H = 6.2;
  for (const s of [-1, 1]) {
    K.put('stone', box(0.62, 0.35, 0.62), C.granite, [0, 0.17, (s * span) / 2], [0, 0, 0], 1, { rough: 0.02 });
    K.put('wood', cyl(0.13, 0.15, H, 10), C.red, [0, 0.35 + H / 2, (s * span) / 2]);
  }
  const yb0 = H - 1.4;
  const yb1 = H - 0.1;
  K.put('wood', box(0.16, 0.18, span + 0.5), C.red, [0, yb0, 0]);
  K.put('wood', box(0.16, 0.18, span + 0.5), C.red, [0, yb1, 0]);
  const n = 17;
  for (let i = 1; i < n; i++) {
    const z = -span / 2 + (span * i) / n;
    K.put('wood', box(0.05, 1.9, 0.05), C.red, [0, yb0 + 0.95, z]);
    K.put('wood', new THREE.ConeGeometry(0.05, 0.16, 4), C.red, [0, yb0 + 1.97, z]);
  }
  // 가운데 둥근 장식판 (붉고 검은 소용돌이 대신 삼색 원만)
  K.put('paint', cyl(0.3, 0.3, 0.06, 16), C.red, [0, (yb0 + yb1) / 2 + 0.1, 0], [0, 0, Math.PI / 2]);
  K.put('paint', cyl(0.18, 0.18, 0.07, 16), C.blue, [0, (yb0 + yb1) / 2 + 0.1, 0], [0, 0, Math.PI / 2]);
  K.put('paint', cyl(0.07, 0.07, 0.08, 12), C.gold, [0, (yb0 + yb1) / 2 + 0.1, 0], [0, 0, Math.PI / 2]);
  K.pop();
}

/** 범종 (종각 안에 매단다) */
function bell(K, x, yTop, z) {
  const pts = [
    [0.02, 1.35],
    [0.36, 1.33],
    [0.42, 1.22],
    [0.45, 0.8],
    [0.5, 0.3],
    [0.57, 0.08],
    [0.58, 0],
    [0.52, 0.02],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  K.put('bronze', new THREE.LatheGeometry(pts, 20), C.bronze, [x, yTop - 1.5, z], [0, 0, 0], 1, { vary: 0.04, noise: 0.12 });
  K.put('bronze', new THREE.TorusGeometry(0.12, 0.04, 6, 12), C.bronze, [x, yTop - 0.05, z]); // 용뉴
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + 0.3;
    K.put('bronze', cyl(0.07, 0.07, 0.04, 10), 0x6a7058, [x + Math.cos(a) * 0.49, yTop - 1.32, z + Math.sin(a) * 0.49], [0, -a, Math.PI / 2 - 0.12]);
  }
}

/** 소나무: 붉은 줄기가 비스듬히 굽고, 층층이 납작한 솔잎 뭉치 */
function pine(K, r, x, gy, z, h) {
  const la = r() * Math.PI * 2;
  const lean = 0.8 + r() * 1.6;
  const pts = [];
  for (let k = 0; k <= 4; k++) {
    const t = k / 4;
    const off = lean * t ** 1.4 + Math.sin(t * 5 + la) * 0.2;
    pts.push([x + Math.cos(la) * off, gy + h * t, z + Math.sin(la) * off]);
  }
  const r0 = 0.12 + h * 0.022;
  for (let k = 0; k < 4; k++) limb(K, 'bark', pts[k], pts[k + 1], r0 * (1 - k * 0.2), r0 * (1 - (k + 1) * 0.2) + 0.02, C.bark, { vary: 0.1, noise: 0.15 });
  const clump = (p, s) => {
    K.put('foliage', new THREE.IcosahedronGeometry(1, 1), C.pine, p, [0, r() * 3, 0], [1.5 * s, 0.5 * s, 1.3 * s], { vary: 0.16, noise: 0.14, rough: 0.25 * s });
  };
  clump([pts[4][0], pts[4][1] + 0.2, pts[4][2]], 1.1 + r() * 0.5);
  const nb = 2 + Math.floor(r() * 3);
  for (let i = 0; i < nb; i++) {
    const t = 0.5 + r() * 0.35;
    const k = Math.min(3, Math.floor(t * 4));
    const f = t * 4 - k;
    const a = pts[k];
    const b = pts[k + 1];
    const base = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    const ba = r() * Math.PI * 2;
    const bl = 1.2 + r() * 1.4;
    const end = [base[0] + Math.cos(ba) * bl, base[1] + 0.3 + r() * 0.5, base[2] + Math.sin(ba) * bl];
    limb(K, 'bark', base, end, r0 * 0.4, r0 * 0.2, C.bark, { vary: 0.1 });
    clump([end[0], end[1] + 0.15, end[2]], 0.75 + r() * 0.45);
  }
}

/** 단풍나무: 가는 줄기 + 둥근 붉은/주황 잎 뭉치 */
function maple(K, r, x, gy, z, h) {
  const cols = [0xb8321f, 0xc9502a, 0xd27a2e, 0xa82a22];
  const c = cols[Math.floor(r() * cols.length)];
  const top = [x + (r() - 0.5) * 0.6, gy + h * 0.62, z + (r() - 0.5) * 0.6];
  limb(K, 'bark', [x, gy, z], top, 0.16, 0.1, 0x4a3a30, { vary: 0.1 });
  for (let i = 0; i < 6; i++) {
    const a = r() * Math.PI * 2;
    const d = i === 0 ? 0 : 0.7 + r() * 0.8;
    const s = 0.9 + r() * 0.6;
    const p = [top[0] + Math.cos(a) * d, top[1] + 0.5 + r() * 1.0, top[2] + Math.sin(a) * d];
    if (i > 0) limb(K, 'bark', top, p, 0.07, 0.04, 0x4a3a30);
    K.put('foliage', new THREE.IcosahedronGeometry(1, 1), c, p, [0, r() * 3, 0], [s, s * 0.8, s], { vary: 0.2, noise: 0.18, rough: 0.2 * s });
  }
}

/**
 * 산사 경기장을 만든다. 반환: { update(dt), excite(amount), sunOffset }
 *  lights: main.js 의 { hemi, sun } — 산 아침빛으로 바꾼다. sunOffset: 해가 따라다닐 때의 방향 (정면 전각을 비추게 −x 쪽에서)
 */
export function buildTemple(scene, lights = {}) {
  const r = rng(2024);
  const K = new Kit(77);
  const FOG = 0xd3d8d4;
  const sunOffset = { x: -4, y: 9, z: 2.5 };
  scene.background = new THREE.Color(FOG);
  scene.fog = new THREE.Fog(FOG, 40, 560);
  if (lights.hemi) {
    lights.hemi.color.set(0xe6ece8);
    lights.hemi.groundColor.set(0x6d6450);
    lights.hemi.intensity = 1.15;
  }
  if (lights.sun) {
    lights.sun.color.set(0xfff1dc);
    lights.sun.intensity = 1.65;
    lights.sun.position.set(sunOffset.x, sunOffset.y, sunOffset.z);
  }

  // ── 하늘 ──
  scene.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(600, 48, 24),
      new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, depthWrite: false, map: skyTexture(Math.atan2(sunOffset.z, sunOffset.x)) }),
    ),
  );

  // ── 땅: 담 안은 평평한 마사토 앞마당, 담 밖은 산비탈 (대웅전 뒤 +x 쪽이 가장 가파르다) ──
  const X0 = -20.5; // 일주문 쪽 담
  const X1 = 26; // 대웅전 뒤
  const ZW = 21; // 옆 담
  const outside = (x, z) => Math.hypot(Math.max(X0 - x, x - X1, 0), Math.max(Math.abs(z) - ZW, 0));
  const groundY = (x, z) => {
    const s = outside(x, z);
    if (s <= 0) return 0;
    const a = Math.atan2(z, x - 3);
    const k = 0.5 + 0.8 * Math.max(0, Math.cos(a)) + 0.3 * Math.abs(Math.sin(a));
    return k * (0.13 * s + 0.004 * s * s);
  };
  {
    const RR = [0, 1.5, 3, 4.5, 6, 7.5, 9, 11, 13, 15, 17, 19, 21, 23, 25.5, 28, 31, 34, 38, 42, 47, 52, 58, 64, 71, 78, 86];
    const NA = 160;
    const pos = [0, 0, 0];
    const uv = [0, 0];
    const col = [];
    const cSand = new THREE.Color(0xc4b99f);
    const cMoss = new THREE.Color(0x8b8763);
    const cFloor = new THREE.Color(0x56603f);
    const cFloor2 = new THREE.Color(0x6b6446);
    const cHigh = new THREE.Color(0x3f5236);
    const tmp = new THREE.Color();
    const colorAt = (x, z, y) => {
      const s = outside(x, z);
      if (s <= 0) {
        const din = Math.min(x - X0, X1 - x, ZW - Math.abs(z));
        tmp.copy(cSand).lerp(cMoss, THREE.MathUtils.clamp(1 - din / 1.4, 0, 1) * 0.8);
      } else {
        tmp.copy(cFloor).lerp(cFloor2, h3(x * 0.15, 0, z * 0.15, 9));
        tmp.lerp(cHigh, THREE.MathUtils.clamp(y / 40, 0, 1));
        if (s < 1.2) tmp.lerp(cMoss, 1 - s / 1.2);
      }
      const n = 1 + (h3(x * 0.7, 1, z * 0.7, 3) - 0.5) * 0.12;
      col.push((tmp.r * n) / EARTH_AVG, (tmp.g * n) / EARTH_AVG, (tmp.b * n) / EARTH_AVG);
    };
    colorAt(0, 0, 0);
    for (let k = 1; k < RR.length; k++)
      for (let i = 0; i < NA; i++) {
        const a = (i / NA) * Math.PI * 2;
        const x = Math.cos(a) * RR[k];
        const z = Math.sin(a) * RR[k];
        const y = groundY(x, z);
        pos.push(x, y, z);
        uv.push(x / 5, z / 5);
        colorAt(x, z, y);
      }
    const idx = [];
    for (let i = 0; i < NA; i++) idx.push(0, 1 + ((i + 1) % NA), 1 + i);
    for (let k = 0; k < RR.length - 2; k++)
      for (let i = 0; i < NA; i++) {
        const a0 = 1 + k * NA + i;
        const a1 = 1 + k * NA + ((i + 1) % NA);
        idx.push(a0, a1, a0 + NA, a1, a1 + NA, a0 + NA);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: earthTexture(), vertexColors: true, roughness: 1 }));
    ground.receiveShadow = true;
    scene.add(ground);
  }

  // ── 결투 자리: 박석을 둥글게 깐 테두리 (경기장 경계) ──
  {
    const R0 = ARENA.radius + 0.2;
    const n = 46;
    for (let i = 0; i < n; i++) {
      const a = ((i + (r() - 0.5) * 0.25) / n) * Math.PI * 2;
      const w = 0.62 + r() * 0.16;
      const d = (Math.PI * 2 * R0) / n - 0.05 - r() * 0.05;
      K.put('nearStone', box(w, 0.14, d, 2, 1, 2), C.granite, [Math.cos(a) * (R0 + (r() - 0.5) * 0.08), -0.02 + r() * 0.03, Math.sin(a) * (R0 + (r() - 0.5) * 0.08)], [0, -a, 0], 1, {
        rough: 0.035,
        vary: 0.16,
      });
    }
    // 일주문 → 결투 자리, 결투 자리 → 대웅전 계단으로 이어지는 박석 길
    const path = (xa, xb) => {
      for (let x = xa; x < xb - 0.3; ) {
        const len = 0.55 + r() * 0.35;
        let z = -1.1;
        while (z < 1.05) {
          const w = 0.5 + r() * 0.35;
          const ww = Math.min(w, 1.1 - z);
          K.put('nearStone', box(len - 0.05, 0.1, ww - 0.05, 2, 1, 2), C.granite, [x + len / 2, -0.03 + r() * 0.02, z + ww / 2], [0, (r() - 0.5) * 0.06, 0], 1, { rough: 0.03, vary: 0.18 });
          z += ww;
        }
        x += len;
      }
    };
    path(X0 + 0.5, -ARENA.radius - 0.7);
    path(ARENA.radius + 0.7, 13.0);
  }

  // ── 대웅전 (정면 5칸, 팔작지붕, 단청, 꽃살문, 연등) ──
  const HALL_X = 19.5;
  building(K, [HALL_X, 0, 0], 0, {
    W: 14,
    D: 6.8,
    bays: 5,
    sideBays: 3,
    colH: 3.9,
    colR: 0.27,
    plat: 1.2,
    margin: 1.3,
    over: 2.2,
    roofH: 4.3,
    gable: 0.52,
    doors: 'paper',
    lanterns: true,
    plaque: 2.2,
    stairW: 3.6,
    ridgeR: 0.15,
  });
  stoneLantern(K, 11.9, 0, 0);
  pagoda(K, 12.4, 0, -7.6);
  pagoda(K, 12.4, 0, 7.6);

  // ── 사당 (높은 축대 위, 맞배지붕, 붉은 문) + 홍살문 ──
  {
    const zc = 16.4;
    // 축대: 막돌을 쌓은 석축
    const tw = 8.6;
    const td = 5.6;
    const th = 1.1;
    const r2 = rng(51);
    for (let yy = 0; yy < th - 0.01; yy += 0.28)
      for (let xx = -tw / 2; xx < tw / 2 - 0.05; ) {
        const len = 0.45 + r2() * 0.4;
        const L = Math.min(len, tw / 2 - xx);
        K.put('stone', box(L - 0.03, 0.26, 0.4, 1, 1, 1), C.graniteDark, [xx + L / 2, yy + 0.13, zc - td / 2 + 0.2], [0, 0, 0], 1, { rough: 0.05, vary: 0.2 });
        xx += L;
      }
    K.put('stone', box(tw, th, td - 0.4), 0x8f887c, [0, th / 2, zc + 0.2], [0, 0, 0], 1, { rough: 0.02 });
    K.put('stone', box(tw + 0.1, 0.1, td + 0.1), C.granite, [0, th + 0.05, zc], [0, 0, 0], 1, { rough: 0.01 });
    building(K, [0, th + 0.1, zc + 0.3], -Math.PI / 2, {
      W: 5.2,
      D: 3.0,
      bays: 3,
      sideBays: 1,
      colH: 2.7,
      colR: 0.2,
      plat: 0.35,
      margin: 0.55,
      over: 1.25,
      roofH: 2.2,
      hip: false,
      lift: 0.25,
      doors: 'red',
      pillar: 0x6e2b20,
      bracketH: 0.72,
      bracketGap: 0.9,
      ridgeR: 0.1,
    });
    // 축대 앞 돌계단
    for (let k = 1; k <= 4; k++) K.put('stone', box(2.2, (th * k) / 4, 0.36), C.granite, [0, (th * k) / 8, zc - td / 2 - (4 - k) * 0.36 - 0.18], [0, 0, 0], 1, { rough: 0.015, vary: 0.1 });
    hongsalmun(K, [0, 0, 11.7], Math.PI / 2, 4.6);
  }

  // ── 종각 (사방이 트인 누각, 범종) ──
  {
    const bx = -4;
    const bz = -15.6;
    const { y0 } = building(K, [bx, 0, bz], Math.PI / 2, {
      W: 3.4,
      D: 3.4,
      bays: 1,
      sideBays: 1,
      colH: 3.1,
      colR: 0.22,
      plat: 0.55,
      margin: 0.7,
      over: 1.4,
      roofH: 2.3,
      gable: 0.5,
      walls: false,
      bracketGap: 0.85,
    });
    K.put('wood', box(0.22, 0.24, 3.6), C.greenDeep, [bx, y0 - 0.5, bz]);
    bell(K, bx, y0 - 0.62, bz);
  }

  // ── 일주문 (기둥 둘, 무거운 맞배지붕) ──
  building(K, [X0, 0, 0], Math.PI, {
    W: 3.8,
    D: 0.02,
    bays: 1,
    sideBays: 1,
    colH: 4.1,
    colR: 0.33,
    plat: 0.0,
    margin: 0.4,
    over: 1.5,
    roofH: 1.5,
    hip: false,
    lift: 0.4,
    walls: false,
    bracketH: 1.0,
    bracketGap: 0.55,
    plaque: 1.4,
  });

  // ── 돌담 (막돌 담 + 기와 얹은 담장) ──
  const wall = (x1, z1, x2, z2) => {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const L = Math.hypot(dx, dz);
    K.push([(x1 + x2) / 2, 0, (z1 + z2) / 2], Math.atan2(-dz, dx));
    K.put('stone', box(L, 1.45, 0.56, Math.ceil(L / 0.45), 4, 1), C.wall, [0, 0.72, 0], [0, 0, 0], 1, { rough: 0.14, vary: 0.05, noise: 0.22 });
    const sh = new THREE.Shape();
    sh.moveTo(-0.52, 0);
    sh.lineTo(0.52, 0);
    sh.lineTo(0, 0.34);
    sh.closePath();
    const pr = new THREE.ExtrudeGeometry(sh, { depth: L + 0.1, bevelEnabled: false });
    pr.translate(0, 0, -(L + 0.1) / 2);
    K.put('paint', pr, 0x45484d, [0, 1.45, 0], [0, Math.PI / 2, 0], 1, { vary: 0.03 });
    K.put('plaster', box(L + 0.06, 0.1, 0.6), C.white, [0, 1.47, 0]);
    K.pop();
  };
  wall(X0, -ZW, X0, -2.5);
  wall(X0, 2.5, X0, ZW);
  wall(X0, -ZW, X1, -ZW);
  wall(X0, ZW, X1, ZW);

  // ── 나무: 담 안 모퉁이의 소나무·단풍, 담 밖 비탈의 소나무 ──
  pine(K, r, -18.3, 0, 18.8, 7.5);
  pine(K, r, -18.6, 0, -18.2, 8.5);
  pine(K, r, 24.5, 0, -18.5, 9);
  maple(K, r, 8.5, 0, 19.2, 4.6);
  maple(K, r, 5.5, 0, -19.3, 4.2);
  maple(K, r, -15, 0, 19.5, 4.0);
  maple(K, r, -13.5, 0, -19.4, 4.4);
  maple(K, r, 24, 0, 18.8, 5);
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2 + (r() - 0.5) * 0.12;
    const d = 30 + r() * 12;
    const x = Math.cos(a) * d * 1.15 + 3;
    const z = Math.sin(a) * d;
    if (outside(x, z) < 1.8) continue;
    (r() < 0.2 ? maple : pine)(K, r, x, groundY(x, z) - 0.2, z, 7 + r() * 5);
  }

  // ── 재질 ──
  const std = (p) => new THREE.MeshStandardMaterial({ vertexColors: true, ...p });
  const tileTex = tileTexture();
  const meshes = [
    K.mesh('stone', std({ roughness: 0.95, flatShading: true })),
    K.mesh('nearStone', std({ roughness: 0.95, flatShading: true }), { cast: true }),
    K.mesh('wood', std({ roughness: 0.8 })),
    K.mesh('paint', std({ roughness: 0.75, side: THREE.DoubleSide })),
    K.mesh('plaster', std({ roughness: 0.95 })),
    K.mesh('tile', std({ map: tileTex, roughness: 0.85, side: THREE.DoubleSide })),
    K.mesh('bronze', std({ roughness: 0.45, metalness: 0.55 })),
    K.mesh('lamp', std({ roughness: 0.85, emissive: 0x3a2a18, emissiveIntensity: 0.6 })),
    K.mesh('lampGlow', std({ roughness: 1, emissive: 0xffa040, emissiveIntensity: 0.5 })),
    K.mesh('bark', std({ roughness: 1 })),
    K.mesh('foliage', std({ roughness: 1, flatShading: true })),
  ];
  for (const m of meshes) if (m) scene.add(m);

  // ── 산비탈 숲 (인스턴싱: 둥근 나무 뭉치, 가을이라 드문드문 단풍) ──
  //  가까운 띠는 조금 둥글게(면 80), 먼 띠는 안개에 묻히니 거칠게(면 20) — 폰에서 삼각형 수를 아낀다
  {
    const greens = [0x2d452f, 0x344e33, 0x3e5a3a, 0x283f2c, 0x46603d];
    const autumn = [0x8e3a24, 0xa0562a, 0x8c7432];
    const rf = rng(99);
    const band = (N, d0, d1, detail) => {
      const geo = new THREE.IcosahedronGeometry(1, detail);
      roughen(geo, detail ? 0.35 : 0.2, 21 + detail);
      geo.computeVertexNormals();
      const inst = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), N);
      const m4 = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      let n = 0;
      for (let tries = 0; tries < N * 8 && n < N; tries++) {
        const a = rf() * Math.PI * 2;
        const d = d0 + rf() * (d1 - d0);
        const x = Math.cos(a) * d;
        const z = Math.sin(a) * d;
        if (outside(x, z) < 3.5) continue;
        const w = 1.3 + rf() * 1.0 + d * 0.012;
        const h = 2.0 + rf() * 1.4 + d * 0.015;
        q.setFromAxisAngle(UP, rf() * 3);
        m4.compose(new THREE.Vector3(x, groundY(x, z) + h * 0.75, z), q, new THREE.Vector3(w, h, w));
        inst.setMatrixAt(n, m4);
        _c.set(rf() < 0.1 ? autumn[Math.floor(rf() * 3)] : greens[Math.floor(rf() * 5)]);
        inst.setColorAt(n, _c);
        n++;
      }
      inst.count = n;
      scene.add(inst);
    };
    band(330, 23, 46, 1);
    band(520, 44, 86, 0);
  }

  // ── 겹겹의 산등성이 (산수화처럼 멀수록 옅게, 골짜기는 안개로 흐리게) ──
  {
    const edgeY = (a) => groundY(Math.cos(a) * 86, Math.sin(a) * 86);
    const layers = [
      { R: 120, base: (a) => edgeY(a) * 1.25 + 16, amp: 24, top: 0x3f5a4a, seed: 1 },
      { R: 175, base: (a) => 55 + 35 * Math.max(0, Math.cos(a)), amp: 40, top: 0x5c7874, seed: 2 },
      { R: 250, base: () => 80, amp: 55, top: 0x8198a2, seed: 3 },
      { R: 340, base: () => 100, amp: 70, top: 0xa4b3bb, seed: 4 },
    ];
    const fogC = new THREE.Color(FOG);
    for (const L of layers) {
      const NA = 220;
      const rr = rng(L.seed * 131);
      const ph = [rr() * 6, rr() * 6, rr() * 6, rr() * 6];
      const pos = [];
      const col = [];
      const top = new THREE.Color(L.top);
      for (let i = 0; i <= NA; i++) {
        const a = (i / NA) * Math.PI * 2;
        const n = 0.5 * Math.sin(2 * a + ph[0]) + 0.3 * Math.sin(5 * a + ph[1]) + 0.25 * Math.abs(Math.sin(9 * a + ph[2])) + 0.12 * Math.sin(23 * a + ph[3]);
        const hr = L.base(a) + L.amp * (0.5 + 0.5 * n);
        const c = Math.cos(a);
        const s = Math.sin(a);
        pos.push(c * L.R * 0.78, -10, s * L.R * 0.78, c * L.R * 0.93, hr * 0.62, s * L.R * 0.93, c * L.R, hr, s * L.R);
        const mid = top.clone().lerp(fogC, 0.45);
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

  // ── 떨어지는 단풍잎 (큰 타격이 나오면 바람에 흩날린다) ──
  const LEAVES = 90;
  const leafGeo = new THREE.PlaneGeometry(0.075, 0.055);
  const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.9 }), LEAVES);
  const lr = rng(5);
  const leafCols = [0xc0351f, 0xd2622a, 0xe0a13a, 0xa82a22, 0xc84a24];
  const L = [];
  const spawn = (l, anyHeight) => {
    const a = lr() * Math.PI * 2;
    const d = Math.sqrt(lr()) * 13;
    l.x = Math.cos(a) * d;
    l.z = Math.sin(a) * d;
    l.y = anyHeight ? lr() * 8 : 6 + lr() * 3;
    l.fall = 0.35 + lr() * 0.3;
    l.ph = lr() * 6.3;
    l.sp = 1.5 + lr() * 2;
    l.rest = 0;
  };
  for (let i = 0; i < LEAVES; i++) {
    const l = {};
    spawn(l, true);
    L.push(l);
    leaves.setColorAt(i, _c.set(leafCols[i % leafCols.length]));
  }
  scene.add(leaves);
  const lm = new THREE.Matrix4();
  const lq = new THREE.Quaternion();
  const le = new THREE.Euler();
  const one = new THREE.Vector3(1, 1, 1);
  let t = 0;
  let gust = 0;
  const placeLeaves = (dt) => {
    const wind = 0.25 + gust * 3;
    for (let i = 0; i < LEAVES; i++) {
      const l = L[i];
      if (l.rest > 0) {
        l.rest -= dt * (1 + gust * 6);
        if (l.rest <= 0) spawn(l, false);
      } else {
        l.y -= l.fall * dt * (1 - gust * 0.5);
        l.x += (Math.sin(t * 0.9 + l.ph) * 0.3 + wind) * dt;
        l.z += (Math.cos(t * 0.7 + l.ph) * 0.3 + wind * 0.4) * dt;
        if (l.y <= 0.012) {
          l.y = 0.012;
          l.rest = 5 + lr() * 8;
        }
        if (Math.hypot(l.x, l.z) > 16) spawn(l, false);
      }
      const onGround = l.rest > 0;
      le.set(onGround ? -Math.PI / 2 : Math.sin(t * l.sp + l.ph) * 1.2, l.ph + (onGround ? 0 : t * 0.8), onGround ? 0 : Math.cos(t * l.sp * 0.8 + l.ph) * 1.1);
      lm.compose(_v.set(l.x, l.y, l.z), lq.setFromEuler(le), one);
      leaves.setMatrixAt(i, lm);
    }
    leaves.instanceMatrix.needsUpdate = true;
  };
  placeLeaves(0);

  return {
    sunOffset,
    /** 큰 타격: 떨어지던 단풍잎이 바람에 흩날리고, 앉아 있던 잎도 다시 날아오른다 */
    excite(amount) {
      gust = Math.min(1, gust + amount * 0.5);
    },
    update(dt) {
      t += dt;
      gust = Math.max(0, gust - dt * 0.5);
      placeLeaves(dt);
    },
  };
}
