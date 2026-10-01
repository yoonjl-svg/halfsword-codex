// 두 캐릭터 맞대결에서 한쪽의 성격 손잡이 하나를 바꿔 가며 대칭 승률을 잰다 (튜닝용)
// 사용: node tools/sim/pair_sweep.mjs <idA> <idB> <pers키> <값1,값2,...> [seeds] [durS]
//  예: node tools/sim/pair_sweep.mjs isolde liao fearful 0.3,0.35,0.4 16
import { newRound, DT } from './harness_m.mjs';
import { AI } from '../../src/ai.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';

const [idA, idB, key, valsArg, seedsArg = '16', durArg = '45'] = process.argv.slice(2);
const A_ = CHARACTERS_BY_ID[idA], B_ = CHARACTERS_BY_ID[idB];
const SEEDS = +seedsArg, DUR = +durArg;
const vals = valsArg.split(',').map(Number);

function duel(seed, personaA, aOnEnemy) {
  const pA = personaA, pB = B_.ai.persona;
  const opts = aOnEnemy
    ? { seed, difficulty: A_.ai.level, persona: pA, weapon2: A_.weapon, AI2Class: AI, difficulty2: B_.ai.level, persona2: pB, weapon: B_.weapon, revive: A_.revive, revive2: B_.revive }
    : { seed, difficulty: B_.ai.level, persona: pB, weapon2: B_.weapon, AI2Class: AI, difficulty2: A_.ai.level, persona2: pA, weapon: A_.weapon, revive: B_.revive, revive2: A_.revive };
  const G = newRound(opts);
  const X = aOnEnemy ? G.enemy : G.player; // A 쪽
  const Y = aOnEnemy ? G.player : G.enemy;
  for (let i = 0, n = Math.round(DUR / DT); i < n; i++) { G.step(); if (!X.alive || !Y.alive) break; }
  if (!X.alive && !Y.alive) return 0.5;
  if (!Y.alive) return 1;
  if (!X.alive) return 0;
  return X.blood === Y.blood ? 0.5 : X.blood > Y.blood ? 1 : 0;
}
console.log(`${idA} 대 ${idB}: ${idA}.pers.${key} 스윕, ${SEEDS}시드 × 두 자리, ${DUR}초`);
for (const v of vals) {
  // key 가 'level.xxx' 면 난이도 값(level)을, 아니면 성격(pers)을 바꾼다
  const persona = key.startsWith('level.')
    ? { ...A_.ai.persona, level: { ...A_.ai.persona.level, [key.slice(6)]: v } }
    : { ...A_.ai.persona, pers: { ...A_.ai.persona.pers, [key]: v } };
  let wa = 0, wb = 0;
  for (let s = 1; s <= SEEDS; s++) { wa += duel(s, persona, true); wb += duel(s, persona, false); }
  console.log(`${key}=${v}: ${idA} 대칭 승률 ${(50 * (wa + wb) / SEEDS).toFixed(1)}% (A자리 ${(100 * wa / SEEDS).toFixed(0)} / B자리 ${(100 * wb / SEEDS).toFixed(0)})`);
}
