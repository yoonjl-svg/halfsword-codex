// 생사전 ↔ 싸움 엔진 잇기 (동시 대전 3 · 6단계 10/29 — src/saengsa_match.js · main.js game.launchSaengsa · docs/strike/team_fight_2026-10-29.md §11)
//  가짜 setup(생사전 가지 docs/design/saengsa_2026-10-29.md §8 꼴)으로:
//  ① 자리 차례 · 편 · 사람 몸 · 조종(지켜보기로 떨어짐) · 죽은 사람 빠짐 (2:2 · 2:1 · 1:2)
//  ② 체력 ↔ 피 · 부상 → 닫힌 상처(carried) · 팔다리 기능
//  ③ 진짜 몸에서 사본 → 입힘 → 사본 = 같은 값 (난수 없음) · 칼 쥔 팔이 문턱 밑이면 처음부터 칼을 놓침
//  ⑥ 부러진 무기는 그 대회 끝까지 (사장님 10/29 20:1x): weapon { id, broken } → 처음부터 부러진 무기 = 싸움에서 부러질 때와 같은 몸 · 결과 weaponBroken
//  ④ 결과 꼴 { winner, fighters { key: { hp, injuries, alive, weaponBroken } } } — 들어올 때 상처는 다시 세지 않음 · 둘 다 쓰러지면 피가 더 남은 편
//  node --test tools/sim/saengsa_match.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newMatch, CONFIG } from './jelly_harness.mjs';
import { specFromSetup, snapshotFromPerson, bloodFromHp, hpFromFighter, resultFromMatch, fallbackInjuries, profOfEntry, weaponOfPerson, INJURY_WOUND, HP_MAX } from '../../src/saengsa_match.js';
import { WOUND_LIMB, LIMB_LOSS } from '../../src/fighter.js';

const V = CONFIG.VITALS;
const person = (key, id, extra = {}) => ({ key, id, weapon: 'longsword', school: 'german', tier: 1, prof: { german: 3, none: 1 }, lent: false, hp: 100, injuries: [], dead: false, ...extra });

/** 가짜 setup: 내 편 b (나 + 동료) 대 a (무명 둘 — 하나는 죽어 빠짐 · 하나 남음 + 인물 하나) */
function fakeSetup(over = {}) {
  return {
    matchId: 'r1-m2',
    round: 1,
    seed: 77,
    mineSide: 'b',
    entrants: { a: ['3-0', '3-1'], b: ['0-1', '0-0'] },
    sides: {
      a: [person('3-0', 'nameless', { cloth: 4 }), person('3-1', 'sigmund', { hp: 60, injuries: [{ part: 'leg', sev: 0.5, rests: 1 }] }), person('3-2', 'nameless', { dead: true })],
      b: [person('0-0', 'player', { hp: 80, injuries: [{ part: 'arm', sev: 0.3, rests: 0 }] }), person('0-1', 'nameless', { cloth: 2 })],
    },
    control: 'player',
    ...over,
  };
}

test('① 자리 차례 · 편 · 사람 몸 · 조종', () => {
  const s = specFromSetup(fakeSetup());
  assert.equal(s.control, 'player');
  assert.equal(s.mineSide, 'b');
  assert.equal(s.matchId, 'r1-m2');
  assert.equal(s.seed, 77);
  assert.deepEqual(s.fighters.map((e) => [e.index, e.team, e.key, e.human]), [
    [0, 0, '0-0', true], // 내가 나서면 내 편 첫째 = 나 (entrants 차례와 상관없이)
    [1, 1, '3-0', false],
    [2, 0, '0-1', false],
    [3, 1, '3-1', false],
  ]);
  // 지켜보기: 사람 몸 없음 · 자리 차례는 entrants 차례
  const w = specFromSetup(fakeSetup({ control: 'watch' }));
  assert.equal(w.control, 'watch');
  assert.deepEqual(w.fighters.map((e) => [e.key, e.human]), [['0-1', false], ['3-0', false], ['0-0', false], ['3-1', false]]);
  // 'player' 인데 내 사람이 안 나서면 지켜보기로
  const n = specFromSetup(fakeSetup({ entrants: { a: ['3-0', '3-1'], b: ['0-1'] } }));
  assert.equal(n.control, 'watch');
  assert.ok(n.fighters.every((e) => !e.human));
  // 2:1 · 1:2: 자리는 0 부터 빈틈없이 · 편은 칸에
  assert.deepEqual(n.fighters.map((e) => [e.index, e.team]), [[0, 0], [1, 1], [2, 1]]);
  const one = specFromSetup(fakeSetup({ entrants: { a: ['3-0'], b: ['0-0', '0-1'] } }));
  assert.deepEqual(one.fighters.map((e) => [e.index, e.team, e.key]), [[0, 0, '0-0'], [1, 1, '3-0'], [2, 0, '0-1']]);
  // 죽은 사람은 나서지 않는다
  const dead = specFromSetup(fakeSetup({ entrants: { a: ['3-2', '3-0'], b: ['0-0'] } }));
  assert.deepEqual(dead.fighters.map((e) => e.key), ['0-0', '3-0']);
  // 숙련도 = 생사전 profFor 셈 (무기 유파 칸 · 무유파 무기는 다섯 가운데 가장 높은 값 − 1 · 그 밖엔 0)
  assert.equal(profOfEntry({ school: 'german', prof: { german: 3 } }), 3);
  assert.equal(profOfEntry({ school: 'italian', prof: { german: 3 } }), 0);
  assert.equal(profOfEntry({ school: 'none', prof: { german: 3, japanese: 4 } }), 3);
  assert.equal(profOfEntry({ school: 'none', prof: { none: 2, german: 4 } }), 2);
});

