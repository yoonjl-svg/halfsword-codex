// ─────────────────────────────────────────────────────────────
//  동작 채점 (동작 연구 PM) — 기준 클립(stillness-motion-clip/2) 대비 기록(stillness-motion-record/1 또는 클립) 한 벌
//   import { score, SCORE_VERSION } from 'tools/motion/score.mjs'
//   score(ref, rec, opts?) → { format, ref, rec, align, terms: { hand, phase, order, blade, range }, weights, total }
//   node tools/motion/score.mjs <기준 클립.json> <기록.json> [--recStart=초]   → 점수 JSON
//
//  정의는 docs/motion/score.md (버전을 올리면 거기에 적는다). node 모듈을 쓰지 않아 브라우저에서도 돈다(명령줄 부분 빼고).
//  사람 값은 참고이지 한도가 아니다: 동작 범위는 모자란 것만 깎고, 기준보다 크거나 빠른 것은 깎지 않는다.
//  척도(SCALES)·무게(WEIGHTS)는 동작 연구 PM 의 제안이다 — 부르는 쪽이 opts 로 바꿀 수 있다.
// ─────────────────────────────────────────────────────────────
import { shapeMetrics } from './lib/shape_metrics.mjs';

export const SCORE_VERSION = 'stillness-motion-score/1';
/** 이만큼 어긋나면 그 항목 점수가 0.5 (점수 = 1 / (1 + (어긋남 / 척도)²)) */
export const SCALES = { hand: 0.08, phase: 40, blade: 20 };
export const WEIGHTS = { hand: 0.3, phase: 0.2, order: 0.15, blade: 0.2, range: 0.15 };
/** 동작 범위 항목 (lib/shape_metrics.mjs 와 같은 식으로 잰 값) — 기록 / 기준 비율이 1 이상이면 만점 */
const RANGE_KEYS = ['chestRange', 'pelvisRange', 'xMax', 'handPath', 'tipPath', 'cross'];

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const angDeg = (a, b) => (Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (len(a) * len(b) || 1)))) * 180) / Math.PI;
const soft = (e, s) => 1 / (1 + (e / s) ** 2);
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000);

/** 클립·기록 공통 읽기: 시각, 관절 자리(보간), 칼끝·손 빠르기 */
function reader(o) {
  const n = o.data.n;
  const t = o.data.cols.t;
  const J = o.data.cols.J;
  const nj = o.joints.length * 3;
  const idx = Object.fromEntries(o.joints.map((name, i) => [name, i * 3]));
  const at = (i, name) => {
    const k = i * nj + idx[name];
    return [J[k], J[k + 1], J[k + 2]];
  };
  // 시각 x 의 관절 자리 (이웃 표본 사이 곧게)
  const atT = (x, name) => {
    if (x <= t[0]) return at(0, name);
    if (x >= t[n - 1]) return at(n - 1, name);
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (t[m] <= x) lo = m;
      else hi = m;
    }
    const u = (x - t[lo]) / (t[hi] - t[lo] || 1);
    const a = at(lo, name), b = at(hi, name);
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
  };
  const speed = (name) =>
    Array.from({ length: n }, (_, i) => {
      const a = at(Math.max(0, i - 1), name), b = at(Math.min(n - 1, i + 1), name);
      return len(sub(b, a)) / (t[Math.min(n - 1, i + 1)] - t[Math.max(0, i - 1)] || 1);
    });
  return { n, t, at, atT, speed };
}

/**
 * 움직임 시작과 칼끝 최고 시각.
 *  시작: 기준 클립 = marks.t0 (자세에서 떠남), 게임 기록 = marks.swingStart (손가락이 자세에서 떠남, record_game.mjs),
 *        시험판 기록 = marks.cutStroke (베기 획을 건 때, record_wbs.mjs), 없으면 손 빠르기로 찾음(칼끝 최고 앞에서 손이 자기 최고의 20% 밑이던 마지막 때)
 *  칼끝 최고: 클립은 감기 끝(tw) 뒤에서 찾는다 — 감기 중 빠른 칼 돌림을 베기로 잡지 않게 (lib/shape_metrics.mjs 와 같다)
 */
