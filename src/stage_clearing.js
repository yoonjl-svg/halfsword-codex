// ─────────────────────────────────────────────────────────────
//  배경 5: 검은숲 변두리의 화전 터, 봄 이른 아침 (브란의 고향) — 1안
//   불을 놓고 얼마 안 된 검은 비탈 한가운데, 밭에서 골라낸 돌을 둥글게 쌓은 결투 자리 · 탄 그루터기와 쓰러진 통나무 ·
//   서쪽(−x) 비탈 아래 기울어진 화전민 오두막(처진 이엉 지붕·그을린 굴뚝·빠진 울타리·장작더미·도끼 박힌 모탕·묶인 염소) ·
//   북동쪽 숯가마와 가는 연기 · 탄 땅 사이로 드문드문 올라온 새싹 · 남동쪽 비탈 가장자리의 노란 양골담초 덤불 몇 무더기 ·
//   둘레를 두른 검은 가문비 숲과 몇 그루 자작나무 · 동쪽(+x) 트인 쪽으로 낮게 드는 아침 해와 먼 산등성이 ·
//   재가 떠다닌다 (큰 타격이 나오면 바람에 재와 연기가 휘날린다).
//   오너 제안으로 봄비가 내린다 (opt.rain, 기본 켬): 하늘은 더 잿빛, 해는 누그러지고, 땅은 젖어 번들거리며 웅덩이가 하늘을 비춘다.
//   1안은 ?stage=clearing_a, 비 없는 처음 모습은 ?stage=clearing_a_dry 로 본다 (stages.js). 순서에 들어간 것은 2안(stage_clearing_b.js)이다.
//  색: 검정(탄 땅) · 연두(새싹) · 노랑(양골담초) · 옅은 하늘 — 다른 배경에 없던 색이다. 다만 희망찬 봄이 아니라
//   변두리로 밀려난 사람들의 살림이라 연두와 노랑은 드물고, 탄 땅과 재가 화면의 대부분이다 (오너: "너무 희망찬 느낌은 아니게").
//  같은 컨셉을 다른 세부로 푼 2안은 stage_clearing_b.js 이고, 땅·숲·새싹·비 같은 공통 조각은 이 파일에서 export 한다.
//  물리와는 무관한 그림만 만든다. 카메라가 도는 반지름(10.5m) 안에는 낮은 밭돌 무더기·새싹·웅덩이만 둔다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { ARENA } from './config.js';
import { rng, h3, _c, _v, Kit, box, cyl, limb, canvasTex } from './stage_kit.js';
import { weaponEnv } from './weapon_looks.js';

export const C = {
  ash: 0x1f1d1b, // 탄 땅 (질감에 곱해짐)
  soot: 0x161412, // 숯·그을음
  earth: 0x4a3f34, // 밟힌 맨땅 (결투 자리)
  stump: 0x3a2d23, // 탄 그루터기 (안쪽 나무)
  char: 0x1b1816, // 탄 겉면
  bark: 0x4a392c, // 가문비 껍질
  spruce: 0x1e2d24, // 가문비 잎 (아주 어두운 청록)
  birch: 0xd6d2c6, // 자작 껍질
  sprout: 0x8cad3e, // 새싹 연두
  sproutDry: 0x9c9a4c, // 마른 풀 섞인 연두
  broom: 0xd1b13a, // 양골담초 노랑
  broomTwig: 0x5d6a2e,
  wood: 0x6a533a,
  woodDark: 0x3f3025,
  woodGrey: 0x6e665a, // 비바람에 바랜 나무
  thatch: 0x6c6048, // 낡은 이엉 (거무튀튀)
  daub: 0x6d5f4c, // 흙벽
  stone: 0x57534c, // 밭돌
  iron: 0x33322e,
  rope: 0x8b7a5b,
  goat: 0x9d9388,
  goatDark: 0x4a423a,
  dark: 0x0e0d0c, // 문간·창 안쪽
};
const ASH_TEX_AVG = 0.5; // 재 질감 평균 밝기(선형): 재질 색을 1/이만큼 올려 원래 색이 나오게

/** 재 덮인 땅: 잿빛 알갱이, 숯 부스러기, 몇 군데 탄 나뭇가지 자국 */
export function ashTexture() {
  const r = rng(23);
  return canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#b3afa8';
    x.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const v = 120 + Math.floor(r() * 135);
      x.fillStyle = `rgba(${v},${v - 2},${v - 6},${0.35 + r() * 0.4})`;
      x.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
    }
    for (let i = 0; i < 90; i++) {
      // 숯 조각 (짙은 얼룩)
      x.fillStyle = `rgba(40,36,32,${0.35 + r() * 0.4})`;
      x.beginPath();
      x.ellipse(r() * w, r() * h, 2 + r() * 6, 1.5 + r() * 3, r() * 3, 0, Math.PI * 2);
      x.fill();
    }
    for (let i = 0; i < 24; i++) {
      // 타다 남은 가는 가지 자국
      x.strokeStyle = `rgba(50,44,40,${0.3 + r() * 0.3})`;
      x.lineWidth = 1 + r() * 1.5;
      x.beginPath();
      const ax = r() * w;
      const ay = r() * h;
      x.moveTo(ax, ay);
      x.lineTo(ax + (r() - 0.5) * 40, ay + (r() - 0.5) * 40);
      x.stroke();
    }
  });
}
/** 아침 하늘: 옅고 흐릿하다. 해 쪽 수평선만 누르스름하고, 낮게 연기 띠가 깔렸다. rain 이면 더 잿빛이고 해 쪽 빛도 약하다 */
export function skyTexture(sunAz, rain = false) {
  const r = rng(9);
  return canvasTex(512, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    if (rain) {
      g.addColorStop(0, '#7e8b97');
      g.addColorStop(0.24, '#9aa4ab');
      g.addColorStop(0.42, '#bfc3c1');
      g.addColorStop(0.5, '#cdc8ba');
      g.addColorStop(1, '#aaaca5');
    } else {
      g.addColorStop(0, '#6f8598');
      g.addColorStop(0.28, '#93a5b1');
      g.addColorStop(0.44, '#bcc5c6');
      g.addColorStop(0.5, '#c9c9bf');
      g.addColorStop(1, '#a9aca6');
    }
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    // 해 뜨는 쪽 수평선의 누런 빛
    const u = ((((Math.PI - sunAz) / (Math.PI * 2)) % 1) + 1) % 1;
    for (const ux of [u * w, u * w - w, u * w + w]) {
      const rg = x.createRadialGradient(ux, h * 0.5, 0, ux, h * 0.5, w * 0.26);
      // 새벽 놀: 해 쪽 수평선이 복숭아빛으로 물든다 (비가 와도 구름 틈으로 보인다 — 밤이 아니라 아침임을 알리는 표시)
      rg.addColorStop(0, rain ? 'rgba(244,200,150,0.85)' : 'rgba(240,214,150,0.9)');
      rg.addColorStop(0.4, rain ? 'rgba(228,178,150,0.38)' : 'rgba(225,200,150,0.35)');
      rg.addColorStop(1, rain ? 'rgba(215,180,170,0)' : 'rgba(210,200,170,0)');
      x.fillStyle = rg;
      x.fillRect(0, 0, w, h * 0.5);
    }
    // 옅은 층구름과 낮게 깔린 연기 띠 (비가 오면 구름이 더 낮고 짙다)
    for (let i = 0; i < (rain ? 70 : 40); i++) {
      x.fillStyle = rain ? `rgba(${118 + r() * 40},${124 + r() * 35},${132 + r() * 30},${0.16 + r() * 0.22})` : `rgba(${150 + r() * 40},${155 + r() * 35},${160 + r() * 30},${0.12 + r() * 0.2})`;
      x.beginPath();
      x.ellipse(r() * w, h * (0.08 + r() * (rain ? 0.34 : 0.3)), 60 + r() * 140, 3 + r() * 9, 0, 0, Math.PI * 2);
      x.fill();
    }
    if (rain) {
      // 해 쪽 구름 밑면이 놀에 물든다
      for (let i = 0; i < 14; i++) {
        const cx = (u + (r() - 0.5) * 0.3) * w;
        x.fillStyle = `rgba(${225 + r() * 25},${165 + r() * 30},${130 + r() * 30},${0.12 + r() * 0.16})`;
        x.beginPath();
        x.ellipse(cx, h * (0.34 + r() * 0.12), 50 + r() * 110, 3 + r() * 6, 0, 0, Math.PI * 2);
        x.fill();
      }
    }
    for (let i = 0; i < 16; i++) {
      x.fillStyle = `rgba(120,116,110,${0.08 + r() * 0.12})`;
      x.beginPath();
      x.ellipse(r() * w, h * (0.44 + r() * 0.05), 90 + r() * 160, 2 + r() * 5, 0, 0, Math.PI * 2);
      x.fill();
    }
  });
}
export function dotTexture() {
  return canvasTex(32, 32, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
  });
}
/** 빗줄기: 네모 점 안에 세로로 가는 줄 하나 (위아래 끝은 옅다) */
function rainTexture() {
  return canvasTex(32, 32, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.75, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(w / 2 - 1, 0, 2, h);
  });
}

