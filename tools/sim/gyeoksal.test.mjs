// 동방 막아 죽이기 (격살 · 10/22) 시험 — node --test tools/sim/gyeoksal.test.mjs
//  사람 길만 바뀜(AI 는 막기 연환 · aiOpenSchools 로 닫힘) · 조건(때맞춤 · 앞으로 · 받은 자세 · 받아 냄 · 미리 받기) · 자세 → 겨눌 곳 · 판정 배율 FINISH.power · 스킬트리 C9 열림
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newRound, DT, CONFIG } from './harness_m.mjs';

const { SECRET } = CONFIG;
const { TRADITIONS } = await import('../../src/schools.js');
const { PlayerSecretWatch } = await import('../../src/secret.js');
const { PlayerParryGuard } = await import('../../src/parry_button.js');
const { AI } = await import('../../src/ai.js');
const { FINISH } = await import('../../src/finish.js');
const D = await import('../../src/skill_tree_data.js');

test('사람 길만 격살 — AI 는 옛 막기 연환 그대로 · 비기 닫힘 (aiOpenSchools)', () => {
  const T = TRADITIONS.chinese;
  assert.equal(T.playerSecret.name, 'gyeoksal');
  assert.equal(T.secret.name, 'lianhuanParry'); // AI 길 (ai.js 는 secret 만 본다)
  assert.ok(SECRET.openSchools.includes('chinese'));
  assert.ok(!SECRET.aiOpenSchools.includes('chinese'));
  const G = newRound({ weapon: 'qinggang', weapon2: 'qinggang', seed: 1 });
  const ai = new AI(G.player, G.enemy, 'expert', { proficiency: 5 });
  assert.equal(ai.secret, null); // AI 동방은 숙련도 5 라도 비기 없음
  assert.equal(new PlayerSecretWatch(G.player, G.enemy).S.name, 'gyeoksal');
  assert.equal(new PlayerSecretWatch(G.player, G.enemy, { locked: true }).S, null); // 비기 칸이 없으면 창 없음
  const keep = SECRET.gyeoksal.on;
  SECRET.gyeoksal.on = 0;
  try {
    assert.equal(T.playerSecret.name, 'lianhuanParry'); // `?gyeoksal=0` = 옛 판
  } finally {
    SECRET.gyeoksal.on = keep;
  }
});

test('자세 → 겨눌 곳: 거정(위 가운데 · 위 오른) 머리 · 어거(찌르기) 팔 · 요략(아래 둘) 다리 · 봉두(위 왼) 허파 — 한 칼씩', () => {
  const S = TRADITIONS.chinese.playerSecret;
  assert.deepEqual(S.cond.stances, { highC: 'geojeong', highR: 'geojeong', thrust: 'eogeo', lowL: 'yoryak', lowR: 'yoryak', highL: 'bongdu' });
  const aim = Object.fromEntries(Object.entries(S.do.combo).map(([k, v]) => [k, v.seq.map((m) => m.dyn.target)]));
  assert.deepEqual(aim, { geojeong: ['head'], eogeo: ['arm'], yoryak: ['leg'], bongdu: ['lung'] });
  assert.equal(S.do.combo.bongdu.seq[0].kind, 'thrust');
  assert.equal(S.do.power, 'gyeoksal');
  assert.equal(SECRET.gyeoksal.power, 'hit'); // 10/22 23:0x 사장님 확정 (전 'finish')
});

