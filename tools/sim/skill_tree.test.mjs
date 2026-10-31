// 스킬트리 시험 (10/21 사장님 확정 — docs/design/skill_tree_2026-10-21/IMPLEMENTATION.md): 설계 자료와 같은가 · 앞 칸(독일 관문 · 이탈리아 줄기 · 이베리아 패시브) · 닫힌 칸 ·
//  금화 · 머리로 배우기 · 유파 초기화(돌려받기 · 머리 1) · 레벨 · 옛 스킬북 옮기기(돌려주기 + 500 · 한 번 · 저장 막힘) · 편지 뽑기 셈 · 칸 → 판 몫(칸 하나 = 제 몫 하나 — 실제 몸에서)
//  node --test tools/sim/skill_tree.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
const storage = new Map();
let blockWrite = false, blockRead = false;
globalThis.localStorage = {
  getItem: (k) => { if (blockRead) throw Error('blocked'); return storage.get(k) ?? null; },
  setItem: (k, v) => { if (blockWrite) throw Error('blocked'); storage.set(k, String(v)); },
  removeItem: (k) => { if (blockWrite) throw Error('blocked'); storage.delete(k); },
};
const { SCHOOLS: DESIGN } = await import('../../docs/design/skill_tree_2026-10-21/data.mjs');
const D = await import('../../src/skill_tree_data.js');
const S = await import('../../src/skill_tree_store.js');
const { readProgress, recordAcquisition, PROGRESS_KEY } = await import('../../src/lobby_progress.js');
const { SECRET, STAMINA, GAIT, LETTER, UNIQUE_ASSIST, IB_FLOW } = await import('../../src/config.js');
const { WEAPON_LIST, getWeapon, drawWeaponCards, TIER_DRAW, RETIRED_WEAPONS } = await import('../../src/weapons.js');
const { traditionOf, TRADITIONS } = await import('../../src/schools.js');
const { PLAYER_UNIQUE, PlayerUniqueAssist, strokeHitK, enhancedMoves } = await import('../../src/unique_assist.js');
const { kitOff, perkOff } = await import('../../src/skill_kit.js');
const { flowShieldKeep } = await import('../../src/nagashi_redesign.js');
const { newRound } = await import('./harness_m.mjs');
const { PlayerParryGuard } = await import('../../src/parry_button.js');
const { PlayerSecretWatch } = await import('../../src/secret.js');
const { Stamina } = await import('../../src/stamina.js');
const { Vector2, Vector3 } = await import('three');

const fresh = (p = { version: 1, acquisitions: [], coins: 100, heads: 0, titles: [], title: '여행자' }) => {
  storage.clear(); blockWrite = blockRead = false;
  storage.set(PROGRESS_KEY, JSON.stringify(p));
  readProgress();
};
const wallet = (coins, heads = 0) => fresh({ version: 1, acquisitions: [], coins, heads, titles: [], title: '여행자' });
const HEADS_1025 = { passive: 5, secret: 10 }; // 사장님 10/25 01:5x '머리 패시브 5개 비기 10개로' — 설계 자료(data.mjs)의 10 · 20 을 덮음
const ids = (...a) => new Set(a);

// ── 자료: 설계 data.mjs 와 같은 칸 · 앞 칸 · 값 · 모양 ──
test('설계 자료(data.mjs)와 같다: 유파마다 11 칸 · id · 갈래 · 앞 칸(모두) · 금화 · 머리 · 곁가지 · 줄 · 가로 자리', () => {
  assert.deepEqual(D.TREE_SCHOOLS, DESIGN.map((s) => s.id));
  for (const s of DESIGN) {
    const mine = D.nodesOf(s.id);
    assert.equal(mine.length, 11, s.id);
    for (const d of s.nodes) {
      const n = D.nodeOf(s.id, d.id);
      assert.ok(n, `${s.id} ${d.id}`);
      assert.deepEqual([n.cat, [...n.pre], n.price, n.heads, !!n.opt, n.d, n.cx], [d.cat, d.pre, d.price, HEADS_1025[d.cat] ?? d.heads ?? 0, !!d.opt, d.d, d.cx], `${s.id} ${d.id}`);
    }
    assert.deepEqual(D.TREE[s.id].gate ? { from: [...D.TREE[s.id].gate.from], to: [...D.TREE[s.id].gate.to] } : null, s.gate ? { from: s.gate.from, to: s.gate.to } : null);
    assert.equal(mine.filter((n) => n.pre.length === 0).length, 1, `${s.id} 뿌리 하나`);
    assert.equal(mine.find((n) => !n.pre.length).cat, 'foot', `${s.id} 뿌리 = 보법 I`);
  }
});
test('값 규칙 (사장님 19:0x): 편지 금화 100 · 패시브 머리 5(금화 0 · 10/25 10 → 5) · 보법 II 금화 100 · 비기 금화 400 + 머리 10(10/25 20 → 10)', () => {
  for (const s of D.TREE_SCHOOLS) for (const n of D.nodesOf(s)) {
    if (n.cat === 'letter') assert.deepEqual([n.price, n.heads], [100, 0]);
    if (n.cat === 'passive') assert.deepEqual([n.price, n.heads], [0, 5]); // 10/25 사장님 10 → 5
    if (n.cat === 'secret') assert.deepEqual([n.price, n.heads], [400, 10]); // 10/25 사장님 20 → 10
    if (n.cat === 'foot' && n.l1 === '보법 II') assert.deepEqual([n.price, n.heads], [100, 0]);
  }
});

// ── 앞 칸 ──
test('처음엔 뿌리(보법 I)만 배울 수 있음 · 곁가지(편지 · 보법 II 곁가지)는 아무것도 막지 않는다', () => {
  for (const s of D.TREE_SCHOOLS) {
    const open = D.nodesOf(s).filter((n) => D.nodeState(s, n, ids()) === 'open').map((n) => n.id);
    assert.equal(open.length, 1, s); assert.equal(D.nodeOf(s, open[0]).cat, 'foot');
    const optIds = new Set(D.nodesOf(s).filter((n) => n.opt).map((n) => n.id));
    for (const n of D.nodesOf(s)) for (const p of n.pre) assert.ok(!optIds.has(p), `${s} ${n.id} 의 앞 칸 ${p} 은 곁가지가 아니어야`);
  }
});
test('독일 관문: 2단계 셋(곁눈 베기 · 비껴 딛는 가로베기 · 막기 I)을 모두 익혀야 3단계(심화 · 막기 II) — 하나라도 빠지면 잠김 · 겹치기는 왕관 뒤(10/28) · 보법 II → 패시브', () => {
  const L = ids('G1', 'G5', 'G8', 'G3');
  for (const id of ['G6', 'G4']) {
    assert.equal(D.nodeState('german', D.nodeOf('german', id), L), 'open', id);
    for (const miss of ['G5', 'G8', 'G3']) { const l = new Set(L); l.delete(miss); assert.equal(D.nodeState('german', D.nodeOf('german', id), l), 'locked', `${id} without ${miss}`); }
  }
  assert.equal(D.nodeState('german', D.nodeOf('german', 'G9'), ids('G1')), 'locked');
  assert.equal(D.nodeState('german', D.nodeOf('german', 'G9'), ids('G1', 'G2')), 'open');
  assert.equal(D.nodeState('german', D.nodeOf('german', 'G7'), L), 'locked'); // 10/28 00:5x 겹치기 = 왕관 아래
  assert.equal(D.nodeState('german', D.nodeOf('german', 'G7'), ids('G1', 'G5', 'G8', 'G3', 'G4')), 'open');
  assert.deepEqual([...D.nodeOf('german', 'G10').pre], ['G9', 'G6', 'G7']); // 10/28 00:5x 무릎 꺾기 + 겹치기 + 인데스
  assert.equal(D.nodeState('german', D.nodeOf('german', 'G10'), ids('G1', 'G2', 'G9', 'G5', 'G8', 'G3', 'G4', 'G7')), 'locked'); // 무릎 꺾기 없이는 잠김
  assert.deepEqual([...D.nodeOf('chinese', 'C9').pre], ['C5', 'C8']); // 10/28 00:5x 동방 체보요격 · 염시 자리 바꿈 — 격살 ← 체보요격 + 단단한 받기
});
test('이탈리아 줄기: 보법 II(물러서기)를 거쳐야 찌르기 · 막기 줄기 · 편지는 보법 I 곁가지', () => {
  for (const id of ['I7', 'I5']) { // 10/31 왼 줄 첫 칸 = 내려 찌르기 I7 (전 I2)
    assert.equal(D.nodeState('italian', D.nodeOf('italian', id), ids('I1')), 'locked', id);
    assert.equal(D.nodeState('italian', D.nodeOf('italian', id), ids('I1', 'I3')), 'open', id);
  }
  assert.equal(D.nodeState('italian', D.nodeOf('italian', 'I11'), ids('I1')), 'open');
  assert.deepEqual([...D.nodeOf('italian', 'I4').pre], ['I8']); // 칼끝 돌려 빼기 심화(헛누름) → 비기 한 줄
  // 10/31 12:xx 사장님 '임브로카타를 먼저 배우고 카바치오네를 배우고 틈 파고들기는 카바치오네 강화로 바꿔.' — 왼 줄 I7 → I2 → I8 → I4 · 오른 줄 I6 → I9(비껴서며 찌르기 특수 공격) → I10
  assert.deepEqual(['I7', 'I2', 'I8', 'I4'].map((id) => [id, [...D.nodeOf('italian', id).pre], D.nodeOf('italian', id).d, D.nodeOf('italian', id).price, D.nodeOf('italian', id).u ?? D.nodeOf('italian', id).perk ?? null]),
    [['I7', ['I3'], 2, 200, 'imbroccata'], ['I2', ['I7'], 3, 300, 'cavazione'], ['I8', ['I2'], 4, 400, 'cavazione'], ['I4', ['I8'], 5, 400, null]]);
  assert.deepEqual([[...D.nodeOf('italian', 'I9').pre], D.nodeOf('italian', 'I9').u, D.nodeOf('italian', 'I9').d], [['I6'], 'inquartata', 4]);
});
test('이베리아: 손목 힘 패시브는 보법 바로 아래 · 비기는 패시브 + 둥근 걸음 + 이어 긋기 흐름 모두', () => {
  assert.equal(D.nodeState('iberian', D.nodeOf('iberian', 'B10'), ids('B1')), 'open');
  assert.deepEqual([...D.nodeOf('iberian', 'B7').pre], ['B10', 'B3', 'B5']);
  assert.deepEqual([...D.nodeOf('japanese', 'J5').pre], ['J4']); // 일본 막기 줄기 셋 → 고노센
});

