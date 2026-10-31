// 생사전 1단계 (사장님 10/29 14:1x · 14:2x · 14:5x — docs/design/saengsa_2026-10-29.md): 시계(신청 창 · 첫 대진 · 쉬는 시간) · 대진표 만들기 · 저절로 끝내기 · 기권 ·
//  빠른 셈 고정 · 부상 회복(경상 2번 쉬면 · 중상 그대로) · 하사품 · 저장 왕복. 시각은 모두 현지 시각으로 만든다(new Date(y, m, d, h, mi)) — 기기 시간대와 무관
import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { SAENGSA } = await import('../../src/config.js');
const C = await import('../../src/saengsa_clock.js');
const R = await import('../../src/saengsa_rules.js');
const S = await import('../../src/saengsa_store.js');
const P = await import('../../src/lobby_progress.js');

const at = (d, h, mi = 0) => new Date(2026, 9, d, h, mi).getTime(); // 2026-10-d h:mi (현지)
const ROSTER = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'];
const PROF = { german: 2, italian: 1, iberian: 1, japanese: 0, chinese: 0, none: 1 };
const DATA = { roster: ROSTER, drawWeapon: (r) => ['w1', 'w2', 'w3'][Math.floor(r() * 3)], weaponInfo: () => ({ school: 'german', tier: 'common' }), profOf: () => ({ ...PROF }) };
const make = (seed = 7, extra = {}) => R.createTournament({ day: '2026-10-30', seed, at: at(29, 23), companions: ['a', 'b'], ...DATA, ...extra });
/** 내 경기를 이 쪽이 이긴 결과로 (체력 · 부상은 넘긴 대로) */
const winFor = (t, m, fighters = {}) => ({ winner: R.sidesOf(t, m)[0] === 0 ? 'a' : 'b', fighters });

test('시계: 신청 창은 밤 10시 ~ 새벽 2시(자정을 넘김) · 첫 대진 10시 · 대진 2시간마다', () => {
  assert.deepEqual({ ...C.signupWindow(at(29, 21, 59)) }, { day: '2026-10-30', from: at(29, 22), to: at(30, 2), open: false });
  assert.equal(C.signupWindow(at(29, 22)).open, true);
  assert.equal(C.signupWindow(at(30, 1, 59)).open, true);
  assert.equal(C.signupWindow(at(30, 1, 59)).day, '2026-10-30');
  const after = C.signupWindow(at(30, 2));
  assert.deepEqual([after.open, after.day, after.from], [false, '2026-10-31', at(30, 22)]);
  assert.equal(C.startAt('2026-10-30'), at(30, 10));
  assert.deepEqual([0, 1, 2, 3].map((r) => C.roundAt('2026-10-30', r)), [at(30, 10), at(30, 12), at(30, 14), at(30, 16)]);
  assert.equal(C.parseLocal('2026-10-30T09:59'), at(30, 9, 59));
  const clock = C.clockFrom('?saengsaNow=2026-10-30T09:59', () => 1000);
  assert.equal(clock(), at(30, 9, 59));
});

test('대진표: 16 팀 · 15 경기 · 이름난 인물은 한 번씩 · 남는 자리는 무명 검객(팀 안 옷 색 다름) · 씨앗이 같으면 같은 대회', () => {
  const t = make(11, { weapons: ['tree_branch', 'w9', 'w8'] });
  assert.equal(t.teams.length, SAENGSA.teams);
  assert.equal(t.matches.length, SAENGSA.teams - 1);
  assert.deepEqual(t.teams[0].members.map((f) => f.id), ['player', 'a', 'b']);
  assert.deepEqual(t.teams[0].members.map((f) => f.weapon), ['tree_branch', 'w9', 'w8']); // 내 팀 무기 = 내가 배정 (사장님 10/29 18:2x)
  const ai = t.teams.slice(1).flatMap((team) => team.members);
  const named = ai.filter((f) => f.id !== R.NAMELESS).map((f) => f.id);
  assert.deepEqual([...named].sort(), ROSTER.filter((id) => !['a', 'b'].includes(id)).sort()); // 아홉 명이 한 번씩
  assert.equal(ai.length - named.length, 45 - 9);
  for (const team of t.teams.slice(1)) {
    assert.ok(team.members.filter((f) => f.id !== R.NAMELESS).length <= 1);
    const cloth = team.members.filter((f) => f.id === R.NAMELESS).map((f) => f.cloth);
    assert.equal(new Set(cloth).size, cloth.length);
  }
  const hired = make(3, { companions: [R.NAMELESS, R.NAMELESS] });
  assert.deepEqual(hired.teams[0].members.map((f) => [f.id, f.cloth]), [['player', undefined], [R.NAMELESS, 0], [R.NAMELESS, 1]]);
  assert.equal(hired.teams.slice(1).flatMap((x) => x.members).filter((f) => f.id !== R.NAMELESS).length, 11);
  assert.deepEqual([...R.seatOrder(t)].sort((x, y) => x - y), [...Array(16).keys()]);
  assert.deepEqual(make(11, { weapons: ['tree_branch', 'w9', 'w8'] }), t);
  assert.notDeepEqual(make(12), t);
});

test('저절로 끝내기: 10시 전엔 없음 · 10시에 상대끼리 7 경기 · 내 경기는 기다림(입장 가능)', () => {
  const t = make();
  assert.equal(R.advance(t, at(30, 9, 59)), 0);
  assert.equal(R.advance(t, at(30, 10)), 7);
  const m = R.myMatch(t);
  assert.equal(m.round, 0);
  assert.equal(R.matchState(t, m, at(30, 10)), 'ready');
  assert.ok(t.matches.filter((x) => x.result).every((x) => x.result.at === at(30, 10) && x.result.by === 'quick' && Number.isInteger(x.result.seed) && x.result.ver && x.result.pre.a.length === 3));
  assert.equal(R.advance(t, at(30, 12)), 3); // 8강 가운데 상대끼리 셋 (내 쪽 하나는 내 결과를 기다림)
});

test('쉬는 시간: 늦게 저장한 결과에서 2시간 · 그 전엔 다음 경기 못 함', () => {
  const t = make();
  R.advance(t, at(30, 11, 30));
  const m0 = R.myMatch(t), picks = ['0-0', '0-1'];
  assert.ok(R.finishMine(t, m0, picks, at(30, 11, 30), winFor(t, m0)));
  R.advance(t, at(30, 13));
  const m1 = R.myMatch(t);
  assert.equal(m1.round, 1);
  assert.equal(R.readyAt(t, m1), at(30, 13, 30));
  assert.equal(R.matchState(t, m1, at(30, 13)), 'soon');
  assert.equal(R.matchSetup(t, m1, picks, at(30, 13)), null);
  assert.equal(R.matchState(t, m1, at(30, 13, 30)), 'ready');
  const setup = R.matchSetup(t, m1, picks, at(30, 13, 30));
  assert.equal(setup.control, 'player');
  assert.ok(setup.entrants[setup.mineSide === 'a' ? 'b' : 'a'].length >= 1);
  assert.equal(R.matchSetup(t, m1, ['0-1'], at(30, 13, 30)).control, 'watch');
});

