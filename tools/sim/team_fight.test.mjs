// 동시 대전 1단계 배관 (10/29 — 사장님 14:2x 생사전 2:2 · docs/strike/team_fight_2026-10-29.md · src/team.js · src/match.js):
//  ① 1:1 의 충돌 비트가 예전 식(자리 0 · 1 = 몸 2 · 8, 칼 4 · 16, 발 64 · 128, 몸통 256 · 512, 칼팔 1024 · 2048) 그대로
//  ② 2:2 에서 같은 편끼리는 어떤 콜라이더도 엔진 거름(구성원 & 거름 양쪽)을 못 넘고, 상대 편끼리는 몸 ↔ 몸 · 칼 ↔ 몸 · 칼 ↔ 칼 · 칼 ↔ 발이 넘는다 · 날아간 투구 비트 32 와 안 겹침
//  ③ sameSide · pairOf 가 같은 편 쌍을 버림 · 칼 쌍 묶기(groupBlades)가 싸움꾼 짝마다 · 들어온 차례 · AI setFoe 가 눈 · 간격 어림을 맞바꾸고 시계가 같음
//  ④ 시작 자리: 1:1 은 newRound 자리 그대로 · 2:2 는 편마다 옆으로 mateGap
//  ⑤ ~ ⑧ (2단계): 상대 고르기 규칙(가짜 몸 — 거리 · 쓰러짐 · 나눠 맡기 · 나를 침 · 기다림 · 붙잡힘 · 죽음 · 취향) · 편 전멸 · 결과 · 상대를 아는 반응 시간 · 상대마다 몫 맞바꿈
//  ⑨ (3단계): 죽은 몸 쉬게 하기(settleDead — 셋 이상 판만 · 1:1 은 그대로) · 카메라 물러남 몫(team_hud.js teamFramePull)
//  node --test tools/sim/team_fight.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newMatch, CONFIG } from './jelly_harness.mjs';
import { sameSide, teamOfIndex } from '../../src/team.js';
import { spawnSpots, orderControllers, pairFoe, standing, matchResult } from '../../src/match.js';
import { teamFramePull, HP_COLORS, TEAM_COLORS } from '../../src/team_hud.js';
import { shortNameOf, SHORT_NAMES } from '../../src/short_names.js';
import { hexToOklch } from '../../src/oklch.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
import { chooseTarget, targetScore, committed } from '../../src/targeting.js';

const mem = (g) => g >>> 16;
const filt = (g) => g & 0xffff;
const meets = (a, b) => (mem(a) & filt(b)) !== 0 && (mem(b) & filt(a)) !== 0; // Rapier InteractionGroups.test
const bodyCols = (f) => Object.entries(f.bodies).map(([k, rb]) => [k, rb.collider(0)]);
const swordCols = (f) => f.swordColliders.map((c) => ['weapon', c]);

/** 예전(10/29 전) fighter.js 의 비트 식 — 자리 i 의 부위 이름 → 그룹 */
function legacyGroups(i, part) {
  const groups = (m, f) => (m << 16) | f;
  const bodyBit = (k) => (k === 0 ? 2 : 8), weaponBit = (k) => (k === 0 ? 4 : 16), footBit = (k) => (k === 0 ? 64 : 128);
  const torsoBit = (k) => (k === 0 ? 256 : 512), armSBit = (k) => (k === 0 ? 1024 : 2048);
  const myBody = bodyBit(i), otherBody = bodyBit(1 - i), otherWeapon = weaponBit(1 - i);
  const HL = CONFIG.BODY.humanLimits;
  if (part === 'weapon') return HL ? groups(weaponBit(i), 1 | otherBody | otherWeapon | footBit(1 - i) | torsoBit(i)) : groups(weaponBit(i), 1 | otherBody | otherWeapon | footBit(1 - i));
  if (part.startsWith('foot')) return groups(footBit(i), 1 | otherWeapon);
  if (HL && ['pelvis', 'abdomen', 'chest', 'thighF', 'thighB'].includes(part)) return groups(myBody | torsoBit(i), 1 | otherBody | otherWeapon | weaponBit(i) | armSBit(i));
  if (HL && (part === 'uarmS' || part === 'farmS')) return groups(myBody | armSBit(i), 1 | otherBody | otherWeapon | torsoBit(i));
  return groups(myBody, 1 | otherBody | otherWeapon);
}

