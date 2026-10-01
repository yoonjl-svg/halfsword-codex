// 파손 추적: 다른 시뮬 스크립트를 그대로 돌리며, 무기가 부러질 때마다 "몇 번째 판(싸움꾼 두 명 = 한 판), 누구, 몇 초"를 적는다.
//  부러지지 않은 판이 이전 결과와 바이트 단위로 같은지 가를 때 쓴다 (부러진 판만 달라져야 한다).
//   node tools/sim/break_trace.mjs fights12.mjs [인자...]     (hybrid 는 node tools/sim/hybrid.mjs break_trace.mjs fights12.mjs)
import { Fighter } from '../../src/fighter.js';
import { simPath } from './is_main.mjs';
const seen = new Map();
const steps = new Map();
const cache = Fighter.prototype.cacheState;
Fighter.prototype.cacheState = function (...a) {
  if (!seen.has(this)) seen.set(this, seen.size);
  steps.set(this, (steps.get(this) ?? 0) + 1);
  return cache.apply(this, a);
};
const brk = Fighter.prototype.breakWeapon;
Fighter.prototype.breakWeapon = function (...a) {
  const i = seen.get(this) ?? -1;
  if (!this.weaponBroken) console.error(`BREAK fight ${Math.floor(i / 2) + 1} ${this.name ?? i % 2} ${this.weapon.id} step ${steps.get(this)}`);
  return brk.apply(this, a);
};
const [script, ...rest] = process.argv.slice(2);
process.argv = [process.argv[0], simPath(script), ...rest];
await import(new URL('./' + script, import.meta.url));
