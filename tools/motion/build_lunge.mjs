// ─────────────────────────────────────────────────────────────
//  런지 찌르기 기준 동작 (동작 연구 PM) — 사람 기준(docs/motion/lunge_flow.md §1)을 막대 인형으로
//   node tools/motion/build_lunge.mjs           → docs/motion/clips/lunge_thrust_<right|left>_large.json + index.json 에 끼움 + docs/motion/lunge_table.md
//   node tools/motion/build_lunge.mjs --print   → 숫자만
//
//  롱소드, 쟁기 자세(왼발 앞)에서 앞발을 내디디며 가슴을 찌른다.
//   손(칼 든 팔)이 먼저: 앞발 뜨기 0.07 s 앞 [Gholipour 외 2008 본문: 숙련자 팔꿈치가 무릎보다 0.07±0.05 s 먼저 — 저자는 "거의 함께"로 읽음]
//   칼끝이 겨눈 선에 닿는 때 = 앞발 딛기 직전 [지도서]
//   끝 자세: 앞 정강이 거의 수직, 뒷다리 거의 곧게, 몸통 앞기울기 약 18° [검색 요약: ISBS 17.5°]
//   가장 낮은 때 = 앞발 딛은 뒤 앞무릎이 받을 때 (+0.06 s) [추정]
//   그다음 앞다리로 밀어 쟁기 자세로 돌아온다(앞발을 끌어들임)
//  몸 낮춤은 두 발 사이 거리로 정해진다(lunge_flow.md §1-2): 앞발 0.5 m 내디디면 두 발 사이 1.03 m → 골반 약 0.2 m 낮아짐
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rows, STANCE } from './lib/cuts.mjs';
import { SOURCES } from './lib/sources.mjs';
import { toKeys, marksOf, mirror, clipExtras } from './lib/sets.mjs';
import { sampleClip, measure, summarize, toJSONFrames, toColumns, stepOf, stanceOf, HZ } from './lib/clip.mjs';
import { JOINTS, BONES } from './lib/body.mjs';
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
const STEP = arg('step', 0.5); // 앞발을 내딛는 거리 (m)
const DROP = arg('drop', 0.22); // 쟁기 자세에서 더 낮아지는 골반 (m) — 두 발 사이 1.04 m 에서 뒷다리가 곧게 닿는 깊이 (lunge_flow.md 표 약 0.21 m)

