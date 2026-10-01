// ─────────────────────────────────────────────────────────────
//  배경 5의 2안: 검은숲 변두리의 화전 터, 봄비 내리는 이른 아침 (브란의 고향) — 같은 컨셉, 다른 세부
//   1안(stage_clearing.js)과 같은 것: 불 놓은 검은 비탈, 봄 이른 아침, 낮은 해와 긴 그림자, 옅은 하늘, 검은 가문비 숲,
//    드문 새싹과 노란 양골담초, 재와 봄비, "희망차지 않은 봄"(변두리 하층민의 살림).
//   다른 것:
//    · 결투 자리: 밭돌 무더기 대신 **탄 통나무를 둥글게 이어 놓았다** (사이사이 틈).
//    · 오두막 대신 **움막**(장대에 나무껍질을 얹고 천을 덮은 한 칸, 앞은 트여 안이 어둡다) · 앞의 **불자리**(돌 두른 잿더미, 삼발이에 걸린 솥) ·
//      **바퀴 빠진 손수레** · 자루와 상자 위에 덮은 거친 천.
//    · 염소 대신 **반쯤 탄 늙은 참나무**가 서 있다 — 한쪽 가지에만 새잎이 났고(브란의 회초리가 나온 나무), 죽은 가지에는 **까마귀** 다섯.
//    · 숯가마 대신 **아직 연기가 나는 불더미**(탄 가지 무더기 속 잉걸불, 낮게 깔리는 연기).
//    · 남동쪽에 **갓 갈아 놓은 이랑** 여덟 줄 — 이미 씨를 뿌렸다.
//    · 트인 쪽(북동)에 **영주의 숲 경계 말뚝**(홈 셋을 판 네모 기둥, 돌무더기) — 화전민은 그 바깥으로 밀려나 있다.
//    · 자작나무는 흩어 심지 않고 남쪽에 **작은 자작 숲**으로 모았다.
//  물리와는 무관한 그림만 만든다. 카메라가 도는 반지름(10.5m) 안에는 낮은 통나무·새싹·웅덩이만 둔다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { ARENA } from './config.js';
import { rng, Kit, box, cyl, limb, pointGlow } from './stage_kit.js';
import { C, morning, slopeY, ashGround, puddles, charStump, fallenLog, spruceForest, birchTree, sproutField, broomBushes, farHills, clearingMeshes, smokeColumn, ashDrift, springRain } from './stage_clearing.js';

const CB = {
  cloth: 0x3b3631, // 거친 천 (젖어 짙다)
  barkSlab: 0x4b3f33,
  field: 0x2f2720, // 갈아 놓은 이랑
  crow: 0x141416,
  ember: 0xff6a1e,
};

/**
 * 화전 터 2안을 만든다. 반환: { update(dt), excite(amount), sunOffset, fighterLight }
 *  lights: main.js 의 { hemi, sun }. opt.rain: 봄비 (기본 켬)
 */
