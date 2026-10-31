// 대검 겨눔 팔 (사장님 10/31 19:xx '언젠가부터 대검을 이상하게 들더라. 아직도 이런지 확인하고 팔 모양 바로잡아.' — docs/motion/guard_arms_2026-10-31.md · 확인표 3320 ~ 3329)
//   ① 얹은 손가락(SKILL.restTouch 1): 화면에 얹기만 하고 끌지 않은 손가락(main.js handGrip 거짓)이면 쉼 자세(이베리아 곧은 자세 — 10/10 자세표 값)를 놓지 않는다 ·
//      끈 손가락(handGrip 참)은 전처럼 날것 매핑 · 0 = 전 판 · handGrip 없는 몸(AI · 시뮬 대본)은 그대로
//   ② 대검 날것 매핑 배수(SKILL.frameScale 'heavy'): 앞무게 틀은 유파 자세표가 덮기 전 무기 틀 표로 잰다 — 10/10 전 · 롱소드와 같은 0.866 (전 이베리아 0.752 · 일본 대검 0.760) ·
//      다른 유파 무기(打刀 · 레이피어 · 청강검)는 그대로
//   node --test tools/sim/guard_arms.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, DT, THREE, CONFIG } from './harness_m.mjs';

const { SKILL } = CONFIG;
const R2D = 180 / Math.PI;

/** 사람 몸(0 번)을 t 초 세움 — hold 초 전부터 손가락 닿음(grip = handGrip 값, undefined 면 두지 않음). 돌려줌: 칼 올림 °(가슴 틀) · 칼 든 손 앞(m) · 팔꿈치 ° · 쉼 무게 */
function stand(weapon, { t = 4.5, hold = 0, grip } = {}) {
  const G = newRound({ weapon, weapon2: 'longsword', seed: 1 });
  G.parkEnemy = true;
  const f = G.player;
  const n = Math.round(t / DT);
  const nh = Math.round(hold / DT);
  for (let i = 0; i < n; i++) {
    if (hold && i >= n - nh) {
      f.handHeld = true;
      if (grip !== undefined) f.handGrip = grip;
    }
    G.step();
  }
  const q = (b) => { const r = b.rotation(); return new THREE.Quaternion(r.x, r.y, r.z, r.w); };
  const ci = q(f.bodies.chest).invert();
  const ct = f.bodies.chest.translation();
  const W = (b, l) => { const p = b.translation(); return new THREE.Vector3(...l).applyQuaternion(q(b)).add(new THREE.Vector3(p.x, p.y, p.z)); };
  const loc = (v) => v.clone().sub(new THREE.Vector3(ct.x, ct.y, ct.z)).applyQuaternion(ci);
  const d = new THREE.Vector3(0, 1, 0).applyQuaternion(q(f.sword)).applyQuaternion(ci);
  const sh = W(f.bodies.uarmS, [-0.15, 0, 0]), el = W(f.bodies.uarmS, [0.15, 0, 0]), ha = W(f.bodies.farmS, [0.135, 0, 0]);
  const so = W(f.bodies.uarmO, [0, 0.15, 0]), eo = W(f.bodies.uarmO, [0, -0.15, 0]), ho = W(f.bodies.farmO, [0, -0.135, 0]);
  return {
    f,
    el: Math.asin(Math.max(-1, Math.min(1, d.y))) * R2D,
    handFwd: loc(ha).x,
    offFwd: loc(ho).x,
    elbowS: sh.clone().sub(el).angleTo(ha.clone().sub(el)) * R2D,
    elbowO: so.clone().sub(eo).angleTo(ho.clone().sub(eo)) * R2D,
    idle: f.bodyPose.idle,
  };
}
const withSkill = (o, fn) => {
  const old = {};
  for (const k of Object.keys(o)) (old[k] = SKILL[k]), (SKILL[k] = o[k]);
  try { return fn(); } finally { Object.assign(SKILL, old); }
};
const kOf = (weapon) => { const G = newRound({ weapon, weapon2: 'longsword', seed: 1 }); const f = G.player; return f.corrScale(f.skill.level).k; };

test('기본값 — restTouch 1 · frameScale heavy', () => {
  assert.equal(SKILL.restTouch, 1);
  assert.equal(SKILL.frameScale, 'heavy');
});

