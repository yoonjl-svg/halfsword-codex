// 감정 고유 능력(emotions.js EMO_ABILITY)이 그 자체로 얼마나 유리·불리한지 재는 도구.
//  같은 난이도의 기본 AI 둘(성격 무작위, 감정 문턱값 0 = 감정 판정은 꺼짐)을 붙이고, 한쪽에만 감정 하나의 배율표를
//  세기 I로 고정해 얹는다(기본 AI는 emote()가 일찍 돌아가 emoMods를 덮어쓰지 않는다). 두 자리 모두 돌려 대칭 승률을 본다.
// 사용: node tools/sim/emotion_ability_eval.mjs [seeds] [durS] [I] [difficulty]
import { newRound, DT } from './harness_m.mjs';
import { AI } from '../../src/ai.js';
import { emoMods } from '../../src/emotions.js';

const [seedsArg = '12', durArg = '45', iArg = '0.7', diff = 'normal'] = process.argv.slice(2);
const SEEDS = +seedsArg, DUR = +durArg, I = +iArg;

function runDuel(seed, emotion, onEnemy) {
  const G = newRound({ seed, difficulty: diff, difficulty2: diff, AI2Class: AI });
  const { player: B, enemy: A } = G;
  const mods = emoMods(emotion, I);
  const X = onEnemy ? A : B; // 능력을 받는 쪽
  X.emoMods = mods;
  const steps = Math.round(DUR / DT);
  for (let i = 0; i < steps; i++) { G.step(); if (!A.alive || !B.alive) break; }
  const xAlive = X.alive, yAlive = (X === A ? B : A).alive;
  if (!xAlive && !yAlive) return 0.5;
  if (!yAlive) return 1;
  if (!xAlive) return 0;
  const Y = X === A ? B : A;
  return X.blood === Y.blood ? 0.5 : X.blood > Y.blood ? 1 : 0;
}
console.log(`감정 능력 단독 검증: 기본 AI(${diff}) 대 기본 AI, 한쪽에만 배율표 고정(I=${I}), ${SEEDS}시드 × 두 자리, ${DUR}초`);
console.log('emotion, 능력 쪽 대칭 승률(%), A자리 승률, B자리 승률, 배율표');
for (const emotion of [null, 'obsession', 'anger', 'fear']) {
  let wa = 0, wb = 0;
  for (let s = 1; s <= SEEDS; s++) { wa += runDuel(s, emotion, true); wb += runDuel(s, emotion, false); }
  const m = emoMods(emotion, I);
  console.log(`${emotion ?? 'none'}, ${(50 * (wa + wb) / SEEDS).toFixed(1)}, ${(100 * wa / SEEDS).toFixed(0)}, ${(100 * wb / SEEDS).toFixed(0)}, dealt ${m.dealt.toFixed(2)} taken ${m.taken.toFixed(2)} pass ${m.pass.toFixed(2)} move ${m.move.toFixed(2)}`);
}
