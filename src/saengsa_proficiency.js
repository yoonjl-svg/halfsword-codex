// 생사전 숙련도 (사장님 10/29 14:1x 요지 — 모든 캐릭터는 주 유파만이 아니라 유파마다 숙련도가 있다)
//  출처 = src/character_temperament.js PROFICIENCY · proficiencyOf (인물 성향 작업 — 10/29 합침 · 확인 전, 기본 유파 칸만 사장님 결정). 그 표가 바뀌면 여기는 그대로 따라간다.
//  꼴 = { german, italian, iberian, japanese, chinese } + 무유파가 주 유파인 인물만 none(브론 · 마야 · 김씨) — 카드는 none 칸을 그 인물에게만 보인다.
//  무명 검객(15:5x)은 표 밖: 대회마다 새로 만든다(saengsa_rules.js makeNameless — 사장님 10/29 18:2x · 확인표 2796) — 여기서는 만들기 전 빈 칸(모두 0).
//  무유파 무기를 든 사람의 셈(none 칸이 없을 때)은 빠른 셈 쪽 규칙 — saengsa_rules.js profFor
//  얼터(광기의 …): 원본 칸(character_temperament.js 가 _mad 를 원본으로) + 얼터 +1 규칙 — 얼터 시트 무기 유파 칸 = max(원본 칸, 그 얼터의 실력 숙련도 ai.proficiency)
//   (characters.js VARIANT_PLUS — 원본 숙련도 + 1 · 상한 AI_PROFICIENCY.max 6 — 사장님 10/29 22:4x 상한 6 · 광기의 미나미 6 · 아르토리아 6)
import { proficiencyOf as temperamentProficiency } from './character_temperament.js';
import { CHARACTERS_BY_ID } from './characters.js';
import { getWeapon } from './weapons.js';
import { traditionOf } from './schools.js';

/** 다섯 유파 (카드 차례) */
export const PROF_SCHOOLS = Object.freeze(['german', 'italian', 'iberian', 'japanese', 'chinese']);

/** 인물 id → 숙련도 사본 (변형 id 는 원본 칸 · 무명 검객은 만들기 전 모두 0 — 신청 때 makeNameless 가 덮음 · 모르는 인물은 모두 0) */
export function proficiencyOf(id) {
  if (id === 'nameless') return Object.fromEntries(PROF_SCHOOLS.map((s) => [s, 0]));
  const row = temperamentProficiency(id);
  const out = Object.fromEntries(PROF_SCHOOLS.map((s) => [s, row?.[s] ?? 0]));
  if (row && 'none' in row) out.none = row.none;
  const c = CHARACTERS_BY_ID[id];
  if (c?.variantOf && c.weapon && Number.isFinite(c.ai?.proficiency)) { // 얼터 +1 (시트 무기 유파 칸)
    const school = traditionOf(getWeapon(c.weapon));
    if (school in out || school === 'none') out[school] = Math.max(out[school] ?? 0, c.ai.proficiency);
  }
  return out;
}
