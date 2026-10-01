// 읽기 전용 측정: 권총 총구 방향 시계열의 빠른 성분(>~3 Hz) — 어디서 떨림이 오나
import * as CONFIG from '/home/user/hs-gun/src/config.js';
CONFIG.BODY.weightMode = process.env.LEV ? 'levitate' : 'hybrid';
const { newRound, DT, THREE } = await import('/home/user/hs-gun/tools/sim/harness_m.mjs');
const { GUN } = await import('/home/user/hs-gun/src/gun.js');
const { getWeapon } = await import('/home/user/hs-gun/src/weapons.js');
if (process.env.AD) getWeapon('pistol').controlOverrides.aimDamping = +process.env.AD;
if (process.env.AS) getWeapon('pistol').controlOverrides.aimStiffness = +process.env.AS;
if (process.env.RD) getWeapon('pistol').controlOverrides.releaseDamping = +process.env.RD;
console.log('pistol controlOverrides', JSON.stringify(getWeapon('pistol').controlOverrides));

const axis = (f) => { const r = f.sword.rotation(); return new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w)); };
const muzzle = (f) => { const r = f.sword.rotation(); const p = f.sword.translation(); return new THREE.Vector3(f.weapon.muzzleX ?? 0, f.weaponCfg.hiltLength + f.weaponCfg.bladeLength, 0).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w)).add(new THREE.Vector3(p.x, p.y, p.z)); };
// 방향 → (yaw, pitch) 도
const yp = (v) => [Math.atan2(-v.z, v.x) * 180 / Math.PI, Math.asin(Math.max(-1, Math.min(1, v.y))) * 180 / Math.PI];
const unwrap = (a) => { for (let i = 1; i < a.length; i++) { while (a[i] - a[i - 1] > 180) a[i] -= 360; while (a[i] - a[i - 1] < -180) a[i] += 360; } return a; };
// 빠른 성분: 1/3 초 이동평균을 뺀 나머지의 RMS (≈3 Hz 위)
function hf(a, win = Math.round(1 / 3 / DT)) {
  const n = a.length; let s = 0, c = 0;
  for (let i = win; i < n - win; i++) {
    let m = 0; for (let k = -win; k <= win; k++) m += a[i + k]; m /= 2 * win + 1;
    s += (a[i] - m) ** 2; c++;
  }
  return Math.sqrt(s / Math.max(1, c));
}
// 느린 성분의 흔들림 폭 (이동평균의 표준편차)
function lf(a, win = Math.round(1 / 3 / DT)) {
  const ms = []; for (let i = win; i < a.length - win; i++) { let m = 0; for (let k = -win; k <= win; k++) m += a[i + k]; ms.push(m / (2 * win + 1)); }
  const mu = ms.reduce((x, y) => x + y, 0) / ms.length; return Math.sqrt(ms.reduce((x, y) => x + (y - mu) ** 2, 0) / ms.length);
}
function scenario(name, { hand = null, move = null, shots = 0, recoil = null, seed = 3, sec = 6, reloadOff = false } = {}) {
  const keep = [GUN.recoilBack, GUN.recoilUp, GUN.reloadIn];
  if (recoil) [GUN.recoilBack, GUN.recoilUp] = recoil;
  const G = newRound({ walls: true, seed, weapon: 'pistol', weapon2: 'longsword' });
  G.ai.update = () => {};
  const f = G.player;
  if (hand) { f.handOffset.set(hand[0], hand[1]); f.skill.anchor.copy(f.handOffset); f.skill.aimRaw.copy(f.handOffset); f.skill.aim.copy(f.handOffset); f.skill.prev.copy(f.handOffset); }
  for (let t = 0; t < 2; t += DT) G.step();
  const Y = { bar: [], tgt: [], foe: [], err: [], foeErr: [] };
  const P = { bar: [], tgt: [], foe: [] };
  let nShot = 0, tShot = 0.5;
  if (reloadOff) GUN.reloadIn = 1e9;
  for (let t = 0; t < sec; t += DT) {
    if (move) f.move.set(move[0], move[1]);
    if (shots && t >= tShot && nShot < shots && (f.gun?.cool ?? 0) <= 0) { f.skill.thrust(); nShot++; tShot = t + 0.1; }
    G.step();
    const b = axis(f);
    const th = f.skill.thrustPose;
    const tg = new THREE.Vector3(th.dir[0], th.dir[1], th.dir[2]).applyQuaternion(f.yaw);
    const o = muzzle(f); const c = f.foe.bodies.chest.translation();
    const fo = new THREE.Vector3(c.x - o.x, c.y - o.y, c.z - o.z).normalize();
    const [by, bp] = yp(b), [ty, tp] = yp(tg), [fy, fp] = yp(fo);
    Y.bar.push(by); P.bar.push(bp); Y.tgt.push(ty); P.tgt.push(tp); Y.foe.push(fy); P.foe.push(fp);
    Y.err.push((b.angleTo(tg) * 180) / Math.PI); Y.foeErr.push((b.angleTo(fo) * 180) / Math.PI);
  }
  [GUN.recoilBack, GUN.recoilUp, GUN.reloadIn] = keep;
  for (const k of ['bar', 'tgt', 'foe']) unwrap(Y[k]);
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const d = (A, B) => A.map((x, i) => x - B[i]);
  console.log(`${name.padEnd(34)} | 총신 빠른(>3Hz) yaw ${hf(Y.bar).toFixed(2)}° pitch ${hf(P.bar).toFixed(2)}° | 목표(pose.dir) 빠른 yaw ${hf(Y.tgt).toFixed(2)}° pitch ${hf(P.tgt).toFixed(2)}° | 총신−목표 빠른 yaw ${hf(d(Y.bar, Y.tgt)).toFixed(2)} pitch ${hf(d(P.bar, P.tgt)).toFixed(2)} | 느린 흔들림 총신 yaw ${lf(d(Y.bar, Y.foe)).toFixed(2)} pitch ${lf(d(P.bar, P.foe)).toFixed(2)} | 총신−목표 평균 ${mean(Y.err).toFixed(1)}° · 총신−가슴 평균 ${mean(Y.foeErr).toFixed(1)}° (yaw ${mean(d(Y.bar, Y.foe)).toFixed(1)} pitch ${mean(d(P.bar, P.foe)).toFixed(1)}) · 쏜 ${f.gun?.shots ?? 0}`);
}
const which = process.argv[2] ?? 'all';
if (which === 'all' || which === 'still') {
  scenario('가만히, 손 (0.15,0) 기본');
  scenario('가만히, 손 (0,0) 가운데', { hand: [0, 0] });
  scenario('가만히, 손 쟁기 (0.18,-0.28)', { hand: [0.18, -0.28] });
}
if (which === 'all' || which === 'move') {
  scenario('옆걸음 0.8, 손 가운데', { hand: [0, 0], move: [0.8, 0] });
  scenario('앞으로 0.8, 손 가운데', { hand: [0, 0], move: [0, 0.8] });
  scenario('뒤로 0.8, 손 가운데', { hand: [0, 0], move: [0, -0.8] });
}
if (which === 'all' || which === 'shots') {
  scenario('3발 반동 0.875/0.35 장전자세 끔', { hand: [0, 0], shots: 3, reloadOff: true, sec: 7 });
  scenario('3발 반동 0.5/0.2 장전자세 끔', { hand: [0, 0], shots: 3, recoil: [0.5, 0.2], reloadOff: true, sec: 7 });
  scenario('3발 반동 0 장전자세 끔', { hand: [0, 0], shots: 3, recoil: [1e-4, 1e-4], reloadOff: true, sec: 7 });
  scenario('3발 반동 0.875/0.35 장전자세 켬', { hand: [0, 0], shots: 3, sec: 7 });
}