function anchors(o, R, startOverride) {
  const tip = R.speed('tip');
  const hand = R.speed('hS');
  let start = startOverride ?? o.marks?.t0 ?? o.marks?.swingStart ?? o.marks?.cutStroke ?? null;
  const from = o.marks?.tw ?? start ?? R.t[0];
  let iTip = -1;
  for (let i = 0; i < R.n; i++) if (R.t[i] >= from - 1e-9 && (iTip < 0 || tip[i] > tip[iTip])) iTip = i;
  if (start == null) {
    const hp = Math.max(...hand.slice(0, iTip + 1));
    let k = iTip;
    while (k > 0 && hand[k] > 0.2 * hp) k--;
    start = R.t[k];
  }
  // 칼끝 최고의 반너비: 최고의 50% 넘는 이어진 구간 (s)
  let lo = iTip, hi = iTip;
  while (lo > 0 && tip[lo - 1] >= 0.5 * tip[iTip]) lo--;
  while (hi < R.n - 1 && tip[hi + 1] >= 0.5 * tip[iTip]) hi++;
  return { start, tipPeak: R.t[iTip], tipPeakValue: tip[iTip], halfWidth: R.t[hi] - R.t[lo] };
}

/**
 * 채점. ref = 기준 클립(clip/2), rec = 기록(record/1) 또는 다른 클립. 둘 다 같은 23 관절 J (clip_format.md §3·§5).
 * opts: { recStart, align: 'width' | 'start', timeScale, refWindow: [a, b] (기준 시각, 기본 tw → tf), scales, weights }
 */
