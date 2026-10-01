// 시작 거리별로 AI가 가만히 선 상대에게 "칼 닿는 거리"(자기 무기 measure.reach)까지 걸어오는 시간과, 첫 베기가 닿는 시간을 잰다.
// 사용: node tools/sim/start_gap_probe.mjs [gaps=4.2,6,7,8] [seeds=4]   (사장님 9/30 01:10 "시작 거리를 더 멀리" 의견용, 캐릭터 PM)
import { newRound, DT } from './harness_m.mjs';
import { CHARACTERS } from '../../src/characters.js';
import { schoolOf } from '../../src/schools.js';
const [gapsArg = '4.2,6,7,8', seedsArg = '4'] = process.argv.slice(2);
const GAPS = gapsArg.split(',').map(Number), SEEDS = +seedsArg;
const rows = [];
for (const ch of CHARACTERS) {
  let reachM = 2.0;
  reachM = schoolOf(ch.ai.persona.school).measure?.reach ?? 2.0;
  for (const gap of GAPS) {
    const tReach = [], tHit = [];
    for (let s = 1; s <= SEEDS; s++) {
      const G = newRound({ seed: s, gap, difficulty: ch.ai.level, persona: ch.ai.persona, weapon2: ch.weapon, weapon: 'longsword' });
      const { player: P, enemy: E } = G;
      G.before = () => P.move.set(0, 0);
      let tr = null, th = null; const b0 = P.blood ?? 0;
      for (let i = 0; i < Math.round(20 / DT); i++) {
        G.before?.(); G.step();
        const t = (i + 1) * DT;
        if (tr == null && E.foeDistance() <= reachM) tr = t;
        if (th == null && (P.blood ?? 0) !== b0) th = t;
        if (tr != null && th != null) break;
      }
      tReach.push(tr ?? NaN); tHit.push(th ?? NaN);
    }
    const avg = (a) => { const v = a.filter(Number.isFinite); return v.length ? (v.reduce((x, y) => x + y, 0) / v.length).toFixed(2) : '-'; };
    rows.push(`${ch.id},${gap},${reachM},${avg(tReach)},${avg(tHit)}`);
  }
}
console.log('id,startGap(m),reach(m),닿는거리까지(s),첫상처까지(s)');
console.log(rows.join('\n'));
