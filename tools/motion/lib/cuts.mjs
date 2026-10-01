// ─────────────────────────────────────────────────────────────
//  롱소드 베기 기준 동작 — 키프레임 (동작 연구 PM, v0: 교본 서술 + 운동 사슬 측정값으로 저작)
//
//  모든 값은 오른손잡이·오른쪽에서 베는 쪽 기준. 왼쪽은 build_clips.mjs 가 거울로 만든다.
//  한 줄 = 한 키:  [시각 s, 표시, 골반 돌림°, 낮춤 m, 가슴 돌림°(골반 대비), 숙임°, 옆굽힘°, 손 앞 m, 손 위 m, 손 옆 m, 칼 각°]
//   - 손 = 칼자루를 쥔 앞손(코등이 바로 아래), 가슴 틀 [앞, 위, 칼 쪽] (가슴 가운데 원점 — 게임 guards.js 원점과 같다)
//   - 칼 각 = 그 베기의 '베는 면'(월드 틀, plane) 안에서 칼이 가리키는 각. 0 = 겨눈 선(상대를 가리킴),
//     − = 감기 쪽(위·뒤), + = 지나가기 쪽. −180 이면 칼이 상대 반대쪽(뒤)을 가리킨다.
//     면은 베기마다 f(0°의 칼 방향)와 c(+90°의 칼 방향)로 정한다.
//   - 'G:이름' 줄 = 게임 자세표(src/guards.js) 자세 그대로 (small 벌과 시작·복귀 자세)
//   - 값 자리에 null = 앞뒤 키에서 시간으로 선형 보간
//  발 = [x, z, 발끝 돌림°, 뒤꿈치 들림 0~1, 발 들림 m], 클립 시작 때 골반 밑 땅이 원점. px·pz = 골반 옮김(m)
//  표시: t0 시작 · tw 감기 끝 · tr 손목 풀림 · tc 칼이 겨눈 선을 지남 · tf 지나가기 끝 · tg 복귀
//
//  크기: small = 지금 게임의 팔 베기(자세표 그대로 잇기), large = 온몸 베기, medium = 크게 벌을 겨눈 선 자세 쪽으로 줄인 것(mediumTable).
//  출처 id 는 lib/sources.mjs. [원전] 교본 · [2차] 번역·해설 · [측정] 생체역학 · [추정] 우리가 정함
// ─────────────────────────────────────────────────────────────
import { fromGameGuard } from './clip.mjs';
import { v3, m3, frame } from './body.mjs';

// 게임 자세표 (src/guards.js RAW 에서 베껴 옴 — src 를 import 하지 않아 브라우저·Node 어디서나 돈다)
export const GAME_GUARDS = {
  tag: { hand: [0.18, 0.55, 0.06], blade: [100, 0], pelvisYaw: 25, chestYaw: 30, pitch: 0, drop: 0.05 },
  tagR: { hand: [0.12, 0.14, 0.2], blade: [55, 170], pelvisYaw: 35, chestYaw: 45, pitch: 3, drop: 0.06 },
  ochs: { hand: [0.28, 0.29, 0.22], blade: [-15, -12], pelvisYaw: 25, chestYaw: 30, pitch: 3, drop: 0.07 },
  langort: { hand: [0.57, 0.07, 0.03], blade: [-3, 0], pelvisYaw: -20, chestYaw: -20, pitch: 8, drop: 0.07 },
  side: { hand: [0.15, 0.12, 0.28], blade: [5, 110], pelvisYaw: 30, chestYaw: 45, pitch: 2, drop: 0.06 },
  pflug: { hand: [0.28, -0.31, 0.15], blade: [30, -12], pelvisYaw: 25, chestYaw: 25, pitch: 5, drop: 0.07 },
  wechsel: { hand: [0.25, -0.33, 0.2], blade: [-45, 40], pelvisYaw: 10, chestYaw: 15, pitch: 5, drop: 0.07 },
  neben: { hand: [0.08, -0.31, 0.24], blade: [-35, 150], pelvisYaw: 40, chestYaw: 45, pitch: 5, drop: 0.08 },
  alber: { hand: [0.4, -0.33, 0.02], blade: [-40, 0], pelvisYaw: -15, chestYaw: -10, pitch: 8, drop: 0.07 },
  tagL: { hand: [0.16, 0.14, -0.14], blade: [55, -170], pelvisYaw: -30, chestYaw: -40, pitch: 3, drop: 0.06 },
  ochsL: { hand: [0.28, 0.29, -0.12], blade: [-15, 12], pelvisYaw: -20, chestYaw: -30, pitch: 3, drop: 0.07 },
  sideL: { hand: [0.2, 0.12, -0.18], blade: [5, -110], pelvisYaw: -30, chestYaw: -45, pitch: 2, drop: 0.06 },
  pflugL: { hand: [0.28, -0.31, -0.06], blade: [30, 12], pelvisYaw: -20, chestYaw: -20, pitch: 5, drop: 0.07 },
  wechselL: { hand: [0.32, -0.31, -0.1], blade: [-45, -40], pelvisYaw: -30, chestYaw: -40, pitch: 12, drop: 0.08 },
};

// 한손 무기 자세표 (src/guards.js ONE_HAND → BASE_ONE): 긴 자세·쟁기·황소·바보만 바뀐다(칼 든 어깨를 앞으로, 손을 더 뻗음).
//  왼쪽 자세들은 게임도 두손 값 그대로 쓴다. 칼끝 방향(blade)은 교본 자세 그대로. 검사기가 게임 파일과 대조한다(validate_clip X1)
export const GAME_GUARDS_ONE = {
  ...GAME_GUARDS,
  langort: { ...GAME_GUARDS.langort, hand: [0.68, 0.08, 0.1], pelvisYaw: -35, chestYaw: -45, pitch: 10 },
  pflug: { ...GAME_GUARDS.pflug, hand: [0.4, -0.22, 0.13], pelvisYaw: -10, chestYaw: -25 },
  ochs: { ...GAME_GUARDS.ochs, hand: [0.36, 0.26, 0.17], pelvisYaw: 0, chestYaw: -15 },
  alber: { ...GAME_GUARDS.alber, hand: [0.5, -0.3, 0.05], pelvisYaw: -25, chestYaw: -25 },
};

// 기본 발 자리: 왼발 앞 (마이어 Zornhut: "왼발을 앞에 두고" [원전 2차])
export const STANCE = { L: [0.27, -0.1, -10, 0, 0], R: [-0.26, 0.15, 40, 0, 0] };

