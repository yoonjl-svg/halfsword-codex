// 대기실 고친 것 시험 (docs/import/lobby_fix_2026-10-16.md): 케틀 햇 최대 기력 130 · 스킬북(사기 · 사용/봉인 · 판에서 켜고 끔 · ?uniqueStage) · 이미 받은 인장 → 금화 · 여정 금화 · 머리
//  10/16 08:1x 인장 없앰(docs/strike/school_kit_map.md §3): 인장 셈은 seal_coins.js 의 얼린 상수 · 깬 수는 journey_save.js 통계
//  node --test tools/sim/lobby_fix.test.mjs   (시뮬 판은 tools/sim/harness_m.mjs — 플래그는 main.js newRound 가 플레이어에게만 거는 것과 같은 자리)
import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector2 } from 'three';
const storage = new Map();
globalThis.localStorage = { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: (k) => storage.delete(k) };
const { Stamina } = await import('../../src/stamina.js');
const { STAMINA, GAIT, UNIQUE_ASSIST } = await import('../../src/config.js');
const { readProgress, journeyCoins, rollInt, awardHead, JOURNEY_COINS, PROGRESS_KEY, setCoins } = await import('../../src/lobby_progress.js');
const { BOOK_TIERS, booksOf, bookOf, buyBook, readBooks, bookState, setBookInUse, playerKit, kitUniqueStage, bookTierParam, BOOK_HEAD_PRICE, headPriceOf, BOOK_STATE_KEY } = await import('../../src/skill_books.js');
const { convertSeals, takeSealNotice, sealCount, OLD_SEALS, COINS_PER_SEAL, SEAL_COINS_KEY } = await import('../../src/seal_coins.js');
const { CLEAR_KEY, journeyClears, addJourneyClear } = await import('../../src/journey_save.js');
const { newRound, DT } = await import('./harness_m.mjs');
const { PlayerParryGuard } = await import('../../src/parry_button.js');
const { PlayerUniqueAssist } = await import('../../src/unique_assist.js');
const { PlayerSecretWatch } = await import('../../src/secret.js');
const { TRADITIONS } = await import('../../src/schools.js');

const near = (a, b, e = 1e-7) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);
// 새 기기처럼: 저장을 비우고 모듈이 이번 실행 동안 들고 있는 값도 새 값으로 덮는다(저장이 비면 모듈은 지난 값을 그대로 쓰므로)
const reset = () => {
  storage.clear();
  storage.set(PROGRESS_KEY, JSON.stringify({ version: 1, acquisitions: [], coins: 100, heads: 0, titles: [], title: '여행자' }));
  storage.set(BOOK_STATE_KEY, JSON.stringify({ version: 1, sealed: [] }));
  readProgress(); readBooks();
};
function actor(extra = {}) {
  const pos = { x: 0, y: 1, z: 0 };
  const f = { alive: true, armed: true, state: 'stand', heading: 0, swordMass: 1.6, move: new Vector2(), handOffset: new Vector2(), skill: { vel: new Vector2(), swinging: false }, bodies: { pelvis: { translation: () => pos } }, ...extra };
  f.stamina = new Stamina(f); f.pos = pos; return f;
}
const tick = (f, seconds, dt = 1 / 120) => { for (let t = 0; t < seconds - 1e-9; t += dt) f.stamina.step(Math.min(dt, seconds - t)); };

