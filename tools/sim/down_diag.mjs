// AI 가 쓰러진 상대를 왜 못 끝내나 — 진단 도구 (down_ai.mjs 와 같은 판·시드에 스텝마다 기록을 덧붙인다)
//  방향마다 모아 찍는 것 (상대가 쓰러진 뒤 0.5초부터):
//   - 상처 낸 판, 마무리 자세가 켜진 시간 비율
//   - AI 가 보는 상대 거리(ai.d, 가슴~누운 가슴 수평) 분포와 AI 단계(mode/phase) 분포
//   - 휘두를 때(ai 공격 strike 단계에 들어서는 순간): 거리, 마무리 자세 정도(amt), 겨눈 점(몸 기준 앞 x·칼 든 쪽 z)
//   - 휘두르는 동안 칼날(10~100%)과 누운 몸통(골반·배·가슴) 사이 가장 가까운 거리
//   - 상처가 난 순간의 거리·단계
//   - 발을 디딘 횟수 (hybrid 걸음만)
//  사용법: node tools/sim/down_diag.mjs [판 수(방향마다)] [적 무기 id] [초] [방향...] [--v] [--downM=닿는,사거리,붙음]
//   hybrid: node tools/sim/hybrid.mjs down_diag.mjs 6 longsword 8 right
//   --v     : 판마다 휘두름·상처 목록도 찍는다
//   --downM : 실험 — 쓰러진 상대에게 쓰는 AI 간격(finish.js FINISH.ai 의 contact·reach·clinch, 롱소드 기준 m)을 이 값으로 바꾼다
//             (저장소 값은 그대로. 무기 배율 finish.k 는 그대로 곱해진다)
import * as THREE from 'three';
import { aiTrial } from './down_ai.mjs';
import { DT } from './harness_m.mjs';
import { FINISH } from '../../src/finish.js';
import { isMain } from './is_main.mjs';

const FALLS = ['toward', 'away', 'left', 'right'];
const BANDS = [0.9, 1.2, 1.5, 1.8];
const _p = new THREE.Vector3();