/**
 * 하늘·안개·빛을 화전 터의 아침으로 바꾼다. rain 이면 잿빛 비 오는 아침(해는 누그러지고 반구광이 조금 세다)
 *  반환: { FOG, sunOffset }
 */
export function morning(scene, lights, { rain = true, sunOffset = { x: 8.5, y: 2.9, z: -3.5 } } = {}) {
  const FOG = rain ? 0xb4bab8 : 0xb6bcb9; // 옅은 잿빛 안개 (연기가 섞인 아침 공기)
  scene.background = new THREE.Color(FOG);
  scene.fog = new THREE.Fog(FOG, rain ? 26 : 30, rain ? 230 : 300);
  if (lights.hemi) {
    lights.hemi.color.set(rain ? 0xc6cdd1 : 0xc4cdd2); // 옅은 아침 하늘
    lights.hemi.groundColor.set(0x56514b); // 검은 땅은 빛을 거의 되비치지 않는다
    lights.hemi.intensity = rain ? 1.45 : 1.15;
  }
  if (lights.sun) {
    lights.sun.color.set(rain ? 0xffdcb4 : 0xffd9a6); // 낮은 해의 누런 빛 (비구름에 조금 누그러지지만 새벽 놀의 복숭아빛은 남는다)
    lights.sun.intensity = rain ? 1.35 : 1.5;
    lights.sun.position.set(sunOffset.x, sunOffset.y, sunOffset.z);
  }
  scene.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(600, 48, 24),
      new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, depthWrite: false, map: skyTexture(Math.atan2(sunOffset.z, sunOffset.x), rain) }),
    ),
  );
  if (rain) dawnMist(scene);
  return { FOG, sunOffset };
}

/** 새벽 안개: 숲 가장자리에 낮게 깔린 흰 안개 띠 (원통 한 겹, 위로 갈수록 옅다). 아침임을 알리는 표시 */
function dawnMist(scene) {
  const tex = canvasTex(4, 64, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(235,238,236,0)');
    g.addColorStop(0.55, 'rgba(235,238,236,0.55)');
    g.addColorStop(1, 'rgba(235,238,236,0.85)');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  for (const [R, H, y, op, sx, sz, rot] of [
    [23, 3.2, -0.1, 0.22, 1.08, 0.94, 0.4],
    [30, 5, -0.2, 0.15, 0.96, 1.1, 1.3],
  ]) {
    // 위에서 보면 매끈한 고리로 보이지 않게 조금 찌그러뜨린다
    const m = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 40, 1, true), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    m.position.y = y + H / 2;
    m.scale.set(sx, 1, sz);
    m.rotation.y = rot;
    scene.add(m);
  }
}

/** 비탈 높이: 결투 자리 둘레(13m)까지는 평평하고, 그 밖은 서쪽(−x)으로 오르고 동쪽(+x)으로 내려간다 */
export const slopeY = (x, z, tiltDir = -1) => {
  const rr = Math.hypot(x, z);
  const t = THREE.MathUtils.smoothstep(rr, 13, 40);
  const tilt = tiltDir * x * 0.075 * t;
  const bump = (h3(Math.round(x * 0.25), 1, Math.round(z * 0.25), 3) - 0.5) * 1.6 * t;
  return tilt + bump;
};

/**
 * 땅: 재로 덮인 검은 비탈. 결투 자리는 밟혀서 맨땅이 드러났고, 군데군데 타다 남은 마른 풀이 누렇다.
 *  paint(x, z, tmp, n1): 색을 더 칠할 수 있다 (2안의 이랑 자리 등). wet 이면 젖어서 덜 거칠다
 */
