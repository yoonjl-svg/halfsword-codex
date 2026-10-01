// ─────────────────────────────────────────────────────────────
//  한손 무기 크게 벌 v0 (동작 연구 PM) — 세이버 moulinet 4무리 [저작 · 제안]
//   node tools/motion/build_onehand.mjs          → docs/motion/clips/sabre/<베기>_<쪽>_large.json + index.json,
//                                                   docs/motion/clips/rapier/lunge_thrust_<쪽>_large.json + index.json, docs/motion/onehand_table.md
//   node tools/motion/build_onehand.mjs --print  → 숫자만 (파일 안 씀)
//
//  사람 기준(docs/motion/weapon_body.md §2):
//   - 한손 칼은 어깨·팔꿈치가 칼끝 빠르기 대부분을 낸다(테니스 포핸드: 위팔 수평 굽힘 45~48%, 팔꿈치 폄 17~21% [검색 요약]).
//     몸통은 준비·풀기 앞쪽에서 힘을 싣고 칼끝 최고 때는 거의 선다(야구 던지기 [검색 요약]) → 몸통 돌림 작게, 운동 사슬 늦춤 크게.
//   - moulinet: 칼을 오른 어깨 뒤로 원을 그리며 넘기고(손은 오른 어깨 가까이, 팔꿈치는 몸 안쪽) 뒤에서 돌아 나와 벤다
//     [검색 요약: 19세기 브로드소드·세이버 교본]. 크게 벌은 팔꿈치·어깨로 큰 원, 겨눈 선에서 팔을 뻗는다.
//   - 옆으로 선 몸(칼 든 어깨 앞)은 게임 한손 자세표(guards.js ONE_HAND)를 그대로 시작·끝으로 쓴다. 빈손은 왼 허리에 두고
//     칼 팔과 반대로 조금 흔든다(균형) [추정].
//   - 시간: 롱소드 크게 벌의 0.8배 — 앞손 둘레 관성 0.66배의 √ = 0.81, 같은 힘으로 휘두름 (weapon_body.md §1). 무기별 배율 목표는 쓰지 않는다(사장님 Q26).
//  키 표는 lib/cuts.mjs 와 같은 꼴: [t, 표시, 골반 돌림, 낮춤, 가슴 돌림(골반 기준), 숙임, 옆굽힘, 손 앞, 위, 칼 쪽(가슴 틀), 칼 각(베는 면)]
//   베는 면·걸음은 롱소드 같은 무리 것을 쓴다(걸음 시각은 표시에 맞춰 옮김).
// ─────────────────────────────────────────────────────────────
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CUTS, rows, GAME_GUARDS_ONE, STANCE } from './lib/cuts.mjs';
import { SOURCES } from './lib/sources.mjs';
import { toKeys, marksOf, mirror, clipExtras, chainWithProfiles } from './lib/sets.mjs';
import { sampleClip, measure, summarize, toJSONFrames, toColumns, stepOf, stanceOf, HZ } from './lib/clip.mjs';
import { JOINTS, BONES } from './lib/body.mjs';
import { weaponGeom, gripField } from './lib/weapons.mjs';
import { validateFile, report } from './validate_clip.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const PRINT = args.includes('--print');

const SABRE = weaponGeom('sabre');
const RAPIER = weaponGeom('rapier');
// 롱소드 런지 숫자 (표에서 나란히 보려고 — build_lunge.mjs 가 만든 목록 항목)
const LS_LUNGE = (() => {
  try {
    return JSON.parse(readFileSync(join(ROOT, 'docs', 'motion', 'clips', 'index.json'), 'utf8')).clips.find((c) => c.id === 'lunge_thrust_right_large');
  } catch {
    return null;
  }
})();
const LS = weaponGeom('longsword');

/** 제안 값과 근거 (롱소드 크게 벌 대비) */
export const PROPOSAL = {
  time: 0.8,
  chain: { lead: 1.0, dur: 0.8 },
  freeHand: { rest: [-0.02, -0.31, -0.23], swing: 0.07 },
  basis: {
    time: '시간 0.8배: 앞손 둘레 관성 0.179 / 0.272 = 0.66배의 √ = 0.81 — 같은 힘으로 휘두름 (한손이라 몸통이 덜 보태니 힘을 더 얹지 않음)',
    trunk: '몸통 돌림 작게(자세에서 감기까지 가슴 약 25°, 롱소드 크게 약 60°): 한손 칼은 어깨·팔꿈치가 대부분을 낸다(테니스·세이버 [검색 요약])',
    chain: '운동 사슬: 골반·가슴 앞섬은 롱소드와 같은 130·90 ms, 돌림 곡선은 0.8배로 짧게 — 몸통이 일찍 힘을 싣고 칼끝 최고 때는 거의 선다(야구 던지기: 놓는 순간 몸 돌림 몫 10% 아래 [검색 요약])',
    arm: '겨눈 선에서 칼 팔을 어깨에서 0.52~0.54 m 로 뻗는다(게임 팔 0.565 m) — 한손 칼은 팔을 뻗어 닿는 거리를 번다(게임 한손 뻗기 R2 와 같은 방향)',
    freeHand: '빈손: 왼 허리(가슴 틀 [−0.02, −0.31, −0.23] m), 칼 팔과 반대로 앞뒤 0.07 m 흔듦 — 감기 때 앞으로, 베고 지나갈 때 뒤로 [추정]',
  },
};