/** 칼이 들어오는 중인 상대 (지난 0.6 s 칼끝 ≥ 3.5 m/s — foeRecentTipSp 가 읽는 눈)를 흉내 */
function fastFoe(w) {
  const s = w.sense.buf[w.sense.head];
  s.t = 0;
  s.tvx = 6;
  s.tvy = 0;
  s.tvz = 0;
}
/** 대본: 단추 누름(press) → wait 초 뒤 칼 닿음 → hold 초 붙음 → 떨어짐. 스틱 (x, y). 돌려줌 = 창 */
function script({ wait = 0.2, stick = [0, 1], hurtAt = null, line = null, buffer = false, hand = null } = {}) {
  const G = newRound({ weapon: 'qinggang', weapon2: 'longsword', seed: 1 });
  const P = G.player;
  const guard = new PlayerParryGuard(P, G.enemy);
  const w = new PlayerSecretWatch(P, G.enemy);
  while (G.t < 0.5) G.step();
  w.update(DT, false);
  w.sense.record = () => {}; // 대본이 눈을 정한다
  fastFoe(w);
  let t = 0;
  let touchOn = false;
  const bt = () => touchOn;
  const step = () => {
    P.stickX = stick[0];
    P.stickY = stick[1];
    if (line) (guard.mode = 'defend'), (guard.defLine = line);
    if (hand) P.handOffset.set(hand[0], hand[1]);
    w.gyeoksalTick(DT, bt(), false, false);
    t += DT;
  };
  guard.held = true;
  for (let i = 0; i < Math.round(wait / DT); i++) step();
  touchOn = true;
  step();
  if (buffer && w.canBuffer()) w.buffer([0, 0]);
  for (let i = 0; i < Math.round(0.1 / DT); i++) {
    if (hurtAt != null && i === hurtAt) P.wounds.push({ part: 'chest', type: 'cut', severity: 0.2, bleed: 0 });
    step();
  }
  touchOn = false;
  step();
  return { w, P, guard };
}

test('조건: 누른 뒤 0.4 s 안 닿음 · 스틱 앞 · 받아 냄 → 칼이 떨어질 때 창 (playerWindow) · 받은 자세 기억', () => {
  const { w } = script({ wait: 0.2, line: 'highC' });
  assert.ok(w.open, '창');
  assert.equal(w.open.ctx.stance, 'geojeong');
  assert.equal(w.open.ctx.by, 'line');
  assert.ok(Math.abs(w.open.t - SECRET.playerWindow) < 1e-9);
  assert.equal(script({ wait: 0.2, line: 'thrust' }).w.open.ctx.stance, 'eogeo');
  assert.equal(script({ wait: 0.2, line: 'lowR' }).w.open.ctx.stance, 'yoryak');
  assert.equal(script({ wait: 0.2, line: 'highL' }).w.open.ctx.stance, 'bongdu');
});

test('조건 거절: 때 늦음(0.4 s 넘어 닿음) · 스틱이 앞이 아님 · 그사이 베임', () => {
  const late = script({ wait: SECRET.gyeoksal.press + 0.05, line: 'highC' }).w;
  assert.equal(late.open, null);
  assert.equal(late.pc.gk.late, 1);
  const side = script({ wait: 0.2, line: 'highC', stick: [1, 0.5] }).w; // 옆이 더 큼 — '밂'이 아님
  assert.equal(side.open, null);
  assert.equal(side.pc.gk.notFwd, 1);
  const back = script({ wait: 0.2, line: 'highC', stick: [0, -1] }).w;
  assert.equal(back.pc.gk.notFwd, 1);
  const cut = script({ wait: 0.2, line: 'highC', hurtAt: 3 }).w;
  assert.equal(cut.open, null);
  assert.equal(cut.pc.gk.cut, 1);
});

test('줄을 정하기 전(기다림)에 받으면 손에서 가장 가까운 막기 자리로 · 멀면 창 없음 · 동방 막기 I 없으면 창 없음', () => {
  const pads = TRADITIONS.chinese.parry;
  const a = script({ wait: 0.2, hand: pads.lowL }).w;
  assert.equal(a.open.ctx.stance, 'yoryak');
  assert.equal(a.open.ctx.by, 'pad');
  const b = script({ wait: 0.2, hand: [0.3, 0.3] }).w; // 어느 자리에서도 0.15 밖
  assert.equal(b.open, null);
  assert.equal(b.pc.gk.noStance, 1);
  const G = newRound({ weapon: 'qinggang', weapon2: 'longsword', seed: 1, kit: D.kitFromNodes('chinese', new Set(['C1'])) }); // 막기 I 없음
  const w = new PlayerSecretWatch(G.player, G.enemy);
  w.me.parryGuard = { mode: 'defend', defLine: 'highC', held: true };
  assert.equal(w.gyeoksalStance(w.me.parryGuard), null);
});