export function ashGround(scene, groundY, { wet = true, paint = null } = {}) {
  const HALF = 46;
  const N = 92;
  const pos = [];
  const uv = [];
  const col = [];
  const cAsh = new THREE.Color(C.ash);
  const cSoot = new THREE.Color(C.soot);
  const cEarth = new THREE.Color(C.earth);
  const cDry = new THREE.Color(0x6f6446);
  const tmp = new THREE.Color();
  const colorAt = (x, z) => {
    const rr = Math.hypot(x, z);
    const n1 = h3(Math.round(x * 0.5), 0, Math.round(z * 0.5), 4) * 0.5 + h3(x * 0.8, 2, z * 0.8, 6) * 0.5;
    const n2 = h3(Math.round(x * 0.18), 5, Math.round(z * 0.18), 7);
    tmp.copy(cAsh).lerp(cSoot, THREE.MathUtils.clamp((n1 - 0.45) * 1.8, 0, 1) * 0.7); // 더 탄 자리는 더 검다
    const trod = THREE.MathUtils.clamp((8.4 - rr) / 2.0, 0, 1);
    tmp.lerp(cEarth, trod * (0.55 + 0.45 * n1));
    // 타다 남은 마른 풀 (바깥쪽, 드문드문)
    if (rr > 12) tmp.lerp(cDry, THREE.MathUtils.clamp((n2 - 0.62) * 3, 0, 1) * 0.6 * THREE.MathUtils.smoothstep(rr, 12, 18));
    if (paint) paint(x, z, tmp, n1);
    if (wet) tmp.multiplyScalar(0.86); // 젖은 땅은 더 짙다
    col.push(tmp.r / ASH_TEX_AVG, tmp.g / ASH_TEX_AVG, tmp.b / ASH_TEX_AVG);
  };
  for (let j = 0; j <= N; j++)
    for (let i = 0; i <= N; i++) {
      const x = -HALF + (2 * HALF * i) / N;
      const z = -HALF + (2 * HALF * j) / N;
      pos.push(x, groundY(x, z), z);
      uv.push(x / 3, z / 3);
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
  const ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: ashTexture(), vertexColors: true, roughness: wet ? 0.8 : 0.98 }));
  ground.receiveShadow = true;
  scene.add(ground);
}

/** 웅덩이: 낮은 자리에 고인 빗물이 하늘을 비춘다 (납작한 원판, 반사 환경맵). 결투 자리 안에도 두는데 아주 낮아서 카메라에 안 걸린다 */
export function puddles(scene, groundY, spots) {
  const K = new Kit(91);
  for (const [x, z, rx, rz, rot] of spots) K.put('p', new THREE.CircleGeometry(1, 20), 0x1b1f22, [x, groundY(x, z) + 0.012, z], [-Math.PI / 2, rot || 0, 0], [rx, rz, 1], { vary: 0.08, noise: 0.05, rough: 0.05 });
  const m = K.mesh('p', new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.05, envMap: weaponEnv(), envMapIntensity: 0.35 }));
  if (m) {
    m.geometry.computeVertexNormals();
    // 물결 없이 평평하게 (rough 로 가장자리만 흔들렸으니 법선은 위로)
    const n = m.geometry.attributes.normal;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
    scene.add(m);
  }
}

/** 탄 그루터기 (겉은 숯, 잘린 면은 속 나무색, 뿌리 몇 가닥) */
export function charStump(K, r, groundY, x, z, rad, h, rot) {
  const y = groundY(x, z);
  K.push([x, y, z], rot);
  K.put('char', cyl(rad * 0.92, rad * 1.15, h, 8), C.char, [0, h / 2, 0], [0, 0, 0], 1, { rough: 0.06, vary: 0.2, noise: 0.15 });
  K.put('stump', new THREE.CylinderGeometry(rad * 0.86, rad * 0.86, 0.04, 8), C.stump, [0, h + 0.01, 0], [0, 0, 0], 1, { vary: 0.15, noise: 0.2 }); // 잘린 면 (속 나무)
  for (let k = 0; k < 3; k++) {
    const a = k * 2.1 + r();
    limb(K, 'char', [Math.cos(a) * rad * 0.7, 0.12, Math.sin(a) * rad * 0.7], [Math.cos(a) * rad * 2.2, -0.05, Math.sin(a) * rad * 2.2], rad * 0.35, rad * 0.12, C.char, { vary: 0.2 }, 5);
  }
  K.pop();
}
/** 쓰러진 통나무 (charred 면 숯, 아니면 바랜 나무) */
export function fallenLog(K, groundY, x, z, len, rad, rot, charred = 1) {
  const y = groundY(x, z) + rad * 0.85;
  K.push([x, y, z], rot);
  K.put(charred ? 'char' : 'wood', cyl(rad, rad * 1.06, len, 9), charred ? C.char : C.woodGrey, [0, 0, 0], [0, 0, Math.PI / 2], 1, { rough: 0.04, vary: 0.2, noise: 0.15 });
  K.put('stump', new THREE.CylinderGeometry(rad * 0.88, rad * 0.88, 0.03, 9), C.stump, [len / 2, 0, 0], [0, 0, Math.PI / 2], 1, { noise: 0.2 });
  K.pop();
}

