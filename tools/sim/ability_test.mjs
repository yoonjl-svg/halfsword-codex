// 에픽 특수 능력 시험 (사장님): 무기 X(주인공 대리) 대 롱소드(주인공 대리), 실제 승패 판 40초 (ref_duel 과 같은 판 길이·자리 바꾸기).
//  능력 배율을 바꿔 가며 잰다 — breakMult(청강검 '창천': 칼끼리 부딪힐 때 상대 무기 파손 ×) · bleedMult(모노호시자오 '명검의 날': 출혈 ×)
//   node tools/sim/hybrid.mjs ability_test.mjs <무기id> <자리마다 판 수> <필드> <값>
//   예) node tools/sim/hybrid.mjs ability_test.mjs qinggang 5 breakMult 3
//       node tools/sim/hybrid.mjs ability_test.mjs monohoshizao 24 bleedMult 2
//  권총이면 쏜 발 수·명중 수도 찍는다: node tools/sim/hybrid.mjs ability_test.mjs pistol 24 [GUN.energy=80 GUN.cooldown=4]
//  찍는 것: 승·패·무와 윌슨 95%, 평균 종료, 상대(롱소드) 칼이 부러진 판·부러진 시각, 내 칼이 부러진 판
import { newRound, DT } from './harness_m.mjs';
import { AI } from '../../src/ai.js';
import { WEAPONS } from '../../src/weapons.js';
import { wilson } from './ref_duel.mjs';
import { GUN } from '../../src/gun.js';

const [id, nArg, ...rest] = process.argv.slice(2);
const N = +nArg || 5;
// 필드는 "이름 값" 두 칸으로(옛 방식) 또는 "이름=값"을 여러 개. GUN.이름 은 gun.js 의 권총 값
const pairs = rest.some((a) => a.includes('=')) ? rest.map((a) => a.split('=')) : rest.length ? [[rest[0], rest[1]]] : [];
for (const [k, v] of pairs) {
  if (k.startsWith('GUN.')) GUN[k.slice(4)] = +v;
  else WEAPONS[id][k] = +v;
}
const field = pairs.map(([k]) => k).join(',');
const val = pairs.map(([, v]) => v).join(',');
const SECONDS = 40;
let W = 0, L = 0, D = 0, nan = 0, tSum = 0, tN = 0, foeBroke = 0, meBroke = 0, shots = 0, hits = 0, xWounds = 0;
const breakT = [];
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
    let res = 'D';
    let yb = null;
    for (let i = 0; i < SECONDS / DT; i++) {
      G.step();
      if (yb == null && Y.weaponBroken) yb = G.t;
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
    if (yb != null) (foeBroke++, breakT.push(yb.toFixed(1)));
    if (X.weaponBroken) meBroke++;
    shots += X.gun?.shots ?? 0;
    hits += X.gun?.hits ?? 0;
    if (res === 'W') W++;
    else if (res === 'L') L++;
    else D++;
  }
}
const n = 2 * N;
const [lo, hi] = wilson(W, n);
const pc = (v) => `${Math.round(100 * v)}%`;
console.log(`${id} ${field ?? ''}=${val ?? '-'}  승 ${W} 패 ${L} 무 ${D} / ${n} · 승률 ${pc(W / n)} (95% ${pc(lo)}~${pc(hi)}) · 평균 종료 ${tN ? (tSum / tN).toFixed(1) : '-'}s · 상대 칼 부러짐 ${foeBroke}/${n}${breakT.length ? ` (${breakT.join(', ')}초)` : ''} · 내 칼 부러짐 ${meBroke} · NaN ${nan}${shots ? ` · 총 ${shots}발 중 ${hits}발 명중 (${Math.round((100 * hits) / shots)}%), 판당 ${(shots / n).toFixed(1)}발` : ''}`);
