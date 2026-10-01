// 모든 캐릭터에게 같은 무기를 쥐여 주고 다른 시뮬 스크립트를 돌린다 (캐릭터 근력·성격·학파는 그대로)
//  캐릭터 근력(level.strength)이 같은 무기에서 어떻게 드러나는지 볼 때 쓴다 — 예: 에스톡·레이피어의 찌르기 속도
// 실행: node tools/sim/with_weapon.mjs estoc characters_eval.mjs both 3
import { CHARACTERS } from '../../src/characters.js';
import { simPath } from './is_main.mjs';

const [weapon, script, ...rest] = process.argv.slice(2);
for (const ch of CHARACTERS) {
  ch.weapon = weapon;
  delete ch.weaponAlt; // 브란의 10% 대체 무기도 끈다
}
process.argv = [process.argv[0], simPath(script), ...rest]; // 절대 경로로 넘긴다 (대상 스크립트의 직접 실행 확인이 맞게)
await import(new URL('./' + script, import.meta.url));
