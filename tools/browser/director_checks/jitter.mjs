// 권총 총구 방향 떨림 스펙트럼 (읽기 전용 측정 — 저장소 코드는 안 고친다)
//  node jitter.mjs <scenario> [recoilMul]
//  scenario: still | fire | walk | foewalk | ai
import * as CONFIG from '/home/user/hs-gun/src/config.js';
CONFIG.BODY.weightMode = process.env.MODE ?? 'hybrid';
const { newRound, DT, THREE } = await import('/home/user/hs-gun/tools/sim/harness_m.mjs');
const { GUN } = await import('/home/user/hs-gun/src/gun.js');

const scen = process.argv[2] ?? 'still';
const rm = Number(process.argv[3] ?? 1);
GUN.recoilBack *= rm;
GUN.recoilUp *= rm;
const V = (v) => new THREE.Vector3(v.x, v.y, v.z);
const Qr = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);
const axis = (f) => new THREE.Vector3(0, 1, 0).applyQuaternion(Qr(f.sword.rotation()));
const muzzle = (f) => new THREE.Vector3(f.weapon.muzzleX ?? 0, f.weaponCfg.hiltLength + f.weaponCfg.bladeLength, 0).applyQuaternion(Qr(f.sword.rotation())).add(V(f.sword.translation()));

// 방향을 (방위각, 앙각) 도로
const ang = (d) => [Math.atan2(-d.z, d.x) * 180 / Math.PI, Math.asin(Math.max(-1, Math.min(1, d.y))) * 180 / Math.PI];
const wrap = (a) => ((a + 540) % 360) - 180;

function spectrum(x, fs) {
  const n = x.length;
  const m = x.reduce((s, v) => s + v, 0) / n;
  // 선형 추세 제거
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sx += i; sy += x[i]; sxx += i * i; sxy += i * x[i]; }
  const b = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const a = (sy - b * sx) / n;
  const y = x.map((v, i) => v - a - b * i);
  const bands = { '<1': 0, '1-3': 0, '3-6': 0, '6-12': 0, '>12': 0 };
  let peakF = 0, peakP = 0;
  for (let k = 1; k < n / 2; k++) {
    let re = 0, im = 0;
    const w = (2 * Math.PI * k) / n;
    for (let i = 0; i < n; i++) { re += y[i] * Math.cos(w * i); im -= y[i] * Math.sin(w * i); }
    const p = (2 * (re * re + im * im)) / (n * n); // 진폭² /2 합이 분산
    const f = (k * fs) / n;
    const key = f < 1 ? '<1' : f < 3 ? '1-3' : f < 6 ? '3-6' : f < 12 ? '6-12' : '>12';
    bands[key] += p;
    if (f >= 3 && p > peakP) { peakP = p; peakF = f; }
  }
  for (const k in bands) bands[k] = +Math.sqrt(bands[k]).toFixed(2); // 띠별 RMS (도)
  return { bands, hfPeakHz: +peakF.toFixed(1), mean: +m.toFixed(2) };
}