test('② 체력 ↔ 피 · 부상 → 닫힌 상처', () => {
  assert.equal(bloodFromHp(100), 1);
  assert.equal(bloodFromHp(0), V.collapseBlood);
  assert.equal(bloodFromHp(undefined), 1);
  const s = snapshotFromPerson(person('0-0', 'player', { hp: 50, injuries: [{ part: 'arm', sev: 0.5, rests: 0 }, { part: 'head', sev: 0.2, rests: 1 }, { part: 'leg', sev: 0, rests: 0 }] }));
  assert.ok(Math.abs(s.blood - (V.collapseBlood + (1 - V.collapseBlood) * 0.5)) < 1e-12);
  assert.equal(s.bleed, 0);
  assert.deepEqual(s.wounds.map((w) => [w.part, w.severity, w.bleed, w.carried]), [[INJURY_WOUND.arm, 0.5, 0, true], [INJURY_WOUND.head, 0.2, 0, true]]);
  assert.equal(WOUND_LIMB[INJURY_WOUND.arm], 'armO'); // 칼 안 든 팔 — 처음부터 칼을 놓치지 않게
  assert.equal(s.limbs.armO, 1 - 0.5 * LIMB_LOSS);
  assert.equal(s.limbs.armS, 1);
});

test('③ 진짜 몸: 사본 → 입힘 → 사본 = 같은 값 · 칼 쥔 팔이 문턱 밑이면 칼을 놓침', () => {
  const p = person('0-0', 'player', { hp: 35, injuries: [{ part: 'arm', sev: 0.6, rests: 0 }, { part: 'leg', sev: 0.4, rests: 2 }, { part: 'torso', sev: 0.3, rests: 0 }] });
  const A = newMatch({ seed: 3, count: 4 });
  const f = A.fighters[2];
  f.applySnapshot(snapshotFromPerson(p));
  const s1 = f.snapshot();
  assert.equal(s1.wounds.length, 3);
  assert.ok(s1.wounds.every((w) => w.carried && w.bleed === 0));
  const B = newMatch({ seed: 9, count: 4 });
  const g = B.fighters[1];
  g.applySnapshot(s1);
  assert.deepEqual(g.snapshot(), s1);
  // 두 번 돌려도 같은 값 (난수 없음)
  const C = newMatch({ seed: 3, count: 4 });
  C.fighters[2].applySnapshot(snapshotFromPerson(p));
  assert.deepEqual(C.fighters[2].snapshot(), s1);
  // 칼 쥔 팔 기능이 문턱 밑인 사본 → 처음부터 칼을 놓침 (싸움 상처와 같은 규칙)
  const D = newMatch({ seed: 4 });
  const h = D.fighters[0];
  assert.equal(h.armed, true);
  h.applySnapshot({ ...s1, limbs: { ...s1.limbs, armS: V.dropSwordArm - 0.01 } });
  assert.equal(h.armed, false);
  // 사본 없이 = 아무것도 안 바뀜
  const E = newMatch({ seed: 5 });
  const before = E.fighters[0].snapshot();
  E.fighters[0].applySnapshot(null);
  assert.deepEqual(E.fighters[0].snapshot(), before);
});

