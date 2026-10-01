// 무기 스펙 필드를 잠깐 바꾼 채로 다른 시뮬 스크립트를 돌린다 (실험용 — 저장소 값은 안 바뀐다)
//  값은 JSON 으로 적는다. 파이터를 만들 때 읽는 필드(thrustStyle 등)에만 통한다
// 실행: node tools/sim/with_spec.mjs 'qinggang.thrustStyle={"recover":0.8,"reach":0.08,"gap":0.2,"window":0.06}' weapon_balance.mjs 12 qinggang
import { WEAPONS } from '../../src/weapons.js';
import { simPath } from './is_main.mjs';

const args = process.argv.slice(2);
while (args.length && /^[a-z_]+\.[A-Za-z0-9_]+=/.test(args[0])) {
  const s = args.shift();
  const eq = s.indexOf('=');
  const [id, key] = s.slice(0, eq).split('.');
  WEAPONS[id][key] = JSON.parse(s.slice(eq + 1));
  console.log(`스펙 바꿈: ${id}.${key} = ${s.slice(eq + 1)}`);
}
const [script, ...rest] = args;
process.argv = [process.argv[0], simPath(script), ...rest]; // 절대 경로로 넘긴다 (대상 스크립트의 직접 실행 확인이 맞게)
await import(new URL('./' + script, import.meta.url));
