// 독일 비기 죽음의 일격 (모르트슐라크 · 10/22 사장님 '독일은 죽음의 일격으로 하자' · '1.5로 해' · 사람 먼저 — src/mordschlag.js · docs/strike/german_mordschlag_2026-10-22.md).
// 조건(밀치기 누르기 이어짐 → 창) · 사람 몫만(AI 비기 그대로) · 칼날 거꾸로 쥐기(손목 관절 · 원래 쥠으로) · 비기 흐름(준비 → 베기 → 다시 세우기 → 굳음)을 실제 물리 몸에서 본다.
// 손맛 · 맞힘 수는 tools/sim/mordschlag_duel.mjs · 동작 자취는 tools/sim/mordschlag_probe.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, DT, CONFIG, AI, THREE } from './harness_m.mjs';
import { TRADITIONS } from '../../src/schools.js';
import { PlayerSecretWatch, playerSecretOf } from '../../src/secret.js';
import { mordMode, mordGripOf, mordHitMul, mordKinOf } from '../../src/mordschlag.js';
import { FINISH } from '../../src/finish.js';
const { SECRET } = CONFIG;

class Still {
  constructor(me) { this.me = me; }
  update() { this.me.move.set(0, 0); }
}
function fixture(weapon = 'longsword', gap = 0.75) {
  const g = newRound({ weapon, weapon2: 'longsword', gap, seed: 7, walls: false, AIClass: Still });
  const P = g.player, E = g.enemy;
  P.skill.corr = CONFIG.SKILL.corr; P.skill.corrTip = CONFIG.SKILL.corrTip; P.skill.autoGuard = true; P.canShove = true;
  P.foe = E; E.foe = P;
  return { g, P, E };
}
const q = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);
const anc = (P) => { const a = P.gripJoint.anchor2(); return [+a.x.toFixed(6), +a.y.toFixed(6), +a.z.toFixed(6)]; };
const wristGap = (P) => {
  const fa = P.bodies.farmS, sw = P.sword;
  const w = new THREE.Vector3(0.13, 0, 0).applyQuaternion(q(fa.rotation())).add(fa.translation());
  const gp = new THREE.Vector3(0, P.mordGrip ? P.mordGrip.g : 0, 0).applyQuaternion(q(sw.rotation())).add(sw.translation());
  return w.distanceTo(gp);
};

test('값: 사람 독일 비기 = 죽음의 일격 (사장님 결정 1.5 s · 창 0.6 s · 굳음 0.4 s) · 사람 비기 열림에 독일 · AI 는 일본만', () => {
  assert.equal(SECRET.deMord, 1);
  assert.equal(SECRET.mordPress, 1.5);
  assert.equal(SECRET.playerWindow, 0.6);
  assert.equal(SECRET.stiff.german, 0.4);
  assert.equal(SECRET.mordOver, 0); // 넘어 들어감 규칙 — 사장님 확인 전 · 기본 끔
  assert.ok(SECRET.openSchools.includes('german') && SECRET.openSchools.includes('japanese'));
  assert.deepEqual(SECRET.aiOpenSchools, ['japanese']);
  const S = TRADITIONS.german.playerSecret;
  assert.equal(S.name, 'mordschlag');
  assert.equal(S.nameKo, '모르트슐라크');
  assert.equal(S.when, 'press');
  assert.notEqual(TRADITIONS.german.secret.name, 'mordschlag'); // AI 몫(TRADITIONS.german.secret)은 옛 판 그대로
});

test('사람 몫만: 플레이어 독일 무기 = 죽음의 일격 · deMord 0 = 옛 판 · AI 독일 숙련도 5 도 비기 없음 (aiOpenSchools)', () => {
  const { g, P, E } = fixture();
  try {
    assert.equal(playerSecretOf(P).name, 'mordschlag');
    SECRET.deMord = 0;
    try { assert.equal(playerSecretOf(P), TRADITIONS.german.secret); } finally { SECRET.deMord = 1; }
    const ai = new AI(E, P, 'normal', { proficiency: { german: 5 } });
    assert.equal(ai.secret, null);
  } finally { g.world.free(); }
});

test('조건: 밀치기 누르기가 끊기지 않고 1.5 s 이어지면 창 · 누르기가 끝나면 셈 0 · 창을 열면 셈 0 · 0.6 s 판도', () => {
  const { g, P, E } = fixture();
  try {
    const w = new PlayerSecretWatch(P, E);
    assert.equal(w.S.name, 'mordschlag');
    const steps = (sec) => Math.round(sec / DT);
    const press = (n, on = true) => { for (let i = 0; i < n; i++) { P.barge = on ? { phase: 'press' } : null; w.update(DT, false); } };
    press(steps(1.5) - 2);
    assert.equal(w.open, null, '1.5 s 전에는 창 없음');
    press(1, false); // 끊김
    press(steps(1.5) - 2);
    assert.equal(w.open, null, '끊긴 뒤 다시 1.5 s 전');
    press(4);
    assert.ok(w.open, '1.5 s 이어지면 창');
    assert.equal(w.open.ctx.ev, 'press');
    assert.equal(w.opened, 1);
    assert.ok(Math.abs(w.open.t - SECRET.playerWindow) < 3 * DT);
    P.barge = { phase: 'step' }; // 딛는 동안은 누르기가 아님
    w.update(DT, false);
    assert.equal(w.pressT, 0);
    SECRET.mordPress = 0.6;
    try {
      const w2 = new PlayerSecretWatch(P, E);
      press.call(null, 0);
      for (let i = 0; i < steps(0.6) + 2; i++) { P.barge = { phase: 'press' }; w2.update(DT, false); }
      assert.ok(w2.open, '0.6 s 판');
    } finally { SECRET.mordPress = 1.5; }
    const w3 = new PlayerSecretWatch(P, E);
    for (let i = 0; i < steps(2); i++) { P.barge = { phase: 'press' }; w3.update(DT, true); } // 비기 실행 · 굳음 동안은 세지 않음
    assert.equal(w3.open, null);
  } finally { P.barge = null; g.world.free(); }
});