test('기권: 내 경기를 밤 10시(다음 신청 창)까지 안 하면 진다 · 대회는 끝까지 간다', () => {
  const t = make();
  R.advance(t, at(30, 21, 59));
  assert.ok(R.myMatch(t));
  R.advance(t, at(30, 22));
  assert.equal(R.myMatch(t), null);
  assert.equal(R.myTeamOut(t), true);
  const lost = t.matches.find((m) => m.result?.by === 'forfeit');
  assert.equal(lost.result.at, at(30, 22));
  R.advance(t, Infinity);
  assert.equal(t.status, 'done');
  assert.notEqual(t.champion, 0);
  assert.equal(R.placeOf(t), 'first');
  assert.equal(R.chestCount(t), 0);
  assert.equal(R.canSignUp(at(30, 22, 5), t), true);
});

test('빠른 셈: 같은 판 · 같은 씨앗이면 같은 결과 · 이긴 쪽은 적어도 한 사람이 산다', () => {
  const f = (key, hp, tier = 'common') => ({ key, id: key, weapon: 'w', school: 'german', tier, prof: { ...PROF }, hp, injuries: [], dead: false });
  const sides = { a: [f('0-0', 100), f('0-1', 30)], b: [f('1-0', 100, 'legend')] };
  const one = R.quickResolve(sides, 42), again = R.quickResolve(structuredClone(sides), 42);
  assert.deepEqual(one, again);
  for (let s = 0; s < 200; s++) {
    const low = { a: [f('0-0', 3), f('0-1', 2)], b: [f('1-0', 2)] };
    const r = R.quickResolve(low, s);
    assert.ok(low[r.winner].some((x) => r.fighters[x.key].alive), `씨앗 ${s}`);
  }
  assert.ok(R.winChance([f('x', 100, 'legend')], [f('y', 30, 'trash')]) > 0.8);
});

test('부상: 경상은 두 번 쉬면 낫고 중상은 대회 동안 그대로 · 쉬면 체력이 조금 찬다', () => {
  const t = make();
  R.advance(t, at(30, 10));
  const m0 = R.myMatch(t);
  const light = { part: 'arm', sev: SAENGSA.seriousAt - 0.1, rests: 0 }, serious = { part: 'leg', sev: SAENGSA.seriousAt, rests: 0 };
  R.finishMine(t, m0, ['0-0'], at(30, 10, 5), winFor(t, m0, { '0-0': { hp: 20, injuries: [light, serious], alive: true } }));
  const me = () => t.teams[0].members[0];
  assert.equal(me().hp, 20 + SAENGSA.restHeal);
  assert.deepEqual(me().injuries.map((i) => [i.part, i.rests]), [['arm', 1], ['leg', 0]]);
  R.advance(t, at(30, 12, 5));
  const m1 = R.myMatch(t);
  R.finishMine(t, m1, ['0-1'], at(30, 12, 5), winFor(t, m1));
  assert.deepEqual(me().injuries.map((i) => i.part), ['leg']); // 경기 k 의 경상은 k + 2 전에 없음
  assert.equal(me().hp, Math.min(SAENGSA.hpMax, 20 + 2 * SAENGSA.restHeal));
  assert.deepEqual(R.injuriesFromWounds([], [{ part: 'uarmS', severity: 0.05 }, { part: 'neck', severity: 0.7 }]), [{ part: 'head', sev: 0.7, rests: 0 }]);
});

test('하사품: 우승 셋 · 준우승 하나 · 하나에 금화 500 · 한 번만 받음', () => {
  const t = make();
  for (const h of [10, 12, 14, 16]) {
    R.advance(t, at(30, h));
    const m = R.myMatch(t);
    R.finishMine(t, m, ['0-0'], at(30, h), winFor(t, m));
  }
  assert.equal(t.status, 'done');
  assert.equal(R.placeOf(t), 'champion');
  assert.deepEqual(R.openChests(t), [{ kind: 'coins', amount: 500 }, { kind: 'coins', amount: 500 }, { kind: 'coins', amount: 500 }]);
  S.updateSaengsa((d) => { d.current = t; return true; });
  const before = P.readProgress().coins;
  assert.equal(S.claimChests().length, 3);
  assert.equal(S.claimChests(), null);
  assert.equal(P.readProgress().coins, before + 1500);
  const u = make();
  for (const h of [10, 12, 14, 16]) {
    R.advance(u, at(30, h));
    const m = R.myMatch(u), w = winFor(u, m);
    R.finishMine(u, m, ['0-0'], at(30, h), h < 16 ? w : { ...w, winner: w.winner === 'a' ? 'b' : 'a' });
  }
  assert.deepEqual([u.status, R.placeOf(u), R.chestCount(u)], ['done', 'final', 1]);
});