/** 여러 모양(색 속성 포함)을 한 모양으로 합친다 (Kit 은 재질별 합치기라 인스턴스용 원본에는 따로 쓴다) */
function mergeAll(list) {
  const pos = [];
  const col = [];
  const nrm = [];
  for (const g of list) {
    pos.push(...g.attributes.position.array);
    col.push(...g.attributes.color.array);
    if (!g.attributes.normal) g.computeVertexNormals();
    nrm.push(...g.attributes.normal.array);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

/**
 * 둘레의 검은 가문비 숲 (인스턴싱: 원뿔 세 단 + 줄기). 25m 밖은 빽빽하고 21~25m 가장자리는 어린 나무만 드문드문.
 *  openAz 방향 ±openHalf 는 비탈이 트여 있다. avoid: [{x, z, r}] 안에는 안 심는다
 */
export function spruceForest(scene, groundY, FOG, { openAz = 0, openHalf = 0.7, avoid = [], count = 640, seed = 41 } = {}) {
  const trees = [];
  const tr = rng(seed);
  for (let i = 0; i < count; i++) {
    const a = tr() * Math.PI * 2;
    const da = Math.atan2(Math.sin(a - openAz), Math.cos(a - openAz));
    const open = Math.abs(da) < openHalf; // 트인 쪽
    const d = open ? 40 + tr() * 12 : tr() < 0.15 ? 21 + tr() * 4 : 25 + tr() * 24;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (avoid.some((o) => Math.hypot(x - o.x, z - o.z) < o.r)) continue;
    trees.push({ x, z, y: groundY(x, z), h: d < 25 ? 4 + tr() * 3 : 6 + tr() * 6, rot: tr() * 6.3, k: 0.9 + tr() * 0.3 }); // 가장자리 어린 나무는 작다
  }
  // 원뿔 세 단 + 줄기를 한 모양으로 (꼭짓점 색으로 위쪽이 조금 밝다)
  const tierGeo = (rad, h, y) => {
    const g = new THREE.ConeGeometry(rad, h, 7, 1, true);
    g.translate(0, y + h / 2, 0);
    return g;
  };
  const parts = [tierGeo(1.0, 3.2, 0.0), tierGeo(0.8, 3.0, 2.2), tierGeo(0.55, 2.8, 4.2), cyl(0.09, 0.16, 1.4, 5).translate(0, 0.7, 0)];
  const cols = [0.72, 0.86, 1.0, 0]; // 0 = 줄기
  const merged = [];
  for (let p = 0; p < parts.length; p++) {
    const g = parts[p].toNonIndexed();
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    const base = new THREE.Color(cols[p] ? C.spruce : C.bark);
    for (let i = 0; i < n; i++) {
      const k = cols[p] ? cols[p] * (0.85 + h3(g.attributes.position.getX(i), g.attributes.position.getY(i), g.attributes.position.getZ(i), 2) * 0.3) : 1;
      col[i * 3] = base.r * k;
      col[i * 3 + 1] = base.g * k;
      col[i * 3 + 2] = base.b * k;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    merged.push(g);
  }
  const treeGeo = mergeAll(merged);
  treeGeo.scale(1, 1 / 7, 1); // 높이 7 → 1 로 정규화해서 인스턴스마다 h 배
  const inst = new THREE.InstancedMesh(treeGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }), trees.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  trees.forEach((t, i) => {
    q.setFromAxisAngle(_v.set(0, 1, 0), t.rot);
    s.set(t.k * t.h * 0.22, t.h, t.k * t.h * 0.22);
    m.compose(_v.set(t.x, t.y - 0.2, t.z), q, s);
    inst.setMatrixAt(i, m);
    inst.setColorAt(i, _c.setScalar(0.8 + h3(t.x, 0, t.z, 9) * 0.4).lerp(_c.clone().set(FOG), THREE.MathUtils.smoothstep(Math.hypot(t.x, t.z), 24, 48) * 0.35));
  });
  inst.castShadow = false;
  scene.add(inst);
}

/** 자작나무 한 그루: 흰 줄기(검은 마디), 가지 끝에 드문드문 연두 잎 뭉치 */
export function birchTree(K, r, groundY, x, z, h, lean) {
  const y = groundY(x, z);
  K.push([x, y, z], r() * 6.3);
  const top = [lean * h, h, 0];
  limb(K, 'birch', [0, -0.2, 0], top, 0.13, 0.05, C.birch, { vary: 0.08, noise: 0.06 }, 7);
  for (let k = 0; k < 6; k++) {
    const t = 0.25 + r() * 0.65;
    K.put('char', box(0.3, 0.06 + r() * 0.08, 0.05), C.char, [lean * h * t, h * t, 0], [0, r() * 3, 0], 1, { noise: 0.1 }); // 검은 마디
  }
  for (let k = 0; k < 7; k++) {
    const t = 0.5 + r() * 0.45;
    const a = r() * Math.PI * 2;
    const b0 = [lean * h * t, h * t, 0];
    const b1 = [b0[0] + Math.cos(a) * (0.8 + r()), b0[1] + 0.4 + r() * 0.8, b0[2] + Math.sin(a) * (0.8 + r())];
    limb(K, 'birch', b0, b1, 0.035, 0.012, C.birch, { vary: 0.1 }, 5);
    if (r() < 0.7) K.put('sproutLeaf', new THREE.IcosahedronGeometry(1, 0), C.sprout, b1, [0, r() * 3, 0], [0.26 + r() * 0.2, 0.13 + r() * 0.08, 0.26 + r() * 0.2], { vary: 0.2, noise: 0.15 });
  }
  K.pop();
}

/** 새싹: 탄 땅 사이로 드문드문 (인스턴싱, 작은 세모잎 두 장). avoid: [{x, z, r}] */
export function sproutField(scene, groundY, { N = 1900, avoid = [], seed = 66, r0 = 8.8, r1 = 17 } = {}) {
  const sr = rng(seed);
  const g = new THREE.BufferGeometry();
  // 잎 두 장 = 삼각형 넷 (양면)
  const pts = [];
  for (const rot of [0, Math.PI / 2]) {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const a = [-0.022 * c, 0, -0.022 * s];
    const b = [0.022 * c, 0, 0.022 * s];
    const t = [0.012 * c, 0.09, 0.012 * s];
    pts.push(...a, ...b, ...t, ...b, ...a, ...t);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.computeVertexNormals();
  const inst = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide }), N);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const cS = new THREE.Color(C.sprout);
  const cD = new THREE.Color(C.sproutDry);
  let i = 0;
  let guard = 0;
  while (i < N && guard++ < N * 20) {
    const a = sr() * Math.PI * 2;
    const d = r0 + Math.sqrt(sr()) * r1;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    // 탄 자리(잿빛 얼룩이 짙은 곳)에는 안 났다 → 군데군데 뭉친다
    if (h3(Math.round(x * 0.5), 0, Math.round(z * 0.5), 4) > 0.55 && sr() < 0.8) continue;
    if (avoid.some((o) => Math.hypot(x - o.x, z - o.z) < o.r)) continue;
    const k = 0.6 + sr() * 0.7;
    q.setFromAxisAngle(_v.set(sr() - 0.5, 3, sr() - 0.5).normalize(), sr() * 6.3); // 조금씩 기울어 났다
    s.set(k, k * (0.8 + sr() * 0.6), k);
    m.compose(_v.set(x, groundY(x, z), z), q, s);
    inst.setMatrixAt(i, m);
    inst.setColorAt(i, _c.copy(cS).lerp(cD, sr() * 0.8).multiplyScalar(0.7 + sr() * 0.3));
    i++;
  }
  inst.count = i;
  inst.castShadow = false;
  scene.add(inst);
}

/** 양골담초 덤불: clumps = [[cx, cz, n]]. 가지는 K 에, 노란 꽃은 인스턴싱으로 */
export function broomBushes(scene, K, r, groundY, clumps) {
  const broomPts = [];
  for (const [cx, cz, n] of clumps) {
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const d = r() * 1.6;
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      const y = groundY(x, z);
      const h = 0.6 + r() * 0.7;
      for (let k = 0; k < 4; k++) {
        const b = r() * Math.PI * 2;
        limb(K, 'broomTwig', [x, y, z], [x + Math.cos(b) * 0.3, y + h, z + Math.sin(b) * 0.3], 0.03, 0.01, C.broomTwig, { vary: 0.15 }, 4);
      }
      broomPts.push([x, y + h * 0.7, z, h]);
    }
  }
  const per = 9;
  const g = new THREE.IcosahedronGeometry(0.075, 0);
  const inst = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true }), broomPts.length * per);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const cB = new THREE.Color(C.broom);
  broomPts.forEach(([x, y, z, h], j) => {
    for (let k = 0; k < per; k++) {
      const a = r() * Math.PI * 2;
      const d = r() * 0.32;
      q.setFromAxisAngle(_v.set(1, 0, 0), r() * 3);
      s.setScalar(0.8 + r() * 0.6);
      m.compose(_v.set(x + Math.cos(a) * d, y + (r() - 0.5) * h * 0.5, z + Math.sin(a) * d), q, s);
      inst.setMatrixAt(j * per + k, m);
      inst.setColorAt(j * per + k, _c.copy(cB).multiplyScalar(0.8 + r() * 0.35));
    }
  });
  scene.add(inst);
}

