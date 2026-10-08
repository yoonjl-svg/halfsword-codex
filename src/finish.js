// ─────────────────────────────────────────────────────────────
//  쓰러진 상대 마무리 (내려찍기)
//
//  문제 (tools/sim/down_hits.mjs 로 잰 것): 교본 자세는 서 있는 상대에 맞춰져 있어서, 가장 낮은 자세(바보·바꿈)도
//  칼끝이 40~45°만 내려가고 손은 가슴 0.33m 아래에 머문다. 땅에 누운 몸(높이 0.1~0.3m)은 칼 밑을 지나가 닿지 않거나,
//  닿더라도 칼끝(칼날의 끝 2%)만 휘두르기 끝자락에 닿는다. 그때는 이미 손목이 칼을 멈추는 중이라 4~9m/s로 느려서
//  베기 문턱(가슴 45J·배 40J)을 넘지 못하고 멍만 든다(몸통 멍은 효과 없음). 쓰러진 상대 상처율 3%.
//
//  처방: 상대가 완전히 쓰러져(state 'down') 한 걸음 안에 누워 있으면, 자세 지도의 아래쪽 자세 자리에 마무리 자세를
//  겹쳐 놓는다 (guards.js FINISH_GUARDS). 두 자세 모두 누운 몸을 겨누도록 매 스텝 이 파일이 손·칼끝을 정한다.
//   - 겨눔 (쟁기·옆 지킴 자리 = fin.hover): 찍기 겨눔 — 두 손을 머리 위로 들고(FINISH.hands) 칼날을 아래로 돌려 쥐어
//     칼끝이 누운 몸 점(plunge.T)을 겨눈다 (얼음송곳 쥐듯). 거리와 관계없이 한 자세
//   - 내려찍기 (바보·바꿈 자리 = fin.strike): 손을 낮게 앞으로 뻗고, 칼을 몸 밑 땅속까지 겨눈다 (hitAt·steep·strikeY·strikeFwd)
//   → 지붕 → 내려찍기 = 내려베기. 칼의 목표 각도가 몸 밑 땅속이라 몸에 닿는 순간은 아직 목표에 한참 못 미쳐
//     손목이 제동을 걸기 전이다 → 빠른 칼날이 들어간다
//  두 사람 다 서 있으면 amt = 0 이고 자세 지도 계산은 예전과 한 비트도 다르지 않다.
//  플레이어와 AI 가 같은 파이터 코드를 쓰므로 AI 의 내려베기도 그대로 마무리가 된다.
//  탭 마무리 찌르기(skill.js plungePose, 사장님 9/30 "닿을 때까지 걸어들어가 … 양손을 번쩍 드는 동시에 칼날을 아래로 돌려잡고
//   힘껏 내려찍음")는 fin.plunge 만 읽는다: 몸 점 T, 칼끝이 들어갈 끝 tip, 칼 방향 dir, 닿는 곳(inside·short·walk)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { MEASURED } from './ai.js';
import { ARM } from './config.js';
import { lowFinishEnabled, lowFinishPosture } from './finish_entry.js';