// 표시 시각 (0.025 s = 3 표본 단위): 롱소드 크게 0 · 0.36 · 0.55 · 0.65 · 0.95 · 1.5 의 약 0.8배
const M = { t0: 0, tw: 0.3, tr: 0.45, tc: 0.525, tf: 0.775, tg: 1.2 };

const TABLES = {
  // 1. 사선 내려베기 (세이버 1번 베기): 손을 오른 어깨·귀 옆으로 들며 칼을 어깨 뒤로 넘기고(moulinet), 어깨 위로 돌아 나와 상대 왼쪽 목으로.
  //    칼이 풀기(tr) 때 이미 위로 서 있고, 팔이 겨눈 선을 지나서도 계속 쓸고 간다 — 손목 채찍보다 팔 휘두름 (한손 칼 사람 기준)
  zornhau: [
    [0, 'G:pflug', 't0'],
    [0.1, null, -2, 0.075, -14, 3, 2, 0.3, 0.12, 0.26, -95],
    [M.tw, 'tw', 4, 0.08, -4, -2, 4, 0.06, 0.28, 0.27, -205],
    [0.375, null, 0, 0.085, -8, 0, 3, 0.18, 0.32, 0.27, -165],
    [M.tr, 'tr', -5, 0.09, -16, 4, 1, 0.36, 0.26, 0.24, -95],
    [0.5, null, -9, 0.095, -22, 7, 0, 0.47, 0.17, 0.2, -40],
    [M.tc, 'tc', -12, 0.1, -26, 9, -2, 0.51, 0.1, 0.16, 0],
    [0.575, null, -15, 0.105, -28, 11, -3, 0.5, -0.03, 0.06, 40],
    [0.65, null, -18, 0.11, -30, 12, -4, 0.45, -0.14, -0.03, 80],
    [M.tf, 'tf', -20, 0.11, -32, 12, -4, 0.36, -0.2, -0.06, 120],
    [0.95, null, -12, 0.09, -24, 8, -2, 0.4, -0.14, 0.06, null],
    [M.tg, 'G:pflug', 'tg'],
  ],
  // 2. 세로 내려베기 (머리 베기): 손을 머리 위로, 칼은 머리 뒤로 늘어졌다가 팔을 앞으로 뻗으며 정수리로
  oberhau: [
    [0, 'G:pflug', 't0'],
    [0.1, null, -3, 0.075, -16, 2, 0, 0.28, 0.2, 0.2, -90],
    [M.tw, 'tw', 2, 0.08, -8, -4, 0, 0.1, 0.45, 0.16, -210],
    [0.375, null, -1, 0.085, -12, -1, 0, 0.22, 0.46, 0.16, -168],
    [M.tr, 'tr', -5, 0.09, -18, 5, 0, 0.38, 0.36, 0.16, -95],
    [0.5, null, -8, 0.1, -22, 9, 0, 0.48, 0.24, 0.16, -40],
    [M.tc, 'tc', -10, 0.11, -24, 11, 0, 0.52, 0.14, 0.16, 0],
    [0.575, null, -12, 0.12, -25, 13, 0, 0.51, 0.0, 0.15, 30],
    [0.65, null, -14, 0.125, -26, 15, 0, 0.47, -0.12, 0.13, 45],
    [M.tf, 'tf', -15, 0.13, -26, 16, 0, 0.43, -0.2, 0.1, 55],
    [0.95, null, -10, 0.1, -24, 10, 0, 0.42, -0.14, 0.12, null],
    [M.tg, 'G:pflug', 'tg'],
  ],
  // 3. 가로베기 (가슴 높이): 칼을 오른쪽 뒤로 눕혀 원을 그리고, 팔을 뻗으며 가로로 지나 왼쪽으로
  mittelhau: [
    [0, 'G:pflug', 't0'],
    [0.1, null, -2, 0.075, -14, 2, 1, 0.3, 0.06, 0.3, -90],
    [M.tw, 'tw', 4, 0.08, -4, 1, 3, 0.12, 0.12, 0.34, -170],
    [0.375, null, 1, 0.085, -9, 2, 2, 0.22, 0.11, 0.35, -135],
    [M.tr, 'tr', -5, 0.09, -17, 4, 1, 0.38, 0.1, 0.3, -80],
    [0.5, null, -9, 0.095, -23, 5, 0, 0.48, 0.08, 0.22, -35],
    [M.tc, 'tc', -12, 0.1, -27, 6, -1, 0.52, 0.07, 0.14, 0],
    [0.575, null, -15, 0.1, -30, 6, -2, 0.5, 0.07, 0.02, 40],
    [0.65, null, -18, 0.1, -32, 6, -3, 0.43, 0.08, -0.1, 80],
    [M.tf, 'tf', -20, 0.1, -34, 5, -4, 0.32, 0.1, -0.2, 120],
    [0.95, null, -12, 0.09, -26, 5, -2, 0.36, -0.05, 0.02, null],
    [M.tg, 'G:pflug', 'tg'],
  ],
  // 4. 사선 올려베기: 칼을 오른 허리 뒤 아래로 원을 그려 내렸다가, 팔을 뻗으며 상대 왼팔·옆구리로 올려
  unterhau: [
    [0, 'G:pflug', 't0'],
    [0.1, null, -2, 0.08, -14, 5, 2, 0.3, -0.2, 0.26, -120],
    [M.tw, 'tw', 4, 0.09, -4, 8, 4, 0.14, -0.3, 0.3, -165],
    [0.375, null, 1, 0.09, -9, 7, 3, 0.24, -0.3, 0.28, -130],
    [M.tr, 'tr', -5, 0.09, -17, 5, 2, 0.38, -0.2, 0.25, -80],
    [0.5, null, -9, 0.09, -23, 4, 0, 0.47, -0.1, 0.19, -35],
    [M.tc, 'tc', -12, 0.09, -27, 3, -1, 0.52, -0.02, 0.14, 0],
    [0.575, null, -15, 0.085, -29, 1, -2, 0.5, 0.1, 0.07, 40],
    [0.65, null, -18, 0.08, -31, -1, -3, 0.44, 0.22, 0.01, 80],
    [M.tf, 'tf', -20, 0.08, -32, -2, -4, 0.34, 0.33, -0.03, 120],
    [0.95, null, -12, 0.08, -24, 2, -2, 0.4, 0.02, 0.08, null],
    [M.tg, 'G:pflug', 'tg'],
  ],
};
const NAMES = {
  zornhau: { nameKo: '사선 내려베기 (세이버)', desc: '오른 어깨 뒤로 칼을 원을 그려 넘겼다가(moulinet) 팔을 뻗으며 상대 왼쪽 목으로 사선으로 내려벤다. 몸은 옆으로 선 채 조금만 돈다.' },
  oberhau: { nameKo: '머리 베기 (세이버)', desc: '칼을 머리 뒤로 넘겼다가 팔을 앞으로 뻗으며 정수리로 곧게 내려벤다.' },
  mittelhau: { nameKo: '가로베기 (세이버)', desc: '칼을 오른쪽 뒤로 눕혀 원을 그렸다가 팔을 뻗으며 가슴 높이로 가로로 벤다.' },
  unterhau: { nameKo: '올려베기 (세이버)', desc: '칼을 오른 허리 뒤 아래로 원을 그려 내렸다가 팔을 뻗으며 사선으로 올려벤다.' },
};

