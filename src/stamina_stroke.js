import { G } from './ai_techniques.js';
import { STAMINA } from './config.js';

// 기력만의 준비/공격 구분. 유파의 자세·긋기·해금·몸 동작은 바꾸지 않는다.
const chambers = ['tag', 'tagR', 'tagL', 'ochsR', 'ochsL', 'sideR', 'sideL', 'pflugR', 'pflugL', 'nebenR'].map(k => G[k]);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** 손을 공격선으로 되돌리는 일반 자유 베기. 손의 위/아래 방향에 독립적이다. */
export function entersAttackLine(start, dir) {
  const x = start[0] - G.langort[0], y = start[1] - G.langort[1];
  const inward = -(x * dir[0] + y * dir[1]);
  return Math.hypot(x, y) > STAMINA.strokeCenter && inward > 0 &&
    Math.hypot(x + dir[0] * inward, y + dir[1] * inward) < STAMINA.strokeCenter;
}

/** 공격선을 가르지 않고 준비 자리에 옮겨 놓은 짧은 동작만 면제한다.
 *  접촉으로 확정한 공격이나 큰 원운동은 준비로 되돌리지 않는다. */
export function isPreparation(stroke) {
  if (!stroke || stroke.paid || stroke.matched || stroke.enters) return false;
  const direct = distance(stroke.start, stroke.end);
  return stroke.travel <= direct * 1.3 + 0.04 && direct < 0.9 &&
    chambers.some(p => distance(stroke.end, p) <= 0.12 && distance(stroke.start, p) > 0.15);
}
