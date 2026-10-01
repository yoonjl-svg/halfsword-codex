// 근접 밀치기 점검 (설계 docs/strike/shove_design_2026-09-30.md "측정 도구", 값은 모두 사장님 확인 전)
//  읽기만 한다: config CLOSE(on·reach) · 싸움꾼 canShove·stickX/Y·closeArmed·barge·bargeEnd·shoves·lift·closeW·armFull·handTarget
//   · skill.swinging · gait.req/requestStep/touchdown · AI closeWant·closeBind·why. 없는 필드는 n/a (반쯤 된 src 도 돈다)
//  시험 플레이어는 진짜 규칙을 거친다: canShove = true, move(감정 배수)·stickX/Y(원값) 를 main.js frame() 의 input.move 줄처럼 쓴다
//   (8b4c70e 기준 main.js:1363-1365, 구현 뒤 stickX/Y 두 줄이 붙는다). 칸마다 같은 대본을 CLOSE.on=false 로도 돌려 대조군으로 쓴다
//  상대: 꼭두각시(버팀 = 발 0, 물러남 = 계속 뒤로) · 기본 AI · 인물 AI. 벽 칸만 벽 32개(main.js:352), 나머지는 벽 없음
// 실행 (저장소 뿌리에서, 무거우니 nice -n 10 으로 하나씩):
//   node tools/sim/shove_check.mjs              핵심 칸(시작 5 × 상대 2 × 무기 3) + 덧칸(판금·지붕·둘 다 밂·빈손), 칸마다 N=10
//   node tools/sim/shove_check.mjs --quick      N=3 (다른 플래그와 함께 써도 된다)
//   node tools/sim/shove_check.mjs --neg        음성 칸: 발사가 모두 0번이어야 한다 (감정 배수 칸은 발사 스텝이 1.0 과 같아야)
//   node tools/sim/shove_check.mjs --control    우회 관문: 한 프로세스에서 CLOSE.on false/true, 아무도 안 밂 → 스텝마다 흔적이 같아야
//                                                (Math.random 호출 수·값, 골반·가슴 위치, addForce·applyImpulse 류·requestStep 호출 해시)
//   node tools/sim/shove_check.mjs --persona    0절 기준표: persona.close 캐릭터 대 기본 AI(30 s)·걸어 들어오는 꼭두각시(15 s), CLOSE.on false/true 전후
//   --json 칸마다 JSON 한 줄만(머리말·표는 stderr) · --n=K 칸 판 수 · --pn=K 인물 판 수 · --today 기능 없는 사본에서도 칸을 돈다(오늘 값)
//   --debug=칸이름 (예 glued/braced/longsword) 그 칸 판마다 0.1 s 간격 d·단계 흐름을 찍는다
//  src 에 CLOSE 가 없으면(기준 사본) 'feature absent' 를 찍고 --control·--persona 만 돈다 (전 숫자). 기본 전체 ≈ 15분 안
import { RAPIER, THREE, CONFIG, AI, DT, seedRandom } from './harness_m.mjs';
import { Fighter, GROUND_GROUPS } from '../../src/fighter.js';
import { LOOKS, getLook } from '../../src/looks.js';
import { Combat } from '../../src/combat.js';
import { CHARACTERS, CHARACTER_VARIANTS } from '../../src/characters.js';
import { MEASURED } from '../../src/ai.js';
import { schoolOf } from '../../src/schools.js';
import { getWeapon } from '../../src/weapons.js';
import { createHash } from 'node:crypto';

const { PHYSICS, ARENA, SKILL } = CONFIG;
const CLOSE = CONFIG.CLOSE ?? null; // 기준 사본엔 없다
const HAS = !!(CLOSE && typeof CLOSE.reach === 'function');
const ON0 = HAS ? CLOSE.on : null; // 기본값 (끝나면 되돌린다)

const argv = process.argv.slice(2);
const flag = (k) => argv.includes(k);
const num = (k, d) => {
  const a = argv.find((x) => x.startsWith(k + '='));
  return a ? +a.slice(k.length + 1) : d;
};
const JSON_ONLY = flag('--json');
const DEBUG = (argv.find((x) => x.startsWith('--debug=')) || '').slice(8) || null; // --debug=칸이름: 그 칸 판마다 d·단계 흐름
const QUICK = flag('--quick');
const TODAY = flag('--today');
const N = num('--n', QUICK ? 3 : 10);
const PN = num('--pn', QUICK ? 2 : 4);
const NC = Math.min(3, N); // 칸마다 대조군(끔) 판 수: 손 목표 튐 기준·오늘 밀린 거리
const SEEDS = Array.from({ length: N }, (_, i) => i + 1);
const PSEEDS = Array.from({ length: PN }, (_, i) => i + 1);
let modes = ['neg', 'persona', 'control'].filter((m) => flag('--' + m)); // control 은 끝에 (힘 호출을 세느라 느려진다)
if (!modes.length || flag('--core')) modes.unshift('core');
const say = JSON_ONLY ? (s) => process.stderr.write(s + '\n') : (s) => console.log(s);
const line = (o) => console.log(JSON.stringify(o));

// ── 시험 입력 (게임 값 아님: 시험하는 엄지·장면의 숫자) ──
const PFLUG = SKILL.homeGuard; // 쟁기(기본 자세) 패드
const ROOF = [0.02, 0.52]; // 지붕(Vom Tag) 패드 (guards.js): 칼자루가 머리 가까이
const WECHSEL = [0.38, -0.44]; // 베기 끝 자세 (guards.js 바꿈)
const ALBER = [0.0, -0.5]; // 칼끝을 땅으로 (guards.js 바보)
const REL_S = 0.1; // 안에서 스틱을 놓는 시간 (엄지 한 번)
const GLUE_D = 0.6; // 붙음: 가슴 거리 이 안 + GLUE_HOLD 동안 서로 밂 (probe glued.mjs 와 같다)
const GLUE_HOLD = 0.5;
const APPROACH_MAX = 4; // 시작 조건을 못 채우면 그대로 진행 (startOk false 로 적는다)
const PRESS_MAX = 2.0; // 밀치기가 안 끝나면 이 시간 뒤 스틱을 놓는다 (엄지)
const CTRL_PRESS = 1.0; // 발사가 없을 때(대조군 포함) 스틱을 미는 시간
const WIN = 3.0; // 발사(없으면 밂 시작) 뒤 관찰 시간
const WALL_X = 6.1; // 벽 칸: 등진 사람 골반 x (벽 안쪽 면 ARENA.radius + 0.25 − 0.2 = 6.55)
const CUT_SPEED = 5; // 베면서 밂 칸: 손 패드 속도 m/s (SKILL.swingSpeed 1.5 보다 빠르게)
const PT = [0.5, 1, 2]; // 밀린 거리 재는 때 (발사 뒤 s)
// 판마다 장면 흔들기 (꼭두각시 장면은 시드가 거의 안 바꾼다): 시작 간격 ±0.05 m, 두 사람 손 패드 ±0.03. 시드에서 정해지고 대조군도 같다
const jit = (seed, k) => {
  const x = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x) - 0.5;
};

// ── 흔적 (--control): 해시는 FNV-1a 32비트를 float64 두 낱말에 ──
const H0 = 2166136261;
const TR = { rn: 0, rh: H0, fn: 0, fh: H0, qn: 0, qh: H0 };
const _f64 = new Float64Array(1);
const _u32 = new Uint32Array(_f64.buffer);
const mix = (h, x) => {
  _f64[0] = x;
  h = Math.imul(h ^ _u32[0], 16777619) >>> 0;
  return Math.imul(h ^ _u32[1], 16777619) >>> 0;
};
const trReset = () => Object.assign(TR, { rn: 0, rh: H0, fn: 0, fh: H0, qn: 0, qh: H0 });
function trRandom() {
  const r0 = Math.random; // 판마다 새로 심은 난수 위에 센다 (값은 그대로)
  Math.random = () => {
    const v = r0();
    TR.rn++;
    TR.rh = mix(TR.rh, v);
    return v;
  };
}
let forcePatched = false;
function patchForces() {
  // 몸에 거는 힘·충격량 호출을 센다 (그대로 넘긴다). --control 에서만 (느려진다)
  if (forcePatched) return;
  forcePatched = true;
  const proto = RAPIER.RigidBody.prototype;
  ['addForce', 'addTorque', 'applyImpulse', 'applyTorqueImpulse', 'addForceAtPoint', 'applyImpulseAtPoint'].forEach((m, mi) => {
    const f0 = proto[m];
    if (typeof f0 !== 'function') return;
    proto[m] = function (a, b, c) {
      TR.fn++;
      let h = mix(TR.fh, this.handle * 8 + mi);
      h = mix(mix(mix(h, a.x), a.y), a.z);
      if (b && typeof b === 'object') h = mix(mix(mix(h, b.x), b.y), b.z);
      TR.fh = h;
      return f0.call(this, a, b, c);
    };
  });
}