// ── 닫힌 칸 ──
test('닫힌 칸: 비기는 열린 유파만(SECRET.openSchools — 10/22 사람 쪽 다섯 유파 — 일본 고노센 · 독일 죽음의 일격 · 이탈리아 거침없이 나아가 찌르기 · 이베리아 휘감아 돌기 · 동방 막아 죽이기) · 일본 손목 치기 심화(J8)는 10/24 칼 떨구기로 열림 · 닫힌 칸은 못 배우고 판 몫도 없음', () => {
  const closed = D.TREE_SCHOOLS.flatMap((s) => D.nodesOf(s).filter((n) => D.isClosed(s, n)).map((n) => n.id));
  const SECRET_NODE = { german: 'G10', italian: 'I4', iberian: 'B7', japanese: 'J5', chinese: 'C9' };
  assert.deepEqual(closed.sort(), D.TREE_SCHOOLS.filter((s) => !SECRET.openSchools.includes(s)).map((s) => SECRET_NODE[s]).sort()); // 10/24 J8 열림 — 닫힌 칸은 열린 유파 밖 비기뿐
  assert.equal(D.isClosed('iberian', D.nodeOf('iberian', 'B7')), false); // 10/22 휘감아 돌기 열림
  assert.equal(D.isClosed('italian', D.nodeOf('italian', 'I4')), false);
  assert.equal(D.kitFromNodes('italian', D.allNodeIds('italian')).secret, true);
  assert.deepEqual(SECRET.aiOpenSchools, ['japanese', 'iberian', 'german']); // AI 는 일본 · 이베리아(10/24 싱지르) · 독일(10/24 모르트슐라크)만 (ai.js 는 aiOpenSchools 만 본다)
  for (const s of DESIGN) for (const d of s.nodes) if (d.closed && !(d.cat === 'secret' && SECRET.openSchools.includes(s.id))) assert.equal(D.isClosed(s.id, D.nodeOf(s.id, d.id)), true, d.id); // 설계 '준비 중'과 같음 (그 뒤 연 비기는 뺌)
  assert.equal(D.isClosed('japanese', D.nodeOf('japanese', 'J5')), false);
  assert.equal(D.isClosed('german', D.nodeOf('german', 'G10')), false); // 10/22 독일 죽음의 일격 — 사람 먼저
  assert.deepEqual(SECRET.aiOpenSchools, ['japanese', 'iberian', 'german']); // AI 는 일본 · 이베리아 · 독일(10/24 사장님 'ai도 비기 쓰게 해')만 (ai.js 는 이 목록만)
  const all = D.allNodeIds('german');
  assert.equal(D.nodeState('german', D.nodeOf('german', 'G10'), ids(...[...all].filter((x) => x !== 'G10'))), 'open');
  assert.equal(D.kitFromNodes('german', all).secret, true);
  assert.equal(D.kitFromNodes('japanese', D.allNodeIds('japanese')).secret, true);
  assert.equal(D.kitFromNodes('japanese', D.allNodeIds('japanese')).perk.has('kote'), true); // 10/24 J8 칼 떨구기 = 손목 치기 이점 몫
  assert.equal(D.kitFromNodes('japanese', ids('J1', 'J7')).perk.has('kote'), false); // J8 을 안 익히면 몫 없음
  { const keepOpen = SECRET.openSchools; SECRET.openSchools = keepOpen.filter((x) => x !== 'iberian'); try { assert.equal(D.kitFromNodes('iberian', D.allNodeIds('iberian')).secret, false); } finally { SECRET.openSchools = keepOpen; } } // 닫힌 비기는 몫 없음 — 10/22 다섯 유파 모두 열림, 시험 안에서만 이베리아를 닫아 본다
  const keep = SECRET.openSchools; SECRET.openSchools = ['japanese'];
  try {
    assert.equal(D.isClosed('german', D.nodeOf('german', 'G10')), true); // 독일을 빼면 다시 '준비 중'
    assert.equal(D.nodeState('german', D.nodeOf('german', 'G10'), all), 'learned'); // 이미 가진 것으로 친 판(시험)이라도
    assert.equal(D.nodeState('german', D.nodeOf('german', 'G10'), ids(...[...all].filter((x) => x !== 'G10'))), 'closed');
    assert.equal(D.kitFromNodes('german', all).secret, false);
  } finally { SECRET.openSchools = keep; }
  SECRET.openSchools = [...D.TREE_SCHOOLS];
  try { assert.equal(D.isClosed('italian', D.nodeOf('italian', 'I4')), false); assert.equal(D.isClosed('japanese', D.nodeOf('japanese', 'J8')), false); } finally { SECRET.openSchools = keep; }
  wallet(99999, 999);
  { const keepOpen = SECRET.openSchools; SECRET.openSchools = keepOpen.filter((x) => x !== 'iberian'); try { assert.deepEqual(S.learnNode('iberian', 'B7'), { ok: false, saved: false, why: 'closed' }); } finally { SECRET.openSchools = keepOpen; } } // 닫힌 칸은 못 배움 — 10/22 다섯 유파 모두 열림, 시험 안에서만 이베리아를 닫아 본다
  for (const id of ['G1', 'G2', 'G5', 'G8', 'G3', 'G6', 'G4', 'G7', 'G9']) assert.equal(S.learnNode('german', id).ok, true, id);
  assert.equal(S.learnNode('german', 'G10').ok, true); // 비기 칸 값 그대로 (금화 400 + 머리 20)
});

// ── 배우기 · 레벨 ──
test('배우기: 금화 · 머리를 낸다 · 앞 칸 · 모자람 · 이미 익힘 · 낸 값이 남는다 · 칸 하나 = Lv +1', () => {
  wallet(100, 0);
  assert.equal(readProgress().level, 1);
  assert.deepEqual(S.learnNode('german', 'G5'), { ok: false, saved: false, why: 'pre' });
  assert.deepEqual(S.learnNode('german', 'G1'), { ok: true, saved: true, why: null });
  assert.equal(readProgress().coins, 0); assert.equal(readProgress().level, 2);
  assert.deepEqual(S.learnNode('german', 'G1').why, 'learned');
  assert.deepEqual(S.learnNode('german', 'G2').why, 'coins');
  wallet(1000, 4);
  S.learnNode('german', 'G1'); S.learnNode('german', 'G2');
  assert.deepEqual(S.learnNode('german', 'G9').why, 'heads'); // 패시브 = 머리 5 (10/25)
  recordAcquisition({ receipt: 'drop-1', kind: 'item', source: 'loot' }); // 물건도 레벨에 센다
  const before = readProgress();
  assert.equal(before.level, 4); // 1 + 칸 둘 + 물건 하나
  storage.set(PROGRESS_KEY, JSON.stringify({ ...JSON.parse(storage.get(PROGRESS_KEY)), heads: 5 }));
  assert.equal(S.learnNode('german', 'G9').ok, true);
  const p = readProgress();
  assert.equal(p.coins, 800); assert.equal(p.heads, 0); assert.equal(p.level, 5);
  assert.deepEqual(p.acquisitions.find((a) => a.receipt === 'skill:german:G9').paid, { coins: 0, heads: 5 });
  assert.deepEqual([...S.readLearned().german].sort(), ['G1', 'G2', 'G9']);
  wallet(2000, 40); // 일본 고노센: 금화 400 + 머리 10 (10/25)
  for (const id of ['J1', 'J2', 'J3', 'J4']) assert.equal(S.learnNode('japanese', id).ok, true, id);
  const c = readProgress().coins;
  assert.equal(S.learnNode('japanese', 'J5').ok, true);
  assert.equal(readProgress().coins, c - 400); assert.equal(readProgress().heads, 30);
});

// ── 유파 초기화 ──
test('유파 초기화: 머리 1 · 그 유파 칸에 쓴 금화 · 머리를 모두 돌려받음 · 다른 유파 그대로 · 레벨이 내려감 · 익힌 칸 없음 / 머리 0 이면 못 함', () => {
  wallet(5000, 30);
  for (const id of ['G1', 'G2', 'G9', 'G5', 'G8', 'G3', 'G6']) assert.equal(S.learnNode('german', id).ok, true, id);
  assert.equal(S.learnNode('italian', 'I1').ok, true);
  let p = readProgress();
  assert.equal(p.coins, 5000 - (100 + 100 + 0 + 200 + 200 + 200 + 300) - 100); assert.equal(p.heads, 25); assert.equal(p.level, 9);
  assert.deepEqual(S.resetPreview('german'), { count: 7, coins: 1100, heads: 5, cost: 1, ok: true, why: null });
  const r = S.resetSchool('german');
  assert.deepEqual(r, { ok: true, saved: true, why: null, count: 7, coins: 1100, heads: 5 });
  p = readProgress();
  assert.equal(p.coins, 4900); assert.equal(p.heads, 29); assert.equal(p.level, 2); // 25 + 5 − 1 · 이탈리아 I1 만 남음
  assert.deepEqual([...S.readLearned().german], []); assert.deepEqual([...S.readLearned().italian], ['I1']);
  assert.deepEqual(S.resetSchool('german').why, 'empty'); assert.equal(readProgress().heads, 29);
  wallet(1000, 0);
  S.learnNode('chinese', 'C1');
  assert.deepEqual(S.resetPreview('chinese').why, 'heads');
  const before = storage.get(PROGRESS_KEY);
  assert.deepEqual(S.resetSchool('chinese').why, 'heads');
  assert.equal(storage.get(PROGRESS_KEY), before); // 아무것도 안 바뀜
  assert.deepEqual(S.resetSchool('none').why, 'bad');
});
test('유파 초기화는 저장이 막혀도 금화를 잃지 않는다 (이번 실행 동안만 · 저장된 값은 그대로)', () => {
  wallet(1000, 5);
  S.learnNode('iberian', 'B1'); S.learnNode('iberian', 'B3');
  const saved = storage.get(PROGRESS_KEY);
  blockWrite = true;
  const r = S.resetSchool('iberian');
  assert.equal(r.ok, true); assert.equal(r.saved, false);
  assert.equal(storage.get(PROGRESS_KEY), saved);
  blockWrite = false;
  assert.equal(readProgress().coins, 700); // 다음 읽기 = 저장된 값(초기화 전) — 다시 하면 된다
  assert.equal(S.resetSchool('iberian').ok, true); assert.equal(readProgress().coins, 1000); assert.equal(readProgress().heads, 4);
});

