// 얼어붙은 만 (`frozen_bay`) — 투야나 니콜라예바(id eira, 전 이름 에이라 린드)의 무대. 샛별 저장소에서 가져옴(b17a3c3, 기준 5a4e96c).
//  우리 쪽에서 더한 것(무대 리뷰 10/10 — 폰 화면에서 남색 사제복이 먹청색 얼음에 묻히고 결투장 경계가 없었다): duelGround() —
//  둘레보다 밝고 맑은 청백 얼음 결투 자리(10/11 사장님: 눈 바닥 → 다시 빙판) + 쓸어 모은 눈 둑 고리(경계) + 앞 바닥의 납작한 눈 무더기·얼어붙은 갈대 + 선착장 등불 + 바닥을 스치는 가루눈.
//  샛별 기록 이름은 '새벽의 얼음만'. 화면 이름은 사장님 말(10/10 20:4x)대로 '얼어붙은 만'. 물가는 stage_frozen_bay_shore.js, 소리는 stage_detail_sound.js·sound.js.
//  싸우는 바닥·물리는 그대로(장식만). 그림자: 물가 나무(wood)만 드리운다. docs/stages.md '얼어붙은 만'
// East-Siberian inland lake, winter predawn. Visual ice only: no physics changes.
import * as THREE from 'three';
import { ARENA } from './config.js';
import { Kit, canvasTex, rng, box, cyl, limb } from './stage_kit.js';
import { buildFrozenBayShore, CHAPEL, bankHeight } from './stage_frozen_bay_shore.js';

function iceTexture() {
  const r = rng(101071);
  const tex = canvasTex(1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#325568'; ctx.fillRect(0, 0, w, h);
    // Broad cloudy frost and stretched crystal grain; cracks are separate geometry.
    for (let i = 0; i < 145; i++) {
      const x = r() * w, y = r() * h, rad = 20 + r() * 145;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, rad);
      grad.addColorStop(0, i % 3 ? 'rgba(191,218,224,.10)' : 'rgba(5,24,39,.16)');
      grad.addColorStop(1, 'rgba(130,163,180,0)'); ctx.fillStyle = grad;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < 2300; i++) {
      ctx.strokeStyle = `rgba(198,224,230,${.015 + r() * .045})`;
      ctx.lineWidth = .4 + r() * 1.1; const x = r() * w, y = r() * h;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 4 + r() * 40, y + 1 + r() * 7); ctx.stroke();
    }
  });
  tex.repeat.set(12, 12);
  return tex;
}

function iceDetails(scene) {
  const k = new Kit(101033), r = rng(100879);
  const ribbon = (bin, a, b, width, y, color) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], d = Math.hypot(dx, dz);
    if (d < .001) return;
    const x = -dz / d * width / 2, z = dx / d * width / 2;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([
      a[0]-x,y,a[1]-z, b[0]-x,y,b[1]-z, a[0]+x,y,a[1]+z,
      b[0]-x,y,b[1]-z, b[0]+x,y,b[1]+z, a[0]+x,y,a[1]+z,
    ], 3));
    g.computeVertexNormals(); k.put(bin, g, color); g.dispose();
  };
  const fracture = (x, z, angle, steps, length, width, branch = true) => {
    for (let i = 0; i < steps; i++) {
      angle += (r() - .5) * .7;
      const b = [x + Math.cos(angle) * length * (.65 + r() * .7), z + Math.sin(angle) * length * (.65 + r() * .7)];
      ribbon('crackDepth', [x+.035,z+.023], [b[0]+.035,b[1]+.023], width * 4, .004, 0x142e41);
      ribbon('crack', [x,z], b, width, .008, 0xb2cbd5);
      if (branch && i % 4 === 2) fracture(x, z, angle + (r() > .5 ? 1 : -1) * .8, 3, length * .5, width * .55, false);
      [x,z] = b;
    }
  };
  fracture(-18, -10, .62, 17, 2.1, .026);
  fracture(-16, 9, -.38, 14, 2.4, .02);
  fracture(3, -23, 1.28, 20, 2.2, .018);
  fracture(17, -16, 1.8, 16, 2.5, .027);
  // Subdued, layered circles resemble bubbles trapped beneath clear ice, not snowflakes.
  const disk = new THREE.CircleGeometry(1, 10); disk.rotateX(-Math.PI / 2);
  for (let cluster = 0; cluster < 30; cluster++) {
    const x = (r() - .5) * 36, z = (r() - .5) * 36;
    for (let n = 0; n < 4; n++) {
      const radius = .02 + r() * .065;
      k.put('bubble', disk, n % 2 ? 0x668eaa : 0x759cae,
        [x + (r()-.5)*.6, .006, z + (r()-.5)*.65], undefined, [radius, 1, radius * .85]);
    }
  }
  disk.dispose();
  for (const name of ['crackDepth', 'crack', 'bubble']) {
    const mesh = k.mesh(name, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .48, side: THREE.DoubleSide }));
    mesh.name = `frozen-bay-${name}`; scene.add(mesh);
  }
  for (const bin of Object.values(k.bins)) for (const g of bin) g.dispose();
}