// ── 운동 사슬 앞당김 (초). 베기 창 동안 골반이 가장 먼저, 칼(손목)이 가장 늦게.
//  골프 프로: 골반 → 가슴 → 팔 → 채 순으로 최고 각속도, 간격 약 20~40 ms (Cheetham 2008 [측정]).
//  야구 타격: 골반 714 °/s → 어깨 937 °/s 순 (Welch 1995 [측정]).
//  seq: 골반·가슴 돌림의 최고 속도를 겨눈 선(tc)보다 몇 초 앞에 둘지, dur = 돌림 곡선 길이(초).
//   최소 저크 곡선의 최고 각속도 = 1.875 × 돌림 각 ÷ dur. large 골반 75° → 약 500 °/s, 가슴 140° → 약 940 °/s
//   large: 골반 −130 ms → 가슴 −90 ms → (손 −50~−75) → 칼끝 −40 ms 쯤. 골프는 골반→채 약 100~120 ms, 팔→채 간격이 가장 길다
//   (골프: 골반 480±82 · 가슴 605±87 °/s, 야구: 골반 714 · 어깨 937 °/s [측정]).
//  small(지금 게임)은 게임의 몸 따라가기 필터가 거의 한꺼번에 돌리므로 간격이 작다.
export const CHAIN = {
  small: { arm: 0, sword: 0, ramp: 0.08, seq: { pelvis: 0.05, chest: 0.04, dur: 0.34 } },
  large: { arm: 0, sword: 0, ramp: 0.16, seq: { pelvis: 0.13, chest: 0.09, dur: 0.28 } },
};

/** 면 안의 각 → 월드 방향 */
function planeDir(plane, deg) {
  const f = v3.norm(plane.f);
  let c = v3.sub(plane.c, v3.mul(f, v3.dot(plane.c, f)));
  c = v3.norm(c);
  const a = (deg * Math.PI) / 180;
  return v3.add(v3.mul(f, Math.cos(a)), v3.mul(c, Math.sin(a)));
}

/** 표 → 키 목록 (null 보간, 게임 자세, 월드 칼 방향 → 가슴 틀) */
export function rows(table, plane, guards = GAME_GUARDS) {
  const keys = table.map((r) => {
    if (typeof r[1] === 'string' && r[1].startsWith('G:')) {
      const name = r[1].slice(2);
      const g = fromGameGuard(guards[name]);
      return { t: r[0], tag: r[2] ?? null, p: [g.pelvis.yaw, g.pelvis.drop, 0], c: [g.chest.yaw, g.chest.lean, 0], h: g.hand, d: g.dirV, guard: name };
    }
    const [t, tag, py, drop, cy, lean, side, hx, hy, hz, ang] = r;
    return { t, tag, p: [py, drop, 0], c: [cy, lean, side], h: [hx, hy, hz], ang };
  });
  // null 채우기
  const fill = (get, set) => {
    for (let i = 0; i < keys.length; i++) {
      if (get(keys[i]) != null) continue;
      let a = i - 1, b = i + 1;
      while (a >= 0 && get(keys[a]) == null) a--;
      while (b < keys.length && get(keys[b]) == null) b++;
      if (a < 0 || b >= keys.length) throw new Error(`보간할 이웃이 없다 (키 ${i})`);
      const u = (keys[i].t - keys[a].t) / (keys[b].t - keys[a].t);
      set(keys[i], get(keys[a]) + (get(keys[b]) - get(keys[a])) * u);
    }
  };
  const idx = [['p', 0], ['p', 1], ['c', 0], ['c', 1], ['c', 2], ['h', 0], ['h', 1], ['h', 2]];
  for (const [f, j] of idx) fill((k) => k[f][j], (k, v) => (k[f][j] = v));
  // 칼 방향: 각 → 월드 → 그 키의 가슴 틀
  for (const k of keys) {
    if (k.d) continue;
    if (k.ang == null) continue;
    const Rc = frame(k.p[0] + k.c[0], k.p[2] + k.c[1], k.c[2]);
    k.d = m3.applyT(Rc, planeDir(plane, k.ang));
  }
  // 각이 null 인 키: 앞뒤 키 방향을 시간으로 섞음
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].d) continue;
    let a = i - 1, b = i + 1;
    while (a >= 0 && !keys[a].d) a--;
    while (b < keys.length && !keys[b].d) b++;
    const u = (keys[i].t - keys[a].t) / (keys[b].t - keys[a].t);
    keys[i].d = v3.norm(v3.lerp(keys[a].d, keys[b].d, u));
  }
  for (const k of keys) {
    if (!k.tag) delete k.tag;
    delete k.ang;
  }
  return keys;
}
const F = (L, R) => ({ L, R });
const still = (tg) => [
  { t: 0, feet: F(STANCE.L, STANCE.R), px: 0 },
  { t: tg, feet: F(STANCE.L, STANCE.R), px: 0 },
];

export const CUTS = [];
/**
 * 보통 벌 (v1): 크게 벌을 "겨눈 선 자세 쪽으로 줄인" 것. small·large 를 그냥 섞으면(v0) 게임 자세와 온몸 자세의 모양이
 *  달라 사이 자세의 손목이 사람 어림을 넘었다. 여기서는 크게 벌의 같은 키에서, 몸 돌림·숙임·손 자리는 겨눈 선(tc) 값과의
 *  차이를 AMP 만큼, 칼 각(겨눈 선 = 0)은 ANG 만큼만 남긴다. 준비(t0)·복귀(tg)는 게임 자세 그대로, 시각은 작게와 크게의 가운데.
 */
const MED = { AMP: 0.75, ANG: 0.85, TR: 0.3 };
function mediumTable(small, large) {
  const tcRow = large.find((r) => r[1] === 'tc');
  const med = large.map((r, i) => {
    const t = +((small[i][0] + r[0]) / 2).toFixed(3);
    if (typeof r[1] === 'string' && r[1].startsWith('G:')) return [t, r[1], r[2]];
    const out = [t, r[1]];
    for (let j = 2; j <= 9; j++) {
      const v = r[j], c = tcRow[j];
      out.push(v == null ? null : c == null ? v : +(c + (v - c) * MED.AMP).toFixed(3));
    }
    out.push(r[10] == null ? null : +(r[10] * MED.ANG).toFixed(1));
    return out;
  });
  // 손목 풀림(tr) 키의 손을 앞 키 쪽으로 MED.TR 만큼 되돌린다: 보통 벌은 몸통 몫이 작아 손 첫 봉우리(풀림 앞)가
  //  골반보다 앞섰다. 손 옮김을 풀림 뒤로 조금 미루면 손 최고가 골반 → 가슴 뒤로 간다
  const iTr = med.findIndex((r) => r[1] === 'tr');
  if (iTr > 0 && med[iTr - 1][7] != null && med[iTr][7] != null)
    for (let j = 7; j <= 9; j++) med[iTr][j] = +(med[iTr][j] + (med[iTr - 1][j] - med[iTr][j]) * MED.TR).toFixed(3);
  return med;
}
function mediumSteps(large, small, med) {
  const base = large[0];
  // 걸음: 크게 걸음의 발 옮김을 반만, 시각은 표시에 맞춰 옮긴다 (build_clips 가 표시로 다시 맞춘다)
  return large.map((st) => {
    const f = {};
    for (const side of ['L', 'R']) f[side] = base.feet[side].map((v, k) => v + (st.feet[side][k] - v) * 0.5);
    return { t: st.t, feet: f, px: (st.px ?? 0) * 0.5, pz: (st.pz ?? 0) * 0.5 };
  });
}
/**
 * 보통 벌 감기 칼 (v1, 디렉터 9/29): 크게 벌을 줄인 보통 벌은 감기 끝(tw) 칼이 크게 쪽에 붙어 작게와 65~90° 벌어졌다 —
 *  게임이 작게 → 보통 → 크게를 섞을 때 칼이 한 번에 돈다. 감기(t0 뒤 ~ tw) 키의 칼 방향을 작게·크게 같은 키 방향의
 *  가운데(구면 보간 MED.TW)로 두고, tw 뒤 ~ 풀기(tr) 앞 키는 지금 보통 방향으로 서서히 돌려놓는다. 몸·손은 그대로.
 */
