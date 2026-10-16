// ─────────────────────────────────────────────────────────────
//  카메라 셈 (10/15 사장님 — docs/strike/camera_open_2026-10-15.md, 확인표 1560~1579): main.js updateCamera 가 부르고,
//  같은 함수를 노드 측정 도구(tools/sim/cam_follow_probe.mjs)가 그대로 불러 잰다 — 잰 것과 게임이 같은 셈.
//   ① 따라가기: 예전 두 번 거름(무게중심 follow 5 → 카메라 자리 6, 걷는 동안 ≈ 0.3~0.45 s 늦음)을 한 번으로.
//      따라가는 점 = 지금 몸 자리를 물리 스텝 사이 남은 시간(acc)만큼 지난 화면의 빠르기로 앞으로 민 자리 → CAMERA.followTau 로 거름.
//      (화면마다 물리 스텝이 2·3 개로 갈려 몸이 계단처럼 나아가는 것을 카메라가 따라 떨지 않는다)
//      물러나는 동안 카메라를 조금 올리고(retreatLift), 몸에서 수평 minDist 안으로는 들어가지 않는다.
//   ② 판 시작: 무대 훑기(그 무대 첫 판) · 내려앉기(같은 무대 다시 · `?openSweep=0` 의 9/30 꼴) — 끝(u = 1)에서 평소 자리와 정확히 같다.
//  그림만 바꾼다 — 물리·판정·시뮬과 무관 (시뮬 관문 도구는 이 파일을 읽지 않는다). 자리 값은 x·y·z 칸만 쓴다 (THREE.Vector3 든 그냥 객체든)
// ─────────────────────────────────────────────────────────────

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); }; // smoothstep: 양 끝 빠르기 0
const smoother = (x) => { const t = clamp01(x); return t * t * t * (t * (t * 6 - 15) + 10); }; // smootherstep: 양 끝 빠르기·가속 0
const between = (x, a, b) => smooth((x - a) / Math.max(1e-9, b - a));

// ── ① 따라가기 ──────────────────────────────────────────────

/** 따라가기 상태: f = 따라가는 점 · prev·vel = 지난 화면 몸 자리와 그 사이 빠르기(게임 m/s, 수평) · lift = 물러날 때 올린 몫 0~1. f 에 THREE.Vector3 를 넘겨 그대로 써도 된다 */
export function followState(f = { x: 0, y: 0, z: 0 }) {
  return { f, prev: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, lift: 0 };
}
/** 새 판: 따라가는 점을 지금 몸 자리에 바로 (지난 판 자리에서 미끄러져 오지 않게) */
export function followReset(S, p) {
  S.f.x = S.prev.x = p.x;
  S.f.y = S.prev.y = p.y;
  S.f.z = S.prev.z = p.z;
  S.vel.x = S.vel.y = S.vel.z = 0;
  S.lift = 0;
}
/**
 * 화면 하나: src = 지금 몸(물리 스텝 끝 무게중심) · steps = 이번 화면에 돈 물리 스텝 수 · acc = 남은 게임 시간(s) · dt = 화면 시간(실제 s)
 *  standing = 서 있나 (아니면 followTauDown 으로 천천히) · C = config CAMERA · step = PHYSICS.timestep. 돌려주는 것 = S.f
 */
export function followStep(S, src, steps, acc, dt, standing, C, step) {
  if (steps > 0) {
    const k = 1 / (steps * step);
    S.vel.x = (src.x - S.prev.x) * k;
    S.vel.y = 0;
    S.vel.z = (src.z - S.prev.z) * k;
    S.prev.x = src.x;
    S.prev.y = src.y;
    S.prev.z = src.z;
  }
  const g = 1 - Math.exp(-dt / (standing ? C.followTau : C.followTauDown));
  S.f.x += (src.x + S.vel.x * acc - S.f.x) * g;
  S.f.y += (src.y - S.f.y) * g;
  S.f.z += (src.z + S.vel.z * acc - S.f.z) * g;
  return S.f;
}
/** 물러날 때 올리기 (0~1): 지난 화면 몸 빠르기의 dir(나 → 상대) 반대 몫이 retreatFrom → retreatFull 사이에서 0 → 1, 오를 때 retreatRise · 내릴 때 retreatFall 로 */
export function retreatStep(S, dirX, dirZ, dt, standing, C) {
  const vBack = -(S.vel.x * dirX + S.vel.z * dirZ);
  const want = standing ? between(vBack, C.retreatFrom, C.retreatFull) : 0;
  S.lift += (want - S.lift) * (1 - Math.exp(-dt / (want > S.lift ? C.retreatRise : C.retreatFall)));
  return S.lift;
}
/** 평소 자리 (어깨 너머): 따라가는 점 a 에서 dir 반대로 back · 오른쪽으로 shoulder · 높이 height + retreatLift × lift + 땅 높이 */
export function basePose(a, dirX, dirZ, lift, groundY, C, out) {
  out.x = a.x - dirX * C.back - dirZ * C.shoulder;
  out.z = a.z - dirZ * C.back + dirX * C.shoulder;
  out.y = C.height + C.retreatLift * lift + groundY;
  return out;
}
/** 최소 거리: 지금 몸 src 에서 수평 minDist 안이면 그 방향으로 밀어낸다 (몸이 카메라 쪽으로 밀려 와도 그 자리에서 바로 물러난다) */
export function keepDistance(out, src, minDist) {
  const dx = out.x - src.x;
  const dz = out.z - src.z;
  const d = Math.hypot(dx, dz);
  if (d < minDist && d > 1e-6) {
    out.x = src.x + (dx / d) * minDist;
    out.z = src.z + (dz / d) * minDist;
  }
  return out;
}