/** 먼 산등성이 두 겹 (안개에 옅게). 트인 쪽으로 보인다 */
export function farHills(scene, FOG, layers = [
  { R: 150, base: 14, amp: 24, top: 0x6d7a7a, seed: 3 },
  { R: 240, base: 32, amp: 36, top: 0x8e9a9c, seed: 4 },
]) {
  const fogC = new THREE.Color(FOG);
  for (const L of layers) {
    const NA = 220;
    const rr = rng(L.seed * 71);
    const ph = [rr() * 6, rr() * 6, rr() * 6, rr() * 6];
    const pos = [];
    const col = [];
    const top = new THREE.Color(L.top);
    for (let i = 0; i <= NA; i++) {
      const a = (i / NA) * Math.PI * 2;
      const n = 0.4 * Math.sin(2 * a + ph[0]) + 0.35 * Math.abs(Math.sin(6 * a + ph[1])) + 0.2 * Math.abs(Math.sin(15 * a + ph[2])) + 0.1 * Math.sin(37 * a + ph[3]);
      const hr = L.base + L.amp * (0.5 + 0.5 * n);
      const c = Math.cos(a);
      const s = Math.sin(a);
      pos.push(c * L.R * 0.8, -12, s * L.R * 0.8, c * L.R * 0.95, hr * 0.65, s * L.R * 0.95, c * L.R, hr, s * L.R);
      const mid = top.clone().lerp(fogC, 0.5);
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

/** 화전 터 공용 재질로 Kit 을 메쉬로 만들어 scene 에 더한다 (light: 꼭짓점에 구울 빛) */
export function clearingMeshes(scene, K, light = null) {
  const std = (p) => new THREE.MeshStandardMaterial({ vertexColors: true, ...p });
  const L = light ? { light } : {};
  const meshes = [
    K.mesh('stone', std({ roughness: 0.95, flatShading: true }), { cast: true, ...L }),
    K.mesh('char', std({ roughness: 1, flatShading: true }), { cast: true, ...L }),
    K.mesh('stump', std({ roughness: 0.9 }), L),
    K.mesh('wood', std({ roughness: 0.9 }), { cast: true, ...L }),
    K.mesh('daub', std({ roughness: 1 }), L),
    K.mesh('thatch', std({ roughness: 1, flatShading: true }), L),
    K.mesh('birch', std({ roughness: 0.8 })),
    K.mesh('sproutLeaf', std({ roughness: 0.9, flatShading: true })),
    K.mesh('broomTwig', std({ roughness: 0.95 })),
    K.mesh('goat', std({ roughness: 0.85 })),
    K.mesh('crow', std({ roughness: 0.6 })),
    K.mesh('cloth', std({ roughness: 1 })),
    K.mesh('iron', std({ roughness: 0.55, metalness: 0.5 }), L),
    K.mesh('dark', std({ roughness: 1 })),
    K.mesh('embers', new THREE.MeshBasicMaterial({ vertexColors: true })),
  ];
  for (const m of meshes) if (m) scene.add(m);
}

/** 연기: 자리(src)에서 위로 오르며 퍼지는 회색 점. 바람이 불면 눕는다. low 면 낮게 깔린다. 반환 step(dt, t, gust) */
export function smokeColumn(scene, src, { n = 220, seed = 12, rise = 13, low = false } = {}) {
  const smk = rng(seed);
  const spos = new Float32Array(n * 3);
  const sage = new Float32Array(n); // 0~1, 태어나서 사라질 때까지
  const soff = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    sage[i] = smk();
    soff[i * 2] = (smk() - 0.5) * 2;
    soff[i * 2 + 1] = (smk() - 0.5) * 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(spos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: low ? 1.5 : 1.1, map: dotTexture(), transparent: true, opacity: low ? 0.12 : 0.16, depthWrite: false, color: 0x8a8a86 }));
  pts.frustumCulled = false;
  scene.add(pts);
  return (dt, t, gust) => {
    const lean = (low ? 1.2 : 0.35) + gust * 2.5;
    for (let i = 0; i < n; i++) {
      sage[i] += dt * (0.055 + gust * 0.05);
      if (sage[i] > 1) sage[i] -= 1;
      const a = sage[i];
      const spread = 0.35 + a * a * (low ? 7 : 4.5);
      const wob = Math.sin(t * 0.7 + i) * 0.3;
      spos[i * 3] = src.x + soff[i * 2] * spread - a * a * lean * 6 + wob;
      spos[i * 3 + 1] = src.y + a * rise * (1 - gust * 0.3);
      spos[i * 3 + 2] = src.z + soff[i * 2 + 1] * spread + Math.cos(t * 0.5 + i * 1.7) * 0.3 - a * 0.6;
    }
    geo.attributes.position.needsUpdate = true;
  };
}

/** 떠다니는 재. 반환 step(dt, t, gust) */
export function ashDrift(scene, { n = 600, seed = 77 } = {}) {
  const ar = rng(seed);
  const apos = new Float32Array(n * 3);
  const asp = new Float32Array(n);
  const BOX = 22;
  for (let i = 0; i < n; i++) {
    apos[i * 3] = (ar() - 0.5) * 2 * BOX;
    apos[i * 3 + 1] = ar() * 9;
    apos[i * 3 + 2] = (ar() - 0.5) * 2 * BOX;
    asp[i] = 0.25 + ar() * 0.5;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(apos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.06, map: dotTexture(), transparent: true, opacity: 0.85, depthWrite: false, color: 0x4a4744 }));
  pts.frustumCulled = false;
  scene.add(pts);
  return (dt, t, gust) => {
    const wx = -0.25 - gust * 3.5;
    const wz = 0.1 + gust * 1.2;
    for (let i = 0; i < n; i++) {
      const j = i * 3;
      apos[j + 1] += asp[i] * dt * (0.35 + gust * 1.2) * (Math.sin(t * 0.9 + i) > -0.3 ? 1 : -0.6);
      apos[j] += (wx + Math.sin(t * 0.8 + i) * 0.35) * dt;
      apos[j + 2] += (wz + Math.cos(t * 0.6 + i * 1.3) * 0.35) * dt;
      if (apos[j + 1] > 9) apos[j + 1] -= 9;
      if (apos[j + 1] < 0) apos[j + 1] += 9;
      if (apos[j] < -BOX) apos[j] += 2 * BOX;
      if (apos[j] > BOX) apos[j] -= 2 * BOX;
      if (apos[j + 2] > BOX) apos[j + 2] -= 2 * BOX;
      if (apos[j + 2] < -BOX) apos[j + 2] += 2 * BOX;
    }
    geo.attributes.position.needsUpdate = true;
  };
}

