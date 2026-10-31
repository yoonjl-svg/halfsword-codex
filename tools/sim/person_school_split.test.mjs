// 사람 몫 · 유파 몫 가르기 (사장님 10/29 15:5x — docs/characters/temperament_2026-10-29.md §7-1)
//  ① '반응은 본 유파 숙련도를 따르도록 해': 다른 유파 무기를 든 인물도 반응 = 본 유파 숙련도 · 고유 동작 · 비기 · schoolK 는 손에 든 유파 그대로
//  node --test tools/sim/person_school_split.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
import { AI_PROFICIENCY } from '../../src/config.js';
import { newRound, AI } from './harness_m.mjs';

const C = CHARACTERS_BY_ID;
/** 인물을 상대 자리에 세운 AI — weapon 을 주면 main.js 처럼 꾸러미도 그 무기 것(검술을 배우지 못한 인물은 그대로) */
const aiOf = (id, weapon) => {
  const c = C[id];
  const w = weapon ?? c.weapon;
  const persona = w !== c.weapon && !c.noSwordsmanship ? { ...c.ai.persona, school: w } : c.ai.persona;
  return newRound({ seed: 3, weapon: 'longsword', weapon2: w, difficulty: c.ai.level, persona, AI2Class: AI }).ai;
};

test('다른 유파 무기: 유파 몫은 그 유파 숙련도(0) · 반응은 본 유파 숙련도', () => {
  for (const [id, w] of [['liao', 'longsword'], ['margarethe', 'rapier'], ['minami', 'longsword']]) {
    const ai = aiOf(id, w);
    assert.equal(ai.proficiency, 0, `${id} 유파 몫`);
    assert.equal(ai.mainProficiency, C[id].ai.proficiency, `${id} 사람 몫`);
    assert.equal(ai.level.reaction, AI_PROFICIENCY.reaction[C[id].ai.proficiency], `${id} 반응`);
    assert.equal(ai.secret, null, `${id} 비기 없음`);
  }
});

test('광기의 브론: 숙련도 표 = 실제로 싸우는 유파(무유파) · 원본 + 1 로 싸움 · 낮의 브론보다 느리지 않음 (사장님 10/29 15:5x)', () => {
  assert.deepEqual(C.bran_mad.ai.persona.proficiency, { none: 2 });
  const mad = aiOf('bran_mad'), day = aiOf('bran');
  assert.equal(mad.proficiency, C.bran.ai.proficiency + 1);
  assert.equal(mad.mainProficiency, C.bran.ai.proficiency + 1);
  assert.equal(mad.level.reaction, AI_PROFICIENCY.reaction[2]);
  assert.ok(mad.level.reaction < day.level.reaction, `${mad.level.reaction} < ${day.level.reaction}`);
  assert.equal(mad.art.tradition, 'none'); // 검술을 배우지 못함 — 팔쉬온을 들어도 무유파 그대로 (10/25 20:0x)
});

test('제 무기 · 인물 없는 AI 는 그대로 (두 몫이 같다)', () => {
  const m = aiOf('margarethe');
  assert.equal(m.proficiency, 3);
  assert.equal(m.mainProficiency, 3);
  assert.equal(m.level.reaction, AI_PROFICIENCY.reaction[3]);
  const G = newRound({ seed: 3, weapon: 'longsword', difficulty: 'normal' });
  assert.equal(G.ai.proficiency, AI_PROFICIENCY.ofLevel.normal);
  assert.equal(G.ai.mainProficiency, G.ai.proficiency);
  assert.equal(G.ai.level.reaction, AI_PROFICIENCY.reaction[AI_PROFICIENCY.ofLevel.normal]);
});
