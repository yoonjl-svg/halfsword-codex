import { newRound, THREE, DT, AI, CONFIG } from './jelly_harness.mjs';
const es = +(process.argv[2] || CONFIG.STRIKE.energyScale);
CONFIG.STRIKE.energyScale = es;
const seedRand = (seed) => { let s = seed * 9301 + 49297; Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280); };
const out = [];
for (let seed = 1; seed <= 12; seed++) {
  seedRand(seed);
  const G = newRound({ walls: true, seed }); const P = G.player, E = G.enemy; P.skill.level = 0.7; // seed = 무기 파손 굴림 씨앗
  G.ai2 = new AI(P, E, 'normal');
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
