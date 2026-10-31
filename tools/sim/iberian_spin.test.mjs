// 이베리아 비기 '휘감아 돌기 (싱지르)' 시험 (10/22 — src/iberian_spin.js · secret.js PlayerSecretWatch spinTick · docs/strike/iberian_spin_2026-10-22.md)
//  node --test tools/sim/iberian_spin.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, DT, AI } from './harness_m.mjs';
import { SECRET, SKILL, JOINTS, ARENA, realS } from '../../src/config.js'; // realS: 표준 시간(10/25) — 무장 1.5 s 는 실제 초
import { TRADITIONS } from '../../src/schools.js';
import { PlayerSecretWatch } from '../../src/secret.js';
import { spinProgress, spinRate } from '../../src/iberian_spin.js';
import * as D from '../../src/skill_tree_data.js';

/** 손목 값을 잠깐 바꿔 fn (10/24 17:2x 팔꿈치 돌림 · 손목 교정 · 손목 치우침 밧줄 — 몸이 만들어질 때 밧줄을 거니 판을 만들기 전에) */
const withJoints = async (vals, fn) => {
  const old = {};
  for (const k of Object.keys(vals)) {
    old[k] = JOINTS[k];
    JOINTS[k] = vals[k];
  }
  try {
    return await fn();
  } finally {
    Object.assign(JOINTS, old);
  }
};
const WRIST_OLD = { elbowSwivel: 0, wristGuard: 0 }; // 10/24 17:2x 전 판 (옛 결함을 다시 보이는 판)
// 손목 치우침 밧줄(JOINTS.wristRope)을 켜면 어긋나는 대본 판 둘 — 아래 '한 바퀴'(2.2 m 과녁 가로 베기) · '발디딤'(플랑베르주 곧은 입력 도는 동안 두 발 엇갈림).
//  대본 · 걸음 기계를 보는 시험이라 밧줄 없이 본다 — 밧줄 판의 어긋남은 docs/strike/wrist_audit_2026-10-24.md §9 에 숫자와 함께 여쭘 (값은 안 고침)
const NO_ROPE = { wristRope: 0 };
const setup = (P) => {
  P.skill.corr = SKILL.corr;
  P.skill.corrTip = SKILL.corrTip;
  P.skill.autoGuard = true;
};

test('도는 진행: 0 → 1 · 빠르기 끝 0 · 가운데 1 · 한 바퀴 시간 = 시간 사다리 0.6 s (share 0 판) · 오르내림 0.2 s', () => {
  const { time: T, ramp: r } = SECRET.ibSpin;
  assert.equal(T, 0.6);
  assert.equal(r, 0.2);
  assert.equal(SECRET.ibSpin.armTime, realS(2)); // 10/25 22:3x 사장님 '이베리아 비기도 기다리는 시간 2초로' (전 1.5) · 실제 2 s (표준 시간 10/25 — 게임 2.2)
  assert.equal(spinProgress(0, T, r), 0);
  assert.equal(spinProgress(T, T, r), 1);
  let prev = 0;
  for (let t = 0; t <= T + 1e-9; t += 0.01) {
    const q = spinProgress(t, T, r);
    assert.ok(q >= prev - 1e-12, `단조 ${t}`);
    prev = q;
  }
  assert.equal(spinRate(0, T, r), 0);
  assert.equal(spinRate(T, T, r), 0);
  assert.equal(spinRate(T / 2, T, r), 1);
  // 진행의 기울기 = 빠르기 몫 ÷ (T − r)
  const t = 0.13, h = 1e-5;
  assert.ok(Math.abs((spinProgress(t + h, T, r) - spinProgress(t - h, T, r)) / (2 * h) - spinRate(t, T, r) / (T - r)) < 1e-3);
});

