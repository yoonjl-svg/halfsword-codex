import { UNIQUE_ASSIST as UA } from './config.js';
import { G, TECH } from './ai_techniques.js';
const hyp = Math.hypot;
function angDeg(a, b) {
  const na = hyp(a[0], a[1]), nb = hyp(b[0], b[1]);
  if (na < 1e-9 || nb < 1e-9) return 180;
  return Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1]) / (na * nb)))) / (Math.PI / 180);
}

// 해금과 무관한 순수 분류. 고유 동작과 기력 장부가 같은 규칙을 쓴다.
export function classifyStroke(start, dir) {
    let pad = null;
    let pd = UA.padRadius;
    for (const [name, p] of Object.entries(G)) {
      if (name === 'kron') continue; // 왕관은 막기 자리 (긋기 시작 자세 아님)
      const d = hyp(start[0] - p[0], start[1] - p[1]);
      if (d <= pd) {
        pd = d;
        pad = name;
      }
    }
    if (!pad) return { pad: null, tech: null, kind: 'cut' };
    const t = TECH.find((x) => x.from === G[pad]);
    if (t && angDeg(dir, [t.path[0][0] - t.from[0], t.path[0][1] - t.from[1]]) <= UA.angle) return { pad, tech: t.name, kind: t.kind };
    return { pad, tech: null, kind: 'cut' };
  }