// ── 케틀 햇 '생존술: 기력 +30' (사장님 10/16 03:5x) ──
test('케틀 햇: 최대 130에서 시작 · 130까지만 회복 · 문턱 0 / STAMINA.severeAt / STAMINA.floor 그대로 · 막대 = 130의 몫', () => {
  const f = actor(); f.stamina.setMaxBonus(30);
  near(f.stamina.max, 130); near(f.stamina.value, 130); near(f.stamina.ratio, 1);
  f.stamina.spend('attack', 70); near(f.stamina.value, 60); near(f.stamina.ratio, 60 / 130); assert.equal(f.stamina.level, 0);
  tick(f, 10); near(f.stamina.value, 130); // 사람 회복 21/s — 130에서 멈춤
  f.stamina.spend('attack', 130.5); assert.equal(f.stamina.level, 1); // −0.5: 지침
  f.stamina.spend('attack', 40); assert.equal(f.stamina.level, 2); // −40.5: 심한 지침 (severeAt −35 아래)
  f.stamina.spend('attack', 40); assert.equal(f.stamina.exhausted, true); near(f.stamina.value, STAMINA.floor); // −80.5 → floor(−70)에서 멈춤 · 탈진
  const plain = actor(); near(plain.stamina.max, 100); near(plain.stamina.value, 100); // 덧 없는 몸(AI · 그 밖)은 100 그대로
});
test('기력 끔(?stamina=0)이면 덧 없이 100 — 지금 판 그대로', () => {
  try {
    STAMINA.on = false;
    const f = actor(); f.stamina.setMaxBonus(30); near(f.stamina.max, 100); near(f.stamina.value, 100);
    tick(f, 0.5); near(f.stamina.value, 100); near(f.stamina.ratio, 1);
  } finally { STAMINA.on = true; }
});
test('실제 판: 케틀 햇 플레이어는 130까지 회복, 상대는 100', () => {
  const g = newRound({ weapon: 'longsword', seed: 7 });
  try {
    g.ai.update = () => {}; g.player.stamina.setMaxBonus(30);
    for (let i = 0; i < 240; i++) g.step();
    for (const f of [g.player, g.enemy]) { f.stamina.value = 20; f.stamina.rest = 0; }
    for (let i = 0; i < 1200; i++) g.step();
    near(g.player.stamina.value, 130, 1e-5); near(g.enemy.stamina.value, 100, 1e-5);
  } finally { g.world.free(); }
});