MED.TW = 0.5;
function slerp(a, b, u) {
  const d = Math.max(-1, Math.min(1, v3.dot(a, b)));
  const w = Math.acos(d);
  if (w < 1e-6) return a;
  return v3.norm(v3.add(v3.mul(a, Math.sin((1 - u) * w) / Math.sin(w)), v3.mul(b, Math.sin(u * w) / Math.sin(w))));
}
function mediumWindBlade(medKeys, smallKeys, largeKeys) {
  const iTw = medKeys.findIndex((k) => k.tag === 'tw');
  const iTr = medKeys.findIndex((k) => k.tag === 'tr');
  if (iTw < 1 || iTr <= iTw) return medKeys;
  const half = (i) => slerp(smallKeys[i].d, largeKeys[i].d, MED.TW);
  for (let i = 1; i <= iTw; i++) medKeys[i].d = half(i);
  for (let i = iTw + 1; i < iTr; i++) {
    const u = (medKeys[i].t - medKeys[iTw].t) / (medKeys[iTr].t - medKeys[iTw].t);
    medKeys[i].d = slerp(half(i), medKeys[i].d, u);
  }
  return medKeys;
}
/**
 * 이른 걸음 (v1, 디렉터 9/29): 크게 벌 걸음 키 시각을 앞으로 당긴다 — 디딤(tc 0.65)은 그대로, 뒤꿈치 준비 0.36 → 0.30,
 *  발 뗌 키 0.5 → 0.40, 옮김 가운데 0.58 → 0.52. 발이 감기 끝(tw) 무렵에 떠서 공중 시간이 약 0.24 → 0.32 s 로 길어진다
 *  (손가락 빠르기로 줄여 틀어도 게임 발 최고 6 m/s 안에서 tc 에 닿게). 같은 걸음 키의 골반 앞 옮김(px·pz)도 같이 당긴다
 *  (발만 먼저 나가면 다리가 닿지 않는다). 손·칼·몸 키는 그대로. [추정 — 사람 자료: Meyer "베기와 함께 딛는다", 참고이지 한도 아님]
 */
const EARLY_STEP = [[0, 0], [0.36, 0.3], [0.5, 0.4], [0.58, 0.52], [0.65, 0.65]];
function earlyStep(steps) {
  const map = (t) => {
    for (let i = 0; i < EARLY_STEP.length - 1; i++) {
      const [a, A] = EARLY_STEP[i], [b, B] = EARLY_STEP[i + 1];
      if (t <= b + 1e-9) return +(A + ((B - A) * (t - a)) / (b - a)).toFixed(3);
    }
    return t;
  };
  return steps.map((s) => ({ ...s, t: map(s.t) }));
}
function def(o) {
  if (o.small.length !== o.large.length) throw new Error(`${o.id}: small·large 키 개수가 다르다`);
  if (o.largeSteps) o = { ...o, largeSteps: earlyStep(o.largeSteps) };
  const med = mediumTable(o.small, o.large);
  // 운동 사슬 앞섬은 크게 벌과 같게 (손 키 박자가 크게 벌 것이라, 짧게 두면 손 최고가 골반보다 앞섰다)
  const chainMed = { arm: 0, sword: 0, ramp: 0.12, seq: { pelvis: 0.13, chest: 0.09, dur: 0.28 } };
  CUTS.push({
    ...o,
    small: { keys: rows(o.small, o.plane), steps: o.smallSteps ?? still(o.small[o.small.length - 1][0]), chain: CHAIN.small },
    medium: { keys: mediumWindBlade(rows(med, o.plane), rows(o.small, o.plane), rows(o.large, o.plane)), steps: mediumSteps(o.largeSteps, o.small, med), chain: chainMed, stepTimesFrom: 'large' },
    large: { keys: rows(o.large, o.plane), steps: o.largeSteps, chain: CHAIN.large },
  });
}