/** 결투 자리 (우리 쪽에서 더함): 반지름 8.6 m 안은 둘레보다 밝고 맑은 청백 얼음(반들한 결·흰 균열·얇게 날린 가루눈 줄),
 *  그 둘레에 쓸어 모은 눈 둑 고리(높이 0.3 m 안팎 — 카메라 궤도 안이라 납작하게), 둑 밖 얼음엔 납작한 눈 무더기·쓸린 눈 결,
 *  조금 먼 곳에 얼어붙은 갈대 무리. 물리는 그대로(장식만).
 *  10/11 사장님 '빙판이 다 눈길이 되어서 아쉬운데 — 이졸데 맵과 겹쳐서': 10/10 의 밝은 눈 바닥을 다시 빙판으로. 남색 사제복이 묻히지 않게
 *  둘레의 먹청 얼음(#325568)보다 한참 밝은 청백 얼음(#9cc0d4 언저리)으로 한다 */
function duelGround(scene) {
  const r = rng(101081);
  // ① 맑은 청백 얼음판: 원판 하나, 가장자리는 둘레의 먹청 얼음으로 녹아든다 (질감 알파) — 투명 물체 하나
  const iceTex = canvasTex(1024, 1024, (g, w, h) => {
    const cx = w / 2, R = w / 2;
    const grad = g.createRadialGradient(cx, cx, 0, cx, cx, R);
    grad.addColorStop(0, 'rgba(162,196,214,1)'); grad.addColorStop(0.7, 'rgba(150,186,206,1)'); grad.addColorStop(0.88, 'rgba(118,158,184,.8)'); grad.addColorStop(1, 'rgba(80,120,150,0)');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.save(); g.beginPath(); g.arc(cx, cx, R * 0.97, 0, Math.PI * 2); g.clip();
    for (let i = 0; i < 70; i++) { // 맑게 비치는 깊은 얼음 얼룩 (구름 낀 결)
      const x = r() * w, y = r() * h, rad = 30 + r() * 110;
      const gg = g.createRadialGradient(x, y, 0, x, y, rad);
      gg.addColorStop(0, i % 3 ? 'rgba(110,150,178,.22)' : 'rgba(205,226,236,.22)'); gg.addColorStop(1, 'rgba(120,160,186,0)');
      g.fillStyle = gg; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    const crack = (x, y, a, n, len, wid) => { // 흰 균열 (꺾이며 뻗고 가지 친다)
      for (let i = 0; i < n; i++) {
        a += (r() - 0.5) * 0.8;
        const nx = x + Math.cos(a) * len * (0.6 + r() * 0.8), ny = y + Math.sin(a) * len * (0.6 + r() * 0.8);
        g.strokeStyle = 'rgba(62,98,124,.35)'; g.lineWidth = wid * 2.6; g.beginPath(); g.moveTo(x + 1.5, y + 1.5); g.lineTo(nx + 1.5, ny + 1.5); g.stroke();
        g.strokeStyle = 'rgba(240,248,252,.85)'; g.lineWidth = wid; g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
        if (i % 3 === 1 && wid > 1.2) crack(nx, ny, a + (r() < 0.5 ? 1 : -1) * 0.9, 3, len * 0.55, wid * 0.6);
        x = nx; y = ny;
      }
    };
    for (let i = 0; i < 9; i++) crack(r() * w, r() * h, r() * Math.PI * 2, 6 + Math.floor(r() * 6), 30 + r() * 30, 1.4 + r() * 1.6);
    for (let i = 0; i < 160; i++) { // 얼음 속 작은 기포
      g.fillStyle = `rgba(230,242,248,${0.25 + r() * 0.35})`; g.beginPath(); g.arc(r() * w, r() * h, 1 + r() * 2.5, 0, Math.PI * 2); g.fill();
    }
    for (let i = 0; i < 46; i++) { // 바람에 얇게 날린 가루눈 줄 (한 방향)
      const x = r() * w, y = r() * h, len = 60 + r() * 220;
      g.strokeStyle = `rgba(236,244,248,${0.1 + r() * 0.16})`; g.lineWidth = 2 + r() * 6;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y + len * 0.18); g.stroke();
    }
    g.restore();
  });
  iceTex.wrapS = iceTex.wrapT = THREE.ClampToEdgeWrapping;
  const ice = new THREE.Mesh(new THREE.CircleGeometry(ARENA.radius + 2.1, 48), new THREE.MeshStandardMaterial({ map: iceTex, transparent: true, depthWrite: false, roughness: 0.42, metalness: 0.04, polygonOffset: true, polygonOffsetFactor: -1 }));
  ice.rotation.x = -Math.PI / 2; ice.position.y = 0.01; ice.receiveShadow = true; ice.renderOrder = 1; ice.name = 'frozen-bay-duel-ice'; scene.add(ice);
  // ② 눈 둑 고리 (+ 둑 밖 눈 무더기·갈대) — 꼭짓점 색 한 재질
  const k = new Kit(101083);
  const ring = [], N = 72;
  const bank = (a) => ARENA.radius + 0.85 + 0.18 * Math.sin(a * 5 + 1) + 0.1 * Math.sin(a * 13);
  const height = (a) => 0.2 + 0.08 * Math.sin(a * 7 + 0.4) + 0.05 * Math.sin(a * 17);
  const prof = [[-0.55, 0], [-0.22, 0.75], [0.05, 1], [0.35, 0.7], [0.75, 0]]; // 둑 단면 (안쪽 → 바깥, 높이 비)
  for (let i = 0; i < N; i++) for (let j = 0; j < prof.length - 1; j++) {
    const P = (ii, jj) => { const a = (ii / N) * Math.PI * 2, d = bank(a) + prof[jj][0]; return [Math.cos(a) * d, prof[jj][1] * height(a), Math.sin(a) * d]; };
    ring.push(...P(i, j), ...P(i, j + 1), ...P(i + 1, j), ...P(i + 1, j), ...P(i, j + 1), ...P(i + 1, j + 1));
  }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(ring, 3)); rg.computeVertexNormals();
  k.put('snow', rg, 0xc9d5de, undefined, undefined, 1, { vary: 0, noise: 0.05 }); rg.dispose();
  const lump = new THREE.SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  for (let i = 0; i < 26; i++) { // 둑 밖 납작한 눈 무더기 (8.5~15 m)
    const a = r() * Math.PI * 2, d = ARENA.radius + 2 + r() * 6.5, s = 0.25 + r() * 0.45;
    k.put('snow', lump, 0xa3b5c4, [Math.cos(a) * d, -0.02, Math.sin(a) * d], [0, r() * 3, 0], [s * (1 + r()), 0.05 + r() * 0.08, s], { vary: 0.08, noise: 0.05 });
  }
  for (let i = 0; i < 40; i++) { // 바람에 쓸린 눈 결 (얇고 긴 띠)
    const a = r() * Math.PI * 2, d = ARENA.radius + 2.1 + r() * 9;
    k.put('snow', box(0.12 + r() * 0.25, 0.012, 1.2 + r() * 2.8), 0xa9bccb, [Math.cos(a) * d, 0.004, Math.sin(a) * d], [0, 0.6 + (r() - 0.5) * 0.3, 0], 1, { vary: 0.1, noise: 0 });
  }
  frozenReeds(k, r);
  lump.dispose();
  const mesh = k.mesh('snow', new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), { cast: false, receive: true });
  mesh.name = 'frozen-bay-duel-bank'; scene.add(mesh);
  const reeds = k.mesh('reed', new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), { cast: false, receive: true });
  if (reeds) { reeds.name = 'frozen-bay-reeds'; scene.add(reeds); }
  for (const bin of Object.values(k.bins)) for (const g of bin) g.dispose();
}
/** 얼어붙은 갈대 무리 (11~17 m, 키 0.3~0.7 m — 카메라 궤도 밖) */
function frozenReeds(k, r) {
  for (let c = 0; c < 9; c++) {
    const a = r() * Math.PI * 2, d = 11 + r() * 6, cx = Math.cos(a) * d, cz = Math.sin(a) * d;
    for (let i = 0; i < 9; i++) {
      const x = cx + (r() - 0.5) * 1.4, z = cz + (r() - 0.5) * 1.4, h = 0.3 + r() * 0.4;
      k.put('reed', box(0.02, h, 0.02), r() < 0.5 ? 0x8b7f63 : 0x6f6852, [x, h / 2, z], [(r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5], 1, { vary: 0.15, noise: 0 });
    }
  }
}

/** 바닥을 스치는 낮은 가루눈: 점 260 개, 0~0.6 m 높이에서 바람 따라 흘러간다 (투명 물체 하나) */
function powder(scene) {
  const n = 260, r = rng(101087);
  const pos = new Float32Array(n * 3), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos[i * 3] = (r() - 0.5) * 30; pos[i * 3 + 1] = r() * 0.6; pos[i * 3 + 2] = (r() - 0.5) * 30; seed[i] = r(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xe8eef3, size: 0.05, transparent: true, opacity: 0.6, depthWrite: false }));
  pts.name = 'frozen-bay-powder'; pts.frustumCulled = false; scene.add(pts);
  return (dt, time) => {
    for (let i = 0; i < n; i++) {
      let x = pos[i * 3] + dt * (1.6 + seed[i] * 1.4), y = pos[i * 3 + 1];
      if (x > 15) x -= 30;
      y = 0.05 + 0.25 * (0.5 + 0.5 * Math.sin(time * (0.8 + seed[i]) + seed[i] * 40)) * seed[i] * 2;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] += dt * 0.35 * Math.sin(time * 0.3 + seed[i] * 9);
    }
    g.attributes.position.needsUpdate = true;
  };
}

