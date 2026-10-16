// ─────────────────────────────────────────────────────────────
//  화산섬(etna) 땅 — 그림(stage_etna.js)·물리(Rapier 삼각형 그물 충돌체)·발 디딤 높이·발바닥 법선·AI(terrain_navigation.js)가 함께 읽는 한 가지 땅
//   출처: 샛별 저장소 origin/main 7684c732(내용은 53188ff8 '결투장 전체 불규칙 비탈')의 src/etna_ground.js 를 옮겨 고침
//   (docs/import/volcano_port_2026-10-14.md). 코드 id 는 샛별 쪽 그대로 etna, 화면 이름은 '화산섬'(사장님 결정 10/14).
//   · +z 가 내리막. 명목 10° 비탈에 넓은 굴곡(0.085 m)과 짧은 턱(0.022 m)을 섞은 불규칙 산비탈 — 결투장 표본 평균 약 10.3°(2.6~17.7°), 계단·수직 단차 없음
//   · 용암 물가는 ETNA.lavaEdgeZ 의 곧은 선이고 용암면은 그 선의 땅 높이에 수평 — 물가 선에서는 굴곡을 빼 높이를 맞춘다
//   · 같은 삼각형이 그림·충돌·높이·법선을 정한다(삼각형 안은 평면 보간) — 그림만 굴곡을 더한 판이 아니다
//   · 용암 규칙은 '약하게'(사장님 결정 10/14): 화상(다리·팔 기능 감소 · 통증 · 출혈 0)과 그 결과(기존 문턱으로 무릎 꺾임·칼 놓침)만.
//     용암 사망·새 사망 원인·부활 예외·결과 화면 글은 없다
//   지형이 없는 무대(지금의 모든 평지 무대)는 이 파일의 바닥을 쓰지 않는다 — main.js·시뮬 도구의 평평한 상자 바닥 그대로(바이트 같은 길)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { ARENA, ARENA_SCALE, VITALS } from './config.js';

const degrees = 10;
const slope = Math.tan((degrees * Math.PI) / 180);
const lavaEdgeZ = 5.25 * ARENA_SCALE; // 위험 구역의 경기장 내 비율 유지, 평균 경사 10° 유지
export const ETNA = Object.freeze({ slope, degrees, lavaEdgeZ, lavaLevel: -slope * lavaEdgeZ, profile: 'irregular-v3' });
// 넓은 굴곡과 짧은 턱 — 물가 선의 굴곡을 빼서 lavaEdgeZ 에서 높이가 곧게 lavaLevel 이 된다
const fold = (x, z) => 0.085 * Math.sin(1.05 * z + 0.65 * Math.sin(0.6 * x)) + 0.022 * Math.sin(2.4 * z - 0.4 * x);
const vertexHeight = (x, z) => Math.fround(-slope * z + fold(x, z) - fold(x, ETNA.lavaEdgeZ));
// 칸: 결투장·카메라 둘레(|p| < 12 m) 0.5 m · 30 m 까지 1 m · 그 밖 2 m. z 축에는 물가 선을 한 줄 더 넣는다
const axis = [];
for (let p = -56; p <= 56; p += Math.abs(p + 0.01) < 12 ? 0.5 : Math.abs(p + 0.01) < 30 ? 1 : 2) axis.push(p);
const zAxis = [...axis, ETNA.lavaEdgeZ].sort((a, b) => a - b);
const heights = Float32Array.from(zAxis.flatMap((z) => axis.map((x) => vertexHeight(x, z))));
function cell(values, p) {
  let lo = 0;
  let hi = values.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (values[mid] <= p) lo = mid;
    else hi = mid;
  }
  return lo;
}
/** (x, z) 를 덮는 삼각형 면: 높이 y 와 기울기 dx·dz (그물의 칸을 b–c 대각선으로 나눈 두 삼각형 — etnaGroundMesh 와 같은 나눔) */
function facet(x, z) {
  const i = cell(axis, x);
  const j = cell(zAxis, z);
  const dx = axis[i + 1] - axis[i];
  const dz = zAxis[j + 1] - zAxis[j];
  const u = (x - axis[i]) / dx;
  const v = (z - zAxis[j]) / dz;
  const a = j * axis.length + i;
  const ha = heights[a];
  const hb = heights[a + 1];
  const hc = heights[a + axis.length];
  const hd = heights[a + axis.length + 1];
  if (u + v <= 1) return { y: ha + u * (hb - ha) + v * (hc - ha), dx: (hb - ha) / dx, dz: (hc - ha) / dz };
  return { y: hd + (1 - u) * (hc - hd) + (1 - v) * (hb - hd), dx: (hd - hc) / dx, dz: (hd - hb) / dz };
}
/** 이 자리의 땅 높이 (m, 월드) */
export const etnaHeight = (x, z) => facet(x, z).y;
/** 이 자리의 땅 법선 (단위 벡터, 늘 위쪽) — 부를 때마다 새 객체 (받는 쪽이 바로 옮겨 적는다) */
export function etnaNormal(x, z) {
  const f = facet(x, z);
  const length = Math.hypot(f.dx, 1, f.dz);
  return { x: -f.dx / length, y: 1 / length, z: -f.dz / length };
}
/** 그물 꼭짓점·삼각형 (그림은 extent 56, 물리는 30 — 같은 칸이라 겹치는 곳의 삼각형이 같다) */
export function etnaGroundMesh(extent = 30) {
  const xs = axis.filter((x) => Math.abs(x) <= extent);
  const zs = zAxis.filter((z) => Math.abs(z) <= extent);
  const vertices = new Float32Array(xs.length * zs.length * 3);
  const indices = [];
  let i = 0;
  for (const z of zs) {
    for (const x of xs) {
      vertices[i++] = x;
      vertices[i++] = vertexHeight(x, z);
      vertices[i++] = z;
    }
  }
  for (let row = 0; row < zs.length - 1; row++) {
    for (let col = 0; col < xs.length - 1; col++) {
      const a = row * xs.length + col;
      const c = a + xs.length;
      indices.push(a, c, a + 1, a + 1, c, c + 1);
    }
  }
  return { vertices, indices: new Uint32Array(indices) };
}
/** 땅 계약: 싸움꾼(fighter.terrain)·걸음·효과·AI 가 이것 하나만 본다 */
export const ETNA_TERRAIN = Object.freeze({ id: 'etna', heightAt: etnaHeight, normalAt: etnaNormal, ...ETNA });
/** 무대 id → 땅 (지형 없는 무대는 null — 평지 길 그대로) */
export const terrainForStage = (id) => (id === 'etna' ? ETNA_TERRAIN : null);

