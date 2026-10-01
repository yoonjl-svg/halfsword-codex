import * as CONFIG from '/home/user/hs-gun/src/config.js';
CONFIG.BODY.weightMode = 'hybrid';
const { newRound, DT, THREE } = await import('/home/user/hs-gun/tools/sim/harness_m.mjs');
const V = (v) => new THREE.Vector3(v.x, v.y, v.z);
const Qr = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);
const G = newRound({ walls: true, seed: 7, weapon: process.env.W ?? 'pistol', weapon2: 'longsword' });
G.ai.update = () => {};
const f = G.player;
if (process.env.AIMD) f.weaponCfg.aimDamping = Number(process.env.AIMD);
let t = 0;
const out = [];
while (t < 3) { G.step(); t += DT; if (t > 2.9) {
  const fa = V(f.bodies.farmS.angvel()), ua = V(f.bodies.uarmS.angvel()), ch = V(f.bodies.chest.angvel());
  const ax = new THREE.Vector3(1, 0, 0).applyQuaternion(Qr(f.bodies.farmS.rotation()));
  out.push([t.toFixed(3), fa.toArray().map((x) => x.toFixed(1)).join(','), 'along', fa.dot(ax).toFixed(1), 'uarm', ua.length().toFixed(1), 'chest', ch.length().toFixed(2), 'sw', V(f.sword.angvel()).length().toFixed(1)].join(' '));
} }
console.log(out.join('\n'));