// ── 판 만들기: harness_m newRound 와 같은 순서(난수 소비가 같다). 더한 것: 자리 px·ex, 난수 lcg(fights12 방식), 스텝 번호 ──
class Puppet {
  constructor(me, foe) {
    this.me = me;
    this.foe = foe;
  }
  update() {} // 발·손은 G.before 가 쓴다
}
function mkRound(o = {}) {
  if (o.rng === 'lcg') {
    let s = o.seed * 9301 + 49297; // fights12.mjs seedRand 그대로
    Math.random = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  } else if (o.seed != null) seedRandom(o.seed);
  trRandom();
  const world = new RAPIER.World({ x: 0, y: PHYSICS.gravity, z: 0 });
  world.timestep = PHYSICS.timestep;
  world.integrationParameters.numSolverIterations = o.iters ?? 6;
  const eventQueue = new RAPIER.EventQueue(true);
  const colliderInfo = new Map();
  const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.5, 30).setTranslation(0, -0.5, 0).setFriction(0.9).setCollisionGroups(GROUND_GROUPS), ground);
  const n = 32;
  const R = ARENA.radius + 0.25;
  for (let i = 0; i < (o.walls === false ? 0 : n); i++) {
    const a = (i / n) * Math.PI * 2;
    const half = R * Math.tan(Math.PI / n) + 0.05;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a);
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.2, 0.6, half).setTranslation(Math.cos(a) * R, 0.6, Math.sin(a) * R).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }).setCollisionGroups(GROUND_GROUPS),
      ground,
    );
  }
  const scene = new THREE.Scene();
  const gap = o.gap ?? ARENA.startGap;
  const player = new Fighter(RAPIER, world, scene, colliderInfo, { index: 0, name: 'P', x: o.px ?? -gap / 2, heading: 0, look: o.look ?? LOOKS.player, weapon: o.weapon, breakSeed: o.seed, revive: o.revive2 });
  const enemy = new Fighter(RAPIER, world, scene, colliderInfo, { index: 1, name: 'E', x: o.ex ?? gap / 2, heading: Math.PI, look: o.look2 ?? LOOKS.enemy, weapon: o.weapon2 ?? o.weapon, breakSeed: o.seed, revive: o.revive });
  const AIC = o.AIClass || AI;
  const ai = new AIC(enemy, player, o.difficulty ?? 'normal', o.persona ?? null);
  player.skill.level = o.skill ?? 0.7;
  const G = { world, eventQueue, colliderInfo, player, enemy, ai, t: 0, stepNo: 0, ai2: null };
  const combat = new Combat(colliderInfo, { onWound: (a, v, r, p, pr) => G.onWound?.(a, v, r, p, pr), onClash: (p, s, i) => G.onClash?.(p, s, i) });
  G.combat = combat;
  if (o.AI2Class) G.ai2 = new o.AI2Class(player, enemy, o.difficulty2 ?? o.difficulty ?? 'normal', o.persona2 ?? null);
  G.step = () => {
    G.stepNo++;
    player.foe = enemy;
    enemy.foe = player;
    player.faceTarget = enemy.bodies.pelvis.translation();
    enemy.faceTarget = player.bodies.pelvis.translation();
    ai.update(DT);
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
  return G;
}

// 걸음 요청·착지 기록 (그대로 넘긴다). 흔적 해시도 여기서
function wrapGait(f, G) {
  const g = f.gait;
  f.reqLog = [];
  if (!g?.requestStep) return;
  const rq = g.requestStep.bind(g);
  g.requestStep = (o = {}) => {
    const ok = rq(o);
    TR.qn++;
    let h = mix(TR.qh, f.index * 4 + (o.kind === 'lunge' ? 1 : o.kind === 'pass' ? 2 : 3));
    TR.qh = mix(mix(mix(mix(h, ok ? 1 : 0), o.fwd ?? -1), o.side ?? -1), o.duration ?? -1);
    f.reqLog.push({ step: G.stepNo, kind: o.kind, fwd: o.fwd, dur: o.duration, ok, obj: ok ? g.req : null });
    return ok;
  };
  const td = g.touchdown.bind(g);
  g.touchdown = (l, s) => {
    if (l.kind === 'req') G.onReqTD?.(f, g.req, l);
    return td(l, s);
  };
}

// ── 기하·거리 ──
const reachOf = (f) => (HAS ? CLOSE.reach(f.armed ? f.weapon : null) : 0.53 + 0.11 + (f.armed ? f.weapon?.hiltLength ?? 0 : 0)); // 없으면 설계 식
const reachW = (wid, bare) => (HAS ? CLOSE.reach(bare ? null : getWeapon(wid)) : 0.53 + 0.11 + (bare ? 0 : getWeapon(wid).hiltLength));
function measureOf(wid) {
  // 롱소드 유파 간격 × 무기 실측 비율 (ai.js scaledM 과 같은 식)
  const b = schoolOf('longsword').measure;
  const m = MEASURED[getWeapon(wid).id];
  const ls = MEASURED.longsword;
  return m ? { contact: (b.contact * m[0]) / ls[0], clinch: (b.clinch * m[2]) / ls[2] } : { contact: b.contact, clinch: b.clinch };
}
const slow = (off, q, sp) => {
  const dx = q[0] - off.x;
  const dy = q[1] - off.y;
  const dd = Math.hypot(dx, dy);
  const s = sp * DT;
  if (dd > s) {
    off.x += (dx / dd) * s;
    off.y += (dy / dd) * s;
  } else off.set(q[0], q[1]);
};
const _d1 = new THREE.Vector3();
const _d2 = new THREE.Vector3();
const _r = new THREE.Vector3();
function segDist(p1, q1, p2, q2) {
  // ai.js segDist 그대로 (checkBind 의 기하)
  _d1.subVectors(q1, p1);
  _d2.subVectors(q2, p2);
  _r.subVectors(p1, p2);
  const a = _d1.dot(_d1);
  const e = _d2.dot(_d2);
  const f = _d2.dot(_r);
  if (a < 1e-9 || e < 1e-9) return _r.length();
  const b = _d1.dot(_d2);
  const c = _d1.dot(_r);
  const den = a * e - b * b;
  let sN = den > 1e-9 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
  let tN = (b * sN + f) / e;
  if (tN < 0) {
    tN = 0;
    sN = Math.min(1, Math.max(0, -c / a));
  } else if (tN > 1) {
    tN = 1;
    sN = Math.min(1, Math.max(0, (b - c) / a));
  }
  return Math.hypot(p1.x + _d1.x * sN - p2.x - _d2.x * tN, p1.y + _d1.y * sN - p2.y - _d2.y * tN, p1.z + _d1.z * sN - p2.z - _d2.z * tN);
}
const _ba = new THREE.Vector3();
const _bb = new THREE.Vector3();
/** 칼이 맞물렸나: checkBind(ai.js:924-931) 와 같은 기하 segDist < 0.07 (스텝 뒤에 잰다) */
function bladeBound(A, B) {
  if (!A.armed || !B.armed || !A.tipPrev || !B.tipPrev) return false;
  A.bladePoint(0.1, _ba);
  B.bladePoint(0.1, _bb);
  return segDist(_ba, A.tipPrev, _bb, B.tipPrev) < 0.07;
}

// 닿은 부위: 내 몸·칼 콜라이더 묶음 ↔ 상대 몸통(가슴·배·골반). 코등이 = 칼날 아닌 부품 중 옆으로 가장 넓은 것
function contactSets(G, P, E) {
  const cats = {};
  const add = (k, c) => (cats[k] ||= []).push(c);
  const b = P.bodies;
  for (const k of ['farmS', 'farmO']) add('forearm', b[k].collider(0));
  for (const k of ['uarmS', 'uarmO']) add('upperarm', b[k].collider(0));
  for (const k of ['chest', 'abdomen', 'pelvis']) add('torso', b[k].collider(0));
  for (const k of ['thighF', 'thighB']) add('thigh', b[k].collider(0));
  add('head', b.head.collider(0));
  if (P.armed) {
    let guard = null;
    let wide = -1;
    const hilt = [];
    for (const c of P.swordColliders || []) {
      if (G.colliderInfo.get(c.handle)?.part === 'blade') add('blade', c);
      else {
        hilt.push(c);
        let w = 0;
        try {
          const h = c.halfExtents();
          w = Math.max(h.x, h.z);
        } catch {
          w = 0;
        }
        if (w > wide) (wide = w), (guard = c);
      }
    }
    for (const c of hilt) add(c === guard ? 'crossguard' : 'hilt', c);
  }
  const foe = ['chest', 'abdomen', 'pelvis'].map((k) => E.bodies[k].collider(0));
  return { cats, foe };
}
function touching(world, cs) {
  const hit = {};
  for (const [k, list] of Object.entries(cs.cats)) {
    hit[k] = list.some((c) =>
      cs.foe.some((f) => {
        let h = false;
        world.contactPair(c, f, (m) => {
          if (m.numContacts() > 0) h = true;
        });
        return h;
      }),
    );
  }
  return hit;
}
// 발 겹침: 내 발 상자 ↔ 상대 발 상자 (발끼리는 부딪히지 않으니 겹치면 발이 발 속으로, fighter.js:32-33). 3D 방향 상자 분리축 판정
const AX = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
function obbOf(col) {
  const t = col.translation();
  const r = col.rotation();
  const h = col.halfExtents();
  const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
  return { c: new THREE.Vector3(t.x, t.y, t.z), a: AX.map((v) => v.clone().applyQuaternion(q)), h: [h.x, h.y, h.z] };
}
function obbHit(A, B) {
  const R = [[], [], []];
  const AR = [[], [], []];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) (R[i][j] = A.a[i].dot(B.a[j])), (AR[i][j] = Math.abs(R[i][j]) + 1e-9);
  const tv = B.c.clone().sub(A.c);
  const t = [tv.dot(A.a[0]), tv.dot(A.a[1]), tv.dot(A.a[2])];
  for (let i = 0; i < 3; i++) if (Math.abs(t[i]) > A.h[i] + B.h[0] * AR[i][0] + B.h[1] * AR[i][1] + B.h[2] * AR[i][2]) return false;
  for (let j = 0; j < 3; j++) if (Math.abs(t[0] * R[0][j] + t[1] * R[1][j] + t[2] * R[2][j]) > A.h[0] * AR[0][j] + A.h[1] * AR[1][j] + A.h[2] * AR[2][j] + B.h[j]) return false;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      const i1 = (i + 1) % 3;
      const i2 = (i + 2) % 3;
      const j1 = (j + 1) % 3;
      const j2 = (j + 2) % 3;
      const ra = A.h[i1] * AR[i2][j] + A.h[i2] * AR[i1][j];
      const rb = B.h[j1] * AR[i][j2] + B.h[j2] * AR[i][j1];
      if (Math.abs(t[i2] * R[i1][j] - t[i1] * R[i2][j]) > ra + rb) return false;
    }
  return true;
}
/** 발 겹침 두 가지: box = 내 발 상자 어느 것이든 상대 발 상자와 겹침, inside = 내 앞발(상대 쪽으로 더 나간 발) 중심이 상대 발 상자 안 */
function feetOverlap(P, E) {
  try {
    const mine = ['footF', 'footB'].map((k) => obbOf(P.bodies[k].collider(0)));
    const his = ['footF', 'footB'].map((k) => obbOf(E.bodies[k].collider(0)));
    const box = mine.some((a) => his.some((b) => obbHit(a, b)));
    const ce = E.bodies.chest.translation();
    const cp = P.bodies.chest.translation();
    const ux = ce.x - cp.x;
    const uz = ce.z - cp.z;
    const front = mine[0].c.x * ux + mine[0].c.z * uz >= mine[1].c.x * ux + mine[1].c.z * uz ? mine[0] : mine[1];
    const inside = his.some((b) => {
      const v = front.c.clone().sub(b.c);
      return Math.abs(v.dot(b.a[0])) <= b.h[0] && Math.abs(v.dot(b.a[2])) <= b.h[2] && Math.abs(v.dot(b.a[1])) <= b.h[1] + front.h[1];
    });
    return { box, inside };
  } catch {
    return { box: false, inside: false };
  }
}

