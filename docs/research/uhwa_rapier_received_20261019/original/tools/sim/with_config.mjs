// 설정값 몇 개를 바꾼 채로 다른 시뮬 스크립트를 돌린다 (감싸는 스크립트)
// 실행: node tools/sim/with_config.mjs STRIKE.thrustAssist=2.5 weapon_balance.mjs 12 falchion
//       node tools/sim/with_config.mjs ARMOR.on=false fights12.mjs   (true/false 는 참·거짓으로 읽는다)
//       node tools/sim/with_config.mjs BODY.weightMode=levitate fights12.mjs   (옛 기본 걸음. 글자는 그대로 넣는다)
import * as CONFIG from '../../src/config.js';
import { simPath } from './is_main.mjs';
const args = process.argv.slice(2);
const sets = [];
while (args.length && /^[A-Z_]+\.[A-Za-z0-9_]+=/.test(args[0])) sets.push(args.shift());
for (const s of sets) {
  const [path, v] = s.split('=');
  const [grp, key] = path.split('.');
  CONFIG[grp][key] = v === 'true' ? true : v === 'false' ? false : Number.isNaN(+v) ? v : +v; // 예: ARMOR.on=false
}
const [script, ...rest] = args;
process.argv = [process.argv[0], simPath(script), ...rest]; // 절대 경로로 넘긴다 (대상 스크립트의 직접 실행 확인이 맞게)
await import(new URL('./' + script, import.meta.url));