test('① 1:1 충돌 비트 = 예전 식 그대로 (편 = 자리 번호)', () => {
  const G = newMatch({ seed: 1 });
  for (const f of G.fighters) {
    assert.equal(f.team, f.index);
    assert.equal(f.human, f.index === 0);
    for (const [part, c] of [...bodyCols(f), ...swordCols(f)]) assert.equal(c.collisionGroups(), legacyGroups(f.index, part), `${f.name} ${part}`);
  }
});

test('② 2:2 같은 편도 적과 똑같이 부딪힌다 (ffa — 사장님 10/29 22:3x) · 제 몸끼리만 지나감 · 16 비트 안 · 투구 비트 32 와 안 겹침', () => {
  const G = newMatch({ count: 4, ai: 'all', seed: 1 });
  const F = G.fighters;
  assert.deepEqual(F.map((f) => f.team), [0, 1, 0, 1]);
  const HELMET = (32 << 16) | 1; // fighter.js knockOffHelmet
  let mates = 0;
  const foes = { bodyBody: 0, swordBody: 0, swordSword: 0, swordFoot: 0, footBody: 0 };
  for (const a of F) {
    for (const [, c] of [...bodyCols(a), ...swordCols(a)]) {
      const g = c.collisionGroups();
      assert.ok(mem(g) <= 0xffff && mem(g) !== 0);
      assert.equal(mem(g) & 32, 0, `${a.name}: 투구 비트`);
      assert.equal(meets(g, HELMET), false, `${a.name}: 날아간 투구와 부딪힘`);
    }
    for (const b of F) {
      if (b.index <= a.index) continue;
      for (const [pa, ca] of [...bodyCols(a), ...swordCols(a)]) for (const [pb, cb] of [...bodyCols(b), ...swordCols(b)]) {
        const hit = meets(ca.collisionGroups(), cb.collisionGroups());
        if (a.team === b.team) mates++; // 같은 편도 아래 적 규칙 그대로
        const ka = pa === 'weapon' ? 'sword' : pa.startsWith('foot') ? 'foot' : 'body';
        const kb = pb === 'weapon' ? 'sword' : pb.startsWith('foot') ? 'foot' : 'body';
        const k = [ka, kb].sort().join('');
        if (k === 'bodybody') { assert.ok(hit, `${a.name}.${pa} ↔ ${b.name}.${pb}`); foes.bodyBody++; }
        if (k === 'bodysword') { assert.ok(hit); foes.swordBody++; }
        if (k === 'swordsword') { assert.ok(hit); foes.swordSword++; }
        if (k === 'footsword') { assert.ok(hit); foes.swordFoot++; }
        if (k === 'bodyfoot') { assert.equal(hit, false); foes.footBody++; }
      }
    }
  }
  assert.ok(mates > 0 && Object.values(foes).every((n) => n > 0));
  // 제 몸끼리: 몸 ↔ 몸 · 칼 ↔ 발 · 칼 ↔ 팔다리는 지나감 · 칼 ↔ 제 몸통 · 칼팔 ↔ 제 몸통만 (BODY.humanLimits)
  const HL = CONFIG.BODY.humanLimits;
  for (const f of F) {
    const torso = new Set(['pelvis', 'abdomen', 'chest', 'thighF', 'thighB']);
    for (const [pa, ca] of bodyCols(f)) {
      for (const [pb, cb] of bodyCols(f)) {
        if (pa >= pb) continue;
        const want = HL && ((torso.has(pa) && (pb === 'uarmS' || pb === 'farmS')) || (torso.has(pb) && (pa === 'uarmS' || pa === 'farmS')));
        assert.equal(meets(ca.collisionGroups(), cb.collisionGroups()), want, `${f.name} 제 몸 ${pa} ↔ ${pb}`);
      }
      for (const [, cw] of swordCols(f)) assert.equal(meets(ca.collisionGroups(), cw.collisionGroups()), HL && torso.has(pa), `${f.name} 제 칼 ↔ ${pa}`);
    }
  }
  // 남의 칼 비트 (mordschlag · revive 가 읽는다) = 나 빼고 모두의 칼
  for (const f of F) assert.equal(f.bits.foeWeapon, F.filter((g) => g !== f).reduce((m, g) => m | mem(g.swordColliders[0].collisionGroups()), 0));
  // ffa 끔(전후 비교 — newMatch ffa:false): 예전 편 비트 — 같은 편은 지나감
  const O = newMatch({ count: 4, ai: 'all', seed: 1, ffa: false }).fighters;
  assert.equal(meets(O[0].bodies.chest.collider(0).collisionGroups(), O[2].bodies.chest.collider(0).collisionGroups()), false);
  assert.equal(meets(O[0].swordColliders[0].collisionGroups(), O[2].bodies.chest.collider(0).collisionGroups()), false);
  assert.ok(meets(O[0].swordColliders[0].collisionGroups(), O[3].bodies.chest.collider(0).collisionGroups()));
});

