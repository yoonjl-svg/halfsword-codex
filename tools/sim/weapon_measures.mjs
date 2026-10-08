// 무기별 유파 간격 실측치 (docs/weapons.md §2, tools/sim/weapon_measure.mjs 로 잰 값).
// 헤드리스 무기 배터리(weapon_balance/weapon_trace)에서 AI 가 롱소드 간격(1.62/2.0)으로 짧은 칼을 휘두르지 않게,
// 판을 만든 뒤 AI 의 유파 measure 만 이 표로 바꿔 끼운다 (ai.js·schools.js 는 건드리지 않는다 — 캐릭터 PM 소유).
// 캐릭터 PM 의 schools.js 에 무기별 꾸러미가 다 생기면 이 표는 필요 없어진다.
// 10라운드 B: 한손 뻗기(guards.js) 뒤 hybrid(게임 기본)로 다시 잰 값 — ai.js MEASURED 와 같다 (롱소드 줄은 기본 AI 값 그대로)
export const WEAPON_MEASURES = {
  longsword: { contact: 1.62, reach: 2.0, clinch: 1.25, cutTime: 0.3 }, // 기본 AI 값 그대로 (회귀 기준)
  zweihander: { contact: 1.71, reach: 2.08, clinch: 1.32, cutTime: 0.48 },
  estoc: { contact: 1.57, reach: 1.99, clinch: 1.22, cutTime: 0.42 }, // 균형 재분배(칼날 0.72·폼멜 0.6kg) 후 재실측 1.75 → 유효 간격(칼 중간이 닿는 안쪽)
  sabre: { contact: 1.39, reach: 1.58, clinch: 1.07, cutTime: 0.36 },
  rapier: { contact: 1.54, reach: 1.68, clinch: 1.19, cutTime: 0.29 },
  falchion: { contact: 1.37, reach: 1.56, clinch: 1.06, cutTime: 0.33 },
  monohoshizao: { contact: 1.58, reach: 1.87, clinch: 1.22, cutTime: 0.47 }, // 균형 재분배(칼날 0.72·츠카 0.3kg) 후 재실측 — 전엔 칼끝이 무거워 휘두름이 머리 높이에 못 미쳐 1.09 로 나왔다
  qinggang: { contact: 1.35, reach: 1.52, clinch: 1.04, cutTime: 0.33 },
  excalibur: { contact: 1.55, reach: 1.83, clinch: 1.2, cutTime: 0.4 },
  excalibur_replica: { contact: 1.55, reach: 1.83, clinch: 1.2, cutTime: 0.4 },
  lightsaber: { contact: 1.46, reach: 1.65, clinch: 1.13, cutTime: 0.24 }, // 한손 자세표를 쓰지 않는다 (weapons.js oneHandStance)
  tree_branch: { contact: 1.41, reach: 1.55, clinch: 1.09, cutTime: 0.27 }, // 10/08 길이 -10%: 같은 입력의 거리 차이·시간 비율만 반영.
  rubber_chicken: { contact: 0.88, reach: 1.24, clinch: 0.68, cutTime: 0.18 },
  frozen_tuna: { contact: 1.36, reach: 1.63, clinch: 1.05, cutTime: 0.44 },
};

/** AI 하나의 유파 간격을 그 무기 실측치로 바꿔 끼운다 (롱소드는 그대로 두어 기본 AI 회귀를 지킨다) */
// cutTime 은 weapon_measure.mjs 가 거리와 달리 보정 없이 raw 로 적는다(롱소드 raw 0.43s). 그런데 롱소드 AI 는 0.3 을 쓴다 —
//  raw 그대로 끼우면 롱소드 말고 모든 무기의 AI 가 "내 베기는 롱소드보다 40% 늦다"고 착각해 너무 멀리서 공격을 걸었다
//  (3→4라운드 밸런스에서 확인한 근본 원인). 거리와 똑같이 롱소드 기준으로 보정한다: 0.3 × (무기 raw ÷ 롱소드 raw).
export const LONGSWORD_RAW_CUT = 0.41; // hybrid 재실측 롱소드 raw (예전 levitate 0.43)
export function applyWeaponMeasure(ai, weaponId) {
  const m = WEAPON_MEASURES[weaponId];
  if (!ai || !m || weaponId === 'longsword') return;
  const M = { ...m, cutTime: WEAPON_MEASURES.longsword.cutTime * (m.cutTime / LONGSWORD_RAW_CUT) };
  ai.school = { ...ai.school, measure: M };
  ai.M = M;
  // foeReach(상대 칼이 닿는 거리 어림)는 건드리지 않는다: 게임처럼 AI 생성자가 상대 무기로 정한 값(ai.foeM.reach + 0.05)을 쓴다.
  //  (예전엔 여기서 내 무기 사거리로 덮어써서, 짧은 칼 AI 가 롱소드 사거리를 짧게 어림하고 너무 가까이 서 있었다)
}