// ── 옛 스킬북 옮기기 ──
const oldSave = () => ({ version: 1, acquisitions: [
  { receipt: 'skillbook:german:1', kind: 'skillbook' }, { receipt: 'skillbook:german:3', kind: 'skillbook' }, { receipt: 'skillbook:italian:5', kind: 'skillbook' },
  { receipt: 'drop-1', kind: 'item' }, { receipt: 'book-gift', kind: 'skillbook' },
], coins: 50, heads: 2, titles: [], title: '여행자' });
test('옮기기: 산 책을 모두 거두고 쓴 금화를 돌려준 뒤 금화 500 · 레벨은 물건만 · 옛 봉인 기록 지움 · 알림 한 번 · 두 번 하지 않음', () => {
  fresh(oldSave());
  storage.set(S.OLD_BOOK_STATE_KEY, JSON.stringify({ version: 1, sealed: ['german:3'] }));
  assert.equal(readProgress().level, 6);
  const r = S.migrateSkillBooks({ today: '2026-10-21' });
  assert.deepEqual(r, { first: true, books: 3, coins: 900, heads: 0, bonus: 500, saved: true });
  const p = readProgress();
  assert.equal(p.coins, 50 + 100 + 300 + 500 + 500); assert.equal(p.heads, 2);
  assert.deepEqual(p.acquisitions.map((a) => a.receipt), ['drop-1']); assert.equal(p.level, 2);
  assert.deepEqual(p.tree, { v: 1, at: '2026-10-21', books: 3, coins: 900, heads: 0, bonus: 500, notice: true });
  assert.equal(storage.has(S.OLD_BOOK_STATE_KEY), false);
  assert.ok(storage.has(S.TREE_MARK_KEY));
  assert.deepEqual(S.migrateSkillBooks(), { first: false, books: 0, coins: 0, heads: 0, bonus: 0, saved: false });
  assert.equal(readProgress().coins, 1450);
  assert.deepEqual(S.takeTreeNotice(), { books: 3, coins: 900, heads: 0, bonus: 500 });
  assert.equal(S.takeTreeNotice(), null);
  assert.equal(S.treeNoticeText({ books: 3, coins: 900, heads: 0, bonus: 500 }), '스킬북이 유파마다 11칸의 스킬트리로 바뀌었습니다. 가지고 있던 스킬북 3권을 거두고 쓴 금화 900을 돌려드렸습니다. 레벨도 그만큼 내려갑니다. 새로 익히시도록 금화 500을 더 드립니다.');
});
test('옮기기: 새 플레이어(저장 없음)도 금화 500 · 알림 · 한 번', () => {
  fresh(); storage.clear(); // 모듈이 들고 있는 값을 새 기기 값으로 덮은 뒤 저장을 비움 (새로 연 판 = 저장 없음 · 기본 금화 100)
  const start = readProgress().coins;
  assert.equal(start, 100);
  assert.equal(S.migrateSkillBooks().first, true);
  assert.equal(readProgress().coins, start + 500);
  assert.equal(S.migrateSkillBooks().first, false); assert.equal(readProgress().coins, start + 500);
  assert.equal(S.treeNoticeText(S.takeTreeNotice()), '스킬북이 유파마다 11칸의 스킬트리로 바뀌었습니다. 새로 익히시도록 금화 500을 더 드립니다.');
});
test('옮기기: 저장이 막히면 이번 실행 동안만 — 저장된 옛 값은 그대로라 다음 실행에서 정확히 한 번 (금화를 잃지도 두 번 받지도 않음)', () => {
  fresh(oldSave());
  const saved = storage.get(PROGRESS_KEY);
  blockWrite = true;
  const r = S.migrateSkillBooks();
  assert.equal(r.first, true); assert.equal(r.saved, false);
  assert.equal(storage.get(PROGRESS_KEY), saved); assert.equal(storage.has(S.TREE_MARK_KEY), false);
  blockWrite = false;
  readProgress(); // 다음 실행 = 저장된 값
  assert.equal(readProgress().coins, 50);
  assert.equal(S.migrateSkillBooks().first, true);
  assert.equal(readProgress().coins, 1450);
  assert.equal(S.migrateSkillBooks().first, false); assert.equal(readProgress().coins, 1450);
});
test('옮기기: 옛 판(다른 탭)이 진행 저장의 기록 칸을 떨어뜨려도 500 을 두 번 주지 않음 · 그 뒤 생긴 옛 책은 돌려주기만', () => {
  fresh(oldSave());
  S.migrateSkillBooks();
  const p = JSON.parse(storage.get(PROGRESS_KEY));
  delete p.tree; p.acquisitions.push({ receipt: 'skillbook:chinese:2', kind: 'skillbook' }); // 옛 코드가 다시 쓴 저장 + 옛 판에서 산 책
  storage.set(PROGRESS_KEY, JSON.stringify(p));
  const r = S.migrateSkillBooks();
  assert.deepEqual([r.first, r.books, r.coins, r.bonus], [false, 1, 200, 0]);
  assert.equal(readProgress().coins, 1450 + 200);
  assert.equal(readProgress().tree.notice, false);
  assert.equal(S.migrateSkillBooks().saved, false); // 다시 부르면 할 일 없음
});