test('미리 받기: 칼이 붙은 동안 넣은 공격 입력은 떨어지는 순간 격살로 (queued)', () => {
  const { w } = script({ wait: 0.2, line: 'highC', buffer: true });
  assert.ok(w.open && w.queued, '창과 함께 곧장 낼 입력');
  const o = w.fire();
  assert.equal(o.ctx.stance, 'geojeong');
});

test('한 칼 세기: 판정 에너지 × FINISH.power (결정타 hitMul 대신) — 같은 칼 배율 1 보다 심각도가 크다', () => {
  const sev = (pw) => {
    SECRET.gyeoksal.power = pw;
    const G = newRound({ weapon: 'qinggang', weapon2: 'longsword', seed: 1, gap: 1.35 });
    G.ai.update = () => {};
    G.player.skill.autoGuard = true;
    while (G.t < 1.0) G.step();
    assert.ok(G.player.skill.secret({ S: TRADITIONS.chinese.playerSecret, ctx: { slot: 'yoryak', stance: 'yoryak' } }));
    const t0 = G.t;
    while (G.t < t0 + 1.2 && G.player.skill.sec) G.step();
    return G.player.instantResult;
  };
  try {
    const one = sev(1);
    const fin = sev('finish');
    assert.equal(one.aim, 'leg');
    assert.ok(fin.hit && one.hit, '다리를 맞힘');
    assert.ok(fin.sev > one.sev, `${fin.sev} > ${one.sev}`);
    assert.equal(FINISH.power, 2.5);
  } finally {
    SECRET.gyeoksal.power = 'hit';
  }
});

test('스위치: 칼끝 빠르기 몫 SECRET.gyeoksal.share(10/22 확정 0.6) · 어거 길 armPath down · 잔상 굵기 trailWidth', () => {
  assert.equal(SECRET.gyeoksal.share, 0.6); // 10/22 23:0x 사장님 확정 (전 null = 연환 0.3)
  assert.equal(SECRET.gyeoksal.trailWidth, 0);
  assert.equal(SECRET.gyeoksal.armPath, 'across');
  const S = TRADITIONS.chinese.playerSecret;
  assert.equal(S.do.combo.eogeo.seq[0].name, 'gkArm');
  const T = (share) => {
    SECRET.gyeoksal.share = share;
    const G = newRound({ weapon: 'qinggang', weapon2: 'longsword', seed: 1, gap: 1.35 });
    G.ai.update = () => {};
    while (G.t < 1.0) G.step();
    assert.ok(G.player.skill.secret({ S, ctx: { slot: 'yoryak', stance: 'yoryak' } }));
    const t0 = G.t;
    while (G.t < t0 + 1.2 && G.player.skill.sec) G.step();
    arc = G.player.instantArc;
    return G.player.instantResult.T;
  };
  let arc = null;
  try {
    SECRET.gyeoksal.armPath = 'down';
    assert.equal(S.do.combo.eogeo.seq[0].name, 'gkArmDown');
    assert.ok(T(1) < T(null), '고노센 빠르기 몫이면 한 칼이 더 짧다');
    assert.equal(arc.width, undefined); // 잔상 굵기 스위치 끔 = 칼날 전부 (지금 그대로)
    SECRET.gyeoksal.trailWidth = 1;
    T(0.6);
    assert.equal(arc.share, 0.6);
    assert.equal(arc.width, 0.6); // 켬 = 굵기도 빠르기 몫
  } finally {
    SECRET.gyeoksal.share = 0.6;
    SECRET.gyeoksal.armPath = 'across';
    SECRET.gyeoksal.trailWidth = 0;
  }
});

test('스킬트리 C9 막아 죽이기: 열림 · 익히면 비기 몫 · 글은 숫자 없는 온전한 한 문장', () => {
  const n = D.nodeOf('chinese', 'C9');
  assert.equal(D.isClosed('chinese', n), false);
  assert.equal(n.name, '격살');
  assert.ok(!/[0-9]/.test(n.eff) && !/ · /.test(n.eff) && /다$/.test(n.eff), n.eff);
  assert.equal(D.kitFromNodes('chinese', D.allNodeIds('chinese')).secret, true);
});