export const FINISH = {
  range: 1.7, // 누운 몸통이 내 가슴에서 이 수평 거리(m) 안이면 마무리 자세
  minFwd: 0.2, // 내 앞쪽으로 이만큼(m)은 있어야 한다 (발밑·등 뒤는 찍지 못한다)
  ideal: 0.85, // 몸통(골반~가슴 선)에서 겨눌 점: 내 앞 이 거리(m)에 가장 가까운 점
  rampIn: 0.25, // 마무리 자세로 바뀌는 시간 (초)
  rampOut: 0.15, // 상대가 일어나면 교본 자세로 돌아가는 시간 (초)
  top: 0.12, // 누운 몸의 두께 절반 (몸 중심 위 겉면까지, m)
  sink: 0.2, // 내려찍기: 칼 선을 몸 중심 너머로 이만큼 더 겨눈다 (몸을 지나 땅속까지, m)
  // 칼날의 이 비율 지점이 몸 겉면에 닿도록 손을 놓는다. 칼은 가슴 높이에서 땅까지 닿을 만큼 길어서, 손을 너무 낮추거나
  //  몸에 붙이면 칼끝이 몸보다 먼저 땅에 박힌다 (측정: 가까이 누운 몸에서 칼이 몸 앞 땅을 쳤다).
  //  hitAt·steep·strikeY·strikeFwd 는 자세 지도 내려찍기 자리(fin.strike)만 쓴다 — 탭 마무리 찌르기는 읽지 않는다
  hitAt: 0.85,
  steep: 0.9, // 그때 칼이 내려가는 기울기 (sin) — 약 64°
  strikeY: [-0.45, 0.05], // 내려찍기 손 높이 범위 (가슴 기준, m)
  strikeFwd: [0.1, 0.55], // 내려찍기 손을 앞으로 뻗는 범위 (m)
  // 찍기 겨눔 손 (가슴 기준 [앞, 위, 옆], m). 거리와 관계없이 한 자세: 두 손을 머리 위로 번쩍 — 칼자루 쥔 손은 이마 높이
  //  (머리 꼭대기 +0.38 바로 아래), 빈손은 칼자루 끝(폼멜)을 쥐어 그보다 약 0.13 위(머리 위) — 칼날은 아래로 돌려 쥐어
  //  칼끝이 몸 점을 겨눈다. 옆 0: 두 손을 몸 가운데 앞으로 모은다 (빈손이 폼멜에 닿는다). 앞 0.25: 손이 머리 바로 위면
  //  내리찍을 때 팔이 앞으로 호를 그려 칼 선을 벗어난다.
  //  측정 (finish_thrust.mjs 5판, 4자세 × 5거리 × 4방향, 걸어 들어가기 포함): 0.35 명령 → 찍기 시작 때 칼자루 0.33 (평균, 최소 0.23),
  //  칼 수평 아래 77°, 칼 축 ↔ 몸 점 선 1.7° (최대 9.5°), 즉사 399/400, 몸통 접촉 27 J.
  //  더 높게 [0.28, 0.42] → 칼자루 0.39 (평균)지만 400판 중 11판은 팔이 몸 앞을 가로질러 걸려(칼자루 빈손 쪽 0.18, 높이 0.25~0.33)
  //  더 오르지 못한 채 칼 선이 몸 점을 0.24~0.43m 비껴 헛찍었다 (쟁기·바보 0.5~0.8m) → 즉사 379/400.
  //  시제품: [0.10, 0.50] → 0.39 도달·211/240 (팔이 호를 그려 베기), [0.30, 0.50] → 0.45·194/240 (몸통을 놓침)
  hands: [0.25, 0.35, 0],
  // 내려찍을 몸 점: 몸통 선(골반 → 가슴)에서 내 앞 이 거리(m, × 무기 배율 k)에 가장 가까운 점. 칼 선이 가파르고(약 76°)
  //  팔이 선을 따라 뻗을 여유가 남는 곳. ideal(0.85, 겨눔 켜기·AI 간격)은 닿는 곳 끝자락이라 느린 끝 베기가 됐다.
  //  측정 (시제품, 몸 점 앞 거리별 찌르기): 0.5m 9/9 · 0.6 17/23 · 0.7 15/17 · 0.8 13/17 · 0.9 4/8
  plungeAt: 0.55,
  // 내려찍는 동안 손목이 칼을 세우기 시작하는 때를 늦춘다 (fighter.driveSword 의 놓아주기 여유 × (1 − 이 값)).
  //  목표 각도가 몸 밑 땅속이라, 제동을 늦춰도 칼은 몸이나 땅에 먼저 닿는다
  brakeRelief: 0.8,
  hover: { pelvisYaw: 10, chestYaw: 12, pitch: 8, drop: 0.07 }, // 몸 (도, m)
  strike: { pelvisYaw: -5, chestYaw: -5, pitch: 22, drop: 0.13 },
  // AI 가 쓰러진 상대에게 쓰는 간격 (롱소드 기준 m, 무기 배율 k 를 곱한다. ai.js 가 간격 표 contact·reach·clinch 대신 쓴다).
  //  서 있는 상대의 간격(칼날이 머리 높이에 닿는 1.6m)으로는 누운 몸이 칼 밑 멀리 있어 허공만 치고 물러난다
  //  (tools/sim/down_diag.mjs: 롱소드 AI 가 1.5m 안으로 들어가지 않았다). 겨눌 점(ideal 0.85m)보다 조금 멀리서 들어가 내려치고,
  //  발밑(minFwd)에 가까울 때만 물러난다. 1.0/1.3/0.5 · 1.1/1.4/0.6 · 1.2/1.5/0.6 을 48판씩 견줘 첫 상처가 가장 빠른 값
  ai: { contact: 1.1, reach: 1.4, clinch: 0.6 },
};

