import * as CONFIG from '/home/user/hs-gun/src/config.js';
CONFIG.BODY.weightMode = 'hybrid';
const { newRound, DT, THREE } = await import('/home/user/hs-gun/tools/sim/harness_m.mjs');
const G = newRound({ walls: true, seed: 3, weapon: 'pistol', weapon2: 'longsword' });
G.ai.update = () => {};
const f = G.player;
f.handOffset.set(0, 0); f.skill.anchor.copy(f.handOffset); f.skill.aimRaw.copy(f.handOffset); f.skill.aim.copy(f.handOffset); f.skill.prev.copy(f.handOffset);
for (let t = 0; t < 2.5; t += DT) G.step();
const D = 180 / Math.PI;
for (let i = 0; i < 10; i++) {
  G.step();
  const r = f.sword.rotation(); const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
  const b = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  const side = new THREE.Vector3(1, 0, 0).applyQuaternion(q); // 칼 몸체 x (총신 위 −x)
  const s = f.sword.translation();
  const fs = f.bodies.farmS.translation();
  const w = f.sword.angvel();
  const wb = w.x * b.x + w.y * b.y + w.z * b.z;
  console.log(`${i} 총신 yaw ${(Math.atan2(-b.z, b.x) * D).toFixed(2)} pitch ${(Math.asin(b.y) * D).toFixed(2)} | 몸체x (${side.x.toFixed(3)},${side.y.toFixed(3)},${side.z.toFixed(3)}) | 손 (${s.x.toFixed(4)},${s.y.toFixed(4)},${s.z.toFixed(4)}) 아래팔 (${fs.x.toFixed(4)},${fs.y.toFixed(4)},${fs.z.toFixed(4)}) | ω 총신축 성분 ${wb.toFixed(1)} 나머지 ${Math.sqrt(Math.max(0, w.x*w.x+w.y*w.y+w.z*w.z - wb*wb)).toFixed(1)}`);
}