/** 밀치기 걸음이 디딘 발(req 다리 착지 때) ↔ 상대 발 상자: box = 상자끼리 겹침, inside = 발 중심이 상대 발 상자 안,
 *  pen = 겹친 깊이(상대 발 상자 앞뒤·옆 축 중 얕은 쪽, m). 설계: L 은 앞발이 상대 발 속으로 들어가지 않게 (fighter.js:32-33) */
function plantOverlap(P, E, footKey) {
  try {
    const a = obbOf(P.bodies[footKey].collider(0));
    let box = false;
    let inside = false;
    let pen = 0;
    for (const k of ['footF', 'footB']) {
      const b = obbOf(E.bodies[k].collider(0));
      if (!obbHit(a, b)) continue;
      box = true;
      const v = a.c.clone().sub(b.c);
      if (Math.abs(v.dot(b.a[0])) <= b.h[0] && Math.abs(v.dot(b.a[2])) <= b.h[2]) inside = true;
      let p = Infinity;
      for (const i of [0, 2]) {
        const ra = a.h[0] * Math.abs(a.a[0].dot(b.a[i])) + a.h[1] * Math.abs(a.a[1].dot(b.a[i])) + a.h[2] * Math.abs(a.a[2].dot(b.a[i]));
        p = Math.min(p, ra + b.h[i] - Math.abs(v.dot(b.a[i])));
      }
      pen = Math.max(pen, p);
    }
    return { box, inside, pen: +pen.toFixed(4) };
  } catch {
    return null;
  }
}

// 칼 부딪힘: main.js onClash(529-559) 의 문턱·쿨다운 그대로 센다 (시간은 물리 시간)
function clashMon() {
  const c = { calls: 0, fresh: 0, sound: 0, vnMax: 0, sparks: 0, sparksSmall: 0, hitStop: 0, cool: 0, stopCool: 0 };
  c.hook = (point, speed, touch) => {
    c.calls++;
    if (touch?.fresh) c.fresh++;
    if (touch && (touch.fresh || touch.vn > 3)) c.sound++; // "쨍"
    if (touch) c.vnMax = Math.max(c.vnMax, touch.vn);
    const impact = touch ? (touch.fresh || touch.vn > 3 ? touch.vn : 0) : speed;
    if (c.cool > 0) return;
    if (impact < 2.5) {
      if (touch && touch.vt > 5) (c.cool = 0.12), c.sparksSmall++;
      return;
    }
    c.cool = 0.09;
    c.sparks++; // 불꽃 + 카메라 흔들림
    if (impact > 6 && c.stopCool <= 0) (c.hitStop++, (c.stopCool = 0.5));
  };
  c.tick = () => {
    c.cool -= DT;
    c.stopCool -= DT;
  };
  return c;
}

// 손 목표 (가슴 기준·몸 방향 기준): handTarget − 가슴, yaw 역회전. fighter.step 바로 뒤에 잰다 (그때 가슴 위치로 만든 값)
const _hl = new THREE.Vector3();
const _qi = new THREE.Quaternion();
function wrapHand(f, sink) {
  const st = f.step.bind(f);
  let prev = null;
  f.step = (dt) => {
    st(dt);
    const ht = f.handTarget;
    if (!ht) return;
    const c = f.bodies.chest.translation();
    _hl.set(ht.x - c.x, ht.y - c.y, ht.z - c.z).applyQuaternion(_qi.copy(f.yaw).invert());
    if (prev) sink(Math.hypot(_hl.x - prev.x, _hl.y - prev.y, _hl.z - prev.z));
    prev = prev || new THREE.Vector3();
    prev.copy(_hl);
  };
}

const fired = (f) => (typeof f.shoves === 'number' ? f.shoves : null);
const bargeSnap = (b) => (b ? { phase: b.phase, L: b.L != null ? +(+b.L).toFixed(3) : null, stepOk: b.stepOk ?? null, d0: b.d0 != null ? +(+b.d0).toFixed(3) : null } : null);