test('④ 결과 꼴 · 들어올 때 상처는 다시 세지 않음 · 둘 다 쓰러지면 피가 더 남은 편', () => {
  const spec = specFromSetup(fakeSetup());
  // 판 끝 몸 (가짜): 0 = 나 (들어올 때 팔 상처 + 새 다리 상처) · 1 = 죽음 · 2 = 멀쩡 · 3 = 긁힘만
  const fake = [
    { team: 0, alive: true, blood: bloodFromHp(40), wounds: [...spec.fighters[0].snapshot.wounds, { part: 'shinF', severity: 0.45 }] },
    { team: 1, alive: false, blood: 0.3, wounds: [{ part: 'neck', severity: 0.9 }] },
    { team: 0, alive: true, blood: 1, wounds: [] },
    { team: 1, alive: true, blood: V.collapseBlood + 0.001, wounds: [{ part: 'chest', severity: 0.05 }] },
  ];
  const res = resultFromMatch(spec, fake, 0);
  assert.equal(res.winner, 'b'); // 내 편(0 편) = mineSide
  assert.deepEqual(Object.keys(res.fighters).sort(), ['0-0', '0-1', '3-0', '3-1']);
  assert.deepEqual(res.fighters['0-0'], { hp: 40, alive: true, broken: false, weaponBroken: false, injuries: [{ part: 'arm', sev: 0.3, rests: 0 }, { part: 'leg', sev: 0.45, rests: 0 }] }); // 팔(들어올 때) 그대로 · 다리 새로
  assert.deepEqual(res.fighters['3-0'], { hp: 0, alive: false, broken: false, weaponBroken: false, injuries: [{ part: 'head', sev: 0.9, rests: 0 }] });
  assert.deepEqual(res.fighters['0-1'], { hp: HP_MAX, alive: true, broken: false, weaponBroken: false, injuries: [] });
  // 이름: 무명 검객 = '무명 검객 ' + tag · 사람 name 이 있으면 그것 · 나(사람 몸)는 main.js 가 '나'
  const named = specFromSetup({ ...fakeSetup(), sides: { ...fakeSetup().sides, a: [person('3-0', 'nameless', { tag: '오토' }), person('3-1', 'sigmund', { name: '지그문트' })] } });
  assert.deepEqual(named.fighters.map((e) => [e.key, e.name]), [['0-0', undefined], ['3-0', '무명 검객 오토'], ['0-1', undefined], ['3-1', '지그문트']]);
  assert.equal(res.fighters['3-1'].hp, 1); // 살아 있으면 적어도 1
  assert.deepEqual(res.fighters['3-1'].injuries, [{ part: 'leg', sev: 0.5, rests: 1 }]); // 긁힘(0.1 밑)은 뺌 · 들어올 때 부상 그대로
  assert.equal(resultFromMatch(spec, fake, 1).winner, 'a');
  // 둘 다 쓰러짐(winnerTeam null): 피 합이 많은 편 · 같으면 상대
  const dead = fake.map((f) => ({ ...f, alive: false }));
  assert.equal(resultFromMatch(spec, dead, null).winner, 'b');
  const even = fake.map((f) => ({ ...f, alive: false, blood: 0.5 }));
  assert.equal(resultFromMatch(spec, even, null).winner, 'a');
  // 생사전 쪽 함수를 주면 그것을 쓴다
  const seen = [];
  resultFromMatch(spec, fake, 0, (prior, w) => (seen.push(w.length), []));
  assert.deepEqual(seen, [1, 1, 0, 1]);
  // 같은 부위에 또 다치면 더 깊은 쪽 · 쉰 수 0
  assert.deepEqual(fallbackInjuries([{ part: 'leg', sev: 0.5, rests: 2 }], [{ part: 'thighB', severity: 0.3 }]), [{ part: 'leg', sev: 0.5, rests: 0 }]);
  assert.deepEqual(fallbackInjuries([{ part: 'leg', sev: 0.2, rests: 2 }], [{ part: 'footB', severity: 0.6 }]), [{ part: 'leg', sev: 0.6, rests: 0 }]);
});

test('⑤ hpFromFighter: 죽음 0 · 산 몸 1 ~ 100 정수', () => {
  assert.equal(hpFromFighter({ alive: false, blood: 1 }), 0);
  assert.equal(hpFromFighter({ alive: true, blood: 1 }), 100);
  assert.equal(hpFromFighter({ alive: true, blood: 0.2 }), 1);
  assert.equal(hpFromFighter({ alive: true, blood: bloodFromHp(73) }), 73);
});

