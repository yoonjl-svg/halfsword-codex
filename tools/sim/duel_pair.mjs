// 캐릭터 두 명만 빠르게 맞대결시켜 보는 도구 (밸런스 튜닝용)
// 사용: node tools/sim/duel_pair.mjs <idA> <idB> [seeds] [durS]
import { newRound, DT } from './harness_m.mjs';
import { AI } from '../../src/ai.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';

const [idA, idB, seedsArg = '8', durArg = '45'] = process.argv.slice(2);
const A_ = CHARACTERS_BY_ID[idA];
const B_ = CHARACTERS_BY_ID[idB];
if (!A_ || !B_) { console.error('알 수 없는 id. 가능:', Object.keys(CHARACTERS_BY_ID).join(',')); process.exit(1); }
const SEEDS = +seedsArg, DUR = +durArg;

function runDuel(seed) {
  const opts = { seed, difficulty: A_.ai.level, persona: A_.ai.persona, weapon2: A_.weapon, AI2Class: AI, difficulty2: B_.ai.level, persona2: B_.ai.persona, weapon: B_.weapon, revive: A_.revive, revive2: B_.revive };
  const G = newRound(opts);
  const { player: B, enemy: A } = G;
  const steps = Math.round(DUR / DT);
  for (let i = 0; i < steps; i++) { G.step(); if (!A.alive || !B.alive) break; }
  if (!A.alive && !B.alive) return 'draw';
  if (!A.alive) return 'B';
  if (!B.alive) return 'A';
  return A.blood === B.blood ? 'draw' : A.blood > B.blood ? 'A' : 'B';
}
let a = 0, b = 0, d = 0;
const results = [];
for (let s = 1; s <= SEEDS; s++) { const r = runDuel(s); results.push(r); if (r === 'A') a++; else if (r === 'B') b++; else d++; }
console.log(`${idA}(A) vs ${idB}(B): A승 ${a}/${SEEDS} (${(100*a/SEEDS).toFixed(0)}%), B승 ${b}/${SEEDS} (${(100*b/SEEDS).toFixed(0)}%), 무승부 ${d}`);
console.log(results.join(' '));
