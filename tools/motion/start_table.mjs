// ─────────────────────────────────────────────────────────────
//  시작 자세 표 (동작 연구 PM) — 무리마다 어느 게임 자세(src/guards.js)에서 시작하면 작게·보통·크게가 자연스러운가
//   node tools/motion/start_table.mjs   → docs/motion/start_poses.md
//
//  사장님 Q3(9/29): 싣기(S)는 (1) 시작 자세가 이미 가진 팔·칼의 호 길이와 (2) 손가락 긋기의 길이·빠르기로 정해진다.
//  그래서 자세마다 "그 무리의 베는 면에서 칼이 겨눈 선 뒤로 얼마나 감겨 있나"(칼 호)와 "손이 겨눈 선 자리까지 얼마나 가나"(손 길)를 잰다.
//   칼 호 = 베는 면(lib/cuts.mjs plane) 안의 칼 방향 각을 겨눈 선(0°)에서 베는 쪽 반대로 잰 것. 클수록 감겨 있다(크게 벌 감기 끝 ≈ 205~215°).
//   면 밖 = 칼 방향 중 베는 면에 수직인 몫(0 = 면 안, 1 = 수직). 크면 먼저 칼을 면으로 돌려야 한다.
//   손 길 = 자세 손 자리 → 그 무리 크게 벌 겨눈 선 때 손 자리 (가슴 가운데 원점, 바라보는 틀) m.
//  나누기(제안): 그 자세에서 닿을 수 있는 크기 — 크게까지 = 칼 호 ≥ 160° · 보통까지 = 110~160° · 작게 = 20~110° ·
//   20° 밑은 "먼저 감아야", 그 무리가 끝나는 쪽이면 "지난 쪽", 면 밖 0.6 넘으면 "면 밖". 기준 클립 감기 끝 칼 호(§2)를 보고 정한 제안 — 한도가 아니다.
// ─────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CUTS } from './lib/cuts.mjs';
import { gameGuards } from './validate_clip.mjs';
import { GUARD_NAMES } from './lib/clip_rules.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const D = join(ROOT, 'docs', 'motion');
const G = gameGuards();
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.sqrt(dot(a, a));
const norm = (a) => a.map((v) => v / len(a));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const R2D = 180 / Math.PI;

/** 베는 면의 축: f = 겨눈 선, c = 베는 쪽(f 에 수직으로 맞춤), n = 면의 법선 */
function planeAxes(plane) {
  const f = norm(plane.f);
  const c = norm(sub(plane.c, f.map((v) => v * dot(plane.c, f))));
  return { f, c, n: cross(f, c) };
}
/**
 * 자세의 칼 호(°)와 면 밖 몫. th = 면 안 칼 각(− = 베는 쪽 반대 = 감긴 쪽, + = 베는 쪽 = 이미 지난 쪽).
 *  + 쪽이라도 손이 감는 쪽(−c)에 있고 칼이 뒤를 향하면(th > 90°) 등 뒤로 더 감긴 것(분노의 자세처럼) → 호 = 360 − th.
 *  그 밖의 + 쪽은 그 무리가 끝나는 쪽 — "지난 쪽"(먼저 감아야).
 */
function arcOf(dir, ax, hand) {
  const out = Math.abs(dot(dir, ax.n));
  const th = Math.atan2(dot(dir, ax.c), dot(dir, ax.f)) * R2D;
  if (th <= 0) return { arc: -th, past: false, out };
  const windSide = -dot(hand, ax.c) > 0.05;
  if (th > 90 && windSide) return { arc: 360 - th, past: false, out };
  return { arc: 0, past: true, th, out };
}
function clipAt(file, mark) {
  const c = JSON.parse(readFileSync(join(D, 'clips', file), 'utf8'));
  const n = c.data.n, t = c.data.cols.t;
  let i = 0;
  while (i < n - 1 && t[i] < c.marks[mark] - 1e-9) i++;
  const idx = (name) => (i * c.joints.length + c.joints.indexOf(name)) * 3;
  const J = c.data.cols.J;
  const p = (name) => [J[idx(name)], J[idx(name) + 1], J[idx(name) + 2]];
  return { hand: sub(p('hS'), p('chest')), dir: norm(sub(p('tip'), p('pommel'))) };
}
const size = (a) => (a.out > 0.6 ? '면 밖' : a.past ? '지난 쪽' : a.arc < 20 ? '먼저 감아야' : a.arc >= 160 ? '**크게**' : a.arc >= 110 ? '보통' : '작게');

