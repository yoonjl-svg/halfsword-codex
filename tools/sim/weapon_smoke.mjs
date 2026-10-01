// 무기고 전체 훑기: 롱소드를 상대로 양쪽 다 AI를 붙여 한 판씩 6초만 돌려서 물리가 발산(NaN)하거나
// 예외가 나지 않는지만 본다. 실제로 휘두르게 해야(AI2Class) 손목 비틀림 같은 불안정이 드러난다.
import { newRound, DT, AI } from './harness_m.mjs';
import { WEAPONS } from '../../src/weapons.js';

const ids = Object.keys(WEAPONS);
for (const id of ids) {
  try {
    const G = newRound({ walls: true, weapon: id, weapon2: 'longsword', seed: 3, AI2Class: AI });
    let nan = false;
    for (let i = 0; i < 6 / DT; i++) {
      G.step();
      const p = G.player.bodies.chest.translation();
      const sv = G.player.sword.linvel();
      if (![p.x, p.y, p.z, sv.x, sv.y, sv.z].every(Number.isFinite)) { nan = true; break; }
    }
    console.log(`${id.padEnd(16)} OK  P=${G.player.state}/${G.player.blood.toFixed(2)}  E=${G.enemy.state}/${G.enemy.blood.toFixed(2)}  nan=${nan}  broken=${G.player.weaponBroken}/${G.enemy.weaponBroken}`);
  } catch (e) {
    console.log(`${id.padEnd(16)} FAIL ${e.stack.split('\n').slice(0, 3).join(' | ')}`);
  }
}