// 보이지 않는 경계 벽(반지름 + 0.25 m, 32 마디)을 땅 높이를 따라 올린다: 마디 가운데 땅 위로 1.2 m (샛별 판 그대로).
//  우리 판에서 더한 것 — 마디 상자를 땅속으로 WALL_SINK 만큼 더 묻는다: 마디(약 1.4 m) 끝의 땅이 가운데보다 최대 0.22 m 낮아
//  상자 밑에 틈이 생기던 것을 막는다(위 끝은 그대로). 평지 무대의 벽은 main.js 그대로
export const WALL_SINK = 0.3;

/**
 * 지형 무대의 바닥(물리): 삼각형 그물 충돌체(마찰 0.9) + 땅을 따라 올린 경계 벽 + 용암 감지 상자.
 *  main.js newRound · 시뮬 도구(jelly_harness)가 지형이 있을 때만 부른다. 반환 { world, ground, floor, lava, terrain }
 *  floor 는 setSupportFloor 로 알린다(발 체중 받침은 이 그물 접촉만 — 벽에 닿은 발 힘은 받침이 아니다)
 */
export function createTerrainGround(R, world, groups, terrain, { radius = ARENA.radius, walls = true } = {}) {
  const ground = world.createRigidBody(R.RigidBodyDesc.fixed());
  const { vertices, indices } = etnaGroundMesh();
  const floor = world.createCollider(R.ColliderDesc.trimesh(vertices, indices).setFriction(0.9).setCollisionGroups(groups), ground);
  const n = 32;
  const r = radius + 0.25;
  for (let i = 0; i < (walls ? n : 0); i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const half = r * Math.tan(Math.PI / n) + 0.05;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a);
    world.createCollider(
      R.ColliderDesc.cuboid(0.2, 0.6 + WALL_SINK / 2, half)
        .setTranslation(x, terrain.heightAt(x, z) + 0.6 - WALL_SINK / 2, z)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
        .setCollisionGroups(groups),
      ground,
    );
  }
  // 용암은 감지 상자다(윗면 = 보이는 수평 용암면, lavaEdgeZ 부터). 그 밑으로 바위 비탈이 그대로 이어진다
  const lava = world.createCollider(
    R.ColliderDesc.cuboid(30, 5, 30)
      .setTranslation(0, terrain.lavaLevel - 5, terrain.lavaEdgeZ + 30)
      .setSensor(true)
      .setCollisionGroups(groups),
    ground,
  );
  return { world, ground, floor, lava, terrain };
}

