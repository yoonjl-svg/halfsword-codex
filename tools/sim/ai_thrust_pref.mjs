// AI 가 찌르기 무기(에스톡·레이피어)로 찌르기 기술을 더 고르는가 — 확인 도구
//  무기 A(AI) 대 롱소드(AI) 를 여러 판 돌려, A 쪽 AI 가 고른 기술의 종류(찌르기/베기)와
//  A 의 칼이 상대 몸에 닿은 판정(찌르기/베기/멍)·상처를 센다. (ai.js pickTech 는 찌르기 기술 가중치에 mThrust/mCut 을 곱한다)
//  사용법: node tools/sim/ai_thrust_pref.mjs [판 수] [무기 id...]
import { newRound, DT, AI } from './harness_m.mjs';
import { getWeapon } from '../../src/weapons.js';
import { applyWeaponMeasure } from './weapon_measures.mjs';

const N = +(process.argv[2] || 6);
const ids = process.argv.slice(3).length ? process.argv.slice(3) : ['longsword', 'estoc', 'rapier'];

function run(id, seed) {
  const G = newRound({ walls: true, weapon: id, weapon2: 'longsword', seed, AI2Class: AI });
  applyWeaponMeasure(G.ai2, getWeapon(id).id);
  applyWeaponMeasure(G.ai, 'longsword');
  const ai = G.ai2; // player 자리(무기 A)를 움직이는 AI
  const P = G.player;
  const tech = { thrust: 0, cut: 0 };
  const orig = ai.startAttack.bind(ai);
  ai.startAttack = (t, why, opt) => {
    const ok = orig(t, why, opt);
    if (ok && ai.tech) tech[ai.tech.kind]++;
    return ok;
  };
  const hit = { stab: 0, cut: 0, blunt: 0, wounds: 0, stabWounds: 0 };
  const C = G.combat;
  const os = C.strike.bind(C);
  C.strike = (pr, point, passing) => {
    const r = os(pr, point, passing);
    if (r && pr.w.fighter === P) {
      hit[r.type]++;
      if (r.type !== 'blunt' && r.severity > 0) {
        hit.wounds++;
        if (r.type === 'stab') hit.stabWounds++;
      }
    }
    return r;
  };
  for (let i = 0; i < 30 / DT && P.alive && G.enemy.alive; i++) G.step();
  return { tech, hit };
}

console.log(`무기 A(AI) 대 롱소드(AI), ${N}판씩 · 30초`);
console.log('무기 | mThrust/mCut | 고른 기술 찌르기:베기 (찌르기 비율) | A 칼 접촉 찌르기/베기/멍 | 상처(그중 찌르기)');
for (const id of ids) {
  const w = getWeapon(id);
  const s = { thrust: 0, cut: 0, stab: 0, cutH: 0, blunt: 0, wounds: 0, stabWounds: 0 };
  for (let k = 1; k <= N; k++) {
    const r = run(id, 70 + k);
    s.thrust += r.tech.thrust;
    s.cut += r.tech.cut;
    s.stab += r.hit.stab;
    s.cutH += r.hit.cut;
    s.blunt += r.hit.blunt;
    s.wounds += r.hit.wounds;
    s.stabWounds += r.hit.stabWounds;
  }
  const pct = Math.round((100 * s.thrust) / Math.max(1, s.thrust + s.cut));
  console.log(`${id.padEnd(10)} | ${(w.mThrust / w.mCut).toFixed(2)} | ${s.thrust}:${s.cut} (${pct}%) | ${s.stab}/${s.cutH}/${s.blunt} | ${s.wounds} (${s.stabWounds})`);
}