test('③ sameSide(겨눔만) · pairOf(제 몸만 버림) · 칼 쌍 묶기 · AI setFoe', () => {
  const G = newMatch({ count: 4, ai: 'all', seed: 2 });
  const [P, E, P2, E2] = G.fighters;
  assert.ok(sameSide(P, P2) && sameSide(E, E2) && sameSide(P, P) && !sameSide(P, E) && !sameSide(P2, E));
  assert.equal(sameSide(null, P), false);
  const fake = {};
  assert.ok(sameSide(fake, fake) && !sameSide(fake, {})); // 편 없는 가짜 몸: 같은 몸일 때만 (예전 a === b)
  const C = G.combat;
  assert.ok(C.pairOf(P.swordColliders[0].handle, P2.bodies.chest.collider(0).handle), '같은 편 칼 → 몸 (같은 편도 벤다 — 사장님 10/29 22:3x)');
  assert.ok(C.pairOf(P.swordColliders[0].handle, E2.bodies.chest.collider(0).handle), '상대 편 칼 → 몸');
  assert.equal(C.pairOf(P.swordColliders[0].handle, P.bodies.chest.collider(0).handle), null, '제 칼 → 제 몸');
  const w = (f, k = 0) => f.swordColliders[k].handle;
  const groups = C.groupBlades([[w(P2), w(E2)], [w(P), w(E)], [w(P2, 1), w(E2)], [w(P, 1), w(E)]]);
  assert.deepEqual(groups.map((g) => g.key), [2 * 4 + 3, 0 * 4 + 1], '들어온 차례');
  assert.deepEqual(groups.map((g) => g.pairs.length), [2, 2]);
  assert.equal(groups[1].A.fighter, P);
  assert.equal(C.groupBlades([[w(P), w(E)], [w(P, 1), w(E)]]).length, 1, '1:1 은 한 짝');
  // AI: 판 시작에 상대 편 둘을 적고, 바꾸면 눈 · 간격 어림이 맞바뀐다 (시계 같음)
  const ai = G.ais[0];
  assert.equal(ai.foe, E);
  for (let i = 0; i < 30; i++) G.step();
  const sE = ai.sense;
  ai.foeReach = 9.5;
  ai.setFoe(E2);
  assert.equal(ai.foe, E2);
  assert.notEqual(ai.sense, sE);
  assert.equal(ai.sense.foe, E2);
  assert.equal(ai.sense.t, sE.t, '같은 시계');
  assert.notEqual(ai.foeReach, 9.5);
  ai.setFoe(E);
  assert.equal(ai.sense, sE);
  assert.equal(ai.foeReach, 9.5);
  ai.setFoe(E); // 같은 상대: 아무 일 없음
  assert.equal(ai.sense, sE);
  // 1:1 AI 는 기록이 없다 (예전 길 그대로)
  const G1 = newMatch({ ai: [1, 0], seed: 1 });
  assert.equal(G1.ais[1].foeRecs, undefined);
  assert.equal(G1.ais[0].foeRecs, undefined);
});