test('저장 왕복 · 신청(입장 조건 · 무기 배정 · 고용 금화) · 깨진 저장은 버림', () => {
  mem.clear();
  const t = make(5);
  assert.equal(S.updateSaengsa((d) => { d.current = t; return true; }).saved, true);
  assert.deepEqual(S.readSaengsa().current, t);
  mem.set(S.SAENGSA_KEY, JSON.stringify({ version: 1, current: { ...t, teams: t.teams.slice(0, 3) } }));
  assert.equal(S.readSaengsa().current, null);
  mem.clear();
  P.setCoins(30);
  const OWNED = ['tree_branch', 'druid_whip', 'w1', 'w2', 'w3'], W = ['tree_branch', 'w1', 'w2'];
  const data = { ...DATA, owned: OWNED, hasTitle: true, hireCostOf: () => ({ coins: 20 }) };
  assert.equal(S.signUp({ now: at(29, 23), companions: ['a', 'b'], weapons: W, seed: 1, data: { ...data, hasTitle: false } }).why, 'entry'); // 정복자 호칭 없음
  assert.equal(S.signUp({ now: at(29, 23), companions: ['a', 'b'], weapons: W, seed: 1, data: { ...data, owned: OWNED.slice(0, 4) } }).why, 'entry'); // 무기 넷
  assert.equal(S.signUp({ now: at(29, 23), companions: ['a', 'b'], weapons: W, seed: 1, data }).why, 'coins');
  P.setCoins(100);
  assert.equal(S.signUp({ now: at(29, 21), companions: ['a', 'b'], weapons: W, seed: 1, data }).why, 'closed');
  assert.equal(S.signUp({ now: at(29, 23), companions: ['a', 'b'], weapons: ['tree_branch', 'w1'], seed: 1, data }).why, 'weapons'); // 셋 다
  assert.equal(S.signUp({ now: at(29, 23), companions: ['a', 'b'], weapons: ['tree_branch', 'w1', 'w1'], seed: 1, data }).why, 'weapons'); // 한 무기는 한 사람에게(확인 전)
  assert.equal(S.signUp({ now: at(29, 23), companions: ['a', 'b'], weapons: ['tree_branch', 'w1', 'longsword'], seed: 1, data }).why, 'weapons'); // 안 가진 무기
  assert.equal(P.readProgress().coins, 100);
  const ok = S.signUp({ now: at(29, 23), companions: ['a', 'b'], weapons: W, seed: 1, data });
  assert.deepEqual([ok.ok, ok.cost, P.readProgress().coins], [true, 40, 60]);
  assert.deepEqual(S.readSaengsa().current.teams[0].members.map((f) => f.weapon), W);
  assert.deepEqual(S.readSaengsa().draft.weapons, W);
  assert.equal(S.signUp({ now: at(29, 23, 30), companions: ['a', 'b'], weapons: W, seed: 2, data }).why, 'busy');
  // 경기마다 배정: 살아 있는 사람만 · 가진 무기 · 서로 다르게 — 결과의 pre 에 그 경기 무기
  S.syncSaengsa(at(30, 10));
  const m0 = R.myMatch(S.readSaengsa().current);
  const info = (w) => ({ school: w === 'w3' ? 'italian' : 'german', tier: 'rare' });
  assert.equal(S.playMine(m0.id, ['0-0'], at(30, 10), null, { arm: { weapons: ['w3', 'w1', 'w1'], owned: OWNED, weaponInfo: info } }), null);
  const res = S.playMine(m0.id, ['0-0'], at(30, 10), null, { arm: { weapons: ['w3', 'druid_whip', 'w2'], owned: OWNED, weaponInfo: info } });
  const mineSide = R.sidesOf(S.readSaengsa().current, m0)[0] === 0 ? 'a' : 'b';
  assert.deepEqual([res.pre[mineSide][0].weapon, res.pre[mineSide][0].school, res.pre[mineSide][0].tier], ['w3', 'italian', 'rare']);
  assert.deepEqual(S.readSaengsa().current.teams[0].members.map((f) => f.weapon), ['w3', 'druid_whip', 'w2']);
  const dead = make(4, { weapons: W });
  dead.teams[0].members[2].dead = true;
  assert.equal(R.assignWeapons(dead, ['w1', 'w2', 'w2'], { owned: OWNED, weaponInfo: info }), true); // 죽은 사람 자리는 셈 밖
  assert.deepEqual(dead.teams[0].members.map((f) => f.weapon), ['w1', 'w2', 'w2']);
  assert.deepEqual(R.entryMissing({ hasTitle: false, owned: 2 }), [{ kind: 'title' }, { kind: 'weapons', have: 2, need: 5 }]);
  assert.deepEqual(R.entryMissing({ hasTitle: true, owned: 5 }), []);
  mem.set(S.SAENGSA_KEY, JSON.stringify({ version: 1 })); // 빈 저장 (저장소 열쇠가 없으면 이번 실행 값을 쥐고 있으니 빈 판을 적는다)
  assert.equal(S.signUp({ now: at(29, 23), companions: ['a', 'a'], weapons: W, seed: 3, data }).why, 'team');
  assert.equal(S.signUp({ now: at(29, 23), companions: [R.NAMELESS, R.NAMELESS], weapons: W, seed: 3, data }).ok, true); // 무명 검객은 둘 다여도 됨
  mem.set(S.SAENGSA_KEY, JSON.stringify({ version: 1, draft: { companions: ['a', 'b'], lend: { weapon: 'w2', to: 1 } } })); // 옛 꼴 → 그 자리 무기
  assert.deepEqual(S.readSaengsa().draft, { companions: ['a', 'b'], weapons: [null, 'w2', null] });
});

test('가진 무기 · 입장 조건 글 (사장님 10/29 18:2x)', async () => {
  const { ownedWeapons, weaponReceipt } = await import('../../src/owned_weapons.js');
  const { entryLine } = await import('../../src/saengsa_text.js');
  const { TITLE } = await import('../../src/title_rules.js');
  assert.deepEqual(ownedWeapons({ acquisitions: [] }), ['tree_branch', 'druid_whip']);
  const acq = [{ receipt: weaponReceipt('longsword'), kind: 'item' }, { receipt: 'skill:german:G1', kind: 'skill' }, { receipt: weaponReceipt('nope'), kind: 'item' }, { receipt: weaponReceipt('rapier'), kind: 'item' }];
  assert.deepEqual(ownedWeapons({ acquisitions: acq }), ['tree_branch', 'druid_whip', 'longsword', 'rapier']);
  assert.equal(entryLine(R.entryMissing({ hasTitle: false, owned: 2 })), '정복자 호칭이 필요합니다 · 무기 5개가 필요합니다 (지금 2개)');
  assert.deepEqual([SAENGSA.entry.title, SAENGSA.entry.weapons, TITLE.conquerWins], ['conqueror', 5, 10]);
  assert.ok(SAENGSA.testWeapons.length + 2 >= 8 && SAENGSA.testWeapons.length + 2 <= 10);
  const schools = new Set((await Promise.all(SAENGSA.testWeapons.map(async (id) => (await import('../../src/saengsa_roster.js')).weaponInfo(id).school))));
  assert.equal(schools.size, 5); // 다섯 유파 (+ 시작 무기 무유파)
});

test('로스터 · 숙련도(인물 성향 표) · 고용 값 · 무명 검객', async () => {
  const roster = await import('../../src/saengsa_roster.js');
  const { CHARACTERS_BY_ID } = await import('../../src/characters.js');
  const { PROFICIENCY } = await import('../../src/character_temperament.js');
  // 로스터 = 그림이 있는 모든 인물 (사장님 10/29 22:3x — 손님 · 아르토리아 · 얼터도 생사전 인물 · 기본 인물과 얼터는 다른 사람)
  assert.equal(roster.SAENGSA_ROSTER.length, Object.keys(CHARACTERS_BY_ID).length);
  for (const id of ['artoria', 'roland', 'bernardo', 'white_scale', 'silver_wanderer', 'silver_wanderer_mad', 'minami_mad', 'liao_mad']) assert.ok(roster.SAENGSA_ROSTER.includes(id), id);
  assert.deepEqual(roster.HIRE_ROSTER.slice(-1), [R.NAMELESS]);
  for (const id of roster.SAENGSA_ROSTER) {
    const p = roster.profOf(id), c = CHARACTERS_BY_ID[id], base = PROFICIENCY[id] ?? PROFICIENCY[c.variantOf];
    const sheet = roster.weaponInfo(c.weapon).school;
    for (const s of R.SCHOOLS5) if (!(c.variantOf && s === sheet)) assert.equal(p[s], base[s], `${id} ${s}`); // 얼터는 원본 칸(시트 무기 유파 칸만 +1)
    assert.equal('none' in p, 'none' in base, id); // 무유파 칸은 무유파가 주 유파인 인물만
    assert.equal(p[sheet], c.ai.proficiency, id); // 시트 무기 유파 = 실력 숙련도 (얼터 +1 · 상한 6 포함)
    assert.equal(roster.hireCostOf(id).coins, SAENGSA.hire.base + SAENGSA.hire.step * Math.max(...Object.values(p)));
  }
  assert.deepEqual(roster.profOf(R.NAMELESS), { german: 0, italian: 0, iberian: 0, japanese: 0, chinese: 0 }); // 만들기 전 빈 칸 — 신청 때 makeNameless
  assert.equal(roster.hireCostOf(R.NAMELESS).coins, 20);
  assert.equal(R.profFor({ school: 'none', prof: { german: 2, italian: 0, iberian: 0, japanese: 3, chinese: 0 } }), 2); // 무유파 무기 · none 칸 없음 → 가장 높은 값 − 1
  assert.equal(R.profFor({ school: 'none', prof: { german: 0, italian: 0, iberian: 0, japanese: 0, chinese: 0, none: 3 } }), 3);
  assert.ok(roster.SAENGSA_WEAPONS.length > 20 && !roster.SAENGSA_WEAPONS.includes('excalibur_replica'));
});