// 찌르는 면: 앞(상대 가슴 쪽)이 겨눈 선(0°), 위가 + (쟁기 자세의 칼끝은 약 25° 위 — 상대 얼굴)
const plane = { f: [1, -0.03, 0], c: [0, 1, 0] };
const g0 = 0.07; // 쟁기 자세 골반 낮춤 (게임 자세표 pflug)
// [t, 표시, 골반 돌림, 낮춤, 가슴 돌림(골반 기준), 숙임, 옆굽힘, 손 x, y, z (가슴 틀), 칼 각]
const table = [
  [0, 'G:pflug', 't0'],
  [0.03, 'tw', 12, g0, 12, 5, 0, 0.33, -0.29, 0.02, null], // 손이 움직이기 시작 (찌르기 시작)
  [0.11, 'tr', 12, g0 + 0.01, 10, 7, 0, 0.44, -0.14, 0.02, 10], // 앞발이 뜨기 직전 — 손은 이미 앞·위로 (손 먼저)
  [0.2, null, 10, g0 + DROP * 0.45, 8, 11, 0, 0.5, -0.04, 0.02, 4],
  [0.3, 'tc', 8, g0 + DROP * 0.85, 6, 15, 0, 0.53, 0.02, 0.02, 0], // 칼끝이 겨눈 선 (앞발 딛기 직전)
  [0.37, 'tf', 8, g0 + DROP, 6, 18, 0, 0.54, 0.0, 0.02, 0], // 가장 낮음 (앞무릎이 받음)
  [0.5, null, 8, g0 + DROP * 0.95, 6, 16, 0, 0.51, -0.05, 0.02, 3], // 뻗은 채 — 이때가 빈틈
  [0.75, null, 11, g0 + DROP * 0.4, 10, 9, 0, 0.4, -0.2, 0.02, 15], // 앞다리로 밀어 돌아옴
  [0.95, 'G:pflug', 'tg'],
];
const L0 = STANCE.L, R0 = STANCE.R;
const steps = [
  { t: 0, feet: { L: [...L0], R: [...R0] }, px: 0 },
  { t: 0.09, feet: { L: [...L0], R: [...R0] }, px: 0.02 }, // 앞발은 아직 땅에 (손이 먼저 간다)
  { t: 0.13, feet: { L: [L0[0] + 0.03, L0[1], L0[2], 0.3, 0.03], R: [...R0] }, px: 0.07 }, // 뒷다리가 밀고 앞발이 뜸
  { t: 0.2, feet: { L: [L0[0] + STEP * 0.5, L0[1], L0[2], 0.15, 0.07], R: [...R0] }, px: 0.22 },
  { t: 0.31, feet: { L: [L0[0] + STEP, L0[1], L0[2], 0, 0], R: [R0[0], R0[1], R0[2] - 5, 0, 0] }, px: 0.38 }, // 앞발 딛음
  { t: 0.37, feet: { L: [L0[0] + STEP, L0[1], L0[2], 0, 0], R: [R0[0], R0[1], R0[2] - 5, 0, 0] }, px: 0.41 },
  { t: 0.55, feet: { L: [L0[0] + STEP, L0[1], L0[2], 0.4, 0], R: [R0[0], R0[1], R0[2], 0, 0] }, px: 0.38 }, // 앞다리로 밀기 시작
  { t: 0.68, feet: { L: [L0[0] + STEP * 0.5, L0[1], L0[2], 0.15, 0.06], R: [...R0] }, px: 0.2 },
  { t: 0.82, feet: { L: [...L0], R: [...R0] }, px: 0.03 },
  { t: 0.95, feet: { L: [...L0], R: [...R0] }, px: 0 },
];
const SRC = ['fencing_review', 'fencing_lunge', 'fencing_gholipour', 'fencing_mulloy', 'estimate'];
const DESC = '쟁기 자세에서 팔을 먼저 뻗고, 앞발을 0.5 m 내디디며 가슴을 찌른다. 뒷다리를 곧게 펴 몸이 낮아지고, 앞다리로 밀어 돌아온다.';

