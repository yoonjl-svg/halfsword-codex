// 부러진 무기 승률 (감독 지시: 부러진 뒤엔 불리하지만 0%는 아니어야 한다): 무기 X 를 쥔 주인공 대리가 롱소드(주인공 대리)와
//  60초 경합을 한다. X 는 판 시작과 동시에 부러뜨린다. 비교 조건 (--cond):
//   intact : 안 부러뜨린다 (기준)
//   blunt  : 예전 파손 — 날만 죽고 길이는 그대로 (breakWeapon 을 weaponBroken = true 한 줄로 바꿔치기)
//   short  : 지금 파손 — 칼날 끝쪽 절반이 떨어져 나가 짧은 둔기가 된다
//   stub   : short 에 BREAK.stubEdge 를 켠다 — 짧아진 토막 날로 약하게 베고 찌른다
//  자리를 바꿔 가며 붙인다 (시드 1000+s = X 가 player, 2000+s = enemy). 승률은 윌슨 95% 구간과 함께.
//   node tools/sim/hybrid.mjs broken_duel.mjs <자리마다 판 수> <cond> <무기id...>
import { newRound, DT } from './harness_m.mjs';
import { AI } from '../../src/ai.js';
import { Fighter } from '../../src/fighter.js';
import { wilson } from './ref_duel.mjs';
import { BREAK } from '../../src/weapons.js';

const [nArg, cond, ...ids] = process.argv.slice(2);
const N = +nArg || 24;
const SECONDS = 60;
if (cond === 'stub') BREAK.stubEdge = true;
if (cond === 'blunt') Fighter.prototype.breakWeapon = function () { this.weaponBroken = true; };

for (const id of ids) {
  let W = 0, L = 0, D = 0, nan = 0, tSum = 0, tN = 0, foeBroke = 0;
  for (let s = 1; s <= N; s++) {
    for (const xFirst of [true, false]) {
      const seed = (xFirst ? 1000 : 2000) + s;
      const x = { weapon: id, persona: { school: id } };
      const y = { weapon: 'longsword', persona: { school: 'longsword' } };
      const P = xFirst ? x : y;
      const E = xFirst ? y : x;
      const G = newRound({ walls: true, seed, weapon: P.weapon, weapon2: E.weapon, difficulty: 'normal', persona: E.persona, AI2Class: AI, difficulty2: 'normal', persona2: P.persona });
      const X = xFirst ? G.player : G.enemy;
      const Y = xFirst ? G.enemy : G.player;
      if (cond !== 'intact') X.breakWeapon();
      let res = 'D';
      for (let i = 0; i < SECONDS / DT; i++) {
        G.step();
        const v = X.sword.linvel();
        if (![v.x, v.y, v.z].every(Number.isFinite)) { nan++; break; }
        const xd = X.state === 'dead';
        const yd = Y.state === 'dead';
        if (xd || yd) {
          res = xd && yd ? 'D' : yd ? 'W' : 'L';
          tSum += G.t;
          tN++;
          break;
        }
      }
      if (Y.weaponBroken) foeBroke++;
      if (res === 'W') W++;
      else if (res === 'L') L++;
      else D++;
    }
  }
  const n = 2 * N;
  const [lo, hi] = wilson(W, n);
  const pc = (v) => `${Math.round(100 * v)}%`;
  console.log(`${cond.padEnd(6)} ${id.padEnd(12)} 승 ${W} 패 ${L} 무 ${D} / ${n} · 승률 ${pc(W / n)} (95% ${pc(lo)}~${pc(hi)}) · 평균 종료 ${tN ? (tSum / tN).toFixed(1) : '-'}s · 상대 칼 파손 ${foeBroke} · NaN ${nan}`);
}