// ═════ 한 판: 붙거나 걸어 들어와서 → 스틱을 놓았다(REL_S) → 민다. cell.neg 가 있으면 음성 대본 ═════
function runRound(cell, seed, { on, ctrl }) {
  if (HAS) CLOSE.on = on;
  const bare = !!cell.disarm;
  const reachP = reachW(cell.weapon, bare);
  const M = measureOf(cell.weapon);
  let pos;
  const gj = 0.1 * jit(seed, 1);
  if (cell.start === 'foewall') pos = { walls: true, px: WALL_X - 1.25 - gj, ex: WALL_X }; // 1.6 에서 혼자 걸어오면 칼끼리 걸려 1.1 m 에서 멈춘다 → 1.25 에서
  else if (cell.start === 'selfwall') pos = { walls: true, px: -WALL_X, ex: -WALL_X + 1.25 + gj };
  else if (cell.start === 'walkin') pos = { walls: false, px: -(1.25 + gj) / 2, ex: (1.25 + gj) / 2 };
  else if (cell.start === 'outside') pos = { walls: false, px: -(reachP + Math.abs(gj)) / 2, ex: (reachP + Math.abs(gj)) / 2 }; // 시작 정지 동안 0.1~0.15 m 벌어진다 (밂 때 d 를 적는다)
  else pos = { walls: false, px: -(1.6 + gj) / 2, ex: (1.6 + gj) / 2 };
  const padBase = cell.pad ?? PFLUG;
  const padP = [padBase[0] + 0.06 * jit(seed, 2), padBase[1] + 0.06 * jit(seed, 3)];
  const padE = [PFLUG[0] + 0.06 * jit(seed, 4), PFLUG[1] + 0.06 * jit(seed, 5)];
  const look = cell.plate ? getLook(cell.plate) : undefined;
  const G = mkRound({ seed, ...pos, weapon: cell.weapon, weapon2: cell.foeWeapon ?? (cell.weapon === 'pistol' ? 'longsword' : cell.weapon), look, look2: look, AIClass: Puppet });
  const P = G.player;
  const E = G.enemy;
  P.canShove = true; // main.js 처럼 (끄고 켜기는 CLOSE.on)
  if (cell.mutual) E.canShove = true;
  if (cell.emv) P.emoMods = { dealt: 1, taken: 1, pass: 0, move: cell.emv, tremor: 0 };
  wrapGait(P, G);
  wrapGait(E, G);
  const dh = []; // 스텝마다 손 목표 변화 (창 안만)
  const S = { ph: 'hold', tA: 0, tG: null, tRel: null, tPress: null, relStep: null, pressStep: null, startOk: true, dPress: null, armedPress: null };
  const dhMax = { pre: 0, barge: 0, ret: 0 }; // 발사 전 / 밀치는 중 / 끝난 뒤(되돌림) 한 스텝 최대 변화
  wrapHand(P, (v) => {
    if (S.relStep == null) return;
    dh.push(v);
    const k = (fired(P) ?? 0) === S.shRel && !P.barge ? 'pre' : P.barge ? 'barge' : 'ret'; // 발사·끝은 P.step 안: 그 스텝부터 (루프의 R.fireStep 은 한 스텝 늦다)
    dhMax[k] = Math.max(dhMax[k], v);
  });
  let cs = null; // 닿은 부위 묶음: 밂이 시작될 때 만든다 (빈손 칸은 칼을 놓은 뒤)
  const cc = clashMon();
  const wounds = [];
  G.onClash = (p, s, i) => {
    if (S.pressStep != null) cc.hook(p, s, i);
  };
  G.onWound = (att, vic, r, p, pr) => {
    if (S.pressStep == null || (att !== P && vic !== P)) return;
    wounds.push({ dir: att === P ? 'dealt' : 'taken', type: r.type, zone: r.zone, J: +r.energy.toFixed(1), part: pr?.w?.part ?? null, t: +(G.t - (R.tFire ?? S.tPress)).toFixed(2) });
  };
  const R = { fires: [], efires: 0, tFire: null, fireStep: null, barge0: null, end: null, endStep: null, req: null, push: {}, own: {}, tCl: null, tCo: null, fallE: null, fallP: null, offP: 0, offE: 0, cHit: {}, cSteps: 0, footSteps: 0, dMin: 9, dMax: 0 };
  G.onReqTD = (f, reqObj, leg) => {
    if (f === P && R.req && R.req.obj && reqObj === R.req.obj && R.req.land == null) {
      R.req.land = G.stepNo;
      R.plant = plantOverlap(P, E, leg.foot); // 밀치기 걸음이 디딘 발: 상대 발 상자와 겹치나 (설계: L 은 발이 상대 발 속으로 들어가지 않게)
    }
  };
  let sh0 = fired(P) ?? 0;
  let esh0 = fired(E) ?? 0;
  let prevBarge = null;
  let e0 = null;
  let p0 = null;
  let u = null;
  let cutStarted = false;
  const foeMove = () => (cell.foe === 'backing' ? -1 : 0);
  const neg = cell.neg;

  G.before = (t) => {
    S.eState = E.state; // 발사(P.step 안) 때의 상대 상태 (E.step 전)
    if (!bare) slow(P.handOffset, S.cut ? WECHSEL : padP, S.cut ? CUT_SPEED : 1.0);
    slow(E.handOffset, padE, 1.0);
    if (bare && t >= 1.0 && P.armed) P.dropSword(); // 빈손 칸: 시작 정지 동안 칼을 놓는다 (칼은 발밑에 떨어진다)
    const d = P.foeDistance();
    let ps = [0, 0];
    let em = 0;
    if (S.ph === 'hold' && !P.feetHeld && !E.feetHeld) (S.ph = 'approach'), (S.tA = t);
    if (S.ph === 'approach') {
      let done = false;
      const st = cell.start;
      if (st === 'glued' || st === 'foewall' || st === 'selfwall') {
        ps = st === 'selfwall' ? [0, 0] : [0, 1];
        em = st === 'foewall' ? 0 : 1;
        if (S.tG == null && d < GLUE_D) S.tG = t;
        done = S.tG != null && t >= S.tG + GLUE_HOLD - 1e-9;
      } else if (st === 'walkin') {
        ps = [0, 1];
        done = d <= reachP;
      } else if (st === 'bound') {
        // 둘 다 걸어 들어와 칼이 맞물린 뒤(checkBind 기하) 닿는 거리 안에 들면
        ps = [0, 1];
        em = 1;
        if (S.bindT == null && bladeBound(P, E)) S.bindT = t;
        done = S.bindT != null && d <= reachP;
        if (done) S.boundAtRel = bladeBound(P, E);
      } else if (st === 'outside') done = t >= S.tA + 0.3; // 닿는 거리 밖에서 스틱 0 → 곧 새로 밂
      if (!done && t - S.tA > APPROACH_MAX) (done = true), (S.startOk = false);
      if (done) {
        S.ph = 'release';
        S.tRel = t;
        S.relStep = G.stepNo;
        S.shRel = fired(P) ?? 0;
        ps = [0, 0];
        em = 0; // 물러나는 상대는 밂(발사)과 함께 물러나기 시작한다: 놓는 동안 먼저 물러나면 닿는 거리 밖에서 밀게 된다 (그건 음성 outside 칸)
        if (neg === 'getup') E.knockDown(false); // 무릎부터 → 일어섬
        if (neg === 'kneel') E.limbs.legF = E.limbs.legB = 0.2; // 다리 < 0.25 → 주저앉아 무릎 꿇은 채 (fighter.js updateState)
      }
    } else if (S.ph === 'release') {
      em = 0;
      if (t >= S.tRel + REL_S - 1e-9) {
        S.ph = 'press';
        S.tPress = t;
        S.pressStep = G.stepNo;
        S.dPress = d;
        S.armedPress = P.closeArmed ?? null;
        if (neg === 'thrust' || neg === 'thrust_hold') S.tap = P.skill.thrust();
        if (neg === 'cut') S.cut = true;
      }
    }
    if (S.ph === 'press') {
      em = foeMove();
      const tp = t - S.tPress;
      if (neg === 'side') ps = [1, 0.3];
      else if (neg === 'back') ps = [0, -1];
      else if (neg === 'thrust') ps = P.skill.tap ? [0, 1] : [0, 0]; // 톡 하는 동안만 밂
      else if (neg === 'cut') {
        const sw = P.skill.swinging ?? P.skill.vel.length() > SKILL.swingSpeed;
        if (sw) cutStarted = true;
        ps = cutStarted ? [0, 1] : [0, 0]; // 휘두르는 중이 된 뒤부터 밂
      } else ps = [0, 1];
      if (neg === 'thrust_during' && R.fireStep != null && G.stepNo === R.fireStep + 2) P.skill.thrust(); // 밀치는 중 톡
      const limit = neg ? 1.5 : R.fireStep != null ? PRESS_MAX : CTRL_PRESS;
      const tf = R.fireStep != null ? t - R.tFire : tp;
      if (!neg && R.fireStep != null && G.stepNo > R.fireStep && !P.barge) S.ph = 'after';
      else if (tf >= limit) S.ph = 'after';
      if (S.ph === 'after') ps = [0, 0];
    } else if (S.ph === 'after') em = foeMove();
    // main.js:1363-1367 처럼: 원값 → stickX/Y, 감정 배수 → move
    const emv = P.emoMods?.move ?? 1;
    P.stickX = P.alive ? ps[0] : 0;
    P.stickY = P.alive ? ps[1] : 0;
    P.move.set(P.alive ? ps[0] * emv : 0, P.alive ? ps[1] * emv : 0);
    if (cell.mutual) {
      const eps = S.ph === 'approach' ? [0, em] : ps;
      E.stickX = E.alive ? eps[0] : 0;
      E.stickY = E.alive ? eps[1] : 0;
      E.move.set(E.alive ? eps[0] : 0, E.alive ? eps[1] : 0);
    } else {
      E.stickX = 0;
      E.stickY = 0;
      E.move.set(0, E.state === 'stand' ? em : 0);
    }
  };

  const maxSteps = Math.round(16 / DT);
  const dbg = DEBUG && DEBUG === cell.id ? [] : null;
  for (let i = 0; i < maxSteps; i++) {
    G.step();
    cc.tick();
    if (dbg && G.stepNo % 12 === 0) dbg.push(`${G.t.toFixed(1)}:${S.ph[0]}:${P.foeDistance().toFixed(2)}${P.barge ? '*' : ''}${bladeBound(P, E) ? 'B' : ''}${P.state[0]}${E.state[0]}`);
    const st = G.stepNo;
    const d = P.foeDistance();
    // 발사: shoves 가 늘었나 (없으면 barge 가 새로 생겼나)
    const sh = fired(P);
    const nb = !!P.barge;
    let newFire = 0;
    if (sh != null) (newFire = sh - sh0), (sh0 = sh);
    else if (nb && !prevBarge) newFire = 1;
    for (let k = 0; k < newFire; k++) {
      R.fires.push({ step: st, ph: S.ph, eStand: S.eState === 'stand' });
      if (R.fireStep == null) {
        R.fireStep = st;
        R.tFire = G.t - DT;
        R.barge0 = bargeSnap(P.barge);
        R.footPre = feetOverlap(P, E); // 발사 때 이미 발이 겹쳐 있었나 (오늘 걸어 들어온 발: 걸음이 더한 것과 가르려고)
        const rq = P.reqLog.filter((q) => q.step === st && q.kind === 'lunge');
        R.req = rq.length ? { ok: rq[rq.length - 1].ok, fwd: rq[rq.length - 1].fwd, dur: rq[rq.length - 1].dur, obj: rq[rq.length - 1].obj, land: null, status: rq[rq.length - 1].ok ? 'pending' : 'refused' } : { ok: null, status: 'none' };
        const pe = E.bodies.pelvis.translation();
        const pp = P.bodies.pelvis.translation();
        const ce = E.bodies.chest.translation();
        const cp = P.bodies.chest.translation();
        e0 = { x: pe.x, z: pe.z };
        p0 = { x: pp.x, z: pp.z };
        const L = Math.hypot(ce.x - cp.x, ce.z - cp.z) || 1;
        u = { x: (ce.x - cp.x) / L, z: (ce.z - cp.z) / L };
      }
    }
    const esh = fired(E);
    if (esh != null && esh > esh0) (R.efires += esh - esh0), (esh0 = esh);
    if (prevBarge && !nb && R.end == null) (R.end = P.bargeEnd ?? 'n/a'), (R.endStep = st);
    prevBarge = nb;
    // 걸음 요청의 끝: 착지 / 버려짐(나이 > 1 s, gait.js:436-439) / 다른 요청이 덮음
    if (R.req?.status === 'pending') {
      if (R.req.land != null) R.req.status = 'landed';
      else if (P.gait?.req !== R.req.obj) R.req.status = P.reqLog.some((q) => q.step > R.fireStep) ? 'replaced' : 'dropped';
    }
    if (S.relStep != null) {
      R.dMin = Math.min(R.dMin, d);
      R.dMax = Math.max(R.dMax, d);
      if (typeof P.lift === 'number') R.liftMax = Math.max(R.liftMax ?? 0, P.lift);
      if (typeof P.closeW === 'number') R.wMax = Math.max(R.wMax ?? 0, P.closeW);
      if (P.armFull) R.armFull = (R.armFull ?? 0) + 1;
    }
    // 닿은 부위·발 겹침: 밀치는 동안 (대조군은 밂 단계에서 닿는 거리 안)
    const pressing = on && HAS ? nb : S.ph === 'press' && d <= reachP;
    if (pressing && S.pressStep != null) {
      cs ||= contactSets(G, P, E);
      R.cSteps++;
      const h = touching(G.world, cs);
      for (const k in h) if (h[k]) R.cHit[k] = (R.cHit[k] || 0) + 1;
      const fo = feetOverlap(P, E);
      if (fo.box) R.footSteps++;
      if (fo.inside) R.footIn = (R.footIn ?? 0) + 1;
    }
    const t0 = R.tFire ?? S.tPress;
    if (t0 != null) {
      const dt = G.t - t0;
      if (R.fireStep != null) {
        for (const k of PT) {
          if (R.push[k] === undefined && dt >= k - 1e-9) {
            const pe = E.bodies.pelvis.translation();
            const pp = P.bodies.pelvis.translation();
            R.push[k] = +((pe.x - e0.x) * u.x + (pe.z - e0.z) * u.z).toFixed(3);
            R.own[k] = +((pp.x - p0.x) * u.x + (pp.z - p0.z) * u.z).toFixed(3);
          }
        }
        if (R.tCl == null && d >= M.clinch) R.tCl = +dt.toFixed(3);
        if (R.tCo == null && d >= M.contact) R.tCo = +dt.toFixed(3);
      } else if (ctrl && S.pressStep != null) {
        // 대조군: 밂 시작부터 같은 방식으로 (오늘 걸어 밀었을 때)
        if (e0 == null) {
          const pe = E.bodies.pelvis.translation();
          const ce = E.bodies.chest.translation();
          const cp = P.bodies.chest.translation();
          e0 = { x: pe.x, z: pe.z };
          const L = Math.hypot(ce.x - cp.x, ce.z - cp.z) || 1;
          u = { x: (ce.x - cp.x) / L, z: (ce.z - cp.z) / L };
        }
        for (const k of PT) {
          if (R.push[k] === undefined && dt >= k - 1e-9) {
            const pe = E.bodies.pelvis.translation();
            R.push[k] = +((pe.x - e0.x) * u.x + (pe.z - e0.z) * u.z).toFixed(3);
          }
        }
      }
      if (R.fallE == null && E.state !== 'stand' && !cell.neg) R.fallE = `${E.state}@${dt.toFixed(2)}`;
      if (R.fallP == null && P.state !== 'stand') R.fallP = `${P.state}@${dt.toFixed(2)}`;
      R.offP = Math.max(R.offP, P.offBalance || 0);
      R.offE = Math.max(R.offE, E.offBalance || 0);
      if (dt >= WIN - 1e-9 && S.ph !== 'press') break;
    }
  }
  if (R.req?.status === 'pending') R.req.status = 'open';
  if (dbg) say(`[debug ${cell.id} s${seed} ${on ? 'on' : 'off'}] tG ${S.tG?.toFixed(2)} tRel ${S.tRel?.toFixed(2)} tPress ${S.tPress?.toFixed(2)} startOk ${S.startOk} ${dbg.join(' ')}`);
  const fireOffset = R.fireStep != null && S.pressStep != null ? R.fireStep - S.pressStep : null;
  // 원치 않은 발사: 음성 칸은 전부(무릎·일어섬 칸은 상대가 서 있지 않을 때만), 양성 칸·정보 칸은 밂 단계 첫 발사 말고 전부
  let unwanted;
  if (!neg || neg === 'thrust_during' || neg === 'thrust_hold') unwanted = R.fires.filter((f, i) => i > 0 || f.ph !== 'press').length;
  else if (neg === 'getup' || neg === 'kneel') unwanted = R.fires.filter((f) => !f.eStand).length;
  else unwanted = R.fires.length;
  return {
    seed,
    startOk: S.startOk,
    boundAtRel: S.boundAtRel,
    dPress: S.dPress != null ? +S.dPress.toFixed(3) : null,
    armedPress: S.armedPress,
    fires: R.fires.length,
    unwanted,
    afterStand: neg === 'getup' || neg === 'kneel' ? R.fires.filter((f) => f.eStand).length : undefined,
    efires: R.efires,
    fireOffset,
    barge0: R.barge0,
    L: R.barge0?.L ?? (R.req?.fwd != null ? +(+R.req.fwd).toFixed(3) : null),
    end: R.end ?? (R.fireStep != null ? (P.barge ? 'open' : P.bargeEnd ?? 'n/a') : null),
    req: R.req ? { status: R.req.status, fwd: R.req.fwd ?? null, dur: R.req.dur ?? null, landT: R.req.land != null ? +((R.req.land - R.fireStep) * DT).toFixed(3) : null } : null,
    push: R.push,
    own: R.own,
    tCl: R.tCl,
    tCo: R.tCo,
    fallE: R.fallE,
    fallP: R.fallP,
    offP: +R.offP.toFixed(3),
    offE: +R.offE.toFixed(3),
    dMin: +R.dMin.toFixed(3),
    dMax: +R.dMax.toFixed(3),
    dh,
    dhMax,
    liftMax: R.liftMax ?? 'n/a',
    wMax: R.wMax ?? 'n/a',
    armFull: R.armFull ?? 0,
    contact: { steps: R.cSteps, ...R.cHit },
    foot: R.footSteps,
    footIn: R.footIn ?? 0,
    plant: R.plant ?? null,
    footPre: R.footPre ?? null,
    clash: { calls: cc.calls, fresh: cc.fresh, sound: cc.sound, vnMax: +cc.vnMax.toFixed(2), sparks: cc.sparks, sparksSmall: cc.sparksSmall, hitStop: cc.hitStop },
    wounds,
  };
}