const G = newRound({ walls: true, seed: 7, weapon: 'pistol', weapon2: 'longsword' });
const f = G.player;
if (process.env.AIMD) f.weaponCfg.aimDamping = Number(process.env.AIMD);
if (process.env.AIMK) f.weaponCfg.aimStiffness = Number(process.env.AIMK);
if (process.env.TWS) f.twistScale = Number(process.env.TWS);
if (process.env.RELD) f.weaponCfg.releaseDamping = Number(process.env.RELD);
let sat = 0, satN = 0, handErr = 0;
const Ihand = f.swordIhand;
if (scen !== 'ai') G.ai.update = () => {};
let t = 0;
const rec = { errYaw: [], errPitch: [], chestYaw: [], chestPitch: [], wantYaw: [], wantPitch: [], barYaw: [], barPitch: [], aimRawX: [], ready: [] };
const settle = 2, dur = Number(process.env.DUR ?? 16);
let nextFire = 0;
G.before = () => {
  if (scen === 'walk') f.move.set(Math.sin(t * 1.2) * 0.8, 0);
  if (scen === 'foewalk') G.enemy.move.set(Math.sin(t * 1.2) * 0.8, 0);
};
while (t < settle + dur && f.alive) {
  if (scen === 'fire' && t > settle && (f.gun?.cool ?? 0) <= 0 && t >= nextFire) { f.skill.thrust(); nextFire = t + GUN.cooldown + 1.0; }
  G.step();
  t += DT;
  if (t < settle) continue;
  const b = axis(f);
  const o = muzzle(f);
  const c = V(f.foe.bodies.chest.translation());
  const toC = c.clone().sub(o).normalize();
  const th = f.skill.thrustPose;
  const want = new THREE.Vector3(...th.dir).applyQuaternion(f.yaw).normalize();
  const [by, bp] = ang(b), [cy, cp] = ang(toC), [wy, wp] = ang(want);
  rec.barYaw.push(by); rec.barPitch.push(bp);
  rec.chestYaw.push(wrap(by - cy)); rec.chestPitch.push(bp - cp);
  rec.wantYaw.push(wy); rec.wantPitch.push(wp);
  rec.errYaw.push(wrap(by - wy)); rec.errPitch.push(bp - wp);
  satN++; if (f.debug.wristTorque.length() >= 0.98 * f.debug.wristCap) sat++;
  { const b2 = f.bodies.farmS; const hp = new THREE.Vector3(0.13, 0, 0).applyQuaternion(Qr(b2.rotation())).add(V(b2.translation())); handErr += hp.distanceTo(f.handTarget); }
  rec.ready.push((f.gun?.cool ?? 0) <= 0 ? 1 : 0);
}
const fs = 1 / DT;
const out = { Ihand: +Ihand.toFixed(4), sat: +(sat / satN).toFixed(3), handErrCm: +(100 * handErr / satN).toFixed(1), cfg: [f.weaponCfg.aimStiffness, f.weaponCfg.aimDamping, f.weaponCfg.maxAimTorque, +f.twistScale.toFixed(2)], scen, mode: CONFIG.BODY.weightMode, recoil: [GUN.recoilBack, GUN.recoilUp], n: rec.barYaw.length, shots: f.gun?.shots ?? 0 };
if (scen === 'fire') {
  // 준비된(장전 끝) 구간만: 이어진 구간마다 0.33초 이동평균을 빼 고주파 RMS
  const hp = (arr) => {
    const segs = [];
    let s = -1;
    for (let i = 0; i <= arr.length; i++) {
      const r = i < arr.length && rec.ready[i];
      if (r && s < 0) s = i;
      if (!r && s >= 0) { segs.push([s, i]); s = -1; }
    }
    let ss = 0, cnt = 0, mabs = 0;
    const W = Math.round(0.33 * fs / 2);
    for (const [a, z] of segs) {
      for (let i = a + W; i < z - W; i++) {
        let m = 0;
        for (let j = i - W; j <= i + W; j++) m += arr[j];
        m /= 2 * W + 1;
        ss += (arr[i] - m) ** 2; cnt++;
      }
      for (let i = a; i < z; i++) mabs += Math.abs(arr[i]);
    }
    return { hfRms: +Math.sqrt(ss / Math.max(1, cnt)).toFixed(2), meanAbsToChest: +(mabs / Math.max(1, segs.reduce((s, [a, z]) => s + z - a, 0))).toFixed(2), segs: segs.length };
  };
  out.readyWindows = { yawVsChest: hp(rec.chestYaw), pitchVsChest: hp(rec.chestPitch), yawVsWant: hp(rec.errYaw), pitchVsWant: hp(rec.errPitch), wantYaw: hp(rec.wantYaw.map((v) => wrap(v - rec.wantYaw[0]))), wantPitch: hp(rec.wantPitch) };
} else {
  out.barrelVsChest = { yaw: spectrum(rec.chestYaw, fs), pitch: spectrum(rec.chestPitch, fs) };
  out.barrelVsPoseTarget = { yaw: spectrum(rec.errYaw, fs), pitch: spectrum(rec.errPitch, fs) };
  out.poseTarget = { yaw: spectrum(rec.wantYaw.map((v) => wrap(v - rec.wantYaw[0])), fs), pitch: spectrum(rec.wantPitch, fs) };
}
console.log(JSON.stringify(out));