// ── 편지 뽑기 셈 (사장님 결정 '칸마다 무게': 칸 무게 = 그 등급 TIER_DRAW ÷ 그 등급 칸 수 · 편지 유파 칸 × LETTER.mult · 모든 등급에서 한 번에) ──
const POOL = WEAPON_LIST.map((w) => w.id).filter((id) => id !== 'excalibur_replica' && !RETIRED_WEAPONS.has(id)); // main.js PLAYER_WEAPON_POOL 과 같은 목록
const groupOf = (id) => getWeapon(id).drawGroup || id;
const weightFor = (letters) => (id) => D.letterMul(traditionOf(getWeapon(id)), letters);
/** 정확한 셈(열거): 남은 칸마다 무게 → 칸 · 유파 · 등급 확률 */
function exactDist(letters, removed = new Set()) {
  const pool = POOL.filter((id) => !getWeapon(id).characterOnly && !removed.has(groupOf(id)));
  const slots = [...new Map(pool.map((id) => [groupOf(id), id])).values()].filter((id) => TIER_DRAW[getWeapon(id).tier] > 0);
  const n = {};
  for (const id of slots) n[getWeapon(id).tier] = (n[getWeapon(id).tier] ?? 0) + 1;
  const w = slots.map((id) => (TIER_DRAW[getWeapon(id).tier] / n[getWeapon(id).tier]) * D.letterMul(traditionOf(getWeapon(id)), letters));
  const W = w.reduce((a, x) => a + x, 0), school = {}, tier = {};
  slots.forEach((id, i) => { const s = traditionOf(getWeapon(id)), t = getWeapon(id).tier; school[s] = (school[s] ?? 0) + w[i] / W; tier[t] = (tier[t] ?? 0) + w[i] / W; });
  return { school, tier };
}
const seqRnd = (seq) => () => seq.shift() ?? 0.5;
/** 편지 길(난수 하나로 칸)을 실제 함수로 — 첫 난수를 고른 격자 K 로 */
function implDist(letters, { first = null, K = 20000 } = {}) {
  const school = {}, tier = {};
  for (let k = 0; k < K; k++) {
    const seq = first ? [...first, (k + 0.5) / K, 0.5] : [(k + 0.5) / K, 0.5];
    const ids = drawWeaponCards(POOL, first ? 2 : 1, { rnd: seqRnd(seq), weightOf: weightFor(letters) });
    const id = ids[ids.length - 1], s = traditionOf(getWeapon(id)), t = getWeapon(id).tier;
    school[s] = (school[s] ?? 0) + 1 / K; tier[t] = (tier[t] ?? 0) + 1 / K;
  }
  return { school, tier };
}
/** 편지 없는 길(지금 그대로 — 등급 난수 + 칸 난수)을 실제 함수로: 등급 난수는 그 등급 칸 가운데, 칸 난수는 격자 */
function oldDist(K = 4000) {
  const order = [...new Set(POOL.filter((id) => !getWeapon(id).characterOnly).map((id) => getWeapon(id).tier))].filter((t) => TIER_DRAW[t] > 0);
  const total = order.reduce((a, t) => a + TIER_DRAW[t], 0), school = {};
  let acc = 0;
  for (const t of order) {
    const r1 = (acc + TIER_DRAW[t] / 2) / total; acc += TIER_DRAW[t];
    for (let k = 0; k < K; k++) {
      const [id] = drawWeaponCards(POOL, 1, { rnd: seqRnd([r1, (k + 0.5) / K, 0.5]) });
      const s = traditionOf(getWeapon(id)); school[s] = (school[s] ?? 0) + TIER_DRAW[t] / total / K;
    }
  }
  return { school };
}
const close = (a, b, e, msg) => { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) assert.ok(Math.abs((a[k] ?? 0) - (b[k] ?? 0)) < e, `${msg} ${k}: ${a[k]} vs ${b[k]}`); };
test('편지 없음 = 지금 뽑기와 같다: 같은 난수 · 같은 결과(난수 600 벌 · 두 장) · 확률 = 칸 무게 셈(배율 1)', () => {
  let seed = 7; const lcg = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 600; i++) {
    const seq = Array.from({ length: 8 }, lcg);
    const a = drawWeaponCards(POOL, 2, { rnd: seqRnd([...seq]) });
    assert.deepEqual(drawWeaponCards(POOL, 2, { rnd: seqRnd([...seq]), weightOf: () => 1 }), a);
    assert.deepEqual(drawWeaponCards(POOL, 2, { rnd: seqRnd([...seq]), weightOf: weightFor(new Set()) }), a);
  }
  close(oldDist().school, exactDist(new Set()).school, 1e-3, '편지 없음');
  const base = exactDist(new Set()).tier;
  for (const [t, p] of Object.entries(base)) assert.ok(Math.abs(p - TIER_DRAW[t] / 100) < 1e-9, `${t} 등급 ${p}`); // 등급 확률 = TIER_DRAW 그대로
});
test('편지 하나: 그 유파 칸만 × 배율 · 나머지 칸은 같은 비로 줄어듦(쓰레기 · ??? 도) — 실제 함수 = 정확한 셈', () => {
  const base = exactDist(new Set());
  for (const s of D.TREE_SCHOOLS) {
    const letters = new Set([s]), want = exactDist(letters), got = implDist(letters);
    close(got.school, want.school, 2e-4, s); close(got.tier, want.tier, 2e-4, `${s} 등급`);
    const W = 1 + base.school[s] * (LETTER.mult - 1); // 전체 무게 (편지 없음 = 1)
    assert.ok(Math.abs(want.school[s] - (base.school[s] * LETTER.mult) / W) < 1e-12, `${s} 늘어남`);
    for (const o of Object.keys(base.school)) if (o !== s) assert.ok(Math.abs(want.school[o] - base.school[o] / W) < 1e-12, `${s}: ${o} 같은 비로 줄어듦`);
  }
});
test('편지 다섯: 쓰레기 4 → 약 2.1 % · ??? 6 → 약 3.2 % (지금 무기 — 정확한 셈과 실제 함수)', () => {
  const all = new Set(D.TREE_SCHOOLS), want = exactDist(all), got = implDist(all);
  close(got.tier, want.tier, 2e-4, '다섯');
  const schoolShare = 1 - (TIER_DRAW.trash + TIER_DRAW.mystery) / 100; // 쓰레기 · ??? 는 무유파 무기뿐
  const W = schoolShare * LETTER.mult + (1 - schoolShare);
  assert.ok(Math.abs(want.tier.trash - TIER_DRAW.trash / 100 / W) < 1e-12 && Math.abs(want.tier.mystery - TIER_DRAW.mystery / 100 / W) < 1e-12);
  if (TIER_DRAW.trash === 4 && TIER_DRAW.mystery === 6 && LETTER.mult === 2) { assert.ok(Math.abs(want.tier.trash - 0.021) < 0.001); assert.ok(Math.abs(want.tier.mystery - 0.032) < 0.001); }
});
test('둘째 장: 첫 장 칸(묶음째)을 뺀 남은 칸으로 다시 셈 — 실제 함수 = 정확한 셈', () => {
  const letters = new Set(['german']);
  let lo = null, hi = null; // 첫 장이 롱소드가 되는 첫 난수 구간의 가운데
  for (let k = 0; k < 20000; k++) { const [id] = drawWeaponCards(POOL, 1, { rnd: seqRnd([(k + 0.5) / 20000]), weightOf: weightFor(letters) }); if (id === 'longsword') { lo ??= k; hi = k; } }
  assert.ok(lo != null, '롱소드가 뽑기 목록에 있어야');
  const r1 = ((lo + hi) / 2 + 0.5) / 20000;
  const got = implDist(letters, { first: [r1] }), want = exactDist(letters, new Set(['longsword']));
  close(got.school, want.school, 2e-4, '둘째 장'); close(got.tier, want.tier, 2e-4, '둘째 장 등급');
  const grouped = POOL.find((id) => getWeapon(id).drawGroup); // 묶음(간장 · 막야)은 한 칸 — 한 장이 나오면 묶음째 빠짐
  if (grouped) {
    const g = getWeapon(grouped).drawGroup, mates = POOL.filter((id) => getWeapon(id).drawGroup === g);
    assert.ok(mates.length >= 2);
    for (let i = 0; i < 300; i++) { const ids = drawWeaponCards(POOL, 2, { weightOf: weightFor(new Set([traditionOf(getWeapon(grouped))])) }); assert.ok(!(mates.includes(ids[0]) && mates.includes(ids[1]))); }
  }
});
test('배율은 config 한 곳(LETTER.mult — 사장님 결정 2) · 편지 칸 글에는 배율 숫자를 쓰지 않음(10/22 사장님 \'뽑기 무게 2배\' 빼)', () => {
  assert.equal(LETTER.mult, 2);
  assert.equal(D.nodeEff('german', D.nodeOf('german', 'G11')), '독일 무기 카드가 더 자주 나온다');
  const keep = LETTER.mult; LETTER.mult = 3;
  try {
    const l = new Set(['italian']);
    close(implDist(l).school, exactDist(l).school, 2e-4, '×3');
    assert.equal(D.nodeEff('italian', D.nodeOf('italian', 'I11')), '이탈리아 무기 카드가 더 자주 나온다');
  } finally { LETTER.mult = keep; }
});
test('편지 가진 유파 읽기 · 테스트 경로는 모두', () => {
  wallet(1000);
  S.learnNode('german', 'G1'); S.learnNode('german', 'G11'); S.learnNode('japanese', 'J1');
  assert.deepEqual([...S.playerLetters()], ['german']);
  assert.deepEqual([...S.playerLetters({ test: true })], D.TREE_SCHOOLS);
});

