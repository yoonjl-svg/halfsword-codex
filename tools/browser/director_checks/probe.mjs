// 권총 손목 제어 한 스텝씩 들여다보기 (읽기 전용 측정)
import * as CONFIG from '/home/user/hs-gun/src/config.js';
CONFIG.BODY.weightMode = process.env.MODE ?? 'hybrid';
const { newRound, DT, THREE } = await import('/home/user/hs-gun/tools/sim/harness_m.mjs');
const V = (v) => new THREE.Vector3(v.x, v.y, v.z);
const Qr = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);
const G = newRound({ walls: true, seed: 7, weapon: process.env.W ?? 'pistol', weapon2: 'longsword' });
G.ai.update = () => {};
const f = G.player;
if (process.env.AIMD) f.weaponCfg.aimDamping = Number(process.env.AIMD);
if (process.env.AIMK) f.weaponCfg.aimStiffness = Number(process.env.AIMK);
if (process.env.TWS) f.twistScale = Number(process.env.TWS);
if (process.env.NOTWIST) { f.twistScale = 0; }
let t = 0;
const rows = [];
while (t < 3.0) {
  G.step();
  t += DT;
  if (t < 2.5) continue;
  const b = new THREE.Vector3(0, 1, 0).applyQuaternion(Qr(f.sword.rotation()));
  const aim = f.debug.aim;
  const err = (b.angleTo(aim) * 180) / Math.PI;
  const w = V(f.sword.angvel());
  const fw = V(f.bodies.farmS.angvel());
  const tq = f.debug.wristTorque;
  // 칼 축 둘레 도는 몫
  const wTw = w.dot(b);
  rows.push([t.toFixed(3), err.toFixed(1), tq.length().toFixed(1), f.debug.wristCap.toFixed(1), (f.wristHill ?? 0).toFixed(2), w.length().toFixed(1), wTw.toFixed(1), w.clone().sub(fw).length().toFixed(1), f.wristBrake ? 'B' : '-'].join('\t'));
}
console.log('Ihand', f.swordIhand, 'twistScale', f.twistScale, 'pI', JSON.stringify(f.swordProps.I), 'com', JSON.stringify(f.sword.localCom()));
console.log('t\terr°\t|tq|\tcap\thill\t|w|\tw·blade\t|w-wfa|\tbrake');
console.log(rows.filter((_, i) => i % 3 === 0).join('\n'));
