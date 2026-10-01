// ─────────────────────────────────────────────────────────────
//  배경 6: 밤의 포세이돈 신전 — 하인리히 재등장(흑화). 포세이돈 신전(arena.js)과 같은 자리를 밤으로 변주한다.
//   arena.js 가 지은 것을 그대로 두고 그 위에 밤을 얹는다: 하늘(별·낮은 달·달 쪽 구름)과 바다 색을 바꾸고, 빛을 달빛으로,
//   안개를 짙푸르게. 그리고 밤 소품만 더한다 — 결투 자리 네 귀퉁이의 쇠 화로, 석상 앞의 횃대 둘, 찢어진 검은 천을 건 장대 둘,
//   화로에서 오르는 불티. 불빛은 실제 조명 대신 신전 조각의 꼭짓점 색에 구워 넣는다 (폰에서 가볍게).
//  arena.js 는 건드리지 않는다 (디렉터 파일 최소 수정). 여기서 arena 의 메쉬를 찾는 기준: 하늘 = BackSide 구, 바다 = y −25 의 MeshBasic.
//  물리와는 무관한 그림만 만든다. 카메라가 도는 반지름(10.5m) 안에는 arena 가 둔 낮은 것만 있다 (화로는 12m 밖).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { buildArena } from './arena.js';
import { rng, h3, _c, _v, Kit, box, cyl, limb, canvasTex, pointGlow, bakeLight } from './stage_kit.js';
import { weaponEnv } from './weapon_looks.js';

const C = {
  iron: 0x2a2a2e,
  ironLit: 0x3a3632,
  wood: 0x4a3a2c,
  cloth: 0x15131a, // 찢어진 검은 천
  rope: 0x6a5a44,
  ember: 0xff5a1a,
};