test('④ 시작 자리 · 조종 차례 · 기본 상대', () => {
  const gap = CONFIG.ARENA.startGap;
  assert.deepEqual(spawnSpots(2, { gap, mateGap: 1 }).map(({ x, z, heading }) => [x, z, heading]), [[-gap / 2, 0, 0], [gap / 2, 0, Math.PI]]);
  const s4 = spawnSpots(4, { gap, mateGap: 1.6 });
  assert.deepEqual(s4.map((s) => s.team), [0, 1, 0, 1]);
  assert.deepEqual(s4.map((s) => s.z), [-0.8, -0.8, 0.8, 0.8]);
  const s3 = spawnSpots(3, { gap, mateGap: 1.6 });
  assert.deepEqual(s3.map((s) => s.z), [-0.8, 0, 0.8]);
  assert.deepEqual([0, 1, 2, 3].map(teamOfIndex), [0, 1, 0, 1]);
  const me = (index, team, human = false) => ({ me: { index, team, human } });
  assert.deepEqual(orderControllers([me(0, 0, true), me(1, 1)]).map((c) => c.me.index), [1, 0], '1:1 — 상대 AI 먼저 (fights12)');
  assert.deepEqual(orderControllers([me(0, 0, true), me(1, 1), me(2, 0), me(3, 1)]).map((c) => c.me.index), [1, 3, 2, 0], '1 편 → 0 편 → 사람 맨 뒤');
  const G = newMatch({ count: 4, ai: 'all', seed: 3 });
  const F = G.fighters;
  assert.deepEqual(F.map((f) => pairFoe(f, G).index), [1, 0, 3, 2]);
  assert.deepEqual(standing(G), [2, 2]);
  assert.equal(CONFIG.TEAM_FIGHT.mateGap > 0, true);
});

// ── 2단계 ──
/** 가짜 몸 (상대 고르기 규칙만 — 가슴 자리 · 편 · 상태 · 조종) */
function fake(index, team, x, z, extra = {}) {
  const p = { x, y: 1.3, z };
  return { index, team, alive: true, state: 'stand', revival: null, foe: null, pos: p, bodies: { chest: { translation: () => p } }, wounds: [], limbs: {}, blood: 1, ...extra };
}
const fakeMatch = (F) => ({ fighters: F });
const pick = (M, f, dt = 0) => (f.foe = chooseTarget(f, M, dt));