function build(sideName) {
  let set = { keys: rows(table, plane), steps, chain: { arm: 0, sword: 0, ramp: 0.1 } };
  if (sideName === 'left') set = mirror(set);
  const marks = marksOf(set);
  const def = { keys: toKeys(set), marks, chain: set.chain };
  const { frames } = sampleClip(def, 1);
  const rws = measure(frames, marks);
  const s = summarize(rws, marks);
  // 런지 숫자: 손 먼저 시간차, 골반이 가장 낮은 때·양, 칼끝 닿음 ↔ 앞발 딛기, 끝 자세 두 발 사이
  const front = sideName === 'left' ? 'R' : 'L';
  const ank = (r) => r.J.legs[front].ankle;
  const hip0 = rws[0].J.hipC[1];
  const handPk = Math.max(...rws.map((r) => r.sp.hand));
  const handGo = rws.find((r) => r.sp.hand > 0.2 * handPk);
  const lift = rws.find((r) => ank(r)[1] > ank(rws[0])[1] + 0.01);
  const land = lift && rws.find((r) => r.t > lift.t + 0.05 && ank(r)[1] <= ank(rws[0])[1] + 0.003);
  const low = rws.reduce((a, r) => (r.J.hipC[1] < a.J.hipC[1] ? r : a), rws[0]);
  const at = (t) => rws.find((r) => r.t >= t - 1e-9);
  const back = sideName === 'left' ? 'L' : 'R';
  const stanceAt = (r) => Math.hypot(r.J.legs.L.ankle[0] - r.J.legs.R.ankle[0], r.J.legs.L.ankle[2] - r.J.legs.R.ankle[2]);
  const kneeAng = (r, k) => {
    const g = r.J.legs[k];
    const a = [g.hip[0] - g.knee[0], g.hip[1] - g.knee[1], g.hip[2] - g.knee[2]], b = [g.ankle[0] - g.knee[0], g.ankle[1] - g.knee[1], g.ankle[2] - g.knee[2]];
    return (Math.acos((a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b))) * 180) / Math.PI;
  };
  const lunge = {
    handFirst: handGo && lift ? Math.round((lift.t - handGo.t) * 1000) : null, // ms, + = 손이 먼저
    footLand: land ? +(land.t - marks.tc).toFixed(3) : null, // 앞발 딛기 − 칼끝이 겨눈 선
    pelvisDrop: +(hip0 - low.J.hipC[1]).toFixed(3), // 쟁기 자세에서 가장 낮아진 양 (m)
    lowAfterLand: land ? +(low.t - land.t).toFixed(3) : null,
    stanceEnd: +stanceAt(at(marks.tf)).toFixed(2),
    kneeFront: Math.round(kneeAng(at(marks.tf), front)),
    kneeBack: Math.round(kneeAng(at(marks.tf), back)),
    lean: Math.round(at(marks.tf).ang.lean), // 몸 숙임 합 (골반 + 가슴) °
    advance: +(at(marks.tf).J.hipC[0] - rws[0].J.hipC[0]).toFixed(2),
    tipAtLine: s.tipAtLine,
    legOver: s.checks.legOver,
  };
  // clip/2 필드: 걸음은 앞발을 내디딘 것(가장 낮은 때까지) — 끝에는 제자리로 돌아오므로
  const extra = clipExtras(set, rws, marks);
  extra.stance = stanceOf(rws);
  extra.step = stepOf(rws.filter((r) => r.t <= marks.tf + 1e-9), marks);
  return { rows: rws, marks, s, lunge, extra };
}

const indexEntries = [];
const out = [];
for (const side of ['right', 'left']) {
  const { rows: rws, marks, s, lunge, extra } = build(side);
  const name = `lunge_thrust_${side}_large`;
  console.log(`${name}: 손 먼저 ${lunge.handFirst} ms · 칼끝 겨눈 선 ${marks.tc} s, 앞발 딛기 ${lunge.footLand >= 0 ? '+' : ''}${lunge.footLand} s · 골반 ${lunge.pelvisDrop} m 낮아짐 (딛은 뒤 +${lunge.lowAfterLand} s) · 두 발 사이 ${lunge.stanceEnd} m · 앞무릎 ${lunge.kneeFront}° 뒷무릎 ${lunge.kneeBack}° · 숙임 ${lunge.lean}° · 골반 ${lunge.advance} m 나감 · 칼끝 최고 ${s.tipPeak} m/s (선 ${s.tipAtLine}) · 다리 넘침 ${lunge.legOver} · 팔 넘침 ${s.checks.reachOver}`);
  out.push({ side, marks, s, lunge });
  if (PRINT) continue;
  const clip = {
    format: 'stillness-motion-clip/2',
    id: name,
    cut: 'lunge_thrust',
    nameKo: '런지 찌르기',
    nameDe: 'Stoß mit Ausfall',
    family: '찌르기 · 런지',
    desc: DESC,
    side,
    size: 'large',
    hz: HZ,
    weapon: 'longsword',
    handedness: 'right',
    grip: gripField('longsword'), // 칼 치수 (앞손에서 칼 축 m) — src/weapons.js 에서 읽음
    units: 'm, 도(°), 초, rad/s(w), m/s(speed)',
    frame: '베기 클립과 같다 (clip_format.md §2)',
    marks,
    phiMarks: { t0: -1, tw: 0, tr: 0.55, tc: 0.85, tf: 1.6, tg: 2.2 },
    phiNote: '런지: tw = 팔이 움직이기 시작, tr = 앞발 뜸, tc = 칼끝이 겨눈 선(앞발 딛기 직전), tf = 가장 낮음, tg = 쟁기 자세로 돌아옴',
    sources: SRC.map((id) => ({ id, ...SOURCES[id] })),
    provenance: '사람 런지 순서·끝 자세(lunge_flow.md §1, 검색 요약·지도서)로 저작 [추정 포함]. 모캡 실측 아님',
    summary: s,
    lunge,
    ...extra,
    joints: JOINTS,
    bones: BONES,
    data: toColumns(toJSONFrames(rws)),
  };
  writeFileSync(join(OUT, 'clips', `${name}.json`), JSON.stringify(clip));
  indexEntries.push({ id: name, cut: clip.cut, nameKo: clip.nameKo, nameDe: clip.nameDe, family: clip.family, desc: clip.desc, side, size: 'large', file: `${name}.json`, summary: s, lunge, ...extra });
}