test('무명 검객 겉모습: 광기의 브론 옷차림 · 옷 일곱 색만 옷 색 줄로 · 살갗 · 머리 그대로 · 프로필 옷 칸 가리기', async () => {
  const N = await import('../../src/saengsa_nameless.js');
  const { CHARACTERS_BY_ID } = await import('../../src/characters.js');
  const base = CHARACTERS_BY_ID.bran_mad.look;
  const looks = Array.from({ length: N.clothCount() }, (_, i) => N.namelessLook(i));
  for (const look of looks) {
    assert.deepEqual(Object.keys(look.outfitPalette), Object.keys(base.outfitPalette));
    assert.equal(look.alter, 'bran');
    for (const k of ['skin', 'hair', 'helmet', 'eyeColor']) assert.equal(look[k], base[k], k);
    assert.notEqual(look.tunic, base.tunic);
  }
  assert.equal(new Set(looks.map((l) => l.tunic)).size, looks.length); // 옷 색 줄마다 다른 옷
  assert.equal(N.isClothPixel(0x24, 0x39, 0x6b), true); // 광기의 브론 남색 옷
  assert.equal(N.isClothPixel(0xf5, 0xa8, 0x78), false); // 살갗
  assert.equal(N.isClothPixel(0x6e, 0x3a, 0x2c), false); // 머리 · 가죽끈
});

test('무명 검객 숙련도 · 이름: 대회마다 새로 — 메인 0 ~ 2 · 보조 0 ~ 2(겹치면 높은 쪽) · 나머지 0 · 이름은 메인 유파 문화 (사장님 10/29 18:2x)', async () => {
  const { NAMELESS_NAMES } = await import('../../src/saengsa_names.js');
  const roster = await import('../../src/saengsa_roster.js');
  assert.deepEqual([SAENGSA.nameless.main, SAENGSA.nameless.sub, SAENGSA.nameless.other], [[0, 2], [0, 2], [0, 0]]);
  for (const [culture, names] of Object.entries(NAMELESS_NAMES)) {
    assert.ok(R.SCHOOLS5.includes(culture), culture);
    assert.ok(names.length >= 10 && names.length <= 15, culture);
    assert.equal(new Set(names).size, names.length, culture);
  }
  assert.equal(new Set(Object.values(NAMELESS_NAMES).flat()).size, Object.values(NAMELESS_NAMES).flat().length); // 문화끼리도 안 겹침
  let overlap = 0, allZero = 0, highMain = 0, total = 0;
  const seen = new Set();
  for (let seed = 1; seed <= 60; seed++) {
    const t = make(seed, { companions: [R.NAMELESS, 'a'] });
    const nameless = t.teams.flatMap((team) => team.members).filter((f) => f.id === R.NAMELESS);
    assert.equal(nameless.length, 45 - 10 + 1); // 상대 자리 45 − 이름난 열 + 내가 고용한 하나
    const perCulture = {};
    for (const f of nameless) {
      total++;
      assert.ok(R.SCHOOLS5.includes(f.main) && R.SCHOOLS5.includes(f.sub));
      for (const s of R.SCHOOLS5) {
        const v = f.prof[s];
        assert.ok(Number.isInteger(v), `${seed} ${s}`);
        if (s !== f.main && s !== f.sub) assert.equal(v, 0, `${seed} ${f.key} ${s} 나머지`);
        else assert.ok(v >= 0 && v <= 2, `${seed} ${f.key} ${s}`);
      }
      if (f.main === f.sub) overlap++;
      if (R.SCHOOLS5.every((s) => f.prof[s] === 0)) allZero++;
      if (f.prof[f.main] === 2) highMain++;
      assert.ok(NAMELESS_NAMES[f.main].includes(f.tag), `${f.tag} ∈ ${f.main}`);
      assert.equal(roster.fighterName(f), `무명 검객 ${f.tag}`);
      (perCulture[f.main] ??= []).push(f.tag);
      seen.add(f.tag);
    }
    for (const [c, tags] of Object.entries(perCulture)) assert.equal(new Set(tags).size, Math.min(tags.length, NAMELESS_NAMES[c].length), `${seed} ${c} 한 대회 안 이름`);
    assert.ok(t.teams[0].members[1].tag, '내가 고용한 무명 검객도 새로');
  }
  assert.ok(overlap > 0 && overlap < total / 3, `메인 · 보조 겹침 ${overlap}/${total}`);
  assert.ok(allZero > 0, '모두 0 도 나올 수 있음');
  assert.ok(highMain > 0);
  assert.ok(seen.size > 40, `이름 ${seen.size} 가지`);
  // 겹치면 높은 쪽: 나머지 5 · 메인 독일 · 보조 독일 · 메인 값 0 · 보조 값 2 → 독일 2
  const seq = [0, 0, 0, 0, 0, 0, 0, 0, 0.99, 0];
  let i = 0;
  const one = R.makeNameless(() => seq[i++] ?? 0);
  assert.deepEqual([one.main, one.sub, one.prof], ['german', 'german', { german: 2, italian: 0, iberian: 0, japanese: 0, chinese: 0 }]);
  assert.equal(one.tag, NAMELESS_NAMES.german[0]);
  assert.deepEqual(make(9), make(9)); // 씨앗이 같으면 같은 무명 검객
});

test('내 숙련도: 0 칸 · 1 칸 = 1 · 2 칸 = 2 · 5 칸 = 3 · 비기 + 특수공격 = 4 · 전부 = 5 · 편지 칸은 셈 밖 (사장님 10/29 17:5x · 18:1x)', async () => {
  const roster = await import('../../src/saengsa_roster.js');
  const { nodesOf, isClosed } = await import('../../src/skill_tree_data.js');
  const L = (ids) => ({ german: new Set(ids) });
  const g = (ids) => roster.playerProficiency(L(ids)).german;
  assert.deepEqual(roster.playerProficiency({}), { german: 1, italian: 1, iberian: 1, japanese: 1, chinese: 1 });
  assert.equal(g(['G1']), 1);
  assert.equal(g(['G1', 'G11']), 1); // 편지는 칸으로 세지 않음
  assert.equal(g(['G1', 'G2']), 2);
  assert.equal(g(['G1', 'G2', 'G5', 'G8']), 2);
  assert.equal(g(['G1', 'G2', 'G5', 'G8', 'G3']), 3);
  assert.equal(g(['G10', 'G7']), 4); // 비기 + 특수공격(겹치기)
  assert.equal(g(['G1', 'G2', 'G5', 'G8', 'G3', 'G10']), 3); // 비기만
  for (const s of R.SCHOOLS5) {
    const skills = nodesOf(s).filter((n) => n.cat !== 'letter' && !isClosed(s, n)).map((n) => n.id);
    const all = roster.playerProficiency({ [s]: new Set(skills) })[s];
    assert.equal(all, 5, s);
    assert.equal(roster.playerProficiency({ [s]: new Set(skills.slice(1)) })[s] < 5, true, s);
    const special = SAENGSA.playerProf.special[s], secret = nodesOf(s).find((n) => n.cat === 'secret').id;
    assert.ok(nodesOf(s).find((n) => n.id === special)?.u, `${s} 특수공격 칸 ${special}`);
    assert.equal(roster.playerProficiency({ [s]: new Set([special, secret]) })[s], 4, s);
  }
});

