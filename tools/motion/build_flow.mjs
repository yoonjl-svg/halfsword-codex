// ─────────────────────────────────────────────────────────────
//  흐름(이어 베기) 기준 동작 (동작 연구 PM)
//   node tools/motion/build_flow.mjs            → docs/motion/clips/flow_zornhau8_<right|left>_large.json + docs/motion/flow_table.md
//   node tools/motion/build_flow.mjs --print    → 숫자만 찍는다 (파일 안 씀)
//   node tools/motion/build_flow.mjs --tw2=1.07 → 둘째 베기의 감기 끝 시각 (흐름 빠르기)
//
//  8자 흐름: 오른쪽 분노의 베기(크게)의 지나가기가 멈추지 않고 그대로 왼쪽 분노의 베기의 감기가 된다.
//   칼은 왼 엉덩이 옆으로 빠진 뒤 서지 않고, 손이 왼 어깨 위로 올라가는 동안 칼이 등 뒤로 늘어져(왼쪽 분노의 자세) 곧장 내려벤다.
//   베기마다 제 걸음(오른발, 그다음 왼발 — Meyer "모든 베기는 제 걸음")과 제 운동 사슬 곡선(clip.mjs chain.segments)을 쓴다.
//  키는 lib/cuts.mjs 의 크게 Zornhau 를 그대로 쓰고, 이음 키 하나(왼 엉덩이 옆을 지나며 손이 오르기 시작)만 저작한다 [추정].
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CUTS } from './lib/cuts.mjs';
import { SOURCES } from './lib/sources.mjs';
import { toKeys, marksOf, mirror, clipExtras } from './lib/sets.mjs';
import { sampleClip, measure, summarize, toJSONFrames, toColumns, phaseAt, stepOf, stanceOf, HZ } from './lib/clip.mjs';
import { JOINTS, BONES, v3, m3, frame } from './lib/body.mjs';
import { validateFile, report } from './validate_clip.mjs';
import { gripField } from './lib/weapons.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'docs', 'motion');
const args = process.argv.slice(2);
const PRINT = args.includes('--print');
const arg = (k, d) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? +a.slice(k.length + 3) : d;
};

const Z = CUTS.find((c) => c.id === 'zornhau');
const A = Z.large; // 오른쪽에서
const B = mirror(Z.large); // 왼쪽에서
const mA = marksOf(A);
const mB = marksOf(B);
const SPLIT = 0.77; // 첫 베기 키는 여기까지 (겨눈 선 +0.12 s, 지나가기 중)
const TW2 = arg('tw2', 0.97); // 몸통이 왼쪽으로 가장 많이 감긴 때 = 둘째 베기 감기 끝 (몸통이 풀기 시작)
const TC2 = arg('tc2', 1.25); // 둘째 베기 칼이 겨눈 선을 지나는 때
const D = TC2 - mB.tc; // 둘째 베기 키(손목 풀림 tr 부터)를 옮기는 시간
const q = A.chain.seq;

// 운동 사슬 곡선 한 토막 (build_clips.mjs build() 와 같은 식)
function segment(kw, kc, kf, m) {
  const slow = { peak2: m.tc + 0.1, dur2: Math.max(0.3, (m.tf - m.tc) * 1.6) };
  return {
    tw: m.tw,
    tf: m.tf,
    profiles: {
      pelvis: { v0: kw.p[0], vc: kc.p[0], v1: kf.p[0], tc: m.tc, peak: m.tc - q.pelvis, dur: q.dur, ...slow },
      chest: { v0: kw.p[0] + kw.c[0], vc: kc.p[0] + kc.c[0], v1: kf.p[0] + kf.c[0], tc: m.tc, peak: m.tc - q.chest, dur: q.dur, ...slow },
    },
  };
}

