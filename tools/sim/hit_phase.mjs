// 한 방이 왜 가벼운가 — 칼이 몸에 닿는 순간은 휘두름의 어느 단계인가 (측정 도구)
//  AI 대 AI 대결(weapon_balance.mjs 와 같은 판: 40초, 벽, 무기 실측 간격)에서 몸에 닿아 판정이 난 순간마다(상처·멍) 적는다:
//   - 닿은 칼 점(칼날 비율 t)의 속도가 이 휘두름에서 그 점이 낸 최고 속도(직전 0.6초)의 몇 %인가
//   - 그때 칼이 빨라지는 중인가 느려지는 중인가 (3스텝 전 속도와 비교), 손목이 제동 중이었나 (fighter.wristBrake)
//   - 칼 점 속도 중 치는 쪽 몸통(가슴)이 만든 몫
//   - 맞은 쪽 가슴이 밀려난 속도 변화 (닿은 뒤 0.1초, 칼이 들어온 방향 성분, m/s)
//   - 판정 에너지, 유효 질량, 닿은 칼날 비율
//  사용법: node tools/sim/hit_phase.mjs [판 수] [무기A] [무기B]  (기본 6판 롱소드 대 롱소드, 자리를 바꿔 2배. 시드 1000+s / 2000+s)
//   hybrid: node tools/sim/hybrid.mjs hit_phase.mjs 6
import * as THREE from 'three';
import { newRound, DT } from './harness_m.mjs';
import { AI } from '../../src/ai.js';
import { getWeapon } from '../../src/weapons.js';
import { applyWeaponMeasure } from './weapon_measures.mjs';
import { isMain } from './is_main.mjs';

const ROUND_SECONDS = 40;
const HIST = Math.round(0.6 / DT); // 최고 속도를 찾는 창
const NPT = 10; // 칼날 위 점 (10%, 20%, … 100%)
const _p = new THREE.Vector3();

function speeds(f, out) {
  for (let i = 0; i < NPT; i++) {
    f.bladePoint((i + 1) / NPT, _p);
    const v = f.sword.velocityAtPoint({ x: _p.x, y: _p.y, z: _p.z });
    out[i] = Math.hypot(v.x, v.y, v.z);
  }
  return out;
}

/** 한 판: 몸에 닿은 판정마다 기록을 모은다 */
export function hitPhaseRound(wA, wB, seed, rows) {
  const G = newRound({ walls: true, weapon: wA, weapon2: wB, seed, AI2Class: AI });
  applyWeaponMeasure(G.ai2, getWeapon(wA).id);
  applyWeaponMeasure(G.ai, getWeapon(wB).id);
  const F = [G.player, G.enemy];
  const hist = new Map(F.map((f) => [f, []])); // 스텝마다 칼날 점 속도 [NPT]
  const pend = []; // 맞은 쪽 밀림을 0.1초 뒤에 잰다
  G.onWound = (att, vic, r) => {
    const h = hist.get(att);
    if (!h || h.length < 4) return;
    const i = Math.min(NPT - 1, Math.max(0, Math.round(r.t * NPT) - 1));
    const cur = h[h.length - 1][i];
    const prev = h[h.length - 4][i];
    let peak = 0;
    for (const s of h) peak = Math.max(peak, s[i]);
    // 칼 점 속도 중 가슴이 만든 몫 (가슴 강체가 그 점에서 가질 속도를 칼 점 운동 방향에 투영)
    const vb = att.sword.velocityAtPoint(r.point);
    const vs = Math.hypot(vb.x, vb.y, vb.z) || 1;
    const vc = att.bodies.chest.velocityAtPoint(r.point);
    const bodyShare = (vc.x * vb.x + vc.y * vb.y + vc.z * vb.z) / (vs * vs);
    const c0 = vic.bodies.chest.linvel();
    const row = {
      type: r.type === 'blunt' || !(r.severity > 0) ? 'blunt' : 'wound',
      w: att.weapon?.id,
      e: r.energy,
      speed: r.speed,
      mEff: r.mEff,
      t: r.t,
      frac: peak > 0 ? cur / peak : 0,
      decel: cur < prev,
      brake: !!att.wristBrake,
      bodyShare,
      step: att.gait?.active ? !(att.gait.legs.F.stance && att.gait.legs.B.stance) : null,
      push: null,
    };
    rows.push(row);
    pend.push({ row, vic, dir: r.dir.clone(), c0: new THREE.Vector3(c0.x, c0.y, c0.z), n: 12 });
  };
  for (let k = 0; k < ROUND_SECONDS / DT; k++) {
    G.step();
    for (const f of F) {
      const h = hist.get(f);
      h.push(speeds(f, new Array(NPT)));
      if (h.length > HIST) h.shift();
    }
    for (let j = pend.length - 1; j >= 0; j--) {
      const q = pend[j];
      if (--q.n > 0) continue;
      const c1 = q.vic.bodies.chest.linvel();
      q.row.push = (c1.x - q.c0.x) * q.dir.x + (c1.y - q.c0.y) * q.dir.y + (c1.z - q.c0.z) * q.dir.z;
      pend.splice(j, 1);
    }
    if (G.player.state === 'dead' || G.enemy.state === 'dead') break;
  }
}

const med = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : NaN);
const pct = (a, f) => (a.length ? `${Math.round((100 * a.filter(f).length) / a.length)}%` : '-');

export function summarize(rows, label) {
  const out = [];
  for (const type of ['wound', 'blunt']) {
    const r = rows.filter((x) => x.type === type);
    if (!r.length) continue;
    const pushes = r.map((x) => x.push).filter((x) => x != null);
    out.push(
      `${label} ${type === 'wound' ? '상처' : '멍'} ${r.length}번 · 최고 속도 대비 ${Math.round(100 * med(r.map((x) => x.frac)))}% (중앙, 90% 넘음 ${pct(r, (x) => x.frac > 0.9)}) · ` +
        `느려지는 중 ${pct(r, (x) => x.decel)} · 손목 제동 중 ${pct(r, (x) => x.brake)} · 몸통 몫 ${Math.round(100 * med(r.map((x) => x.bodyShare)))}% · ` +
        `닿은 속도 ${med(r.map((x) => x.speed)).toFixed(1)}m/s · 에너지 ${Math.round(med(r.map((x) => x.e)))}J · 유효 질량 ${med(r.map((x) => x.mEff)).toFixed(2)}kg · ` +
        `칼날 ${Math.round(100 * med(r.map((x) => x.t)))}% 지점 · 맞은 쪽 밀림 ${med(pushes).toFixed(2)}m/s` +
        (r[0].step != null ? ` · 딛는 중 ${pct(r, (x) => x.step)}` : ''),
    );
  }
  return out.join('\n');
}

if (isMain(import.meta.url)) {
  const [nArg = '6', wA = 'longsword', wB = 'longsword'] = process.argv.slice(2);
  const rows = [];
  for (let s = 1; s <= +nArg; s++) {
    hitPhaseRound(wA, wB, 1000 + s, rows);
    hitPhaseRound(wB, wA, 2000 + s, rows);
  }
  console.log(`몸에 닿은 순간 · ${wA} 대 ${wB} · ${nArg}판 × 2`);
  for (const w of [...new Set([wA, wB])]) console.log(summarize(rows.filter((x) => x.w === w), w));
}
