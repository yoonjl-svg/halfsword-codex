// 검술 보정(skill.level)만 다른 AI(X) 대 보통 AI (롱소드끼리, hybrid): 승패, 손 앞뻗음, 낸 상처의 칼 속도·에너지, 받은 상처. 사용법: node tools/sim/skill_level_duel.mjs <보정 0~1> [판수(자리마다)=24]
import * as CONFIG from '../../src/config.js';
import { newRound, DT } from './harness_m.mjs';
import { AI } from '../../src/ai.js';
import { wilson } from './ref_duel.mjs';
CONFIG.BODY.weightMode = 'hybrid';
const S = +process.argv[2]; const N = +(process.argv[3] || 24);
const st = { W: 0, L: 0, D: 0, fwd: 0, fwdMax: 0, steps: 0, give: [], take: 0, strikes: 0 };
for (let s = 1; s <= N; s++) for (const xf of [true, false]) {
  const xp = { school: 'longsword', level: { skill: S } }, yp = { school: 'longsword' };
  const G = newRound({ walls: true, seed: (xf ? 1000 : 2000) + s, weapon: 'longsword', weapon2: 'longsword', difficulty: 'normal', persona: xf ? yp : xp, AI2Class: AI, difficulty2: 'normal', persona2: xf ? xp : yp });
  const X = xf ? G.player : G.enemy, Y = xf ? G.enemy : G.player;
  G.onWound = (a, v, r) => { if (!(r.severity > 0)) return; if (a === X) st.give.push([r.speed, r.energy]); else st.take++; };
  let res = 'D';
  for (let i = 0; i < 40 / DT; i++) {
    G.step();
    const h = X.handBase; if (h) { st.fwd += h[0]; st.fwdMax = Math.max(st.fwdMax, h[0]); st.steps++; }
    if (X.state === 'dead' || Y.state === 'dead') { res = X.state === 'dead' && Y.state === 'dead' ? 'D' : Y.state === 'dead' ? 'W' : 'L'; break; }
  }
  st[res]++;
}
const m = (a, i) => (a.length ? a.reduce((p, q) => p + q[i], 0) / a.length : 0);
const n = st.W + st.L + st.D;
const [lo, hi] = wilson(st.W, n);
console.log(`보정 ${S}: 승 ${st.W} 패 ${st.L} 무 ${st.D}/${n} (승률 ${Math.round(100 * st.W / n)}% [95% ${Math.round(100 * lo)}~${Math.round(100 * hi)}]) · 손 앞뻗음 평균 ${(st.fwd / st.steps).toFixed(2)}m 최대 ${st.fwdMax.toFixed(2)}m · 낸 상처 ${(st.give.length / n).toFixed(1)}/판 (칼 속도 ${m(st.give, 0).toFixed(1)}m/s, 에너지 ${m(st.give, 1).toFixed(0)}J) · 받은 상처 ${(st.take / n).toFixed(1)}/판`);
