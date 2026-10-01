// AI 권총: 장전이 끝나고 몇 초 뒤에 쏘나(겨눔 문턱 aiAimTol 을 넘기까지) — 승률·명중률 아님, 쏘는 박자만 (읽기 전용 측정)
import * as CONFIG from '/home/user/hs-gun/src/config.js';
CONFIG.BODY.weightMode = 'hybrid';
const { newRound, DT, THREE } = await import('/home/user/hs-gun/tools/sim/harness_m.mjs');
const { GUN } = await import('/home/user/hs-gun/src/gun.js');
GUN.recoilBack = 0.5; GUN.recoilUp = 0.2;
const out = [];
for (const seed of [3, 7, 11]) {
  const G = newRound({ walls: true, seed, weapon: 'longsword', weapon2: 'pistol' });
  const me = G.enemy;
  if (process.env.AIMD) me.weaponCfg.aimDamping = Number(process.env.AIMD);
  G.player.applyWound = () => {}; // 과녁은 죽지 않게 (박자만 잰다)
  let t = 0, readyAt = 0, lastShots = 0;
  const waits = [], gaps = [];
  let lastShotT = null;
  while (t < 25) {
    const wasCool = (me.gun?.cool ?? 0) > 0;
    G.step(); t += DT;
    const cool = me.gun?.cool ?? 0;
    if (wasCool && cool <= 0) readyAt = t;
    const s = me.gun?.shots ?? 0;
    if (s > lastShots) { if (lastShotT != null) { waits.push(t - readyAt); gaps.push(t - lastShotT); } lastShotT = t; lastShots = s; }
  }
  out.push({ seed, shots: lastShots, waitAfterReady: waits.map((x) => +x.toFixed(2)), gap: gaps.map((x) => +x.toFixed(2)) });
}
console.log(JSON.stringify({ c: process.env.AIMD ?? 11, cooldown: GUN.cooldown, out }));
