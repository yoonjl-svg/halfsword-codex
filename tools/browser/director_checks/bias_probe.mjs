import * as CONFIG from '/home/user/hs-gun/src/config.js';
CONFIG.BODY.weightMode = process.env.LEV ? 'levitate' : 'hybrid';
const { newRound, DT, THREE } = await import('/home/user/hs-gun/tools/sim/harness_m.mjs');
const G = newRound({ walls: true, seed: 3, weapon: 'pistol', weapon2: 'longsword' });
G.ai.update = () => {};
const f = G.player;
const hand = process.argv[2] ? process.argv[2].split(',').map(Number) : [0, 0];
f.handOffset.set(hand[0], hand[1]); f.skill.anchor.copy(f.handOffset); f.skill.aimRaw.copy(f.handOffset); f.skill.aim.copy(f.handOffset); f.skill.prev.copy(f.handOffset);
const cfg = f.weaponCfg;
console.log('aimStiffness', cfg.aimStiffness, 'maxAimTorque', cfg.maxAimTorque, 'aimDamping', cfg.aimDamping, 'twistScale', f.twistScale, 'strength', f.strength, 'skill.level', f.skill.level);
for (let t = 0; t < 4; t += DT) {
  G.step();
  if (Math.abs(t * 4 - Math.round(t * 4)) < DT * 2 && t > 0.9) {
    const r = f.sword.rotation(); const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
    const b = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const aim = f.debug.aim.clone();
    const ht = f.handTarget; const s = f.sword.translation();
    const fr = f.bodies.farmS.rotation(); const fq = new THREE.Quaternion(fr.x, fr.y, fr.z, fr.w);
    const fa = new THREE.Vector3(1, 0, 0).applyQuaternion(fq); // 아래팔 축
    const cr = f.bodies.chest.rotation(); const cq = new THREE.Quaternion(cr.x, cr.y, cr.z, cr.w);
    const cf = new THREE.Vector3(1, 0, 0).applyQuaternion(cq);
    const chestYaw = Math.atan2(-cf.z, cf.x) * 180 / Math.PI - f.heading * 180 / Math.PI;
    console.log(`t ${t.toFixed(2)} 총신−목표 ${(b.angleTo(aim) * 180 / Math.PI).toFixed(1)}° | 손목힘 ${f.debug.wristTorque.length().toFixed(2)}/${f.debug.wristCap.toFixed(2)} | 손 목표와 거리 ${Math.hypot(ht.x - s.x, ht.y - s.y, ht.z - s.z).toFixed(3)} m | 아래팔−총신 ${(fa.angleTo(b) * 180 / Math.PI).toFixed(1)}° 아래팔−목표 ${(fa.angleTo(aim) * 180 / Math.PI).toFixed(1)}° | 가슴 틀기 ${chestYaw.toFixed(1)}° heading ${(f.heading * 180 / Math.PI).toFixed(1)} | th.w ${f.skill.thrustPose.w} muscle ${f.muscle.toFixed(2)}`);
  }
}