export function score(ref, rec, opts = {}) {
  const S = { ...SCALES, ...opts.scales };
  const W = { ...WEIGHTS, ...opts.weights };
  const A = reader(ref), B = reader(rec);
  const a = anchors(ref, A, null), b = anchors(rec, B, opts.recStart);
  // 시간 맞춤: 칼끝 최고끼리 맞추고, 시간 배율 = 칼끝 빠르기 봉우리 반너비의 비 (기록 / 기준).
  //  '움직임 시작' 표시는 기록마다 뜻이 달라(게임 기술은 감기 자세에서 시작하기도 한다) 배율에 쓰지 않는다. opts.align = 'start' 면 (시작, 최고) 두 점으로
  const k = opts.timeScale ?? (opts.align === 'start' ? (b.tipPeak - b.start) / (a.tipPeak - a.start || 1) : b.halfWidth / (a.halfWidth || 1));
  const toRec = (x) => b.tipPeak + (x - a.tipPeak) * k;
  const [w0, w1] = opts.refWindow ?? [ref.marks?.tw ?? a.start, ref.marks?.tf ?? A.t[A.n - 1]];
  // 1) 손 오차: 가슴 가운데에서 본 앞손 자리 (땅 틀 축 = 바라보는 틀) — 기준 창의 표본마다
  let se = 0, emax = 0, cnt = 0;
  // 4) 칼 방향: 자루 끝 → 칼끝 방향 사이 각
  let bsum = 0;
  for (let i = 0; i < A.n; i++) {
    const x = A.t[i];
    if (x < w0 - 1e-9 || x > w1 + 1e-9) continue;
    const y = toRec(x);
    if (y < B.t[0] - 1e-9 || y > B.t[B.n - 1] + 1e-9) continue;
    const hr = sub(A.at(i, 'hS'), A.at(i, 'chest'));
    const hb = sub(B.atT(y, 'hS'), B.atT(y, 'chest'));
    const e = len(sub(hr, hb));
    se += e * e;
    emax = Math.max(emax, e);
    bsum += angDeg(sub(A.at(i, 'tip'), A.at(i, 'pommel')), sub(B.atT(y, 'tip'), B.atT(y, 'pommel')));
    cnt++;
  }
  const rms = cnt ? Math.sqrt(se / cnt) : null;
  const bladeMean = cnt ? bsum / cnt : null;
  const bladeAtPeak = angDeg(sub(A.atT(a.tipPeak, 'tip'), A.atT(a.tipPeak, 'pommel')), sub(B.atT(b.tipPeak, 'tip'), B.atT(b.tipPeak, 'pommel')));
  // 2·3·5) 사슬 시각·순서·동작 범위: lib/shape_metrics.mjs (compare.mjs 와 같은 식)
  const mA = shapeMetrics(ref), mB = shapeMetrics(rec);
  const parts = ['pelvis', 'chest', 'hand'];
  const dPhase = Object.fromEntries(parts.map((p) => [p, mB.seq[p] - mA.seq[p]]));
  const phaseMean = parts.reduce((s, p) => s + Math.abs(dPhase[p]), 0) / parts.length;
  const orderOf = (m) => [m.seq.pelvis, m.seq.chest, m.seq.hand, 0];
  const inv = (arr) => {
    let c = 0;
    for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) if (arr[i] > arr[j]) c++;
    return c;
  };
  // 순서는 기준과 같은 식(어깨선·엉덩이선)으로 잰 기준의 뒤바뀜 수보다 더 뒤바뀐 만큼만 깎는다 — 어깨띠가 앞으로 나가면 어깨선 돌림 최고가 늦게 잡혀 기준도 하나 뒤바뀌어 보일 수 있다
  const invA = inv(orderOf(mA)), invB = inv(orderOf(mB));
  const range = {};
  let rsum = 0;
  for (const key of RANGE_KEYS) {
    const r = mA[key], g = mB[key];
    // 지나가기 옆 거리(cross)는 − 가 더 멀리 넘어감 → 크기로 견준다
    const ratio = key === 'cross' ? (r < 0 ? Math.max(0, -g) / -r : null) : r > 0 ? g / r : null;
    range[key] = { ref: r, rec: g, ratio: r3(ratio) };
    rsum += ratio == null ? 1 : Math.min(1, Math.max(0, ratio));
  }
  const terms = {
    hand: { rms: r3(rms), max: r3(emax), samples: cnt, score: r3(rms == null ? 0 : soft(rms, S.hand)) },
    phase: { deltaMs: dPhase, meanAbsMs: Math.round(phaseMean), refSeq: mA.seq, recSeq: mB.seq, score: r3(soft(phaseMean, S.phase)) },
    order: { inversions: invB, refInversions: invA, ordered: invB === 0, score: r3(1 - Math.max(0, invB - invA) / 6) },
    blade: { meanDeg: r3(bladeMean), atTipPeakDeg: r3(bladeAtPeak), score: r3(bladeMean == null ? 0 : soft(bladeMean, S.blade)) },
    range: { items: range, score: r3(rsum / RANGE_KEYS.length) },
  };
  const wsum = Object.values(W).reduce((s, v) => s + v, 0);
  const total = Object.entries(W).reduce((s, [key, w]) => s + w * (terms[key].score ?? 0), 0) / (wsum || 1);
  return {
    format: SCORE_VERSION,
    ref: ref.id,
    rec: rec.id,
    align: { method: opts.timeScale != null ? 'given' : opts.align === 'start' ? 'start' : 'width', refTipPeak: r3(a.tipPeak), recTipPeak: r3(b.tipPeak), refHalfWidth: r3(a.halfWidth), recHalfWidth: r3(b.halfWidth), refStart: r3(a.start), recStart: r3(b.start), timeScale: r3(k), refWindow: [r3(w0), r3(w1)] },
    terms,
    scales: S,
    weights: W,
    total: r3(total),
  };
}

// 명령줄
const isMain = typeof process !== 'undefined' && process.argv?.[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const { readFileSync } = await import('node:fs');
  const args = process.argv.slice(2);
  const files = args.filter((x) => !x.startsWith('--'));
  const opt = args.find((x) => x.startsWith('--recStart='));
  if (files.length !== 2) {
    console.error('쓰는 법: node tools/motion/score.mjs <기준 클립.json> <기록.json> [--recStart=초]');
    process.exit(2);
  }
  const [ref, rec] = files.map((f) => JSON.parse(readFileSync(f, 'utf8')));
  console.log(JSON.stringify(score(ref, rec, opt ? { recStart: +opt.split('=')[1] } : {}), null, 1));
}