/** 선착장 등불 (가까운 따뜻한 점 하나): 빛나는 재질만 — 진짜 빛은 달지 않는다 */
function pierLantern(scene, pierPos) {
  const grp = new THREE.Group(); grp.name = 'frozen-bay-lantern';
  const frame = new THREE.MeshStandardMaterial({ color: 0x2c2d2f, roughness: 0.6, metalness: 0.4 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xffb35c });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.2), glow);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.12, 4), frame); cap.position.y = 0.19; cap.rotation.y = Math.PI / 4;
  const hook = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.22, 0.02), frame); hook.position.y = 0.36;
  grp.add(body, cap, hook);
  // 선착장 오른쪽 앞 기둥 머리(stage_frozen_bay_shore.js agedPier: 기둥 (1.03 + 기욺, 1.4, -2.37), 선착장 -0.1 rad 돌림)
  const lx = 1.09, lz = -2.37, c = Math.cos(-0.1), s = Math.sin(-0.1);
  grp.position.set(pierPos.x + lx * c + lz * s, 1.58, pierPos.z - lx * s + lz * c); // 기둥 머리 눈 덮개(1.40 + 0.045) 위
  scene.add(grp);
}

/**
 * 바이칼 겨울 표식 셋 (10/11 3차 — 디렉터 의견에 사장님 동의 01:0x: '북쪽 어딘가의 얼어붙은 호수'까지만 읽히고 동시베리아는 약하다,
 *  넓게 보면 눈 둑에 둘러싸인 작은 못 같다). 결투 빙판·눈 둑·등불·가루눈은 그대로.
 *  ① 얼음 언덕(토로스): 깨진 청록 얼음판이 밀려 올라와 비스듬히 겹쳐 쌓인 능선 — 눈 둑 고리 바깥 12~24 m (카메라 궤도 10.5 m 밖)
 *  ② 먼 눈 덮인 산맥: 맞은편 기슭(181 m) 너머 215~232 m 에 바이칼 둘레 산맥처럼 눈 쓴 능선을 지평선에 길게.
 *     안개(62~205 m)에 묻히지 않게 안개를 끄고 먼 빛(옅은 회청 몸 · 새벽빛 받은 분홍빛 흰 눈머리)을 꼭짓점 색에 구웠다 — 분홍 새벽 하늘에 실루엣
 *  ③ 통나무 정교회 예배당(투야나의 교구): 만 어귀 너머 맞은편 기슭에 멀리 작게(10/11 4차, 처음엔 선착장 뒤 둑 위) — 통나무 벽·눈 덮인 박공지붕·양파 지붕 하나·팔단 십자
 */