// ─────────────────────────────────────────────────────────────
//  1. 분노의 베기 Zornhau — 오른쪽 위 → 왼쪽 아래 사선, 앞날
//   시작: 분노의 자세(Zornhut) — 칼을 오른 어깨에, 칼날이 등 뒤로 늘어짐 (Meyer [원전 2차])
//   목표: 상대 왼쪽 귀·목, 얼굴·가슴을 지나 (Meyer [원전 2차])
//   끝: 칼이 몸을 가로질러 왼쪽 아래(왼쪽 바꿈·옆 지킴)로 [2차: 현대 Meyer 수련]
//   발: 오른발을 내딛는다, 칼이 겨눈 선을 지날 때 딛는다 (Döbringer · Meyer [원전 2차])
// ─────────────────────────────────────────────────────────────
def({
  id: 'zornhau', nameKo: '분노의 베기', nameDe: 'Zornhau', family: '사선 내려베기 · 앞날',
  desc: '오른 어깨(분노의 자세)에서 상대 왼쪽 귀·목으로 사선으로 내려베고, 칼이 몸을 가로질러 왼쪽 엉덩이 뒤(왼쪽 바꿈)로 빠진다. 오른발을 내딛는다.',
  // 겨눈 선: 앞손(어깨 높이)에서 상대 왼쪽 귀·목(상대는 나를 보고 서 있으니 내 오른쪽 +z) 쪽으로 조금 올려
  plane: { f: [0.96, 0.17, 0.16], c: [0, -0.75, -0.66] },
  small: [
    [0, 'G:pflug', 't0'],
    [0.1, null, null, null, null, null, 0, null, null, null, -80],
    [0.2, 'G:tagR', 'tw'],
    [0.27, null, null, null, null, null, 0, 0.24, 0.14, 0.14, -140],
    [0.34, 'tr', null, null, null, null, 0, 0.3, 0.13, 0.1, -95],
    [0.41, null, null, null, null, null, 0, 0.42, 0.11, 0.06, -48],
    [0.48, 'tc', null, null, null, null, 0, 0.48, 0.07, 0.04, 0],
    [0.55, null, null, null, null, null, 0, 0.44, -0.04, 0, 45],
    [0.61, null, null, null, null, null, 0, 0.38, -0.18, -0.05, 80],
    [0.7, 'G:wechselL', 'tf'],
    [0.85, null, null, null, null, null, 0, null, null, null, null],
    [1.0, 'G:pflugL', 'tg'],
  ],
  large: [
    [0, 'G:pflug', 't0'],
    [0.18, null, 22, 0.09, 25, 0, 3, 0.12, 0.3, 0.24, -95],
    // 크게 감기: 손이 머리 위 오른쪽, 칼날은 등 뒤로 늘어진다
    [0.36, 'tw', 35, 0.1, 40, -4, 6, -0.12, 0.52, 0.12, -215],
    // 내려오기 시작: 손은 앞으로 나오는데 칼은 아직 등 뒤 (손목을 늦춰 둔다 — 채찍의 시작)
    [0.45, null, 25, 0.11, 36, 0, 4, -0.08, 0.49, 0.12, -186],
    [0.55, 'tr', 10, 0.11, 28, 5, 2, 0.26, 0.42, 0.18, -116],
    [0.6, null, -2, 0.115, 12, 8, 0, 0.4, 0.27, 0.14, -66],
    [0.65, 'tc', -15, 0.12, -5, 10, -4, 0.5, 0.2, 0.06, 0],
    [0.7, null, -22, 0.125, -9, 15, -5, 0.48, -0.02, -0.06, 55],
    [0.77, null, -30, 0.135, -16, 18, -6, 0.45, -0.09, -0.06, 95],
    [0.95, 'tf', -40, 0.15, -25, 20, -8, 0.38, -0.22, -0.06, 142],
    // 복귀: 칼을 왼쪽 옆으로 들어 올려 앞으로 (몸 아래로 돌리면 칼끝이 땅을 친다)
    [1.18, null, -30, 0.12, -16, 12, -4, 0.32, -0.12, -0.06, null],
    [1.5, 'G:pflugL', 'tg'],
  ],
  largeSteps: [
    { t: 0, feet: F(STANCE.L, STANCE.R), px: 0 },
    { t: 0.36, feet: F(STANCE.L, [-0.27, 0.16, 45, 0, 0]), px: -0.03 },
    { t: 0.5, feet: F(STANCE.L, [-0.24, 0.16, 40, 0.5, 0.02]), px: 0.02 },
    { t: 0.58, feet: F([0.27, -0.1, -15, 0.2, 0], [0.12, 0.14, 25, 0.1, 0.1]), px: 0.1 },
    { t: 0.65, feet: F([0.27, -0.1, -25, 0.5, 0], [0.52, 0.12, 10, 0, 0]), px: 0.2 },
    { t: 0.95, feet: F([0.27, -0.1, -45, 0.7, 0], [0.52, 0.12, 5, 0, 0]), px: 0.3 },
    { t: 1.5, feet: F([0.22, -0.12, -40, 0, 0], [0.52, 0.12, 5, 0, 0]), px: 0.3 },
  ],
  sources: ['meyer_zornhut', 'meyer_zornhau', 'ringeck_zornhau', 'doebringer_step', 'meyer_step', 'golf_sequence', 'golf_xfactor', 'swordstem_speed', 'estimate'], // arma_speed 뺌: 측정이 아니라 계산 예시였다 (연구 ASS 표본 점검 9/29)
});

// ─────────────────────────────────────────────────────────────
//  2. 위에서 베기 Oberhau — 지붕(vom Tag)에서 세로로 내려 바보(Alber)로
//   Meyer 네 곧은 베기의 첫째 [원전 2차]. 지붕에서 긴 자세를 지나 바보 자세로 (guards.js 머리말 [2차])
// ─────────────────────────────────────────────────────────────
def({
  id: 'oberhau', nameKo: '위에서 베기', nameDe: 'Oberhau', family: '세로 내려베기 · 앞날',
  desc: '지붕 자세(칼을 머리 위로)에서 정수리로 곧게 내려베고, 칼끝이 땅을 향하는 바보 자세로 빠진다. 오른발을 내딛는다.',
  plane: { f: [0.99, 0.13, 0], c: [0, -1, 0] },
  small: [
    [0, 'G:pflug', 't0'],
    [0.1, null, null, null, null, null, 0, null, null, null, -60],
    [0.2, 'G:tag', 'tw'],
    [0.27, null, null, null, null, null, 0, 0.26, 0.5, 0.04, -115],
    [0.34, 'tr', null, null, null, null, 0, 0.36, 0.38, 0.03, -80],
    [0.41, null, null, null, null, null, 0, 0.45, 0.25, 0.02, -40],
    [0.48, 'tc', null, null, null, null, 0, 0.5, 0.1, 0.02, 0],
    [0.55, null, null, null, null, null, 0, 0.47, -0.06, 0.02, 25],
    [0.61, null, null, null, null, null, 0, 0.43, -0.2, 0.02, 38],
    [0.7, 'G:alber', 'tf'],
    [1.0, 'G:pflug', 'tg'],
  ],
  large: [
    [0, 'G:pflug', 't0'],
    [0.18, null, 20, 0.08, 10, -2, 0, 0.18, 0.42, 0.08, -85],
    // 크게 감기: 손이 머리 위, 등을 조금 젖히고, 칼날이 머리 뒤로 늘어진다
    [0.36, 'tw', 25, 0.09, 12, -10, 0, -0.1, 0.56, 0.06, -215],
    [0.45, null, 18, 0.1, 10, -6, 0, -0.06, 0.53, 0.06, -186],
    [0.55, 'tr', 6, 0.11, 6, 4, 0, 0.25, 0.46, 0.04, -120],
    [0.6, null, 0, 0.12, 3, 10, 0, 0.43, 0.34, 0.03, -66],
    [0.65, 'tc', -5, 0.13, 0, 11, 0, 0.5, 0.28, 0.02, 0],
    [0.7, null, -8, 0.14, 0, 14, 0, 0.52, 0.14, 0.03, 26],
    [0.77, null, -12, 0.145, 0, 17, 0, 0.49, 0.0, 0.06, 33],
    // 끝 = 바보(Alber): 손은 엉덩이 높이, 칼끝은 앞 아래 약 40° — 땅을 치기 전에 선다
    [0.95, 'tf', -15, 0.15, 0, 20, 0, 0.44, -0.18, 0.08, 38],
    [1.5, 'G:pflug', 'tg'],
  ],
  largeSteps: [
    { t: 0, feet: F(STANCE.L, STANCE.R), px: 0 },
    { t: 0.36, feet: F(STANCE.L, STANCE.R), px: -0.04 },
    { t: 0.5, feet: F(STANCE.L, [-0.24, 0.15, 40, 0.5, 0.02]), px: 0.02 },
    { t: 0.58, feet: F([0.27, -0.1, -12, 0.2, 0], [0.12, 0.12, 20, 0.1, 0.1]), px: 0.1 },
    { t: 0.65, feet: F([0.27, -0.1, -18, 0.5, 0], [0.55, 0.1, 5, 0, 0]), px: 0.22 },
    { t: 0.95, feet: F([0.27, -0.1, -25, 0.6, 0], [0.55, 0.1, 5, 0, 0]), px: 0.3 },
    { t: 1.5, feet: F([0.24, -0.1, -20, 0, 0], [0.55, 0.1, 5, 0, 0]), px: 0.3 },
  ],
  sources: ['meyer_zornhau', 'meyer_diagram', 'meyer_step', 'doebringer_step', 'golf_sequence', 'swordstem_speed', 'kendo_men', 'estimate'],
});

