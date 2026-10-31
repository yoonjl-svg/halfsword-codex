// 롤랑 · 베르나르도 가르기 (사장님 10/29 15:5x '롤랑과 베르나르도의 성향과 캐릭터를 분화해서 싸움 스타일도 바꾸도록 해' — docs/characters/temperament_2026-10-29.md §7-3)
//  아르토리아 숫자 그대로 · 셋이 서로 다른 기질 · 싱지르 걸쇠의 발(pers.spinHold) · 셋 다 칭호 '왕'
//  10/29 21:0x 사장님 '베르나르도는 성향을 손봐서 롤랑의 상극이 되게 해' (§7-5): 베르나르도가 롤랑보다 더 멀리 · 더 오래 기다림 · 둘 다 걸쇠에서 기다림(spinHold true)
//  node --test tools/sim/kings_split.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
import { newRound, AI } from './harness_m.mjs';

const C = CHARACTERS_BY_ID;

test('아르토리아 숫자는 그대로 (사장님 — 롤랑 · 베르나르도만 바꿈)', () => {
  const P = C.artoria.ai.persona;
  assert.deepEqual(P.level, { reaction: 0.26, guardChance: 0.7, counter: 0.35, feint: 0.2, followUp: 0.42, read: 0.75, discipline: 0.88, strength: 1, aggression: 0.8, windup: 0.7, skill: 0.82 });
  assert.deepEqual(P.pers, { precision: 0.85, guardStick: 2.5, fearful: 0.2, angry: 0.2, dogged: 0.45, guardSpeed: 0.85, rhythm: 2.6, margin: 0.22, aggr: 0.85, vor: 0.45, patienceTime: 4.5, circleRate: 0.22,
    guardPref: { tagR: 1.6, pflugR: 1.5, ochsR: 1.1, langort: 1.2 }, techPref: { zornhau: 1.5, oberhau: 1.25, zornhauL: 1.2, stichPflug: 1.1 } });
});

test('셋은 서로 다른 기질 · 숙련도 · 칭호는 그대로', () => {
  const [a, r, b] = ['artoria', 'roland', 'bernardo'].map((id) => C[id].ai.persona);
  for (const [x, y, w] of [[a, r, '아르토리아 · 롤랑'], [a, b, '아르토리아 · 베르나르도'], [r, b, '롤랑 · 베르나르도']]) {
    assert.notDeepEqual(x.level, y.level, `${w} level`);
    assert.notDeepEqual(x.pers, y.pers, `${w} pers`);
  }
  assert.ok(b.pers.margin > r.pers.margin && r.pers.margin > a.pers.margin, '간격: 베르나르도 > 롤랑 > 아르토리아 (21:0x — 전 롤랑 > 아르토리아 > 베르나르도)');
  const wait = (p) => p.pers.patienceTime / (p.pers.aggr * p.level.aggression); // 참을성이 바닥나는 실제 시간 (ai.js update — patienceTime ÷ aggression · aggr)
  assert.ok(wait(b) > wait(r), '베르나르도가 롤랑보다 오래 기다린다 (21:0x — 전: 먼저 들어감)');
  assert.ok(b.level.discipline >= r.level.discipline, '롤랑이 들어오는 만큼 물러난다 (규율 — holdDist · moveFeet)');
  assert.equal(C.roland.ai.proficiency, 6);
  assert.equal(C.bernardo.ai.proficiency, 6);
  for (const id of ['artoria', 'roland', 'bernardo']) assert.equal(C[id].epithet, '왕');
});

test('설정 맞춤: 있던 문장은 한 글자도 그대로 · 롤랑이 론세스바예스에서 쓰러져 바다 너머 왕이 됨 · 베르나르도가 왕인 까닭 (사장님 10/29 15:5x)', () => {
  const kept = {
    roland: ['왕이 군대를 이끌고 바다를 건넌 뒤, 누구도 돌아오지 않았다.', '오랜 세월이 지나 안개가 성문을 덮은 밤, 왕의 문장을 새긴 기사가 홀로 돌아왔다.', '상아빛 갑옷과 포도주색 망토는 출정하던 날 그대로였으나, 얼굴을 가린 투구는 끝내 열리지 않았다.', '그를 뒤따르던 군대가 어디에 있는지, 귀환한 것이 정말 왕인지 아는 이는 없다.'],
    bernardo: ['스페인 전승이 노래하는 레온의 영웅.', '알폰소 왕의 누이 히메나와 살다냐 백작 사이에서 난 왕의 조카다.', '그 왕이 나라를 샤를마뉴에게 넘기려 하자, 외국 왕의 지배를 받을 수 없다며 칼을 들었다.', '론세스바예스 골짜기에서 프랑크 군을 막아서고 롤랑을 쓰러뜨렸다고 전해진다.', '먹빛 갑옷 위에 금관을 쓴 레온의 사자를 검게 그린 흰 겉옷을 입고 긴 금빛 망토를 한쪽 어깨에 비스듬히 걸쳤다.'],
  };
  for (const [id, lines] of Object.entries(kept)) for (const l of lines) assert.ok(C[id].backstory.includes(l), `${id}: ${l}`);
  assert.ok(C.roland.backstory.startsWith('론세스바예스 골짜기에서 그는 뿔나팔을 너무 늦게 불었다.'));
  assert.ok(C.roland.backstory.includes('그를 왕이라 불렀다') && C.roland.backstory.includes('일곱 도시의 섬'));
  assert.ok(C.bernardo.backstory.endsWith('레온 사람들은 왕관을 쓰지 않은 그를 왕이라 부른다. 그의 금관은 머리가 아니라 가슴의 사자가 쓰고 있다.'));
  assert.equal(C.roland.origin, '이베리아 서쪽 · 바다 너머에서 사라진 왕국'); // origin 그대로
});

test('싱지르 걸쇠의 발: 롤랑 · 베르나르도 둘 다 기다림(기본 — 21:0x 부터 · 전 베르나르도 걸어 들어감) · 다른 AI 는 기본 그대로', () => {
  const aiOf = (id) => newRound({ seed: 3, weapon: 'longsword', weapon2: C[id].weapon, difficulty: C[id].ai.level, persona: C[id].ai.persona, AI2Class: AI }).ai;
  assert.equal(aiOf('roland').pers.spinHold, true);
  assert.equal(aiOf('bernardo').pers.spinHold, true);
  assert.ok(aiOf('roland').spinArm && aiOf('bernardo').spinArm, '둘 다 싱지르를 쓴다 (이베리아 숙련도 6)');
  assert.equal(newRound({ seed: 3, weapon: 'longsword', difficulty: 'normal' }).ai.pers.spinHold, true);
});