function flowSet() {
  const shiftB = (k) => ({ ...k, t: +(k.t + D).toFixed(4), tag: k.tag ? `${k.tag}2` : undefined, guard: k.guard });
  const keysA = A.keys.filter((k) => k.t <= SPLIT + 1e-9).map((k) => ({ ...k, tag: k.tag === 'tf' || k.tag === 'tg' ? undefined : k.tag }));
  // 둘째 베기는 손목 풀림(tr)부터 거울 키를 쓴다. 멈춰 선 왼쪽 분노의 자세(tw, 칼이 등 뒤로 늘어져 멈춤)는 쓰지 않는다
  const kwB = shiftB(B.keys.find((k) => k.tag === 'tw')); // 몸통 되감기 값만 (키로는 넣지 않음)
  const keysB = B.keys.filter((k) => k.t >= mB.tr - 1e-9).map(shiftB);
  // 이음 키 둘 [추정]: 칼끝이 서지 않고 왼쪽에서 한 바퀴 — 왼 엉덩이 옆(뒤·아래) → 왼 어깨 뒤로 올라감(뒤, 조금 위) → (둘째 베기 손목 풀림: 칼끝 위·뒤)
  //  손은 가슴 틀. 칼 방향은 월드(앞 x · 위 y · 칼 쪽 z)로 적고, 그 키의 가슴 자세로 가슴 틀로 바꾼다 (몸통 돌림은 아래에서 곡선 값으로 맞춤)
  const via = [
    { t: 0.86, h: [0.34, -0.02, -0.17], w: [-0.45, -0.6, -0.66], drop: 0.14, lean: 16, side: -5 },
    { t: 0.99, h: [0.1, 0.32, -0.2], w: [-0.62, 0, -0.78], drop: 0.12, lean: 6, side: -2 },
  ].map((v) => ({ t: v.t, p: [0, v.drop, 0], c: [0, v.lean, v.side], h: v.h, w: v3.norm(v.w) }));
  const keys = [...keysA, ...via, ...keysB];
  // 걸음: 첫 베기 오른발 내딛기(겨눈 선에 딛음)까지 → 무게를 앞으로 → 둘째 베기 왼발 내딛기 (거울 걸음을 앞으로 옮김)
  const stepsA = A.steps.filter((s) => s.t <= mA.tc + 1e-9);
  const last = stepsA[stepsA.length - 1];
  const OX = last.feet.R[0] - B.steps[0].feet.R[0]; // 거울 걸음의 앞발(오른발)을 지금 오른발 자리에 맞춤
  const OXP = 0.28; // 골반 앞으로 옮김 이어 붙이기
  const hold = { t: +(mA.tc + 0.25).toFixed(3), feet: { L: [...last.feet.L.slice(0, 3), 0.3, 0], R: [...last.feet.R] }, px: 0.25, pz: 0 };
  // 거울 걸음에서 왼발: 뜨기 전(뒤꿈치만 듦)은 지금 왼발 자리, 나는 동안은 지금 자리 → 딛는 자리(거울 + OX)로 같은 비율, 딛은 뒤는 거울 + OX
  const lift = B.steps.find((s) => s.feet.L[3] > 0.3); // 뒤꿈치를 크게 드는 키 (아직 제자리)
  const land = B.steps.find((s) => s.t > lift.t && s.feet.L[3] < 0.05 && s.feet.L[4] < 0.01); // 딛는 키
  const xs = lift.feet.L[0], xe = land.feet.L[0], zs = lift.feet.L[1], ze = land.feet.L[1];
  const L0 = last.feet.L;
  const stepsB = B.steps
    .filter((s) => s.t >= mB.tw - 1e-9)
    .map((s) => {
      const a = s.feet.L;
      let L;
      if (s.t <= lift.t + 1e-9) L = [L0[0], L0[1], a[2], Math.max(a[3], 0.3), a[4]];
      else if (s.t < land.t - 1e-9) {
        const u = (a[0] - xs) / (xe - xs);
        L = [L0[0] + u * (xe + OX - L0[0]), L0[1] + u * (ze - L0[1]), a[2], a[3], a[4]];
      } else L = [a[0] + OX, ...a.slice(1)];
      const R = [s.feet.R[0] + OX, ...s.feet.R.slice(1)];
      return { t: +(s.t + D).toFixed(4), feet: { L, R }, px: (s.px ?? 0) + OXP, pz: s.pz ?? 0 };
    });
  // 뜨는 키(거울 0.5 s)는 아직 제자리에서 뒤꿈치만 든다 → 자리는 지금 왼발
  const steps = [...stepsA, hold, ...stepsB];
  const m1 = { t0: 0, tw: mA.tw, tr: mA.tr, tc: mA.tc, tf: TW2, tg: TC2 };
  const m2 = { t0: mA.tc, tw: TW2, tr: +(mB.tr + D).toFixed(4), tc: TC2, tf: +(mB.tf + D).toFixed(4), tg: +(mB.tg + D).toFixed(4) };
  const kfB = keysB.find((k) => k.tag === 'tf2');
  const segments = [segment(A.keys.find((k) => k.tag === 'tw'), A.keys.find((k) => k.tag === 'tc'), kwB, m1), segment(kwB, keysB.find((k) => k.tag === 'tc2'), kfB, m2)];
  // 이음 키의 몸통 돌림은 곡선 값과 맞춘다 (칼 방향 키를 월드로 바꿀 때 그 키의 가슴 돌림을 쓰므로)
  const prof = segments[0].profiles;
  const at = (p, t) => {
    const mj = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * u * (10 - 15 * u + 6 * u * u));
    const Aa = mj((t - (p.peak - p.dur / 2)) / p.dur);
    const Bb = mj((t - (p.peak2 - p.dur2 / 2)) / p.dur2);
    const Ac = mj((p.tc - (p.peak - p.dur / 2)) / p.dur);
    const Bc = mj((p.tc - (p.peak2 - p.dur2 / 2)) / p.dur2);
    const vA = (p.vc - p.v0 + p.v0 * Ac - p.v1 * Bc) / (Ac - Bc);
    return p.v0 + (vA - p.v0) * Aa + (p.v1 - vA) * Bb;
  };
  for (const v of via) {
    v.p[0] = +at(prof.pelvis, Math.min(v.t, TW2)).toFixed(1);
    v.c[0] = +(at(prof.chest, Math.min(v.t, TW2)) - v.p[0]).toFixed(1);
    if (v.t > TW2) {
      const p2 = segments[1].profiles;
      v.p[0] = +at(p2.pelvis, v.t).toFixed(1);
      v.c[0] = +(at(p2.chest, v.t) - v.p[0]).toFixed(1);
    }
    v.d = m3.applyT(frame(v.p[0] + v.c[0], v.p[2] + v.c[1], v.c[2]), v.w); // 월드 → 이 키의 가슴 틀
    delete v.w;
  }
  return { keys, steps, m1, m2, segments };
}