// ── 스킬북: 사기 · 사용 / 봉인 (사장님 10/16 04:1x · 04:3x) ──
test('책 값 100~500 · 산 책만 열림 · 금화가 모자라면 못 삼 · 새 책은 사용 · 봉인/사용', () => {
  reset();
  assert.deepEqual(BOOK_TIERS.map((b) => b.price), [100, 200, 300, 400, 500]);
  assert.equal(booksOf('german').length, 5);
  assert.equal(bookOf('german', 1).title, '보법: 리히테나워');
  assert.equal(bookOf('japanese', 5).title, '비기: 뒤에서 앞서기');
  assert.equal(bookOf('german', 3).list.length, 4); assert.equal(bookOf('german', 3).provisional, true);
  assert.equal(bookOf('italian', 4).planned, true);
  assert.equal(readProgress().coins, 100);
  let books = readBooks(); assert.equal(bookState(books, 'german:1'), 'unowned');
  assert.equal(buyBook('german', 2).why, 'coins'); // 200 > 100
  const r = buyBook('german', 1); assert.equal(r.ok, true); assert.equal(readProgress().coins, 0); assert.equal(readProgress().level, 2);
  assert.equal(buyBook('german', 1).why, 'owned');
  books = readBooks(); assert.equal(bookState(books, 'german:1'), 'use');
  setBookInUse('german:1', false); assert.equal(bookState(readBooks(), 'german:1'), 'sealed');
  assert.deepEqual(JSON.parse(storage.get(BOOK_STATE_KEY)), { version: 1, sealed: ['german:1'] });
  setBookInUse('german:1', true); assert.equal(bookState(readBooks(), 'german:1'), 'use');
  assert.equal(BOOK_HEAD_PRICE, null); assert.equal(headPriceOf(1), null); // 머리로 사기는 사장님 확인 전 — 꺼 둠
});
test('playerKit: 산 책이 사용일 때만 켬 · 봉인·안 삼은 끔 · 테스트 경로 모두 켬 · 무유파 null', () => {
  const books = { owned: new Set(['italian:1', 'italian:3', 'italian:5']), sealed: new Set(['italian:5']) };
  assert.deepEqual(playerKit('italian', books), { footwork: true, parry: false, unique: true, passive: false, secret: false });
  assert.deepEqual(playerKit('italian', { owned: new Set(), sealed: new Set() }), { footwork: false, parry: false, unique: false, passive: false, secret: false });
  assert.deepEqual(playerKit('japanese', { owned: new Set(), sealed: new Set() }, { test: true }), { footwork: true, parry: true, unique: true, passive: true, secret: true });
  assert.equal(playerKit('none', books), null);
  assert.equal(kitUniqueStage({ unique: true }), 4); assert.equal(kitUniqueStage({ unique: false }), 0);
});
test('개발 인자 ?uniqueStage=N: 0 = 책 없음 · N 급까지 · 5 = 모두 — 산 책·테스트 경로보다 먼저 · 범위 밖은 산 책대로', () => {
  assert.deepEqual([null, '', '0', '2', '5', '6', '-1', '2.5', 'x'].map(bookTierParam), [null, null, 0, 2, 5, null, null, null, null]);
  const none = { owned: new Set(), sealed: new Set() };
  const all = { owned: new Set([1, 2, 3, 4, 5].map((t) => `german:${t}`)), sealed: new Set() };
  assert.deepEqual(playerKit('german', all, { upTo: 0 }), { footwork: false, parry: false, unique: false, passive: false, secret: false });
  assert.deepEqual(playerKit('german', none, { upTo: 2 }), { footwork: true, parry: true, unique: false, passive: false, secret: false }); // 10/16 전 주소 판 기본(보법·막기 늘 켬 · 깬 수 0)과 같은 몫
  assert.deepEqual(playerKit('japanese', none, { upTo: 5 }), { footwork: true, parry: true, unique: true, passive: true, secret: true });
  assert.deepEqual(playerKit('japanese', none, { test: true, upTo: 1 }), { footwork: true, parry: false, unique: false, passive: false, secret: false }); // ?uniqueStage 가 테스트 경로를 덮는다 (10/13 차례)
  assert.equal(kitUniqueStage(playerKit('german', none, { upTo: 3 })), 4); assert.equal(kitUniqueStage(playerKit('german', all, { upTo: 2 })), 0);
  assert.equal(playerKit('none', all, { upTo: 5 }), null);
});
test('실제 판: 보법 봉인 = 기본 걸음 (일본 버티기·낮은 자세·걷기 기력 2.1 없음), 사용 = 유파 걸음', () => {
  for (const on of [true, false]) {
    const g = newRound({ weapon: 'monohoshizao', seed: 3, onFighter: (f) => { if (f.index === 0 && !on) f.schoolFootwork = false; } });
    try {
      g.ai.update = () => {}; g.step();
      const P = g.player.gait.P;
      if (on) { assert.equal(P.tradition, 'japanese'); near(g.player.swayScale, 0.75); }
      else { assert.equal(P, GAIT); near(g.player.swayScale, 1); }
      assert.equal(g.enemy.gait.P.tradition, 'japanese'); // 상대(AI)는 그대로
    } finally { g.world.free(); }
  }
  // 걷기 기력: 보법 몫 — 봉인한 플레이어는 보통 1.4 (0.62 m 마다)
  for (const [flag, want] of [[undefined, 2.1], [false, 1.4]]) {
    const f = actor({ swordArt: { tradition: 'japanese' }, schoolFootwork: flag, aiControlled: false });
    f.move.set(0, 1); f.stamina.step(1 / 120); f.pos.z = 0; f.pos.x = 0;
    for (let i = 0; i < 40; i++) { f.pos.x += 0.0175; f.stamina.step(1 / 120); } // 0.7 m 앞으로 (heading 0 = +x)
    near(f.stamina.spent.move, want, 1e-9);
  }
});
test('실제 판: 막기 봉인 = 무유파 막기 자리·덧씌우기 없음 (일본 · 동방), 사용 = 유파 자리', () => {
  for (const [weapon, line] of [['monohoshizao', 'lowR'], ['qinggang', 'highR']]) {
    for (const on of [true, false]) {
      const g = newRound({ weapon, seed: 5, onFighter: (f) => { if (f.index === 0 && !on) f.schoolParry = false; } });
      try {
        const guard = new PlayerParryGuard(g.player, g.enemy);
        const want = on ? g.player.swordArt.school.parry[line] : TRADITIONS.none.parry[line];
        assert.deepEqual(guard.padOf(line), want);
        if (weapon === 'qinggang') assert.equal(guard.nameOf(line)?.name === TRADITIONS.chinese.parryCover.highR?.name, on && !!TRADITIONS.chinese.parryCover.highR);
      } finally { g.world.free(); }
    }
  }
  assert.notDeepEqual(TRADITIONS.japanese.parry.lowR, TRADITIONS.none.parry.lowR); // 일본은 자리가 실제로 다르다
});
test('실제 판: 고유자세 · 비기 봉인 = 고유 공격 없음 · 비기 창 없음', () => {
  const g = newRound({ weapon: 'longsword', seed: 9 });
  try {
    const on = new PlayerUniqueAssist(g.player, { stage: kitUniqueStage({ unique: true }) });
    assert.equal(on.list.length, 4); assert.equal(g.player.skill.uniq, on);
    const off = new PlayerUniqueAssist(g.player, { stage: kitUniqueStage({ unique: false }) });
    assert.equal(off.list.length, 0); assert.equal(g.player.skill.uniq, null);
    assert.equal(new PlayerSecretWatch(g.player, g.enemy, { locked: true }).S, null);
    assert.equal(new PlayerSecretWatch(g.player, g.enemy, { locked: false }).S, TRADITIONS.german.secret);
  } finally { g.world.free(); }
});

