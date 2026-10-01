// ─────────────────────────────────────────────────────────────
//  우리 캐릭터 동작 기록 (동작 연구 PM) — 비교 화면(tools/motion/viewer.html)에 기준 동작과 겹쳐 보기용
//
//   node tools/motion/record_game.mjs                → docs/motion/records/game_<베기>.json (지금 게임의 팔 베기, 상대 치움)
//   node tools/motion/record_game.mjs zornhau 0.3    → 베기 하나, 휘두르는 시간 0.3초
//   --levitate                                       → 옛 체중 방식(골반 띄우기). 기본은 게임과 같은 hybrid
//
//  실제 src/ 게임 코드를 헤드리스로 돌린다(tools/sim/harness_m.mjs). src/ 는 바꾸지 않는다.
//  플레이어 손가락(handOffset)을 AI 기술 길(ai_techniques.js TECH: 시작 자세 → 경유점 → 끝 자세)대로 움직인다
//  — weapon_measure.mjs 와 같은 방식. 게임과 같은 hybrid 걸음으로, 시작 자세에서 2초 서 있다가(가라앉기) 휘두른다.
//  랙돌 관절 자리(몸체 자세 × 관절 기준점)를 매 스텝 적는다(lib/game_joints.mjs). 좌표는 클립과 같다:
//   휘두르기 시작 때 골반 밑 땅이 원점, x 앞 · y 위 · z 칼 든 쪽.
//  시각 0 = 휘두르기 시작 − 0.2초 (클립의 감기 끝 tw 와 맞추려면 비교 화면에서 시간 정렬을 쓴다)
// ─────────────────────────────────────────────────────────────
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { newRound, DT, THREE, CONFIG } from '../sim/harness_m.mjs';
import { TECH_BY_NAME } from '../../src/ai_techniques.js';
import { JOINTS, BONES } from './lib/body.mjs';
import { frameOf, jointsOf, speeds } from './lib/game_joints.mjs';
import { writeRecord, gitRev } from './lib/records.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'docs', 'motion', 'records');
const args = process.argv.slice(2);
const MAP = { zornhau: 'zornhau', oberhau: 'oberhau', zwerchhau: 'zwerch', mittelhau: 'zwerch', unterhau: 'unterhau' };
const pos = args.filter((a) => !a.startsWith('--'));
const cuts = pos[0] ? [pos[0]] : Object.keys(MAP);
const SWING = pos[1] ? +pos[1] : 0.35; // weapon_measure.mjs 가 롱소드에서 가장 잘 휘두른 값
const CHAMBER = +(process.env.CHAMBER || 2.0); // 시작 자세로 서서 기다리는 시간. hybrid 걸음은 0.5 s 로는 덜 가라앉는다(1 s 부터 값이 안정 — tseq.mjs 도 2 s)
const PRE = 0.2;
const POST = 0.9;
const SEED = 1;
const REV = process.env.GAME_REV || gitRev(ROOT, ['src']); // src/ 를 마지막으로 바꾼 커밋
// 게임은 늘 다리로 체중을 받친다(main.js newRound: weightMode 'hybrid', 9/28 사장님 결정). 옛 levitate 는 --levitate 로만 (config 기본값도 hybrid)
CONFIG.BODY.weightMode = args.includes('--levitate') ? 'levitate' : 'hybrid';

function record(cutId) {
  const tech = TECH_BY_NAME[MAP[cutId]];
  const G = newRound({ weapon: 'longsword', seed: SEED });
  G.park();
  const f = G.player;
  const path = [tech.from, ...tech.path];
  const frames = [];
  let fr = null;
  const lerp = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  const total = CHAMBER + SWING + POST;
  for (let t = 0; t < total; t += DT) {
    if (t < CHAMBER) f.handOffset.set(tech.from[0], tech.from[1]);
    else {
      const u = Math.min(1, (t - CHAMBER) / SWING);
      const [a, b, w] = u < 0.5 ? [path[0], path[1], u * 2] : [path[1], path[2], (u - 0.5) * 2];
      const p = lerp(a, b, w);
      f.handOffset.set(p[0], p[1]);
    }
    f.move.set(0, 0);
    G.step();
    if (t < CHAMBER - PRE - 1e-9) continue;
    fr ??= frameOf(f, THREE);
    frames.push({ t: +(t - (CHAMBER - PRE)).toFixed(4), J: jointsOf(f, THREE, fr) });
  }
  const tip = speeds(frames, DT, 'tip');
  const hand = speeds(frames, DT, 'hS');
  const peakI = tip.indexOf(Math.max(...tip));
  return {
    format: 'stillness-motion-record/1',
    id: `game_${cutId}`,
    cut: cutId,
    kind: 'game-arm',
    source: `지금 게임 (src/ ${REV}), 헤드리스, 플레이어 손가락을 AI 기술 '${tech.name}' 길로 ${SWING}s 에 긋기, 상대 치움, skill ${f.skill.level}, 롱소드`,
    cond: {
      code: `src/ ${REV}`,
      seed: SEED,
      physicsHz: Math.round(1 / DT),
      recordHz: Math.round(1 / DT),
      inputHz: Math.round(1 / DT), // 손가락 자리를 물리 스텝마다 넣는다
      weapon: 'longsword',
      gait: CONFIG.BODY.weightMode,
      skill: f.skill.level,
      gap: null, // 상대 치움 (G.park)
      input: `손가락을 AI 기술 '${tech.name}' 길로: 시작 자세 ${CHAMBER} s 들기 → ${SWING} s 에 긋기`,
      commit: null,
    },
    hz: Math.round(1 / DT),
    marks: { swingStart: PRE, tipPeak: frames[peakI].t },
    summary: { tipPeak: Math.max(...tip), handPeak: Math.max(...hand), tipPeakT: frames[peakI].t },
    joints: JOINTS,
    bones: BONES,
    data: { n: frames.length, cols: { t: frames.map((q) => q.t), 'speed.tip': tip, 'speed.hand': hand, J: frames.flatMap((q) => q.J) } },
  };
}

mkdirSync(OUT, { recursive: true });
for (const c of cuts) {
  const r = record(c);
  writeRecord(OUT, r);
  console.log(`${r.id.padEnd(20)} 칼끝 최고 ${r.summary.tipPeak} m/s (t ${r.summary.tipPeakT}s) · 손 ${r.summary.handPeak} m/s · ${r.data.n} 표본`);
}
