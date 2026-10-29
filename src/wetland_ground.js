// ─────────────────────────────────────────────────────────────
//  잠든 습지(sluice) 진흙 웅덩이: 그림(stage_sluice.js)과 걸음(fighter.js)이 같은 정의를 읽는다
//   출처: 샛별 저장소 origin/main 325a5c38 의 src/wetland_ground.js 를 옮겨 고침 — 웅덩이 다섯·한가운데 자발 이동 40 % 는 그대로,
//   인물 신발의 감속 면제(terrainTraits)는 옮기지 않았다 (사장님 10/14 02:3x '진흙 감속 켬' · 디자인 결정 E, 확인표 1116)
//   결투장 좌표(m). 전역 난수·타이머·힘/피해 배율 없음. 다른 무대에서는 배율이 정확히 1 이다
// ─────────────────────────────────────────────────────────────
import { ARENA_SCALE } from './config.js';

export const WETLAND_PUDDLES = Object.freeze(
  [
    { x: -0.5, z: -2.0, rx: 2.0, rz: 1.1, phase: 0.7 },
    { x: 1.9, z: 2.3, rx: 1.9, rz: 1.15, phase: 2.2 },
    { x: -3.5, z: 2.7, rx: 1.3, rz: 0.85, phase: 4.1 },
    { x: 3.8, z: -2.8, rx: 1.4, rz: 0.95, phase: 1.8 },
    { x: -1.5, z: 4.6, rx: 1.4, rz: 0.75, phase: 3.4 },
  ].map(p => Object.freeze({ ...p, x: p.x * ARENA_SCALE, z: p.z * ARENA_SCALE, rx: p.rx * ARENA_SCALE, rz: p.rz * ARENA_SCALE })),
);
export const WETLAND_CORE_SPEED = 0.4; // 웅덩이 한가운데 자발 이동 배율
export const WETLAND_RIM = 0.3 * ARENA_SCALE; // 확대 후에도 같은 상대 위치에서 같은 감속
export const puddleOutline = (angle, phase) => 1 + 0.09 * Math.sin(angle * 3 + phase);
export const wetlandIslandRadius = (a) => ARENA_SCALE * (9.6 + 1.45 * Math.sin(a * 3 + 0.4) + 0.85 * Math.cos(a * 5 - 0.8));

/** 이 자리의 젖음 0~1 (웅덩이 가장자리 0.3 m 에서 부드럽게 — 그림의 물결·밟는 물결도 이 값을 쓴다) */
export function wetlandWetness(x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return 0;
  let wet = 0;
  for (const p of WETLAND_PUDDLES) {
    const dx = (x - p.x) / p.rx;
    const dz = (z - p.z) / p.rz;
    const radius = puddleOutline(Math.atan2(dz, dx), p.phase);
    const inset = (radius - Math.hypot(dx, dz)) * Math.min(p.rx, p.rz);
    const t = Math.max(0, Math.min(1, inset / WETLAND_RIM));
    wet = Math.max(wet, t * t * (3 - 2 * t));
  }
  return wet;
}
/** 자발 이동만 줄인다 (조종 입력·기술 내딛기). 균형 잡는 걸음·무기·중력·물리 시간은 그대로 */
export function wetlandMoveScale(x, z) {
  return 1 - (1 - WETLAND_CORE_SPEED) * wetlandWetness(x, z);
}
/** 싸움꾼 하나의 배율: 습지 무대가 아니면 1 (곱해도 값이 비트 단위로 같다) */
export function fighterWetlandMoveScale(fighter, x, z) {
  // Optional stage-owned surface contract (isolated capital ford trial). Existing string/null paths are unchanged.
  if (typeof fighter.movementSurface?.moveScaleAt === 'function') return fighter.movementSurface.moveScaleAt(x, z);
  return fighter.movementSurface === 'wetland' ? wetlandMoveScale(x, z) : 1;
}
export function configureWetlandMovement(fighter, stageId) {
  fighter.movementSurface = stageId === 'sluice' || stageId === 'sluice_night' ? 'wetland' : null;
  fighter.surfaceSpeedScale = 1;
}
