// jelly_harness: deterministic Node replica of main.js newRound()+step loop (no rendering).
// NOTE: newRound() only puts an AI on `enemy` by default — `player` sits still (no input) unless
// you pass opts.AI2Class (usually AI, imported from here). AI-vs-AI scripts that forget this end up
// benchmarking "AI vs. a passive dummy holding a sword", not a real fight (bit us once — weapon_balance.mjs).
import RAPIER from '../../node_modules/@dimforge/rapier3d-compat/rapier.mjs';
import * as THREE from '../../node_modules/three/build/three.module.js';
import * as CONFIG from '../../src/config.js';
import { Fighter, GROUND_GROUPS } from '../../src/fighter.js';
import { LOOKS } from '../../src/looks.js';
import { AI } from '../../src/ai.js';
import { Combat } from '../../src/combat.js';

await RAPIER.init();
export { RAPIER, THREE, CONFIG, AI };
// 마무리 스위치 (10/12, src 기본은 둘 다 끔 — docs/import/saetbyeol_round2_2026-10-12.md): 어느 시뮬 도구든 환경 변수로 켠다
//  FINISH_ENTRY=low = 낮은 상대 진입 (downlow = 고친 판) ·FINISH_MODE=power25 = 즉사 대신 판정 에너지 × FINISH.power (FINISH_POWER=수 로 배율 바꿈)
{
  const { FINISH } = await import('../../src/finish.js');
  if (['down', 'low', 'downlow', 'auto'].includes(process.env.FINISH_ENTRY)) FINISH.entry = process.env.FINISH_ENTRY;
  // 10/12 약한 자세 겨눔 묶음: VITAL=0 = 끔 (진입 auto → down) · PLATE_NECK=1 = 판금 상대 찍기 목 겨눔 (10/1 C)
  if (['0', '1'].includes(process.env.VITAL)) FINISH.vital = process.env.VITAL === '1';
  if (['0', '1'].includes(process.env.PLATE_NECK)) FINISH.plateNeck = process.env.PLATE_NECK === '1';
  {
    const { VITAL } = await import('../../src/vital_target.js'); // 묶음 갈래: VITAL_AI=0|1 · VITAL_THRUST=0|1 · VITAL_PCUT=0|1
    for (const [e, k] of [['VITAL_AI', 'aiCut'], ['VITAL_THRUST', 'thrust'], ['VITAL_PCUT', 'playerCut']]) if (['0', '1'].includes(process.env[e])) VITAL[k] = process.env[e] === '1';
  }
  if (['power25', 'kill'].includes(process.env.FINISH_MODE)) FINISH.mode = process.env.FINISH_MODE; // 10/12 기본 power25 · kill = 전 즉사
  if (process.env.FINISH_POWER) FINISH.power = +process.env.FINISH_POWER;
  // 10/13 내려찍기 동작 (docs/strike/finish_plunge_2026-10-13.md): FINISH_LIFT=0 = 전 동작 · FINISH_AIM=chest|torso · 쓸기용 FINISH_LIFT_HANDS=x,y,z · FINISH_ARM=수 · FINISH_WRIST=수 · FINISH_CHEST_S=수
  if (['0', '1'].includes(process.env.FINISH_LIFT)) FINISH.lift = process.env.FINISH_LIFT === '1';
  if (['chest', 'torso'].includes(process.env.FINISH_AIM)) FINISH.aim = process.env.FINISH_AIM;
  if (process.env.FINISH_LIFT_HANDS) FINISH.liftHands = process.env.FINISH_LIFT_HANDS.split(',').map(Number);
  if (process.env.FINISH_ARM) FINISH.strikeArm = +process.env.FINISH_ARM;
  if (process.env.FINISH_WRIST) FINISH.strikeWrist = +process.env.FINISH_WRIST;
  if (process.env.FINISH_CHEST_S) FINISH.chestS = +process.env.FINISH_CHEST_S;
}
// 이탈리아 박자 걸음 셈 (10/15 — src/schools.js setItalianRhythm, docs/strike/italian_rhythm_2026-10-15.md §8 · §9): IT_RHYTHM=2+2(기본 · ×1.3) · 4+2 · 3+2 · 3(옛 짝 셈 3 + 1 — 지난 판 비교, 그때 ×1.5) · 0(끔). 안 주면 src 기본 그대로
if (process.env.IT_RHYTHM != null) {
  const { setItalianRhythm } = await import('../../src/schools.js');
  if (!setItalianRhythm(process.env.IT_RHYTHM)) throw new Error(`IT_RHYTHM=${process.env.IT_RHYTHM} 을 읽지 못함`);
}
const { PHYSICS, ARENA } = CONFIG;
export const DT = PHYSICS.timestep;