// ── 모으기 ──
const q = (a, p) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const i = (s.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return +(s[lo] + (s[hi] - s[lo]) * (i - lo)).toFixed(3);
};
const qs = (a) => (a.length ? { med: q(a, 0.5), p10: q(a, 0.1), p90: q(a, 0.9) } : null);
const cnt = (a) => a.reduce((m, k) => ((m[k] = (m[k] || 0) + 1), m), {});
const sum = (a) => a.reduce((s, x) => s + x, 0);
const pct = (k, n) => (n ? +((100 * k) / n).toFixed(0) : null);
function contactShare(rs) {
  const steps = sum(rs.map((r) => r.contact.steps));
  const o = { steps };
  for (const k of ['crossguard', 'forearm', 'blade', 'torso', 'hilt', 'upperarm', 'thigh', 'head']) o[k] = steps ? pct(sum(rs.map((r) => r.contact[k] || 0)), steps) : null;
  return o;
}

const spikes = (a, floor) => a.filter((v, i) => i > 0 && i < a.length - 1 && v > floor + 1e-12 && v > a[i - 1] + a[i + 1]).length;
function runCell(cell) {
  const t0 = Date.now();
  // 대조군 (끔, 같은 대본): 손 목표 한 스텝 변화의 최대 = 이 칸의 기준, 오늘 걸어 밀었을 때 밀린 거리
  const ctl = HAS || TODAY ? SEEDS.slice(0, NC).map((s) => runRound(cell, s, { on: false, ctrl: true })) : [];
  const ctrlMax = Math.max(0, ...ctl.map((r) => Math.max(0, ...r.dh)));
  const rs = HAS ? SEEDS.map((s) => runRound(cell, s, { on: true, ctrl: false })) : [];
  const fr = rs.filter((r) => r.fires > 0);
  // 손 목표 튐 (spikes, 모든 칸이 끝난 뒤 modeCore 가 다시 센다): 한 스텝 변화가 기준보다 크고 앞뒤 두 스텝 변화의 합보다도 큰 스텝
  //  (한 스텝에 몰린 변화). 매끈한 따라가기(26/s 2차)는 앞뒤 스텝과 크기가 비슷해 걸리지 않고, 켜고 끄기(0 → 1)는 그 한 스텝만 커서 걸린다.
  //  기준 = 이번 실행 대조군 전부(오늘 규칙, 같은 장면들)의 한 스텝 최대: 오늘 이미 하는 움직임은 튐이 아니다. 여기서는 칸 대조군 최대로 먼저 센다.
  //  overCtrl = 이 칸 대조군 최대보다 큰 스텝 수 (빠른 움직임까지 다 센다, 참고)
  const jumps = rs.map((r) => spikes(r.dh, ctrlMax));
  const overCtrl = rs.map((r) => r.dh.filter((v) => v > ctrlMax + 1e-12).length);
  const o = {
    mode: cell.extra ? 'extra' : 'core',
    cell: cell.id,
    n: rs.length,
    nCtrl: ctl.length,
    seeds: SEEDS,
    reach: +reachW(cell.weapon, !!cell.disarm).toFixed(3),
    M: measureOf(cell.weapon),
    startOk: rs.filter((r) => r.startOk).length,
    startOkCtrl: ctl.filter((r) => r.startOk).length,
    boundAtRel: cell.start === 'bound' ? rs.filter((r) => r.boundAtRel).length : undefined,
    dPress: qs(rs.map((r) => r.dPress).filter((x) => x != null)),
    dPressCtrl: qs(ctl.map((r) => r.dPress).filter((x) => x != null)),
    fired: fr.length,
    unwanted: sum(rs.map((r) => r.unwanted)),
    efires: cell.mutual ? sum(rs.map((r) => r.efires)) : undefined,
    fireOffset: cnt(fr.map((r) => r.fireOffset)),
    L: qs(fr.map((r) => r.L).filter((x) => x != null)),
    push: Object.fromEntries(PT.map((k) => [k, qs(fr.map((r) => r.push[k]).filter((x) => x != null))])),
    own: Object.fromEntries(PT.map((k) => [k, qs(fr.map((r) => r.own[k]).filter((x) => x != null))])),
    pushCtrl: Object.fromEntries(PT.map((k) => [k, qs(ctl.map((r) => r.push[k]).filter((x) => x != null))])),
    cutWin: { clinch: pct(fr.filter((r) => r.tCl != null).length, fr.length), contact: pct(fr.filter((r) => r.tCo != null).length, fr.length), tClinch: qs(fr.map((r) => r.tCl).filter((x) => x != null)), tContact: qs(fr.map((r) => r.tCo).filter((x) => x != null)) },
    foeFall: { n: fr.filter((r) => r.fallE).length, list: fr.map((r) => r.fallE).filter(Boolean) },
    selfFall: { n: fr.filter((r) => r.fallP).length, list: fr.map((r) => r.fallP).filter(Boolean) },
    offPeak: { own: qs(fr.map((r) => r.offP)), foe: qs(fr.map((r) => r.offE)) },
    handJump: { count: sum(jumps), rounds: jumps.filter((x) => x > 0).length, overCtrl: sum(overCtrl), maxShove: +Math.max(0, ...rs.map((r) => Math.max(0, ...r.dh))).toFixed(4), ctrlMax: +ctrlMax.toFixed(4), maxPre: +Math.max(0, ...rs.map((r) => r.dhMax.pre)).toFixed(4), maxBarge: +Math.max(0, ...rs.map((r) => r.dhMax.barge)).toFixed(4), maxRet: +Math.max(0, ...rs.map((r) => r.dhMax.ret)).toFixed(4) },
    lift: { max: qs(rs.map((r) => r.liftMax).filter((x) => typeof x === 'number')), wMax: qs(rs.map((r) => r.wMax).filter((x) => typeof x === 'number')), armFullSteps: sum(rs.map((r) => r.armFull)) },
    contact: contactShare(fr),
    contactCtrl: contactShare(ctl),
    footOverlap: { plantBox: fr.filter((r) => r.plant?.box).length, plantInside: fr.filter((r) => r.plant?.inside).length, plants: fr.filter((r) => r.plant).length, plantPenMax: +Math.max(0, ...fr.map((r) => r.plant?.pen ?? 0)).toFixed(4), plantBoxPre: fr.filter((r) => r.plant?.box && r.footPre?.box).length, preBox: fr.filter((r) => r.footPre?.box).length, steps: sum(rs.map((r) => r.foot)), rounds: rs.filter((r) => r.foot > 0).length, inside: sum(rs.map((r) => r.footIn)), insideRounds: rs.filter((r) => r.footIn > 0).length, ctrlSteps: sum(ctl.map((r) => r.foot)), ctrlInside: sum(ctl.map((r) => r.footIn)) },
    noFire: { n: rs.length - fr.length, outside: rs.filter((r) => !r.fires && r.dPress != null && r.dPress > reachW(cell.weapon, !!cell.disarm)).length, notArmed: rs.filter((r) => !r.fires && r.armedPress === false).length },
    clash: Object.fromEntries(['calls', 'fresh', 'sound', 'sparks', 'sparksSmall', 'hitStop'].map((k) => [k, sum(rs.map((r) => r.clash[k]))]).concat([['vnMax', Math.max(0, ...rs.map((r) => r.clash.vnMax))]])),
    wounds: { dealt: sum(rs.map((r) => r.wounds.filter((w) => w.dir === 'dealt').length)), taken: sum(rs.map((r) => r.wounds.filter((w) => w.dir === 'taken').length)), list: rs.flatMap((r) => r.wounds.map((w) => `${w.dir}:${w.part}:${w.type}:${w.zone}:${w.J}J@${w.t}`)) },
    firstWound: fr.map((r) => r.wounds.find((w) => w.dir === 'dealt')).filter(Boolean).map((w) => `${w.zone}:${w.type}:${w.J}J`),
    ends: cnt(fr.map((r) => r.end)),
    req: cnt(fr.map((r) => r.req?.status ?? 'none')),
    reqAccepted: fr.filter((r) => ['landed', 'dropped', 'replaced', 'open'].includes(r.req?.status)).length,
    landT: qs(fr.map((r) => r.req?.landT).filter((x) => x != null)),
    rounds: rs.map((r) => ({ s: r.seed, f: r.fires, off: r.fireOffset, L: r.L, pl: r.plant ? `${r.plant.box ? 1 : 0}${r.plant.inside ? 1 : 0}:${r.plant.pen}` : null, pre: r.footPre ? (r.footPre.box ? 1 : 0) : null, e1: r.push[1] ?? null, end: r.end, rq: r.req?.status ?? null, fE: r.fallE, fP: r.fallP, d: r.dPress, armed: r.armedPress })),
    sec: +((Date.now() - t0) / 1000).toFixed(1),
  };
  Object.defineProperty(o, '_dh', { value: rs.map((r) => r.dh), enumerable: false }); // 튐 다시 세기 (JSON 에는 안 나간다)
  if (!cell.hold) line(o);
  return o;
}