test('⑤ 상대 고르기: 가까움 · 같으면 작은 자리 · 쓰러짐 · 나눠 맡기 · 나를 침 · 기다림 · 붙잡힘 · 죽음 · 취향', () => {
  const T = CONFIG.TEAM_FIGHT.target;
  const me = fake(0, 0, 0, 0), e1 = fake(1, 1, 2, 0), e3 = fake(3, 1, 0, 2), mate = fake(2, 0, 0, -1);
  const M = fakeMatch([me, e1, mate, e3]);
  assert.equal(pick(M, me), e1, '같은 거리면 작은 자리');
  e3.pos.z = 1.9;
  assert.equal(targetScore(M, me, e3) < targetScore(M, me, e1), true);
  assert.equal(pick(M, me, 0.01), e1, '0.1 m 차 — margin 안이라 그대로');
  // 쓰러진 상대: 다른 상대가 downNear 안에 서 있으면 + downAdd
  e1.state = 'down';
  assert.equal(targetScore(M, me, e1), 2 + T.downAdd);
  e3.pos.z = 5; // 3 m 밖
  assert.equal(targetScore(M, me, e1), 2);
  e1.state = 'stand';
  // 나눠 맡기: 같은 편이 겨눈 상대 + allyAdd
  mate.foe = e1;
  assert.equal(targetScore(M, me, e1), 2 + T.allyAdd);
  mate.foe = null;
  // 기다림: 1.0 m 더 낮은 후보 — hold 동안 이어져야 바꿈
  e3.pos.z = 1.0;
  let t = 0;
  while (me.foe === e1 && t < 5) (t += 0.05), pick(M, me, 0.05);
  assert.equal(me.foe, e3);
  assert.ok(Math.abs(t - T.hold) <= 0.051, `hold ${t}`);
  // 붙잡힘(공격 꼴)이면 안 바꿈
  e1.pos.x = 0.5;
  me.aiCtl = { mode: 'attack' };
  assert.ok(committed(me));
  for (let i = 0; i < 100; i++) pick(M, me, 0.05);
  assert.equal(me.foe, e3, '붙잡힘 동안 그대로');
  // 죽으면 붙잡혀 있어도 곧장
  e3.alive = false;
  assert.equal(pick(M, me, 0.01), e1);
  me.aiCtl = null;
  e3.alive = true;
  e3.pos.z = 1.0;
  e1.pos.x = 2;
  // 나를 치는 상대: hold 를 기다리지 않음 (− attackSub) — attackHold(2877) 동안 내리 치면 · 멈추면 0 부터
  pick(M, me, 0); // 지금 e1 · 후보 e3 (1.0 대 2.0 — margin 넘음, 기다리는 중)
  const st = M.targeting.get(me);
  e3.foe = me;
  e3.aiCtl = { mode: 'attack', M: { reach: 1.5 } };
  const half = Math.round(T.attackHold / 2 / 0.01);
  for (let i = 0; i < half; i++) pick(M, me, 0.01);
  e3.aiCtl = { mode: 'probe', M: { reach: 1.5 } }; // 한 번 멈춤
  pick(M, me, 0.01);
  st.held = 0; // (기다림 hold 로 바뀌지 않게 — 여기선 '나를 침' 문턱만 본다)
  e3.aiCtl = { mode: 'attack', M: { reach: 1.5 } };
  let ta = 0;
  while (me.foe !== e3 && ta < 1) (ta += 0.01), pick(M, me, 0.01);
  assert.equal(me.foe, e3, '나를 치는 상대로');
  assert.ok(T.attackHold > 0 ? Math.abs(ta - T.attackHold) <= 0.0101 : ta <= 0.0101, `attackHold ${ta} (멈추면 0 부터)`);
  assert.ok(ta < T.hold);
  assert.equal(st.why.attacked, 1);
  // 취향 갈고리: weakest — 다친 상대에 덧셈 (− prefAdd × 다친 정도)
  const s0 = targetScore(M, me, e1);
  me.targetPref = 'weakest';
  e1.blood = 0.45; // VITALS.collapseBlood 까지 잃음 → 다친 정도 1
  assert.equal(+(s0 - targetScore(M, me, e1)).toFixed(6), T.prefAdd);
  me.targetPref = null;
});

test('⑥ 편 전멸 = 판 끝 · 결과 (자리마다 alive · blood · wounds · causeOfDeath)', () => {
  const G = newMatch({ count: 3, ai: 'all', seed: 4 });
  assert.equal(G.over, false);
  G.step();
  assert.equal(G.over, false);
  G.fighters[1].die('시험');
  G.step();
  assert.equal(G.over, true);
  assert.equal(G.winner, 0);
  const R = matchResult(G);
  assert.equal(R.over, true);
  assert.equal(R.fighters.length, 3);
  assert.deepEqual(R.fighters.map((r) => r.alive), [true, false, true]);
  assert.equal(R.fighters[1].causeOfDeath, '시험');
  for (const r of R.fighters) assert.ok(typeof r.blood === 'number' && Array.isArray(r.wounds) && 'causeOfDeath' in r);
  // 1:1 도 같은 규칙 (읽기만)
  const G1 = newMatch({ ai: [1, 0], seed: 1 });
  G1.enemy.die('시험');
  G1.step();
  assert.equal(G1.over, true);
  assert.equal(G1.winner, 0);
});