test('칼날 거꾸로 쥐기: 손목 관절이 그 자리에서 맞음 · 칼끝 아래 · 원래 쥠으로 돌아오면 관성 · 닻 그대로', () => {
  const { g, P } = fixture();
  try {
    for (let i = 0; i < 60; i++) g.step();
    const I0 = P.swordIhand;
    const G = mordGripOf(P);
    assert.ok(G.g > P.weaponCfg.hiltLength && G.g < P.weaponCfg.hiltLength + P.weaponCfg.bladeLength);
    assert.ok(G.gOff > G.g); // 빈손은 칼끝 쪽
    assert.equal(P.reverseGrip(G, { x: 0, y: -1, z: 0 }), true);
    assert.equal(P.reverseGrip(G), false); // 이미 거꾸로
    assert.ok(wristGap(P) < 1e-3, `손목 ↔ 쥔 자리 ${wristGap(P)}`);
    const tip = new THREE.Vector3(0, 1, 0).applyQuaternion(q(P.sword.rotation()));
    assert.ok(tip.y < -0.99, '칼끝 아래 · 칼자루 위');
    assert.deepEqual(anc(P), [0, +G.g.toFixed(6), 0]);
    for (let i = 0; i < 60; i++) g.step();
    assert.ok(wristGap(P) < 0.01, `0.5 s 뒤에도 관절이 버팀 ${wristGap(P)}`);
    assert.equal(P.reverseGrip(null), true);
    assert.equal(P.mordGrip, null);
    assert.ok(wristGap(P) < 1e-3);
    assert.ok(Math.abs(P.swordIhand - I0) < 1e-9);
    assert.deepEqual(anc(P), [0, 0, 0]);
    assert.equal(mordMode(P), 'reverse');
  } finally { g.world.free(); }
  const ls = fixture('lightsaber');
  try { assert.equal(mordMode(ls.P), 'hilt'); } finally { ls.g.world.free(); } // 칼날을 잡을 수 없는 칼은 쥠 그대로
});

test('비기 흐름: 준비 → 베기 길 → 따라 지나감 → 다시 세우기 → 굳음 0.4 s · 끝나면 원래 쥠 · 겨눔 · NaN 없음', () => {
  SECRET.mord.kin = 0; SECRET.mord.aim = 'pad'; try { // 서보 길 시험 (10/23 판 기본은 운동학 kin 0.3 · pull)
  const { g, P } = fixture('longsword', 0.75);
  try {
    for (let i = 0; i < Math.round(2.4 / DT); i++) g.step();
    assert.equal(P.skill.secret({ S: TRADITIONS.german.playerSecret, ctx: { ev: 'press' } }), true);
    assert.ok(P.mordGrip && P.mordAim, '입력 스텝에 칼날을 거꾸로 쥠');
    const seen = new Set();
    let stiffT = null;
    for (let i = 0; i < Math.round(4 / DT) && P.skill.sec; i++) {
      g.step();
      if (P.skill.sec) { seen.add(P.skill.sec.stage); if (P.skill.sec.stage === 'stiff') stiffT = P.skill.sec.stiffT; }
      const t = P.sword.translation();
      assert.ok(Number.isFinite(t.x + t.y + t.z));
      if (P.mordGrip) assert.ok(wristGap(P) < 0.02, `손목 ↔ 쥔 자리 ${wristGap(P)}`);
    }
    assert.equal(P.skill.sec, null);
    for (const s of ['chamber', 'strike', 'follow', 'mordBack', 'stiff']) assert.ok(seen.has(s), s);
    assert.equal(stiffT, 0.4);
    assert.equal(P.mordGrip, null);
    assert.equal(P.mordAim, false);
    assert.equal(P.mordHold, null);
    assert.deepEqual(anc(P), [0, 0, 0]);
    assert.equal(P.powerMul, 1);
    assert.equal(P.secretHit, 1);
  } finally { g.world.free(); }
  } finally { SECRET.mord.kin = 0.3; SECRET.mord.aim = 'pull'; }
});

