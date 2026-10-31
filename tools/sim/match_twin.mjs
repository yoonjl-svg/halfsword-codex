// 동시 대전 배관 쌍둥이 관문 (10/29 — docs/strike/team_fight_2026-10-29.md): fights12.mjs 와 같은 12 판을 jelly_harness newMatch
//  (src/match.js stepMatch — 2:2 와 같은 스텝 차례)로 돌려 같은 글을 찍는다. 해시가 fights12 와 같아야 한다 (d2b7915f):
//   node tools/sim/match_twin.mjs 2>/dev/null | sha256sum | cut -c1-8
//  fights12 와 다른 점은 판을 만드는 길(newRound + G.ai2 → newMatch ai [1, 0])과 스텝 고리(G.step → stepMatch)뿐이다
import { newMatch, DT, CONFIG } from './jelly_harness.mjs';
const es = +(process.argv[2] || CONFIG.STRIKE.energyScale);
CONFIG.STRIKE.energyScale = es;
const seedRand = (seed) => { let s = seed * 9301 + 49297; Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280); };
const out = [];
for (let seed = 1; seed <= 12; seed++) {
  seedRand(seed);
  const G = newMatch({ walls: true, seed, ai: [1, 0] }); const P = G.player, E = G.enemy; // 상대 AI 먼저 만든다 (fights12 의 newRound → G.ai2 차례)
  const hits = []; G.combat.hooks.onWound = (att, vic, r) => hits.push(r);
  let downs = 0; const prev = { P: 'stand', E: 'stand' }; let tDead = null;
  for (let i = 0; i < 30 / DT; i++) {
    G.step();
    for (const [k, f] of [['P', P], ['E', E]]) { if (prev[k] === 'stand' && (f.state === 'down' || f.state === 'getup')) downs++; prev[k] = f.state; }
    if (tDead == null && (P.state === 'dead' || E.state === 'dead')) tDead = +G.t.toFixed(1);
  }
  out.push({ seed, end: `${P.state}/${E.state}`, tDead, downs, opened: hits.filter((h) => h.type !== 'blunt' && h.severity > 0).length, cuts: hits.filter(h => h.type === 'cut').length, maxE: Math.round(Math.max(0, ...hits.map(h => h.energy))) });
}
const dead = out.filter(o => o.end.includes('dead')).length;
console.log(`energyScale ${es}: dead ${dead}/12, downs/fight ${(out.reduce((s, o) => s + o.downs, 0) / 12).toFixed(1)}, opened/fight ${(out.reduce((s, o) => s + o.opened, 0) / 12).toFixed(1)}`);
console.log(out.map(o => `${o.seed}:${o.end}${o.tDead ? '@' + o.tDead : ''} d${o.downs} o${o.opened} E${o.maxE}`).join('  '));
