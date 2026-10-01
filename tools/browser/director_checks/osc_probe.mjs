import * as CONFIG from '/home/user/hs-gun/src/config.js';
CONFIG.BODY.weightMode = process.env.LEV ? 'levitate' : 'hybrid';
const { newRound, DT, THREE } = await import('/home/user/hs-gun/tools/sim/harness_m.mjs');
const wid = process.argv[2] ?? 'pistol';
const G = newRound({ walls: true, seed: 3, weapon: wid, weapon2: 'longsword' });
G.ai.update = () => {};
const f = G.player;
f.handOffset.set(0, 0); f.skill.anchor.copy(f.handOffset); f.skill.aimRaw.copy(f.handOffset); f.skill.aim.copy(f.handOffset); f.skill.prev.copy(f.handOffset);
const cfg = f.weaponCfg;
console.log(wid, 'aimStiffness', cfg.aimStiffness, 'aimDamping', cfg.aimDamping, 'maxAimTorque', cfg.maxAimTorque, 'swordIhand', f.swordIhand?.toFixed?.(4), 'mass', f.sword.mass().toFixed(3), 'I(principal)', JSON.stringify(f.sword.principalInertia?.() ?? null), 'angDamp', f.sword.angularDamping());
for (let t = 0; t < 2.5; t += DT) G.step();
let prev = null;
const rows = [];
for (let i = 0; i < 24; i++) {
  G.step();
  const r = f.sword.rotation(); const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
  const b = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  const w = f.sword.angvel();
  const tq = f.debug.wristTorque;
  const ang = b.angleTo(f.debug.aim) * 180 / Math.PI;
  rows.push(`${i} 총신−목표 ${ang.toFixed(2)}° ω (${w.x.toFixed(1)},${w.y.toFixed(1)},${w.z.toFixed(1)}) |ω| ${Math.hypot(w.x, w.y, w.z).toFixed(1)} rad/s  손목힘 (${tq.x.toFixed(1)},${tq.y.toFixed(1)},${tq.z.toFixed(1)}) /${f.debug.wristCap.toFixed(1)} hill ${f.wristHill?.toFixed(2)} brake ${f.wristBrake}`);
}
console.log(rows.join('\n'));
