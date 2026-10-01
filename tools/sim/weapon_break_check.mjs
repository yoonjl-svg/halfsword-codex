// 무기 파손(칼날 끝쪽이 떨어져 나감) 점검: 무기마다 싸움 도중 강제로 부러뜨리고
//  · 물리: 칼 길이·질량·손 기준 관성·칼날 콜라이더 끝이 절단선과 맞는지, 몇 초 더 싸워도 NaN 이 없는지
//  · 겉모습: 절단선 위로 남은 보이는 꼭짓점이 없는지, 조각이 떠서 life 안에 사라지는지(조각 수 0), 판 정리 신호로도 치워지는지
//  · AI: 내 간격(M)·상대 간격 어림(foeM)이 줄었는지
//   node tools/sim/weapon_break_check.mjs [--weapons=longsword,sabre,...] [--at=3]
import { newRound, DT, THREE, AI } from './harness_m.mjs';
import { WEAPON_LIST } from '../../src/weapons.js';
import { DEBRIS, tickDebris, debrisCount } from '../../src/debris.js';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const ids = arg('weapons', WEAPON_LIST.filter((w) => w.fragile).map((w) => w.id).join(',')).split(',');
const at = +arg('at', 3);
DEBRIS.headless = true;

const _v = new THREE.Vector3();
let bad = 0;
for (const id of ids) {
  const G = newRound({ seed: 7, weapon: id, weapon2: 'longsword', AI2Class: AI });
  const f = G.player;
  for (let t = 0; t < at && !f.weaponBroken; t += DT) G.step(); // 저절로 부러지면 거기서 멈춘다
  if (f.weaponBroken) { console.log(`--  ${id} 이미 저절로 부러짐 — 건너뜀 (--at 을 줄여 다시)`); continue; }
  const before = { L: f.weaponCfg.bladeLength, m: f.swordMass, I: f.swordIhand, twist: f.twistScale, M: { ...G.ai2.M }, foeM: { ...G.ai.foeM } };
  f.breakWeapon();
  const cutY = f.weaponCfg.hiltLength + f.weaponCfg.bladeLength;
  // 칼날 콜라이더 끝 (칼 기준 y)
  let colTop = -Infinity;
  for (const c of f.swordColliders) {
    if (!c.isEnabled()) continue;
    const tr = c.translationWrtParent?.() ?? null;
    const he = c.halfExtents?.();
    if (tr && he) colTop = Math.max(colTop, tr.y + he.y);
  }
  // 보이는 꼭짓점 중 절단선 위 (톱니 절단면 제외)
  const g = f.swordGroup;
  g.updateMatrixWorld(true);
  const inv = g.matrixWorld.clone().invert();
  let above = 0;
  g.traverse((o) => {
    if (!o.isMesh || o.name === 'breakFace') return;
    for (let p = o; p && p !== g; p = p.parent) if (!p.visible) return;
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) if (_v.fromBufferAttribute(pos, i).applyMatrix4(m).y > cutY + 1e-4) above++;
  });
  const deb = debrisCount();
  // 몇 초 더 싸운다 (파편도 같이 움직인다)
  let nan = 0;
  let debT = null;
  for (let t = 0; t < 4; t += DT) {
    G.step();
    tickDebris(DT);
    if (debT == null && debrisCount() === 0) debT = t;
    const p = f.sword.translation();
    if (!Number.isFinite(p.x + p.y + p.z)) nan++;
  }
  // AI 는 다음 update 에서 반응했다
  const M = G.ai2.M;
  const foeM = G.ai.foeM;
  const ok = Math.abs(colTop - cutY) < 1e-3 && above === 0 && deb >= 1 && debT != null && debT <= DEBRIS.life + DT && nan === 0 && M.contact < before.M.contact && foeM.contact < before.foeM.contact;
  if (!ok) bad++;
  console.log(
    `${ok ? 'OK ' : 'BAD'} ${id.padEnd(18)} L ${before.L.toFixed(3)}→${f.weaponCfg.bladeLength.toFixed(3)}  m ${before.m.toFixed(3)}→${f.swordMass.toFixed(3)}  Ihand ${before.I.toFixed(4)}→${f.swordIhand.toFixed(4)}  twist ${before.twist.toFixed(3)}→${f.twistScale.toFixed(3)}` +
      `  colTop−cut ${(colTop - cutY).toFixed(4)}  above ${above}  debris ${deb} gone@${debT?.toFixed(2)}s  NaN ${nan}` +
      `  M.contact ${before.M.contact.toFixed(2)}→${M.contact.toFixed(2)} reach ${before.M.reach.toFixed(2)}→${M.reach.toFixed(2)}  foeM.contact ${before.foeM.contact.toFixed(2)}→${foeM.contact.toFixed(2)}`,
  );
}
// 판 정리 신호: 조각이 떠 있는 동안 칼 그룹이 장면에서 빠지면 바로 치운다
{
  const G = newRound({ seed: 3, weapon: 'tree_branch' });
  G.step();
  G.player.breakWeapon();
  const n0 = debrisCount();
  G.player.swordGroup.parent.remove(G.player.swordGroup);
  tickDebris(DT);
  const ok = n0 === 1 && debrisCount() === 0;
  if (!ok) bad++;
  console.log(`${ok ? 'OK ' : 'BAD'} round-change cleanup: debris ${n0} → ${debrisCount()}`);
}
console.log(bad ? `FAIL ${bad}` : 'ALL OK');
process.exit(bad ? 1 : 0);
