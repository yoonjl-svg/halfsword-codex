// 캐릭터별 "절대 실력" 측정: 가만히 선 더미(자세 하나 유지)에게 60초 동안 실제로 어떤 상처를 내는가.
//  상성과 무관한 실력 축 — 맞힌 횟수, 한 방 에너지, 머리·목 비율, 가르고 들어간(pass) 비율, 상처 심각도.
// 실행: node tools/sim/skill_eval.mjs [seeds] [durS]
import { newRound, DT } from './harness_m.mjs';
import { CHARACTERS } from '../../src/characters.js';

const [seedsArg = '6', durArg = '60', onlyArg = ''] = process.argv.slice(2);
const ONLY = onlyArg ? onlyArg.split(',') : null;
const SEEDS = +seedsArg, DUR = +durArg;
const GUARDS = { langort: [0, 0.03], pflug: [0.18, -0.28], ochs: [0.22, 0.26], tag: [0.02, 0.52], ready: [0.12, -0.18] };
const GN = Object.keys(GUARDS);
const slow = (off, q, sp) => { const dx = q[0] - off.x, dy = q[1] - off.y, dd = Math.hypot(dx, dy), s = sp * DT; if (dd > s) { off.x += (dx / dd) * s; off.y += (dy / dd) * s; } else off.set(q[0], q[1]); };
const mean = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
const f1 = (x) => x.toFixed(1), f2 = (x) => x.toFixed(2);

console.log('id, 맞힘/분, 유효타/분, 평균J, 최고J, 머리목%, 팔다리%, 관통(pass)%, 심각도평균, 처치판, 평균TTK');
for (const ch of CHARACTERS) {
  if (ONLY && !ONLY.includes(ch.id)) continue;
  const W = []; let kills = 0; const ttk = []; let totalT = 0;
  for (let s = 1; s <= SEEDS; s++) {
    const G = newRound({ seed: s, difficulty: ch.ai.level, persona: ch.ai.persona, weapon2: ch.weapon });
    const { player: dummy, enemy: me } = G;
    const g = GUARDS[GN[s % GN.length]];
    G.before = () => { dummy.move.set(0, 0); slow(dummy.handOffset, g, 1.0); };
    G.onWound = (att, vic, r) => { if (att === me) W.push({ zone: r.zone, type: r.type, energy: r.energy, severity: r.severity, pass: !!r.pass }); };
    let dead = null;
    for (let i = 0; i < DUR / DT; i++) { G.step(); if (!dummy.alive) { dead = G.t; break; } }
    totalT += dead ?? DUR;
    if (dead != null) { kills++; ttk.push(dead); }
  }
  const eff = W.filter((w) => w.severity > 0 || w.energy >= 25);
  const head = W.filter((w) => w.zone === 'head' || w.zone === 'neck' || w.zone === 'helmet').length;
  const limb = W.filter((w) => w.zone === 'arm' || w.zone === 'leg').length;
  const pass = W.filter((w) => w.pass).length;
  console.log(`${ch.id}, ${f1((60 * W.length) / totalT)}, ${f1((60 * eff.length) / totalT)}, ${f1(mean(W.map((w) => w.energy)))}, ${f1(Math.max(0, ...W.map((w) => w.energy)))}, ${f1((100 * head) / Math.max(1, W.length))}, ${f1((100 * limb) / Math.max(1, W.length))}, ${f1((100 * pass) / Math.max(1, W.length))}, ${f2(mean(W.map((w) => w.severity)))}, ${kills}/${SEEDS}, ${ttk.length ? f1(mean(ttk)) : '-'}`);
}