/** 빈손(가슴 틀): 왼 허리에 두고, 가슴이 자세에서 칼 쪽으로 감긴 만큼 앞으로, 앞으로 돈 만큼 뒤로 흔든다 */
function freeHand(key, start) {
  const { rest, swing } = PROPOSAL.freeHand;
  const turn = key.p[0] + key.c[0] - (start.p[0] + start.c[0]); // 가슴 월드 돌림 − 자세 값 (도)
  const s = Math.max(-1, Math.min(1, turn / 25));
  return [rest[0] + swing * s, rest[1], rest[2]];
}

/** 롱소드 같은 무리의 크게 걸음을 세이버 표시로 옮김 */
function stepsFor(cut) {
  const mL = marksOf(cut.large);
  const pts = ['t0', 'tw', 'tr', 'tc', 'tf', 'tg'];
  const tmap = (t) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = mL[pts[i]], b = mL[pts[i + 1]];
      if (t <= b + 1e-9) return +(M[pts[i]] + ((M[pts[i + 1]] - M[pts[i]]) * (t - a)) / (b - a)).toFixed(4);
    }
    return M.tg;
  };
  return cut.large.steps.map((s) => ({ ...s, t: tmap(s.t) }));
}

function sabreSet(id) {
  const cut = CUTS.find((c) => c.id === id);
  const keys = rows(TABLES[id], cut.plane, GAME_GUARDS_ONE);
  for (const k of keys) k.h2 = freeHand(k, keys[0]);
  const q = cut.large.chain.seq;
  const chain = { ...cut.large.chain, ramp: cut.large.chain.ramp * PROPOSAL.time, seq: { pelvis: q.pelvis * PROPOSAL.chain.lead, chest: q.chest * PROPOSAL.chain.lead, dur: q.dur * PROPOSAL.chain.dur } };
  return { cut, set: { keys, steps: stepsFor(cut), chain } };
}