// 칼 길이에 따른 마무리 거리: 누운 몸(어깨 아래 약 1.2m)까지 수평으로 닿는 거리는 칼이 짧을수록 훨씬 짧아진다.
//  무기 실측 사거리(ai.js MEASURED 의 contact — 칼날 70% 지점이 머리 높이에 닿는 가슴 기준 거리)를 반지름으로 보고
//  √(contact² − DROP²) 를 롱소드 값으로 나눈 배율을 FINISH.ideal·range, FINISH.plungeAt, AI 가 다가서는 거리에 곱한다.
//  롱소드보다 긴 칼은 1 (롱소드에 맞춘 값 그대로). 측정: 청강검은 누운 몸까지 0.7~0.9m 에서만 들어갔다(롱소드 1.35m 넘어서도)
const DROP = 1.2;
export function downReachK(id) {
  const m = MEASURED[id];
  if (!m || id === 'longsword') return 1;
  const r = (c) => Math.sqrt(Math.max(0.09, c * c - DROP * DROP));
  return Math.min(1, r(m[0]) / r(MEASURED.longsword[0]));
}

const D2R = Math.PI / 180;
const _yawInv = new THREE.Quaternion();
const _c = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _t = new THREE.Vector3();
const _h = new THREE.Vector3();
const _tp = new THREE.Vector3();
const _sq = new THREE.Quaternion();
const _ax = new THREE.Vector3();
const _Hs = [0, 0, 0];
const DOWN = [0, -1, 0];

function pose(body) {
  return { hand: [0, 0, 0], dir: [0, -1, 0], pelvisYaw: body.pelvisYaw * D2R, chestYaw: body.chestYaw * D2R, pitch: body.pitch * D2R, drop: body.drop };
}

/** 이 파이터의 마무리 상태 (guards.js guardAt 의 fin) */
export function newFinish() {
  return { amt: 0, on: false, k: null, gap: null, target: [0, 0, 0], hover: pose(FINISH.hover), strike: pose(FINISH.strike), plunge: { T: [0, 0, 0], tip: [0, 0, 0], dir: [0, -1, 0], u: [0, -1, 0], n: 0, D: 0, Dmax: 0, short: 0, inside: false, walk: false } };
}

/**
 * 매 물리 스텝: 상대가 쓰러져 있으면 누운 몸통의 한 점을 겨누는 마무리 자세를 정하고 amt 를 0 → 1 로 올린다.
 * 좌표는 몸 기준(가슴 중심 원점, 몸이 바라보는 방향 yaw): [앞, 위, 칼 든 쪽]
 */