function baikalBackdrop(scene) {
  const r = rng(101091);
  const out = { torosSlabs: 0 };
  // ① 토로스 — 능선 여섯, 능선마다 얼음판 9~16 장
  const k = new Kit(101093);
  const ridges = [[0.35, 15, 2.6], [1.15, 13, 3.4], [2.9, 19, 4.2], [3.7, 14, 2.8], [4.6, 21, 5.0], [5.5, 16, 3.0]]; // [각도, 거리, 길이]
  for (const [a, d, len] of ridges) {
    const cx = Math.cos(a) * d, cz = Math.sin(a) * d, dir = a + Math.PI / 2 + (r() - 0.5) * 0.6; // 능선은 대략 둘레 방향
    const n = 9 + Math.floor(r() * 8);
    for (let i = 0; i < n; i++) {
      const t = (i / (n - 1) - 0.5) * len;
      const crest = 1 - (2 * t / len) ** 2; // 가운데가 높다
      const w = 0.6 + r() * 1.1, h = 0.6 + r() * 0.9, th = 0.08 + r() * 0.08;
      const side = r() < 0.5 ? -1 : 1;
      const tilt = side * (0.18 + r() * 0.5); // 비스듬히 기대 선 판 (곧추설수록 날카롭게 읽힌다)
      const x = cx + Math.cos(dir) * t + Math.cos(dir + Math.PI / 2) * side * 0.15 * r();
      const z = cz + Math.sin(dir) * t + Math.sin(dir + Math.PI / 2) * side * 0.15 * r();
      const hh = h * (0.55 + crest * 0.75), y = hh * 0.42;
      k.put('toros', box(w, hh, th), r() < 0.3 ? 0x7cc6cf : r() < 0.5 ? 0x5fb0bf : 0x93d2da,
        [x, y, z], [tilt, -dir + (r() - 0.5) * 0.4, (r() - 0.5) * 0.3], 1, { rough: 0.03, vary: 0.12, noise: 0.06, snow: 0.55, snowColor: 0xe4ecf1 });
      out.torosSlabs++;
    }
    // 능선 밑동에 부서진 얼음 부스러기와 바람에 쌓인 눈
    for (let i = 0; i < 6; i++) {
      const t = (r() - 0.5) * len * 1.1;
      k.put('toros', box(0.25 + r() * 0.4, 0.06 + r() * 0.08, 0.2 + r() * 0.3), 0x8ccbd4, [cx + Math.cos(dir) * t + (r() - 0.5) * 0.8, 0.04, cz + Math.sin(dir) * t + (r() - 0.5) * 0.8], [0, r() * 3, (r() - 0.5) * 0.3], 1, { vary: 0.1, noise: 0.04, snow: 0.7, snowColor: 0xe4ecf1 });
    }
  }
  const toros = k.mesh('toros', new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.05, transparent: true, opacity: 0.88, emissive: 0x0c2a33 }), { cast: false, receive: true });
  toros.name = 'frozen-bay-toros'; scene.add(toros);
  for (const g of k.bins.toros) g.dispose();
  // ② 먼 눈 덮인 산맥 — 띠 하나(바탕 · 몸 · 눈선 · 능선 네 줄), 맞은편(+x) 쪽이 가장 높다. 몸은 하늘보다 조금 짙은 회청, 눈은 능선 가까이만
  const pos = [], col = [];
  const body = new THREE.Color(0x76869a), body2 = new THREE.Color(0x7f8ea1), snowline = new THREE.Color(0xa9afbf), snow = new THREE.Color(0xd6c9d1), cc = new THREE.Color();
  const N = 220, crest = [];
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const across = Math.max(0, Math.cos(a)) ** 0.7; // 맞은편(a=0, +x)이 1, 뒤쪽은 낮은 구릉 뒤로 조금만
    const peaks = Math.abs(Math.sin(a * 19 + 1.3)) ** 1.6 * 0.55 + Math.abs(Math.sin(a * 47 + 0.4)) ** 2 * 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(a * 6 + 2));
    crest.push(5 + across * 19 * peaks + (r() < 0.12 ? r() * 4 * across : 0));
  }
  crest[N] = crest[0];
  const P = (i, row) => {
    const a = (i / N) * Math.PI * 2, h = crest[i];
    const rad = [233, 229, 225, 222][row], y = [-2, h * 0.5, h * 0.8, h][row];
    return [Math.cos(a) * rad, y, Math.sin(a) * rad];
  };
  for (let i = 0; i < N; i++) for (let row = 0; row < 3; row++) {
    const v = [[i, row], [i, row + 1], [i + 1, row], [i + 1, row], [i, row + 1], [i + 1, row + 1]];
    for (const [ii, rr] of v) {
      pos.push(...P(ii, rr));
      const tall = crest[ii] > 12; // 높은 봉우리만 눈머리를 쓴다
      cc.copy([body, body2, tall ? snowline : body2, tall ? snow : snowline][rr]);
      if (rr === 2 && tall && Math.sin(ii * 1.7) > 0.3) cc.lerp(snow, 0.5); // 눈선이 골짜기 따라 들쭉날쭉
      col.push(cc.r, cc.g, cc.b);
    }
  }
  const mg = new THREE.BufferGeometry();
  mg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  mg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mountains = new THREE.Mesh(mg, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
  mountains.name = 'frozen-bay-far-range'; scene.add(mountains);
  // ③ 통나무 예배당 — 10/11 4차: 만 어귀 너머 맞은편 기슭 능선(약 188 m, 중경과 원경 사이)에 작게. 그 거리는 안개(62~205 m)에 거의 묻히므로
  //  안개를 끄고 먼 빛을 입힌 짙은 회청 실루엣으로 칠했다(산맥과 같은 방식) — 분홍 새벽 하늘에 겨우 읽힐 만큼. 십자는 멀리서도 끝이 보이게 굵게
  const c = new Kit(101097);
  c.push([CHAPEL.x, CHAPEL.y, CHAPEL.z], CHAPEL.rotY);
  const LOG = 0x4d5868, LOG2 = 0x535e6e, W = 3.0, L = 4.2, H = 2.6, LR = 0.13;
  for (let i = 0; i < Math.round(H / (LR * 1.8)); i++) { // 통나무를 쌓은 네 벽 (모서리에서 통나무 끝이 엇갈려 삐죽)
    const y = LR + i * LR * 1.8, col = i % 2 ? LOG : LOG2;
    for (const sx of [-1, 1]) limb(c, 'log', [sx * W / 2, y, -L / 2 - 0.25], [sx * W / 2, y, L / 2 + 0.25], LR, LR, col, { noise: 0.06 }, 6);
    for (const sz of [-1, 1]) limb(c, 'log', [-W / 2 - 0.25, y + LR * 0.9, sz * L / 2], [W / 2 + 0.25, y + LR * 0.9, sz * L / 2], LR, LR, col, { noise: 0.06 }, 6);
  }
  c.put('log', box(W, H, L), 0x434d5b, [0, H / 2, 0]); // 안쪽 벽(통나무 틈 사이 어둠)
  c.put('log', box(0.8, 1.5, 0.08), 0x353d48, [0, 0.85, L / 2 + LR + 0.02]); // 문
  // 눈 덮인 박공지붕 (판자 둘) + 지붕 끝
  for (const sx of [-1, 1]) {
    c.put('roof', box(W / 2 + 0.55, 0.12, L + 0.9), 0x4a5361, [sx * (W / 4 + 0.12), H + 0.75, 0], [0, 0, -sx * 0.62], 1, { noise: 0.05, snow: 0.95, snowColor: 0xa9b3c1 });
  }
  // 지붕 마루 위 팔각 북 + 양파 지붕 + 팔단 십자
  const drumY = H + 1.45;
  c.put('log', cyl(0.45, 0.5, 0.9, 8), LOG, [0, drumY + 0.45, -0.3]);
  const onion = new THREE.LatheGeometry([[0, 0], [0.55, 0.05], [0.72, 0.35], [0.66, 0.7], [0.38, 1.05], [0.12, 1.35], [0.04, 1.55], [0, 1.6]].map(([x, y]) => new THREE.Vector2(x, y)), 10);
  c.put('dome', onion, 0x48525f, [0, drumY + 0.9, -0.3], undefined, 1, { vary: 0, noise: 0.05, snow: 0.35, snowColor: 0xa9b3c1 });
  const cy = drumY + 2.5, CR = 0x3b4350; // 팔단 십자: 세로대 · 위 짧은 가로대 · 큰 가로대 · 아래 비스듬한 발판
  c.put('cross', box(0.16, 1.35, 0.16), CR, [0, cy + 0.45, -0.3]);
  c.put('cross', box(0.4, 0.13, 0.13), CR, [0, cy + 0.92, -0.3]);
  c.put('cross', box(0.8, 0.15, 0.15), CR, [0, cy + 0.66, -0.3]);
  c.put('cross', box(0.55, 0.13, 0.13), CR, [0, cy + 0.15, -0.3], [0, 0, 0.42]);
  c.pop();
  chapelMoundAndBear(c, out);
  const mats = { log: new THREE.MeshLambertMaterial({ vertexColors: true, fog: false }), roof: new THREE.MeshLambertMaterial({ vertexColors: true, fog: false }),
    dome: new THREE.MeshLambertMaterial({ vertexColors: true, fog: false }), cross: new THREE.MeshLambertMaterial({ vertexColors: true, fog: false }) };
  for (const [bin, mat] of Object.entries(mats)) {
    const m = c.mesh(bin, mat, { cast: false, receive: false });
    m.name = 'frozen-bay-chapel-' + bin; scene.add(m);
    for (const g of c.bins[bin]) g.dispose();
  }
  return out;
}