test('넘어 들어감 규칙 (mordOver — 기본 끔): 켜면 내리치는 동안만 내 칼이 상대 칼과 부딪히지 않고, 끝나면 원래 그룹', () => {
  SECRET.mord.kin = 0; SECRET.mord.aim = 'pad'; try { // 서보 길 시험 (10/23 판 기본은 운동학 kin 0.3 · pull)
  const { g, P } = fixture('longsword', 0.75);
  SECRET.mordOver = 1;
  try {
    const g0 = P.swordColliders.map((c) => c.collisionGroups());
    for (let i = 0; i < Math.round(2.4 / DT); i++) g.step();
    P.skill.secret({ S: TRADITIONS.german.playerSecret, ctx: { ev: 'press' } });
    let off = false;
    for (let i = 0; i < Math.round(4 / DT) && P.skill.sec; i++) {
      g.step();
      const st = P.skill.sec?.stage;
      const masked = P.swordColliders.every((c) => (c.collisionGroups() & 16) === 0);
      if (st === 'strike' || st === 'follow') off ||= masked;
      if (st === 'chamber' || st === 'stiff') assert.equal(masked, false, st);
    }
    assert.ok(off);
    assert.deepEqual(P.swordColliders.map((c) => c.collisionGroups()), g0);
  } finally { SECRET.mordOver = 0; g.world.free(); }
  } finally { SECRET.mord.kin = 0.3; SECRET.mord.aim = 'pull'; }
});

test('가볍고 느림을 고칠 안 (10/23 확정 — kin 0.3 · aim pull): kin · aim · power hit = 판정 배율 hitMul 그대로 · finish = FINISH.power · 수 = 그 수', () => {
  assert.equal(SECRET.mord.kin, 0.3); // 사장님 10/23 '죽음의 일격 30%'
  assert.equal(SECRET.mord.aim, 'pull');
  assert.equal(SECRET.mord.power, 'hit');
  assert.equal(mordHitMul(), SECRET.hitMul);
  SECRET.mord.power = 'finish';
  try { assert.equal(mordHitMul(), FINISH.power); } finally { SECRET.mord.power = 'hit'; }
  SECRET.mord.power = 2;
  try { assert.equal(mordHitMul(), 2); } finally { SECRET.mord.power = 'hit'; }
  const { g, P } = fixture();
  try {
    const run = { mord: { G: mordGripOf(P) } };
    const M = mordKinOf(P, run);
    assert.ok(Math.abs(M.Lc - (M.g - P.weaponCfg.hiltLength)) < 1e-9); // 손 → 코등이
    assert.ok(Math.abs(M.Lp - (M.g + 0.15)) < 1e-6, `손 → 칼자루 끝 ${M.Lp}`); // 롱소드 폼멜 공 밑 −0.15
    assert.equal(M.pull, true); // 10/23 aim 'pull' 기본
  } finally { g.world.free(); }
});

test('운동학 길 (kin 0.6): 쥠 바꿈 → instant(연환 틀) → 원래 쥠 · 밧줄 다시 · 굳음 0.4 s · 입력 → 굳음 끝 1 s 안 · pull 이면 칼자루가 머리에', () => {
  for (const aim of ['pad', 'pull']) {
    const { g, P } = fixture('longsword', 0.65);
    SECRET.mord.kin = 0.6;
    SECRET.mord.aim = aim;
    try {
      for (let i = 0; i < Math.round(2.4 / DT); i++) g.step();
      const cone = !!P.gripCone;
      assert.equal(P.skill.secret({ S: TRADITIONS.german.playerSecret, ctx: { ev: 'press' } }), true);
      assert.equal(P.skill.sec.stage, 'instant');
      assert.ok(P.mordGrip && P.mordAim);
      const hits = [];
      g.combat.hooks.onWound = (att, vic, r, pt, pr) => { if (att === P) hits.push({ zone: r.zone, part: pr.w.part }); };
      const seen = new Set();
      let t = 0, kin = false;
      for (let i = 0; i < Math.round(3 / DT) && P.skill.sec; i++) {
        g.step();
        t += DT;
        if (P.skill.sec) seen.add(P.skill.sec.stage);
        if (P.iai) kin ||= P.iai.kind === 'combo' && !!P.iai.mord;
        const s = P.sword.translation();
        assert.ok(Number.isFinite(s.x + s.y + s.z));
      }
      assert.ok(kin, '연환 틀로 몬다');
      assert.equal(P.skill.sec, null);
      assert.ok(seen.has('instant') && seen.has('stiff'));
      assert.ok(t < 1, `입력 → 굳음 끝 ${t.toFixed(2)} s`);
      assert.equal(P.mordGrip, null);
      assert.equal(P.mordAim, false);
      assert.equal(!!P.gripCone, cone, '손목 밧줄 다시');
      assert.deepEqual(anc(P), [0, 0, 0]);
      assert.ok(P.instantResult?.mord);
      if (aim === 'pull') {
        assert.ok(P.instantResult.pullD > 0);
        assert.ok(hits.some((h) => h.zone === 'head' && h.part === 'hilt'), JSON.stringify(hits));
      }
    } finally { SECRET.mord.kin = 0.3; SECRET.mord.aim = 'pull'; g.world.free(); }
  }
});
