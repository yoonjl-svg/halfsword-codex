// ─────────────────────────────────────────────────────────────
//  관절 위치만으로 재는 동작 모양 (동작 연구 PM) — 기준 클립과 게임 기록을 같은 식으로 잰다
//   가슴 돌림 = 어깨선(shS − shO) 방향, 골반 돌림 = 엉덩이선(hipR − hipL) 방향 (오른손잡이). + = 칼 쪽으로 감음
//   "칼끝 최고"(베기 시작 표시 뒤) 앞뒤 0.35 s 를 베기 창으로 본다
//   지나가기 옆 거리 = 가슴 가운데 기준 머리 방향 틀 (디렉터 mx.mjs 와 같은 식, 재설계 §2-6 목표 −0.35 m)
// ─────────────────────────────────────────────────────────────
import { JOINTS } from './body.mjs';

const R2D = 180 / Math.PI;
const IDX = Object.fromEntries(JOINTS.map((n, i) => [n, i * 3]));

export function shapeMetrics(rec) {
  const n = rec.data.n;
  const nj = rec.joints.length * 3;
  const J = rec.data.cols.J;
  const t = rec.data.cols.t;
  const dt = (t[n - 1] - t[0]) / (n - 1);
  const idx = Object.fromEntries(rec.joints.map((name, i) => [name, i * 3]));
  const P = (i, name) => {
    const o = i * nj + idx[name];
    return [J[o], J[o + 1], J[o + 2]];
  };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  // 돌림각 (펼쳐서 이어 붙임)
  const yawOf = (v) => Math.atan2(-v[0], v[2]) * R2D;
  const unwrap = (a) => {
    const o = [a[0]];
    for (let i = 1; i < a.length; i++) {
      let x = a[i];
      while (x - o[i - 1] > 180) x -= 360;
      while (x - o[i - 1] < -180) x += 360;
      o.push(x);
    }
    return o;
  };
  const chestYaw = unwrap(Array.from({ length: n }, (_, i) => yawOf(sub(P(i, 'shS'), P(i, 'shO')))));
  const pelvisYaw = unwrap(Array.from({ length: n }, (_, i) => yawOf(sub(P(i, 'hipR'), P(i, 'hipL')))));
  const speed = (name) =>
    Array.from({ length: n }, (_, i) => {
      const a = P(Math.max(0, i - 1), name), b = P(Math.min(n - 1, i + 1), name);
      return len(sub(b, a)) / ((Math.min(n - 1, i + 1) - Math.max(0, i - 1)) * dt);
    });
  const rate = (arr) => arr.map((_, i) => (arr[Math.min(n - 1, i + 1)] - arr[Math.max(0, i - 1)]) / ((Math.min(n - 1, i + 1) - Math.max(0, i - 1)) * dt));
  const tip = speed('tip');
  const hand = speed('hS');
  // 칼끝 최고는 베기가 시작된 뒤에서만 찾는다 (감기 중 빠른 칼 돌림을 베기로 잡지 않게):
  //  기준 클립 = 감기 끝(tw), 지금 게임 기록 = 휘두르기 시작, 시험판 기록 = 베기 획 시작
  const from = rec.marks?.tw ?? rec.marks?.swingStart ?? rec.marks?.cutStroke ?? t[0];
  let iTip = 0;
  for (let i = 0; i < n; i++) if (t[i] >= from - 1e-9 && (tip[i] > tip[iTip] || t[iTip] < from - 1e-9)) iTip = i;
  const lo = Math.max(0, iTip - Math.round(0.35 / dt)), hi = Math.min(n - 1, iTip + Math.round(0.35 / dt));
  const win = (arr) => arr.slice(lo, hi + 1);
  // 베기 방향: 창 안에서 가슴이 도는 쪽
  const sg = Math.sign(chestYaw[hi] - chestYaw[lo]) || -1;
  const wC = rate(chestYaw), wP = rate(pelvisYaw);
  const peakT = (arr, signed) => {
    let best = lo;
    for (let i = lo; i <= hi; i++) if ((signed ? sg * arr[i] : arr[i]) > (signed ? sg * arr[best] : arr[best])) best = i;
    return Math.round((t[best] - t[iTip]) * 1000);
  };
  let handTop = -Infinity, handBack = -Infinity, tipBack = -Infinity, cross = Infinity, handPath = 0, tipPath = 0, step = 0;
  const a0 = P(0, 'ankleR'), b0 = P(0, 'ankleL');
  for (let i = 0; i < n; i++) {
    const hS = P(i, 'hS'), head = P(i, 'head'), C = P(i, 'chest'), hip = P(i, 'hipC'), tp = P(i, 'tip');
    handTop = Math.max(handTop, hS[1] - (head[1] + 0.1));
    const y = chestYaw[i] / R2D;
    const f = [Math.cos(y), 0, Math.sin(y)]; // 가슴 앞쪽 (돌림 부호: + 면 칼 쪽을 향함)
    handBack = Math.max(handBack, -((hS[0] - C[0]) * f[0] + (hS[2] - C[2]) * f[2] - 0.11));
    tipBack = Math.max(tipBack, C[0] - tp[0]);
    // 지나가기: 가슴 가운데 기준, 머리 방향 틀 옆 좌표 (디렉터 mx.mjs hand_side_min 과 같은 식). 칼끝 최고 뒤에서 가장 멀리 넘어간 값
    const side = hS[2] - C[2];
    if (i >= iTip) cross = Math.min(cross, sg < 0 ? side : -side);
    if (i > 0 && i >= lo && i <= hi) {
      handPath += len(sub(hS, P(i - 1, 'hS')));
      tipPath += len(sub(tp, P(i - 1, 'tip')));
    }
    step = Math.max(step, len(sub(P(i, 'ankleR'), a0)), len(sub(P(i, 'ankleL'), b0)));
  }
  const range = (arr) => Math.max(...arr) - Math.min(...arr);
  const xf = chestYaw.map((c, i) => c - pelvisYaw[i]);
  return {
    tipPeak: +tip[iTip].toFixed(1),
    handPeak: +Math.max(...win(hand)).toFixed(1),
    seq: { pelvis: peakT(wP, true), chest: peakT(wC, true), hand: peakT(hand, false) }, // 칼끝 최고 기준 ms
    pelvisPeakRate: Math.round(Math.max(...win(wP).map((x) => sg * x))),
    chestPeakRate: Math.round(Math.max(...win(wC).map((x) => sg * x))),
    handTop: +handTop.toFixed(2),
    handBack: +handBack.toFixed(2),
    tipBack: +tipBack.toFixed(2),
    chestRange: Math.round(range(chestYaw)),
    pelvisRange: Math.round(range(pelvisYaw)),
    xMax: Math.round(Math.max(...xf.map(Math.abs))),
    cross: +cross.toFixed(2),
    handPath: +handPath.toFixed(2),
    tipPath: +tipPath.toFixed(2),
    step: +step.toFixed(2),
  };
}