/** 예배당 앞 눈 둔덕 + 결투를 지켜보는 북극곰 (10/13 23:0x 사장님 '그 앞에 북극곰이 앉아서 결투를 지켜보게').
 *  ① 눈 둔덕(SNOW_MOUND): 예배당 박공벽(결투장 쪽 — 문은 반대쪽) 앞에 낮고 둥근 눈 언덕(꼭대기 ≈ 예배당 바닥 1.7 m) — 비탈 위에 들뜬 예배당 앞 틈을 가린다.
 *     면마다 명암이 지는 평면 음영(무대 물가 눈 둑과 같은 결), 색은 예배당 지붕 눈과 같은 먼 빛 눈색. (10/13 23:4x 사장님 결정 '눈 둔덕 위에 올리고 1.5배로' 때 쌓음)
 *  ② 북극곰(BEAR): 엉덩이를 깔고 앞다리를 곧게 세워 앉아 결투장 한가운데(0, 0)를 본다. 앉은 키 2.49 m(실제 곰 1.66 m 의 1.5배, 10/13 23:4x), 크림빛 흰 털·검은 코와 눈.
 *     10/14 00:0x 사장님 '북극곰 넘 작다; 예배당 근처 말고 돔 앞으로 옮겨': 188 m 예배당 둔덕 위(900×600 결투 카메라 키 약 9 px)에서
 *     결투 카메라 첫 화면 오른쪽 가장자리의 나무 없는 둥근 눈 언덕(물가 둑 shoreLand 가 시작되는 오른쪽 곶, a ≈ 0.5~0.6 · 반지름 36~53 m — '돔')
 *     앞자락(결투장 쪽, 물가 36.3 m 에서 3.7 m 올라간 첫 눈 비탈, 반지름 BEAR.r)으로 옮겼다. 크기는 그대로, 거리로 크게(900×600 결투 카메라 키 약 40 px).
 *     높이는 물가 둑 bankHeight 를 앞발 자리에서 읽어 앉힌다(비탈 위쪽 엉덩이는 눈에 조금 묻힘). 카메라 궤도(10.5 m)·결투 공간 밖, 물리 몸 없음.
 *  둘 다 예배당과 같은 Kit·같은 'log' 통(Lambert·안개 끔 — 곰 거리 40 m 는 안개 시작 62 m 안이라 같아 보임)에 합쳐 그리기 호출은 늘지 않는다 · 그림자 없음 · 움직임 없음.
 *  난수: Kit 제 것(밝기 흔들림)만 — 무대의 다른 흩뿌림 순서는 그대로 */