test('열림: 사람 · AI (10/24 사장님 \'싱지르 ai에게도 열어\' — aiOpenSchools 에 이베리아) · 비기 판 기본 spin · 스킬트리 B7 열림', () => {
  assert.ok(SECRET.openSchools.includes('iberian'));
  assert.ok(SECRET.aiOpenSchools.includes('iberian'));
  assert.equal(SECRET.iberianSecret, 'spin');
  assert.equal(TRADITIONS.iberian.secret.name, 'ibSpin');
  assert.equal(D.isClosed('iberian', D.nodeOf('iberian', 'B7')), false);
  assert.equal(D.kitFromNodes('iberian', D.allNodeIds('iberian')).secret, true);
  const G = newRound({ seed: 1, weapon: 'zweihander', weapon2: 'zweihander', persona: { proficiency: 5 } });
  assert.equal(G.ai.secret?.name, 'ibSpin'); // AI 이베리아 숙련도 5(AI_PROFICIENCY.secretAt) = 싱지르 · 무장 셈
  assert.ok(G.ai.spinArm);
  G.world.free();
  const G2 = newRound({ seed: 1, weapon: 'zweihander', weapon2: 'zweihander', persona: { proficiency: 4 } });
  assert.equal(G2.ai.secret, null); // 숙련도 4 는 비기 없음
  assert.equal(G2.ai.spinArm, null);
  G2.world.free();
});

test('무장: 칼끝 거리 밖 armTime(2 s) → 끝 없는 창(금색 !) · 휘두르면 풀림 · 무장 동안 상처 나면 풀림(hurtDisarm) · 창을 쓰면 한 번', () => {
  const G = newRound({ seed: 2, weapon: 'zweihander', weapon2: 'longsword', gap: 3.4 });
  const P = G.player, E = G.enemy;
  setup(P);
  G.ai.update = () => E.move.set(0, 0);
  const W = new PlayerSecretWatch(P, E, { locked: false });
  assert.equal(W.S?.name, 'ibSpin');
  let armT = null;
  let busy = false;
  G.before = () => W.update(DT, busy);
  while (G.t < ARENA.startHold + SECRET.ibSpin.armTime + 0.5 && armT == null) { // 무장 시계는 판 시작 정지가 끝나야 감 (10/27 23:0x)
    G.step();
    if (W.open?.ctx?.ev === 'spin') armT = G.t;
  }
  assert.ok(armT != null, '무장');
  assert.ok(P.foeDistance() > P.swordArt.measure.reach);
  assert.equal(W.open.t, Infinity);
  // 휘두름(비기 실행 중 busy 와 같은 칸) → 풀림 · 창 닫힘 — 10/25 21:0x 창 지킴(SECRET.secretHold — 사장님 '최소 0.6초는 열린 상태를 유지'): 열린 뒤 playerWindow 초까지는 열림, 그 뒤 닫힘 (`?secretHold=0` = 곧장 닫힘)
  busy = true;
  G.step();
  assert.equal(W.spinArm.armed, false);
  assert.equal(W.open?.ctx?.ev, 'spin', '창 지킴 — 무장이 풀려도 열린 뒤 0.6 s 는 열림');
  for (let i = 0; i < Math.round(SECRET.playerWindow / DT); i++) G.step();
  assert.equal(W.open, null);
  busy = false;
  for (let i = 0; i < Math.round((SECRET.ibSpin.armTime + realS(0.1)) / DT); i++) G.step(); // 무장 실제 2 s 넘게
  assert.equal(W.open?.ctx?.ev, 'spin');
  // 상처 → 풀림
  P.wounds.push({ part: 'farmO', severity: 0.1 });
  G.step();
  assert.equal(W.spinArm.armed, false);
  // 끄면(0) 발도 대기처럼 상처로는 안 풀림
  SECRET.ibSpin.hurtDisarm = 0;
  try {
    for (let i = 0; i < Math.round((SECRET.ibSpin.armTime + realS(0.1)) / DT); i++) G.step(); // 무장 실제 2 s 넘게
    assert.equal(W.spinArm.armed, true);
    P.wounds.push({ part: 'farmO', severity: 0.1 });
    G.step();
    assert.equal(W.spinArm.armed, true);
  } finally {
    SECRET.ibSpin.hurtDisarm = 1;
  }
  const o = W.fire();
  assert.equal(o.ctx.ev, 'spin');
  assert.equal(W.spinArm.armed, false); // 한 번 무장에 한 번
  G.world.free();
});

