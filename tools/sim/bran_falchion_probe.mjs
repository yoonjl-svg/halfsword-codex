// 브란 대체 무기(팔쉬온) 간이 측정: 더미 처치 + 캐릭터별 맞대결 몇 판 (나뭇가지와 비교)
// 실행: node tools/sim/bran_falchion_probe.mjs [weapon] [seeds]
import { newRound, DT } from './harness_m.mjs';
import { AI } from '../../src/ai.js';
import { CHARACTERS_BY_ID, CHARACTERS } from '../../src/characters.js';
const [wid = 'falchion', seedsArg = '4'] = process.argv.slice(2);
const SEEDS = +seedsArg;
const bran = CHARACTERS_BY_ID.bran;
const persona = wid === bran.weapon ? bran.ai.persona : { ...bran.ai.persona, school: wid }; // 게임과 같이 유파도 그 무기 것
const READY = [0.12, -0.18];
const slow = (off, q, sp) => { const dx = q[0] - off.x, dy = q[1] - off.y, dd = Math.hypot(dx, dy), s = sp * DT; if (dd > s) { off.x += dx / dd * s; off.y += dy / dd * s; } else off.set(q[0], q[1]); };
// 1) 더미 (가만히 서서 자세만 잡는 상대) 60초
const ttk = [];
for (let s = 1; s <= SEEDS; s++) {
  const G = newRound({ seed: s, difficulty: bran.ai.level, persona, weapon2: wid });
  G.before = () => { G.player.move.set(0, 0); slow(G.player.handOffset, READY, 1.0); };
  let t = null;
  for (let i = 0; i < 60 / DT; i++) { G.step(); if (!G.player.alive) { t = +G.t.toFixed(1); break; } }
  ttk.push(t);
}
console.log(`[${wid}] 더미 처치: ${ttk.filter((x) => x != null).length}/${SEEDS}판, 시간 ${ttk.map((x) => x ?? '-').join(' ')}`);
// 2) 캐릭터별 맞대결 (자리 바꿔 가며), 45초
for (const B_ of CHARACTERS.filter((c) => c.id !== 'bran')) {
  let w = 0, l = 0, d = 0;
  for (let s = 1; s <= SEEDS; s++) {
    const G = newRound({ seed: 100 + s, difficulty: bran.ai.level, persona, weapon2: wid, AI2Class: AI, difficulty2: B_.ai.level, persona2: B_.ai.persona, weapon: B_.weapon });
    const A = G.enemy, B = G.player;
    for (let i = 0; i < 45 / DT; i++) { G.step(); if (!A.alive || !B.alive) break; }
    if (A.alive && !B.alive) w++; else if (!A.alive && B.alive) l++; else d++;
  }
  console.log(`  브란(${wid}) vs ${B_.name}(${B_.weapon}): 승 ${w} 패 ${l} 무/시간초과 ${d}`);
}