// ── 칸 → 판 몫 ──
test('칸 하나 = 제 몫 하나: 칸만 켠 몫과 빈 몫의 차이 = 그 칸의 f · u · perk 뿐 · 편지 · 닫힌 칸은 몫 없음', () => {
  for (const s of D.TREE_SCHOOLS) {
    const empty = D.kitFromNodes(s, ids());
    assert.equal(D.KIT_KEYS.every((k) => empty[k] === false), true); assert.equal(empty.unique.size + empty.perk.size, 0);
    for (const n of D.nodesOf(s)) {
      const k = D.kitFromNodes(s, ids(n.id));
      const on = D.KIT_KEYS.filter((x) => k[x]);
      const want = D.isClosed(s, n) ? [] : [...n.f];
      assert.deepEqual(on.sort(), [...want].sort(), `${s} ${n.id}`);
      assert.deepEqual([...k.unique], !D.isClosed(s, n) && n.u ? [n.u] : [], `${s} ${n.id} unique`);
      assert.deepEqual([...k.perk], !D.isClosed(s, n) && n.perk ? [n.perk] : [], `${s} ${n.id} perk`);
      if (n.cat === 'letter') assert.equal(on.length + k.unique.size + k.perk.size, 0);
    }
  }
});
test('칸 → 몫 표 (IMPLEMENTATION.md §2): 보기 칸들 · 사람 고유 공격은 모두 한 칸씩 · 강화동작 이점은 그 강화동작의 심화 칸', async () => {
  const on = (s, id) => { const k = D.kitFromNodes(s, ids(id)); return [...D.KIT_KEYS.filter((x) => k[x]), ...[...k.unique].map((u) => `u:${u}`), ...[...k.perk].map((p) => `perk:${p}`)]; };
  assert.deepEqual(on('german', 'G1'), ['footwork']);
  assert.deepEqual(on('german', 'G2'), ['chase']);
  assert.deepEqual(on('german', 'G5'), ['u:schielhau']);
  assert.deepEqual(on('german', 'G8'), ['u:zwerchAbtritt']);
  assert.deepEqual(on('german', 'G3'), ['parry']);
  assert.deepEqual(on('german', 'G4'), ['parryCover']);
  assert.deepEqual(on('german', 'G7'), ['u:duplieren']);
  assert.deepEqual(on('german', 'G6'), ['perk:schielhau']);
  assert.deepEqual(on('german', 'G9'), ['passive']);
  assert.deepEqual(on('italian', 'I1'), ['footwork']);
  assert.deepEqual(on('italian', 'I3'), ['backFlat']);
  assert.deepEqual(on('italian', 'I6'), ['opposition']);
  assert.deepEqual(on('italian', 'I8'), ['perk:cavazione']); // 10/31 헛누름 (전 내려 찌르기 틈 파고들기 perk imbroccata)
  assert.deepEqual(on('italian', 'I7'), ['u:imbroccata']);
  assert.deepEqual(on('italian', 'I2'), ['u:cavazione']);
  assert.deepEqual(on('italian', 'I9'), ['u:inquartata']);
  assert.deepEqual(on('iberian', 'B2'), ['burstSide']);
  assert.deepEqual(on('iberian', 'B5'), ['ibFlow']);
  assert.deepEqual(on('iberian', 'B9'), ['parryCut']);
  assert.deepEqual(on('iberian', 'B6'), ['ibChain']); // 10/29 01:5x 이어지는 흐름 (전: 돌려 베기 쌓기 perk redondo)
  assert.deepEqual(on('iberian', 'B4'), ['u:redondo']); // 10/29 풍차 베기 = 특수 공격 (같은 이름 열쇠 redondo — 사람은 길게 눌러 냄)
  assert.deepEqual(on('japanese', 'J1'), ['footwork', 'stepCost']);
  assert.deepEqual(on('japanese', 'J2'), ['parry', 'parryCover', 'parryCut']);
  assert.deepEqual(on('japanese', 'J3'), ['flow']);
  assert.deepEqual(on('japanese', 'J4'), ['flowShield']);
  assert.deepEqual(on('japanese', 'J5'), ['secret']);
  assert.deepEqual(on('chinese', 'C2'), ['stepCost']);
  assert.deepEqual(on('chinese', 'C4'), ['perk:yaoji']);
  { // 10/28 01:1x 사장님 '체보요격과 염시에도 붙여' — 깊은 허리 베기(C4) 출혈은 허리를 베는 세 칼 모두 · 다른 칼은 아님
    const { yaojiBleedTech } = await import('../../src/combat.js');
    for (const t of ['yaoji', 'chebuYaoji', 'lianchi']) assert.equal(yaojiBleedTech(t), true, t);
    for (const t of ['zwerch', 'zwerchL', 'schielhau', 'tsubameGaeshi', null]) assert.equal(yaojiBleedTech(t), false, String(t));
  }
  for (const s of D.TREE_SCHOOLS) {
    const us = D.nodesOf(s).filter((n) => n.u).map((n) => n.u);
    assert.deepEqual([...us].sort(), PLAYER_UNIQUE[s].map((e) => e.name).sort(), `${s} 고유 공격 = 칸`);
    for (const n of D.nodesOf(s).filter((x) => x.perk && !D.isClosed(s, x))) {
      // 심화 칸 = 그 강화동작의 이점 (G6 · J8 · C4) · 10/31 이탈리아 I8 헛누름은 강화동작이 아닌 칼끝 돌려 빼기(탭으로 내는 기본 기술 — tapKey)의 심화 (사장님 '틈 파고들기는 카바치오네 강화로 바꿔.')
      assert.ok(enhancedMoves(s).some((e) => e.name === n.perk) || PLAYER_UNIQUE[s].some((e) => e.name === n.perk && (e.role === 'enh' || e.tapKey)), `${s} ${n.perk} 강화동작 · 탭 기술`);
      assert.ok(n.pre.some((p) => D.nodeOf(s, p).u === n.perk) || D.nodesOf(s).some((m) => m.u === n.perk), `${s} 심화 칸 ${n.id}`);
    }
  }
  const used = new Set(D.TREE_SCHOOLS.flatMap((s) => D.nodesOf(s).flatMap((n) => n.f)));
  assert.deepEqual(D.KIT_KEYS.filter((k) => !used.has(k)), []); // 모든 몫 열쇠를 어느 칸이 켬
});
test('판 몫 차례: ?skillNodes → ?uniqueStage(옛 급 N 까지의 칸) → 테스트 경로(모두) → 익힌 칸 · 무유파 null', () => {
  const learned = { german: ids('G1', 'G5') };
  assert.deepEqual([...S.playerKit('german', learned).unique], ['schielhau']);
  assert.equal(S.playerKit('german', learned).footwork, true);
  assert.equal(S.playerKit('none', learned), null);
  const t = S.playerKit('german', learned, { test: true });
  assert.equal(t.unique.size, 3); assert.equal(t.chase && t.parryCover && t.passive, true); assert.equal(t.secret, true); // 10/22 독일 비기 열림 (죽음의 일격)
  { const keepOpen = SECRET.openSchools; SECRET.openSchools = keepOpen.filter((x) => x !== 'iberian'); try { assert.equal(S.playerKit('iberian', {}, { test: true }).secret, false); } finally { SECRET.openSchools = keepOpen; } } // 닫힌 비기 — 10/22 다섯 유파 모두 열림, 시험 안에서만 이베리아를 닫아 본다
  assert.deepEqual([null, '', '0', '2', '5', '6', '-1', '2.5', 'x'].map(S.stageParam), [null, null, 0, 2, 5, null, null, null, null]);
  const k2 = S.playerKit('german', learned, { upTo: 2 });
  assert.deepEqual([k2.footwork, k2.chase, k2.parry, k2.parryCover, k2.unique.size, k2.passive], [true, true, true, true, 0, false]); // 보법 · 막기 칸 모두
  assert.equal(S.playerKit('german', learned, { upTo: 0 }).footwork, false);
  assert.equal(S.playerKit('japanese', {}, { upTo: 5 }).secret, true);
  assert.equal(S.playerKit('japanese', {}, { test: true, upTo: 1 }).parry, false); // ?uniqueStage 가 테스트 경로를 덮는다 (10/13 차례)
  const n = S.playerKit('german', learned, { upTo: 5, nodes: S.skillNodesParam('G1,G2,I1,nope', 'german') }); // ?skillNodes 가 가장 먼저 · 다른 유파 · 모르는 칸은 버림
  assert.deepEqual([n.footwork, n.chase, n.unique.size], [true, true, 0]);
  assert.equal(S.skillNodesParam(null, 'german'), null);
  assert.equal(S.skillNodesParam('all', 'german').size, 11);
  assert.equal(S.skillNodesParam('', 'german').size, 0);
});
test('몫 읽기(skill_kit.js): skillKit 이 없는 몸(AI · 시뮬)은 늘 켜짐', () => {
  assert.equal(kitOff({}, 'chase'), false); assert.equal(perkOff({}, 'schielhau'), false); assert.equal(kitOff(null, 'x'), false);
  const f = { skillKit: D.kitFromNodes('german', ids('G1')) };
  assert.equal(kitOff(f, 'footwork'), false); assert.equal(kitOff(f, 'chase'), true); assert.equal(perkOff(f, 'schielhau'), true);
});