const BEAR = { a: 0.55, r: 40, scale: 1.5 }; // 결투장 한가운데 기준 방위각 a(rad, atan2(z, x)) · 반지름 r(m — 그 방향 물가 36.3 m, 그 너머 눈 비탈) · 크기 배율(1 = 앉은 키 1.66 m)
const SNOW_MOUND = { front: 3.3, rx: 3.4, rz: 3.8, h: 1.9, y: -0.15, color: 0xa9b3c1 }; // 예배당 박공벽 앞 front m · 반구를 눌러 편 꼴: 옆 반지름 rx · 앞뒤 rz · 높이 h · 밑동 y(얼음 아래로 조금) — 꼭대기 1.75 m
function chapelMoundAndBear(c, out) {
  const fx = -Math.sin(CHAPEL.rotY), fz = -Math.cos(CHAPEL.rotY); // 예배당 -Z (박공벽이 보는 쪽)
  // ① 눈 둔덕: 낮고 둥근 언덕 — 위 반구를 눌러 펴고, 면 법선(평면 음영)에 모서리를 조금 흔들어 눈 무더기 결
  const mound = new THREE.SphereGeometry(1, 12, 4, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed();
  mound.computeVertexNormals();
  const mx = CHAPEL.x + fx * SNOW_MOUND.front, mz = CHAPEL.z + fz * SNOW_MOUND.front;
  c.put('log', mound, SNOW_MOUND.color, [mx, SNOW_MOUND.y, mz], [0, CHAPEL.rotY, 0], [SNOW_MOUND.rx, SNOW_MOUND.h, SNOW_MOUND.rz], { vary: 0, noise: 0.04, rough: 0.14 });
  mound.dispose();
  // ② 북극곰 — '돔' 앞 얼음 위
  const n0 = c.bins.log.length;
  const x = Math.cos(BEAR.a) * BEAR.r, z = Math.sin(BEAR.a) * BEAR.r;
  const paw = BEAR.r - 0.39 * BEAR.scale; // 앞발 자리(결투장 쪽, 비탈 아래)
  const y = bankHeight(Math.cos(BEAR.a) * paw, Math.sin(BEAR.a) * paw) - 0.03;
  out.bear = { x: +x.toFixed(2), y: +y.toFixed(2), z: +z.toFixed(2), height: +(1.66 * BEAR.scale).toFixed(2) };
  c.push([x, y, z], Math.atan2(-x, -z), BEAR.scale); // 곰의 +Z 가 결투장 한가운데를 본다 (아래 치수는 배율 1 기준)
  const FUR = 0xe6dcc4, FUR2 = 0xd6cdb8, DARK = 0x16181c;
  const ball = new THREE.SphereGeometry(1, 7, 5);
  const fur = { vary: 0, noise: 0.03 };
  const blob = (pos, s, rot, col = FUR) => c.put('log', ball, col, pos, rot, s, col === DARK ? { vary: 0, noise: 0 } : fur);
  blob([0, 0.36, -0.22], [0.48, 0.37, 0.5]); // 엉덩이 (깔고 앉음)
  blob([0, 0.78, -0.06], [0.4, 0.55, 0.38], [-0.22, 0, 0]); // 몸통 (위가 앞으로 조금 기욺)
  blob([0, 1.1, 0.1], [0.34, 0.32, 0.33], undefined, FUR2); // 가슴·어깨
  limb(c, 'log', [0, 1.14, 0.12], [0, 1.4, 0.3], 0.23, 0.15, FUR, fur, 7); // 긴 목
  blob([0, 1.47, 0.36], [0.16, 0.15, 0.2]); // 머리
  limb(c, 'log', [0, 1.45, 0.48], [0, 1.41, 0.66], 0.095, 0.06, FUR, fur, 7); // 주둥이
  blob([0, 1.415, 0.665], [0.04, 0.035, 0.035], undefined, DARK); // 코
  for (const s of [-1, 1]) {
    blob([s * 0.075, 1.52, 0.49], [0.024, 0.024, 0.02], undefined, DARK); // 눈
    blob([s * 0.11, 1.6, 0.3], [0.05, 0.045, 0.03]); // 귀
    limb(c, 'log', [s * 0.17, 1.0, 0.2], [s * 0.17, 0.06, 0.34], 0.12, 0.085, FUR, fur, 6); // 곧게 세운 앞다리
    blob([s * 0.17, 0.045, 0.39], [0.1, 0.05, 0.14]); // 앞발
    blob([s * 0.3, 0.27, -0.04], [0.16, 0.24, 0.3], [0.25, 0, 0], FUR2); // 접은 뒷다리 허벅지
    blob([s * 0.31, 0.05, 0.2], [0.11, 0.05, 0.2]); // 앞으로 뻗은 뒷발
  }
  ball.dispose();
  c.pop();
  out.bear.triangles = c.bins.log.slice(n0).reduce((t, g) => t + g.attributes.position.count / 3, 0);
}

function dawnSky(scene) {
  const tex = canvasTex(8, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0, '#182b49'); g.addColorStop(.35, '#354a67');
    g.addColorStop(.47, '#85909c'); g.addColorStop(.50, '#c8a7a9');
    g.addColorStop(.535, '#9eafb9'); g.addColorStop(1, '#8195a5');
    ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(240, 32, 16), new THREE.MeshBasicMaterial({
    map: tex, side: THREE.BackSide, depthWrite: false, fog: false,
  }));
  sky.name = 'frozen-bay-dawn'; scene.add(sky);
}