function build(sideName) {
  let { keys, steps, m1, m2, segments } = flowSet();
  if (sideName === 'left') {
    const mk = mirror({ keys, steps, chain: {} });
    keys = mk.keys;
    steps = mk.steps;
    const neg = (p) => ({ ...p, v0: -p.v0, vc: -p.vc, v1: -p.v1 });
    segments = segments.map((s) => ({ ...s, profiles: { pelvis: neg(s.profiles.pelvis), chest: neg(s.profiles.chest) } }));
  }
  const marks = { t0: 0, tw: m1.tw, tr: m1.tr, tc: m1.tc, tf: m2.tf, tg: m2.tg };
  const def = { keys: toKeys({ keys, steps }), marks, chain: { arm: 0, sword: 0, ramp: 0.16, segments } };
  if (args.includes('--keys') && sideName === 'right') {
    let prev = null;
    for (const k of def.keys.filter((k) => k.dirV)) {
      const d = v3.norm(k.dirV);
      const ang = prev ? Math.round((Math.acos(Math.max(-1, Math.min(1, v3.dot(prev, d)))) * 180) / Math.PI) : 0;
      console.log(`  key t ${k.t.toFixed(3)} ${k.tag ?? ''} 칼 월드 (${d.map((v) => v.toFixed(2)).join(', ')}) 앞 키와 ${ang}°`);
      prev = d;
    }
  }
  const { frames } = sampleClip(def, 1);
  // 위상: 첫 베기 φ 가 둘째 감기 끝(tw2)에 1.6(지나가기 끝)에 닿고, 거기서 둘째 베기 φ 0 으로 새로 시작한다
  for (const f of frames) f.ch.phi = f.t < m2.tw ? phaseAt({ ...m1, tf: m2.tw, tg: m2.tc }, f.t) : phaseAt(m2, f.t);
  const rows = measure(frames, marks);
  for (const r of rows) r.phi = r.t < m2.tw ? phaseAt({ ...m1, tf: m2.tw, tg: m2.tc }, r.t) : phaseAt(m2, r.t);
  const s1 = summarize(rows, m1);
  const s2 = summarize(rows, m2);
  // 흐름에서 볼 것: 두 겨눈 선 사이에서 칼끝·손·손목(칼 − 아래팔 각속도)이 얼마나 느려지나 — 멈추지 않는가
  const between = rows.filter((r) => r.t > m1.tc + 1e-9 && r.t < m2.tc - 1e-9);
  const minOf = (pick) => between.reduce((a, r) => (pick(r) < pick(a) ? r : a), between[0]);
  const tipMin = minOf((r) => r.sp.tip);
  const handMin = minOf((r) => r.sp.hand);
  // 칼 돌림 빠르기: 월드 칼 방향(손 → 칼끝)의 각속도 rad/s
  const bdir = (r) => v3.norm(v3.sub(r.J.tip, r.J.hS));
  const bladeRate = between.map((r, i) => {
    const a = bdir(between[Math.max(0, i - 1)]), b = bdir(between[Math.min(between.length - 1, i + 1)]);
    const span = (Math.min(between.length - 1, i + 1) - Math.max(0, i - 1)) / HZ;
    return { t: r.t, v: Math.acos(Math.max(-1, Math.min(1, v3.dot(a, b)))) / span };
  });
  const bMin = bladeRate.reduce((a, x) => (x.v < a.v ? x : a), bladeRate[0]);
  const flow = {
    contactGap: +(m2.tc - m1.tc).toFixed(3),
    tipMin: { v: +tipMin.sp.tip.toFixed(1), t: +(tipMin.t - m1.tc).toFixed(3), ofPeak1: +(tipMin.sp.tip / s1.tipPeak).toFixed(2) },
    handMin: { v: +handMin.sp.hand.toFixed(2), t: +(handMin.t - m1.tc).toFixed(3) },
    bladeRateMin: { v: +bMin.v.toFixed(1), t: +(bMin.t - m1.tc).toFixed(3) },
    tipLow: +Math.min(...between.map((r) => r.J.tip[1])).toFixed(2),
    wristMax: Math.round(Math.max(...between.map((r) => r.ang.wrist))),
    chestTurn: Math.round(Math.max(...between.map((r) => Math.abs(r.yawC)))),
    // 걸음: 골반이 나아간 거리(시작 → 둘째 지나가기 끝), 두 발이 옮긴 거리
    pelvisAdvance: +(rows.find((r) => r.t >= m2.tf).J.hipC[0] - rows[0].J.hipC[0]).toFixed(2),
    stepR: +Math.hypot(rows[rows.length - 1].J.legs.R.ankle[0] - rows[0].J.legs.R.ankle[0], rows[rows.length - 1].J.legs.R.ankle[2] - rows[0].J.legs.R.ankle[2]).toFixed(2),
    stepL: +Math.hypot(rows[rows.length - 1].J.legs.L.ankle[0] - rows[0].J.legs.L.ankle[0], rows[rows.length - 1].J.legs.L.ankle[2] - rows[0].J.legs.L.ankle[2]).toFixed(2),
    legOver: Math.max(s1.checks.legOver, s2.checks.legOver),
  };
  // clip/2 필드: 걸음은 베기마다 하나씩 (첫 베기 = 둘째 감기 끝까지, 둘째 베기 = 첫 겨눈 선부터)
  const extra = clipExtras({ keys }, rows, marks);
  extra.stance = stanceOf(rows);
  extra.step = [stepOf(rows.filter((r) => r.t <= m2.tw + 1e-9), m1), stepOf(rows.filter((r) => r.t >= m1.tc - 1e-9), m2)];
  return { rows, marks, m1, m2, s1, s2, flow, def, extra };
}