/**
 * 봄비: 가는 빗줄기(점 스프라이트)가 결투 자리 둘레 24m 상자 안에 내린다. 바람에 비스듬하고, 큰 타격이 나오면 휘몰아친다.
 *  폰에서 가볍게: 점 2400개, 질감 한 장. 반환 step(dt, t, gust)
 */
export function springRain(scene, { n = 2400, seed = 55 } = {}) {
  const rr = rng(seed);
  const pos = new Float32Array(n * 3);
  const sp = new Float32Array(n);
  const BOX = 24;
  const H = 14;
  for (let i = 0; i < n; i++) {
    pos[i * 3] = (rr() - 0.5) * 2 * BOX;
    pos[i * 3 + 1] = rr() * H;
    pos[i * 3 + 2] = (rr() - 0.5) * 2 * BOX;
    sp[i] = 6.5 + rr() * 3;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.55, map: rainTexture(), transparent: true, opacity: 0.42, depthWrite: false, color: 0xd6dcdd }));
  pts.frustumCulled = false;
  scene.add(pts);
  return (dt, t, gust) => {
    const wx = -0.9 - gust * 5;
    const wz = 0.3 + gust * 1.5;
    for (let i = 0; i < n; i++) {
      const j = i * 3;
      pos[j + 1] -= sp[i] * dt;
      pos[j] += wx * dt;
      pos[j + 2] += wz * dt;
      if (pos[j + 1] < 0) pos[j + 1] += H;
      if (pos[j] < -BOX) pos[j] += 2 * BOX;
      if (pos[j + 2] > BOX) pos[j + 2] -= 2 * BOX;
    }
    geo.attributes.position.needsUpdate = true;
  };
}

/**
 * 화전 터 경기장(1안)을 만든다. 반환: { update(dt), excite(amount), sunOffset, fighterLight }
 *  lights: main.js 의 { hemi, sun } — 이른 아침 빛으로 바꾼다. opt.rain: 봄비 (기본 켬)
 */