// ── ② 판 시작 ───────────────────────────────────────────────

/** 기본 훑기 길 (무대 표에 없는 무대도 이 값) [사장님 확인 전 — 확인표 1567]
 *  r0·h0: 시작 자리의 무대 가운데에서 수평 거리 · 높이(m, 가운데 땅 위). arc: 도는 각(°) — 끝 자리(내 등 뒤)에서 거꾸로 잰 시작 각.
 *  dir: +1 = 위에서 볼 때 상대 쪽에서 내 오른쪽(카메라 어깨 쪽)을 돌아 내 등 뒤로 · −1 = 반대쪽(내 왼쪽)으로.
 *  lookY0: 시작 때 바라보는 무대 가운데 높이(m) — 높을수록 수평에 가깝게 둘레 경치를 본다. down: 높이·반지름이 줄기 시작하는 때(u) · look: 바라보는 점이 평소 자리로 옮겨 가기 시작하는 때(u) */
export const SWEEP_DEFAULT = Object.freeze({ r0: 9.0, h0: 4.2, arc: 150, dir: 1, lookY0: 1.6, down: 0.3, look: 0.35 });

/** 무대별 덮어쓰기 (없는 칸은 SWEEP_DEFAULT). 까닭은 문서 §3 표 — 둘레 검사(cam_open_shots.mjs --ring): 무대 가운데에서 반지름 r · 높이 h 둘레의 무대 메쉬까지 가장 가까운 거리 */
export const SWEEP_STAGE = Object.freeze({
  cathedral: { r0: 7.5 }, // 높은 창에서 내려오는 빛줄기 면(더하기 반투명)이 반지름 9 m 둘레에 닿는다(0.01~0.08 m, 방위 40~75°) — 8 m 0.8 m · 7 m 1.8 m
  sluice: { r0: 7.0, h0: 3.2 }, // 잠든 습지 빛줄기 면이 반지름 9 m 넘는 둘레(모든 높이) · 8 m 높이 3.5 m 이상 · 7 m 높이 5.5 m 이상에 닿는다(0.01~0.31 m) — 7 m · 2.5 m 1.7 m · 3.5 m 1.2 m
});

export function sweepParams(stageId) {
  if(stageId === 'sluice_night')stageId = 'sluice';
  return { ...SWEEP_DEFAULT, ...(SWEEP_STAGE[stageId] ?? {}) };
}

/**
 * 무대 훑기의 u 자리 (0 = 시작 · 1 = 끝 — 끝은 endPos/endLook 와 같고 빠르기 0).
 *  endPos·endLook: 지금 평소 따라가기 자리(카메라 · 바라보는 점) · centre: 무대 가운데 { x, z } · groundY: 가운데 땅 높이(평지 0)
 *  P: sweepParams() · outPos·outLook 에 채운다 (outLook 은 endLook 와 같은 객체여도 된다)
 *  도는 각은 처음부터 끝까지 smoothstep(가운데가 가장 빠르다), 높이·반지름·바라보는 점은 늦게 시작해 smootherstep 으로 내려앉는다
 */
export function sweepPose(u, endPos, endLook, centre, groundY, P, outPos, outLook) {
  const ex = endPos.x - centre.x;
  const ez = endPos.z - centre.z;
  const rEnd = Math.hypot(ex, ez);
  const aEnd = Math.atan2(ez, ex);
  const eA = smooth(u);
  const eD = smoother((u - P.down) / (1 - P.down));
  const eL = smoother((u - P.look) / (1 - P.look));
  const a = aEnd - P.dir * ((P.arc * Math.PI) / 180) * (1 - eA);
  const r = P.r0 + (rEnd - P.r0) * eD;
  outPos.x = centre.x + Math.cos(a) * r;
  outPos.z = centre.z + Math.sin(a) * r;
  outPos.y = groundY + P.h0 + (endPos.y - groundY - P.h0) * eD;
  outLook.x = centre.x + (endLook.x - centre.x) * eL;
  outLook.z = centre.z + (endLook.z - centre.z) * eL;
  outLook.y = groundY + P.lookY0 + (endLook.y - groundY - P.lookY0) * eL;
}

/**
 * 내려앉기 (같은 무대 다시 · `?openSweep=0` 의 9/30 판 시작): 평소 자리에서 dir 반대로 back · 위로 up 떨어진 자리 → 평소 자리.
 *  9/30 코드와 같은 꼴 — open = 1 − smoothstep(u) 를 뒤·위 몫에 곱한다 (바라보는 점은 평소 그대로)
 */
export function settlePose(u, endPos, endLook, dirX, dirZ, back, up, outPos, outLook) {
  const open = 1 - smooth(u);
  outPos.x = endPos.x - dirX * back * open;
  outPos.z = endPos.z - dirZ * back * open;
  outPos.y = endPos.y + up * open;
  outLook.x = endLook.x;
  outLook.y = endLook.y;
  outLook.z = endLook.z;
}