test('한 바퀴: 대본이 몸을 2π 돌리고 · 한 걸음쯤 나아가고 · 서 있고 · 끝에 가로로 쳐 서 있는 과녁을 벤다(물리 판정) — 손목 치우침 밧줄 없이(위 NO_ROPE)', () => withJoints(NO_ROPE, () => {
  // 과녁 2.2 m (10/24 share 0.7 — 전 2.3 m: 츠바이핸더 칼 든 쪽 2.3 m 는 닿는 끝이라 몫 0.6 은 팔 · 가슴을 베고 0.7 은 비켰다 · 2.1 · 2.2 m 는 둘 다 벰 — docs/strike/iberian_spin_2026-10-22.md §16-1)
  const G = newRound({ seed: 7, weapon: 'zweihander', weapon2: 'longsword', gap: 2.2, walls: false });
  const P = G.player, E = G.enemy;
  setup(P);
  G.ai.update = () => E.move.set(0, 0);
  for (let i = 0; i < E.sword.numColliders(); i++) E.sword.collider(i).setCollisionGroups(0);
  E.die = () => {};
  const W = new PlayerSecretWatch(P, E, { locked: false });
  let started = null, turned = 0, last = null, x0 = null, tipMax = 0, ended = null, extra = 0;
  G.before = () => {
    W.update(DT, !!P.skill.sec);
    if (started == null && G.t > ARENA.startHold + 0.6 && P.skill.secret({ S: W.S, ctx: { ev: 'spin' } })) { // 발이 풀리고 0.6 s 뒤 (10/24 장면 — 전 2.6 s = 발 묶음 2.0 + 0.6 · 표준 시간 뒤 발 묶음 게임 2.2)
      started = G.t;
      extra = P.ibSpin.pre + (SECRET.ibSpin.settle ? SECRET.ibSpin.ramp : 0) + P.ibSpin.T; // 10/23: 먼저 감기(칼이 가슴보다 높으면 ramp) · 마무리 받기(ramp) · 10/24 한 바퀴 = 칼마다(share — spinPlan)
      last = P.heading;
      const p = P.bodies.pelvis.translation();
      x0 = { x: p.x, z: p.z };
    }
  };
  while (G.t < 5) {
    G.step();
    if (started != null && P.ibSpin) {
      turned += P.heading - last;
      last = P.heading;
      tipMax = Math.max(tipMax, P.tipVel.length());
    } else if (started != null && ended == null) ended = G.t;
  }
  assert.ok(started != null, '비기를 냄');
  assert.ok(Math.abs(turned - 2 * Math.PI) < 0.05, `돈 각 ${turned}`);
  assert.ok(Math.abs(ended - started - extra) < 0.03, `도는 시간 ${ended - started} (한 바퀴 · 먼저 감기 · 받기 ${extra})`);
  const p = P.bodies.pelvis.translation();
  const travel = Math.hypot(p.x - x0.x, p.z - x0.z);
  assert.ok(travel > 0.3 && travel < 0.55, `나아간 거리 ${travel}`); // 10/24 upright: 나아감 상한 advance 0.45 · 한 바퀴에 0.5 m 안팎
  assert.equal(P.state, 'stand');
  assert.ok(tipMax > 15 && tipMax < 40, `칼끝 ${tipMax}`);
  const cuts = G.wounds.filter((w) => w.att === P && w.vic === E && w.type === 'cut' && w.severity > 0);
  assert.ok(cuts.length > 0, '가로로 벰');
  G.world.free();
}));