// ─────────────────────────────────────────────────────────────
//  3. 가로 베기 Zwerchhau — 뒷날, 손을 머리 앞 높이 들고 가로로. 옆으로 딛는다
//   "Zwerch benimmt, was vom Tag dar kommt" (Zettel [원전]) — 칼자루를 머리 앞 높이, 엄지를 칼 면 아래 (주해 [2차])
//   small 은 지금 게임의 가로베기(옆 자세 → 왼쪽 옆 자세, 어깨 높이)라서 사실상 Mittelhau 다
// ─────────────────────────────────────────────────────────────
def({
  id: 'zwerchhau', nameKo: '가로 베기', nameDe: 'Zwerchhau', family: '가로베기 · 뒷날 · 손 높이',
  desc: '손을 이마 앞 높이로 든 채 칼을 눕혀 오른쪽에서 뒷날로 상대 왼쪽 머리를 가로로 벤다. 칼자루가 머리를 덮는다. 오른발을 오른쪽 앞으로 딛는다.',
  plane: { f: [0.98, 0.08, 0.14], c: [0, 0.02, -1] },
  small: [
    [0, 'G:pflug', 't0'],
    [0.1, null, null, null, null, null, 0, null, null, null, -60],
    [0.2, 'G:side', 'tw'],
    [0.27, null, null, null, null, null, 0, 0.25, 0.13, 0.24, -100],
    [0.34, 'tr', null, null, null, null, 0, 0.35, 0.13, 0.18, -70],
    [0.41, null, null, null, null, null, 0, 0.44, 0.13, 0.1, -35],
    [0.48, 'tc', null, null, null, null, 0, 0.48, 0.12, 0.02, 0],
    [0.55, null, null, null, null, null, 0, 0.44, 0.12, -0.06, 35],
    [0.61, null, null, null, null, null, 0, 0.36, 0.12, -0.12, 65],
    [0.7, 'G:sideL', 'tf'],
    [1.0, 'G:pflugL', 'tg'],
  ],
  large: [
    [0, 'G:pflug', 't0'],
    [0.18, null, 20, 0.08, 20, 0, 3, 0.15, 0.36, 0.2, -80],
    // 감기: 지붕을 거쳐 칼을 오른쪽 뒤로 눕힌다. 손은 머리 오른쪽 높이
    [0.36, 'tw', 32, 0.09, 30, -2, 6, -0.06, 0.4, 0.22, -170],
    [0.45, null, 25, 0.1, 30, 0, 4, -0.02, 0.37, 0.22, -148],
    [0.55, 'tr', 12, 0.1, 24, 3, 2, 0.26, 0.4, 0.16, -100],
    [0.6, null, 0, 0.11, 12, 5, 0, 0.38, 0.38, 0.1, -66],
    [0.65, 'tc', -12, 0.11, -3, 6, -2, 0.42, 0.36, 0.02, 0],
    [0.7, null, -20, 0.115, -10, 6, -4, 0.4, 0.35, -0.06, 50],
    [0.77, null, -28, 0.12, -16, 5, -5, 0.32, 0.35, -0.14, 90],
    [0.95, 'tf', -36, 0.12, -22, 4, -6, 0.16, 0.36, -0.2, 140],
    [1.5, 'G:ochsL', 'tg'],
  ],
  largeSteps: [
    { t: 0, feet: F(STANCE.L, STANCE.R), px: 0 },
    { t: 0.36, feet: F(STANCE.L, [-0.27, 0.16, 45, 0, 0]), px: -0.02 },
    { t: 0.5, feet: F(STANCE.L, [-0.22, 0.2, 40, 0.5, 0.02]), px: 0.02, pz: 0.03 },
    { t: 0.58, feet: F([0.27, -0.1, -10, 0.2, 0], [0.12, 0.3, 30, 0.1, 0.1]), px: 0.08, pz: 0.08 },
    { t: 0.65, feet: F([0.27, -0.1, -20, 0.5, 0], [0.42, 0.38, 15, 0, 0]), px: 0.16, pz: 0.16 },
    { t: 0.95, feet: F([0.27, -0.1, -35, 0.6, 0], [0.42, 0.38, 10, 0, 0]), px: 0.22, pz: 0.2 },
    { t: 1.5, feet: F([0.2, 0.02, -30, 0, 0], [0.42, 0.38, 10, 0, 0]), px: 0.22, pz: 0.2 },
  ],
  sources: ['zettel_verses', 'gloss_zwerch', 'meyer_master', 'mocap_sose2020', 'meyer_step', 'golf_sequence', 'estimate'],
});