test('시험판(testMode): 신청 늘 열림 · 모든 경기 바로 · 쉬는 시간 · 기권 없음 · 끝나면 바로 다음 대회', () => {
  const cfg = { ...SAENGSA, testMode: true };
  const now = at(30, 15, 7); // 신청 창 밖 · 대진 시각과 무관한 때
  assert.deepEqual(C.signupWindow(now, cfg), { open: true, day: '2026-10-30', from: now, to: null });
  const t = R.createTournament({ day: '2026-10-30', seed: 21, at: now, companions: ['a', 'b'], ...DATA, cfg });
  assert.deepEqual(R.scheduleState(now, t, cfg), { kind: 'running' });
  assert.equal(R.advance(t, now, cfg), 7); // 16강 상대끼리 일곱은 바로
  for (let r = 0; r < 4; r++) {
    const m = R.myMatch(t);
    assert.equal(m.round, r);
    assert.equal(R.matchState(t, m, now, cfg), 'ready', `대진 ${r}`);
    assert.equal(R.advance(t, Infinity, cfg), 0, '내 경기는 기권 없음');
    assert.ok(R.finishMine(t, m, ['0-0'], now, winFor(t, m), cfg));
    const left = t.matches.filter((x) => x.round === r + 1 && !R.isMine(t, x)).length;
    assert.equal(R.advance(t, now, cfg), left, `대진 ${r + 1} 상대끼리`);
    assert.ok(t.matches.filter((x) => x.result).every((x) => x.result.at === now));
  }
  assert.deepEqual([t.status, R.placeOf(t), R.chestCount(t, cfg)], ['done', 'champion', 3]);
  assert.equal(R.canSignUp(now, t, cfg), true); // 같은 날 바로 다음 대회
  // 앞 대진이 다 끝나기 전엔 상대끼리 다음 경기도 기다림 · 내가 지면 대회는 바로 끝까지
  const u = R.createTournament({ day: '2026-10-30', seed: 22, at: now, companions: ['a', 'b'], ...DATA, cfg });
  R.advance(u, now, cfg);
  assert.equal(u.matches.filter((x) => x.round === 1 && x.result).length, 0);
  const m = R.myMatch(u), w = winFor(u, m);
  R.finishMine(u, m, ['0-0'], now, { ...w, winner: w.winner === 'a' ? 'b' : 'a' }, cfg);
  R.advance(u, now, cfg);
  assert.deepEqual([u.status, R.myTeamOut(u), R.canSignUp(now, u, cfg)], ['done', true, true]);
  // 본판은 그대로: 같은 때 신청 창은 닫힘
  assert.equal(C.signupWindow(now).open, false);
});

test('상대 팀 무기 다섯 · 전용무기 · AI 나눠 주기 (사장님 10/29 19:5x)', async () => {
  const roster = await import('../../src/saengsa_roster.js');
  const { getWeapon } = await import('../../src/weapons.js');
  // 전용무기 = 시트 무기 등급 에픽 이상 — 로스터에서는 랴오 청강검 · 미나미 모노호시자오 (마야 · 김씨의 ??? 무기는 아님 — 확인 전)
  assert.deepEqual(Object.fromEntries(roster.SAENGSA_ROSTER.map((id) => [id, roster.signatureOf(id)]).filter(([, w]) => w)),
    { liao: 'qinggang', minami: 'kusanagi', artoria: 'excalibur', silver_wanderer_mad: 'monohoshizao', roland: 'durandal', bernardo: 'tizona', julia: 'dartagnan' }); // 사장님 10/29 22:3x 표 (랴오 청강검은 남김) · 쥘리아 달타냥 (10/30 초안 · 사장님 확인 전)
  assert.deepEqual([roster.signatureOf('samira'), roster.signatureOf('renji'), roster.signatureOf(R.NAMELESS), roster.signatureOf('roland')], [null, null, null, 'durandal']);
  assert.equal(roster.AI_TIER_DRAW.mystery, 0);
  let sigs = 0, sigHeld = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const t = R.createTournament({ day: '2026-10-30', seed, at: 0, companions: [R.NAMELESS, R.NAMELESS], weapons: ['tree_branch', 'druid_whip', 'longsword'], ...roster.SAENGSA_DATA });
    assert.equal(t.teams[0].pool, undefined);
    for (const team of t.teams.slice(1)) {
      const ids = team.pool.map((w) => w.weapon);
      assert.equal(ids.length, SAENGSA.aiPool.size);
      assert.equal(new Set(ids).size, ids.length, '서로 다른 다섯');
      assert.ok(team.pool.every((w) => w.tier !== 'mystery' && getWeapon(w.weapon).tier === w.tier), '??? 없음');
      for (const f of team.members) {
        assert.ok(ids.includes(f.weapon), '받은 무기 다섯 가운데서');
        if (f.sig) { sigs++; sigHeld += f.weapon === f.sig; assert.ok(ids.includes(f.sig), '전용무기는 다섯 안에'); }
      }
      assert.equal(new Set(team.members.map((f) => f.weapon)).size, team.members.length, '한 무기는 한 사람');
      // 다 세어 본 가장 큰 합과 같은가 · 숙련도 0 인 사람 수는 줄일 수 없는가
      const zeros = (ws) => team.members.filter((f, i) => R.profFor({ prof: f.prof, school: ws[i].school }) <= 0).length;
      const sum = (ws) => team.members.reduce((a, f, i) => a + R.armScore(f, ws[i]), 0);
      const now = team.members.map((f) => team.pool.find((w) => w.weapon === f.weapon));
      let bestSum = -Infinity, fewest = Infinity;
      for (const a of team.pool) for (const b of team.pool) for (const c of team.pool) {
        if (a === b || b === c || a === c) continue;
        bestSum = Math.max(bestSum, sum([a, b, c])); fewest = Math.min(fewest, zeros([a, b, c]));
      }
      assert.ok(Math.abs(sum(now) - bestSum) < 1e-9, `씨앗 ${seed} 가장 좋은 배분`);
      assert.equal(zeros(now), fewest, `씨앗 ${seed} 0 을 피함`);
    }
  }
  assert.ok(sigs > 0 && sigHeld / sigs > 0.85, `전용무기를 주인이 듦 ${sigHeld}/${sigs}`);
  // 다친 · 죽은 사람이 생기면 다시 나눈다 (산 사람만 · 죽은 사람의 무기도 쓸 수 있음)
  const pool = [{ weapon: 'a1', school: 'german', tier: 'legend' }, { weapon: 'a2', school: 'italian', tier: 'common' }, { weapon: 'a3', school: 'japanese', tier: 'common' }];
  const p = (o) => ({ german: 0, italian: 0, iberian: 0, japanese: 0, chinese: 0, ...o });
  const team = { mine: false, pool, members: [
    { key: '1-0', id: 'x', prof: p({ german: 2, italian: 2 }), hp: 100, injuries: [], dead: false },
    { key: '1-1', id: 'y', prof: p({ german: 2 }), hp: 100, injuries: [], dead: false },
    { key: '1-2', id: 'z', prof: p({ japanese: 1 }), hp: 100, injuries: [], dead: false }] };
  R.aiArm(team);
  assert.deepEqual(team.members.map((f) => f.weapon), ['a2', 'a1', 'a3']); // x 는 이탈리아로 비켜 y 가 0 이 되지 않게
  team.members[1].dead = true;
  R.aiArm(team);
  assert.deepEqual(team.members.map((f) => f.weapon), ['a1', 'a1', 'a3']); // y 가 죽자 x 가 레전드를 (죽은 y 는 마지막 무기 그대로)
  team.members[1].dead = false;
  team.members[0].hp = 10;
  team.members[0].prof = p({ german: 2 });
  team.members[2].prof = p({ italian: 1, japanese: 1 });
  R.aiArm(team);
  assert.equal(team.members[1].weapon, 'a1'); // 똑같이 독일 2 라도 다친 x 보다 성한 y 가 레전드
  // 이긴 상대 팀은 결과 뒤 다시 나눔 (applyResult)
  const t = R.createTournament({ day: '2026-10-30', seed: 3, at: 0, companions: [R.NAMELESS, R.NAMELESS], weapons: ['tree_branch', 'druid_whip', 'longsword'], ...roster.SAENGSA_DATA });
  const m = t.matches.find((x) => x.round === 0 && x.a !== 0 && x.b !== 0), A = t.teams[m.a];
  const key = A.members[0].key, before = structuredClone(A.members);
  R.applyResult(t, m, { winner: 'a', fighters: { [key]: { hp: 0, injuries: [], alive: false } }, entrants: { a: [key], b: [] } }, 0);
  const alive = A.members.filter((f) => !f.dead);
  assert.ok(alive.length === 2 && new Set(alive.map((f) => f.weapon)).size === 2);
  assert.deepEqual(m.result.pre.a.map((f) => f.weapon), before.map((f) => f.weapon)); // 결과의 pre 는 그 경기 무기
});

