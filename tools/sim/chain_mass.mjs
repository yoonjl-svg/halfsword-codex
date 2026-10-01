// 칼 뒤에 실제로 실리는 질량 — 물리 사슬(칼 + 손 + 팔 + 몸)의 유효 질량을 직접 잰다
//  긴 자세로 선 채 칼날 70% 지점을 날 방향으로 J = 1 N·s 톡 밀고, 같은 판(결정적)을 안 민 것과 비교해
//  그 점의 속도 차이 Δv 로 m = J / Δv 를 구한다. 1스텝(8ms, 부딪히는 순간)과 4스텝(33ms, 칼이 살을 가르는 시간쯤) 뒤.
//  combat.analyze 의 판정용 유효 질량(칼 강체 + STRIKE.armAssist 0.3kg)과 견준다.
//  주의: 4스텝 값에는 손목·팔 근육이 자세로 되돌리려는 힘이 섞인다(질량이라기보다 버티는 힘). 12스텝쯤이면 되밀어 음수가 된다
// 사용법: node tools/sim/chain_mass.mjs [무기id...]
import { newRound, DT, THREE } from './harness_m.mjs';
import { STRIKE } from '../../src/config.js';
import { isMain } from './is_main.mjs';

function setup(id) {
  const G = newRound({ walls: false, weapon: id, weapon2: 'longsword', seed: 7 });
  G.park();
  G.player.handOffset.set(0.0, 0.03); // 긴 자세
  for (let i = 0; i < 1.5 / DT; i++) {
    G.player.move.set(0, 0);
    G.step();
  }
  return G;
}
const localPt = (f, t) => new THREE.Vector3(0, f.weaponCfg.hiltLength + t * f.weaponCfg.bladeLength, 0);
const quat = (f) => {
  const q = f.sword.rotation();
  return new THREE.Quaternion(q.x, q.y, q.z, q.w);
};
const world = (f, lp) => {
  const p = f.sword.translation();
  return lp.clone().applyQuaternion(quat(f)).add(new THREE.Vector3(p.x, p.y, p.z));
};
const velAt = (f, lp) => {
  const v = f.sword.velocityAtPoint(world(f, lp));
  return new THREE.Vector3(v.x, v.y, v.z);
};

if (isMain(import.meta.url)) {
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['longsword', 'zweihander', 'qinggang', 'rapier', 'sabre', 'monohoshizao'];
  console.log(`칼날 70% 지점, 날 방향 · 한 스텝 ${(DT * 1000).toFixed(1)}ms`);
  for (const id of ids) {
    const out = [];
    for (const n of [1, 4]) {
      const A = setup(id);
      const B = setup(id);
      const lp = localPt(B.player, 0.7);
      const nrm = new THREE.Vector3(1, 0, 0).applyQuaternion(quat(B.player));
      B.player.sword.applyImpulseAtPoint({ x: nrm.x, y: nrm.y, z: nrm.z }, world(B.player, lp), true);
      for (let i = 0; i < n; i++) {
        A.player.move.set(0, 0);
        A.step();
        B.player.move.set(0, 0);
        B.step();
      }
      out.push(1 / velAt(B.player, lp).sub(velAt(A.player, lp)).dot(nrm));
    }
    const f = setup(id).player;
    const c = f.weaponCfg;
    const { m, I, frame } = f.swordProps;
    const d = c.hiltLength + 0.7 * c.bladeLength - f.swordCom;
    const rn = new THREE.Vector3(0, d, 0).cross(new THREE.Vector3(1, 0, 0)).applyQuaternion(frame.clone().invert());
    const mf = 1 / (1 / m + (rn.x * rn.x) / I.x + (rn.y * rn.y) / Math.max(I.y, 1e-6) + (rn.z * rn.z) / I.z);
    console.log(`${id.padEnd(13)} 칼 혼자 ${mf.toFixed(2)}kg · 판정식(칼 + ${STRIKE.armAssist}) ${(mf + STRIKE.armAssist).toFixed(2)}kg · 물리 사슬 8ms ${out[0].toFixed(2)}kg · 33ms ${out[1].toFixed(2)}kg`);
  }
}