const DESC = '오른쪽에서 분노의 베기로 내려벤 칼이 왼 엉덩이 옆을 지나 서지 않고 왼 어깨 뒤로 돌아 올라가, 곧장 왼쪽에서 분노의 베기로 내려벤다(8자). 베기마다 한 걸음.';
const SRC = ['meyer_zornhau', 'meyer_step', 'golf_sequence', 'estimate'];
const indexEntries = [];
const table = [];
for (const side of ['right', 'left']) {
  const { rows, marks, m1, m2, s1, s2, flow, extra } = build(side);
  const name = `flow_zornhau8_${side}_large`;
  console.log(
    `${name}: 겨눈 선 ${m1.tc} → ${m2.tc} s (사이 ${flow.contactGap} s) | 칼끝 최고 ${s1.tipPeak} / ${s2.tipPeak} m/s | 사이 칼끝 최저 ${flow.tipMin.v} m/s (첫 최고의 ${flow.tipMin.ofPeak1}, 겨눈 선 +${flow.tipMin.t} s) | 손 최저 ${flow.handMin.v} m/s | 칼 돌림 최저 ${flow.bladeRateMin.v} rad/s | 칼끝 최저 높이 ${flow.tipLow} m | 손목 ${flow.wristMax}° | 가슴 ${flow.chestTurn}° | 넘침 팔 ${s1.checks.reachOver}/${s2.checks.reachOver} | 순서 ${s1.ordered && s2.ordered ? 'OK' : '뒤섞임'}`,
  );
  if (args.includes('--trace'))
    for (const r of rows.filter((r, i) => i % 6 === 0 && r.t >= m1.tc - 0.05 && r.t <= m2.tc + 0.05))
      console.log(`    t ${r.t.toFixed(2)} φ ${r.phi.toFixed(2)} 칼끝 ${r.sp.tip.toFixed(1)} 손 ${r.sp.hand.toFixed(1)} 손목 ${r.ang.wrist.toFixed(0)}° 가슴 ${r.yawC.toFixed(0)}° 손 (${r.J.hS.map((v) => v.toFixed(2)).join(', ')}) 칼끝 높이 ${r.J.tip[1].toFixed(2)}`);
  table.push({ side, m1, m2, s1, s2, flow });
  if (PRINT) continue;
  const clip = {
    format: 'stillness-motion-clip/2',
    id: name,
    cut: 'flow_zornhau8',
    base: 'zornhau', // 없는 크기(작게·보통)는 비교 화면이 이 베기 클립으로 대신 잰다
    nameKo: '8자 흐름',
    nameDe: 'Zornhau ↔ Zornhau',
    family: '흐름 · 이어 베기',
    desc: DESC,
    side,
    size: 'large',
    hz: HZ,
    weapon: 'longsword',
    handedness: 'right',
    grip: gripField('longsword'), // 칼 치수 (앞손에서 칼 축 m) — src/weapons.js 에서 읽음
    units: 'm, 도(°), 초, rad/s(w), m/s(speed)',
    frame: '베기 클립과 같다 (lib/clip.mjs · clip_format.md §2)',
    marks,
    marks1: m1,
    marks2: m2,
    phiMarks: { t0: -1, tw: 0, tr: 0.55, tc: 0.85, tf: 1.6, tg: 2.2 },
    phiNote: 'φ 는 첫 베기 것이 둘째 감기 끝(marks2.tw)에서 1.6(지나가기 끝)에 닿고, 거기서 둘째 베기 φ 0 으로 새로 시작한다',
    sources: SRC.map((id) => ({ id, ...SOURCES[id] })),
    provenance: '크게 Zornhau 키(오른쪽 → 거울 왼쪽) + 이음 키 둘 [추정]. 베기마다 제 걸음·제 운동 사슬 곡선. 모캡 실측 아님',
    summary: s1,
    summary2: s2,
    flow,
    ...extra,
    joints: JOINTS,
    bones: BONES,
    data: toColumns(toJSONFrames(rows)),
  };
  writeFileSync(join(OUT, 'clips', `${name}.json`), JSON.stringify(clip));
  indexEntries.push({ id: name, cut: clip.cut, base: clip.base, nameKo: clip.nameKo, nameDe: clip.nameDe, family: clip.family, desc: clip.desc, side, size: 'large', file: `${name}.json`, summary: s1, flow, ...extra });
}