export function updateFinish(f, dt) {
  const fin = f.finish;
  const foe = f.foe;
  fin.k ??= downReachK(f.weapon?.id); // 무기 배율 (한 판 동안 같다)
  fin.gap ??= { contact: FINISH.ai.contact * fin.k, reach: FINISH.ai.reach * fin.k, clinch: FINISH.ai.clinch * fin.k }; // AI 가 읽는 간격
  let on = false;
  const low = lowFinishEnabled(f), tap = f.skill?.tap;
  const continuing = !!(tap?.down && !tap.abort && !tap.ended && tap.foe === foe);
  if (low) fin.canStart = false;
  if (foe && (low ? lowFinishPosture(f, foe, continuing) : foe.state === 'down') && f.alive && f.armed && (f.state === 'stand' || f.state === 'kneel')) {
    const c = f.bodies.chest.translation();
    _c.set(c.x, c.y, c.z);
    _yawInv.copy(f.yaw).invert();
    // 날 없는 무기(나뭇가지·고무 닭·참치)나 부러진 칼은 머리를 내려찍는다: 둔기로 몸통을 치면 멍만 들고, 머리 충격만 기절시킨다
    const blunt = !f.weaponCfg.edged || f.weaponBroken;
    const p0 = foe.bodies[blunt ? 'head' : 'pelvis'].translation();
    const p1 = foe.bodies[blunt ? 'head' : 'chest'].translation();
    _a.set(p0.x, p0.y, p0.z).sub(_c).applyQuaternion(_yawInv);
    _b.set(p1.x, p1.y, p1.z).sub(_c).applyQuaternion(_yawInv);
    // 몸통 선(골반 → 가슴) 위에서 내 앞 ideal 거리의 점에 가장 가까운 곳 (수평면에서)
    const ex = _b.x - _a.x;
    const ez = _b.z - _a.z;
    const el2 = ex * ex + ez * ez;
    const ideal = FINISH.ideal * fin.k;
    const s = el2 > 1e-6 ? THREE.MathUtils.clamp(((ideal - _a.x) * ex + (0 - _a.z) * ez) / el2, 0, 1) : 0;
    _t.copy(_a).lerp(_b, s);
    const hd = Math.hypot(_t.x, _t.z);
    if (_t.x > FINISH.minFwd && hd < FINISH.range * fin.k) {
      on = true;
      fin.target[0] = _t.x;
      fin.target[1] = _t.y;
      fin.target[2] = _t.z;
      // 내려찍을 몸 점: 같은 몸통 선에서 내 앞 plungeAt 거리의 점에 가장 가까운 곳
      const sp = el2 > 1e-6 ? THREE.MathUtils.clamp(((FINISH.plungeAt * fin.k - _a.x) * ex + (0 - _a.z) * ez) / el2, 0, 1) : 0;
      _tp.copy(_a).lerp(_b, sp);
      aimPoses(f, fin, _t, _tp);
      if (low) {
        // Reaching the body's near surface suffices; the old sink target may
        // be beyond a short/broken weapon even when it can make contact.
        const pl = fin.plunge;
        on = pl.surfaceInside || pl.surfaceWalk;
        fin.canStart = on && lowFinishPosture(f, foe, false);
      }
    }
  }
  fin.on = on;
  fin.amt = THREE.MathUtils.clamp(fin.amt + (on ? dt / FINISH.rampIn : -dt / FINISH.rampOut), 0, 1);
}

/**
 * 점 P(몸 기준)에서 단위 방향 u 로 나아가 칼 든 팔이 닿는 공(어깨 ARM.shoulder, 반지름 = 팔 길이 − 펴짐 여유 = armIK 이 손을
 * 자르는 거리 0.565m) 겉면까지 거리: −b + √(b² − c), b = (P − 어깨)·u, c = |P − 어깨|² − R². P 가 공 안이면 c < 0 이라 늘 실수
 */
export function armRay(P, u, side) {
  const S = ARM.shoulder;
  const R = ARM.upper + ARM.fore - ARM.slack;
  const m0 = P[0] - S[0];
  const m1 = P[1] - S[1];
  const m2 = P[2] - S[2] * side;
  const b = m0 * u[0] + m1 * u[1] + m2 * u[2];
  const c = m0 * m0 + m1 * m1 + m2 * m2 - R * R;
  return -b + Math.sqrt(b * b - c);
}

/**
 * 겨눈 점 T(몸 기준) → 내려찍기 자세(fin.strike)의 손 위치와 칼끝 방향, 몸 점 Tp → 찍기 겨눔(fin.hover)·칼 선·닿는 곳(fin.plunge).
 * 칼끝 방향은 고정값이 아니라 "지금 손이 있는 곳에서 몸 밑 겨눈 점으로" 매 스텝 다시 잡는다(칼끝이 한 점을 노린다).
 * 팔은 손 목표를 곧게 따라가지 못하고 앞쪽으로 먼저 뻗는데(측정: 칼은 −73°인데 손은 −49°로 움직였다), 칼이 늘 한 점을
 * 겨누고 있으면 손이 어느 길로 가든 칼끝은 그 점을 향해 칼 축을 따라 들어간다 → 내리찌르기가 '찌르기'로 판정된다.
 */