function build(set, sword, guards) {
  const marks = marksOf(set);
  const chain = chainWithProfiles(set, marks, { peak2After: 0.1 * PROPOSAL.time });
  const { frames } = sampleClip({ keys: toKeys(set), marks, chain, sword, ground: 0.05 }, 1);
  const rows_ = measure(frames, marks);
  return { marks, rows: rows_, summary: summarize(rows_, marks), extra: clipExtras(set, rows_, marks, guards) };
}

const OUT = join(ROOT, 'docs', 'motion', 'clips', 'sabre');
const index = [];
const table = [];
if (!PRINT) mkdirSync(OUT, { recursive: true });
for (const id of Object.keys(TABLES)) {
  const { cut, set } = sabreSet(id);
  const lsLarge = build(cut.large, LS, undefined);
  for (const side of ['right', 'left']) {
    const s0 = side === 'left' ? mirror(set, GAME_GUARDS_ONE) : set;
    const b = build(s0, SABRE, GAME_GUARDS_ONE);
    const s = b.summary;
    const name = `${id}_${side}_large`;
    console.log(
      `sabre ${name.padEnd(22)} 칼끝 ${String(s.tipPeak).padStart(5)} m/s (선 ${s.tipAtLine}) 손 ${s.handPeak} | 가슴 ${s.range.chestYaw}° 골반 ${s.range.pelvisYaw}° | 몸통 ${s.shareAtTipPeak.trunk} 팔 ${s.shareAtTipPeak.arm} 손목 ${s.shareAtTipPeak.wrist} (롱소드 몸통 ${lsLarge.summary.shareAtTipPeak.trunk}) | ${s.ordered ? '순서 OK' : '순서 뒤섞임'} | 넘침 팔 ${s.checks.reachOver} | 손목 ${s.checks.wristMax}° | 칼끝 최저 ${s.checks.tipMin} | 팔꿈치 ${s.keyPoses.tw.elbowS}→${s.keyPoses.tc.elbowS}°`,
    );
    if (side === 'right') table.push({ id, nameKo: NAMES[id].nameKo, cutKo: cut.nameKo, ls: lsLarge.summary, sa: s });
    if (PRINT) continue;
    const clip = {
      format: 'stillness-motion-clip/2',
      id: name,
      cut: id,
      nameKo: NAMES[id].nameKo,
      nameDe: cut.nameDe,
      family: cut.family,
      desc: NAMES[id].desc,
      side,
      size: 'large',
      hz: HZ,
      weapon: 'sabre',
      handedness: 'right',
      grip: gripField('sabre'),
      units: 'm, 도(°), 초, rad/s(w), m/s(speed)',
      frame: '롱소드 클립과 같다 (clip_format.md §2). handO = 빈손(칼자루를 잡지 않음)',
      marks: Object.fromEntries(Object.entries(b.marks).map(([k, v]) => [k, +v.toFixed(4)])),
      phiMarks: { t0: -1, tw: 0, tr: 0.55, tc: 0.85, tf: 1.6, tg: 2.2 },
      proposal: PROPOSAL,
      sources: ['meyer_dussack', 'moulinet_manuals', 'tennis_upper_limb', 'fencing_review', 'baseball_sequence', 'game_weapons', 'estimate'].map((sid) => ({ id: sid, ...SOURCES[sid] })),
      provenance: '세이버 크게 벌 v0: 사람 기준(한손 칼은 어깨·팔꿈치, moulinet 원)으로 저작한 키 [추정 포함] — 시작·끝은 게임 한손 자세표, 모캡 실측 아님',
      summary: s,
      ...b.extra,
      joints: JOINTS,
      bones: BONES,
      data: toColumns(toJSONFrames(b.rows)),
    };
    writeFileSync(join(OUT, `${name}.json`), JSON.stringify(clip));
    index.push({ id: name, cut: id, weapon: 'sabre', nameKo: clip.nameKo, nameDe: clip.nameDe, family: clip.family, desc: clip.desc, side, size: 'large', file: `${name}.json`, summary: s, ...b.extra });
  }
}
// ─────────────────────────────────────────────────────────────
//  레이피어 큰 공격 v0 = 런지 찌르기 (build_lunge.mjs 의 롱소드 런지와 같은 걸음·낮춤, 한손 자세표 쟁기에서)
//   손 먼저(앞발 뜨기 약 0.07 s 앞 [Gholipour 외 2008 본문: 숙련자 0.07±0.05 s, 저자는 "거의 함께"로 읽음]) · 칼끝이 겨눈 선 = 앞발 딛기 · 가장 낮음은 딛은 뒤 [lunge_flow.md §1]
//   한손이라 칼 든 어깨를 더 앞으로 내밀고(가슴 −30° → 게임 한손 긴 자세 −45° 쪽으로) 팔을 다 뻗는다.
//   빈손: 가슴 앞에 들어 막는 손(레이피어 교본 도판의 빈손 자리 [기억]) — 런지 때 조금 올라가며 물러난다 [추정]
// ─────────────────────────────────────────────────────────────
const STEP = 0.5, DROP = 0.22, g0 = 0.07;
// 골반은 롱소드 런지처럼 칼 쪽으로 조금(+8°) — 옆으로 선 모양은 가슴이 낸다(가슴 월드 약 −35°). 골반까지 칼 쪽을 앞으로 틀면
//  뒷다리가 길어져 다리 넘침 0.03~0.04 m (검사 R2 0.02 m 넘음)
const RAPIER_TABLE = [
  [0, 'G:pflug', 't0'],
  [0.03, 'tw', -4, g0, -21, 5, 0, 0.35, -0.17, 0.27, null],
  [0.11, 'tr', 0, g0 + 0.01, -28, 7, 0, 0.47, -0.05, 0.22, 8],
  [0.2, null, 4, g0 + DROP * 0.45, -35, 11, 0, 0.55, 0.03, 0.18, 3],
  [0.3, 'tc', 7, g0 + DROP * 0.85, -41, 15, 0, 0.59, 0.08, 0.15, 0],
  [0.37, 'tf', 8, g0 + DROP, -43, 18, 0, 0.6, 0.06, 0.15, 0],
  [0.5, null, 8, g0 + DROP * 0.95, -42, 16, 0, 0.57, 0.02, 0.16, 3],
  [0.75, null, 3, g0 + DROP * 0.4, -31, 9, 0, 0.45, -0.1, 0.23, 12],
  [0.95, 'G:pflug', 'tg'],
];
const L0 = STANCE.L, R0 = STANCE.R;
const LUNGE_STEPS = [
  { t: 0, feet: { L: [...L0], R: [...R0] }, px: 0 },
  { t: 0.09, feet: { L: [...L0], R: [...R0] }, px: 0.02 },
  { t: 0.13, feet: { L: [L0[0] + 0.03, L0[1], L0[2], 0.3, 0.03], R: [...R0] }, px: 0.07 },
  { t: 0.2, feet: { L: [L0[0] + STEP * 0.5, L0[1], L0[2], 0.15, 0.07], R: [...R0] }, px: 0.22 },
  { t: 0.31, feet: { L: [L0[0] + STEP, L0[1], L0[2], 0, 0], R: [R0[0], R0[1], R0[2] - 5, 0, 0] }, px: 0.38 },
  { t: 0.37, feet: { L: [L0[0] + STEP, L0[1], L0[2], 0, 0], R: [R0[0], R0[1], R0[2] - 5, 0, 0] }, px: 0.41 },
  { t: 0.55, feet: { L: [L0[0] + STEP, L0[1], L0[2], 0.4, 0], R: [R0[0], R0[1], R0[2], 0, 0] }, px: 0.38 },
  { t: 0.68, feet: { L: [L0[0] + STEP * 0.5, L0[1], L0[2], 0.15, 0.06], R: [...R0] }, px: 0.2 },
  { t: 0.82, feet: { L: [...L0], R: [...R0] }, px: 0.03 },
  { t: 0.95, feet: { L: [...L0], R: [...R0] }, px: 0 },
];
const PARRY_HAND = { rest: [0.18, 0.02, -0.1], lunge: [0.12, 0.1, -0.15] };
function rapierSet() {
  const keys = rows(RAPIER_TABLE, { f: [1, -0.03, 0], c: [0, 1, 0] }, GAME_GUARDS_ONE);
  for (const k of keys) {
    const u = Math.max(0, Math.min(1, (k.p[1] - g0) / DROP)); // 낮아진 만큼 빈손이 올라가며 물러남
    k.h2 = PARRY_HAND.rest.map((v, j) => v + (PARRY_HAND.lunge[j] - v) * u);
  }
  return { keys, steps: LUNGE_STEPS, chain: { arm: 0, sword: 0, ramp: 0.1 } };
}
const OUT_R = join(ROOT, 'docs', 'motion', 'clips', 'rapier');
const indexR = [];
const lungeRows = [];
if (!PRINT) mkdirSync(OUT_R, { recursive: true });
for (const side of ['right', 'left']) {
  const set = side === 'left' ? mirror(rapierSet(), GAME_GUARDS_ONE) : rapierSet();
  const b = build(set, RAPIER, GAME_GUARDS_ONE);
  const s = b.summary;
  const front = side === 'left' ? 'R' : 'L';
  const ank = (r) => r.J.legs[front].ankle;
  const handPk = Math.max(...b.rows.map((r) => r.sp.hand));
  const handGo = b.rows.find((r) => r.sp.hand > 0.2 * handPk);
  const lift = b.rows.find((r) => ank(r)[1] > ank(b.rows[0])[1] + 0.01);
  const land = lift && b.rows.find((r) => r.t > lift.t + 0.05 && ank(r)[1] <= ank(b.rows[0])[1] + 0.003);
  const low = b.rows.reduce((a, r) => (r.J.hipC[1] < a.J.hipC[1] ? r : a), b.rows[0]);
  const atTf = b.rows.find((r) => r.t >= b.marks.tf - 1e-9);
  const reachTip = +(atTf.J.tip[0] - b.rows[0].J.tip[0]).toFixed(2);
  const lunge = {
    handFirst: handGo && lift ? Math.round((lift.t - handGo.t) * 1000) : null,
    footLand: land ? +(land.t - b.marks.tc).toFixed(3) : null,
    pelvisDrop: +(b.rows[0].J.hipC[1] - low.J.hipC[1]).toFixed(3),
    tipForward: reachTip,
    tipAtLine: s.tipAtLine,
    legOver: s.checks.legOver,
  };
  b.extra.stance = stanceOf(b.rows);
  b.extra.step = stepOf(b.rows.filter((r) => r.t <= b.marks.tf + 1e-9), b.marks);
  const name = `lunge_thrust_${side}_large`;
  console.log(`rapier ${name}: 손 먼저 ${lunge.handFirst} ms · 앞발 딛기 ${lunge.footLand} s · 골반 ${lunge.pelvisDrop} m 낮아짐 · 칼끝이 앞으로 ${reachTip} m · 칼끝 최고 ${s.tipPeak} m/s (선 ${s.tipAtLine}) · 넘침 팔 ${s.checks.reachOver} 다리 ${s.checks.legOver}`);
  if (side === 'right') lungeRows.push({ s, lunge });
  if (PRINT) continue;
  const clip = {
    format: 'stillness-motion-clip/2',
    id: name,
    cut: 'lunge_thrust',
    nameKo: '런지 찌르기 (레이피어)',
    nameDe: 'Stoccata',
    family: '찌르기 · 런지',
    desc: '한손 쟁기 자세에서 팔을 먼저 뻗고, 앞발을 0.5 m 내디디며 가슴을 찌른다. 칼 든 어깨를 더 앞으로 내밀어 닿는 거리를 벌고, 빈손은 가슴 앞에서 막는다.',
    side,
    size: 'large',
    hz: HZ,
    weapon: 'rapier',
    handedness: 'right',
    grip: gripField('rapier'),
    units: 'm, 도(°), 초, rad/s(w), m/s(speed)',
    frame: '롱소드 클립과 같다 (clip_format.md §2). handO = 빈손(가슴 앞 막는 손)',
    marks: Object.fromEntries(Object.entries(b.marks).map(([k, v]) => [k, +v.toFixed(4)])),
    phiMarks: { t0: -1, tw: 0, tr: 0.55, tc: 0.85, tf: 1.6, tg: 2.2 },
    phiNote: '런지: tw = 팔이 움직이기 시작, tr = 앞발 뜸, tc = 칼끝이 겨눈 선(앞발 딛기 직전), tf = 가장 낮음, tg = 쟁기 자세로 돌아옴 (롱소드 런지와 같다)',
    lunge,
    sources: ['fencing_review', 'fencing_lunge', 'fencing_gholipour', 'fencing_mulloy', 'game_weapons', 'estimate'].map((sid) => ({ id: sid, ...SOURCES[sid] })),
    provenance: '레이피어 런지 v0: 롱소드 런지(lunge_flow.md §1)와 같은 걸음·낮춤을 한손 자세표에서 — 팔을 다 뻗고 어깨를 더 내밈 [추정 포함], 모캡 실측 아님',
    summary: s,
    ...b.extra,
    joints: JOINTS,
    bones: BONES,
    data: toColumns(toJSONFrames(b.rows)),
  };
  writeFileSync(join(OUT_R, `${name}.json`), JSON.stringify(clip));
  indexR.push({ id: name, cut: 'lunge_thrust', weapon: 'rapier', nameKo: clip.nameKo, nameDe: clip.nameDe, family: clip.family, desc: clip.desc, side, size: 'large', file: `${name}.json`, summary: s, lunge, ...b.extra });
}
if (!PRINT) {
  const ipR = join(OUT_R, 'index.json');
  writeFileSync(ipR, JSON.stringify({ format: 'stillness-motion-index/1', weapon: 'rapier', generated: new Date().toISOString().slice(0, 10), grip: gripField('rapier'), clips: indexR }, null, 1));
  if (!report([validateFile(ipR)], { quiet: true })) process.exit(1);
}