if (!PRINT) {
  // clips/index.json 에 흐름 항목을 끼워 넣는다 (같은 cut 은 바꿔 끼움). build_clips.mjs 는 흐름 항목을 지키고 다시 쓴다
  const ip = join(OUT, 'clips', 'index.json');
  const ix = JSON.parse(readFileSync(ip, 'utf8'));
  ix.clips = ix.clips.filter((c) => c.cut !== 'flow_zornhau8').concat(indexEntries);
  writeFileSync(ip, JSON.stringify(ix, null, 1));
  writeFileSync(join(OUT, 'flow_table.md'), flowTable(table));
  console.log(`흐름 클립 ${indexEntries.length}개 → docs/motion/clips, 표 → docs/motion/flow_table.md`);
  if (!report([validateFile(ip)], { quiet: true })) process.exit(1); // 검사 (clip_format.md §6)
}

function flowTable(list) {
  const L = [];
  L.push('# 흐름(이어 베기) 기준 동작 — 숫자 (자동 생성)');
  L.push('');
  L.push('> `node tools/motion/build_flow.mjs` 가 만든다. 8자 흐름 = 오른쪽 분노의 베기(크게)의 지나가기가 서지 않고 왼쪽 분노의 베기 감기가 된다.');
  L.push('> 키는 크게 Zornhau 와 그 거울 + 이음 키 둘 [추정]. 모캡 실측이 아니다. 사람 값은 참고이지 한도가 아니다.');
  L.push('');
  L.push('| | 오른쪽 → 왼쪽 | 왼쪽 → 오른쪽 |');
  L.push('|---|---|---|');
  const R = (f) => list.map(f).join(' | ');
  L.push(`| 첫 베기 칼이 겨눈 선 → 둘째 베기 겨눈 선 | ${R((x) => `${x.flow.contactGap} s`)} |`);
  L.push(`| 칼끝 최고 (첫 / 둘째) | ${R((x) => `${x.s1.tipPeak} / ${x.s2.tipPeak} m/s`)} |`);
  L.push(`| 두 겨눈 선 사이 칼끝 가장 느릴 때 | ${R((x) => `${x.flow.tipMin.v} m/s (첫 최고의 ${Math.round(x.flow.tipMin.ofPeak1 * 100)}%) · 첫 겨눈 선 +${x.flow.tipMin.t} s`)} |`);
  L.push(`| 두 겨눈 선 사이 손 가장 느릴 때 | ${R((x) => `${x.flow.handMin.v} m/s · +${x.flow.handMin.t} s`)} |`);
  L.push(`| 칼 돌림 가장 느릴 때 (월드 칼 방향 각속도) | ${R((x) => `${x.flow.bladeRateMin.v} rad/s · +${x.flow.bladeRateMin.t} s`)} |`);
  L.push(`| 칼끝 가장 낮은 높이 (사이) | ${R((x) => `${x.flow.tipLow} m`)} |`);
  L.push(`| 손목(아래팔-칼) 각 최대 (사이) | ${R((x) => `${x.flow.wristMax}°`)} |`);
  L.push(`| 가슴이 가장 많이 돌아선 각 (사이) | ${R((x) => `${x.flow.chestTurn}°`)} |`);
  L.push(`| 몸통이 되감기를 끝낸 때 (둘째 감기 끝) | ${R((x) => `첫 겨눈 선 +${+(x.m2.tw - x.m1.tc).toFixed(2)} s`)} |`);
  L.push(`| 운동 사슬 (첫 / 둘째, 겨눈 선 기준 골반·가슴·손·칼끝 ms) | ${R((x) => [x.s1, x.s2].map((s) => s.sequence.filter((q) => ['골반', '가슴', '손', '칼끝'].includes(q.part)).map((q) => q.t).join('·')).join(' / '))} |`);
  L.push(`| 걸음 (베기마다 한 걸음: 첫 베기 칼 쪽 발, 둘째 반대 발) | ${R((x) => `골반 ${x.flow.pelvisAdvance} m 나아감 · 오른발 ${x.flow.stepR} m · 왼발 ${x.flow.stepL} m · 다리 넘침 ${x.flow.legOver}`)} |`);
  L.push('');
  return L.join('\n') + '\n';
}