test('빠르기 몫 (10/24 share): 한 바퀴 = ramp + 2π · 칼끝 거리 ÷ (share × 고노센 칼끝) · 칼마다 · share 0 = 0.6 s 판', async () => {
  const { spinPlan } = await import('../../src/iberian_spin.js');
  const { iaiTipSpeed } = await import('../../src/secret_instant.js');
  assert.equal(SECRET.ibSpin.share, 0.7); // 사장님 10/24 10:5x '싱지르 고노센의 70%로' (전 0.6)
  const share = SECRET.ibSpin.share;
  for (const w of ['zweihander', 'flamberge', 'tizona']) {
    const G = newRound({ seed: 1, weapon: w, weapon2: 'longsword' });
    const P = G.player;
    const p = spinPlan(P);
    const v0 = iaiTipSpeed(P);
    assert.ok(Math.abs(p.v - share * v0) < 1e-9, w);
    assert.ok(Math.abs(p.w - p.v / P.swordArt.measure.reach) < 1e-9, w);
    assert.ok(Math.abs(p.T - (0.2 + (2 * Math.PI) / p.w)) < 1e-9, w);
    assert.ok(p.T > 0.6 && p.T < 0.75, `${w} ${p.T}`); // 0.6 s 보다 느림 (0.7 몫 — 0.62 ~ 0.65 s · 10/25 손맛 뒤 플랑베르주 0.72 s: 칼날 1.30 m · 간격 reach 2.57)
    SECRET.ibSpin.share = 0;
    try {
      const q = spinPlan(P);
      assert.equal(q.T, 0.6);
      assert.equal(q.v, Infinity);
    } finally {
      SECRET.ibSpin.share = share;
    }
    G.world.free();
  }
});

test('칼끝 자름 · 몸 곧게 (10/24): 두 쪽 모두 칼끝 ≤ 고노센의 share + 4 %p · 몸 기울기 ≤ 20° · 골반 옮김 ≤ 0.55 m · 내려앉음 ≤ 0.12 m · 서 있음', async () => {
  const { iaiTipSpeed } = await import('../../src/secret_instant.js');
  for (const dir of [1, -1]) {
    const G = newRound({ seed: 7, weapon: 'zweihander', weapon2: 'longsword', gap: 2.0, walls: false });
    const P = G.player, E = G.enemy;
    setup(P);
    G.ai.update = () => E.move.set(0, 0);
    for (let i = 0; i < E.sword.numColliders(); i++) E.sword.collider(i).setCollisionGroups(0);
    E.die = () => {};
    const W = new PlayerSecretWatch(P, E, { locked: false });
    const v0 = iaiTipSpeed(P);
    let t0 = null, p0 = null, tip = 0, tilt = 0, drop = 0, y0 = 0, end = null;
    G.before = () => {
      W.update(DT, !!P.skill.sec);
      P.move.set(0, 0);
      if (t0 == null && G.t > 2.6 && P.skill.secret({ S: W.S, ctx: { ev: 'spin', turnDir: dir } })) {
        t0 = G.t;
        const p = P.bodies.pelvis.translation();
        p0 = { x: p.x, z: p.z };
        y0 = p.y;
      }
    };
    while (G.t < 6) {
      G.step();
      if (t0 == null || end != null) continue;
      if (!P.skill.sec) end = G.t;
      tip = Math.max(tip, P.tipVel.length());
      const pp = P.bodies.pelvis.translation(), hd = P.bodies.head.translation();
      tilt = Math.max(tilt, (Math.atan2(Math.hypot(hd.x - pp.x, hd.z - pp.z), hd.y - pp.y) * 180) / Math.PI);
      drop = Math.max(drop, y0 - pp.y);
    }
    const p = P.bodies.pelvis.translation();
    const travel = Math.hypot(p.x - p0.x, p.z - p0.z);
    assert.ok(tip / v0 < SECRET.ibSpin.share + 0.04, `칼끝 ${tip} / ${v0} (${dir})`); // 전: 반대 쪽 2.0 m 에서 104 % · 자름 = share
    assert.ok(tilt < 20, `기울기 ${tilt} (${dir})`);
    assert.ok(travel < 0.55, `옮김 ${travel} (${dir})`);
    assert.ok(drop < 0.12, `내려앉음 ${drop} (${dir})`);
    assert.equal(P.state, 'stand');
    G.world.free();
  }
});