const L = [];
L.push('# 시작 자세 — 무리마다 어느 게임 자세에서 작게·보통·크게가 자연스러운가 (자동 생성)');
L.push('');
L.push('> `node tools/motion/start_table.mjs` 가 만든다. 디렉터 요청(9/29, 사장님 Q3 "싣기 = 시작 자세의 호 + 손가락 긋기"). 자세 값은 게임 `src/guards.js` 그대로(두손 자세표).');
L.push('> **칼 호** = 그 무리의 베는 면에서 칼이 겨눈 선(0°) 뒤로 감겨 있는 각 — 클수록 휘두를 길이 길다. **손 길** = 자세 손 → 그 무리 크게 벌이 겨눈 선을 지날 때 손 자리(가슴 가운데 원점) m. **면 밖** = 칼이 베는 면에서 벗어난 몫(0 = 면 안).');
L.push('> 나누기(제안, 한도 아님) = 그 자세에서 손가락을 길고 빠르게 그으면 닿을 수 있는 크기: **크게까지** = 칼 호 160° 이상 · **보통까지** 110~160° · **작게** 20~110° · 20° 밑은 "먼저 감아야" · 그 무리가 끝나는 쪽 자세는 "지난 쪽" · 면 밖 0.6 넘으면 "면 밖". 기준 클립 감기 끝의 칼 호(§2)를 보고 정했다.');
L.push('');
// 1. 요약
L.push('## 1. 무리별 요약');
L.push('');
L.push('| 무리 | 크게까지 (칼 호°) | 보통까지 | 작게 | 쟁기(pflug)에서 바로 | 지붕(tag)에서 바로 | 지금 기준 클립 (작게 = 게임 기술 길의 감기 끝 자세 · 보통·크게 = 쟁기에서 감아 시작) |');
L.push('|---|---|---|---|---|---|---|');
const all = {};
for (const cut of CUTS) {
  const ax = planeAxes(cut.plane);
  const rows = Object.entries(G).map(([id, g]) => ({ id, a: arcOf(norm(g.dir), ax, g.hand), hand: len(sub(g.hand, clipAt(`${cut.id}_right_large.json`, 'tc').hand)) }));
  all[cut.id] = { rows, ax };
  const pick = (want) => rows.filter((r) => size(r.a) === want).sort((p, q) => q.a.arc - p.a.arc).map((r) => `${r.id} ${Math.round(r.a.arc)}`).join(', ') || '—';
  const smallTw = cut.small.keys.find((k) => k.tag === 'tw')?.guard;
  const one = (id) => {
    const r = rows.find((x) => x.id === id);
    if (r.a.out > 0.6) return `면 밖 (${r.a.out.toFixed(1)})`;
    if (r.a.past) return `지난 쪽 (선 너머 ${Math.round(r.a.th)}°)`;
    return `${size(r.a).replace(/\*/g, '')} ${Math.round(r.a.arc)}°`;
  };
  L.push(`| ${cut.nameKo} ${cut.nameDe} | ${pick('**크게**')} | ${pick('보통')} | ${pick('작게')} | ${one('pflug')} | ${one('tag')} | 작게 ${smallTw ?? '—'} · 보통·크게 pflug |`);
}
L.push('');
L.push('- **게임 자세표에는 "크게까지" 자세가 거의 없다.** 크게 벌 클립의 감기 끝(칼 호 160~225°)은 칼을 등 뒤로 늘어뜨린 분노의 자세(Zornhut)·깊은 옆 지킴 같은 자세인데, 게임 14 자세 가운데 그만큼 감긴 것은 드물다. 그래서 지금 크게는 자세에서 감기를 더 해야 나온다. 높은 자세에서 크게 긋게 하려면 그런 자세를 자세표에 더하는 방법이 있다(제안 — 디렉터·사장님 몫).');
L.push('- 쟁기(pflug)는 칼끝이 앞·위(상대 얼굴)를 겨눈 자세라 내려베기 무리에서 칼 호가 작다 — 쟁기에서 바로 그으면 작게, 크게 하려면 감기(지붕·어깨 지붕으로 들기)가 먼저 필요하다. 지금 크게 벌 클립이 쟁기에서 감아 올리는 까닭.');
L.push('- 가로 무리(Zwerchhau·Mittelhau)와 올려베기(Unterhau)는 옆 자세·바꿈·옆 지킴처럼 칼을 옆·아래로 눕힌 자세에서 호가 크다.');
L.push('- 왼쪽에서 베기는 거울 자세(tagR ↔ tagL, side ↔ sideL, wechsel ↔ wechselL …)로 읽는다. 짝 없는 가운데 자세(tag·langort·alber)는 그대로.');
L.push('');
// 2. 기준 클립 감기 끝의 칼 호 (경계를 잡은 근거)
L.push('## 2. 지금 기준 클립 감기 끝(tw)의 칼 호 — 나누기 경계의 근거');
L.push('');
L.push('| 무리 | 작게 | 보통 | 크게 |');
L.push('|---|---|---|---|');
for (const cut of CUTS) {
  const ax = all[cut.id].ax;
  const v = ['small', 'medium', 'large'].map((s) => {
    const k = clipAt(`${cut.id}_right_${s}.json`, 'tw');
    return Math.round(arcOf(k.dir, ax, k.hand).arc);
  });
  L.push(`| ${cut.nameKo} | ${v[0]}° | ${v[1]}° | ${v[2]}° |`);
}
L.push('');
// 3. 전체 표
L.push('## 3. 전체 표 — 무리 × 게임 자세 14개 (오른쪽에서 베기)');
L.push('');
L.push('칸 = 나누기 · 칼 호° · 면 밖 · 손 길 m.');
L.push('');
const ids = Object.keys(G);
L.push(`| 무리 | ${ids.join(' | ')} |`);
L.push(`|---|${ids.map(() => '---').join('|')}|`);
for (const cut of CUTS) {
  const cells = ids.map((id) => {
    const r = all[cut.id].rows.find((x) => x.id === id);
    return `${size(r.a).replace(/\*/g, '')} · ${Math.round(r.a.arc)}° · ${r.a.out.toFixed(1)} · ${r.hand.toFixed(2)}`;
  });
  L.push(`| ${cut.nameDe} | ${cells.join(' | ')} |`);
}
L.push('');
L.push(`자세 id ↔ 게임 이름: ${Object.entries(GUARD_NAMES).map(([id, n]) => `${id} ${n}`).join(' · ')}.`);
L.push('');
L.push('## 4. 한계');
L.push('');
L.push('- 칼 호만 본다. 몸통이 이미 감겨 있는 정도(자세의 골반·가슴 돌림)도 싣기에 보태지만 이 표에는 없다 — 칼 호가 같으면 가슴이 칼 쪽으로 더 돌아 있는 자세가 더 크다.');
L.push('- 베는 면은 크게 벌 저작 면 하나로 잰다. 게임 손가락 긋기는 면이 조금씩 다를 수 있다.');
L.push('- 한손 무기는 한손 자세표(쟁기·황소·긴 자세·바보만 다름)라 값이 조금 다르다 — 필요하면 무기별로 다시 낸다.');
L.push('');
writeFileSync(join(D, 'start_poses.md'), L.join('\n'));
console.log(L.slice(0, 20).join('\n'));