test('부러진 무기는 대회 끝까지 · 빠른 셈 부러짐 · 레전드는 안 부러짐 (사장님 10/29 20:1x)', async () => {
  const roster = await import('../../src/saengsa_roster.js');
  const f = (key, weapon, extra = {}) => ({ key, id: key, weapon, ...roster.weaponInfo(weapon), prof: { ...PROF }, hp: 100, injuries: [], dead: false, ...extra });
  // 경기 한 번 부러질 확률 = 1 − (1 − 파손률)^breakClashes — 레전드 · 플라스마 · 참치 0
  const rate = (w) => 1 - (1 - roster.weaponInfo(w).frag) ** SAENGSA.quick.breakClashes;
  assert.deepEqual(['excalibur', 'durandal', 'lightsaber', 'frozen_tuna'].map(rate), [0, 0, 0, 0]);
  assert.ok(rate('tree_branch') > 0.7 && rate('longsword') > 0.12 && rate('longsword') < 0.2 && rate('goujian') < 0.05);
  let legend = 0, branch = 0;
  for (let s = 0; s < 300; s++) {
    const sides = { a: [f('0-0', 'excalibur')], b: [f('1-0', 'tree_branch')] };
    const r = R.quickResolve(sides, s);
    legend += !!r.fighters['0-0'].broken; branch += !!r.fighters['1-0'].broken;
    const plain = R.quickResolve({ a: [{ ...sides.a[0], frag: 0 }], b: [{ ...sides.b[0], frag: 0 }] }, s); // 부러짐을 빼도 승패 · 체력 · 부상은 같다
    assert.deepEqual([r.winner, r.fighters['0-0'].hp, r.fighters['1-0'].hp, r.fighters['1-0'].injuries], [plain.winner, plain.fighters['0-0'].hp, plain.fighters['1-0'].hp, plain.fighters['1-0'].injuries]);
  }
  assert.equal(legend, 0);
  assert.ok(branch > 200, `나뭇가지 ${branch}/300`);
  assert.equal(R.quickResolve({ a: [f('0-0', 'excalibur', { broken: true })], b: [f('1-0', 'excalibur')] }, 1).fighters['0-0'].broken, true); // 이미 부러진 것은 그대로
  assert.ok(R.power(f('x', 'longsword', { broken: true })) < R.power(f('x', 'longsword')));
  // 결과에 부러짐이 오면: 내 팀 = t.broken (다시 배정해도 부러진 채) · 상대 팀 = 무기 다섯의 그 줄 (다시 나눠도 부러진 채 · 점수 감점)
  const t = R.createTournament({ day: '2026-10-30', seed: 8, at: 0, companions: [R.NAMELESS, R.NAMELESS], weapons: ['longsword', 'rapier', 'uchigatana'], ...roster.SAENGSA_DATA });
  assert.deepEqual(t.broken, []);
  R.advance(t, at(30, 10));
  const m = R.myMatch(t), mineSide = R.sidesOf(t, m)[0] === 0 ? 'a' : 'b', foe = t.teams[R.sidesOf(t, m)[mineSide === 'a' ? 1 : 0]];
  const foeKey = foe.members[0].key, foeWeapon = foe.members[0].weapon;
  R.applyResult(t, m, { winner: mineSide, fighters: { '0-0': { hp: 80, injuries: [{ part: 'arm', sev: 2.23, rests: 0 }], alive: true, broken: true }, [foeKey]: { hp: 0, injuries: [], alive: false, broken: true } }, entrants: { [mineSide]: ['0-0'], [mineSide === 'a' ? 'b' : 'a']: [foeKey] } }, at(30, 10));
  assert.deepEqual(t.broken, ['longsword']);
  assert.equal(t.teams[0].members[0].broken, true);
  assert.equal(t.teams[0].members[0].injuries[0].sev, 1); // 실제 싸움 심각도 1 넘음 → 1
  assert.equal(foe.pool.find((w) => w.weapon === foeWeapon).broken, true);
  const owned = ['longsword', 'rapier', 'uchigatana', 'hwando'];
  assert.ok(R.assignWeapons(t, ['hwando', 'rapier', 'longsword'], { owned, weaponInfo: roster.weaponInfo }));
  assert.deepEqual(t.teams[0].members.map((x) => !!x.broken), [false, false, true]); // 부러진 롱소드는 누구에게 줘도 부러진 채
  const setup = R.matchSetup(t, R.myMatch(t) ?? m, ['0-2'], at(30, 13));
  if (setup) assert.equal(setup.sides[setup.mineSide][0].broken, true); // 2단계 엔진에 broken: true 로 넘김
  const team = { mine: false, members: [{ key: 'k', id: 'x', prof: { ...PROF }, hp: 100, injuries: [], dead: false }], pool: [{ weapon: 'g1', school: 'german', tier: 'legend', broken: true }, { weapon: 'g2', school: 'german', tier: 'common' }] };
  R.aiArm(team);
  assert.equal(team.members[0].weapon, 'g2'); // 같은 유파면 부러진 레전드보다 성한 커먼
  team.pool[1].school = 'japanese';
  R.aiArm(team);
  assert.deepEqual([team.members[0].weapon, team.members[0].broken], ['g1', true]); // 0 을 피할 길이 부러진 칼뿐이면 그것 (그래도 줄 수 있음)
  // 대회가 끝나면: keepBrokenAfterCup false(기본) = 다음 대회 성함 · true = 넘김
  assert.equal(SAENGSA.keepBrokenAfterCup, false);
  mem.clear();
  P.setCoins(1000);
  const OWNED = ['tree_branch', 'druid_whip', 'w1', 'w2', 'w3'];
  const data = { ...DATA, owned: OWNED, hasTitle: true, hireCostOf: () => ({ coins: 20 }) };
  const cfgT = { ...SAENGSA, testMode: true };
  assert.ok(S.signUp({ now: at(30, 15), companions: ['a', 'b'], weapons: ['w1', 'w2', 'w3'], seed: 4, data, cfg: cfgT }).ok);
  S.updateSaengsa((d) => { d.current.broken = ['w1']; d.current.status = 'done'; return true; });
  assert.ok(S.signUp({ now: at(30, 15), companions: ['a', 'b'], weapons: ['w1', 'w2', 'w3'], seed: 5, data, cfg: cfgT }).ok);
  assert.deepEqual([S.readSaengsa().current.broken, !!S.readSaengsa().current.teams[0].members[0].broken], [[], false]);
  S.updateSaengsa((d) => { d.current.broken = ['w1']; d.current.status = 'done'; return true; });
  assert.ok(S.signUp({ now: at(30, 15), companions: ['a', 'b'], weapons: ['w1', 'w2', 'w3'], seed: 6, data, cfg: { ...cfgT, keepBrokenAfterCup: true } }).ok);
  assert.deepEqual([S.readSaengsa().current.broken, S.readSaengsa().current.teams[0].members[0].broken], [['w1'], true]);
});