// ─────────────────────────────────────────────────────────────
//  4. 사팔뜨기 베기 Schielhau — 오른쪽에서 뒷날로, 상대 오른 어깨·칼 위로, 팔을 뻗어 끝낸다
//   "Schieler bricht, was Büffel schlägt oder sticht" (Zettel [원전]). 팔을 뻗어 칼끝이 상대 얼굴·가슴을 겨눈 채 끝남 (주해 [2차])
// ─────────────────────────────────────────────────────────────
def({
  id: 'schielhau', nameKo: '사팔뜨기 베기', nameDe: 'Schielhau', family: '내려베기 · 뒷날 · 뻗어 끝냄',
  desc: '오른 어깨에서 손을 뒤집어 뒷날로 상대 오른 어깨(내 왼쪽 앞)를 위에서 내려치고, 팔을 길게 뻗어 칼끝으로 상대를 겨눈 채 끝낸다. 오른발을 오른쪽 앞으로 딛는다.',
  plane: { f: [0.98, 0.04, -0.16], c: [0, -1, -0.22] },
  small: [
    [0, 'G:pflug', 't0'],
    [0.1, null, null, null, null, null, 0, null, null, null, -80],
    [0.2, 'G:tagR', 'tw'],
    [0.27, null, null, null, null, null, 0, 0.26, 0.16, 0.14, -140],
    [0.34, 'tr', null, null, null, null, 0, 0.36, 0.16, 0.1, -95],
    [0.41, null, null, null, null, null, 0, 0.47, 0.13, 0.06, -45],
    [0.48, 'tc', null, null, null, null, 0, 0.54, 0.09, 0.03, 0],
    [0.55, null, null, null, null, null, 0, 0.56, 0.07, 0.03, 10],
    [0.61, null, null, null, null, null, 0, 0.57, 0.07, 0.03, 8],
    [0.7, 'G:langort', 'tf'],
    [1.0, 'G:pflug', 'tg'],
  ],
  large: [
    [0, 'G:pflug', 't0'],
    [0.18, null, 22, 0.09, 25, 0, 3, 0.12, 0.3, 0.24, -95],
    [0.36, 'tw', 35, 0.1, 38, -4, 6, -0.1, 0.48, 0.14, -205],
    [0.45, null, 26, 0.1, 34, 0, 4, -0.06, 0.45, 0.14, -178],
    [0.55, 'tr', 10, 0.11, 24, 5, 2, 0.34, 0.36, 0.16, -115],
    [0.6, null, -3, 0.12, 8, 9, 0, 0.48, 0.24, 0.1, -66],
    [0.65, 'tc', -15, 0.13, -8, 10, -2, 0.52, 0.24, 0.08, 0],
    // 지나가기가 짧다: 팔을 뻗은 채 칼끝을 상대 얼굴·가슴에 걸고 선다 (끝 자세 = 긴 자세에 가깝다)
    [0.7, null, -20, 0.135, -10, 15, -3, 0.55, 0.1, 0.08, 20],
    [0.77, null, -22, 0.14, -10, 15, -3, 0.55, 0.09, 0.08, 24],
    [0.95, 'tf', -22, 0.14, -10, 14, -3, 0.54, 0.1, 0.08, 18],
    [1.5, 'G:pflug', 'tg'],
  ],
  largeSteps: [
    { t: 0, feet: F(STANCE.L, STANCE.R), px: 0 },
    { t: 0.36, feet: F(STANCE.L, [-0.27, 0.16, 45, 0, 0]), px: -0.03 },
    { t: 0.5, feet: F(STANCE.L, [-0.23, 0.18, 40, 0.5, 0.02]), px: 0.02 },
    { t: 0.58, feet: F([0.27, -0.1, -12, 0.2, 0], [0.14, 0.2, 25, 0.1, 0.1]), px: 0.1, pz: 0.04 },
    { t: 0.65, feet: F([0.27, -0.1, -20, 0.5, 0], [0.55, 0.24, 10, 0, 0]), px: 0.22, pz: 0.08 },
    { t: 0.95, feet: F([0.27, -0.1, -25, 0.6, 0], [0.55, 0.24, 10, 0, 0]), px: 0.3, pz: 0.1 },
    { t: 1.5, feet: F([0.24, -0.08, -20, 0, 0], [0.55, 0.24, 10, 0, 0]), px: 0.3, pz: 0.1 },
  ],
  sources: ['zettel_verses', 'gloss_schiel', 'meyer_master', 'mocap_sose2020', 'meyer_step', 'golf_sequence', 'estimate'],
});

// ─────────────────────────────────────────────────────────────
//  5. 아래에서 베기 Unterhau — 오른쪽 아래(옆 지킴·바꿈)에서 왼쪽 위로 올려벤다
//   Meyer 네 곧은 베기의 넷째 [원전 2차]. 끝: 왼쪽 위(왼쪽 황소 쪽) [추정]
// ─────────────────────────────────────────────────────────────
def({
  id: 'unterhau', nameKo: '아래에서 베기', nameDe: 'Unterhau', family: '사선 올려베기 · 앞날',
  desc: '오른쪽 허리 뒤(옆 지킴)에서 칼을 끌어올려 상대 왼팔·옆구리로 사선으로 올려베고, 칼이 왼쪽 머리 위(왼쪽 황소)로 빠진다. 오른발을 내딛는다.',
  plane: { f: [0.97, 0.1, 0.14], c: [0, 0.72, -0.7] },
  small: [
    [0, 'G:pflug', 't0'],
    [0.1, null, null, null, null, null, 0, null, null, null, null],
    [0.2, 'G:wechsel', 'tw'],
    [0.27, null, null, null, null, null, 0, 0.3, -0.3, 0.16, -62],
    [0.34, 'tr', null, null, null, null, 0, 0.38, -0.22, 0.1, -45],
    [0.41, null, null, null, null, null, 0, 0.45, -0.12, 0.06, -22],
    [0.48, 'tc', null, null, null, null, 0, 0.48, -0.02, 0.02, 0],
    [0.55, null, null, null, null, null, 0, 0.44, 0.1, -0.04, null],
    [0.61, null, null, null, null, null, 0, 0.37, 0.2, -0.08, null],
    [0.7, 'G:ochsL', 'tf'],
    [1.0, 'G:pflugL', 'tg'],
  ],
  large: [
    [0, 'G:pflug', 't0'],
    [0.18, null, 25, 0.1, 18, 8, 5, 0.26, -0.22, 0.22, -128],
    // 크게 감기: 칼을 오른 허리 뒤로 숨기고 칼끝은 뒤 아래 (옆 지킴을 더 깊게), 오른쪽으로 몸을 숙인다. 이 면에서 −160° = 뒤·아래·오른쪽
    [0.36, 'tw', 38, 0.13, 36, 16, 10, 0.14, -0.32, 0.18, -162],
    [0.45, null, 30, 0.13, 34, 14, 8, 0.18, -0.35, 0.18, -140],
    [0.55, 'tr', 14, 0.13, 26, 10, 5, 0.3, -0.2, 0.18, -108],
    [0.6, null, 0, 0.125, 12, 7, 2, 0.42, -0.16, 0.1, -66],
    [0.65, 'tc', -12, 0.12, -2, 4, -2, 0.48, -0.02, 0.02, 0],
    [0.7, null, -20, 0.11, -10, 0, -4, 0.44, 0.14, -0.06, 45],
    [0.77, null, -28, 0.1, -16, -3, -5, 0.36, 0.3, -0.12, 85],
    [0.95, 'tf', -36, 0.09, -22, -5, -6, 0.2, 0.44, -0.14, 130],
    [1.5, 'G:ochsL', 'tg'],
  ],
  largeSteps: [
    { t: 0, feet: F(STANCE.L, STANCE.R), px: 0 },
    { t: 0.36, feet: F(STANCE.L, [-0.28, 0.17, 45, 0, 0]), px: -0.04 },
    { t: 0.5, feet: F(STANCE.L, [-0.25, 0.16, 40, 0.5, 0.02]), px: 0.0 },
    { t: 0.58, feet: F([0.27, -0.1, -15, 0.2, 0], [0.12, 0.14, 25, 0.1, 0.1]), px: 0.1 },
    { t: 0.65, feet: F([0.27, -0.1, -25, 0.5, 0], [0.52, 0.12, 10, 0, 0]), px: 0.2 },
    { t: 0.95, feet: F([0.27, -0.1, -40, 0.6, 0], [0.52, 0.12, 5, 0, 0]), px: 0.28 },
    { t: 1.5, feet: F([0.22, -0.12, -35, 0, 0], [0.52, 0.12, 5, 0, 0]), px: 0.28 },
  ],
  sources: ['meyer_zornhau', 'meyer_diagram', 'meyer_step', 'doebringer_step', 'baseball_sequence', 'golf_sequence', 'estimate'],
});