export function buildClearingB(scene, lights = {}, { rain = true } = {}) {
  const r = rng(3307);
  const K = new Kit(881);
  const { FOG, sunOffset } = morning(scene, lights, { rain });
  const groundY = (x, z) => slopeY(x, z, -1); // 1안과 같은 비탈 (동쪽이 높으면 젖은 땅이 해를 향해 번들거려 허옇게 보였다)
  const CAMP = { x: -15, z: 8.5, rot: 0.6 }; // 움막
  const OAK = { x: -12.5, z: -9.5 }; // 반쯤 탄 참나무
  const PYRE = { x: 12.5, z: -12 }; // 불더미
  const FIELD = { x0: 5, x1: 19, z0: 7, z1: 17 }; // 이랑
  const POST = { x: 19, z: -11 }; // 경계 말뚝
  const openAz = -0.75; // 북동쪽이 트였다

  // 땅: 이랑 자리는 갈아 놓은 흙색
  const cField = new THREE.Color(CB.field);
  ashGround(scene, groundY, {
    wet: rain,
    paint: (x, z, tmp) => {
      if (x > FIELD.x0 - 0.5 && x < FIELD.x1 + 0.5 && z > FIELD.z0 - 0.5 && z < FIELD.z1 + 0.5) tmp.lerp(cField, 0.75);
    },
  });

  // ── 결투 자리: 탄 통나무를 둥글게 이어 놓았다 (경기장 경계) ──
  {
    const R0 = ARENA.radius + 0.8;
    const n = 13;
    for (let i = 0; i < n; i++) {
      if (i === 4 || i === 9) continue; // 틈 둘
      const a = (i / n) * Math.PI * 2 + 0.2;
      const len = ((2 * Math.PI * R0) / n) * (0.78 + r() * 0.12);
      fallenLog(K, groundY, Math.cos(a) * R0 + (r() - 0.5) * 0.2, Math.sin(a) * R0 + (r() - 0.5) * 0.2, len, 0.15 + r() * 0.07, a + Math.PI / 2 + (r() - 0.5) * 0.12);
    }
    // 틈에는 말뚝 하나씩
    for (const i of [4, 9]) {
      const a = (i / n) * Math.PI * 2 + 0.2;
      K.put('wood', cyl(0.04, 0.05, 0.6, 5), C.woodDark, [Math.cos(a) * R0, 0.25, Math.sin(a) * R0], [0.1, 0, 0.08], 1, { vary: 0.2 });
    }
  }

  // ── 탄 그루터기 (더 크고 드물게) 와 쓰러진 통나무 ──
  for (let i = 0; i < 40; i++) {
    const a = r() * Math.PI * 2;
    const d = 9.5 + r() * 14;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (Math.hypot(x - CAMP.x, z - CAMP.z) < 6 || Math.hypot(x - OAK.x, z - OAK.z) < 3 || Math.hypot(x - PYRE.x, z - PYRE.z) < 4) continue;
    if (x > FIELD.x0 && x < FIELD.x1 && z > FIELD.z0 && z < FIELD.z1) continue;
    charStump(K, r, groundY, x, z, 0.18 + r() * 0.26, 0.25 + r() * 0.5, r() * 6.3);
  }
  fallenLog(K, groundY, -5, 14.5, 4.6, 0.3, 0.3);
  fallenLog(K, groundY, 14, -3.5, 3.4, 0.22, 1.4, 0);
  fallenLog(K, groundY, -17, -3, 3.8, 0.26, 2.2);

  // ── 서쪽 비탈 아래: 움막과 살림 ──
  {
    K.push([CAMP.x, groundY(CAMP.x, CAMP.z), CAMP.z], CAMP.rot);
    const L = 4.4; // 마룻대 길이 (건물 기준 x)
    const H = 2.3;
    const W = 2.2; // 반폭 (z)
    // 마룻대와 양 끝의 갈라진 받침대
    K.put('wood', cyl(0.07, 0.08, L + 0.6, 6), C.woodGrey, [0, H, 0], [0, 0, Math.PI / 2], 1, { vary: 0.2 });
    for (const sx of [-1, 1]) {
      limb(K, 'wood', [sx * L * 0.5, 0, 0.5], [sx * L * 0.5, H, 0.05], 0.08, 0.06, C.woodGrey, { vary: 0.2 }, 6);
      limb(K, 'wood', [sx * L * 0.5, 0, -0.5], [sx * L * 0.5, H, -0.05], 0.08, 0.06, C.woodGrey, { vary: 0.2 }, 6);
    }
    // 양쪽으로 기대 세운 장대와 그 위의 나무껍질·천 (앞(+z 는 열린 쪽 아님: 앞은 +x 끝) → 삼각 지붕 두 면)
    for (const sz of [-1, 1]) {
      for (let i = 0; i < 9; i++) {
        const x = -L / 2 + (i * L) / 8;
        limb(K, 'wood', [x + (r() - 0.5) * 0.1, 0, sz * W], [x, H + 0.05, sz * 0.05], 0.045, 0.03, C.woodDark, { vary: 0.2 }, 5);
      }
      // 나무껍질 조각 (기울여 얹었다)
      const slope = Math.atan2(H, W);
      for (let i = 0; i < 6; i++) {
        const x = -L / 2 + 0.35 + i * (L / 6);
        const t = 0.25 + (i % 3) * 0.22; // 높이 자리
        K.put('daub', box(L / 6 + 0.05, 0.05, 1.0 + r() * 0.3), CB.barkSlab, [x, H * (1 - t) + 0.08, sz * (W * t)], [sz * slope, 0, (r() - 0.5) * 0.05], 1, { vary: 0.2, noise: 0.15, rough: 0.03 });
      }
      // 거친 천 한 장 (한쪽에만, 아래는 돌로 눌렀다)
      if (sz < 0) {
        K.put('cloth', box(L * 0.6, 0.03, Math.hypot(H, W) * 0.55, 3, 1, 3), CB.cloth, [0.3, H * 0.45 + 0.1, sz * W * 0.55], [sz * slope, 0, 0.02], 1, { vary: 0.1, noise: 0.1, rough: 0.06 });
        for (const x of [-0.8, 0.4, 1.4]) K.put('stone', box(0.3, 0.16, 0.24), C.stone, [x, 0.08, sz * (W + 0.1)], [0, r() * 2, 0], 1, { rough: 0.04, vary: 0.2 });
      }
    }
    // 열린 앞쪽(+x) 안은 어둡다: 삼각 판
    const tri = new THREE.Shape();
    tri.moveTo(-W, 0);
    tri.lineTo(W, 0);
    tri.lineTo(0, H);
    tri.lineTo(-W, 0);
    K.put('dark', new THREE.ShapeGeometry(tri), C.dark, [L / 2 - 0.15, 0.02, 0], [0, Math.PI / 2, 0]);
    K.put('daub', new THREE.ShapeGeometry(tri), CB.barkSlab, [-L / 2 + 0.1, 0.02, 0], [0, -Math.PI / 2, 0], 1, { noise: 0.15 }); // 뒤는 막았다
    // 불자리: 돌 두른 잿더미, 삼발이에 걸린 솥
    const fx = L / 2 + 1.9;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      K.put('stone', box(0.28, 0.18, 0.22), C.stone, [fx + Math.cos(a) * 0.55, 0.08, Math.sin(a) * 0.55], [0, a + r(), 0], 1, { rough: 0.04, vary: 0.2 });
    }
    K.put('char', new THREE.CylinderGeometry(0.45, 0.5, 0.1, 10), C.soot, [fx, 0.04, 0], [0, 0, 0], 1, { noise: 0.2 }); // 젖은 재
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      limb(K, 'wood', [fx + Math.cos(a) * 0.6, 0, Math.sin(a) * 0.6], [fx, 1.35, 0], 0.03, 0.025, C.woodDark, { vary: 0.2 }, 5);
    }
    limb(K, 'iron', [fx, 1.3, 0], [fx, 0.75, 0], 0.01, 0.01, C.iron, {}, 3); // 솥 고리
    K.put('iron', new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65), C.iron, [fx, 0.72, 0], [0, 0, 0], [0.24, 0.2, 0.24], { vary: 0.1 }); // 솥
    K.put('iron', new THREE.TorusGeometry(0.22, 0.015, 4, 12), C.iron, [fx, 0.8, 0], [Math.PI / 2, 0, 0]);
    // 바퀴 빠진 손수레 (한쪽으로 기울어 땅에 닿았다)
    K.push([L / 2 + 0.6, 0, -W - 1.6], 0.5);
    K.put('wood', box(1.7, 0.08, 0.9), C.woodGrey, [0, 0.45, 0], [0, 0, 0.22], 1, { vary: 0.2 }); // 바닥판
    for (const s of [-1, 1]) K.put('wood', box(1.7, 0.3, 0.05), C.woodGrey, [0, 0.62, s * 0.45], [0, 0, 0.22], 1, { vary: 0.2 }); // 옆판
    K.put('wood', cyl(0.05, 0.05, 1.4, 5), C.woodDark, [0, 0.36, 0], [Math.PI / 2, 0, 0.22]); // 축
    // 남은 바퀴 (한쪽): 테와 살
    const wheel = (p, rot) => {
      K.put('wood', new THREE.TorusGeometry(0.42, 0.045, 5, 14), C.woodDark, p, rot, 1, { vary: 0.15 });
      for (let i = 0; i < 4; i++) K.put('wood', box(0.04, 0.8, 0.04), C.woodGrey, p, [rot[0], rot[1], rot[2] + (i * Math.PI) / 4], 1, { vary: 0.2 });
    };
    wheel([0, 0.5, 0.75], [0, 0, 0.22]);
    wheel([0.9, 0.42, -0.95], [0.25, 0.3, 1.25]); // 빠진 바퀴는 옆에 기대 있다
    for (const s of [-1, 1]) K.put('wood', box(1.2, 0.05, 0.05), C.woodGrey, [1.35, 0.35, s * 0.35], [0, 0, 0.3], 1, { vary: 0.2 }); // 끌채
    K.pop();
    // 자루와 상자, 그 위에 덮은 천
    K.put('cloth', new THREE.SphereGeometry(1, 9, 6), 0x6a5a48, [-L / 2 - 0.9, 0.32, 0.8], [0, 0, 0], [0.42, 0.32, 0.4], { vary: 0.1, noise: 0.15, rough: 0.05 }); // 자루
    K.put('cloth', new THREE.SphereGeometry(1, 9, 6), 0x5e5040, [-L / 2 - 1.5, 0.26, 0.4], [0, 0, 0], [0.36, 0.26, 0.34], { vary: 0.1, noise: 0.15, rough: 0.05 });
    K.put('wood', box(0.8, 0.5, 0.55), C.woodDark, [-L / 2 - 1.1, 0.25, -0.6], [0, 0.3, 0], 1, { vary: 0.2 }); // 상자
    K.put('cloth', box(1.9, 0.04, 1.6, 3, 1, 3), CB.cloth, [-L / 2 - 1.2, 0.62, 0.1], [0.06, 0.2, -0.1], 1, { vary: 0.1, rough: 0.08 }); // 덮은 천
    K.pop();
  }

  // ── 반쯤 탄 늙은 참나무: 아래는 숯, 위는 죽어 허옇다. 동쪽 가지 하나에만 새잎, 죽은 가지에 까마귀 ──
  const crowSeats = [];
  {
    const oy = groundY(OAK.x, OAK.z);
    K.push([OAK.x, oy, OAK.z], 0.3);
    limb(K, 'char', [0, -0.3, 0], [0.1, 3.2, 0.05], 0.62, 0.42, C.char, { rough: 0.05, vary: 0.15, noise: 0.15 }, 9); // 탄 밑동
    limb(K, 'wood', [0.1, 3.1, 0.05], [0.3, 7.6, 0.2], 0.42, 0.14, C.woodGrey, { rough: 0.04, vary: 0.12, noise: 0.12 }, 9); // 죽은 윗둥
    for (let k = 0; k < 4; k++) {
      const a = k * 1.7 + 0.4;
      limb(K, 'char', [Math.cos(a) * 0.5, 0.1, Math.sin(a) * 0.5], [Math.cos(a) * 1.6, -0.1, Math.sin(a) * 1.6], 0.28, 0.08, C.char, { vary: 0.2 }, 5); // 뿌리
    }
    const branches = [
      // [시작 높이, 방향, 길이, 살았나]
      [3.4, 0.1, 3.2, 1],
      [4.6, 0.7, 2.6, 1],
      [4.2, 2.6, 3.0, 0],
      [5.5, 3.6, 2.4, 0],
      [6.4, 4.9, 2.0, 0],
      [7.0, 1.9, 1.6, 0],
    ];
    const perches = [];
    for (const [h0, a, len, alive] of branches) {
      const p0 = [0.15, h0, 0.1];
      const p1 = [p0[0] + Math.cos(a) * len, h0 + len * 0.45, p0[2] + Math.sin(a) * len];
      limb(K, alive ? 'wood' : 'wood', p0, p1, 0.14, 0.05, alive ? C.wood : C.woodGrey, { vary: 0.15, noise: 0.1 }, 6);
      const p2 = [p1[0] + Math.cos(a + 0.6) * len * 0.5, p1[1] + len * 0.3, p1[2] + Math.sin(a + 0.6) * len * 0.5];
      limb(K, 'wood', p1, p2, 0.05, 0.015, alive ? C.wood : C.woodGrey, { vary: 0.15 }, 5);
      if (alive) {
        for (let k = 0; k < 5; k++) {
          const t = 0.5 + k * 0.12;
          const q = [p1[0] + (p2[0] - p1[0]) * t + (r() - 0.5) * 0.5, p1[1] + (p2[1] - p1[1]) * t + r() * 0.4, p1[2] + (p2[2] - p1[2]) * t + (r() - 0.5) * 0.5];
          K.put('sproutLeaf', new THREE.IcosahedronGeometry(1, 0), C.sprout, q, [0, r() * 3, 0], [0.3 + r() * 0.2, 0.15 + r() * 0.08, 0.3 + r() * 0.2], { vary: 0.2, noise: 0.15 });
        }
      } else perches.push([p1, a]);
    }
    // 까마귀 자리: 죽은 가지 끝마다 한둘 (세계 좌표로 바꿔 둔다 — 까마귀는 합치지 않고 따로 만들어 날아오르게 한다)
    const toWorld = ([x, y, z]) => [OAK.x + Math.cos(0.3) * x + Math.sin(0.3) * z, oy + y, OAK.z - Math.sin(0.3) * x + Math.cos(0.3) * z];
    perches.forEach(([p, a], i) => {
      crowSeats.push({ pos: toWorld(p), face: a + Math.PI + (i % 2 ? 0.6 : -0.4) + 0.3 });
      if (i < 2) crowSeats.push({ pos: toWorld([p[0] - Math.cos(a) * 0.7, p[1] - 0.32, p[2] - Math.sin(a) * 0.7]), face: a + 0.3 + 0.3 });
    });
    K.pop();
  }

  // ── 까마귀 (합치지 않고 따로): 가지에 앉아 있다가 큰 타격이 나오면 놀라 날아올라 참나무 둘레를 한 바퀴 돌고 돌아온다.
  //    날아오를 때 onEvent('crows') 로 알린다 (소리 PM: 날갯짓·까악, 4초에 한 번 이하) ──
  const crows = [];
  {
    const crowMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
    crowSeats.forEach((seat, i) => {
      const ck = new Kit(700 + i);
      const o = { vary: 0.05, noise: 0.04 };
      ck.put('c', new THREE.SphereGeometry(1, 8, 6), CB.crow, [0, 0.1, 0], [0, 0, 0.25], [0.15, 0.09, 0.09], o); // 몸통
      ck.put('c', new THREE.SphereGeometry(1, 7, 5), CB.crow, [0.13, 0.19, 0], [0, 0, 0], [0.06, 0.055, 0.055], o); // 머리
      ck.put('c', new THREE.ConeGeometry(0.018, 0.07, 4), 0x3a3230, [0.2, 0.185, 0], [0, 0, -Math.PI / 2], 1, o); // 부리
      ck.put('c', box(0.14, 0.02, 0.06), CB.crow, [-0.17, 0.09, 0], [0, 0, 0.35], 1, o); // 꼬리
      const g = new THREE.Group();
      g.add(ck.mesh('c', crowMat));
      // 날개 둘: 어깨에 붙은 납작한 판. 앉아 있을 때는 몸에 붙여 접고, 날 때는 펴서 퍼덕인다
      const wings = [];
      for (const s of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.2).translate(0, 0, s * 0.1), crowMat.clone());
        w.material.vertexColors = false;
        w.material.color.set(CB.crow);
        w.position.set(0.02, 0.14, s * 0.04);
        w.rotation.z = -0.25;
        w.scale.set(1, 1, 0.35); // 접힌 날개
        g.add(w);
        wings.push(w);
      }
      g.position.set(...seat.pos);
      g.position.y += 0.02;
      g.rotation.y = seat.face;
      scene.add(g);
      crows.push({ g, wings, home: new THREE.Vector3(...seat.pos).add(new THREE.Vector3(0, 0.02, 0)), face: seat.face, R: 2.6 + i * 0.45, H: 4.5 + (i % 3) * 0.9, dir: i % 2 ? 1 : -1, ph: i * 1.1, T: 5.2 + (i % 3) * 0.6 });
    });
  }
  const oakTop = new THREE.Vector3(OAK.x, groundY(OAK.x, OAK.z) + 6.5, OAK.z);
  let crowT = -1; // 날아오른 뒤 흐른 시간 (−1 이면 앉아 있다)
  let crowCool = 0; // 다시 날아오를 수 있을 때까지
  const _cp = new THREE.Vector3();
  const _cv = new THREE.Vector3();
  const crowPath = (c, tau, out) => {
    // 참나무 꼭대기 둘레를 한 바퀴: 처음 0.9초 동안 자리에서 떠오르고, 마지막 1.1초 동안 자리로 내려앉는다
    const k = tau / c.T;
    const th = c.ph + c.dir * (Math.PI * 2 * k + 0.6 * Math.sin(k * 6.3));
    _cp.set(oakTop.x + Math.cos(th) * c.R, oakTop.y + c.H * (0.55 + 0.45 * Math.sin(k * Math.PI)) - 4.5, oakTop.z + Math.sin(th) * c.R);
    const s = THREE.MathUtils.smoothstep(tau, 0, 0.9) * (1 - THREE.MathUtils.smoothstep(tau, c.T - 1.1, c.T));
    out.copy(c.home).lerp(_cp, s);
    return s;
  };
  const stepCrows = (dt) => {
    crowCool = Math.max(0, crowCool - dt);
    if (crowT < 0) return;
    crowT += dt;
    let anyFlying = false;
    for (const c of crows) {
      const tau = crowT - c.ph * 0.12; // 저마다 조금씩 늦게 뜬다
      if (tau < 0) continue;
      if (tau >= c.T) {
        c.g.position.copy(c.home);
        c.g.rotation.set(0, c.face, 0);
        for (const w of c.wings) {
          w.rotation.z = -0.25;
          w.scale.z = 0.35;
        }
        continue;
      }
      anyFlying = true;
      const s = crowPath(c, tau, c.g.position);
      crowPath(c, tau + 0.05, _cv);
      _cv.sub(c.g.position);
      if (_cv.lengthSq() > 1e-6) c.g.rotation.set(0, Math.atan2(-_cv.z, _cv.x), 0);
      const flap = Math.sin(crowT * 16 + c.ph * 3) * 0.85 * s;
      c.wings[0].rotation.z = -0.25 * (1 - s) + flap;
      c.wings[1].rotation.z = -0.25 * (1 - s) - flap;
      for (const w of c.wings) w.scale.z = 0.35 + 0.65 * s;
    }
    if (!anyFlying && crowT > 1) crowT = -1;
  };

  // ── 불더미: 탄 가지 무더기 속에 아직 잉걸불이 남았다. 낮게 깔리는 연기 ──
  const glowPts = [{ x: PYRE.x, y: 0.5, z: PYRE.z, r: 5.5, c: [0.9, 0.35, 0.08] }];
  {
    const py = groundY(PYRE.x, PYRE.z);
    K.push([PYRE.x, py, PYRE.z], 0);
    for (let i = 0; i < 16; i++) {
      const a = r() * Math.PI * 2;
      const d = r() * 1.3;
      const len = 1.2 + r() * 1.6;
      const y0 = r() * 0.7;
      const b = a + (r() - 0.5) * 2.5;
      limb(K, 'char', [Math.cos(a) * d, y0, Math.sin(a) * d], [Math.cos(a) * d + Math.cos(b) * len, y0 + (r() - 0.3) * 0.6, Math.sin(a) * d + Math.sin(b) * len], 0.06 + r() * 0.06, 0.03, C.char, { vary: 0.25, noise: 0.15 }, 5);
    }
    K.put('char', new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), C.soot, [0, -0.05, 0], [0, 0, 0], [1.9, 0.55, 1.9], { rough: 0.08, noise: 0.2 }); // 잿더미
    for (let i = 0; i < 14; i++) {
      const a = r() * Math.PI * 2;
      const d = r() * 1.1;
      K.put('embers', box(0.06 + r() * 0.08, 0.04, 0.05 + r() * 0.06), CB.ember, [Math.cos(a) * d, 0.35 + r() * 0.35, Math.sin(a) * d], [0, r() * 3, 0], 1, { vary: 0.4, noise: 0.3 }); // 잉걸불
    }
    K.pop();
  }

  // ── 남동쪽: 갓 갈아 놓은 이랑 여덟 줄 (이미 씨를 뿌렸다) ──
  {
    const rows = 8;
    for (let k = 0; k < rows; k++) {
      const z = FIELD.z0 + 0.6 + (k * (FIELD.z1 - FIELD.z0 - 1.2)) / (rows - 1);
      const x0 = FIELD.x0 + 0.5 + (r() - 0.5) * 0.6;
      const x1 = FIELD.x1 - 0.5 + (r() - 0.5) * 0.6;
      const cx = (x0 + x1) / 2;
      K.put('daub', cyl(0.2, 0.2, x1 - x0, 7), CB.field, [cx, groundY(cx, z) + 0.02, z], [0, (r() - 0.5) * 0.03, Math.PI / 2], 1, { rough: 0.09, vary: 0.12, noise: 0.2 }); // 둥근 두둑
    }
    // 밭 귀퉁이에 세운 나뭇가지 표식과 바구니
    K.put('wood', cyl(0.03, 0.04, 1.4, 5), C.woodDark, [FIELD.x0 + 0.3, groundY(FIELD.x0, FIELD.z0) + 0.7, FIELD.z0 + 0.2], [0.08, 0, 0.1]);
    K.put('cloth', box(0.25, 0.25, 0.05), 0x8a6a3a, [FIELD.x0 + 0.3, groundY(FIELD.x0, FIELD.z0) + 1.2, FIELD.z0 + 0.2], [0, 0.2, 0], 1, { vary: 0.15 }); // 헝겊 조각
    K.put('wood', cyl(0.28, 0.2, 0.32, 9, true), C.wood, [FIELD.x0 - 0.6, groundY(FIELD.x0, FIELD.z1) + 0.16, FIELD.z1 - 0.4], [0, 0, 0], 1, { vary: 0.2 }); // 씨앗 바구니
  }

  // ── 북동쪽 트인 쪽: 영주의 숲 경계 말뚝 (홈 셋, 돌무더기) ──
  {
    const py = groundY(POST.x, POST.z);
    K.push([POST.x, py, POST.z], 0.4);
    K.put('wood', box(0.26, 2.5, 0.26, 1, 3, 1), C.woodDark, [0, 1.2, 0], [0.02, 0, -0.03], 1, { vary: 0.15, noise: 0.1 });
    K.put('wood', new THREE.ConeGeometry(0.19, 0.3, 4), C.woodDark, [0, 2.6, 0], [0, Math.PI / 4, 0], 1, { vary: 0.15 }); // 뾰족 머리
    for (let k = 0; k < 3; k++) K.put('dark', box(0.28, 0.06, 0.04), C.dark, [0, 1.7 + k * 0.22, 0.12]); // 홈 셋
    for (let i = 0; i < 7; i++) {
      const a = r() * Math.PI * 2;
      const d = 0.25 + r() * 0.35;
      K.put('stone', box(0.2 + r() * 0.2, 0.14 + r() * 0.1, 0.2 + r() * 0.15), C.stone, [Math.cos(a) * d, 0.08 + (i > 4 ? 0.14 : 0), Math.sin(a) * d], [0, r() * 3, 0], 1, { rough: 0.04, vary: 0.2 });
    }
    K.pop();
    // 말뚝에서 숲으로 이어지는 낮은 돌 줄 (경계)
    for (let i = 1; i < 9; i++) {
      const x = POST.x + i * 0.9;
      const z = POST.z - i * 1.1;
      K.put('stone', box(0.3, 0.16, 0.25), C.stone, [x, groundY(x, z) + 0.06, z], [0, r() * 3, 0], 1, { rough: 0.04, vary: 0.2 });
    }
  }

  // ── 양골담초 (다른 자리에 두 무더기) ──
  broomBushes(scene, K, r, groundY, [
    [-17, -3, 6],
    [8, 18.5, 4],
  ]);

  // ── 둘레의 숲: 가문비, 남쪽의 작은 자작 숲 ──
  spruceForest(scene, groundY, FOG, { openAz, avoid: [{ x: CAMP.x, z: CAMP.z, r: 6.5 }, { x: PYRE.x, z: PYRE.z, r: 5 }, { x: -6, z: -19, r: 5 }], seed: 43 });
  for (const [x, z, h, lean] of [
    [-6, -18.5, 6.5, 0.05],
    [-8.2, -19.6, 5.2, -0.06],
    [-4.1, -20.4, 7.2, 0.03],
    [-6.8, -21.5, 5.8, 0.08],
    [-3, -18, 4.6, -0.04],
    [-9.5, -17.4, 6.0, 0.02],
  ])
    birchTree(K, r, groundY, x, z, h, lean);

  sproutField(scene, groundY, {
    N: 1700,
    seed: 68,
    avoid: [
      { x: CAMP.x, z: CAMP.z, r: 5 },
      { x: PYRE.x, z: PYRE.z, r: 3.5 },
      { x: (FIELD.x0 + FIELD.x1) / 2, z: (FIELD.z0 + FIELD.z1) / 2, r: 7.5 },
    ],
  });
  farHills(scene, FOG, [
    { R: 150, base: 16, amp: 22, top: 0x6b7876, seed: 5 },
    { R: 240, base: 30, amp: 40, top: 0x8c989a, seed: 6 },
  ]);
  clearingMeshes(scene, K, pointGlow(glowPts)); // 잉걸불의 붉은 빛을 둘레(불더미·그루터기)에 구워 넣는다

  if (rain)
    puddles(scene, groundY, [
      [-2.8, 2.6, 1.5, 0.9, 0.9],
      [3.6, -3.2, 1.0, 0.7, 0.2],
      [1.5, 5.2, 0.9, 0.5, 1.4],
      [-9, -3, 2.0, 1.2, 0.5],
      [-12, 12.5, 1.4, 0.9, 1.9],
      [10, 3, 1.1, 0.7, 0.3],
      [-4, -12, 1.6, 0.9, 1.1],
      [15.5, -5.5, 1.2, 0.7, 0.8],
    ]);

  const steps = [smokeColumn(scene, { x: PYRE.x, y: groundY(PYRE.x, PYRE.z) + 0.7, z: PYRE.z }, { n: 260, seed: 14, rise: 5, low: true }), ashDrift(scene, { seed: 79 })];
  if (rain) steps.push(springRain(scene, { seed: 57 }));

  let t = 0;
  let gust = 0;
  const stepAll = (dt) => {
    for (const s of steps) s(dt, t, gust);
  };
  stepAll(0);

  const api = {
    sunOffset,
    onEvent: null, // main.js 가 채운다: (name, data) => … (소리)
    fighterLight: { color: 0xffe2b8, rimColor: 0xd9e2e8, rim: 1.4, level: 0.9 },
    /** 큰 타격: 재가 휘날리고 연기가 눕는다 (비도 휘몰아친다). 꽤 큰 타격이면 까마귀들이 놀라 날아오른다 (6초에 한 번 이하) */
    excite(amount) {
      gust = Math.min(1, gust + amount * 0.5);
      if (amount >= 0.3 && crowT < 0 && crowCool <= 0) {
        crowT = 0;
        crowCool = 6;
        api.onEvent?.('crows', { amp: Math.min(1, amount * 1.5), pos: { x: oakTop.x, y: oakTop.y, z: oakTop.z } });
      }
    },
    update(dt) {
      t += dt;
      gust = Math.max(0, gust - dt * 0.4);
      stepAll(dt);
      stepCrows(dt);
    },
  };
  return api;
}
