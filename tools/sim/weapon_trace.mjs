// 무기 두 개를 AI 대 AI로 한 판 붙여서 타격 로그(에너지·부위·칼날 어디서 맞았는지)를 그대로 찍어 본다.
// 사용법: node tools/sim/weapon_trace.mjs <내 무기> <상대 무기> [seed]
import { newRound, DT, AI } from './harness_m.mjs';
import { applyWeaponMeasure } from './weapon_measures.mjs';
import { getWeapon as _gw } from '../../src/weapons.js';

const [wa, wb, seedArg] = process.argv.slice(2);
const seed = +(seedArg || 1);
const G = newRound({ walls: true, weapon: wa, weapon2: wb, seed, AI2Class: AI });
applyWeaponMeasure(G.ai2, _gw(wa).id); // AI 가 제 무기 간격으로 싸우게
applyWeaponMeasure(G.ai, _gw(wb).id);
const hits = [];
G.combat.hooks.onWound = (att, vic, r, point, pr) => hits.push(`t=${G.t.toFixed(1)} ${att.name}->${vic.name} ${r.zone}:${r.type} sev=${r.severity.toFixed(2)} E=${r.energy.toFixed(0)} bladeT=${r.t.toFixed(2)} part=${pr.w.part} speed=${r.speed.toFixed(1)}`);
for (let i = 0; i < 40 / DT; i++) {
  G.step();
  if (G.player.state === 'dead' || G.enemy.state === 'dead') break;
}
console.log(`${wa} vs ${wb} seed=${seed}: P=${G.player.state}(blood ${G.player.blood.toFixed(2)}) E=${G.enemy.state}(blood ${G.enemy.blood.toFixed(2)}) t=${G.t.toFixed(1)}`);
console.log(hits.join('\n'));