function aimPoses(f, fin, T, Tp) {
  const cfg = f.weaponCfg;
  const L = cfg.hiltLength + cfg.bladeLength; // 손에서 칼끝까지
  const S = fin.strike;
  const H = fin.hover;
  const clamp = THREE.MathUtils.clamp;
  // 내려찍기 손: 칼날 hitAt 지점이 몸 겉면에 약 64° 기울기로 닿는 곳 (손이 닿을 수 있는 범위 안으로)
  const reach = cfg.hiltLength + FINISH.hitAt * cfg.bladeLength;
  const topY = T.y + FINISH.top;
  const sh = S.hand;
  sh[1] = clamp(topY + FINISH.steep * reach, FINISH.strikeY[0], FINISH.strikeY[1]);
  const dv = sh[1] - topY;
  const xWant = T.x - Math.sqrt(Math.max(0, reach * reach - dv * dv)); // 손이 가야 할 앞 거리 (닿을 수 있는 범위로 자르기 전)
  sh[0] = clamp(xWant, FINISH.strikeFwd[0], FINISH.strikeFwd[1]);
  sh[2] = 0.06 + clamp(0.35 * T.z, -0.15, 0.2); // 옆으로 누운 쪽으로 조금 따라간다
  // 칼 선: 내려찍기 손에서 몸 중심 T 를 지나 sink 만큼 더 (몸 밑 땅속). 그 끝이 겨눈 점
  //  (T 바로 아래를 겨누면 선이 몸 윗면 높이에서 몸 앞을 지나가 버린다 — 측정: 가까이 누운 몸에서 칼이 몸 앞 땅을 쳤다)
  let dx = T.x - sh[0];
  let dy = T.y - sh[1];
  let dz = T.z - sh[2];
  let n = Math.hypot(dx, dy, dz);
  const ux = dx / n;
  const uy = dy / n;
  const uz = dz / n;
  const px = T.x + ux * FINISH.sink;
  const py = T.y + uy * FINISH.sink;
  const pz = T.z + uz * FINISH.sink;
  // 지금 손 위치 (칼자루, 몸 기준) → 겨눈 점으로
  const sp = f.sword.translation();
  _h.set(sp.x, sp.y, sp.z).sub(_c).applyQuaternion(_yawInv);
  dx = px - _h.x;
  dy = py - _h.y;
  dz = pz - _h.z;
  n = Math.hypot(dx, dy, dz);
  const sd = S.dir;
  sd[0] = dx / n;
  sd[1] = dy / n;
  sd[2] = dz / n;
  // ── 찍기 (탭 마무리 찌르기 fin.plunge, 겨눔 자리 fin.hover): 머리 위 손 Hs 에서 몸 점 Tp 로 칼 선을 긋는다
  //  닿는 곳: 머리 위 손에서 칼 선을 따라 팔이 뻗을 수 있는 거리(Dmax) 안에서 칼끝이 몸 점 너머(sink)까지 들어가면 안.
  //  손이 몸 점보다 1.5m 위라 칼끝은 늘 몸 위에서 시작한다 — 손이 높으니 거리와 관계없이 같은 찍기
  const side = f.side ?? 1;
  const hs = FINISH.hands;
  _Hs[0] = hs[0];
  _Hs[1] = hs[1];
  _Hs[2] = hs[2] * side;
  const pl = fin.plunge;
  const u = pl.u;
  const d0 = Tp.x - _Hs[0];
  const d1 = Tp.y - _Hs[1];
  const d2 = Tp.z - _Hs[2];
  const pn = Math.hypot(d0, d1, d2); // 손에서 몸 점까지 (1.2m 넘게)
  u[0] = d0 / pn;
  u[1] = d1 / pn;
  u[2] = d2 / pn;
  pl.T[0] = Tp.x;
  pl.T[1] = Tp.y;
  pl.T[2] = Tp.z;
  pl.n = pn;
  pl.D = pn + FINISH.sink - L; // 칼끝이 몸 점 너머 sink 에 닿도록 손이 칼 선을 따라 갈 거리
  pl.Dmax = armRay(_Hs, u, side); // 팔이 칼 선을 따라 뻗을 수 있는 거리
  pl.inside = pl.D <= pl.Dmax;
  //  short: 닿는 곳까지 모자란 수평 거리 (걸어 들어가기가 디딤마다 가까워졌나 견준다. 걸음 길이로 쓰지 않는다)
  //   밖은 몸 점이 손보다 앞일 때뿐이라 수평 성분이 0 이 아니다 (손 바로 아래는 늘 닿는 곳 안)
  pl.short = pl.inside ? 0 : (pl.D - pl.Dmax) / Math.hypot(u[0], u[2]);
  //  walk: 걸어 들어가면 닿는가. 걸으면 몸 점은 손 쪽으로 오다 손 바로 아래를 지나 뒤로 간다 — 손 바로 아래(걸어서 가장 가까운 곳)에서도
  //   닿는 곳 밖이면 칼이 짧은 것 (팔쉬온 0.90m·청강검 0.86m·부러진 칼. 롱소드 1.18m 는 0.27m 남는다). 몸 점이 손보다 뒤면 걸을수록 멀어진다.
  //   그때 걸으면 몸 점이 발밑 뒤로 지나가 마무리가 꺼질 뿐이었다 (측정: 부러진 롱소드 0.66m 가 누운 몸을 넘어 걸어가 찍지 못함,
  //   팔쉬온 18판 중 4판) → 걷지 않고 선 자리에서 찍는다
  pl.walk = !pl.inside && Tp.x > _Hs[0] && _Hs[1] - Tp.y + FINISH.sink - L <= armRay(_Hs, DOWN, side);
  if (lowFinishEnabled(f)) {
    pl.surfaceInside = pn - FINISH.top - L <= pl.Dmax;
    pl.surfaceWalk = !pl.surfaceInside && Tp.x > _Hs[0] && _Hs[1] - Tp.y - FINISH.top - L <= armRay(_Hs, DOWN, side);
    pl.surfaceShort = pl.surfaceInside ? 0 : Math.max(0, (pn - FINISH.top - L - pl.Dmax) / Math.max(1e-6, Math.hypot(u[0], u[2])));
  }
  const tip = pl.tip;
  tip[0] = Tp.x + u[0] * FINISH.sink;
  tip[1] = Tp.y + u[1] * FINISH.sink;
  tip[2] = Tp.z + u[2] * FINISH.sink;
  // 칼 방향: 지금 칼자루에서 tip 으로. 칼이 수평보다 위에 서 있으면(지붕·황소 위쪽) 먼저 tip 쪽 수평으로 눕힌다: 몸 앞으로 내려오게
  //  (선 칼에 곧장 아래 방향을 주면 거의 반대 방향이라 돌릴 쪽이 정해지지 않아 칼이 옆·뒤로 돌아 나갔다).
  //  tip 은 내 앞(minFwd 넘게)이라 수평 성분이 0 이 아니다
  const q = f.sword.rotation();
  _ax.set(0, 1, 0).applyQuaternion(_sq.set(q.x, q.y, q.z, q.w)).applyQuaternion(_yawInv);
  const pd = pl.dir;
  if (_ax.y > 0) {
    const hz = Math.hypot(tip[0], tip[2]);
    pd[0] = tip[0] / hz;
    pd[1] = 0;
    pd[2] = tip[2] / hz;
  } else {
    dx = tip[0] - _h.x;
    dy = tip[1] - _h.y;
    dz = tip[2] - _h.z;
    n = Math.hypot(dx, dy, dz);
    pd[0] = dx / n;
    pd[1] = dy / n;
    pd[2] = dz / n;
  }
  // 겨눔 자리(쟁기·옆 지킴 패드, AI 도 자세 지도로 읽는다) = 찍기 겨눔. 몸 기울기는 FINISH.hover 그대로
  const hh = H.hand;
  const hd = H.dir;
  for (let k = 0; k < 3; k++) (hh[k] = _Hs[k]), (hd[k] = pd[k]);
}