test('엔진 잇기: 내 경기 = game.launchSaengsa (스위치 SAENGSA.engine.mine) · 없으면 빠른 셈 · 판 사람에 broken', async () => {
  const { makeEngine } = await import('../../src/saengsa_engine.js');
  let got = null;
  const game = { launchSaengsa: async (setup) => { got = setup; return null; } };
  assert.equal(makeEngine(game).real, true);
  assert.equal(makeEngine(game, { ...SAENGSA, engine: { mine: false, ai: false } }).real, false);
  assert.equal(makeEngine({}).real, false);
  assert.equal(await makeEngine({}).play({}), null);
  const t = make(7);
  R.advance(t, at(30, 10));
  t.broken = [t.teams[0].members[1].weapon];
  t.teams[0].members[1].broken = true;
  const m = R.myMatch(t);
  const setup = R.matchSetup(t, m, ['0-1'], at(30, 10));
  assert.equal(setup.control, 'watch');
  assert.equal(await makeEngine(game).play(setup), null); // 그만두기 = null (적지 않음)
  assert.equal(got.sides[setup.mineSide][0].broken, true);
  assert.equal(R.matchSetup(t, m, ['0-0', '0-1'], at(30, 10)).control, 'player');
});

test('전용무기 표 — 한 무기는 한 사람 · 한 대회에 같은 전용무기 둘 없음 · 주인이 나오면 무작위로 안 뽑힘 (사장님 10/29 22:3x)', async () => {
  const roster = await import('../../src/saengsa_roster.js');
  const { getWeapon } = await import('../../src/weapons.js');
  const { CHARACTERS_BY_ID } = await import('../../src/characters.js');
  const sig = SAENGSA.signature, ws = Object.values(sig);
  assert.equal(new Set(ws).size, ws.length, '한 무기는 한 사람');
  for (const [id, w] of Object.entries(sig)) { assert.ok(CHARACTERS_BY_ID[id], id); assert.ok(roster.SAENGSA_WEAPONS.includes(w), w); }
  assert.deepEqual(Object.fromEntries(Object.entries(sig).map(([id, w]) => [w, getWeapon(w).tier])), { kusanagi: 'legend', monohoshizao: 'epic', durandal: 'legend', tizona: 'epic', excalibur: 'legend', qinggang: 'epic', dartagnan: 'epic' });
  assert.equal(CHARACTERS_BY_ID.minami.weapon, 'kusanagi'); // 인물 시트 무기도 쿠사나기 (사장님 10/29 22:4x '미나미 스테이지 무기도 쿠사나기로 바꿔' — 본판 8980a3f4) · 광기의 미나미 무라마사(레어 — 전용무기 아님)
  assert.equal(CHARACTERS_BY_ID.minami_mad.weapon, 'muramasa');
  for (const id of ['minami_mad', 'silver_wanderer', 'liao_mad', 'artoria_mad', 'julia_mad']) assert.equal(roster.signatureOf(id), null, id);
  for (let seed = 1; seed <= 60; seed++) {
    const t = R.createTournament({ day: '2026-10-30', seed, at: 0, companions: ['minami', R.NAMELESS], weapons: ['tree_branch', 'druid_whip', 'longsword'], ...roster.SAENGSA_DATA });
    const pools = t.teams.slice(1).flatMap((x) => x.pool.map((w) => w.weapon));
    const sigs = pools.filter((w) => ws.includes(w));
    assert.equal(new Set(sigs).size, sigs.length, `씨앗 ${seed} 같은 전용무기 둘`);
    assert.ok(!pools.includes('kusanagi'), `씨앗 ${seed} 미나미(내 동료)의 쿠사나기가 상대에`);
    for (const x of t.teams.slice(1)) for (const f of x.members) if (sig[f.id]) assert.ok(x.pool.some((w) => w.weapon === sig[f.id]), `${f.id} 전용무기`);
    const present = new Set(t.teams.flatMap((x) => x.members.map((f) => f.id)));
    for (const [id, w] of Object.entries(sig)) if (present.has(id)) assert.ok(pools.filter((x) => x === w).length <= (id === 'minami' ? 0 : 1), `씨앗 ${seed} ${w}`);
  }
  // 내 팀이 전용무기를 들고 나오면: 주인은 이번 대회 전용무기 없음 · 상대 무기 다섯에 그 무기 없음
  const OWNED = ['tree_branch', 'druid_whip', 'excalibur'];
  let seen = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const t = R.createTournament({ day: '2026-10-30', seed, at: 0, companions: [R.NAMELESS, R.NAMELESS], weapons: OWNED, ...roster.SAENGSA_DATA });
    const art = t.teams.slice(1).flatMap((x) => x.members).find((f) => f.id === 'artoria');
    if (art) { seen++; assert.equal(art.sig, undefined); }
    assert.ok(!t.teams.slice(1).some((x) => x.pool.some((w) => w.weapon === 'excalibur')), `씨앗 ${seed}`);
  }
  assert.ok(seen > 0);
  // 대회 도중: 상대 팀 무기 다섯에 든 전용무기는 내 팀에 배정할 수 없음
  const t = R.createTournament({ day: '2026-10-30', seed: 2, at: 0, companions: [R.NAMELESS, R.NAMELESS], weapons: ['tree_branch', 'druid_whip', 'longsword'], ...roster.SAENGSA_DATA });
  const locked = [...R.lockedSignatures(t)];
  assert.ok(locked.length > 0);
  assert.equal(R.assignWeapons(t, [locked[0], 'druid_whip', 'longsword'], { owned: ['tree_branch', 'druid_whip', 'longsword', locked[0]], weaponInfo: roster.weaponInfo }), false);
  assert.equal(R.assignWeapons(t, ['tree_branch', 'druid_whip', 'longsword'], { owned: ['tree_branch', 'druid_whip', 'longsword'], weaponInfo: roster.weaponInfo }), true);
  // 고용 값: 숙련도 6 → 20 + 20 × 6 = 140 (손님 둘 · 아르토리아 6 — 사장님 10/29 22:4x) · 광기의 미나미 6(얼터 +1 · 상한 6 — 사장님 '광기는 상한에 걸려서 6임')
  assert.deepEqual([roster.hireCostOf('roland').coins, roster.hireCostOf('bernardo').coins, roster.hireCostOf('artoria').coins, roster.profOf('minami_mad').japanese, roster.profOf('artoria').german], [140, 140, 140, 6, 6]);
});