if (!PRINT) {
  const ip = join(OUT, 'clips', 'index.json');
  const ix = JSON.parse(readFileSync(ip, 'utf8'));
  ix.clips = ix.clips.filter((c) => c.cut !== 'lunge_thrust').concat(indexEntries);
  writeFileSync(ip, JSON.stringify(ix, null, 1));
  const L = [];
  L.push('# 런지 찌르기 기준 동작 — 숫자 (자동 생성)');
  L.push('');
  L.push('> `node tools/motion/build_lunge.mjs` 가 만든다. 사람 기준은 [`lunge_flow.md`](lunge_flow.md) §1. 모캡 실측이 아니다. 사람 값은 참고이지 한도가 아니다.');
  L.push('');
  L.push('| | 오른손잡이 (왼발 앞) | 거울 (오른발 앞) |');
  L.push('|---|---|---|');
  const R = (f) => out.map(f).join(' | ');
  L.push(`| 손이 먼저 (손 움직임 시작 → 앞발 뜸) | ${R((x) => `${x.lunge.handFirst} ms`)} |`);
  L.push(`| 칼끝이 겨눈 선 → 앞발 딛기 | ${R((x) => `${x.lunge.footLand >= 0 ? '+' : ''}${x.lunge.footLand} s`)} |`);
  L.push(`| 골반이 가장 낮아진 양 (쟁기 자세에서) | ${R((x) => `${x.lunge.pelvisDrop} m`)} |`);
  L.push(`| 가장 낮은 때 (앞발 딛은 뒤) | ${R((x) => `+${x.lunge.lowAfterLand} s`)} |`);
  L.push(`| 끝 자세 두 발 사이 · 앞무릎 · 뒷무릎 | ${R((x) => `${x.lunge.stanceEnd} m · ${x.lunge.kneeFront}° · ${x.lunge.kneeBack}°`)} |`);
  L.push(`| 가장 낮을 때 몸 숙임 (골반 + 가슴) | ${R((x) => `${x.lunge.lean}°`)} |`);
  L.push(`| 골반이 앞으로 나간 거리 | ${R((x) => `${x.lunge.advance} m`)} |`);
  L.push(`| 칼끝 최고 (겨눈 선에서) | ${R((x) => `${x.s.tipPeak} m/s (${x.s.tipAtLine})`)} |`);
  L.push(`| 복귀 (가장 낮음 → 쟁기 자세) | ${R((x) => `${+(x.marks.tg - x.marks.tf).toFixed(2)} s`)} |`);
  L.push('');
  writeFileSync(join(OUT, 'lunge_table.md'), L.join('\n') + '\n');
  console.log(`런지 클립 ${indexEntries.length}개 → docs/motion/clips, 표 → docs/motion/lunge_table.md`);
  if (!report([validateFile(ip)], { quiet: true })) process.exit(1); // 검사 (clip_format.md §6)
}