// 결정적 난수 (같은 seed → 같은 판). Math.random 을 바꿔치기한다
export function seedRandom(seed) {
  let a = seed >>> 0;
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newRound(opts = {}) {
  if (opts.seed != null) seedRandom(opts.seed);
  const world = new RAPIER.World({ x: 0, y: PHYSICS.gravity, z: 0 });
  world.timestep = PHYSICS.timestep;
  world.integrationParameters.numSolverIterations = opts.iters ?? 6;
  const eventQueue = new RAPIER.EventQueue(true);
  const colliderInfo = new Map();
  const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.5, 30).setTranslation(0, -0.5, 0).setFriction(0.9).setCollisionGroups(GROUND_GROUPS), ground);
  const n = 32;
  const R = ARENA.radius + 0.25;
  for (let i = 0; i < (opts.walls === false ? 0 : n); i++) {
    const a = (i / n) * Math.PI * 2;
    const half = R * Math.tan(Math.PI / n) + 0.05;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a);
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.2, 0.6, half).setTranslation(Math.cos(a) * R, 0.6, Math.sin(a) * R).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }).setCollisionGroups(GROUND_GROUPS),
      ground,
    );
  }
  const scene = new THREE.Scene();
  const gap = opts.gap ?? ARENA.startGap;
  // look/look2 = 플레이어·상대 자리 겉모습 (캐릭터 look 을 주면 투구·판금이 판정에 들어간다, config.js ARMOR). 생략하면 예전 그대로
  //  breakSeed(판 시드)는 무기 파손 굴림과 방어구 연출 전용 난수의 씨앗 (fighter.js — 한 프로세스에서 판을 어떤 순서로 돌려도 같은 판은 같게)
  const player = new Fighter(RAPIER, world, scene, colliderInfo, { index: 0, name: 'P', x: -gap / 2, heading: 0, look: opts.look ?? LOOKS.player, weapon: opts.weapon, breakSeed: opts.seed, revive: opts.revive2 });
  const enemy = new Fighter(RAPIER, world, scene, colliderInfo, { index: 1, name: 'E', x: gap / 2, heading: Math.PI, look: opts.look2 ?? (opts.sameLook ? LOOKS.player : LOOKS.enemy), weapon: opts.weapon2 ?? opts.weapon, breakSeed: opts.seed, revive: opts.revive });
  // 부활(캐릭터 시트 revive, src/revive.js): persona 와 같은 짝 — opts.revive = enemy(AI 쪽 캐릭터), opts.revive2 = player
  if (opts.onFighter) { opts.onFighter(player, world, RAPIER); opts.onFighter(enemy, world, RAPIER); }
  const AIC = opts.AIClass || AI;
  const ai = new AIC(enemy, player, opts.difficulty ?? 'normal', opts.persona ?? null);
  player.skill.level = opts.skill ?? 0.7;
  const hits = [];
  const combat = new Combat(colliderInfo, { onWound: (att, vic, r) => { hits.push(`${att.name}->${r.zone}:${r.type} ${r.energy.toFixed(0)}J`); G.wounds.push({ t: G.t, att, vic, zone: r.zone, type: r.type, energy: r.energy, severity: r.severity }); G.onWound?.(att, vic, r); }, onClash: () => { G && G.clashes++; } });
  const G = { world, eventQueue, player, enemy, ai, combat, hits, t: 0, ai2: null, parkEnemy: false, clashes: 0, wounds: [] };
  if (opts.AI2Class) G.ai2 = new opts.AI2Class(player, enemy, opts.difficulty2 ?? opts.difficulty ?? 'normal', opts.persona2 ?? null);
  G.step = () => {
    player.foe = G.parkEnemy ? null : enemy;
    enemy.foe = G.parkEnemy ? null : player;
    player.faceTarget = G.faceP || enemy.bodies.pelvis.translation();
    enemy.faceTarget = player.bodies.pelvis.translation();
    if (!G.parkEnemy) ai.update(DT);
    else enemy.move.set(0, 0);
    if (G.ai2) G.ai2.update(DT);
    if (G.before) G.before(G.t);
    player.step(DT);
    enemy.step(DT);
    player.cacheState();
    enemy.cacheState();
    world.step(eventQueue, combat.physicsHooks);
    combat.afterStep(world, eventQueue);
    G.t += DT;
  };
  G.park = () => {
    // move enemy far away (so player acts alone)
    for (const { rb } of enemy.meshes) {
      const t = rb.translation();
      rb.setTranslation({ x: t.x + 40, y: t.y, z: t.z + 40 }, true);
    }
    enemy.anchor.setTranslation({ x: enemy.anchor.translation().x + 40, y: enemy.anchor.translation().y, z: enemy.anchor.translation().z + 40 }, true);
    G.parkEnemy = true;
    G.faceP = { x: 100, y: 1, z: 0 };
  };
  return G;
}

// helpers
export const V = (v) => new THREE.Vector3(v.x, v.y, v.z);
export const Q = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);
/** wrist (hand) world position = farmS local (0.13,0,0) */
export function handPos(f) {
  const b = f.bodies.farmS;
  return new THREE.Vector3(0.13, 0, 0).applyQuaternion(Q(b.rotation())).add(V(b.translation()));
}
/** express world point in fighter's yaw frame relative to chest (x fwd, y up, z right) */
export function toBody(f, p, origin) {
  const o = origin || V(f.bodies.chest.translation());
  return p.clone().sub(o).applyQuaternion(f.yaw.clone().invert());
}
export const rms = (a) => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / Math.max(1, a.length));
export const mean = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
export const p2p = (a) => Math.max(...a) - Math.min(...a);
export const f3 = (x) => +x.toFixed(3);
export const f2 = (x) => +x.toFixed(2);
export const f1 = (x) => +x.toFixed(1);