// ─────────────────────────────────────────────────────────────
//  6. (제안) 정수리 베기 Scheitelhau — 지붕에서 세로로, 팔을 높이 뻗어 정수리를 치고 칼끝이 얼굴 쪽으로 늘어진 채 끝남
//   "Der Scheitler mit seiner Kehr, dem Antlitz ist er gefähr" (Zettel [원전]). 멀리 닿는 세로 베기
// ─────────────────────────────────────────────────────────────
def({
  id: 'scheitelhau', nameKo: '정수리 베기 (제안)', nameDe: 'Scheitelhau', family: '세로 내려베기 · 앞날 · 뻗어 끝냄',
  desc: '지붕에서 세로로 내려 정수리를 치되, 팔을 높이 길게 뻗어 멈추고 칼끝이 상대 얼굴·가슴 쪽으로 늘어진다. 가장 멀리 닿는 베기. 오른발을 길게 내딛는다.',
  plane: { f: [0.99, 0.13, 0], c: [0, -1, 0] },
  small: [
    [0, 'G:pflug', 't0'],
    [0.1, null, null, null, null, null, 0, null, null, null, -60],
    [0.2, 'G:tag', 'tw'],
    [0.27, null, null, null, null, null, 0, 0.28, 0.5, 0.04, -115],
    [0.34, 'tr', null, null, null, null, 0, 0.4, 0.38, 0.03, -80],
    [0.41, null, null, null, null, null, 0, 0.5, 0.27, 0.02, -40],
    [0.48, 'tc', null, null, null, null, 0, 0.56, 0.18, 0.02, 0],
    [0.55, null, null, null, null, null, 0, 0.57, 0.14, 0.02, 15],
    [0.61, null, null, null, null, null, 0, 0.57, 0.12, 0.02, 20],
    [0.7, 'G:langort', 'tf'],
    [1.0, 'G:pflug', 'tg'],
  ],
  large: [
    [0, 'G:pflug', 't0'],
    [0.18, null, 20, 0.08, 10, -2, 0, 0.18, 0.42, 0.08, -85],
    [0.36, 'tw', 25, 0.09, 12, -10, 0, -0.1, 0.56, 0.06, -210],
    [0.45, null, 18, 0.1, 10, -6, 0, -0.06, 0.53, 0.06, -182],
    [0.55, 'tr', 5, 0.11, 5, 4, 0, 0.28, 0.48, 0.04, -115],
    [0.6, null, -2, 0.12, 2, 10, 0, 0.47, 0.36, 0.06, -66],
    [0.65, 'tc', -8, 0.13, 0, 11, 0, 0.52, 0.3, 0.08, 0],
    [0.7, null, -12, 0.135, 0, 17, 0, 0.55, 0.16, 0.08, 22],
    [0.77, null, -14, 0.14, 0, 18, 0, 0.55, 0.15, 0.08, 30],
    [0.95, 'tf', -14, 0.14, 0, 18, 0, 0.54, 0.16, 0.08, 28],
    [1.5, 'G:pflug', 'tg'],
  ],
  largeSteps: [
    { t: 0, feet: F(STANCE.L, STANCE.R), px: 0 },
    { t: 0.36, feet: F(STANCE.L, STANCE.R), px: -0.04 },
    { t: 0.5, feet: F(STANCE.L, [-0.24, 0.15, 40, 0.5, 0.02]), px: 0.02 },
    { t: 0.58, feet: F([0.27, -0.1, -12, 0.2, 0], [0.16, 0.12, 20, 0.1, 0.1]), px: 0.12 },
    { t: 0.65, feet: F([0.27, -0.1, -18, 0.6, 0], [0.62, 0.1, 5, 0, 0]), px: 0.26 },
    { t: 0.95, feet: F([0.27, -0.1, -20, 0.7, 0], [0.62, 0.1, 5, 0, 0]), px: 0.34 },
    { t: 1.5, feet: F([0.27, -0.1, -20, 0, 0], [0.62, 0.1, 5, 0, 0]), px: 0.3 },
  ],
  sources: ['zettel_verses', 'gloss_scheitel', 'meyer_master', 'meyer_step', 'golf_sequence', 'estimate'],
});

