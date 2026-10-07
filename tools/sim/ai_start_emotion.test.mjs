// Actual AI construction with synthetic fighter records; no physics or combat claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { AI } from '../../src/ai.js';
import { getWeapon } from '../../src/weapons.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';

function construct(persona = null, weapon = 'longsword') {
  const original = Math.random;
  let randomCalls = 0;
  Math.random = () => { randomCalls++; return 0.5; };
  try {
    const fighter = id => ({ weapon: getWeapon(id), skill: {}, pain: 0 });
    const ai = new AI(fighter(weapon), fighter('longsword'), 'normal', persona);
    return { ai, randomCalls };
  } finally { Math.random = original; }
}

test('Bran begins angry and impatient without shifting the random stream', () => {
  const c = CHARACTERS_BY_ID.bran;
  const normal = construct({ ...c.ai.persona, startEmotion: undefined }, c.weapon);
  const angry = construct(c.ai.persona, c.weapon);
  assert.equal(angry.ai.emotion, 'anger');
  assert.equal(angry.ai.anger, 0.7);
  assert.equal(angry.ai.patience, 0.2);
  assert.equal(angry.randomCalls, normal.randomCalls);
  assert.equal(angry.ai.guardTimer, normal.ai.guardTimer);
  assert.equal(angry.ai.circleTimer, normal.ai.circleTimer);
});

for (const [label, emotion, expected] of [
  ['no starting emotion', undefined, null],
  ['subthreshold anger', { anger: 0.3 }, null],
  ['fear takes precedence', { fear: 0.7, anger: 0.7 }, 'fear'],
  ['obsession only', { obsession: 0.7 }, 'obsession'],
]) test(`${label} retains normal starting patience`, () => {
  const normal = construct();
  const value = construct({ startEmotion: emotion });
  assert.equal(value.ai.emotion, expected);
  assert.equal(value.ai.patience, normal.ai.patience);
  assert.equal(value.randomCalls, normal.randomCalls);
  assert.ok(Number.isFinite(value.ai.patience));
});