const fx = (x, w = 5) => (x == null ? 'n/a' : typeof x === 'number' ? x.toFixed(2) : String(x)).padStart(w);
const fi = (x, w = 4) => (x == null ? 'n/a' : String(x)).padStart(w);
function coreTable(rows) {
  say('\n[요약] 칸 × n | 발사 | 상대 밀린 거리 1 s 중앙 [p10,p90] m | 끔(오늘) 1 s | 상대 넘어짐% | 내 넘어짐% | 손 튐(튐 수 · 칸 대조군 최대 넘은 스텝 / 최대Δ / 칸 대조군 최대 m) | 발 겹침(딛은 발 상자 겹침/걸음 착지 수 최대깊이 m | 밂 중 스텝 상자/앞발 안 · 끔 상자) | 원치 않은 발사 | 칼 부딪힘(쨍/불꽃/멈칫) | 상처(준/받은) | 벨 틈%(clinch/contact) | 끝난 까닭');
  for (const o of rows) {
    const p = o.push[1];
    const c = o.pushCtrl[1];
    say(
      `${o.cell.padEnd(34)} ${String(o.n).padStart(2)} ${String(o.fired).padStart(2)}  ${p ? `${fx(p.med)} [${fx(p.p10)},${fx(p.p90)}]` : '      n/a          '}  ${fx(c?.med)}  ${fi(pct(o.foeFall.n, o.fired))} ${fi(pct(o.selfFall.n, o.fired))}  ${o.handJump.count}/${o.handJump.overCtrl}/${o.handJump.maxShove.toFixed(3)}/${o.handJump.ctrlMax.toFixed(3)}  ${o.footOverlap.plantBox}/${o.footOverlap.plants} ${o.footOverlap.plantPenMax.toFixed(3)} | ${o.footOverlap.steps}/${o.footOverlap.inside}·${o.footOverlap.ctrlSteps}  ${o.unwanted}  ${o.clash.sound}/${o.clash.sparks}/${o.clash.hitStop}  ${o.wounds.dealt}/${o.wounds.taken}  ${o.cutWin.clinch ?? 'n/a'}/${o.cutWin.contact ?? 'n/a'}  ${Object.entries(o.ends).map(([k, v]) => `${k}:${v}`).join(' ')}${o.noFire.n ? `  (안 쏨 ${o.noFire.n}: 밂 때 닿는 거리 밖 ${o.noFire.outside}, 걸쇠 꺼짐 ${o.noFire.notArmed})` : ''}`,
    );
  }
  say('닿은 부위(스텝 %, 코등이/칼자루 나머지/팔뚝/칼날/몸통 (스텝 수)): on = 밀치는 동안, off = 끔 같은 칸 밂 단계 닿는 거리 안 · L 중앙 · 걸음 요청 · 손 튐 단계별 최대(발사 전/밀치는 중/되돌림)');
  const cf = (a) => `${a.crossguard ?? '-'}/${a.hilt ?? '-'}/${a.forearm ?? '-'}/${a.blade ?? '-'}/${a.torso ?? '-'} (${a.steps})`;
  for (const o of rows) {
    const h = o.handJump;
    say(`  ${o.cell.padEnd(34)} on ${cf(o.contact)}  off ${cf(o.contactCtrl)}  L ${o.L ? o.L.med : 'n/a'}  걸음 ${Object.entries(o.req).map(([k, v]) => `${k}:${v}`).join(' ')}  손 ${h.maxPre.toFixed(3)}/${h.maxBarge.toFixed(3)}/${h.maxRet.toFixed(3)}`);
  }
}

// ═════ 핵심 칸 + 덧칸 ═════
function modeCore() {
  const cells = [];
  for (const start of ['glued', 'walkin', 'bound', 'foewall', 'selfwall'])
    for (const foe of ['braced', 'backing']) for (const weapon of ['longsword', 'sabre', 'tree_branch']) cells.push({ id: `${start}/${foe}/${weapon}`, start, foe, weapon });
  cells.push({ id: 'plate:glued/braced/longsword', start: 'glued', foe: 'braced', weapon: 'longsword', plate: 'heinrich', extra: true });
  cells.push({ id: 'roof:glued/braced/longsword', start: 'glued', foe: 'braced', weapon: 'longsword', pad: ROOF, extra: true });
  cells.push({ id: 'mutual:glued/braced/longsword', start: 'glued', foe: 'braced', weapon: 'longsword', mutual: true, extra: true });
  cells.push({ id: 'bare:glued/braced/longsword', start: 'glued', foe: 'braced', weapon: 'longsword', disarm: true, extra: true });
  say(`[core] 칸 ${cells.length} (핵심 30 + 덧칸 4), 칸마다 N=${N} 시드 ${SEEDS.join(',')} · 대조군(CLOSE.on=false 같은 대본) ${NC}판 시드 ${SEEDS.slice(0, NC).join(',')}`);
  const rows = cells.map((c) => runCell({ ...c, hold: true }));
  // 튐 기준: 모든 칸 대조군(끔)의 한 스텝 최대 (오늘 규칙이 이 장면들에서 이미 내는 가장 큰 한 스텝)
  const pooled = Math.max(0, ...rows.map((o) => o.handJump.ctrlMax));
  for (const o of rows) {
    const js = o._dh.map((a) => spikes(a, pooled));
    Object.assign(o.handJump, { countCell: o.handJump.count, count: sum(js), rounds: js.filter((x) => x > 0).length, floor: +pooled.toFixed(4) });
    line(o);
  }
  say(`[core] 손 목표 튐 기준 (모든 칸 대조군의 한 스텝 최대) ${(pooled * 1000).toFixed(1)} mm`);
  if (!JSON_ONLY) coreTable(rows);
  return rows;
}