// ─────────────────────────────────────────────────────────────
//  7. (제안) 굽은 베기 Krumphau — 오른쪽으로 넓게 딛으며 팔을 엇걸어 칼끝을 상대 손 위로 던진다
//   "Krump auf behende, wirf den Ort auf die Hände" (Zettel [원전]). 끝: 팔이 엇걸린 채 칼끝이 낮게 [해석]
// ─────────────────────────────────────────────────────────────
def({
  id: 'krumphau', nameKo: '굽은 베기 (제안)', nameDe: 'Krumphau', family: '엇걸어 내려베기 · 손 노림',
  desc: '오른 어깨에서 오른발을 오른쪽으로 넓게 딛으며 팔을 엇걸어, 칼끝을 상대 손·칼 위로 던져 내려친다. 끝에 팔이 엇걸리고 칼끝이 낮다.',
  plane: { f: [0.85, -0.4, -0.35], c: [-0.1, -0.7, -0.7] },
  small: [
    [0, 'G:pflug', 't0'],
    [0.1, null, null, null, null, null, 0, null, null, null, -110],
    [0.2, 'G:tagR', 'tw'],
    [0.27, null, null, null, null, null, 0, 0.26, 0.12, 0.12, -150],
    [0.34, 'tr', null, null, null, null, 0, 0.34, 0.06, 0.06, -100],
    [0.41, null, null, null, null, null, 0, 0.42, -0.02, 0.0, -50],
    [0.48, 'tc', null, null, null, null, 0, 0.46, -0.1, -0.06, 0],
    [0.55, null, null, null, null, null, 0, 0.44, -0.16, -0.1, 25],
    [0.61, null, null, null, null, null, 0, 0.4, -0.22, -0.12, 40],
    [0.7, 'G:wechselL', 'tf'],
    [1.0, 'G:pflug', 'tg'],
  ],
  large: [
    [0, 'G:pflug', 't0'],
    [0.18, null, 22, 0.09, 25, 0, 3, 0.12, 0.3, 0.24, -125],
    [0.36, 'tw', 32, 0.1, 36, -3, 6, -0.1, 0.48, 0.14, -225],
    [0.45, null, 24, 0.11, 32, 0, 4, -0.06, 0.45, 0.14, -196],
    [0.55, 'tr', 12, 0.12, 22, 6, 0, 0.28, 0.28, 0.06, -125],
    [0.6, null, 2, 0.13, 10, 10, -2, 0.38, 0.1, -0.04, -66],
    [0.65, 'tc', -8, 0.14, 0, 14, -4, 0.46, -0.04, -0.06, 0],
    [0.7, null, -12, 0.145, -4, 16, -5, 0.44, -0.1, -0.08, 22],
    [0.77, null, -15, 0.15, -6, 17, -6, 0.42, -0.14, -0.08, 30],
    [0.95, 'tf', -18, 0.15, -8, 16, -6, 0.42, -0.14, -0.06, 32],
    [1.5, 'G:pflug', 'tg'],
  ],
  largeSteps: [
    { t: 0, feet: F(STANCE.L, STANCE.R), px: 0 },
    { t: 0.36, feet: F(STANCE.L, [-0.27, 0.16, 45, 0, 0]), px: -0.02 },
    { t: 0.5, feet: F(STANCE.L, [-0.2, 0.24, 40, 0.5, 0.02]), px: 0.02, pz: 0.04 },
    { t: 0.58, feet: F([0.27, -0.1, -5, 0.2, 0], [0.1, 0.42, 20, 0.1, 0.1]), px: 0.08, pz: 0.12 },
    { t: 0.65, feet: F([0.27, -0.1, -10, 0.5, 0], [0.34, 0.55, 5, 0, 0]), px: 0.14, pz: 0.22 },
    { t: 0.95, feet: F([0.27, -0.1, -15, 0.6, 0], [0.34, 0.55, 0, 0, 0]), px: 0.18, pz: 0.28 },
    { t: 1.5, feet: F([0.22, 0.1, -10, 0, 0], [0.34, 0.55, 0, 0, 0]), px: 0.18, pz: 0.3 },
  ],
  sources: ['zettel_verses', 'gloss_krump', 'meyer_master', 'meyer_step', 'estimate'],
});

// ─────────────────────────────────────────────────────────────
//  8. 가운데 베기 Mittelhau — 앞날, 어깨 높이 가로베기 (디렉터 atlas 첫 목록에 있어 같이 냄)
// ─────────────────────────────────────────────────────────────
def({
  id: 'mittelhau', nameKo: '가운데 베기', nameDe: 'Mittelhau', family: '가로베기 · 앞날 · 어깨 높이',
  desc: '오른쪽 옆 자세에서 칼을 눕혀 어깨 높이로 가로로 베고, 칼이 왼쪽 어깨 너머로 빠진다. 오른발을 내딛는다.',
  plane: { f: [0.98, 0.04, 0.12], c: [0, 0, -1] },
  small: [
    [0, 'G:pflug', 't0'],
    [0.1, null, null, null, null, null, 0, null, null, null, -60],
    [0.2, 'G:side', 'tw'],
    [0.27, null, null, null, null, null, 0, 0.25, 0.1, 0.24, -100],
    [0.34, 'tr', null, null, null, null, 0, 0.35, 0.08, 0.18, -70],
    [0.41, null, null, null, null, null, 0, 0.44, 0.06, 0.1, -35],
    [0.48, 'tc', null, null, null, null, 0, 0.48, 0.05, 0.02, 0],
    [0.55, null, null, null, null, null, 0, 0.44, 0.06, -0.06, 35],
    [0.61, null, null, null, null, null, 0, 0.36, 0.08, -0.12, 65],
    [0.7, 'G:sideL', 'tf'],
    [1.0, 'G:pflugL', 'tg'],
  ],
  large: [
    [0, 'G:pflug', 't0'],
    [0.18, null, 22, 0.09, 22, 2, 2, 0.12, 0.2, 0.28, -90],
    [0.36, 'tw', 36, 0.1, 40, 2, 4, 0.08, 0.12, 0.38, -172],
    [0.45, null, 28, 0.105, 38, 3, 3, 0.12, 0.09, 0.38, -148],
    [0.55, 'tr', 14, 0.11, 28, 5, 1, 0.28, 0.09, 0.24, -100],
    [0.6, null, 0, 0.115, 14, 6, 0, 0.4, 0.07, 0.12, -66],
    [0.65, 'tc', -14, 0.12, -2, 7, -2, 0.48, 0.05, 0.02, 0],
    [0.7, null, -22, 0.12, -10, 7, -3, 0.46, 0.06, -0.08, 50],
    [0.77, null, -30, 0.12, -16, 6, -4, 0.38, 0.08, -0.18, 95],
    [0.95, 'tf', -40, 0.12, -24, 5, -6, 0.18, 0.12, -0.28, 150],
    [1.5, 'G:pflugL', 'tg'],
  ],
  largeSteps: [
    { t: 0, feet: F(STANCE.L, STANCE.R), px: 0 },
    { t: 0.36, feet: F(STANCE.L, [-0.27, 0.16, 45, 0, 0]), px: -0.03 },
    { t: 0.5, feet: F(STANCE.L, [-0.24, 0.17, 40, 0.5, 0.02]), px: 0.02 },
    { t: 0.58, feet: F([0.27, -0.1, -15, 0.2, 0], [0.12, 0.18, 25, 0.1, 0.1]), px: 0.1 },
    { t: 0.65, feet: F([0.27, -0.1, -25, 0.5, 0], [0.5, 0.2, 10, 0, 0]), px: 0.2, pz: 0.04 },
    { t: 0.95, feet: F([0.27, -0.1, -40, 0.7, 0], [0.5, 0.2, 5, 0, 0]), px: 0.28, pz: 0.05 },
    { t: 1.5, feet: F([0.22, -0.1, -35, 0, 0], [0.5, 0.2, 5, 0, 0]), px: 0.28, pz: 0.05 },
  ],
  sources: ['meyer_zornhau', 'meyer_diagram', 'meyer_step', 'golf_sequence', 'estimate'],
});