test('AI 싱지르 (10/24): 롤랑(이베리아 숙련도 6)이 칼끝 거리 밖 무장 → 다가오는 상대에게 한 바퀴 · 끝나면 다시 간 보기', async () => {
  const { CHARACTERS_BY_ID } = await import('../../src/characters.js');
  const H = CHARACTERS_BY_ID.roland;
  const G = newRound({ seed: 3, weapon: 'longsword', weapon2: H.weapon, difficulty: H.ai.level, persona: H.ai.persona, look2: H.look, gap: 4 });
  const P = G.player, E = G.enemy;
  assert.equal(G.ai.secret?.name, 'ibSpin');
  let fired = null, sawSpin = false, back = false;
  G.before = () => {
    const go = ARENA.startHold + SECRET.ibSpin.armTime + 0.3; // 무장(판 시작 정지 뒤 armTime — 10/27 23:0x) 뒤
    P.move.set(0, G.t > go ? 0.7 : 0); // 사람 자리: 서 있다가 무장 뒤 곧장 다가간다
    if (G.ai.secretRun?.stage === 'spin' && fired == null) fired = G.t;
    if (E.ibSpin) sawSpin = true;
    if (fired != null && !G.ai.secretRun && G.ai.mode !== 'secret') back = true;
  };
  while (G.t < ARENA.startHold + 9 && !back) G.step();
  assert.ok(fired != null, 'AI 가 싱지르를 냄');
  assert.ok(sawSpin, '대본이 돎');
  assert.ok(back, '끝나고 다시 간 보기');
  assert.equal(G.ai.stats.secrets.ibSpin.fired, 1);
  G.world.free();
});

// ── 10/24 10:4x 사장님 '싱지르 개편 뒤에 또 허공 위로 날아가는 싱지르가 많아졌어. 몸통을 겨누기로 했었는데' · '작게 그으면 … 나가다 말고 좀 이상한 작은 동작이 되어 실패' (§16) ──
const withSpin = async (vals, fn) => {
  const old = {};
  for (const k of Object.keys(vals)) {
    old[k] = SECRET.ibSpin[k];
    SECRET.ibSpin[k] = vals[k];
  }
  try {
    return await fn();
  } finally {
    Object.assign(SECRET.ibSpin, old);
  }
};
const HEAD = 0.45; // 시험 눈금 — 칼 가장 높은 점이 가슴 점 + 0.45 m(머리 꼭대기 언저리)를 넘으면 '허공' (판 값 아님)
const spinTop = (r) => Math.max(...['ramp', 'wind', 'free', 'settle', 'follow'].filter((p) => r.ph[p].n).map((p) => r.ph[p].top));

test('손 목표 쉼 자리 (10/24 handRest): 사람이 싱지르를 내면 손 목표 = 유파 쉴 자세 · 이어 베기 · 손 빠르기 0', () => {
  assert.equal(SECRET.ibSpin.handRest, 1);
  const G = newRound({ seed: 7, weapon: 'zweihander', weapon2: 'longsword', gap: 8, walls: false });
  const P = G.player, E = G.enemy;
  setup(P);
  G.ai.update = () => E.move.set(0, 0);
  const W = new PlayerSecretWatch(P, E, { locked: false });
  G.before = () => W.update(DT, !!P.skill.sec);
  while (G.t < 2.6) G.step();
  P.handOffset.set(-0.6, -0.17); // 큰 원이 끝난 자리 (손 닿는 끝)
  P.skill.follow.set(0.2, -0.1);
  P.skill.vel.set(3, 1);
  assert.ok(P.skill.secret({ S: W.S, ctx: { ev: 'spin', turnDir: 1 } }));
  const pad = P.swordArt.restGuard.pad;
  assert.deepEqual([P.handOffset.x, P.handOffset.y], [pad[0], pad[1]]);
  assert.deepEqual([P.skill.aimRaw.x, P.skill.aimRaw.y], [pad[0], pad[1]]);
  assert.equal(P.skill.follow.length(), 0);
  assert.equal(P.skill.vel.length(), 0);
  G.world.free();
});