if (!PRINT) {
  const ip = join(OUT, 'index.json');
  writeFileSync(ip, JSON.stringify({ format: 'stillness-motion-index/1', weapon: 'sabre', generated: new Date().toISOString().slice(0, 10), grip: gripField('sabre'), proposal: PROPOSAL, clips: index }, null, 1));
  writeFileSync(join(ROOT, 'docs', 'motion', 'onehand_table.md'), oneTable(table));
  console.log(`\n세이버 클립 ${index.length}개 → docs/motion/clips/sabre, 표 → docs/motion/onehand_table.md`);
  if (!report([validateFile(ip)], { quiet: true })) process.exit(1); // 검사 (clip_format.md §6)
}

function oneTable(list) {
  const f = (a, b) => `${a} → **${b}**`;
  const pct = (v) => `${Math.round(v * 100)}%`;
  const L = [];
  L.push('# 한손 무기 크게 벌 v0 — 세이버 moulinet · 레이피어 런지 (자동 생성)');
  L.push('');
  L.push('> `node tools/motion/build_onehand.mjs` 가 만든다. 손으로 고치지 말 것. 오른쪽에서 베기만 적는다(왼쪽은 거울, 빈손은 왼쪽 그대로).');
  L.push('> 사람 기준으로 저작한 v0 — 모캡 실측이 아니다. 값은 제안이고 사람 값은 참고이지 한도가 아니다. 시작·끝은 게임 한손 자세표(src/guards.js ONE_HAND 쟁기).');
  L.push(`> 칼 치수(게임 스펙): 세이버 칼끝 ${SABRE.tip} m · ${SABRE.mass} kg · 앞손 둘레 관성 ${SABRE.inertia} kg·m², 레이피어 ${RAPIER.tip} m · ${RAPIER.mass} kg · ${RAPIER.inertia} (롱소드 ${LS.tip} m · ${LS.mass} kg · ${LS.inertia}).`);
  L.push('');
  L.push('## 1. 제안과 근거');
  L.push('');
  L.push('| 무엇 | 값 | 근거 |');
  L.push('|---|---|---|');
  L.push(`| 시간 | 롱소드 크게 × ${PROPOSAL.time} (감기 ${M.tw} · 겨눈 선 ${M.tc} · 지나가기 끝 ${M.tf} · 복귀 ${M.tg} s) | ${PROPOSAL.basis.time} |`);
  L.push(`| 몸통 | 감기 때 가슴 약 25° 만 칼 쪽으로 | ${PROPOSAL.basis.trunk} |`);
  L.push(`| 운동 사슬 | 앞섬 × ${PROPOSAL.chain.lead} · 곡선 × ${PROPOSAL.chain.dur} | ${PROPOSAL.basis.chain} |`);
  L.push(`| 팔 | 겨눈 선에서 뻗음 | ${PROPOSAL.basis.arm} |`);
  L.push(`| 빈손 | 왼 허리 · 흔듦 ±${PROPOSAL.freeHand.swing} m | ${PROPOSAL.basis.freeHand} |`);
  L.push('');
  L.push('## 2. 롱소드 크게 벌과 나란히 (같은 무리, 오른쪽)');
  L.push('');
  L.push('| 무리 | 칼끝 최고 m/s | 칼끝 (겨눈 선) m/s | 손 최고 m/s | 칼끝 빠르기 중 몸통 · 팔 · 손목 몫 | 가슴 회전 범위° | 골반 회전 범위° | 칼 팔 팔꿈치 (감기 끝 → 겨눈 선)° | 앞이 빈 시간 s | 순서 |');
  L.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const x of list) {
    const a = x.ls, b = x.sa;
    L.push(`| ${x.nameKo} (롱소드 ${x.cutKo}) | ${f(a.tipPeak, b.tipPeak)} | ${f(a.tipAtLine, b.tipAtLine)} | ${f(a.handPeak, b.handPeak)} | ${pct(a.shareAtTipPeak.trunk)}·${pct(a.shareAtTipPeak.arm)}·${pct(a.shareAtTipPeak.wrist)} → **${pct(b.shareAtTipPeak.trunk)}·${pct(b.shareAtTipPeak.arm)}·${pct(b.shareAtTipPeak.wrist)}** | ${f(a.range.chestYaw, b.range.chestYaw)} | ${f(a.range.pelvisYaw, b.range.pelvisYaw)} | ${a.keyPoses.tw.elbowS}→${a.keyPoses.tc.elbowS} → **${b.keyPoses.tw.elbowS}→${b.keyPoses.tc.elbowS}** | ${f(a.opening.openTime, b.opening.openTime)} | ${b.ordered ? '골반→가슴→손→칼끝' : '뒤섞임'} |`);
  }
  L.push('');
  L.push('## 3. 레이피어 런지 찌르기 (롱소드 런지와 나란히, 오른쪽)');
  L.push('');
  L.push('롱소드 런지(`lunge_table.md`)와 같은 걸음(앞발 0.5 m)·낮춤(0.22 m)을 한손 쟁기 자세에서. 골반은 롱소드처럼 칼 쪽으로 조금만(+8°) 틀고, 옆으로 선 모양은 가슴이 낸다(가슴 월드 약 −35°) — 골반까지 틀면 뒷다리가 0.03~0.04 m 모자랐다. 빈손은 가슴 앞에서 막는 손(런지 때 조금 올라가며 물러남) [추정].');
  L.push('');
  L.push('| | 롱소드 런지 | 레이피어 런지 |');
  L.push('|---|---|---|');
  const lsL = LS_LUNGE?.lunge ?? {}, lsS = LS_LUNGE?.summary ?? {};
  const rp = lungeRows[0] ?? { lunge: {}, s: {} };
  L.push(`| 손이 먼저 (손 움직임 → 앞발 뜸) | ${lsL.handFirst} ms | ${rp.lunge.handFirst} ms |`);
  L.push(`| 칼끝이 겨눈 선 → 앞발 딛기 | ${lsL.footLand} s | ${rp.lunge.footLand} s |`);
  L.push(`| 골반이 가장 낮아진 양 | ${lsL.pelvisDrop} m | ${rp.lunge.pelvisDrop} m |`);
  L.push(`| 칼끝이 앞으로 간 거리 (가장 낮을 때, 시작 대비) | — | ${rp.lunge.tipForward} m |`);
  L.push(`| 칼끝 최고 (겨눈 선에서) | ${lsS.tipPeak} m/s (${lsS.tipAtLine}) | ${rp.s.tipPeak} m/s (${rp.s.tipAtLine}) |`);
  L.push(`| 다리 넘침 | ${lsL.legOver} m | ${rp.lunge.legOver} m |`);
  L.push('');
  L.push('## 4. 한계');
  L.push('');
  L.push('- moulinet 교본 본문을 못 읽었다(네트워크 정책) — 모양은 검색 요약으로 잡았다. 빈손 자리·흔듦은 추정.');
  L.push('- **손목 몫이 크다(칼끝 최고 때 63~79%)** — 이 측정은 칼이 아래팔에 대해 도는 몫을 모두 손목으로 센다(사람 연구의 관절 기여와 정의가 다르다). 같은 측정으로 롱소드 크게 벌도 43~66% 다. 세이버는 그보다 조금 크고, 사람 한손 휘두르기(테니스: 손목 약 15~20%, 어깨·팔꿈치가 대부분 [검색 요약])와는 바로 견줄 수 없다. 팔 호를 키워 보니(풀기 때 손을 더 높이, 겨눈 선에서 팔을 다 뻗음) 칼끝이 43 m/s 로 너무 빨라지고 손목 몫은 오히려 91% 가 됐다 — 다음 차례에 팔꿈치·어깨 원과 칼 늦춤을 같이 다시 저작한다.');
  L.push('- 레이피어는 런지 찌르기 하나만(좌우). 사람 레이피어는 칼 쪽 발(오른발)이 앞이지만 게임 자세가 왼발 앞이라 앞발(왼발) 런지다 — 오른발을 내딛는 패서타(passata)는 다음 차례.');
  L.push('- 발은 게임 자세(왼발 앞)에서 롱소드처럼 오른발을 내딛는다. 세이버 교본의 칼 쪽 발 앞 자세는 게임 자세와 달라 쓰지 않았다.');
  L.push('');
  return L.join('\n');
}