test('몸 상태 이어받기 (사장님 10/30 08:2x "몸 상태 이어받기 방랑 · 생사전 둘 다 켜."): 내 경기에만 적힘 · 같은 사람 · 같은 무기 · 결과가 적히면 지움 · 끄면 없음', () => {
  assert.equal(SAENGSA.resumeState, true);
  mem.clear();
  const t = make(5);
  S.updateSaengsa((d) => { d.current = t; return true; });
  S.syncSaengsa(at(30, 10));
  const m0 = R.myMatch(S.readSaengsa().current), other = S.readSaengsa().current.matches.find((m) => m.id !== m0.id && !m.result);
  const body = (blood) => ({ v: 1, blood, wounds: [{ part: 'thighB', type: 'cut', severity: 0.3, bleed: 0, local: [0, 0, 0], carried: true }, { part: 'chest', type: 'stab', severity: 0.5, bleed: 0.01, local: [0, 0, 0] }] });
  const bodies = { '0-0': body(0.8), '0-1': body(0.7), x: body(0.6), y: { ...body(0.2), dead: true } };
  assert.equal(S.saveResume(other.id, { picks: ['0-0'], arms: ['w1', 'w2', 'w3'], bodies }), false, '내 경기가 아니면 안 적음');
  assert.equal(S.saveResume(m0.id, { picks: ['0-0', '0-1'], arms: ['w1', 'w2', 'w3'], bodies, at: at(30, 10, 5) }), true);
  const t1 = S.readSaengsa().current, Rm = R.resumeOf(t1, m0.id);
  assert.deepEqual([Rm.matchId, Rm.picks, Rm.arms, Rm.bodies.y.dead, Rm.bodies['0-0'].wounds[0].carried], [m0.id, ['0-0', '0-1'], ['w1', 'w2', 'w3'], true, true]);
  assert.equal(R.resumeOf(t1, other.id), null, '다른 경기 열쇠로는 없음');
  assert.equal(R.resumeOf(t1, m0.id, { ...SAENGSA, resumeState: false }), null, '끄면 없음');
  assert.equal(R.resumeOf({ ...t1, resume: { ...t1.resume, picks: [] } }, m0.id), null, '모양이 틀리면 버림');
  // 경기 결과가 적히면 지움 (실제 싸움 결과 · 빠른 셈 모두 applyResult)
  const res = S.playMine(m0.id, ['0-0', '0-1'], at(30, 10, 6), null);
  assert.ok(res);
  assert.equal(S.readSaengsa().current.resume, undefined, '끝난 경기는 이어받을 몸이 없다');
  assert.equal(S.saveResume(m0.id, null), false, '지울 것이 없으면 저장 안 함');
});

test('몸 사본 (생사전 넷): 들고 온 상처(carried) · 죽은 몸은 죽은 채 · 흙 몸도', async () => {
  const { snapshotFighter, applyFighterSnapshot } = await import('../../src/fight_snapshot.js');
  const mk = (over = {}) => ({ weapon: { id: 'longsword', fragile: true }, blood: 1, bleed: 0, consciousness: 1, pain: 0, limbs: { armS: 1, armO: 1 }, wounds: [], weaponBroken: false, stamina: { value: 100, max: 100 }, secretUsed: 0, revive: null, armed: true, state: 'stand', canDie: true,
    get alive() { return this.state !== 'dead'; }, setState(s) { if (s === 'dead' && !this.canDie) return; this.state = s; }, breakWeapon(quiet) { this.weaponBroken = true; this.quiet = quiet; }, dropSword() { this.armed = false; }, ...over });
  const a = mk({ blood: 0.3, wounds: [{ part: 'thighB', type: 'cut', severity: 0.3, bleed: 0, local: { x: 0, y: 0, z: 0 }, carried: true }, { part: 'neck', type: 'cut', severity: 1.4, bleed: 0.2, local: { x: 0, y: 0, z: 0 } }], state: 'dead', causeOfDeath: '출혈', weaponBroken: true });
  const s = JSON.parse(JSON.stringify(snapshotFighter(a)));
  assert.deepEqual([s.dead, s.cause, s.wounds[0].carried, s.wounds[1].carried], [true, '출혈', true, undefined]);
  const b = mk();
  applyFighterSnapshot(b, s);
  assert.deepEqual([b.alive, b.causeOfDeath, b.wounds.map((w) => !!w.carried), b.weaponBroken, b.quiet], [false, '출혈', [true, false], true, true], '죽은 채 · 들고 온 상처 표시 · 조용히 부러짐');
  const clay = mk({ canDie: false });
  applyFighterSnapshot(clay, s);
  assert.equal(clay.alive, false, '흙 몸(머리가 떨어져 죽었던 몸)도 죽은 채');
  const live = mk();
  applyFighterSnapshot(live, { ...s, dead: undefined });
  assert.equal(live.alive, true, '산 몸은 산 채');
});

test('쥘리아 생사전 몫 (사장님 10/30 22:1x \'상점주인이자 방랑과 생사전에 나오게 해\' — 숙련도 · 성향 · 고용 · 전용무기 초안 · 사장님 확인 전)', async () => {
  const roster = await import('../../src/saengsa_roster.js');
  const T = await import('../../src/character_temperament.js');
  assert.ok(roster.SAENGSA_ROSTER.includes('julia') && roster.SAENGSA_ROSTER.includes('julia_mad'));
  assert.deepEqual(roster.profOf('julia'), { german: 1, italian: 4, iberian: 3, japanese: 1, chinese: 2 }); // 이베리아 3 · 동방 2 = 사장님 10/30 22:4x 결정
  assert.deepEqual(roster.profOf('julia_mad'), { german: 1, italian: 5, iberian: 3, japanese: 1, chinese: 2 }, '얼터 +1 (이탈리아 — 시트 무기 유파)');
  assert.deepEqual([roster.hireCostOf('julia').coins, roster.hireCostOf('julia_mad').coins], [100, 120], '20 + 20 × 가장 높은 숙련도');
  assert.deepEqual([roster.signatureOf('julia'), roster.signatureOf('julia_mad')], ['dartagnan', null], '전용무기는 한 꼴에만');
  assert.equal(Object.values(SAENGSA.signature).filter((w) => w === 'dartagnan').length, 1, '달타냥은 다른 사람 전용무기가 아님');
  const a = T.temperamentOf('julia'), b = T.temperamentOf('julia_mad');
  assert.deepEqual([a.distance, a.feint, a.counter, a.wounded, a.team.target], [0.45, 0.84, 0.481, 'withdraw', 'weakest'], '최신 본판 쥘리아 시트의 간격 · 속임 · 받아치기와 일치 — 실제 AI는 유지');
  assert.ok(b !== a && b.press > a.press && b.patience < a.patience && b.composure === 1 && b.finisher === 1, '얼터: 더 차갑고 끈질김');
  assert.equal(T.temperamentOf('minami_mad'), T.temperamentOf('minami'), '다른 얼터는 원본 칸 그대로');
});