test('몸통 뚜껑 (10/24 lid): 놓은 칼끝이 몸통 위 끝 쪽으로 오르는 빠르기를 남은 높이 × track 쪽으로 자름(칼날에 수직인 몫) · 끄면 그대로', async () => {
  const { spinLid } = await import('../../src/iberian_spin.js');
  const { ARM } = await import('../../src/config.js');
  for (const lid of [1, 0]) {
    await withSpin({ lid }, () => {
      const G = newRound({ seed: 7, weapon: 'flamberge', weapon2: 'longsword', gap: 8, walls: false });
      const P = G.player;
      while (G.t < 1) G.step();
      const tip = P.bladePoint(1);
      const o = P.sword.translation();
      const rx = tip.x - o.x, rz = tip.z - o.z;
      const h = Math.hypot(rx, rz);
      const k = 12 / h; // 칼끝을 위로 12 m/s 차 올리는 돌림 (칼날 수평 성분에 수직인 수평 축) + 세로 축 돌림 3 rad/s
      P.sword.setAngvel({ x: (-rz / h) * k, y: 3, z: (rx / h) * k }, true);
      const v0 = P.sword.velocityAtPoint(tip);
      assert.ok(v0.y > 5, `차 올림 ${v0.y}`);
      spinLid(P);
      const v1 = P.sword.velocityAtPoint(tip);
      const allow = SECRET.ibSpin.track * (P.bodies.chest.translation().y + ARM.shoulder[1] - tip.y);
      if (lid) {
        // 고침은 칼날에 수직인 몫만(칼 손 둘레 돌림) — 위아래 몫은 (1 − 칼 방향 세로 성분²) 만큼 (놓은 칼은 거의 수평이라 거의 다)
        const ry = tip.y - o.y;
        const keep = (rx * rx + rz * rz) / (rx * rx + rz * rz + ry * ry);
        assert.ok(v1.y <= v0.y + (allow - v0.y) * keep + 1e-6, `칼끝 위 빠르기 ${v1.y} (전 ${v0.y} · 허용 ${allow} · 몫 ${keep.toFixed(2)})`);
        assert.ok(v1.y < v0.y - 0.5 * (v0.y - allow) * keep, '위 빠르기가 줄었다');
      } else assert.ok(Math.abs(v1.y - v0.y) < 1e-9, '끄면 그대로');
      G.world.free();
    });
  }
});

