// ─────────────────────────────────────────────────────────────
//  게임 무기 치수 읽기 (동작 연구 PM) — src/weapons.js 의 무기 스펙에서 손 자리·칼 길이·무게를 읽는다(게임 코드는 읽기만)
//   weaponGeom('zweihander') → { id, offHand, pommel, guard, tip, mass, com, inertia }
//   모든 길이 = 앞손(쥐는 점, 무기 원점)에서 칼 축을 따라 m. + = 칼끝 쪽.
// ─────────────────────────────────────────────────────────────
import { WEAPONS } from '../../../src/weapons.js';

/**
 * buildParts() 부품: [모양, 칼 축 자리 y, [질량, 무게중심 어긋남, Ie, It], 색, 칼날인가]
 *  offHand = gripAlong(뒷손 자리), pommel = 가장 뒤 부품 자리, guard = 칼날 아닌 부품 중 가장 앞 자리,
 *  tip = 자루 길이 + 칼날 길이, com = 질량 가중 무게중심, inertia = 앞손 둘레 휘두르는 관성 Σ(Ie + m·r²) — weapon_body.md §1 과 같은 셈
 */
export function weaponGeom(id) {
  const w = WEAPONS[id];
  if (!w) throw new Error(`src/weapons.js 에 무기 '${id}' 가 없다`);
  const parts = w.buildParts({ grip: 0, hilt: 0 });
  let m = 0, my = 0, I = 0;
  for (const [, y, [pm, cy, Ie]] of parts) {
    m += pm;
    my += pm * (y + cy);
    I += Ie + pm * (y + cy) ** 2;
  }
  const r3 = (x) => Math.round(x * 1000) / 1000;
  return {
    id,
    offHand: w.gripAlong,
    pommel: Math.min(...parts.map((p) => p[1])),
    guard: Math.max(...parts.filter((p) => !p[4]).map((p) => p[1])),
    tip: r3(w.hiltLength + w.bladeLength),
    mass: r3(m),
    com: r3(my / m),
    inertia: r3(I),
    inertiaExact: I, // 배율 셈용 (반올림 전)
    twoHand: w.twoHand,
    oneHandStance: w.oneHandStance,
  };
}

/** 클립 `grip` 칸: 이 클립이 가정한 칼 치수 (앞손에서 칼 축 m, 무게 kg, 관성 kg·m²) — 읽는 쪽이 손 자리를 게임과 맞춰 볼 수 있게 */
export function gripField(id) {
  const g = weaponGeom(id);
  return { hands: g.twoHand ? 2 : 1, offHand: g.twoHand ? g.offHand : null, pommel: g.pommel, guard: g.guard, tip: g.tip, mass: g.mass, com: g.com, inertia: g.inertia, from: `src/weapons.js ${id}` };
}