/** G.step 을 감싸 스텝마다 기록한다 */
function probe(G, rec) {
  const step = G.step.bind(G);
  const E = G.enemy;
  const P = G.player;
  const ai = G.ai;
  let cur = null;
  let nw = 0;
  const stance = {};
  G.step = () => {
    step();
    rec.t += 1;
    const tSec = rec.t * DT;
    const fin = E.finish;
    const live = tSec >= 0.5 && P.state === 'down';
    if (live) {
      rec.n += 1;
      if (fin.on) rec.on += 1;
      const b = BANDS.findIndex((x) => ai.d < x);
      rec.band[b < 0 ? BANDS.length : b] += 1;
      const ph = `${ai.mode}/${ai.phase}`;
      rec.phase[ph] = (rec.phase[ph] || 0) + 1;
    }
    if (E.gait?.active) {
      for (const k of ['F', 'B']) {
        const st = E.gait.legs[k].stance;
        if (stance[k] === false && st) rec.steps += 1;
        stance[k] = st;
      }
    }
    const strike = ai.mode === 'attack' && ai.phase === 'strike';
    if (strike && !cur) {
      cur = { t: +tSec.toFixed(2), d: +ai.d.toFixed(2), amt: +fin.amt.toFixed(2), Tx: +fin.target[0].toFixed(2), Tz: +fin.target[2].toFixed(2), minD: Infinity };
      rec.strikes.push(cur);
    }
    if (cur) {
      for (let i = 1; i <= 10; i++) {
        E.bladePoint(i / 10, _p);
        for (const k of ['pelvis', 'abdomen', 'chest']) {
          const q = P.bodies[k].translation();
          const dd = Math.hypot(_p.x - q.x, _p.y - q.y, _p.z - q.z);
          if (dd < cur.minD) cur.minD = dd;
        }
      }
      if (!strike) {
        cur.minD = +cur.minD.toFixed(2);
        cur = null;
      }
    }
    const ws = G.wounds.filter((w) => w.att === E);
    for (; nw < ws.length; nw++) rec.hits.push({ t: +tSec.toFixed(2), d: +ai.d.toFixed(2), ph: `${ai.mode}/${ai.phase}`, amt: +fin.amt.toFixed(2), type: ws[nw].type, sev: +ws[nw].severity.toFixed(2) });
  };
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const verbose = args.includes('--v');
  const dm = args.find((a) => a.startsWith('--downM='))?.split('=')[1]?.split(',').map(Number);
  if (dm) FINISH.ai = { contact: dm[0], reach: dm[1], clinch: dm[2] };
  const pos = args.filter((a) => !a.startsWith('--'));
  const N = +(pos[0] || 6);
  const weapon2 = pos[1] || 'longsword';
  const secs = +(pos[2] || 8);
  const falls = pos.slice(3).length ? pos.slice(3) : FALLS;
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
  const med = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : NaN);
  const pct = (x) => `${Math.round(100 * x)}%`;
  console.log(`진단 · 적 무기 ${weapon2} · 방향마다 ${N}판 · ${secs}초${dm ? ` · 실험 downM=${dm.join(',')}` : ''}`);
  let hitAll = 0;
  let nAll = 0;
  for (const fall of falls) {
    const rows = [];
    for (let s = 1; s <= N; s++) {
      const rec = { t: 0, n: 0, on: 0, band: new Array(BANDS.length + 1).fill(0), phase: {}, steps: 0, strikes: [], hits: [] };
      const r = aiTrial({ fall, seed: 900 + s * 7 + fall.length * 100, weapon2, secs, before: (G) => probe(G, rec) });
      rows.push({ r, rec });
    }
    const hit = rows.filter((x) => x.r.first != null).length;
    hitAll += hit;
    nAll += rows.length;
    const nSum = rows.reduce((a, x) => a + x.rec.n, 0) || 1;
    const band = BANDS.map((_, i) => rows.reduce((a, x) => a + x.rec.band[i], 0) / nSum);
    band.push(rows.reduce((a, x) => a + x.rec.band[BANDS.length], 0) / nSum);
    const ph = {};
    for (const x of rows) for (const [k, v] of Object.entries(x.rec.phase)) ph[k] = (ph[k] || 0) + v / nSum;
    const phTop = Object.entries(ph).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} ${pct(v)}`).join(', ');
    const st = rows.flatMap((x) => x.rec.strikes);
    const hs = rows.flatMap((x) => x.rec.hits).filter((h) => h.type !== 'blunt' && h.sev > 0);
    console.log(`${fall.padEnd(7)} 상처 ${hit}/${rows.length} · 마무리 자세 켜짐 ${pct(avg(rows.map((x) => x.rec.on / Math.max(1, x.rec.n))))} · 발 디딤 ${avg(rows.map((x) => x.rec.steps)).toFixed(1)}`);
    console.log(`        거리 <0.9 ${pct(band[0])} · 0.9~1.2 ${pct(band[1])} · 1.2~1.5 ${pct(band[2])} · 1.5~1.8 ${pct(band[3])} · 1.8+ ${pct(band[4])} | 단계 ${phTop}`);
    console.log(
      `        휘두름 ${st.length} · 그때 거리 중앙 ${med(st.map((x) => x.d)).toFixed(2)}m · 마무리 자세(amt>0.5) ${st.filter((x) => x.amt > 0.5).length} · ` +
        `칼날~몸통 최소 거리 중앙 ${med(st.map((x) => x.minD)).toFixed(2)}m (0.2m 안 ${st.filter((x) => x.minD < 0.2).length}) · 상처 ${hs.length}번, 그때 거리 중앙 ${med(hs.map((h) => h.d)).toFixed(2)}m, 단계 ${[...new Set(hs.map((h) => h.ph))].join('/')}`,
    );
    if (verbose) for (const x of rows) console.log(`   판 첫 상처 ${x.r.first?.toFixed(2) ?? '-'} · 휘두름 ${JSON.stringify(x.rec.strikes)} · 상처 ${JSON.stringify(x.rec.hits)}`);
  }
  console.log(`전체 상처 낸 판 ${hitAll}/${nAll} (${pct(hitAll / nAll)})`);
}
