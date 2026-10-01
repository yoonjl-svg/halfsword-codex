// 쏜 뒤 장전 자세 전체(당겨 올림 → 다시 뻗음) 동안 총신이 자세 목표를 얼마나 떨며 따라가나 (읽기 전용 측정)
import * as CONFIG from '/home/user/hs-gun/src/config.js';
CONFIG.BODY.weightMode = 'hybrid';
const { newRound, DT, THREE } = await import('/home/user/hs-gun/tools/sim/harness_m.mjs');
const { GUN } = await import('/home/user/hs-gun/src/gun.js');
GUN.recoilBack = 0.5; GUN.recoilUp = 0.2;
if (process.env.CD) GUN.cooldown = Number(process.env.CD);
const Qr = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);
const res = [];
for (const seed of [3, 7]) {
  const G = newRound({ walls: true, seed, weapon: 'pistol', weapon2: 'longsword' });
  G.ai.update = () => {};
  const f = G.player;
  if (process.env.AIMD) f.weaponCfg.aimDamping = Number(process.env.AIMD);
  if (process.env.RELD) f.weaponCfg.releaseDamping = Number(process.env.RELD);
  for (let i = 0; i < 240; i++) G.step();
  for (let k = 0; k < 3; k++) {
    while ((f.gun?.cool ?? 0) > 0) G.step();
    for (let i = 0; i < 36; i++) G.step();
    f.skill.thrust();
    const e = [];
    let rel = 0;
    const n = Math.round((GUN.cooldown + 0.3) / DT);
    for (let i = 0; i < n; i++) {
      G.step();
      const b = new THREE.Vector3(0, 1, 0).applyQuaternion(Qr(f.sword.rotation()));
      e.push((b.angleTo(f.debug.aim) * 180) / Math.PI);
      if (!f.wristBrake && f.debug.wristTorque) {}
    }
    const W = 20;
    let ss = 0, c = 0;
    for (let i = W; i < e.length - W; i++) { let m = 0; for (let j = i - W; j <= i + W; j++) m += e[j]; m /= 2 * W + 1; ss += (e[i] - m) ** 2; c++; }
    res.push({ hf: Math.sqrt(ss / c), maxErr: Math.max(...e), meanErr: e.reduce((a, v) => a + v, 0) / e.length });
  }
}
const avg = (k) => +(res.reduce((a, r) => a + r[k], 0) / res.length).toFixed(2);
console.log(JSON.stringify({ c: process.env.AIMD ?? 11, rel: process.env.RELD ?? 1.5, cooldown: GUN.cooldown, hfRmsErr: avg('hf'), maxErr: avg('maxErr'), meanErr: avg('meanErr') }));