// ── 실제 몸에서: 칸 하나가 제 몫만 ──
const kitOf = (s, ...a) => D.kitFromNodes(s, ids(...a));
function round(weapon, kit, seed = 3) { const g = newRound({ weapon, seed, kit }); g.ai.update = () => {}; return g; }
test('실제 몸 — 보법: 이탈리아 I1 = 박자 걸음(뒤 느려짐 그대로) · I3 = 뒤 느려짐 없앰 / 이베리아 B1 = 넓은 옆걸음 · B2 = 옆 박차기 / 보법 I 없음 = 기본 걸음 · 상대는 그대로', () => {
  for (const [kit, back] of [[kitOf('italian', 'I1'), undefined], [kitOf('italian', 'I1', 'I3'), 'flat']]) {
    const g = round('rapier', kit);
    try { g.step(); assert.equal(g.player.gait.P.tradition, 'italian'); assert.ok(g.player.gait.P.rhythm); assert.equal(g.player.gait.P.backMul, back); assert.equal(g.enemy.gait.P.backMul, 'flat'); } finally { g.world.free(); }
  }
  for (const [kit, side] of [[kitOf('iberian', 'B1'), false], [kitOf('iberian', 'B1', 'B2'), true]]) {
    const g = round('zweihander', kit);
    try { g.step(); assert.ok(g.player.gait.P.sideMul > 1); assert.equal(!!g.player.gait.P.burstSide, side); assert.equal(!!g.enemy.gait.P.burstSide, true); } finally { g.world.free(); }
  }
  const g = round('monohoshizao', kitOf('japanese'));
  try { g.step(); assert.equal(g.player.gait.P, GAIT); assert.equal(g.player.swayScale, 1); assert.equal(g.enemy.gait.P.tradition, 'japanese'); } finally { g.world.free(); }
});
test('실제 몸 — 독일 간격 잡기: G1 만이면 상대 헛침에 창이 안 열림 · G1 + G2 면 열림', () => {
  for (const [kit, want] of [[kitOf('german', 'G1'), false], [kitOf('german', 'G1', 'G2'), true]]) {
    const g = round('longsword', kit);
    try {
      for (let i = 0; i < 300; i++) g.step(); // 판 시작 정지 뒤 · 걸음 켬
      g.player.gait.active = true; g.player.foeDistance = () => 9; // 멀리서 헛침
      g.player.gait.foeWhiff();
      assert.equal(!!g.player.gait.chase, want);
    } finally { g.world.free(); }
  }
});
test('실제 몸 — 걷기 기력: 동방 C1 만 = 보통 4 · C1 + C2 = 2 · 일본 J1 = 6 (10/31 — 전 1.4 · 0.7 · 2.1)', () => {
  const actor = (kit) => {
    const pos = { x: 0, y: 1, z: 0 };
    const f = { alive: true, armed: true, state: 'stand', heading: 0, swordMass: 1.6, move: new Vector2(0, 1), handOffset: new Vector2(), skill: { vel: new Vector2(), swinging: false }, bodies: { pelvis: { translation: () => pos } }, swordArt: { tradition: kit.school }, skillKit: kit, schoolFootwork: kit.footwork ? undefined : false, aiControlled: false };
    f.stamina = new Stamina(f); f.pos = pos;
    f.stamina.step(1 / 120);
    for (let i = 0; i < 40; i++) { pos.x += 0.0175; f.stamina.step(1 / 120); }
    return f.stamina.spent.move;
  };
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);
  near(actor(kitOf('chinese', 'C1')), STAMINA.stepCosts.default);
  near(actor(kitOf('chinese', 'C1', 'C2')), STAMINA.stepCosts.chinese);
  near(actor(kitOf('japanese', 'J1')), STAMINA.stepCosts.japanese);
});
test('실제 몸 — 막기: 독일 G3 = 독일 자리만(왕관 몸꼴 없음) · G4 = 왕관 / 일본 J2 = 우케나가시 + 피해 20 % / 이베리아 B8 만 = 피해 감소 없음 · B9 = 20 %', () => {
  for (const [kit, kron] of [[kitOf('german', 'G1', 'G3'), false], [kitOf('german', 'G1', 'G3', 'G4'), true]]) {
    const g = round('longsword', kit, 5);
    try {
      const guard = new PlayerParryGuard(g.player, g.enemy);
      assert.deepEqual(guard.padOf('highC'), TRADITIONS.german.parry.highC);
      const cover = TRADITIONS.german.parryCover?.highC;
      assert.equal(guard.nameOf('highC')?.name === cover?.name && !!cover, kron);
    } finally { g.world.free(); }
  }
  const cut = (weapon, kit) => { const g = round(weapon, kit, 5); try { const guard = new PlayerParryGuard(g.player, g.enemy); guard.mode = 'defend'; return guard.woundKeep(); } finally { g.world.free(); } };
  assert.equal(cut('monohoshizao', kitOf('japanese', 'J1', 'J2')), 0.8);
  assert.equal(cut('zweihander', kitOf('iberian', 'B1', 'B8')), 1);
  assert.equal(cut('zweihander', kitOf('iberian', 'B1', 'B8', 'B9')), 0.8);
  assert.equal(cut('qinggang', kitOf('chinese', 'C1', 'C7')), 1);
  assert.equal(cut('qinggang', kitOf('chinese', 'C1', 'C7', 'C8')), 0.5);
  const g = round('rapier', kitOf('italian', 'I1', 'I3', 'I5'), 5);
  try { const guard = new PlayerParryGuard(g.player, g.enemy); assert.equal(guard.opposition.eligible(), false); g.player.skillKit = kitOf('italian', 'I1', 'I3', 'I5', 'I6'); assert.equal(guard.opposition.eligible(), true); } finally { g.world.free(); }
});
test('실제 몸 — 흘린 칼(J4): 흘린 공격 피해 감소는 J4 를 익혀야 · AI(몫 없음)는 그대로', () => {
  const att = { stamina: { attackId: 7 } };
  const vic = (kit) => ({ flowShield: { from: att, attackId: 7 }, ...(kit ? { skillKit: kit } : {}) });
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);
  near(flowShieldKeep(vic(null), att), 0.2);
  assert.equal(flowShieldKeep(vic(kitOf('japanese', 'J1', 'J2', 'J3')), att), 1);
  near(flowShieldKeep(vic(kitOf('japanese', 'J1', 'J2', 'J3', 'J4')), att), 0.2);
});
test('실제 몸 — 강화동작 이점은 심화 칸: 곁눈 베기 무릎 꺾기(G6) / 이어 긋기 흐름(B5) · 사람은 돌려 베기 쌓기 없음(10/29 — B6 이어지는 흐름 · AI 쌓기 그대로)', async () => {
  const g = round('longsword', kitOf('german', 'G1', 'G5'), 9);
  try {
    g.player.artTech = 'schielhau'; // 지금 긋는 기술 = 곁눈 베기
    g.combat.buckleCheck(g.player, g.enemy, 'head');
    assert.equal((g.combat.buckleLog ?? []).length, 0); // G6 없음 — 굴리지도 않음
    g.player.skillKit = kitOf('german', 'G1', 'G5', 'G6');
    g.combat.buckleCheck(g.player, g.enemy, 'head');
    assert.equal(g.combat.buckleLog.length, 1);
  } finally { g.world.free(); }
  const f = { artTech: 'redondo', skill: { uniq: { stackN: 2 } } };
  assert.ok(Math.abs(strokeHitK(f) - 1.2) < 1e-9); // AI 꼴(몫 없음) — 그대로
  f.skillKit = kitOf('iberian', 'B1', 'B4'); assert.equal(strokeHitK(f), 1);
  f.skillKit = kitOf('iberian', 'B1', 'B4', 'B5', 'B6'); assert.equal(strokeHitK(f), 1); // 10/29: 사람 쌓기 칸 없음 (AI 꼴 — 몫 없음 — 은 위에서 그대로 1.2)
  for (const [kit, want] of [[kitOf('iberian', 'B1', 'B4'), false], [kitOf('iberian', 'B1', 'B4', 'B5'), true]]) {
    const r = round('zweihander', kit, 9);
    try {
      const P = r.player;
      P.skill.swinging = true; P.skill.vel.set(6, 0); P.updateIbFlow(1 / 120); // 진짜 긋기 (손 목표 ≥ IB_FLOW.cutSpeed — 10/28)
      P.skill.swinging = false; for (let i = 0; i < 3; i++) P.updateIbFlow(1 / 120); // 문턱 밑 세 스텝 = 끝남 (endSteps 2 넘게)
      P.skill.swinging = true; P.updateIbFlow(1 / 120); // 창 안에 다시 휘두름 = 이어 감
      assert.equal(P.ibFlowOn, want);
    } finally { r.world.free(); }
  }
});
test('흐르는 긋기 A (10/28 22:0x 사장님 \'A로 해\'): 한 스텝 깜빡임 · 느린 감기 뒤 긋기는 이어 감이 아님 · 진짜 긋기 뒤 창 안 · 둥글게 꺾임은 이어 감 · old = 10/21 판', () => {
  assert.equal(IB_FLOW.detect, 'a');
  assert.equal(IB_FLOW.brake, 0.8); // 사장님 '제동을 좀더 늦추고' (0.5 → 0.8 — 사장님 확인 전)
  assert.equal(IB_FLOW.power, 1.2); // '위력도 그만큼 올려' (사장님 확인 전)
  const r = round('zweihander', kitOf('iberian', 'B1', 'B4', 'B5'), 9);
  try {
    const P = r.player;
    const st = (sw, vx, vy = 0, n = 1) => { P.skill.swinging = sw; P.skill.vel.set(vx, vy); for (let i = 0; i < n; i++) P.updateIbFlow(1 / 120); };
    st(false, 0, 0, 120); // 쉼 1 s
    st(true, 8); st(false, 1.2); st(true, 8, 0, 10); // 60 Hz 깜빡임: 한 스텝 꺼짐은 끝이 아님
    assert.equal(P.ibFlowOn, false);
    st(false, 0, 0, 120);
    st(true, 3.3, 0, 20); st(false, 1, 0, 4); st(true, 8, 0, 4); // 빠른 감기(손 목표 최고 3.3 < 5) → 0.03 s 뒤 긋기: 이어 감 아님
    assert.equal(P.ibFlowOn, false);
    st(false, 0, 0, 120);
    st(true, 8, 0, 20); st(false, 0, 0, 30); st(true, -8, 0, 2); // 진짜 긋기 → 0.25 s 쉼 → 다시: 이어 감
    assert.equal(P.ibFlowOn, true);
    st(false, 0, 0, 120);
    assert.equal(P.ibFlowOn, false); // 창(0.6 s) 넘게 쉬면 꺼짐
    st(true, 8, 0, 10); st(true, -8, 0, 2); // 쉬지 않고 90° 넘게 꺾음 (꺾이기 전이 진짜 긋기) = 둥글게 이어 감
    assert.equal(P.ibFlowOn, true);
    st(false, 0, 0, 120);
    st(true, 8, 0, 10); st(false, 0, 0, 6); st(true, 3, 0, 10); // 진짜 긋기 → 0.05 s → 감기: 감기엔 흐름 없음
    assert.equal(P.ibFlowOn, false);
    st(false, 0, 0, 6); st(true, -8, 0, 2); // 감기 뒤 긋기 — 앞 진짜 긋기가 끝나고 창 안이라 이어 감 (사이 감기는 창을 끊지 않음)
    assert.equal(P.ibFlowOn, true);
    st(false, 0, 0, 120);
    st(true, 3, 0, 10); st(true, -8, 0, 2); // 느린 감기에서 곧장 꺾어 긋기 — 이어 감 아님
    assert.equal(P.ibFlowOn, false);
    IB_FLOW.detect = 'old';
    st(false, 0, 0, 120);
    st(true, 8); st(false, 1.2); st(true, 8, 0, 2); // 10/21 판: 한 스텝 깜빡임도 '끝나고 곧 다시' = 이어 감
    assert.equal(P.ibFlowOn, true);
  } finally { IB_FLOW.detect = 'a'; r.world.free(); }
});
test('칸 효과 글 — 사장님 글 그대로 (10/29 14:1x · 14:2x — 특수 공격 넷 · 이어지는 흐름)', () => {
  const OWNER_EFF = {
    iberian: { B4: '칼을 어깨에 메었다가 온 몸으로 비스듬히 내려 가른다', B6: '이어 그을수록 세지고, 세 번째 긋기마다 기력을 쓰지 않는다' }, // B4 10/31 19:xx 사장님 글 (전 10/29 '칼을 머리 위로 돌려서 강하게 내려 벤다')
    italian: { I7: '내려 긋는 칼이 내려 찌르기로 나간다' }, // 10/31 13:xx 사장님 확정 (전 I9 '빗나간 막아찌르기 뒤 칼끝을 돌려 빼 가슴을 찌른다' — 칼끝 돌려 빼기가 I2 기본 기술로 바뀌며 글도 바뀜)
    chinese: { C6: '물러나는 척 칼을 거두며 나아가 허리를 벤다' },
    german: { G7: '칼이 맞물리면 상대 칼 뒤로 들어가 얼굴을 벤다' },
  };
  for (const [s, m] of Object.entries(OWNER_EFF)) for (const [id, eff] of Object.entries(m)) {
    assert.equal(D.nodeOf(s, id).eff, eff, id);
    assert.equal(DESIGN.find((x) => x.id === s).nodes.find((n) => n.id === id).eff, eff, `${id} 설계 자료`);
  }
});
test('B4 이름 · 효과 글 (10/31 19:xx 사장님 이름 \'정수리 가르기 (알티바슈 포르트)\' · 효과 글 \'칼을 어깨에 메었다가 온 몸으로 비스듬히 내려 가른다\'): 칸 이름 · 두 줄 · 효과 한 줄 · 설계 자료와 같음', () => {
  const n = D.nodeOf('iberian', 'B4');
  assert.deepEqual([n.name, n.l1, n.l2, n.u], ['정수리 가르기', '정수리', '가르기', 'redondo']);
  assert.equal(n.eff, '칼을 어깨에 메었다가 온 몸으로 비스듬히 내려 가른다');
  assert.equal(DESIGN.find((x) => x.id === 'iberian').nodes.find((x) => x.id === 'B4').eff, n.eff, '설계 자료');
  assert.ok(!/풍차|머리 위로 돌려/.test(n.eff + n.lore), '옛 감기 말 없음');
});
test('이어지는 흐름 (B6 — 사장님 10/29 01:4x · 01:5x · 14:1x · 14:2x): 이어 그은 수 n — 위력 1 + 0.2n 더하기 · 상한 없음 · 사슬 세 칼마다 베기 기력 0 · 끊기면 처음부터 · B5 만이면 1.2 · AI 는 그대로', () => {
  assert.equal(IB_FLOW.power, 1.2); // 사장님 10/29 01:5x 결정
  assert.equal(IB_FLOW.chainStack, 1);
  assert.equal(IB_FLOW.freeEvery, 3); // 14:2x '세 칼마다' (전 01:5x 0.9ⁿ — 없앰)
  assert.equal(IB_FLOW.chainCost, undefined);
  const run = (kit) => {
    const r = round('zweihander', kit, 9);
    const P = r.player;
    const st = (sw, vx, vy = 0, n = 1) => { P.skill.swinging = sw; P.skill.vel.set(vx, vy); for (let i = 0; i < n; i++) P.updateIbFlow(1 / 120); };
    return { r, P, st };
  };
  {
    const { r, P, st } = run(kitOf('iberian', 'B1', 'B5', 'B4', 'B6'));
    try {
      const seen = [];
      st(false, 0, 0, 120);
      st(true, 8, 0, 20); st(false, 0, 0, 30); // 첫 진짜 긋기 (이어 감 아님)
      assert.equal(P.ibChainN(), 0);
      for (let k = 1; k <= 8; k++) {
        st(true, k % 2 ? -8 : 8, 0, 20); // 창 안에 다시 = 이어 그은 칼 k
        seen.push([P.ibChainN(), +P.ibFlowK().toFixed(3), +P.ibChainCostK().toFixed(4)]);
        st(false, 0, 0, 30);
      }
      assert.deepEqual(seen.map((x) => x[0]), [1, 2, 3, 4, 5, 6, 7, 8]); // 상한 없음
      seen.forEach(([n, k, c]) => { assert.ok(Math.abs(k - (1 + 0.2 * n)) < 1e-9, `위력 n ${n}`); assert.equal(c, (n + 1) % 3 === 0 ? 0 : 1, `기력 n ${n} (사슬 ${n + 1} 번째 칼)`); });
      st(false, 0, 0, 120); // 창 밖 = 끊김
      st(true, 8, 0, 20);
      assert.equal(P.ibChainN(), 0);
      st(false, 0, 0, 30); st(true, -8, 0, 20);
      assert.equal(P.ibChainN(), 1); // 처음부터
      // 기력 (stamina.js chargeAttack — 베기만): 사슬 2 번째 칼 = 보통 · 3 번째 = 0 (회복 쉼은 다시 셈)
      const S = P.stamina;
      const before = S.value;
      S.chargeAttack('cut', false);
      assert.ok(Math.abs(before - S.value - 12 * S.weight) < 1e-6, '사슬 2 번째 칼 = 보통 베기');
      st(false, 0, 0, 30); st(true, 8, 0, 20);
      assert.equal(P.ibChainN(), 2);
      const b1 = S.value;
      S.rest = 5;
      S.chargeAttack('cut', false);
      assert.equal(S.value, b1, '사슬 3 번째 칼 = 기력 0');
      assert.equal(S.rest, 0, '공격이라 회복 쉼은 다시 셈');
      const b2 = S.value;
      S.chargeAttack('thrust', false);
      assert.ok(Math.abs(b2 - S.value - 10 * S.weight) < 1e-6, '찌르기는 그대로');
    } finally { r.world.free(); }
  }
  for (const [kit, why] of [[kitOf('iberian', 'B1', 'B5'), 'B5 만'], [null, 'AI 꼴']]) {
    const { r, P, st } = run(kit);
    try {
      if (!kit) P.aiControlled = true;
      st(false, 0, 0, 120);
      st(true, 8, 0, 20); st(false, 0, 0, 30); st(true, -8, 0, 20); st(false, 0, 0, 30); st(true, 8, 0, 20);
      assert.equal(P.ibFlowOn, true, why);
      assert.equal(P.ibFlowK(), 1.2, why); // 이어 그은 수와 상관없이 그대로
      assert.equal(P.ibChainCostK(), 1, why);
    } finally { r.world.free(); }
  }
  { const keep = IB_FLOW.chainStack; IB_FLOW.chainStack = 0; const { r, P, st } = run(kitOf('iberian', 'B1', 'B5', 'B4', 'B6')); try { st(false, 0, 0, 120); st(true, 8, 0, 20); st(false, 0, 0, 30); st(true, -8, 0, 20); st(false, 0, 0, 30); st(true, 8, 0, 20); assert.equal(P.ibFlowK(), 1.2, '끔'); } finally { IB_FLOW.chainStack = keep; r.world.free(); } }
});
test('실제 몸 — 손목 치기 칼 떨구기(J8 · 10/24): J8 을 익혀야 · 손목 치기만 · 칼 쥔 아래팔(손 · 손목)만 · 50 % 는 친 쪽 전용 난수 · 떨구면 칼을 놓침 · 못 떨구면 보통 맞음 그대로 · AI 가 모는 몸은 굴리지 않음', () => {
  const K = UNIQUE_ASSIST.koteDrop;
  assert.equal(K.p, 0.5); // 사장님 10/24 '너무 강하면 50%로'
  assert.deepEqual(K.parts, ['farmS', 'farmO']);
  assert.equal(Object.hasOwn(K, 'loose'), false); // 12:0x '0.6초 동안 한 손을 놓음 이 효과는 빼' — 손 풀림 없음
  assert.equal(K.judge, 'all'); // 12:3x 판정 완화 (감독 추천 — 아래팔 맞음 모두 + 상대 칼 손 쪽 절반)
  const lcg = (s) => ((Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; // fighter.buckleRandom 한 번
  const cut = { type: 'cut', severity: 0.2 }; // 칼날이 들어간 베기
  const J = ['J1', 'J7'];
  // J8 없음 → 굴리지 않음
  let g = round('monohoshizao', kitOf('japanese', ...J), 9);
  try {
    g.player.artTech = 'kote';
    g.combat.koteCheck(g.player, g.enemy, 'farmS', cut);
    assert.equal((g.combat.koteLog ?? []).length, 0); assert.equal(g.enemy.armed, true);
  } finally { g.world.free(); }
  // J8 있음: 손목 · 아래팔 아닌 곳 · 다른 기술 · 빈손 쪽(두 손으로 쥐지 않은 한 손 칼) · AI 가 모는 몸 · 맞음 없음 → 굴리지 않음
  g = round('monohoshizao', kitOf('japanese', ...J, 'J8'), 9);
  try {
    const P = g.player, E = g.enemy;
    P.artTech = 'kote';
    for (const part of ['head', 'chest', 'uarmS', 'uarmO', 'thighF', 'shinB']) g.combat.koteCheck(P, E, part, cut);
    P.artTech = 'hirakiGiri'; g.combat.koteCheck(P, E, 'farmS', cut);
    P.artTech = 'kote'; E.gripping = false; g.combat.koteCheck(P, E, 'farmO', cut);
    P.aiControlled = true; g.combat.koteCheck(P, E, 'farmS', cut); P.aiControlled = false;
    g.combat.koteCheck(P, E, 'farmS', null);
    assert.equal((g.combat.koteLog ?? []).length, 0); assert.equal(E.armed, true);
    // 50 %: 친 쪽 전용 난수(무릎 꺾기와 같은 줄)로 한 번 굴림 — 못 떨구면 칼 · 손 · 걸음 그대로
    const keep = Math.random; Math.random = () => { throw Error('Math.random 을 쓰면 안 됨'); };
    try {
      let tries = 0;
      while (E.armed && tries < 40) {
        const want = lcg(P._buckleSeed) < K.p;
        const before = { grip: E.gripJoint, cone: E.gripCone, state: E.state, limbs: { ...E.limbs } };
        g.combat.koteCheck(P, E, tries % 2 ? 'farmO' : 'farmS', tries % 3 ? cut : { type: 'blunt', severity: 0 }); E.gripping = true; // 짝수 = 칼 든 손 · 홀수 = 두 손으로 쥔 빈손 쪽 · 칼면 맞음도
        const last = g.combat.koteLog.at(-1);
        assert.equal(last.drop, want); tries++;
        if (!want) { assert.equal(E.armed, true); assert.equal(E.gripJoint, before.grip); assert.equal(E.gripCone, before.cone); assert.equal(E.state, before.state); assert.deepEqual(E.limbs, before.limbs); }
      }
      assert.equal(E.armed, false, '떨굼'); assert.ok(g.combat.koteLog.length >= 1);
      assert.ok(Number.isFinite(E.koteDropAt));
      const n = g.combat.koteLog.length;
      g.combat.koteCheck(P, E, 'farmS', cut); assert.equal(g.combat.koteLog.length, n, '칼이 없으면 더 굴리지 않음');
    } finally { Math.random = keep; }
  } finally { g.world.free(); }
  // 굴린 수 가운데 떨군 몫 ≈ 50 % (같은 난수 줄을 1000 번)
  let s = 12345, d = 0; for (let i = 0; i < 1000; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; if (s / 4294967296 < K.p) d++; }
  assert.ok(d > 450 && d < 550, `${d}`);
  // 몫 없는 몸(시뮬 · 테스트 경로 = 모두 켬)은 굴림 · p 0 이면 끔
  g = round('monohoshizao', null, 9);
  try {
    g.player.artTech = 'kote';
    const p0 = K.p; K.p = 0; try { g.combat.koteCheck(g.player, g.enemy, 'farmS', cut); } finally { K.p = p0; }
    assert.equal((g.combat.koteLog ?? []).length, 0);
    K.p = 1; try { g.combat.koteCheck(g.player, g.enemy, 'farmS', cut); } finally { K.p = p0; }
    assert.equal(g.combat.koteLog.length, 1); assert.equal(g.enemy.armed, false);
  } finally { g.world.free(); }
});
test('실제 몸 — 칼 떨구기 판정(10/24 12:3x 판정 완화): cut = 칼날 베기 · 심각도 > 0 만 / arm = 아래팔 맞음 모두(칼면 · 심각도 0) / all = + 상대 칼 손 쪽 절반을 세게 친 순간 · 손목 치기 한 번에 한 번', () => {
  const K = UNIQUE_ASSIST.koteDrop, keep = { p: K.p, judge: K.judge };
  const flat = { type: 'blunt', severity: 0, energy: 6 }, nick = { type: 'cut', severity: 0 };
  const run = (fn) => { const g = round('monohoshizao', null, 9); try { g.player.artTech = 'kote'; g.combat.koteProbe = []; fn(g); return g.combat.koteLog ?? []; } finally { g.world.free(); Object.assign(K, keep); } };
  // 아래팔 칼면 · 심각도 0 — cut 판은 굴리지 않음(적기만) · arm · all 은 굴림
  K.judge = 'cut'; assert.equal(run((g) => { g.combat.koteCheck(g.player, g.enemy, 'farmS', flat); g.combat.koteCheck(g.player, g.enemy, 'farmS', nick); assert.deepEqual(g.combat.koteProbe.map((e) => e.kind), ['arm', 'arm']); }).length, 0);
  for (const j of ['arm', 'all']) { K.judge = j; assert.equal(run((g) => g.combat.koteCheck(g.player, g.enemy, 'farmS', flat)).length, 1, j); }
  // 상대 칼 손 쪽 절반: 맞닿은 자리 = 상대 칼날 0.2(손 쪽) · 맞부딪는 빠르기 > 3 · 내 칼이 그 자리로 들어감 → all 만 굴림
  const clash = (g, { at = 0.2, vn = 4, v = 2 } = {}) => {
    const P = g.player, E = g.enemy, point = E.bladePoint(at), c = P.sword.translation();
    const nrm = new Vector3(point.x - c.x, point.y - c.y, point.z - c.z).normalize(); // 앞 칼(P — 번호가 작은 쪽) → 뒤 칼
    const S = (vel) => ({ com: point.clone(), w: new Vector3(), v: vel });
    g.combat.koteSword({ fighter: P }, { fighter: E }, S(nrm.clone().multiplyScalar(v)), S(new Vector3()), point, nrm, vn);
  };
  K.judge = 'all'; assert.equal(run((g) => clash(g)).length, 1);
  assert.equal(run((g) => clash(g)).at(-1).kind, 'sword');
  K.judge = 'all'; assert.equal(run((g) => clash(g, { at: 0.8 })).length, 0, '칼끝 쪽 절반은 아님');
  K.judge = 'all'; assert.equal(run((g) => clash(g, { at: -0.05 })).length, 1, '코등이 · 자루 쪽도 손 쪽');
  K.judge = 'all'; assert.equal(run((g) => clash(g, { vn: K.swordVn })).length, 0, '맞부딪는 빠르기가 문턱 이하');
  K.judge = 'all'; assert.equal(run((g) => clash(g, { v: 0.4 })).length, 0, '내 칼이 들어간 맞부딪힘이 아님');
  K.judge = 'arm'; assert.equal(run((g) => { clash(g); assert.equal(g.combat.koteProbe.at(-1).kind, 'sword'); }).length, 0, 'arm 판은 칼 닿음을 굴리지 않음');
  K.judge = 'all'; assert.equal(run((g) => { g.player.aiControlled = true; clash(g); }).length, 0, 'AI 가 모는 몸은 아님');
  // 손목 치기 한 번에 한 번: 같은 긋기(skill.uniq.cur)에서 칼 → 손목이 이어 닿아도 한 번 · 다음 긋기는 다시
  K.judge = 'all'; K.p = 1e-9; // 떨구지 않고 굴림만 셈
  const log = run((g) => {
    const P = g.player; P.artTech = null; P.skill.uniq = { cur: { unique: 'kote' }, last: null, stats: { strokes: 1 } };
    clash(g); g.combat.koteCheck(P, g.enemy, 'farmS', { type: 'cut', severity: 0.3 });
    P.skill.uniq.last = P.skill.uniq.cur; P.skill.uniq.cur = { unique: 'kote' }; P.skill.uniq.stats.strokes = 2;
    g.combat.koteCheck(P, g.enemy, 'farmS', { type: 'cut', severity: 0.3 });
    P.skill.uniq = null;
  });
  assert.deepEqual(log.map((e) => e.kind), ['sword', 'cut']);
});
test('실제 몸 — 칼 떨구기 뒤: 떨어진 칼은 땅으로 (값이 깨지지 않음) · 칼 없는 AI 는 치지 않고 물러남 · 다른 쪽 칼에는 판정 없음', () => {
  const g = newRound({ weapon: 'monohoshizao', weapon2: 'longsword', seed: 4 });
  try {
    for (let i = 0; i < 360; i++) g.step(); // 판 시작 정지 뒤
    const E = g.enemy, K = UNIQUE_ASSIST.koteDrop, p0 = K.p;
    g.player.artTech = 'kote';
    K.p = 1; try { g.combat.koteCheck(g.player, E, 'farmS', { type: 'cut', severity: 0.2 }); } finally { K.p = p0; }
    g.player.artTech = null;
    assert.equal(E.armed, false);
    let attack = 0, minY = Infinity;
    for (let i = 0; i < 480; i++) {
      g.step();
      const p = E.sword.translation(), v = E.sword.linvel();
      assert.ok([p.x, p.y, p.z, v.x, v.y, v.z].every(Number.isFinite), 'NaN');
      minY = Math.min(minY, p.y);
      if (g.ai.mode === 'attack') attack++;
    }
    assert.equal(E.armed, false, '줍기 없음');
    assert.ok(minY < 0.3, `칼이 땅으로 ${minY}`);
    assert.equal(attack, 0, '칼 없는 AI 는 치지 않음');
    assert.equal(E.alive, true);
  } finally { g.world.free(); }
});
test('실제 몸 — 고유 공격 · 비기: 익힌 칸의 기술만 · 비기는 비기 칸(열린 유파만)', () => {
  const g = round('longsword', kitOf('german', 'G1', 'G8'), 9);
  try {
    const u = new PlayerUniqueAssist(g.player, { names: kitOf('german', 'G1', 'G8').unique });
    assert.deepEqual(u.list.map((e) => e.name), ['zwerchAbtritt']);
    assert.equal(new PlayerUniqueAssist(g.player, { names: new Set() }).list.length, 0);
    assert.equal(new PlayerUniqueAssist(g.player, { stage: 4 }).list.length, 3); // 단계로 거르는 길(시험 · 도구)은 그대로
  } finally { g.world.free(); }
  const it = round('rapier', kitOf('italian', 'I1', 'I3', 'I2', 'I7', 'I8', 'I4'), 9);
  try {
    assert.equal(new PlayerSecretWatch(it.player, it.enemy, { locked: !kitOf('italian', 'I4').secret }).S?.name, 'andareRisoluto'); // 10/22 이탈리아 사람 비기
    assert.equal(new PlayerSecretWatch(it.player, it.enemy, { locked: !kitOf('italian', 'I8').secret }).S, null);
  } finally { it.world.free(); }
  const j = round('monohoshizao', kitOf('japanese', 'J1', 'J2', 'J3', 'J4', 'J5'), 9);
  try {
    assert.ok(new PlayerSecretWatch(j.player, j.enemy, { locked: !kitOf('japanese', 'J1', 'J2', 'J3', 'J4', 'J5').secret }).S);
    assert.equal(new PlayerSecretWatch(j.player, j.enemy, { locked: !kitOf('japanese', 'J1', 'J2', 'J3', 'J4').secret }).S, null);
  } finally { j.world.free(); }
});
test('판 칸 이름(name)이 모든 칸에 있고 갈래 말(보법 · 막기 · 패시브 · 비기 · 심화)로 시작하지 않음 (사장님 10/22)', () => {
  for (const s of D.TREE_SCHOOLS) for (const n of D.nodesOf(s)) {
    assert.ok(n.name && n.name.length <= 12, `${n.id} name`);
    assert.ok(!/^(보법|막기|패시브|비기|심화)( |$)/.test(n.name), `${n.id} ${n.name}`);
  }
});
test('칸 오의(lore · src — 사장님 10/22 00:5x 원전의 오의를 밝힌 예전 방식): 모든 칸에 lore · 45 자 안 · 숫자 · 로마자 · 한자 · 가나 없음 / 편지 아닌 칸은 src 있음 · 편지 칸은 src 없음(편지에 한한 예외 — 10/22 01:1x)', () => {
  let n = 0;
  for (const s of D.TREE_SCHOOLS) for (const x of D.nodesOf(s)) {
    n++;
    if (s === 'italian' && x.id === 'I8') { // 10/31 헛누름: 오의 비움 — 저장소 원전 읽기표에 맞는 카포 페로 · 파브리스 줄이 없어 지어내지 않음 (여쭐 것 · 화면은 오의 상자를 숨김)
      assert.equal(x.lore, undefined, 'I8 오의 비움');
      continue;
    }
    assert.equal(typeof x.lore, 'string', `${x.id} lore`);
    assert.ok(x.lore.trim().length > 0, `${x.id} lore 빈칸`);
    assert.ok([...x.lore].length <= 45, `${x.id} lore ${[...x.lore].length} 자`);
    assert.ok(!/[0-9０-９]/u.test(x.lore), `${x.id} lore 숫자: ${x.lore}`);
    assert.ok(!/[\p{Script=Latin}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(x.lore), `${x.id} lore 원어 글자: ${x.lore}`);
    if (x.letter) assert.equal(x.src, undefined, `${x.id} 편지 칸은 출처 없음`);
    else assert.ok(typeof x.src === 'string' && x.src.trim().length > 0, `${x.id} src`);
  }
  assert.equal(n, 55);
});

test('10/23 비기 이름 = 원어 독음 (동방은 한자 한국식 독음) · 스킬 화면 제목은 원어를 괄호로 함께', async () => {
  const { nodeTitle } = await import('../../src/skill_tree.js');
  const { TREE } = await import('../../src/skill_tree_data.js');
  const want = { german: ['모르트슐라크', 'Mordschlag'], italian: ['안다레 리솔루토', 'andare risoluto'], iberian: ['싱지르', 'cingir'], japanese: ['고노센', '後の先'], chinese: ['격살', '格殺'] };
  for (const [school, [ko, orig]] of Object.entries(want)) {
    const n = TREE[school].nodes.find((x) => x.cat === 'secret');
    assert.equal(n.name, ko, school);
    assert.equal(nodeTitle(school, n).title, `비기 · ${ko} (${orig})`, school);
  }
});
