// 쏜 직후 총구 응답 (반동 충격만, 장전 자세 끔): 들림 최대, 3 Hz 넘는 떨림, 되울림 횟수 — 손목 이득별 (읽기 전용 측정)
//  env: AIMK AIMD RELD, argv: recoilBack recoilUp
import * as CONFIG from '/home/user/hs-gun/src/config.js';
CONFIG.BODY.weightMode = 'hybrid';
const { newRound, DT, THREE } = await import('/home/user/hs-gun/tools/sim/harness_m.mjs');
const { GUN } = await import('/home/user/hs-gun/src/gun.js');
GUN.recoilBack = Number(process.argv[2] ?? 0.5);
GUN.recoilUp = Number(process.argv[3] ?? 0.2);
const Qr = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);
const axis = (f) => new THREE.Vector3(0, 1, 0).applyQuaternion(Qr(f.sword.rotation()));
const res = [];
for (const seed of [3, 7]) {
  const G = newRound({ walls: true, seed, weapon: 'pistol', weapon2: 'longsword' });
  G.ai.update = () => {};
  const f = G.player;
  if (process.env.AIMD) f.weaponCfg.aimDamping = Number(process.env.AIMD);
  if (process.env.AIMK) f.weaponCfg.aimStiffness = Number(process.env.AIMK);
  if (process.env.RELD) f.weaponCfg.releaseDamping = Number(process.env.RELD);
  for (let i = 0; i < 240; i++) G.step();
  for (let k = 0; k < 3; k++) {
    while ((f.gun?.cool ?? 0) > 0) G.step();
    for (let i = 0; i < 36; i++) G.step();
    const rin = GUN.reloadIn;
    GUN.reloadIn = 1e9;
    const a0 = axis(f);
    f.skill.thrust();
    const s = [];
    for (let i = 0; i < 90; i++) { G.step(); s.push((axis(f).angleTo(a0) * 180) / Math.PI); }
    GUN.reloadIn = rin;
    // 0.33초 이동평균을 뺀 나머지 (3 Hz 넘는 몫)
    const W = 20;
    let ss = 0, n = 0;
    for (let i = W; i < s.length - W; i++) { let m = 0; for (let j = i - W; j <= i + W; j++) m += s[j]; m /= 2 * W + 1; ss += (s[i] - m) ** 2; n++; }
    let turns = 0;
    for (let i = 2; i < s.length; i++) if ((s[i] - s[i - 1]) * (s[i - 1] - s[i - 2]) < 0 && Math.abs(s[i] - s[i - 1]) > 0.05) turns++;
    const peak = Math.max(...s);
    const tPeak = s.indexOf(peak) * DT;
    const back = s.findIndex((v, i) => i * DT > tPeak && v < peak * 0.3);
    res.push({ peak, tPeak, back: back < 0 ? 0.75 : back * DT, hf: Math.sqrt(ss / n), turns, end: s[s.length - 1] });
  }
}
const avg = (k) => res.reduce((a, r) => a + r[k], 0) / res.length;
console.log(JSON.stringify({ k: process.env.AIMK ?? 60, c: process.env.AIMD ?? 11, rel: process.env.RELD ?? 1.5, recoil: [GUN.recoilBack, GUN.recoilUp], shots: res.length, peakDeg: +avg('peak').toFixed(1), tPeak: +avg('tPeak').toFixed(3), back30: +avg('back').toFixed(2), hfRmsDeg: +avg('hf').toFixed(2), turnsIn075s: +avg('turns').toFixed(1), endDeg: +avg('end').toFixed(1) }));