// ── 이미 받은 인장 → 금화 (사장님 10/16 04:2x · 08:1x 인장 없앰 — 한 번만) ──
test('인장 → 금화: 한 번만 · 인장 0 = 없음 · 인장 25 = 2,500 · 바꾼 뒤 깬 무대는 안 바꿈 · 옛 셈은 얼린 상수', () => {
  assert.deepEqual(OLD_SEALS, { clearsPerSeal: 10, max: 25 }); assert.equal(Object.isFrozen(OLD_SEALS), true); assert.equal(COINS_PER_SEAL, 100);
  assert.deepEqual([0, 9, 10, 35, 37, 249, 250, 999].map(sealCount), [0, 0, 1, 3, 3, 24, 25, 25]);
  reset(); storage.set(CLEAR_KEY, '0');
  assert.deepEqual(convertSeals(), { seals: 0, coins: 0, first: true }); assert.equal(readProgress().coins, 100);
  assert.deepEqual(convertSeals(), { seals: 0, coins: 0, first: false }); // 기록이 생겼다 — 다시 안 함
  reset(); storage.set(CLEAR_KEY, '250'); // 인장 25
  assert.deepEqual(convertSeals(), { seals: 25, coins: 2500, first: true }); assert.equal(readProgress().coins, 2600);
  assert.deepEqual(convertSeals(), { seals: 0, coins: 0, first: false }); assert.equal(readProgress().coins, 2600); // 새로 고침해도 한 번
  assert.deepEqual(JSON.parse(storage.get(SEAL_COINS_KEY)).converted, 25);
  reset(); storage.set(CLEAR_KEY, '35'); // 인장 3
  assert.equal(convertSeals().coins, 300); assert.equal(readProgress().coins, 400);
  storage.set(CLEAR_KEY, '52'); // 바꾼 뒤에 깬 무대 — 인장이 없으니 그대로
  assert.equal(convertSeals().coins, 0); assert.equal(readProgress().coins, 400);
});
test('이미 바꾼 기록(10/16 04:5x 판이 남긴 꼴)이 있으면 깬 수가 늘어도 다시 안 줌 · 깬 수는 통계로 셈', () => {
  reset(); storage.set(CLEAR_KEY, '120');
  storage.set(SEAL_COINS_KEY, JSON.stringify({ version: 1, converted: 3, at: '2026-10-16' }));
  assert.deepEqual(convertSeals(), { seals: 0, coins: 0, first: false }); assert.equal(readProgress().coins, 100);
  assert.equal(journeyClears(), 120); assert.equal(addJourneyClear(), 121); assert.equal(storage.get(CLEAR_KEY), '121');
  assert.deepEqual(convertSeals(), { seals: 0, coins: 0, first: false }); assert.equal(readProgress().coins, 100);
});

