// 싸우는 법 실험: 무기 X 쪽 AI 에만 성격(난이도 값 덮어쓰기, persona.level)을 줘서 롱소드 기본 AI 와 자리를 바꿔 가며 붙인다
//  같은 덮어쓰기를 롱소드 대 롱소드에도 주어 대조군으로 쓴다 (그 무기에만 통하는지, 누구에게나 통하는지 가른다)
//  판 구성은 weapon_balance.mjs 와 같다 (40초, 벽 있음, 무기 실측 간격)
// 사용법: node tools/sim/tactic_probe.mjs <무기id> '<level json>' [판 수] [--seed=첫 시드 번호]
//   시드는 weapon_balance.mjs 와 같다 (1000+s / 2000+s, s = 첫 번호부터, 기본 1)
//   예: node tools/sim/tactic_probe.mjs falchion '{"aggression":1.3}' 24
import { newRound, DT, AI } from './harness_m.mjs';
import { getWeapon } from '../../src/weapons.js';
import { applyWeaponMeasure } from './weapon_measures.mjs';

const [id = 'falchion', lv = '{}', nArg = '12'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const S0 = +(process.argv.find((a) => a.startsWith('--seed='))?.split('=')[1] ?? 1); // --seed=첫 시드 번호 (기본 1: 예전과 같은 판)
const level = JSON.parse(lv);
const persona = Object.keys(level).length ? { level } : null;
let w = 0;
let l = 0;
for (let s = S0; s < S0 + +nArg; s++) {
  for (const swap of [false, true]) {
    const G = swap
      ? newRound({ walls: true, weapon: 'longsword', weapon2: id, seed: 2000 + s, AI2Class: AI, persona })
      : newRound({ walls: true, weapon: id, weapon2: 'longsword', seed: 1000 + s, AI2Class: AI, persona2: persona });
    applyWeaponMeasure(G.ai2, getWeapon(swap ? 'longsword' : id).id);
    applyWeaponMeasure(G.ai, getWeapon(swap ? id : 'longsword').id);
    for (let i = 0; i < 40 / DT; i++) {
      G.step();
      if (G.player.state === 'dead' || G.enemy.state === 'dead') break;
    }
    const mine = swap ? G.enemy : G.player;
    const theirs = swap ? G.player : G.enemy;
    if (theirs.state === 'dead' && mine.state !== 'dead') w++;
    if (mine.state === 'dead' && theirs.state !== 'dead') l++;
  }
}
console.log(`${id} ${lv} → 승 ${w} 패 ${l} / ${2 * +nArg} (${Math.round((100 * w) / (2 * +nArg))}%)`);