test('⑦ 상대를 아는 반응 시간: 상대를 바꾸면 새 상대의 face s 전 자리부터 (옛 상대 쪽으로 안 돎)', () => {
  const G = newMatch({ count: 4, ai: 'all', seed: 5 });
  const [P, E, , E2] = G.fighters;
  for (let i = 0; i < 60; i++) G.step();
  assert.ok(P.foes.includes(E) && P.foes.includes(E2));
  P.foe = E2;
  const tg = P.reactTarget(1 / 120);
  const q = E2.bodies.pelvis.translation(), o = E.bodies.pelvis.translation();
  assert.ok(Math.hypot(tg.x - q.x, tg.z - q.z) < 0.3, '새 상대 자리 근처');
  assert.ok(Math.hypot(tg.x - o.x, tg.z - o.z) > 1.0, '옛 상대 자리 아님');
  // 1:1 은 예전 기록 (상대 목록 없음)
  const G1 = newMatch({ ai: [1, 0], seed: 1 });
  assert.equal(G1.player.foes, undefined);
  assert.equal(G1.player.mates, undefined);
});

test('⑧ AI 상대마다 몫 맞바꿈 (위협 걸쇠 · 몰아침 · 고노센 경계) · 그 상대와만의 셈은 0', () => {
  const G = newMatch({ count: 4, ai: 'all', seed: 6 });
  const ai = G.ais[0];
  const [, E, , E2] = G.fighters;
  for (let i = 0; i < 30; i++) G.step();
  assert.equal(ai.foe, E);
  Object.assign(ai, { threatId: 5, threatSeen: 5, foeAggro: 0.7, preArmed: false, gnsW: { mark: 1 }, combo: 2 });
  ai.setFoe(E2);
  assert.deepEqual([ai.threatId, ai.threatSeen, ai.foeAggro, ai.preArmed, ai.gnsW, ai.combo], [0, -1, 0, true, undefined, 0]);
  ai.setFoe(E);
  assert.deepEqual([ai.threatId, ai.threatSeen, ai.foeAggro, ai.preArmed, ai.gnsW.mark, ai.combo], [5, 5, 0.7, false, 1, 0]);
});

test('⑨ 죽은 몸 쉬게 하기 (셋 이상 판만) · 카메라 물러남 몫', () => {
  const G = newMatch({ count: 4, ai: 'all', seed: 6 });
  const dead = G.fighters[3];
  let stepped = 0;
  const step0 = dead.step.bind(dead);
  dead.step = (dt) => (stepped++, step0(dt));
  dead.die('시험');
  const D = CONFIG.TEAM_FIGHT.deadSettle;
  let n = 0;
  while (!dead.settled && n < 3000) G.step(), n++;
  assert.equal(dead.settled, true, '죽은 몸이 쉬지 않음');
  assert.ok(n * CONFIG.PHYSICS.timestep >= D.t - 1e-9, `너무 일찍 쉼 (${n} 스텝)`);
  assert.ok(Object.values(dead.bodies).every((b) => b.isSleeping()));
  const before = stepped;
  for (let i = 0; i < 30; i++) G.step();
  assert.equal(stepped, before, '쉬는 몸이 스텝을 탐');
  assert.ok(G.fighters.slice(0, 3).every((f) => !f.settled));
  // 1:1 은 예전 그대로 (쉬지 않음)
  const G1 = newMatch({ ai: [1, 0], seed: 1 });
  G1.enemy.die('시험');
  for (let i = 0; i < 400; i++) G1.step();
  assert.equal(G1.enemy.settled, undefined);
  // 카메라 물러남: 보는 몸 (0, 0) · 바라보는 쪽 +x · 화면 비 2.16 (844 × 390)
  const fake = (x, z, alive = true) => ({ alive, pelvisPos: { x, z }, bodies: { pelvis: { translation: () => ({ x, y: 1, z }) } } });
  const me = fake(0, 0);
  const dir = { x: 1, z: 0 };
  const pull = (others, aspect = 2.16) => teamFramePull(me, [me, ...others], dir, aspect);
  assert.deepEqual(pull([fake(3, 0)]), { back: 0, up: 0 }); // 앞의 상대 — 이미 화면 안
  assert.ok(Math.abs(pull([fake(-2, 0)]).back - (CONFIG.TEAM_FIGHT.cam.minDepth - (CONFIG.CAMERA.back - 2))) < 1e-9); // 뒤의 몸 — 카메라 앞 minDepth 까지
  assert.equal(pull([fake(-2, 0, false)]).back, 0); // 죽은 몸은 안 봄
  assert.equal(pull([fake(-7.5, 0)]).back, 0); // radius 밖은 안 봄
  assert.equal(pull([fake(-6, 0)]).back, CONFIG.TEAM_FIGHT.cam.max); // 카메라 뒤 멀리 — max 까지만
  const side = pull([fake(0.5, 6)]).back; // 옆 — 화면 가로 반폭에 들게
  assert.ok(side > 1 && side < CONFIG.TEAM_FIGHT.cam.max, String(side));
  assert.ok(pull([fake(0.5, 6)], 1).back > side); // 좁은 화면이면 더 물러남
  assert.ok(Math.abs(pull([fake(-2, 0)]).up - pull([fake(-2, 0)]).back * CONFIG.TEAM_FIGHT.cam.upK) < 1e-12);
});