export function buildFrozenBay(scene, { hemi, sun }) {
  scene.background = new THREE.Color(0x8b9dab);
  scene.fog = new THREE.Fog(0x91a3b1, 62, 205);
  hemi.color.setHex(0xb4cde6); hemi.groundColor.setHex(0x41566b); hemi.intensity = 1.9;
  sun.color.setHex(0xf0c4b7); sun.intensity = .85;
  const sunOffset = { x: 18, y: 5, z: -10 };
  dawnSky(scene);
  const ice = new THREE.Mesh(new THREE.CircleGeometry(205, 80), new THREE.MeshStandardMaterial({
    color: 0xffffff, map: iceTexture(), roughness: .62, metalness: .02,
  }));
  ice.rotation.x = -Math.PI / 2; ice.receiveShadow = true; ice.name = 'frozen-bay-ice'; scene.add(ice);
  iceDetails(scene);
  const shore = buildFrozenBayShore(scene);
  duelGround(scene);
  pierLantern(scene, shore.pierPos);
  const baikal = baikalBackdrop(scene);
  const drift = powder(scene);
  const r = rng(101073); let time = 0, nextIce = 7, nextPier = 19;
  const stage = {
    sunOffset,
    fighterLight: { color: 0xc8dbed, rimColor: 0xe7c8cf, rim: 1.35, level: .55 }, // rim 1.1 → 1.35 (무대 리뷰 10/10: 남색 옷 윤곽)
    stats: { ...shore.stats, ...baikal },
    excite() {}, // Combat impacts must not manufacture thermal ice cracks or booms.
    update(dt) {
      if (!Number.isFinite(dt) || dt <= 0) return;
      time += Math.min(dt, .1);
      drift(Math.min(dt, .1), time);
      if (time >= nextIce) {
        stage.onEvent?.('stageDetail', { kind: 'lakeIceBoom', amp: .85, pos: { x: 40, y: 0, z: -5 }, seed: 10071, time });
        nextIce = time + 31 + r() * 16;
      }
      if (time >= nextPier) {
        stage.onEvent?.('stageDetail', { kind: 'frozenPierCreak', amp: .68, pos: shore.pierPos, seed: 10073, time });
        nextPier = time + 28 + r() * 14;
      }
    },
  };
  return stage;
}