// 10/24 기록 장면 (표준 시간 전 판의 게임 초 — 싱지르 무장 ibSpin.armTime 1.5): 옛 결함 재현 판 둘(아래 '칼 높이' 의 고침 끈 판 · '땅' 의 손목 옛 판 · 땅 끔)은 원을 다 그려 내는 때가 10/24 그림 판과 같아야
//  칼이 솟고(본판 10/27 대검 몸 뒤 — 표준 시간으론 셋 중 하나만 솟음) · 칼끝이 땅을 스친다 — 표준 시간(무장 게임 1.65)으로는 그 때가 0.15 s 늦어 옛 결함이 안 보인다(옛 결함 재현만의 장면 · docs/strike/time_standard_2026-10-25.md §4). 고친 판(땅 · 발디딤)은 표준 시간 그대로 본다
const withScene1024 = async (fn) => {
  const a = SECRET.ibSpin.armTime, f = SECRET.armAtFight, fs = SKILL.frameScale;
  SECRET.ibSpin.armTime = 1.5;
  SECRET.armAtFight = 0; // 10/24 장면은 판 시작부터 무장 시계가 감 (10/27 23:0x 전 판 — 공격이 풀린 때부터 세면 원을 긋는 때가 정지 뒤로 밀려 옛 결함 장면이 아님)
  SKILL.frameScale = 'off'; // 10/24 장면의 손 매핑 배수 (10/31 대검 배수 'heavy' 전 — docs/motion/guard_arms_2026-10-31.md: 대검 손이 13 % 멀어져 '땅' 의 옛 결함(칼끝 땅 스침)이 안 남)
  try {
    return await fn();
  } finally {
    SECRET.ibSpin.armTime = a;
    SECRET.armAtFight = f;
    SKILL.frameScale = fs;
  }
};
test('원 입력 싱지르 칼 높이 (10/24): 전에 머리 위로 솟던 큰 원 셋 — 고친 판은 한 바퀴 다 돌고 칼 가장 높은 점 ≤ 가슴 + 0.45 m · 고침을 끄면 솟음', async () => {
  const { runCircle } = await import('./iberian_spin_circle.mjs');
  const cases = [
    ['zweihander', 'langort', { r: 80, T: 0.8, a0: 180, dir: 'ccw', close: 380 }],
    ['flamberge', 'tag', { r: 80, T: 0.8, a0: 180, dir: 'ccw', close: 380 }],
    ['tizona', 'wechselR', { r: 80, T: 0.8, a0: 180, dir: 'ccw', close: 380 }],
  ];
  let highOff = 0;
  for (const [w, s, c] of cases) {
    const r = runCircle(w, s, 'circle', c);
    assert.ok(r.fired, `${w} ${s} 냄`);
    assert.equal(r.why, 'done', `${w} ${s} 한 바퀴`);
    assert.ok(!r.fell, `${w} ${s} 넘어짐`);
    assert.ok(spinTop(r) <= HEAD, `${w} ${s} 칼 가장 높은 점 − 가슴 ${spinTop(r).toFixed(2)}`);
    const b = await withScene1024(() => withSpin({ handRest: 0, lid: 0, floor: 0 }, () => runCircle(w, s, 'circle', c))); // 옛 결함 재현 = 10/24 장면 (아래 withScene1024)
    if (spinTop(b) > HEAD) highOff++;
  }
  assert.ok(highOff >= 2, `고침을 끈 판 솟음 ${highOff} / 3`);
});

test('땅은 막힘 아님 (10/24 floor): 원을 아래에서 끝내 감기 첫 스텝에 칼끝이 땅을 스친 판 — 고친 판은 한 바퀴 · 끄면 막힘(진행 ≈ 0)', async () => {
  const { runCircle } = await import('./iberian_spin_circle.mjs');
  const c = { r: 50, T: 0.8, a0: 0, dir: 'ccw', close: 380 };
  // 장면 = 10/24 기록 그대로: 원은 무장 0.3 s 뒤에 긋는다 — 무장 시간이 바뀌면(10/25 22:3x 1.5 → 2 s) 원을 긋는 때의 몸 · 칼 자리가 달라져 옛 결함(땅 스침)이 안 날 수 있어 그때 시간(1.5)으로 고정
  const at = { armTime: 1.5 };
  const r = await withScene1024(() => withSpin(at, () => runCircle('zweihander', 'langort', 'circle', c)));
  assert.equal(r.why, 'done');
  assert.equal(r.q, 1);
  const b = await withScene1024(() => withJoints(WRIST_OLD, () => withSpin({ ...at, floor: 0 }, () => runCircle('zweihander', 'langort', 'circle', c)))); // 옛 결함은 옛 손목 판에서 (새 손목 판은 꺼도 칼끝이 땅을 안 스침)
  assert.equal(b.why, 'blocked');
  assert.ok(b.q < 0.05, `진행 ${b.q}`);
});