test('⑩ 체력 목록 짧은 이름 (사장님 10/30 01:0x — 얼터 A.) · 막대 색', () => {
  const S = (id) => shortNameOf(CHARACTERS_BY_ID[id]);
  assert.deepEqual(['isolde', 'bernardo', 'samira', 'liao', 'white_scale', 'minami'].map(S), ['이졸데', '베르나르도', '마야', '랴오', '백귀', '미나미']); // 백린의 전사 = 백귀 (사장님 10/30 18:3x)
  assert.deepEqual(['minami_mad', 'bran_mad', 'heinrich_mad'].map(S), ['A.미나미', 'A.브론', 'A.하인리히']);
  for (const [id, c] of Object.entries(CHARACTERS_BY_ID)) {
    const n = S(id);
    assert.ok(n && !n.includes(' ') && n.length <= 8, `${id}: '${n}'`); // 한 낱말 · 짧음
    if (!c.mad) assert.ok(c.name.startsWith(n) || SHORT_NAMES[id], `${id}: ${c.name} → ${n}`);
  }
  const names = Object.keys(CHARACTERS_BY_ID).map(S);
  assert.equal(new Set(names).size, names.length, '짧은 이름이 겹치지 않음 (본캐 · 얼터 갈림)');
  assert.deepEqual(HP_COLORS, ['#10561a', '#792820']); // 사장님 10/30 02:0x: 적 = 피 색 #8a0000 의 OKLCH 채도만 × 0.7 · 아군 = 같은 밝기 · 채도의 녹색(145°)
  assert.equal(HP_COLORS[1], TEAM_COLORS[1]); // 머리 위 세모 · 화면 밖 화살표도 같은 적 색
  const [Lb, Cb, hb] = hexToOklch(0x8a0000);
  const [Lf, Cf, hf] = hexToOklch(parseInt(HP_COLORS[1].slice(1), 16));
  const [La, Ca, ha] = hexToOklch(parseInt(HP_COLORS[0].slice(1), 16));
  assert.ok(Math.abs(Lf - Lb) < 0.005 && Math.abs(hf - hb) < 2 && Math.abs(Cf / Cb - 0.7) < 0.03, `적 = 피 색 채도만 낮춤 ${[Lf, Cf, hf]}`);
  assert.ok(Math.abs(La - Lf) < 0.005 && Math.abs(Ca - Cf) < 0.006 && Math.abs(ha - 145) < 2, `아군 = 같은 밝기 · 채도 녹색 ${[La, Ca, ha]}`);
});
