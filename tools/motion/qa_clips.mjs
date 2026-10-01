// ─────────────────────────────────────────────────────────────
//  기준 클립 겹침 검사 (동작 연구 PM)
//   node tools/motion/qa_clips.mjs   → 칼이 몸(머리·몸통·다리)을 지나가는지, 아래팔이 몸통 안으로 들어가는지
//   node tools/motion/qa_clips.mjs docs/motion/clips/zweihander/index.json   → 다른 목록
//  몸통 = 가슴 틀 타원 단면(앞 0.11 · 뒤 0.10 · 옆 0.16 m + 팔 두께 0.035, 엉덩이 위 ~ 어깨 바로 아래). 5~10% 는 몸에 닿는 정도
// ─────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const IX = process.argv[2] ? resolve(process.argv[2]) : join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'motion', 'clips', 'index.json');
const D = dirname(IX);
const ix = JSON.parse(readFileSync(IX, 'utf8'));
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(...a);
const norm = (a) => mul(a, 1 / len(a));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lerp = (a, b, u) => add(a, mul(sub(b, a), u));
// 선분 - 선분 최소 거리 (둘째가 점이면 점 - 선분)
function segSeg(p1, q1, p2, q2) {
  const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2);
  if (dot(d2, d2) < 1e-12) return len(sub(lerp(p1, q1, Math.min(1, Math.max(0, dot(sub(p2, p1), d1) / dot(d1, d1)))), p2));
  const a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r), c = dot(d1, r), b = dot(d1, d2), den = a * e - b * b;
  let s = den > 1e-12 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
  let t = (b * s + f) / e;
  if (t < 0) (t = 0), (s = Math.min(1, Math.max(0, -c / a)));
  else if (t > 1) (t = 1), (s = Math.min(1, Math.max(0, (b - c) / a)));
  return len(sub(add(p1, mul(d1, s)), add(p2, mul(d2, t))));
}
const R = { head: 0.11, torso: 0.14, thigh: 0.07, shin: 0.05 };
const rows = [];
for (const e of ix.clips) {
  if (e.size === 'small') continue; // 작게 = 게임 자세표 그대로
  const c = JSON.parse(readFileSync(join(D, e.file), 'utf8'));
  const nj = c.joints.length * 3, J = c.data.cols.J, t = c.data.cols.t;
  const I = Object.fromEntries(c.joints.map((n, i) => [n, i * 3]));
  const P = (i, n) => [J[i * nj + I[n]], J[i * nj + I[n] + 1], J[i * nj + I[n] + 2]];
  let blade = { v: Infinity }, arm = { d: 0 }, armDur = 0;
  for (let i = 0; i < c.data.n; i++) {
    const hS = P(i, 'hS'), tip = P(i, 'tip');
    const b0 = add(hS, mul(norm(sub(tip, hS)), 0.12));
    for (const [k, v] of [
      ['머리', segSeg(b0, tip, P(i, 'head'), P(i, 'head')) - R.head],
      ['몸통', segSeg(b0, tip, P(i, 'hipC'), P(i, 'neck')) - R.torso],
      ['왼다리', Math.min(segSeg(b0, tip, P(i, 'hipL'), P(i, 'kneeL')) - R.thigh, segSeg(b0, tip, P(i, 'kneeL'), P(i, 'ankleL')) - R.shin)],
      ['오른다리', Math.min(segSeg(b0, tip, P(i, 'hipR'), P(i, 'kneeR')) - R.thigh, segSeg(b0, tip, P(i, 'kneeR'), P(i, 'ankleR')) - R.shin)],
    ])
      if (v < blade.v) blade = { v, k, t: t[i] };
    const C = P(i, 'chest');
    const z = norm(sub(P(i, 'shS'), P(i, 'shO')));
    let y = sub(P(i, 'neck'), P(i, 'hipC'));
    y = norm(sub(y, mul(z, dot(y, z))));
    const x = cross(y, z);
    const yHip = dot(sub(P(i, 'hipC'), C), y), yTop = dot(sub(P(i, 'neck'), C), y) - 0.08;
    let inside = false;
    for (const [el, h, who] of [['elS', 'hS', '칼 든 팔'], ['elO', 'hO', '빈 팔']])
      for (let u = 0.2; u <= 0.81; u += 0.15) {
        const p = sub(lerp(P(i, el), P(i, h), u), C);
        const lx = dot(p, x), ly = dot(p, y), lz = dot(p, z);
        if (ly < yHip || ly > yTop) continue;
        const k = (lx / (lx >= 0 ? 0.145 : 0.135)) ** 2 + (lz / 0.195) ** 2;
        const d = 1 - Math.sqrt(k);
        if (d > 0.1) inside = true; // 10% 넘게 들어가야 "안으로" (그 아래는 몸에 닿음)
        if (d > arm.d) arm = { d, who, t: t[i] };
      }
    if (inside) armDur += 1 / c.hz;
  }
  rows.push([e.id, blade, arm, armDur]);
}
console.log('| 클립 | 칼과 몸 가장 가까움 | 아래팔이 몸통 안 (10% 넘게) |');
console.log('|---|---|---|');
for (const [id, b, a, dur] of rows)
  console.log(`| ${id} | ${b.v < 0 ? '**겹침** ' : ''}${b.k} ${b.v.toFixed(2)} m (${b.t.toFixed(2)} s) | ${dur > 0 ? `${dur.toFixed(2)} s, 가장 깊이 ${Math.round(a.d * 100)}% (${a.who} ${a.t.toFixed(2)} s)` : '없음'} |`);