test('⑥ 부러진 무기: 처음부터 부러짐 = 싸움에서 부러질 때와 같은 몸 · 난수 없음 · 결과 weaponBroken', () => {
  // setup 꼴: weapon 이 id 문자열이든 { id, broken } 이든
  assert.deepEqual(weaponOfPerson({ weapon: 'rapier' }), { id: 'rapier', broken: false });
  assert.deepEqual(weaponOfPerson({ weapon: { id: 'rapier', broken: true } }), { id: 'rapier', broken: true });
  assert.deepEqual(weaponOfPerson({ weapon: 'rapier', broken: true }), { id: 'rapier', broken: true }); // 생사전 가지 꼴 (사람 broken)
  const setup = fakeSetup();
  setup.sides.b[1].weapon = { id: 'rapier', broken: true }; // 0-1 무명 검객 — 지난 경기에서 부러진 레이피어
  const spec = specFromSetup(setup);
  const e = spec.fighters.find((x) => x.key === '0-1');
  assert.equal(e.weapon, 'rapier');
  assert.equal(e.weaponBroken, true);
  assert.equal(e.snapshot.weaponBroken, true);
  assert.equal(spec.fighters.find((x) => x.key === '0-0').snapshot.weaponBroken, false);
  // 진짜 몸: 사본으로 부러진 칼 = 싸움 중 breakWeapon() 과 같은 칼 길이 · 질량 · 관성 · 콜라이더
  const body = (f) => ({
    broken: f.weaponBroken, blade: f.weaponCfg.bladeLength, hilt: f.weaponCfg.hiltLength, mass: f.swordMass, I: { ...f.swordProps.I }, com: f.swordCom, Ihand: f.swordIhand, twist: f.twistScale,
    cols: f.swordColliders.map((c) => [c.collisionGroups(), c.mass(), c.translationWrtParent?.()?.y ?? null]),
  });
  for (const w of ['rapier', 'longsword', 'morgenstern', 'zweihander']) {
    const A = newMatch({ seed: 2, count: 4, weapons: [w, w, w, w] });
    A.fighters[2].applySnapshot(snapshotFromPerson({ hp: 100, injuries: [], weapon: { id: w, broken: true } }));
    const B = newMatch({ seed: 2, count: 4, weapons: [w, w, w, w] });
    B.fighters[2].breakWeapon();
    assert.equal(A.fighters[2].weaponBroken, true, w);
    assert.deepEqual(body(A.fighters[2]), body(B.fighters[2]), `${w}: 사본으로 부러짐 = 싸움 중 부러짐`);
    assert.ok(A.fighters[2].weaponCfg.bladeLength < A.fighters[0].weaponCfg.bladeLength || w === 'morgenstern', w);
    assert.ok(A.fighters[2].swordMass < A.fighters[0].swordMass, `${w} 질량`);
    // 다시 한 판: 같은 값 (난수 없음) · 사본 → 입힘 → 사본 같음
    const C = newMatch({ seed: 7, count: 4, weapons: [w, w, w, w] });
    const s1 = A.fighters[2].snapshot();
    C.fighters[2].applySnapshot(s1);
    assert.deepEqual(C.fighters[2].snapshot(), s1);
    assert.deepEqual(body(C.fighters[2]), body(A.fighters[2])); // 다른 판 씨앗 · 같은 자리
  }
  // 부러질 수 없는 무기(싸움에서도 안 부러짐 — 휘는 마디 무기 포함)는 그대로
  for (const w of ['druid_whip', 'excalibur', 'frozen_tuna']) {
    const A = newMatch({ seed: 3, weapons: [w, w] });
    const before = body(A.fighters[0]);
    A.fighters[0].applySnapshot(snapshotFromPerson({ hp: 100, injuries: [], weapon: { id: w, broken: true } }));
    assert.equal(A.fighters[0].weaponBroken, false, w);
    assert.deepEqual(body(A.fighters[0]), before, w);
  }
  // 결과: 판 끝 weaponBroken (이번 판에 부러진 것 · 들고 들어온 것 모두)
  const fake = spec.fighters.map((x, i) => ({ team: x.team, alive: true, blood: 1, wounds: [], weaponBroken: i === 0 || x.weaponBroken }));
  const res = resultFromMatch(spec, fake, 0);
  assert.deepEqual(Object.fromEntries(Object.entries(res.fighters).map(([k, v]) => [k, v.weaponBroken])), { '0-0': true, '3-0': false, '0-1': true, '3-1': false });
  assert.ok(Object.values(res.fighters).every((v) => v.broken === v.weaponBroken)); // 생사전 가지는 broken 을 읽음
});