test('② 대검 배수 = 롱소드 배수 (10/10 전) · off = 10/10 ~ 10/31 판 · 다른 유파 그대로', () => {
  const ls = kOf('longsword');
  for (const w of ['zweihander', 'flamberge', 'tizona', 'durandal', 'monohoshizao']) assert.ok(Math.abs(kOf(w) - ls) < 1e-3, `${w} k ${kOf(w)} ≠ 롱소드 ${ls}`);
  withSkill({ frameScale: 'off' }, () => {
    assert.ok(Math.abs(kOf('zweihander') - 0.752) < 0.002, `off 이베리아 ${kOf('zweihander')}`);
    assert.ok(Math.abs(kOf('monohoshizao') - 0.760) < 0.002, `off 모노호시자오 ${kOf('monohoshizao')}`);
  });
  // 다른 유파 자세표 무기는 'heavy' 에서 그대로 (10/10 ~ 10/31 값)
  for (const [w, k] of [['uchigatana', 0.760], ['rapier', 0.602], ['qinggang', 0.666]]) assert.ok(Math.abs(kOf(w) - k) < 0.002, `${w} ${kOf(w)} ≠ ${k}`);
});

test('① 얹은 손가락 — 이베리아 곧은 자세 그대로 (칼 들림 · 손 얼굴 앞) · 끈 손가락은 날것 · 끄면 전 판', () => {
  const lifted = stand('zweihander');
  const rest = stand('zweihander', { hold: 2, grip: false });
  const grip = stand('zweihander', { hold: 2, grip: true });
  const old = withSkill({ restTouch: 0 }, () => stand('zweihander', { hold: 2, grip: false }));
  // 뗀 손 = 곧은 자세 (자세표 [30, 0] — 칼 무게로 39 ~ 41°)
  assert.ok(lifted.el > 30 && lifted.idle > 0.99, `뗀 손 ${lifted.el.toFixed(1)}° · 쉼 ${lifted.idle}`);
  // 얹은 손가락 = 뗀 손과 같은 자세
  assert.ok(rest.idle > 0.99, `얹음 쉼 무게 ${rest.idle}`);
  assert.ok(Math.abs(rest.el - lifted.el) < 3 && Math.abs(rest.handFwd - lifted.handFwd) < 0.02, `얹음 ${rest.el.toFixed(1)}° · ${rest.handFwd.toFixed(3)} m 대 뗀 손 ${lifted.el.toFixed(1)}° · ${lifted.handFwd.toFixed(3)} m`);
  // 끈 손가락 = 날것 (칼 눕힘 — 패드 (0.15, 0) 는 수평 앞)
  assert.ok(grip.idle < 0.01 && Math.abs(grip.el) < 10, `끈 손가락 ${grip.el.toFixed(1)}° · 쉼 ${grip.idle}`);
  // 전 판 = 얹기만 해도 날것
  assert.ok(old.idle < 0.01 && Math.abs(old.el) < 10, `restTouch 0 ${old.el.toFixed(1)}° · 쉼 ${old.idle}`);
});

test('② 끈 손가락 날것 자세 팔 — 10/10 전 손 자리 · 팔꿈치 펴짐 (전 판 103° → 130° 넘게)', () => {
  const now = stand('zweihander', { hold: 2, grip: true });
  const old = withSkill({ frameScale: 'off' }, () => stand('zweihander', { hold: 2, grip: true }));
  assert.ok(now.handFwd > 0.5 && now.elbowS > 130, `지금 손 ${now.handFwd.toFixed(3)} m · 팔꿈치 ${now.elbowS.toFixed(1)}°`);
  assert.ok(old.handFwd < 0.46 && old.elbowS < 110, `전 판 손 ${old.handFwd.toFixed(3)} m · 팔꿈치 ${old.elbowS.toFixed(1)}°`);
  assert.ok(now.offFwd - old.offFwd > 0.05, `빈손 앞 ${old.offFwd.toFixed(3)} → ${now.offFwd.toFixed(3)} m`);
});

test('handGrip 없는 몸(시뮬 대본 · AI)은 닿음 그대로 = 날것 (관문 · 대본 도구 그대로)', () => {
  const r = stand('zweihander', { hold: 2 });
  assert.ok(r.idle < 0.01, `쉼 무게 ${r.idle}`);
});
