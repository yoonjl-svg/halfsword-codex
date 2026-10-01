// 권총 한 발 세기 점검 (사장님: "머리에 제대로 맞으면 바로 죽고, 가슴에는 두 발 정도 제대로 맞으면 죽는"):
//  가만히 선 상대(AI 없음)의 가슴 가운데·머리에 총알을 직접 맞히고(gun.js bulletHit) 몇 초 안에 죽는지 본다.
//   node tools/sim/hybrid.mjs gun_dummy.mjs [J...]   (기본 60 65 70 75 80 85)
import { newRound, DT, THREE } from './harness_m.mjs';
import { GUN, bulletHit } from '../../src/gun.js';
import { LOOKS, LOOK_ARCHIVE } from '../../src/looks.js';

const Es = process.argv.slice(2).map(Number).filter((x) => x > 0);
const list = Es.length ? Es : [60, 65, 70, 75, 80, 85];
const SECONDS = 40;
const BARE = { ...LOOKS.player, helmet: null }; // 주인공 겉모습에서 케틀햇만 벗긴다 (맨머리)
const PLATE = LOOK_ARCHIVE.margarethe.v3; // 뿔 투구 + 몸통 판금
function trial(E, zone, n, gap = 2, look = null) {
  GUN.energy = E;
  const keep = LOOKS.player;
  if (look) LOOKS.player = look; // 맞는 쪽(player)의 겉모습 = 방어구 (harness 가 LOOKS.player 를 입힌다)
  const G = newRound({ walls: true, seed: 7, weapon: 'pistol', weapon2: 'longsword' });
  LOOKS.player = keep;
  G.parkEnemy = false;
  const vic = G.player; // AI 없음: 가만히 선다
  const shooter = G.enemy;
  G.ai.update = () => {}; // 쏘는 쪽도 가만히
  const info = [...G.combat.info.values()].find((i) => i.fighter === vic && i.kind === zone);
  let shots = 0;
  let tNext = 1;
  let tDead = null;
  let minBlood = 1;
  for (let t = 0; t < SECONDS; t += DT) {
    if (shots < n && t >= tNext) {
      const p = info.body.translation();
      const fwd = vic.forward(new THREE.Vector3());
      const point = new THREE.Vector3(p.x, p.y, p.z).addScaledVector(fwd, 0.1);
      bulletHit(shooter, info, point, fwd.clone().negate(), G.combat);
      shots++;
      tNext = t + gap;
    }
    G.step();
    minBlood = Math.min(minBlood, vic.blood);
    if (vic.state === 'dead') { tDead = t; break; }
  }
  const armor = look ? ` [${vic.hasHelmet ? '투구 남음' : '투구 부서짐'} · 판금 부서짐 ${vic.platesBroken ?? 0}]` : '';
  return (tDead == null ? `산다 (피 최저 ${minBlood.toFixed(2)})` : `${(tDead - 1).toFixed(1)}초 뒤 죽음`) + armor;
}
// 반동: 서서 한 발 쏜 뒤 총구가 얼마나 들리는지 (총신 각도 변화의 최대값, 도)
{
  const G = newRound({ walls: true, seed: 7, weapon: 'pistol', weapon2: 'longsword' });
  G.ai.update = () => {};
  const f = G.player;
  for (let t = 0; t < 1.5; t += DT) G.step();
  const ax = () => new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion().copy(f.sword.rotation()));
  const a0 = ax();
  let quiet = 0;
  for (let t = 0; t < 0.5; t += DT) (G.step(), (quiet = Math.max(quiet, (ax().angleTo(a0) * 180) / Math.PI)));
  const a1 = ax();
  const keepIn = GUN.reloadIn;
  GUN.reloadIn = 1e9; // 사격 자세의 장전 동작(총을 세워 올림)을 빼고 반동만 잰다
  f.gun = { cool: 0, pending: 1, shots: 0, hits: 0, seed: 1 }; // 바로 한 발
  f.skill.thrustPush = true;
  let peak = 0;
  let back = null;
  for (let t = 0; t < 1.2; t += DT) {
    G.step();
    const ang = (ax().angleTo(a1) * 180) / Math.PI;
    peak = Math.max(peak, ang);
    if (back == null && t > 0.05 && ang < peak * 0.3) back = t;
  }
  GUN.reloadIn = keepIn;
  console.log(`반동: 총구가 최대 ${peak.toFixed(1)}° 들림, ${back?.toFixed(2) ?? '1.2초 넘게'}초 만에 거의 제자리 (안 쏠 때 흔들림 ${quiet.toFixed(1)}°)`);
}
for (const E of list) {
  console.log(`${String(E).padStart(3)} J 맨몸(투구만 벗김) | 머리 1발: ${trial(E, 'head', 1, 2, BARE)} | 가슴 1발: ${trial(E, 'chest', 1)} | 가슴 2발(2초 간격): ${trial(E, 'chest', 2)} | 가슴 3발: ${trial(E, 'chest', 3)}`);
  console.log(`${String(E).padStart(3)} J 투구·판금(마르그레테) | 머리 1발: ${trial(E, 'head', 1, 2, PLATE)} | 머리 2발: ${trial(E, 'head', 2, 2, PLATE)} | 가슴 1발: ${trial(E, 'chest', 1, 2, PLATE)} | 가슴 2발: ${trial(E, 'chest', 2, 2, PLATE)} | 가슴 3발: ${trial(E, 'chest', 3, 2, PLATE)}`);
}