export function buildClearing(scene, lights = {}, { rain = true } = {}) {
  const r = rng(2203);
  const K = new Kit(577);
  const { FOG, sunOffset } = morning(scene, lights, { rain });
  const groundY = (x, z) => slopeY(x, z, -1);
  const HUT = { x: -15.5, z: 9, rot: 0.55 };
  const KILN = { x: 13.5, z: -13 };

  ashGround(scene, groundY, { wet: rain });

  // ── 결투 자리: 밭에서 골라낸 돌을 무릎 높이로 둥글게 쌓았다 (경기장 경계). 동쪽 한 군데가 무너져 트였다 ──
  {
    const R0 = ARENA.radius + 0.75;
    const n = 46;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      if (Math.abs(a - 0.15) < 0.32) continue; // 동쪽 트인 자리
      const rad = R0 + (r() - 0.5) * 0.3;
      const s = 0.28 + r() * 0.22;
      const h = 0.16 + r() * 0.16;
      K.put('stone', box(s, h, s * (0.7 + r() * 0.5)), C.stone, [Math.cos(a) * rad, h / 2 - 0.03, Math.sin(a) * rad], [(r() - 0.5) * 0.2, a + r() * 0.5, (r() - 0.5) * 0.2], 1, { rough: 0.05, vary: 0.2, noise: 0.1 });
      if (r() < 0.55) {
        // 위에 하나 더
        const s2 = s * (0.6 + r() * 0.3);
        K.put('stone', box(s2, h * 0.8, s2 * (0.7 + r() * 0.5)), C.stone, [Math.cos(a) * rad + (r() - 0.5) * 0.15, h + h * 0.35, Math.sin(a) * rad + (r() - 0.5) * 0.15], [(r() - 0.5) * 0.3, a + r() * 1.2, (r() - 0.5) * 0.3], 1, { rough: 0.05, vary: 0.2, noise: 0.1 });
      }
    }
    // 무너진 자리에 흩어진 돌
    for (let i = 0; i < 5; i++) K.put('stone', box(0.25, 0.14, 0.2), C.stone, [Math.cos(0.15) * (R0 + 0.3 + i * 0.35), 0.05, Math.sin(0.15) * R0 + (r() - 0.5) * 0.9], [0, r() * 3, 0], 1, { rough: 0.04, vary: 0.2 });
  }

  // ── 탄 그루터기와 쓰러진 통나무 (결투 자리 밖 9~24m) ──
  for (let i = 0; i < 54; i++) {
    const a = r() * Math.PI * 2;
    const d = 9.3 + r() * 14;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (x < -10 && z > 4 && z < 14) continue; // 오두막 마당
    if (x > 9 && z < -8) continue; // 숯가마
    charStump(K, r, groundY, x, z, 0.14 + r() * 0.2, 0.2 + r() * 0.4, r() * 6.3);
  }
  fallenLog(K, groundY, 11.5, 6.5, 3.6, 0.24, 0.5);
  fallenLog(K, groundY, -6, -14.5, 4.2, 0.28, 1.9);
  fallenLog(K, groundY, 4.5, 15.5, 2.8, 0.2, -0.4);
  fallenLog(K, groundY, -15.5, -6, 3.1, 0.22, 2.6);

  // ── 서쪽 비탈 아래: 화전민 오두막 ──
  //   한 칸짜리 흙벽 오두막, 한쪽으로 처진 이엉 지붕, 돌을 쌓은 굴뚝(그을음), 판자 몇 장 빠진 울타리
  const HY = groundY(HUT.x, HUT.z);
  {
    K.push([HUT.x, HY, HUT.z], HUT.rot);
    const w = 5.2;
    const d = 3.8;
    const wh = 2.0;
    // 벽 (조금 기울었다)
    K.put('daub', box(w, wh, d, 3, 2, 2), C.daub, [0, wh / 2 - 0.05, 0], [0.03, 0, 0.02], 1, { rough: 0.05, vary: 0.1, noise: 0.12 });
    K.put('stone', box(w + 0.3, 0.45, d + 0.3, 3, 1, 2), C.stone, [0, 0.2, 0], [0, 0, 0], 1, { rough: 0.05, noise: 0.12 }); // 돌 기초
    // 기둥·도리 (바랜 나무)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.put('wood', box(0.18, wh + 0.4, 0.18), C.woodGrey, [sx * (w / 2 - 0.05), wh / 2 + 0.15, sz * (d / 2 - 0.05)], [0, 0, 0], 1, { vary: 0.2 });
    K.put('wood', box(w + 0.4, 0.16, 0.16), C.woodGrey, [0, wh + 0.32, 0], [0, 0, 0], 1, { vary: 0.2 }); // 마룻대 받침
    // 이엉 지붕: 두 면, 한쪽(−z)이 더 처졌다
    const ridge = wh + 1.3;
    for (const s of [-1, 1]) {
      const sag = s < 0 ? 0.22 : 0;
      const slope = Math.atan2(ridge - wh - sag, d / 2 + 0.7);
      const rl = Math.hypot(ridge - wh - sag, d / 2 + 0.7) + 0.3;
      K.put('thatch', box(w + 1.0, 0.22, rl, 6, 1, 4), C.thatch, [0, (ridge + wh - sag) / 2 + 0.02, s * (d / 4 + 0.35)], [s * slope, 0, s < 0 ? 0.03 : 0], 1, { rough: 0.1, vary: 0.12, noise: 0.28 });
      for (let k = 0; k < 5; k++) K.put('wood', cyl(0.035, 0.035, rl - 0.2, 4), C.woodDark, [-w / 2 + 0.2 + k * (w / 4.4), (ridge + wh - sag) / 2 + 0.15, s * (d / 4 + 0.35)], [s * slope + Math.PI / 2, 0, 0], 1, { vary: 0.2 }); // 이엉을 누른 장대
    }
    K.put('wood', cyl(0.09, 0.09, w + 1.2, 6), C.woodDark, [0, ridge + 0.05, 0], [0, 0, Math.PI / 2], 1, { vary: 0.2 }); // 용마루
    // 문 (열려 있고 안은 어둡다)·작은 창
    K.put('dark', box(0.05, 1.55, 0.8), C.dark, [w / 2 + 0.01, 0.95, 0.4]);
    K.put('wood', box(0.05, 1.55, 0.78), C.woodGrey, [w / 2 + 0.32, 0.95, 1.0], [0, 0.9, 0], 1, { vary: 0.2 }); // 열린 문짝
    K.put('dark', box(0.05, 0.45, 0.5), C.dark, [w / 2 + 0.01, 1.35, -1.0]);
    // 굴뚝 (돌, 위는 그을음)
    K.put('stone', box(0.7, 3.4, 0.7, 1, 4, 1), C.stone, [-w / 2 + 0.6, 1.7, -d / 2 - 0.2], [0, 0, 0], 1, { rough: 0.04, noise: 0.12 });
    K.put('char', box(0.78, 0.5, 0.78), C.char, [-w / 2 + 0.6, 3.5, -d / 2 - 0.2], [0, 0, 0], 1, { rough: 0.04 });
    // 마당: 모탕에 박힌 도끼, 장작더미, 물통, 통나무 벤치
    const bx = w / 2 + 2.2;
    K.put('wood', cyl(0.3, 0.34, 0.5, 9), C.wood, [bx, 0.25, 0.2], [0, 0, 0], 1, { rough: 0.04, vary: 0.15 }); // 모탕
    K.put('wood', cyl(0.025, 0.03, 0.8, 5), C.woodDark, [bx + 0.05, 0.85, 0.2], [0.5, 0, -0.35]); // 도끼 자루
    K.put('iron', box(0.05, 0.16, 0.2), C.iron, [bx - 0.02, 0.56, 0.2], [0, 0, 0.35]); // 도끼 날
    for (let j = 0; j < 3; j++) for (let i = 0; i < 7 - j; i++) K.put('wood', cyl(0.1, 0.1, 0.9, 7), j % 2 ? C.wood : C.woodDark, [-1.6 + i * 0.22 + j * 0.11, 0.1 + j * 0.19, d / 2 + 0.75], [Math.PI / 2, 0, 0], 1, { vary: 0.25 });
    K.put('wood', cyl(0.24, 0.2, 0.4, 10, true), C.woodDark, [bx - 0.9, 0.2, -1.2], [0, 0, 0], 1, { vary: 0.15 }); // 물통
    K.put('dark', new THREE.CircleGeometry(0.2, 10), 0x1c2124, [bx - 0.9, 0.36, -1.2], [-Math.PI / 2, 0, 0]);
    K.put('wood', cyl(0.2, 0.22, 2.2, 8), C.woodGrey, [bx + 0.4, 0.2, -1.9], [0, 0, Math.PI / 2], 1, { vary: 0.15 }); // 벤치 통나무
    // 울타리: 말뚝에 가로대 둘, 판자 몇 장은 빠지고 기울었다
    const fence = (x0, z0, x1, z1) => {
      const L = Math.hypot(x1 - x0, z1 - z0);
      const rot = Math.atan2(-(z1 - z0), x1 - x0);
      K.push([(x0 + x1) / 2, 0, (z0 + z1) / 2], rot);
      const n = Math.floor(L / 1.6);
      for (let i = 0; i <= n; i++) K.put('wood', box(0.12, 1.05, 0.12), C.woodGrey, [-L / 2 + (i * L) / n, 0.5, 0], [(r() - 0.5) * 0.12, 0, (r() - 0.5) * 0.1], 1, { vary: 0.2 });
      for (let i = 0; i < n; i++)
        for (const hy of [0.42, 0.82]) {
          if (r() < 0.22) continue; // 빠진 판자
          K.put('wood', box(L / n + 0.1, 0.1, 0.05), C.woodGrey, [-L / 2 + ((i + 0.5) * L) / n, hy, 0.06], [0, 0, (r() - 0.5) * 0.12], 1, { vary: 0.25 });
        }
      K.pop();
    };
    fence(bx + 1.6, -3.2, bx + 1.6, 3.4);
    fence(-w / 2 - 0.8, 3.4, bx + 1.6, 3.4);
    K.pop();
  }

  /** 여윈 염소 한 마리: 말뚝에 묶여 탄 땅의 새싹을 뜯는다 (머리가 +x 쪽) */
  {
    const gx = HUT.x + 6.2;
    const gz = HUT.z - 3.2;
    K.push([gx, groundY(gx, gz), gz], 2.4);
    const o = { vary: 0.06, noise: 0.08 };
    const sph = (p, s, c = C.goat) => K.put('goat', new THREE.SphereGeometry(1, 10, 7), c, p, [0, 0, 0], s, o);
    sph([0, 0.62, 0], [0.4, 0.2, 0.15]); // 몸통 (갈비가 보일 만큼 홀쭉)
    sph([-0.3, 0.66, 0], [0.18, 0.2, 0.14]); // 엉덩이
    for (let k = 0; k < 4; k++) K.put('goat', new THREE.TorusGeometry(0.19 - k * 0.012, 0.012, 4, 10), C.goat, [0.12 - k * 0.09, 0.62, 0], [0, 0, 0], [1, 1, 0.8], o); // 드러난 갈비
    limb(K, 'goat', [0.36, 0.7, 0], [0.62, 0.42, 0.04], 0.09, 0.07, C.goat, o, 8); // 목 (고개를 숙였다)
    sph([0.64, 0.4, 0.04], [0.1, 0.09, 0.08]); // 머리
    limb(K, 'goat', [0.64, 0.4, 0.04], [0.8, 0.3, 0.05], 0.07, 0.04, C.goat, o, 7); // 주둥이
    limb(K, 'goat', [0.79, 0.28, 0.05], [0.8, 0.16, 0.05], 0.025, 0.01, C.goatDark, o, 4); // 수염
    for (const s of [-1, 1]) {
      limb(K, 'goat', [0.6, 0.48, 0.04 + s * 0.05], [0.5, 0.66, 0.04 + s * 0.1], 0.02, 0.008, C.goatDark, o, 4); // 뿔 (뒤로 휜다)
      K.put('goat', box(0.02, 0.06, 0.1), C.goat, [0.6, 0.42, 0.04 + s * 0.11], [0, 0, s * 0.6], 1, o); // 귀 (늘어졌다)
      K.put('goat', new THREE.SphereGeometry(0.014, 5, 4), 0x0a0808, [0.7, 0.42, 0.04 + s * 0.07]); // 눈
    }
    for (const [lx, lz] of [
      [0.28, -0.1],
      [0.28, 0.1],
      [-0.26, -0.1],
      [-0.26, 0.1],
    ]) {
      limb(K, 'goat', [lx, 0.5, lz], [lx + (lx < 0 ? -0.05 : 0.02), 0.26, lz], 0.045, 0.03, C.goat, o, 6);
      limb(K, 'goat', [lx + (lx < 0 ? -0.05 : 0.02), 0.26, lz], [lx, 0.03, lz], 0.03, 0.02, C.goatDark, o, 6);
    }
    limb(K, 'goat', [-0.48, 0.72, 0], [-0.56, 0.62, 0.02], 0.025, 0.01, C.goatDark, o, 4); // 짧은 꼬리
    // 목줄 → 말뚝
    K.put('goat', new THREE.TorusGeometry(0.075, 0.012, 4, 10), 0x2a2018, [0.42, 0.62, 0.02], [0, 0, 1.2]);
    K.put('wood', cyl(0.035, 0.045, 0.5, 5), C.woodDark, [1.5, 0.22, -0.6], [0.1, 0, 0.12]);
    limb(K, 'wood', [0.42, 0.6, 0.02], [1.0, 0.24, -0.35], 0.012, 0.012, C.rope, {}, 3);
    limb(K, 'wood', [1.0, 0.24, -0.35], [1.5, 0.4, -0.6], 0.012, 0.012, C.rope, {}, 3);
    K.pop();
  }

  // ── 북동쪽 숯가마: 흙을 덮은 둥근 가마, 위로 가는 연기 ──
  const KY = groundY(KILN.x, KILN.z);
  {
    K.put('daub', new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0x5d5044, [KILN.x, KY - 0.1, KILN.z], [0, 0, 0], [2.4, 1.7, 2.4], { rough: 0.06, vary: 0.06, noise: 0.14 });
    K.put('char', new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), C.char, [KILN.x, KY - 0.1, KILN.z], [0, 0, 0], [1.0, 1.75, 1.0], { rough: 0.05 }); // 꼭대기 그을음
    K.put('dark', box(0.5, 0.55, 0.1), C.dark, [KILN.x - 2.3, KY + 0.28, KILN.z], [0, Math.PI / 2, 0]); // 불구멍
    for (let i = 0; i < 4; i++) K.put('wood', cyl(0.09, 0.09, 1.3, 6), C.woodDark, [KILN.x - 3.2 + i * 0.2, KY + 0.1 + (i > 2 ? 0.18 : 0), KILN.z + 1.6], [Math.PI / 2, 0.2, 0], 1, { vary: 0.2 }); // 가마에 넣을 나무
  }

  // ── 남동쪽 비탈 가장자리의 양골담초 덤불 (노랑은 여기뿐) ──
  broomBushes(scene, K, r, groundY, [
    [15.5, 11.5, 7],
    [19, 7, 5],
    [12, 16.5, 4],
  ]);

  // ── 둘레의 숲: 검은 가문비와 자작나무 몇 그루 ──
  spruceForest(scene, groundY, FOG, { avoid: [{ x: HUT.x, z: HUT.z, r: 6.5 }, { x: KILN.x, z: KILN.z, r: 6 }] });
  for (const [x, z, h, lean] of [
    [-9.5, -16.5, 6.5, 0.06],
    [-12, -18.5, 5.5, -0.04],
    [17, 14.5, 7, 0.05],
    [20.5, 12, 5, 0.1],
    [-20, 2, 8, 0.03],
    [6, -19.5, 6, -0.07],
    [-18, 15.5, 6.5, 0.08],
  ])
    birchTree(K, r, groundY, x, z, h, lean);

  sproutField(scene, groundY, { avoid: [{ x: HUT.x, z: HUT.z, r: 4.5 }, { x: KILN.x, z: KILN.z, r: 3 }] });
  farHills(scene, FOG);
  clearingMeshes(scene, K);

  // 비: 낮은 자리에 웅덩이 (결투 자리 안쪽은 아주 납작한 원판이라 카메라에 안 걸린다)
  if (rain)
    puddles(scene, groundY, [
      [2.5, 3.2, 1.4, 0.9, 0.4],
      [-3.8, -1.5, 1.1, 0.7, 1.2],
      [-1, 5.6, 0.8, 0.5, 0],
      [9.5, -2, 1.8, 1.1, 0.7],
      [-11, 3, 1.5, 0.9, 2.1],
      [6, 12, 1.2, 0.8, 0.3],
      [-6.5, -9.5, 1.3, 0.8, 1.6],
      [13, 4.5, 1.0, 0.6, 0.9],
    ]);

  const steps = [smokeColumn(scene, { x: KILN.x, y: KY + 1.6, z: KILN.z }), ashDrift(scene)];
  if (rain) steps.push(springRain(scene));

  let t = 0;
  let gust = 0;
  const stepAll = (dt) => {
    for (const s of steps) s(dt, t, gust);
  };
  stepAll(0);

  return {
    sunOffset,
    // 검은 땅이 빛을 되비치지 않아 캐릭터 아래쪽이 어둡다 → 바탕빛을 누런 아침 해 색으로, 테두리광을 조금 세게
    fighterLight: { color: 0xffe2b8, rimColor: 0xd9e2e8, rim: 1.4, level: 0.9 },
    /** 큰 타격: 재가 휘날리고 연기가 눕는다 (비도 휘몰아친다) */
    excite(amount) {
      gust = Math.min(1, gust + amount * 0.5);
    },
    update(dt) {
      t += dt;
      gust = Math.max(0, gust - dt * 0.4);
      stepAll(dt);
    },
  };
}