test('바꾼 알림은 한 번: 판을 처음 연 때 바꾸고(어느 길이든) 다음 대기실이 한 번 알림 · 인장 0 · 04:5x 기록은 알림 없음 · 바꾼 뒤 깬 무대는 안 바꿈', () => {
  reset(); storage.set(CLEAR_KEY, '35'); // 인장 3 — 옛 메뉴·주소 판으로 먼저 연 사람 (main.js 가 판을 열 때 바꿈)
  assert.deepEqual(convertSeals(), { seals: 3, coins: 300, first: true }); assert.equal(readProgress().coins, 400);
  assert.equal(JSON.parse(storage.get(SEAL_COINS_KEY)).notice, true);
  addJourneyClear(); addJourneyClear(); assert.equal(journeyClears(), 37); // 그 뒤 주소 판에서 깬 무대 — 금화가 안 된다
  assert.deepEqual(convertSeals(), { seals: 0, coins: 0, first: false }); assert.equal(readProgress().coins, 400);
  assert.deepEqual(takeSealNotice(), { seals: 3, coins: 300 }); // 대기실: 알림 한 번
  assert.equal(takeSealNotice(), null); assert.equal(JSON.parse(storage.get(SEAL_COINS_KEY)).notice, false);
  reset(); storage.set(CLEAR_KEY, '9'); // 인장 0 — 기록만, 알림 없음
  assert.deepEqual(convertSeals(), { seals: 0, coins: 0, first: true }); assert.equal(takeSealNotice(), null);
  storage.set(CLEAR_KEY, '10'); assert.deepEqual(convertSeals(), { seals: 0, coins: 0, first: false }); assert.equal(takeSealNotice(), null);
  reset(); storage.set(SEAL_COINS_KEY, JSON.stringify({ version: 1, converted: 3, at: '2026-10-16' })); // 04:5x 판 기록 — 그때 이미 알림을 봄
  assert.equal(takeSealNotice(), null);
});

// ── 여정 금화 · 머리 (사장님 10/16 04:3x) ──
test('판 끝 금화: 이기면 +5~15 · 지면 −1~5 (정수) · 0 아래로 안 내려감', () => {
  assert.deepEqual(JOURNEY_COINS, { win: [5, 15], loss: [1, 5] });
  reset();
  assert.deepEqual(journeyCoins(true, (lo) => lo).delta, 5); assert.deepEqual(journeyCoins(true, (lo, hi) => hi).delta, 15);
  assert.equal(readProgress().coins, 120);
  assert.equal(journeyCoins(false, (lo, hi) => hi).delta, -5); assert.equal(readProgress().coins, 115);
  setCoins(3); assert.equal(journeyCoins(false, (lo, hi) => hi).delta, -3); assert.equal(readProgress().coins, 0); // 바닥 0
  assert.equal(journeyCoins(false, (lo, hi) => hi).delta, 0); assert.equal(readProgress().coins, 0);
  const seen = { win: new Set(), loss: new Set() };
  for (let i = 0; i < 3000; i++) { seen.win.add(rollInt(5, 15)); seen.loss.add(rollInt(1, 5)); }
  assert.deepEqual([...seen.win].sort((a, b) => a - b), [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  assert.deepEqual([...seen.loss].sort((a, b) => a - b), [1, 2, 3, 4, 5]);
});
test('머리: 상대의 목을 베면 1 — 한 상대에 한 번 (같은 몸이 두 번 알려도)', () => {
  reset();
  const foe = {}, other = {};
  assert.equal(awardHead(foe), true); assert.equal(awardHead(foe), false); assert.equal(readProgress().heads, 1);
  assert.equal(awardHead(other), true); assert.equal(readProgress().heads, 2);
  assert.equal(JSON.parse(storage.get(PROGRESS_KEY)).heads, 2);
});
test('실제 판: 참수 훅은 판의 상대에게 한 번 — 흙 몸 머리 떨어짐 길로 부른다', async () => {
  const { COMBAT_HOOKS } = await import('../../src/combat.js');
  reset();
  const g = newRound({ weapon: 'longsword', seed: 11 });
  let calls = 0;
  try {
    COMBAT_HOOKS.onDecapitate = (f) => { calls++; if (f === g.enemy) awardHead(f); };
    g.enemy.detachHeadFromWound({ severity: 1, zone: 'neck', finishPower: false });
    g.enemy.detachHeadFromWound({ severity: 1, zone: 'neck', finishPower: false }); // 두 번째는 decapitate 가 거절(이미 뗌) — 훅도 안 부른다
    assert.equal(calls, 1); assert.equal(g.enemy.decapitated, true); assert.equal(readProgress().heads, 1);
  } finally { COMBAT_HOOKS.onDecapitate = null; g.world.free(); }
});