test('작은 원 (10/24 circleR 0): 반지름 8 · 15 px 원도 싱지르가 한 바퀴 다 돌고 몸통 높이 · 하한 0.15 m 판은 원으로 안 읽힘', async () => {
  const { runCircle } = await import('./iberian_spin_circle.mjs');
  assert.equal(SECRET.ibSpin.circleR, 0);
  for (const [s, rp] of [['langort', 8], ['wechselR', 15]]) {
    const c = { r: rp, T: 0.5, a0: 90, dir: 'cw', close: 380 };
    const r = runCircle('flamberge', s, 'circle', c);
    assert.ok(r.fired && r.circle, `${s} ${rp}px 냄`);
    assert.equal(r.why, 'done');
    assert.ok(spinTop(r) <= HEAD, `${s} ${rp}px 높이 ${spinTop(r)}`);
    const b = await withSpin({ circleR: 0.15 }, () => runCircle('flamberge', s, 'circle', c));
    assert.ok(!b.fired && !b.circle, `${s} ${rp}px 하한 0.15 → 안 읽힘`);
  }
});

// ── 10/24 12:5x 사장님 '넘어지지 않으려면 다리가 넓게 딛거나 무릎 관절로 몸을 분산 지지해야 하는데 두 다리가 딱 붙어서 곧게 편 채 같은 방향을 지지하고 있음' (§17) ──
const FOOT_LON = 0.45; // 시험 눈금 — 받아 멈춤 끝 두 발 앞뒤 (이베리아 자세 guardLength 0.62 의 3/4 언저리 · 판 값 아님)
const PEL_MID = 0.1; // 시험 눈금 — 골반이 두 발 가운데에서 앞뒤로 벗어난 거리 (판 값 아님)
test('발디딤 (10/24 feet): 한 바퀴 끝 + 받아 멈춤 뒤 두 발이 펜싱 자세 너비(앞뒤 · 옆)로 · 골반은 두 발 사이 · 무게 가운데 발바닥 안 · 안 엇갈림 · 대본 뒤 묵은 지나 딛기 없음 — 끄면 두 발이 붙음 (손목 치우침 밧줄 없이 — 위 NO_ROPE)', () => withJoints(NO_ROPE, async () => {
  const { runFeet } = await import('./iberian_spin_feet.mjs');
  const cases = [
    ['tizona', 'langort', 'circle', { r: 80, T: 0.8, a0: 180, dir: 'ccw', close: 380 }], // 사장님 그림 판 (티소나 큰 원)
    ['zweihander', 'ochsR', 'circle', { r: 80, T: 0.8, a0: 180, dir: 'cw', close: 380 }],
    ['flamberge', 'langort', 'direct', { dir: 'ccw' }],
  ];
  assert.equal(SECRET.ibSpin.feet, 1);
  for (const [w, s, input, c] of cases) {
    const r = runFeet(w, s, input, c);
    const n = `${w} ${s} ${input}`;
    assert.ok(r.fired && !r.fell && r.feet.why === 'done', `${n} 한 바퀴 · 서 있음`);
    const F = r.feet.fin;
    assert.ok(F.lon >= FOOT_LON, `${n} 받아 멈춤 끝 앞뒤 ${F.lon.toFixed(2)}`);
    assert.ok(F.lat >= 0.2, `${n} 옆 ${F.lat.toFixed(2)}`);
    assert.ok(Math.abs(F.pelFwd) <= PEL_MID, `${n} 골반 − 두 발 가운데 ${F.pelFwd.toFixed(2)}`);
    assert.ok(F.margin > -0.02, `${n} 무게 가운데 여유 ${F.margin.toFixed(3)}`);
    assert.equal(r.feet.spin.cross, 0, `${n} 도는 동안 엇갈림`);
    assert.ok(r.feet.after.lon > 0.2, `${n} 끝난 뒤 0.6 s 앞발이 앞 ${r.feet.after.lon.toFixed(2)}`);
  }
  // 끄면 (10/24 02:5x 판): 사장님 그림 판은 받아 멈춤 끝에도 두 발이 앞뒤로 붙어(앞뒤 < 0.2 m) 골반이 두 발 앞에 남는다
  const [w, s, input, c] = cases[0];
  const b = await withSpin({ feet: 0 }, () => runFeet(w, s, input, c));
  assert.ok(b.feet.fin.lon < 0.2, `끔 앞뒤 ${b.feet.fin.lon.toFixed(2)}`);
}));