// ── 용암 화상 (약하게 — 사장님 결정 10/14 '화상과 그 결과는 샛별대로, 용암 사망은 넣지 않는다') ──
//  게임 피해 모형이지 의학 시간표가 아니다. 보여 주는 것은 기존 통증 붉은 가장자리·다친 다리의 무릎 꿇기/일어서기 그대로 — 새 화면 덮개 없음.
//  값은 모두 샛별 값(확인표 1460~ '사장님 확인 전'). 샛별의 6 s 지속 노출 사망·식음(fatalExposureSeconds·coolingPerSecond)은 옮기지 않았다
export const LAVA_BURN = Object.freeze({
  limbDamagePerSecond: 3, // 닿은 다리·팔 기능 초당 −3 (다리 1 → 약 0.25 s 에 지지 문턱 0.25 아래)
  firstPain: 0.8, // 그 부위가 처음 닿을 때 통증 +0.8
  painPerSecond: 5, // 닿는 동안 통증 초당 +5 (상한은 기존 통증 상한 2)
  woundSeverity: 0.5, // 부위마다 화상 상처 하나: 처음 심각도
  woundGrowthPerSecond: 1, // 닿는 동안 심각도 초당 +1
  woundSeverityMax: 1.5, // 심각도 상한
});
const PAIN_MAX = 2; // fighter.applyWound 의 통증 상한과 같은 값 (새 값 아님)
const LIMB_OF = { footF: 'legF', shinF: 'legF', thighF: 'legF', footB: 'legB', shinB: 'legB', thighB: 'legB', uarmS: 'armS', farmS: 'armS', uarmO: 'armO', farmO: 'armO' };

/**
 * 물리 한 스텝 뒤에 부른다(그림 프레임이 아니라 물리 시간): 용암 감지 상자와 겹친 '붙어 있는 몸 부위'만 덴다.
 *  · 칼·떨어진 조각·잘린 부위는 화상이 없다 (칼은 kind 'weapon', 잘린 부위는 detachedParts, 투구 조각은 colliderInfo 에 없다)
 *  · 피해는 콜라이더가 아니라 팔다리마다 한 번 (한 다리의 여러 마디가 닿아도 겹쳐 세지 않는다) · 양쪽 같은 규칙
 *  · 다리: 기능 감소 → 탄 다리 하나라도 0.25 아래면 기존 무릎 꿇기(knockDown(false)) — fighter.legsCannotSupport
 *  · 칼 든 팔: 기능이 기존 문턱(VITALS.dropSwordArm 0.15) 아래면 칼을 놓친다
 *  · 상처: 부위마다 'burn' 하나(출혈 0 — 피·핏방울·출혈 사망과 무관), 통증은 기존 상한 안
 *  · 벗어나면 새 피해만 멈춘다 — 잃은 기능은 돌아오지 않는다(기존 상처와 같다). 사망은 없다
 *  반환: 이번 스텝에 덴 싸움꾼마다 { fighter, parts, contactTime } (시험 도구가 읽는다)
 */
export function applyTerrainHazards(environment, colliderInfo, dt) {
  if (!environment?.lava || !(dt > 0)) return [];
  const victims = new Map();
  environment.world.intersectionPairsWith(environment.lava, (collider) => {
    const info = colliderInfo.get(collider.handle);
    const f = info?.fighter;
    if (!f?.alive || info.kind === 'weapon' || f.detachedParts?.has(info.part) || f.bodies[info.part]?.handle !== collider.parent()?.handle) return;
    if (!victims.has(f)) victims.set(f, new Set());
    victims.get(f).add(info.part);
  });
  const previous = environment.burning ?? new Set();
  for (const f of previous) {
    if (victims.has(f) || !f.lavaBurn) continue;
    f.lavaBurn.inLava = false;
    previous.delete(f);
  }
  const events = [];
  for (const [f, parts] of victims) {
    previous.add(f);
    const burn = (f.lavaBurn ??= { inLava: false, contactTime: 0, legs: [], wounds: {} });
    burn.inLava = true;
    burn.contactTime += dt;
    const limbs = new Set();
    for (const part of parts) {
      const limb = LIMB_OF[part];
      if (limb) limbs.add(limb);
      if (!burn.wounds[part]) {
        // 부위마다 피 안 나는 화상 상처 하나 — 기존 신음·통증 그림이 반응한다. 피·핏방울은 bleed 0 이라 없다
        const wound = { part, type: 'burn', severity: LAVA_BURN.woundSeverity, bleed: 0, local: new THREE.Vector3() };
        burn.wounds[part] = wound;
        f.wounds.push(wound);
        f.pain = Math.min(PAIN_MAX, f.pain + LAVA_BURN.firstPain);
      }
      burn.wounds[part].severity = Math.min(LAVA_BURN.woundSeverityMax, burn.wounds[part].severity + LAVA_BURN.woundGrowthPerSecond * dt);
    }
    for (const limb of limbs) {
      f.limbs[limb] = Math.max(0, f.limbs[limb] - LAVA_BURN.limbDamagePerSecond * dt);
      if (limb.startsWith('leg') && !burn.legs.includes(limb)) burn.legs.push(limb);
    }
    f.pain = Math.min(PAIN_MAX, f.pain + LAVA_BURN.painPerSecond * dt);
    if (limbs.has('armS') && f.limbs.armS < VITALS.dropSwordArm && f.armed) f.dropSword();
    // 몸을 직접 옮기지 않는다 — 기존 물리 무릎 꿇기/일어서기 전이를 그대로 쓴다
    if (!f.revival && f.legsCannotSupport) f.knockDown(false);
    events.push({ fighter: f, parts: [...parts], contactTime: burn.contactTime });
  }
  environment.burning = previous;
  return events;
}
