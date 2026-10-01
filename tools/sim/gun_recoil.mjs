// 권총 반동 점검 (디렉터 14:52, 사장님 "반동 1.5~2배"): 사격 자세로 가만히 선 상대에게 장전마다 한 발씩 5발 쏜다.
//  한 발마다(쏜 뒤 1.2초는 장전 자세를 끄고 반동만): 총구가 쏘기 직전 총신에서 얼마나 들리나(최대 각), 들린 만큼의 30% 안으로 돌아오기까지 몇 초,
//  다음 발 직전 총신이 상대 가슴에서 벗어난 각(자세가 무너지지 않고 다시 겨누나), 총(칼 몸체)이 손(아래팔 끝)에서 가장 멀어진 거리(튀어 나가나).
//   node tools/sim/hybrid.mjs gun_recoil.mjs [배율...]   (배율 = 0.5·0.2 N·s 에 곱한다, 기본 1 1.5 1.75 2)
import { newRound, DT, THREE } from './harness_m.mjs';
import { GUN } from '../../src/gun.js';

const muls = process.argv.slice(2).map(Number).filter((x) => x > 0);
const list = muls.length ? muls : [1, 1.5, 1.75, 2];
const B0 = 0.5, U0 = 0.2;
const axis = (f) => { const r = f.sword.rotation(); return new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w)); };
const muzzle = (f) => { const r = f.sword.rotation(); const p = f.sword.translation(); return new THREE.Vector3(f.weapon.muzzleX ?? 0, f.weaponCfg.hiltLength + f.weaponCfg.bladeLength, 0).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w)).add(new THREE.Vector3(p.x, p.y, p.z)); };
const aimErr = (f) => { const c = f.foe.bodies.chest.translation(); const o = muzzle(f); return (axis(f).angleTo(new THREE.Vector3(c.x - o.x, c.y - o.y, c.z - o.z)) * 180) / Math.PI; };
const gripGap = (f) => { const s = f.sword.translation(); const h = f.bodies.farmS.translation(); return Math.hypot(s.x - h.x, s.y - h.y, s.z - h.z); };
const keep = [GUN.recoilBack, GUN.recoilUp];
for (const m of list) {
  GUN.recoilBack = B0 * m;
  GUN.recoilUp = U0 * m;
  const rows = [];
  for (const seed of [3, 7]) {
    const G = newRound({ walls: true, seed, weapon: 'pistol', weapon2: 'longsword' });
    G.ai.update = () => {}; // 상대는 가만히
    const f = G.player;
    let t = 0;
    const run = (sec, fn) => { for (let e = 0; e < sec; e += DT, t += DT) { G.step(); fn?.(); } };
    run(2);
    const gap0 = gripGap(f);
    for (let k = 0; k < 5 && f.alive && f.foe.alive; k++) {
      while ((f.gun?.cool ?? 0) > 0) run(DT);
      run(0.3); // 다시 겨눈 뒤
      const pre = aimErr(f);
      const a0 = axis(f);
      const n0 = f.gun?.shots ?? 0;
      const rin = GUN.reloadIn;
      GUN.reloadIn = 1e9; // 쏜 뒤 1.2초는 장전 자세(총을 세워 올림)를 빼고 반동만 잰다 — 그 뒤 다시 켠다
      f.skill.thrust();
      let peak = 0, back = null, gap = 0, e = 0;
      run(1.2, () => {
        e += DT;
        if ((f.gun?.shots ?? 0) === n0) return;
        const ang = (axis(f).angleTo(a0) * 180) / Math.PI;
        peak = Math.max(peak, ang);
        if (back == null && e > 0.05 && ang < peak * 0.3 && peak > 1) back = e;
        gap = Math.max(gap, gripGap(f) - gap0);
      });
      GUN.reloadIn = rin;
      rows.push({ pre, peak, back, gap });
    }
  }
  const avg = (k) => rows.reduce((s, r) => s + (r[k] ?? 1.2), 0) / rows.length;
  const max = (k) => Math.max(...rows.map((r) => r[k] ?? 1.2));
  console.log(`×${m} (뒤 ${(B0 * m).toFixed(3)} · 위 ${(U0 * m).toFixed(3)} N·s), ${rows.length}발 | 총구 들림 평균 ${avg('peak').toFixed(1)}° 최대 ${max('peak').toFixed(1)}° | 제자리(30%)까지 평균 ${avg('back').toFixed(2)}초 최대 ${max('back').toFixed(2)}초 | 쏘기 직전 가슴에서 벗어남 평균 ${avg('pre').toFixed(1)}° 최대 ${max('pre').toFixed(1)}° | 손–총 거리 늘어남 최대 ${(max('gap') * 100).toFixed(1)} cm`);
}
[GUN.recoilBack, GUN.recoilUp] = keep;