// ═════ 음성 칸 ═════
const c0 = (o) => o.cell === 'neg:outside_press'; // 밖에서 밂 칸: 밂 때 정말 밖이었나
function modeNeg() {
  const t0 = Date.now();
  const rows = [];
  const base = { start: 'glued', foe: 'braced', weapon: 'longsword' };
  const negCells = [
    { id: 'neg:thrust_tap', neg: 'thrust' },
    { id: 'neg:cut_push', neg: 'cut', pad: ROOF },
    { id: 'neg:outside_press', neg: 'outside', start: 'outside' },
    { id: 'neg:pistol', neg: 'pistol', weapon: 'pistol' },
    { id: 'neg:side_circle', neg: 'side' },
    { id: 'neg:foe_getup', neg: 'getup' },
    { id: 'neg:foe_kneel', neg: 'kneel' },
    { id: 'neg:back_pull', neg: 'back' },
    { id: 'info:thrust_hold', neg: 'thrust_hold', info: true }, // 톡 뒤에도 민 채 (설계상 톡이 걸쇠를 끄지 않으면 톡이 끝난 뒤 발사, 관문 아님)
    { id: 'info:thrust_during', neg: 'thrust_during', info: true }, // 밀치는 중 톡 → 끝난 까닭 (설계 위험 7)
  ];
  say(`[neg] 칸마다 N=${N} 시드 ${SEEDS.join(',')}`);
  for (const c of negCells) {
    const cell = { ...base, ...c };
    const rs = SEEDS.map((s) => runRound(cell, s, { on: true, ctrl: false }));
    const rP = reachW(cell.weapon, false);
    const o = { mode: 'neg', cell: c.id, n: rs.length, fires: sum(rs.map((r) => r.fires)), unwanted: c.info ? null : sum(rs.map((r) => r.unwanted)), dPress: qs(rs.map((r) => r.dPress).filter((x) => x != null)), outsideAtPress: rs.filter((r) => r.dPress != null && r.dPress > rP).length, startOk: rs.filter((r) => r.startOk).length, armedAtPress: rs.filter((r) => r.armedPress === true).length, ends: cnt(rs.filter((r) => r.fires).map((r) => r.end)) };
    if (c.neg === 'getup' || c.neg === 'kneel') o.afterStand = sum(rs.map((r) => r.afterStand || 0));
    line(o);
    rows.push(o);
  }
  // 감정 이동 배수: 발사 스텝(밂 시작부터 몇 스텝)이 1.0 과 같아야
  {
    const cell = { ...base, id: 'emo' };
    const by = {};
    for (const emv of [1, 0.75, 1.2]) by[emv] = SEEDS.map((s) => runRound({ ...cell, emv }, s, { on: true, ctrl: false }));
    // 비교는 세 판 모두 밂 때 닿는 거리 안이었던 시드만: 느린 발(0.75)로 붙다가 칼끼리 걸려 밖에서 민 판은
    //  안 쏘는 게 맞다 (규칙이 아니라 장면이 달라진 것). 뺀 시드는 excluded 로 적는다
    const rP = reachW(cell.weapon, false);
    const okSeed = (i) => [1, 0.75, 1.2].every((k) => by[k][i].dPress != null && by[k][i].dPress <= rP);
    const cmp = SEEDS.map((s, i) => i).filter(okSeed);
    const mism = cmp.filter((i) => by[0.75][i].fireOffset !== by[1][i].fireOffset || by[1.2][i].fireOffset !== by[1][i].fireOffset).length;
    const o = { mode: 'neg', cell: 'neg:emo_move_0.75_1.2', n: SEEDS.length, compared: cmp.length, excluded: SEEDS.filter((s, i) => !okSeed(i)), fires: { 1: sum(by[1].map((r) => r.fires)), 0.75: sum(by[0.75].map((r) => r.fires)), 1.2: sum(by[1.2].map((r) => r.fires)) }, offsets: { 1: by[1].map((r) => r.fireOffset), 0.75: by[0.75].map((r) => r.fireOffset), 1.2: by[1.2].map((r) => r.fireOffset) }, unwanted: mism + sum([0.75, 1.2, 1].map((k) => sum(by[k].map((r) => r.unwanted)))), mismatch: mism };
    line(o);
    rows.push(o);
  }
  // 민 채 쫓아가기: 기본 AI 상대, 1.25~3 m 에서 10~20 s 동안 스틱을 앞으로 (걸쇠가 켜질 틈이 없다)
  {
    const gaps = [1.25, 2, 3];
    const durs = [10, 15, 20];
    let fires = 0;
    let entries = 0;
    let tIn = 0;
    const per = [];
    for (const [i, s] of SEEDS.entries()) {
      if (HAS) CLOSE.on = true;
      const gap = gaps[i % 3];
      const dur = durs[Math.floor(i / 3) % 3];
      const G = mkRound({ seed: s, gap, walls: true });
      const P = G.player;
      const E = G.enemy;
      P.canShove = true;
      G.before = () => {
        slow(P.handOffset, PFLUG, 1.0);
        P.stickX = 0;
        P.stickY = P.alive ? 1 : 0;
        P.move.set(0, P.alive ? 1 : 0);
      };
      let sh0 = fired(P) ?? 0;
      let inside = false;
      let f = 0;
      let e = 0;
      for (let k = 0; k < Math.round(dur / DT); k++) {
        G.step();
        const sh = fired(P);
        if (sh != null && sh > sh0) (f += sh - sh0), (sh0 = sh);
        const both = P.state === 'stand' && E.state === 'stand';
        const inn = both && P.foeDistance() <= reachOf(P);
        if (inn && !inside) e++;
        if (inn) tIn += DT;
        inside = inn;
        if (!P.alive || !E.alive) break;
      }
      fires += f;
      entries += e;
      per.push({ s, gap, dur, fires: f, entries: e });
    }
    const o = { mode: 'neg', cell: 'neg:chase_stick_held', n: SEEDS.length, fires, unwanted: fires, entries, tInside: +tIn.toFixed(2), rounds: per };
    line(o);
    rows.push(o);
  }
  // 기본 AI 대 기본 AI (fights12 와 같은 차림, 20 s): 아무도 밀치지 않아야
  {
    let pf = 0;
    let ef = 0;
    let want = 0;
    for (const s of SEEDS) {
      if (HAS) CLOSE.on = true;
      const G = mkRound({ seed: s, rng: 'lcg', walls: true });
      G.player.skill.level = 0.7;
      G.ai2 = new AI(G.player, G.enemy, 'normal');
      for (let k = 0; k < Math.round(20 / DT); k++) {
        G.step();
        if (G.ai.closeWant || G.ai2.closeWant) want++;
      }
      pf += fired(G.player) ?? 0;
      ef += fired(G.enemy) ?? 0;
    }
    const o = { mode: 'neg', cell: 'neg:default_ai_vs_default_ai', n: SEEDS.length, fires: pf + ef, unwanted: pf + ef, pShoves: pf, eShoves: ef, closeWantSteps: want };
    line(o);
    rows.push(o);
  }
  if (!JSON_ONLY) {
    say('\n[음성 요약] 칸 | n | 발사 | 원치 않은 발사(0 이어야) | 밂 때 d 중앙 | 밂 때 걸쇠 켜짐 | 비고');
    for (const o of rows) say(`${o.cell.padEnd(30)} ${String(o.n).padStart(2)}  ${JSON.stringify(o.fires).padStart(6)}  ${String(o.unwanted ?? 'info').padStart(4)}  ${fx(o.dPress?.med)}  ${o.armedAtPress ?? ''}  ${o.afterStand != null ? `섬 뒤 발사 ${o.afterStand}` : ''}${o.entries != null ? `닿는 거리 들어섬 ${o.entries} (${o.tInside}s)` : ''}${o.outsideAtPress != null && c0(o) ? `밂 때 닿는 거리 밖 ${o.outsideAtPress}/${o.n} ` : ''}${o.offsets ? `비교 ${o.compared}/${o.n} (뺀 시드 ${o.excluded.join(',') || '-'}: 밂 때 닿는 거리 밖) 어긋남 ${o.mismatch} · 발사 스텝 1.0 ${o.offsets[1].join(',')} / 0.75 ${o.offsets[0.75].join(',')} / 1.2 ${o.offsets[1.2].join(',')}` : ''}${o.ends && Object.keys(o.ends).length ? ` 끝 ${JSON.stringify(o.ends)}` : ''}${o.closeWantSteps != null ? `closeWant 스텝 ${o.closeWantSteps}` : ''}`);
  }
  say(`[neg] ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  return rows;
}

// ═════ 우회 관문: 한 프로세스, 스텝마다 흔적 ═════
function traceRun(kind, on, seed) {
  if (HAS) CLOSE.on = on;
  trReset();
  let G;
  const recs = [];
  if (kind === 'glued') {
    // 칼끝을 내린 바보 자세(Alber, guards.js)로 걸어 붙는다: 쟁기끼리는 칼이 서로 걸려 1.1~1.25 m 에서 멈추는 판이 있다
    const gj = 0.1 * jit(seed, 1);
    const padP = [ALBER[0] + 0.06 * jit(seed, 2), ALBER[1] + 0.06 * jit(seed, 3)];
    const padE = [ALBER[0] + 0.06 * jit(seed, 4), ALBER[1] + 0.06 * jit(seed, 5)];
    G = mkRound({ seed, px: -(1.6 + gj) / 2, ex: (1.6 + gj) / 2, walls: false, AIClass: Puppet });
    const P = G.player;
    const E = G.enemy;
    P.canShove = true;
    let tG = null;
    // 붙기(둘 다 밂) → 스틱 0 1.5 s(걸쇠만 켜지고 밀지 않음) → 뒤로 당김 1 s(오늘의 shove) → 0
    G.before = (t) => {
      slow(P.handOffset, padP, 1.0);
      slow(E.handOffset, padE, 1.0);
      const d = P.foeDistance();
      let y = 0;
      let em = 0;
      if (t >= ARENA.startHold) {
        if (tG == null || t < tG + GLUE_HOLD) (y = 1), (em = 1);
        if (tG == null && d < GLUE_D) tG = t;
        if (tG != null && t >= tG + GLUE_HOLD + 1.5 && t < tG + GLUE_HOLD + 2.5) y = -1;
      }
      P.stickX = 0;
      P.stickY = P.alive ? y : 0;
      P.move.set(0, P.alive ? y : 0);
      E.move.set(0, em);
    };
  } else {
    G = mkRound({ seed, rng: 'lcg', walls: true }); // fights12 와 같은 차림 (기본 AI 둘, 인물 없음)
    G.player.skill.level = 0.7;
    G.ai2 = new AI(G.player, G.enemy, 'normal');
  }
  wrapGait(G.player, G);
  wrapGait(G.enemy, G);
  recs.push({ rn: TR.rn, rh: TR.rh, fn: TR.fn, fh: TR.fh, qn: TR.qn, qh: TR.qh, pos: null }); // 만들 때 (−1 스텝)
  const T = kind === 'glued' ? 7 : 30;
  let dMin = 9;
  let armed = 0;
  let inReach = 0;
  for (let i = 0; i < Math.round(T / DT); i++) {
    G.step();
    const dd = G.player.foeDistance();
    if (DEBUG === 'trace' && G.stepNo % 12 === 0) process.stderr.write(`${G.t.toFixed(1)}:${dd.toFixed(2)} `);
    dMin = Math.min(dMin, dd);
    if (dd <= reachOf(G.player)) inReach++;
    if (G.player.closeArmed || G.enemy.closeArmed) armed++;
    const pos = new Float64Array(12);
    let j = 0;
    for (const f of [G.player, G.enemy])
      for (const b of ['pelvis', 'chest']) {
        const p = f.bodies[b].translation();
        pos[j++] = p.x;
        pos[j++] = p.y;
        pos[j++] = p.z;
      }
    recs.push({ rn: TR.rn, rh: TR.rh, fn: TR.fn, fh: TR.fh, qn: TR.qn, qh: TR.qh, pos });
  }
  const h = createHash('sha256');
  for (const r of recs) {
    h.update(Float64Array.from([r.rn, r.rh, r.fn, r.fh, r.qn, r.qh]));
    if (r.pos) h.update(r.pos);
  }
  return { recs, sha: h.digest('hex').slice(0, 8), rn: TR.rn, fn: TR.fn, qn: TR.qn, shoves: [fired(G.player), fired(G.enemy)], steps: recs.length - 1, dMin: +dMin.toFixed(3), inReach, armed };
}
function traceDiff(a, b) {
  const n = Math.min(a.recs.length, b.recs.length);
  const names = ['rn', 'rh', 'fn', 'fh', 'qn', 'qh'];
  const label = { rn: 'Math.random 호출 수', rh: 'Math.random 값 해시', fn: '힘·충격량 호출 수', fh: '힘·충격량 해시', qn: 'requestStep 호출 수', qh: 'requestStep 해시' };
  const posName = ['P골반x', 'P골반y', 'P골반z', 'P가슴x', 'P가슴y', 'P가슴z', 'E골반x', 'E골반y', 'E골반z', 'E가슴x', 'E가슴y', 'E가슴z'];
  for (let i = 0; i < n; i++) {
    const x = a.recs[i];
    const y = b.recs[i];
    for (const k of names) if (x[k] !== y[k]) return `스텝 ${i - 1} (t=${((i - 1) * DT).toFixed(3)} s) ${label[k]}: ${x[k]} ≠ ${y[k]}`;
    if (x.pos) for (let j = 0; j < 12; j++) if (x.pos[j] !== y.pos[j]) return `스텝 ${i - 1} (t=${((i - 1) * DT).toFixed(3)} s) ${posName[j]}: ${x.pos[j]} ≠ ${y.pos[j]}`;
  }
  return a.recs.length === b.recs.length ? 'IDENTICAL' : `길이 다름 ${a.recs.length} ≠ ${b.recs.length}`;
}
function modeControl() {
  const t0 = Date.now();
  patchForces();
  const out = [];
  const scenes = [
    ['glued', 1],
    ['glued', 2],
    ['default_ai', 1],
    ['default_ai', 2],
  ];
  say(`[control] 한 프로세스 안: ${HAS ? 'CLOSE.on false → true → false (A/B/A)' : 'feature absent: 같은 장면 두 번 (A/A, 흔적 해시 = 전 숫자)'}. 장면: 붙은 채 아무도 안 밂(7 s, 시드 1·2), 기본 AI 대 기본 AI(fights12 차림 30 s, 시드 1·2)`);
  for (const [kind, seed] of scenes) {
    const A = traceRun(kind, false, seed);
    const B = HAS ? traceRun(kind, true, seed) : null;
    const A2 = traceRun(kind, false, seed);
    const o = { mode: 'control', scene: `${kind}/s${seed}`, steps: A.steps, AA: traceDiff(A, A2), AB: B ? traceDiff(A, B) : 'feature absent', shaOff: A.sha, shaOn: B?.sha ?? null, random: { off: A.rn, on: B?.rn ?? null }, forces: { off: A.fn, on: B?.fn ?? null }, requestStep: { off: A.qn, on: B?.qn ?? null }, shovesOn: B?.shoves ?? null, dMin: A.dMin, stepsInReach: A.inReach, armedStepsOn: B ? B.armed : null };
    line(o);
    out.push(o);
    if (!JSON_ONLY) say(`  ${o.scene.padEnd(16)} off/on: ${o.AB}  | off/off: ${o.AA}  | sha off ${o.shaOff} on ${o.shaOn ?? '-'} | Math.random ${o.random.off}/${o.random.on ?? '-'} · 힘 호출 ${o.forces.off}/${o.forces.on ?? '-'} · requestStep ${o.requestStep.off}/${o.requestStep.on ?? '-'} · 밀치기(on) ${JSON.stringify(o.shovesOn)} · 최소 d ${o.dMin} · 닿는 거리 안 스텝 ${o.stepsInReach} · 걸쇠 켜진 스텝(on) ${o.armedStepsOn ?? '-'}`);
  }
  say(`[control] ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  return out;
}

// ═════ 0절 기준표: persona.close 캐릭터 대 기본 AI ═════
function personaRound(ch, seed, on, opp) {
  if (HAS) CLOSE.on = on;
  const walker = opp === 'walker';
  // default: 기본 AI(보통, 인물 없음, 롱소드) 와 30 s. walker: 스틱을 앞으로 민 채 걸어 들어오는 꼭두각시(밀치지 않음, probe ai_window 차림) 와 15 s
  const G = mkRound(walker ? { seed, gap: 3.0, walls: true, difficulty: ch.ai.level, persona: ch.ai.persona, weapon2: ch.weapon, revive: ch.revive } : { seed, walls: true, difficulty: ch.ai.level, persona: ch.ai.persona, weapon2: ch.weapon, revive: ch.revive, AI2Class: AI, difficulty2: 'normal' });
  const P = G.player;
  const E = G.enemy; // 인물
  const ai = G.ai;
  if (walker)
    G.before = (t) => {
      slow(P.handOffset, PFLUG, 1.0);
      const y = t >= ARENA.startHold && P.alive && P.foeDistance() > 0.2 ? 1 : 0;
      P.stickX = 0;
      P.stickY = y;
      P.move.set(0, y);
    };
  let thenCut = 0;
  const sa = ai.startAttack?.bind(ai);
  if (sa)
    ai.startAttack = (tech, why, opt) => {
      if (why === 'shove') thenCut++;
      return sa(tech, why, opt);
    };
  const r = { tCl: 0, tIn: 0, entries: 0, binds: 0, bindsIn: 0, closeBind: 0, closeWant: 0, fallE: 0, fallP: 0 };
  let inside = false;
  let bound = false;
  let cb = false;
  let cw = false;
  let prevE = 'stand';
  let prevP = 'stand';
  let n = 0;
  for (let i = 0; i < Math.round((walker ? 15 : 30) / DT); i++) {
    G.step();
    n++;
    if (G.t >= ARENA.startHold) {
      const both = P.state === 'stand' && E.state === 'stand' && P.alive && E.alive;
      const d = E.foeDistance();
      const rE = reachOf(E);
      if (both && d < ai.M.clinch) r.tCl += DT;
      const inn = both && d <= rE;
      if (inn) r.tIn += DT;
      if (inn && !inside) r.entries++;
      inside = inn;
      const b = both && bladeBound(E, P);
      if (b && !bound) (r.binds++, inn && r.bindsIn++);
      bound = b;
      if (ai.closeBind && !cb) r.closeBind++;
      cb = !!ai.closeBind;
      if (ai.closeWant && !cw) r.closeWant++;
      cw = !!ai.closeWant;
    }
    if (prevE === 'stand' && (E.state === 'down' || E.state === 'getup')) r.fallE++;
    if (prevP === 'stand' && (P.state === 'down' || P.state === 'getup')) r.fallP++;
    prevE = E.state;
    prevP = P.state;
    if (!P.alive || !E.alive) break;
  }
  const res = !E.alive && !P.alive ? 'draw' : !P.alive ? 'E' : !E.alive ? 'P' : 'time';
  return { ...r, eShoves: fired(E), pShoves: fired(P), thenCut, res, dur: +(n * DT).toFixed(2), canShove: E.canShove ?? null, clinchM: ai.M.clinch, reach: reachW(ch.weapon, false) };
}
function modePersona() {
  const t0 = Date.now();
  const chars = [...CHARACTERS, ...CHARACTER_VARIANTS].filter((c) => c.ai?.persona?.close);
  const flags = HAS ? [false, true] : [null];
  say(`[persona] persona.close 캐릭터 ${chars.map((c) => c.id).join(',')} 대 기본 AI(보통, 롱소드, 30 s) · 대 걸어 들어오는 꼭두각시(롱소드, 3 m 에서, 15 s), 벽 있음, N=${PN} 시드 ${PSEEDS.join(',')} · ${HAS ? 'CLOSE.on false / true' : 'feature absent: 오늘 값만 (닿는 거리는 설계 식 0.53 + 0.11 + hiltLength)'}`);
  const rows = [];
  for (const opp of ['default', 'walker'])
  for (const ch of chars) {
    for (const on of flags) {
      const rs = PSEEDS.map((s) => personaRound(ch, s, on, opp));
      const per = (k) => +(sum(rs.map((x) => x[k] ?? 0)) / rs.length).toFixed(2);
      const o = {
        mode: 'persona',
        opp,
        char: ch.id,
        close: ch.ai.persona.close,
        weapon: ch.weapon,
        on,
        n: rs.length,
        seeds: PSEEDS,
        clinchM: +rs[0].clinchM.toFixed(3),
        reach: +rs[0].reach.toFixed(3),
        perRound: { tClinch: per('tCl'), tReach: per('tIn'), entries: per('entries'), binds: per('binds'), bindsInReach: per('bindsIn'), closeBind: HAS ? per('closeBind') : 'n/a', closeWant: HAS ? per('closeWant') : 'n/a', shoves: rs[0].eShoves == null ? 'n/a' : per('eShoves'), thenCut: per('thenCut'), fallE: per('fallE'), fallP: per('fallP'), dur: per('dur') },
        pShoves: rs[0].pShoves == null ? 'n/a' : sum(rs.map((x) => x.pShoves)),
        canShove: rs[0].canShove,
        res: cnt(rs.map((x) => x.res)),
      };
      line(o);
      rows.push(o);
    }
  }
  if (!JSON_ONLY) {
    say('\n[0절 표] 상대 | 캐릭터 | CLOSE.on | 판당: d<M.clinch 시간 s | d≤닿는 거리 시간 s | 들어섬 | 칼 맞물림(닿는 거리 안) | closeBind | closeWant | 밀치기 | 이어 벰 | 넘어짐 인물/상대 | 판 길이 s | 상대 밀치기 | canShove | 결과');
    for (const o of rows) {
      const p = o.perRound;
      say(`${o.opp.padEnd(8)} ${o.char.padEnd(13)} ${String(o.on ?? 'absent').padEnd(6)} ${fx(p.tClinch)} ${fx(p.tReach)} ${fx(p.entries)} ${fx(p.binds)}(${fx(p.bindsInReach, 4)}) ${fx(p.closeBind)} ${fx(p.closeWant)} ${fx(p.shoves)} ${fx(p.thenCut)} ${fx(p.fallE, 4)}/${fx(p.fallP, 4)} ${fx(p.dur)} ${String(o.pShoves).padStart(4)} ${String(o.canShove).padStart(5)}  ${JSON.stringify(o.res)}`);
    }
  }
  say(`[persona] ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  return rows;
}

// ═════ 실행 ═════
const T0 = Date.now();
say(`shove_check: ${HAS ? `feature present (CLOSE.on 기본 ${ON0}, CLOSE.reach(롱소드) ${reachW('longsword').toFixed(3)} m)` : 'feature absent (src 에 CLOSE 없음)'} · 모드 ${modes.join(',')} · N=${N} · 인물 N=${PN}${QUICK ? ' (--quick)' : ''}`);
for (const m of modes) {
  if ((m === 'core' || m === 'neg') && !HAS && !TODAY) {
    say(`[${m}] feature absent: 건너뜀 (--today 면 오늘 값으로 칸만 돈다)`);
    if (m === 'core' && !modes.includes('control')) modeControl();
    if (m === 'core' && !modes.includes('persona')) modePersona();
    continue;
  }
  const t = Date.now();
  if (m === 'core') modeCore();
  else if (m === 'neg') modeNeg();
  else if (m === 'control') modeControl();
  else if (m === 'persona') modePersona();
  say(`[${m}] 걸린 시간 ${((Date.now() - t) / 1000).toFixed(0)} s`);
}
if (HAS) CLOSE.on = ON0;
say(`[전체] ${((Date.now() - T0) / 1000).toFixed(0)} s`);