/** 밤하늘: 짙푸른 하늘에 별, 바다 위 낮은 달과 달빛에 물든 구름, 수평선 아래는 바다 띠 */
function nightSkyTexture(moonAz, moonEl) {
  const r = rng(77);
  return canvasTex(512, 256, (g, w, h) => {
    const hz = h * 0.5;
    const gr = g.createLinearGradient(0, 0, 0, hz);
    gr.addColorStop(0, '#060912');
    gr.addColorStop(0.5, '#0d1424');
    gr.addColorStop(0.85, '#182338');
    gr.addColorStop(1, '#233047');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, hz);
    g.fillStyle = '#0f1826'; // 수평선 아래 (바다 띠: 바다 메쉬가 덮지만 틈이 보일 때를 위해)
    g.fillRect(0, hz, w, h - hz);
    // 별은 여기(구에 씌우는 질감)에 안 그린다 — 천정 가까운 한 칸이 크게 늘어나 네모난 얼룩으로 보인다. 별은 모두 점(Points)으로 띄운다
    const mx = ((((0.5 - moonAz / (Math.PI * 2)) % 1) + 1) % 1) * w;
    const my = hz * (1 - moonEl / (Math.PI / 2)); // 달 고도에 맞춘다 (스프라이트와 같은 자리)
    // 구름: 낮게 깔린 층구름은 검푸르고, 달 가까운 것은 밑면이 옅게 빛난다
    for (let i = 0; i < 60; i++) {
      const y = h * (0.28 + Math.pow(r(), 0.7) * 0.2);
      const x = r() * w;
      const dx = Math.min(Math.abs(x - mx), w - Math.abs(x - mx)) / w;
      const lit = Math.max(0, 1 - dx * 5);
      const wdt = 40 + r() * 140;
      g.fillStyle = `rgba(${18 + lit * 90},${24 + lit * 95},${40 + lit * 110},${0.35 + r() * 0.35})`;
      g.beginPath();
      g.ellipse(x, y, wdt, 3 + r() * 7, 0, 0, Math.PI * 2);
      g.fill();
      if (lit > 0.3) {
        g.fillStyle = `rgba(${120 + lit * 80},${135 + lit * 80},${170 + lit * 70},${0.12 + lit * 0.2})`;
        g.beginPath();
        g.ellipse(x, y + 3, wdt * 0.8, 1.5 + r() * 2.5, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    // 달: 바다 위 낮게. 달무리와 수평선 쪽 밝은 띠
    for (const ux of [mx, mx - w, mx + w]) {
      let rg = g.createRadialGradient(ux, my, 0, ux, my, 90);
      rg.addColorStop(0, 'rgba(200,214,240,0.55)');
      rg.addColorStop(0.25, 'rgba(160,180,220,0.18)');
      rg.addColorStop(1, 'rgba(120,140,190,0)');
      g.fillStyle = rg;
      g.fillRect(ux - 90, my - 90, 180, 180);
      g.save();
      g.translate(ux, hz - 2);
      g.scale(1, 0.14);
      rg = g.createRadialGradient(0, 0, 0, 0, 0, 150);
      rg.addColorStop(0, 'rgba(170,190,225,0.35)');
      rg.addColorStop(1, 'rgba(170,190,225,0)');
      g.fillStyle = rg;
      g.fillRect(-150, -150, 300, 300);
      g.restore();
      // 달 원판은 여기(512×256 하늘)에 그리면 뭉개져서, 따로 고해상도 스프라이트로 띄운다 (moonSprite)
    }
  });
}
/** 보름달: 512×512 에 크게 그린다 — 바다(어두운 얼룩)·크레이터 60여 개·잔얼룩·가장자리 살짝 어둡게·바깥 달무리 */
function moonTexture() {
  const r = rng(303);
  return canvasTex(512, 512, (g, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    const R = 180;
    // 달무리 (원판 밖으로 옅게)
    let rg = g.createRadialGradient(cx, cy, R * 0.98, cx, cy, w / 2);
    rg.addColorStop(0, 'rgba(210,222,245,0.5)');
    rg.addColorStop(0.35, 'rgba(180,196,230,0.14)');
    rg.addColorStop(1, 'rgba(160,180,220,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, w, h);
    // 원판: 가운데 밝고 가장자리로 갈수록 아주 조금 어둡다
    rg = g.createRadialGradient(cx - 20, cy - 20, 0, cx, cy, R);
    rg.addColorStop(0, '#f5f6f1');
    rg.addColorStop(0.7, '#e8eae4');
    rg.addColorStop(0.93, '#d6d8d3');
    rg.addColorStop(1, '#b9bcb9');
    g.fillStyle = rg;
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.fill();
    g.save();
    g.beginPath();
    g.arc(cx, cy, R - 1, 0, Math.PI * 2);
    g.clip();
    // 바다 (어두운 얼룩 여럿, 가장자리는 잘게 번진다)
    const seas = [
      [-48, -66, 74, 52, 0.3],
      [30, -50, 60, 44, -0.4],
      [-16, 14, 86, 60, 0.15],
      [58, 30, 44, 34, 0.6],
      [-74, 52, 40, 28, -0.2],
      [16, 84, 56, 26, 0.1],
      [92, -22, 30, 22, 0.9],
    ];
    for (const [dx, dy, rx, ry, rot] of seas) {
      g.fillStyle = `rgba(150,158,165,${0.42 + r() * 0.2})`;
      g.beginPath();
      g.ellipse(cx + dx, cy + dy, rx, ry, rot, 0, Math.PI * 2);
      g.fill();
      for (let k = 0; k < 14; k++) {
        g.fillStyle = `rgba(135,143,152,${0.15 + r() * 0.25})`;
        g.beginPath();
        g.ellipse(cx + dx + (r() - 0.5) * rx * 1.3, cy + dy + (r() - 0.5) * ry * 1.3, 6 + r() * 20, 4 + r() * 14, r() * 3, 0, Math.PI * 2);
        g.fill();
      }
    }
    // 잔얼룩: 표면의 미세한 명암
    for (let i = 0; i < 900; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * R;
      const v = r();
      g.fillStyle = v < 0.5 ? `rgba(120,126,134,${0.05 + r() * 0.1})` : `rgba(255,255,250,${0.05 + r() * 0.12})`;
      g.beginPath();
      g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1 + r() * 4, 0, Math.PI * 2);
      g.fill();
    }
    // 크레이터: 밝은 테두리와 어두운 안쪽, 큰 것 몇 개는 빛줄기
    for (let i = 0; i < 64; i++) {
      const a = r() * Math.PI * 2;
      const d = r() * (R - 16);
      const x = cx + Math.cos(a) * d;
      const y = cy + Math.sin(a) * d;
      const cr = 3 + r() * (i < 6 ? 18 : 8);
      g.fillStyle = 'rgba(255,255,252,0.6)';
      g.beginPath();
      g.arc(x, y, cr + 1.6, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = `rgba(160,166,172,${0.35 + r() * 0.3})`;
      g.beginPath();
      g.arc(x + 1.2, y + 1.2, cr, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = `rgba(215,219,222,${0.3 + r() * 0.3})`; // 안쪽 바닥
      g.beginPath();
      g.arc(x + 0.4, y + 0.4, cr * 0.55, 0, Math.PI * 2);
      g.fill();
      if (i < 3)
        for (let k = 0; k < 14; k++) {
          const b = r() * Math.PI * 2;
          g.strokeStyle = 'rgba(255,255,250,0.2)';
          g.lineWidth = 1.5;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x + Math.cos(b) * (cr + 20 + r() * 50), y + Math.sin(b) * (cr + 20 + r() * 50));
          g.stroke();
        }
    }
    g.restore();
  });
}
function dotTexture() {
  return canvasTex(32, 32, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
  });
}

/**
 * 밤의 포세이돈 신전을 만든다. 반환: { update(dt), excite(amount), sunOffset, fighterLight }
 *  lights: main.js 의 { hemi, sun } — 달빛으로 바꾼다
 */
export function buildPoseidonNight(scene, lights = {}) {
  const r = rng(909);
  const K = new Kit(1213);
  const before = new Set(scene.children);
  const day = buildArena(scene); // 낮 신전을 그대로 짓고
  const added = scene.children.filter((o) => !before.has(o));

  // ── 하늘·바다·빛·안개를 밤으로 ──
  const moonDir = new THREE.Vector3(7, 4.2, -2.6); // 바다 위 낮은 달 (기본 화면에서 석상 오른쪽 뒤)
  const sunOffset = { x: moonDir.x, y: moonDir.y, z: moonDir.z };
  const FOG = 0x0d121c;
  scene.background = new THREE.Color(FOG);
  scene.fog = new THREE.Fog(FOG, 30, 260);
  if (lights.hemi) {
    lights.hemi.color.set(0x2a3850); // 별빛·달빛 하늘
    lights.hemi.groundColor.set(0x17130f);
    lights.hemi.intensity = 0.85;
  }
  if (lights.sun) {
    lights.sun.color.set(0xaebfe0); // 달빛
    lights.sun.intensity = 0.55;
    lights.sun.position.set(sunOffset.x, sunOffset.y, sunOffset.z);
  }
  const sky = added.find((o) => o.isMesh && o.material?.side === THREE.BackSide);
  if (sky) {
    sky.material.map?.dispose();
    sky.material.map = nightSkyTexture(Math.atan2(moonDir.z, moonDir.x), Math.atan2(moonDir.y, Math.hypot(moonDir.x, moonDir.z)));
    sky.material.needsUpdate = true;
  }
  // 보름달: 고해상도 스프라이트를 달 방향 먼 곳(하늘 구 안쪽)에 띄운다. 각지름 약 3° (실제보다 크게, 그림답게)
  const moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTexture(), transparent: true, depthWrite: false, fog: false }));
  moonSprite.position.copy(moonDir).normalize().multiplyScalar(540);
  moonSprite.scale.setScalar(100); // 질감 한 장 = 100m (원판은 그중 0.7 ≈ 70m → 540m 에서 약 7.4°, 실제 달보다 훨씬 크게 — 오너: 더 크게)
  moonSprite.renderOrder = 1;
  scene.add(moonSprite);

  // 별: 하늘 구 안쪽(560m)에 점으로 띄우고 매 프레임 밝기를 저마다 다른 박자로 흔든다.
  //  두 벌 — 옅은 별무리(작고 또렷한 1.4px 점, 느리게 조금만) 와 밝은 별(부드러운 2.6px 점, 반짝임). 한 벌로 하면 옅은 별이 큰 망점처럼 얼룩져 보인다.
  //  보름달 가까이(약 25° 안)는 달빛에 묻혀 드물고, 멀수록 촘촘하다. 수평선 3° 아래로는 없다
  const mdir = moonDir.clone().normalize();
  const stR = rng(505);
  const hardDot = canvasTex(8, 8, (x, w, h) => {
    x.fillStyle = 'rgba(255,255,255,1)';
    x.beginPath();
    x.arc(w / 2, h / 2, 3, 0, Math.PI * 2);
    x.fill();
  });
  const makeStars = (N, dim, size, map) => {
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const base = new Float32Array(N * 3);
    const ph = new Float32Array(N);
    const sp = new Float32Array(N);
    let n = 0;
    let guard = 0;
    while (n < N && guard++ < N * 30) {
      const el = Math.asin(stR()) * 0.95 + 0.05; // 고도 (천정 쪽이 조금 더 많다)
      const az = stR() * Math.PI * 2;
      _v.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az));
      const dm = Math.acos(THREE.MathUtils.clamp(_v.dot(mdir), -1, 1)); // 달과의 각거리
      if (dm < 0.44 && stR() > dm / 0.44) continue; // 달 가까이는 드물게
      pos[n * 3] = _v.x * 560;
      pos[n * 3 + 1] = _v.y * 560;
      pos[n * 3 + 2] = _v.z * 560;
      const b = dim ? 0.3 + stR() * 0.35 : 0.5 + stR() * 0.5;
      const warm = stR();
      base[n * 3] = b * (warm < 0.15 ? 1.0 : 0.88);
      base[n * 3 + 1] = b * 0.92;
      base[n * 3 + 2] = b * (warm < 0.15 ? 0.75 : 1.0);
      ph[n] = stR() * 6.3;
      sp[n] = dim ? 0.3 + stR() * 0.8 : 1.2 + stR() * 4;
      n++;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, sizeAttenuation: false, map, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    pts.frustumCulled = false;
    pts.renderOrder = 1;
    scene.add(pts);
    return (t) => {
      for (let i = 0; i < n; i++) {
        const k = dim ? 0.8 + 0.2 * Math.sin(t * sp[i] + ph[i]) : 0.55 + 0.45 * Math.sin(t * sp[i] + ph[i]) * Math.sin(t * 0.7 * sp[i] + ph[i] * 1.7);
        col[i * 3] = base[i * 3] * k;
        col[i * 3 + 1] = base[i * 3 + 1] * k;
        col[i * 3 + 2] = base[i * 3 + 2] * k;
      }
      geo.attributes.color.needsUpdate = true;
    };
  };
  const starSteps = [makeStars(700, true, 1.4, hardDot), makeStars(500, false, 2.6, dotTexture())];
  const twinkle = (t) => {
    for (const f of starSteps) f(t);
  };
  twinkle(0);

  const sea = added.find((o) => o.isMesh && o.material?.isMeshBasicMaterial && o.position.y === -25);
  if (sea) sea.material.color.set(0x2c3a4e); // 물결 질감·꼭짓점 색(먼 바다의 은빛 띠 = 달빛 길)에 곱한다
  for (const o of added) {
    if (o.isPoints) {
      o.material.color.set(0xbfc6d4); // 먼지는 달빛에 희미하게
      o.material.opacity = 0.28;
    }
  }

  // ── 밤 소품 자리 ──
  const braziers = [
    [9.2, 9.2],
    [-9.2, 9.2],
    [9.2, -9.2],
    [-9.2, -9.2],
  ]; // 결투 자리(반지름 6.5) 밖 12~13m, 카메라 반지름(10.5) 밖
  const stands = [
    [14.0, -1.4],
    [8.2, -9.6],
  ]; // 석상(11.6, −6) 양옆의 횃대
  // 석상 앞 제물 자리 (오너 요청): 받침 앞 땅바닥, 결투 자리 쪽. 석상(11.6, −6)에서 경기장 가운데 쪽으로 1.9m
  const OFF = { x: 11.6 - 0.888 * 1.95, z: -6.0 + 0.459 * 1.95 };
  const CANDLE_LIT = [OFF.x + 0.22, OFF.z - 0.28]; // 켜진 초 하나 (밤에 제물이 보이라고 — 누군가 조금 전에 다녀갔다)
  const glowPts = [
    ...braziers.map(([x, z]) => ({ x, y: 1.35, z, r: 11, c: [2.4, 1.1, 0.3] })), // 밤이라 세게 (달빛에 곱해지므로)
    ...stands.map(([x, z]) => ({ x, y: 2.5, z, r: 7.5, c: [2.0, 0.95, 0.3] })),
    { x: CANDLE_LIT[0], y: 0.12, z: CANDLE_LIT[1], r: 1.6, c: [1.6, 0.8, 0.25] }, // 촛불: 작고 가깝게
  ];
  const glow = pointGlow(glowPts);

  // 불빛을 신전 조각(대리석·기둥·바위·모래)의 꼭짓점 색에 구워 넣는다. 색 속성이 없는 메쉬(모래)에는 흰색을 깔고 켠다
  for (const o of added) {
    if (!o.isMesh || o === sky || o === sea || o.isInstancedMesh) continue;
    const g = o.geometry;
    if (!g?.attributes?.position || o.material?.isMeshBasicMaterial) continue;
    if (!g.attributes.color) {
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
      o.material.vertexColors = true;
      o.material.needsUpdate = true;
    }
    bakeLight(g, glow);
  }

  // ── 쇠 화로 넷: 세 다리 위 넓은 쇠 대접, 잉걸불 ──
  for (const [x, z] of braziers) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      limb(K, 'iron', [x + Math.cos(a) * 0.6, 0, z + Math.sin(a) * 0.6], [x + Math.cos(a) * 0.22, 1.0, z + Math.sin(a) * 0.22], 0.04, 0.03, C.iron, {}, 5);
    }
    K.put('iron', new THREE.CylinderGeometry(0.62, 0.36, 0.4, 14, 1, true), C.iron, [x, 1.15, z]);
    K.put('iron', new THREE.TorusGeometry(0.62, 0.03, 4, 14), C.ironLit, [x, 1.35, z], [Math.PI / 2, 0, 0]);
    K.put('embers', new THREE.CircleGeometry(0.55, 14), C.ember, [x, 1.26, z], [-Math.PI / 2, 0, 0], 1, { vary: 0.3, noise: 0.25 });
    // 화로 밑에 떨어진 재
    K.put('ash', new THREE.CircleGeometry(0.9, 12), 0x3a3634, [x, 0.012, z], [-Math.PI / 2, r() * 3, 0], 1, { noise: 0.2, rough: 0.04 });
  }

  // ── 석상 앞 횃대 둘: 높은 쇠 기둥 위 작은 불 바구니 ──
  for (const [x, z] of stands) {
    K.put('iron', cyl(0.05, 0.07, 2.4, 6), C.iron, [x, 1.2, z]);
    K.put('iron', new THREE.CylinderGeometry(0.22, 0.12, 0.28, 10, 1, true), C.iron, [x, 2.45, z]);
    K.put('embers', new THREE.CircleGeometry(0.16, 10), C.ember, [x, 2.5, z], [-Math.PI / 2, 0, 0], 1, { vary: 0.3 });
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      limb(K, 'iron', [x + Math.cos(a) * 0.3, 0, z + Math.sin(a) * 0.3], [x, 0.5, z], 0.03, 0.025, C.iron, {}, 4); // 받침 다리
    }
  }

  // ── 찢어진 검은 천을 건 장대 둘 (경기장 서쪽, 하인리히가 걸어 둔 것) ──
  for (const [x, z, lean] of [
    [-11.5, 6.2, 0.06],
    [-11.5, -6.2, -0.05],
  ]) {
    const H = 4.2;
    limb(K, 'wood', [x, 0, z], [x + lean * H, H, z], 0.06, 0.035, C.wood, { vary: 0.15 }, 6);
    K.put('wood', box(1.3, 0.05, 0.05), C.wood, [x + lean * H, H - 0.1, z], [0, 0, 0], 1, { vary: 0.15 }); // 가로대
    // 천: 가로대에 걸려 늘어진 조각 (아래가 찢어져 길이가 다르다)
    const strips = [
      [-0.55, 2.6],
      [-0.2, 3.3],
      [0.15, 2.1],
      [0.5, 2.9],
    ];
    for (const [dz, len] of strips) {
      K.put('cloth', box(0.05, len, 0.32, 1, 3, 1), C.cloth, [x + lean * H + 0.05, H - 0.15 - len / 2, z + dz], [0, 0, 0.03 + r() * 0.03], 1, { vary: 0.12, noise: 0.1, rough: 0.05 });
    }
    limb(K, 'iron', [x + lean * H, H - 0.15, z - 0.65], [x + lean * H - 0.3, H - 0.55, z - 0.65], 0.012, 0.012, C.rope, {}, 3); // 매듭 끈
  }

  const flames = []; // 불꽃 자리 (화로·횃대·촛불). 아래 인스턴싱으로 그린다
  // ── 석상 앞 제물: 은화 몇 닢(쌓인 것과 흩어진 것), 꺼진 초 둘과 켜진 초 하나, 마른 꽃을 꽂은 질그릇 — 아무도 안 오는 신전에 누군가 빌고 간 흔적 ──
  {
    const ox = OFF.x;
    const oz = OFF.z;
    // 은화: 얇은 원판. 셋은 쌓였고 나머지는 흩어졌다
    const coin = (x, z, y = 0.002, rot = 0) => K.put('silver', new THREE.CylinderGeometry(0.021, 0.021, 0.004, 12), 0xcfd1cc, [x, y, z], [0, rot, 0], 1, { vary: 0.1, noise: 0.05 });
    for (let i = 0; i < 3; i++) coin(ox - 0.12, oz + 0.05, 0.002 + i * 0.0045, r() * 3);
    for (let i = 0; i < 6; i++) coin(ox + (r() - 0.5) * 0.7, oz + (r() - 0.5) * 0.6, 0.002, r() * 3);
    // 초: 타다 남은 밀랍 초. 밑이 조금 퍼졌고 심지는 검다. 둘은 꺼졌고 하나는 켜져 있다
    const candle = (x, z, h, lit) => {
      K.put('wax', new THREE.CylinderGeometry(0.022, 0.03, h, 9), 0xe6dcc2, [x, h / 2, z], [0, 0, 0], 1, { vary: 0.08, noise: 0.08, rough: 0.004 });
      K.put('wax', new THREE.CylinderGeometry(0.04, 0.03, 0.012, 9), 0xe6dcc2, [x, 0.006, z], [0, 0, 0], 1, { vary: 0.08, rough: 0.004 }); // 흘러내린 밀랍
      K.put('dark', cyl(0.003, 0.003, 0.014, 4), 0x1a1512, [x, h + 0.006, z]);
      if (lit) flames.push({ x, y: h + 0.008, z, s: 0.11, ph: r() * 6 });
    };
    candle(ox - 0.3, oz - 0.2, 0.07, false);
    candle(ox + 0.05, oz + 0.3, 0.11, false);
    candle(CANDLE_LIT[0], CANDLE_LIT[1], 0.09, true);
    // 질그릇과 마른 꽃
    K.put('clay', new THREE.CylinderGeometry(0.085, 0.06, 0.06, 10, 1, true), 0x7e6249, [ox + 0.36, 0.03, oz + 0.1], [0, 0, 0], 1, { vary: 0.1, noise: 0.12, rough: 0.004 });
    K.put('clay', new THREE.CircleGeometry(0.06, 10), 0x5a4736, [ox + 0.36, 0.004, oz + 0.1], [-Math.PI / 2, 0, 0]);
    for (let k = 0; k < 4; k++) {
      const a = k * 1.6 + 0.3;
      const tip = [ox + 0.36 + Math.cos(a) * 0.09, 0.2 + r() * 0.08, oz + 0.1 + Math.sin(a) * 0.09];
      limb(K, 'stem', [ox + 0.36 + Math.cos(a) * 0.02, 0.05, oz + 0.1 + Math.sin(a) * 0.02], tip, 0.005, 0.003, 0x5c4d33, { vary: 0.2 }, 4);
      K.put('stem', new THREE.SphereGeometry(0.022, 6, 5), 0x8f7c55, tip, [0, 0, 0], [1, 0.7, 1], { vary: 0.2, noise: 0.2 }); // 마른 꽃송이
    }
  }

  const std = (p) => new THREE.MeshStandardMaterial({ vertexColors: true, ...p });
  const meshes = [
    K.mesh('iron', std({ roughness: 0.55, metalness: 0.6 }), { light: glow }),
    K.mesh('wood', std({ roughness: 0.9 }), { light: glow }),
    K.mesh('cloth', std({ roughness: 1 }), { light: glow }),
    K.mesh('ash', std({ roughness: 1 })),
    K.mesh('silver', std({ roughness: 0.3, metalness: 0.85, envMap: weaponEnv(), envMapIntensity: 1.2 }), { light: glow }),
    K.mesh('wax', std({ roughness: 0.55 }), { light: glow }),
    K.mesh('clay', std({ roughness: 0.95 }), { light: glow }),
    K.mesh('stem', std({ roughness: 1 }), { light: glow }),
    K.mesh('embers', new THREE.MeshBasicMaterial({ vertexColors: true })),
  ];
  for (const m of meshes) if (m) scene.add(m);

  // ── 불꽃 (화로 셋씩, 횃대 둘씩, 촛불 하나): 인스턴싱 원뿔, 매 프레임 일렁인다 ──
  for (const [x, z] of braziers) for (let i = 0; i < 3; i++) flames.push({ x: x + (i - 1) * 0.18, y: 1.28, z: z + ((i % 2) - 0.5) * 0.16, s: 1.0 - Math.abs(i - 1) * 0.28, ph: r() * 6 });
  for (const [x, z] of stands) for (let i = 0; i < 2; i++) flames.push({ x, y: 2.52, z, s: 0.5 - i * 0.18, ph: r() * 6 });
  const flameGeo = new THREE.ConeGeometry(0.17, 0.75, 7);
  flameGeo.translate(0, 0.375, 0);
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

  // ── 불티: 화로에서 올라 바람에 흩어진다 ──
  const SPARKS = 240;
  const sr = rng(31);
  const spos = new Float32Array(SPARKS * 3);
  const sage = new Float32Array(SPARKS);
  const sseed = new Float32Array(SPARKS * 2);
  for (let i = 0; i < SPARKS; i++) {
    sage[i] = sr();
    sseed[i * 2] = sr();
    sseed[i * 2 + 1] = sr();
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(spos, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ size: 0.05, map: dotTexture(), transparent: true, opacity: 0.9, depthWrite: false, color: 0xffa040, blending: THREE.AdditiveBlending, fog: false }));
  sparks.frustumCulled = false;
  scene.add(sparks);

  const fm = new THREE.Matrix4();
  const fq = new THREE.Quaternion();
  const fsc = new THREE.Vector3();
  let t = 0;
  let gust = 0;
  const step = (dt) => {
    for (let i = 0; i < flames.length; i++) {
      const f = flames[i];
      const w = 1 + 0.18 * Math.sin(t * 11 + f.ph) + 0.1 * Math.sin(t * 23 + f.ph * 2) + gust * 0.35;
      for (let k = 0; k < 2; k++) {
        const s = f.s * (k ? 0.55 : 1);
        fsc.set(s * (1 + 0.1 * Math.sin(t * 17 + f.ph)), s * w, s);
        fq.setFromAxisAngle(_v.set(Math.sin(t * 3 + f.ph), 0, Math.cos(t * 2.3 + f.ph)).normalize(), 0.12 * Math.sin(t * 7 + f.ph) + gust * 0.35);
        fm.compose(_v.set(f.x, f.y, f.z), fq, fsc);
        flameMesh.setMatrixAt(i * 2 + k, fm);
      }
    }
    flameMesh.instanceMatrix.needsUpdate = true;
    // 불티: 나이 0→1 동안 화로 위로 오르며 옆으로 흩어진다. 큰 타격이면 더 많이·더 세게
    for (let i = 0; i < SPARKS; i++) {
      sage[i] += dt * (0.35 + sseed[i * 2] * 0.3 + gust * 0.5);
      if (sage[i] > 1) sage[i] -= 1;
      const a = sage[i];
      const b = braziers[i % braziers.length];
      const ang = sseed[i * 2 + 1] * Math.PI * 2 + t * 0.4;
      const spread = a * (0.5 + gust * 1.6);
      spos[i * 3] = b[0] + Math.cos(ang) * spread + Math.sin(t * 5 + i) * 0.08;
      spos[i * 3 + 1] = 1.35 + a * (2.6 + gust * 2.5);
      spos[i * 3 + 2] = b[1] + Math.sin(ang) * spread;
    }
    sparkGeo.attributes.position.needsUpdate = true;
  };
  step(0);

  return {
    sunOffset,
    // 밤: 캐릭터는 화로의 따뜻한 빛으로 채우고 달빛 테두리로 떼어 놓는다
    fighterLight: { color: 0xffc493, rimColor: 0xaabfe6, rim: 1.5, level: 0.44 },
    /** 큰 타격: 불꽃이 크게 일렁이고 불티가 흩어지고, 낮 신전의 먼지도 흩날린다 */
    excite(amount) {
      gust = Math.min(1, gust + amount * 0.5);
      day.excite?.(amount);
    },
    update(dt) {
      t += dt;
      gust = Math.max(0, gust - dt * 0.5);
      day.update?.(dt);
      step(dt);
      twinkle(t);
    },
  };
}
