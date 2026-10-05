/** Narrow session-only entry for the compound Qinggang mobile comparison. */
import { MOTION_ASSIST } from './motion_assist.js';
const COMMON = {
  combatTrial: 'integrated',
  weapon: 'qinggang',
  foeWeapon: 'longsword',
  foe: 'heinrich',
  targetCorrection: 'none',
  onehandArm: 'manual',
  bladeShape: 'profile',
};
const KEYS = new Set([...Object.keys(COMMON), 'thrustPlane', 'finishRule', 'motionAssist', 'motionTiming', 'swordAssist']);

export function configureIntegratedCombatTrial(params) {
  const requested = params.has('combatTrial');
  const common = Object.entries(COMMON).every(([key, value]) =>
    params.getAll(key).length === 1 && params.get(key) === value);
  const known = [...params.keys()].every(key => KEYS.has(key));
  const uniqueModes = ['thrustPlane', 'finishRule'].every(key => params.getAll(key).length === 1);
  const baseline = params.get('thrustPlane') === 'legacy' && params.get('finishRule') === 'legacy';
  const combined = params.get('thrustPlane') === 'transported' && params.get('finishRule') === 'armorCausal';
  const motionRequested = params.has('motionAssist');
  const motion = params.get('motionAssist');
  const motionValid = motionRequested && params.getAll('motionAssist').length === 1 && ['none', 'weak'].includes(motion) && combined;
  const timingRequested = params.has('motionTiming');
  const timing = params.get('motionTiming');
  const timingValid = timingRequested && params.getAll('motionTiming').length === 1 &&
    ['baseline', 'sequenced'].includes(timing) && motionValid && motion === 'weak';
  const swordRequested = params.has('swordAssist'), sword = params.get('swordAssist');
  const swordValid = swordRequested && params.getAll('swordAssist').length === 1 &&
    ['none', 'v2'].includes(sword) && timingValid && timing === 'sequenced';
  const active = common && known && uniqueModes && (swordRequested ? swordValid : timingRequested ? timingValid : motionRequested ? motionValid : baseline || combined);
  const comparison = active && swordRequested ? 'sword' : active && timingRequested ? 'force' : active && motionRequested ? 'motion' : 'compound';
  const variantB = comparison === 'sword' ? sword === 'v2' : comparison === 'force' ? timing === 'sequenced' : comparison === 'motion' ? motion === 'weak' : combined;
  return {
    requested,
    active,
    variant: active ? (variantB ? 'B' : 'A') : null,
    model: active ? (comparison === 'sword' ? `sword-${sword}` : comparison === 'force' ? `force-${timing}` : comparison === 'motion' ? `motion-${motion}` : combined ? 'combined' : 'baseline') : 'legacy',
    comparison,
    motionAssist: active && motionRequested ? motion : 'none',
    motionTiming: active && timingRequested ? timing : null,
    swordAssist: active && swordRequested ? sword : null,
    reason: active ? (swordRequested ? 'exact_sword_tuple' : timingRequested ? 'exact_force_tuple' : motionRequested ? 'exact_motion_tuple' : 'exact_compound_tuple') : requested ? 'unsupported_or_incomplete_tuple' : 'not_requested',
    settings: active ? { skill: '0', difficulty: 'normal' } : {},
    playerOnly: true,
    finishRule: active && combined ? 'armorCausal' : 'legacy',
    thrustPlane: active && combined ? 'transported' : 'legacy',
    foe: active ? 'heinrich' : null,
    compareHref: comparison === 'sword' ? './feature-lab.html#sword-assist-v2-comparison' : comparison === 'force' ? './feature-lab.html#motion-force-comparison' : './feature-lab.html#integrated-combat-comparison',
    ordinaryHref: './',
  };
}

/** UI navigation only: never rewrites stored preferences or changes a fighter. */
export function mountIntegratedCombatTrial(info) {
  if (!info.active || typeof document === 'undefined') return;
  const menuSub = document.getElementById('menuSub');
  if (!menuSub || document.getElementById('integratedCombatTrialInfo')) return;
  const panel = document.createElement('p');
  panel.id = 'integratedCombatTrialInfo';
  panel.className = 'sub';
  const label = document.createElement('span');
  label.style.display = 'block';
  label.textContent = info.comparison === 'sword'
    ? `검술 보정 v2 비교 ${info.variant} · ${info.variant === 'B' ? '자세 안내·복귀' : '기존 몸 선행'}. `
    : info.comparison === 'force'
    ? `연속 몸 협조 비교 ${info.variant} · ${info.variant === 'A' ? '기존 몸 협조' : '몸 선행 협조'}. `
    : info.comparison === 'motion'
    ? `통합 동작 비교 ${info.variant} · 동작 보정 ${info.motionAssist === 'weak' ? `약 (${Math.round(MOTION_ASSIST.strength * 100)}%)` : '끔'}. `
    : info.variant === 'B'
    ? '통합 비교 B · 찌르기 날 방향과 갑옷 마무리 판정 시험. '
    : '통합 비교 A · 기존 찌르기와 마무리 판정. ';
  const compare = document.createElement('a');
  compare.id = 'integratedCombatCompare';
  compare.href = info.compareHref;
  compare.textContent = 'A/B 비교로';
  const exit = document.createElement('a');
  exit.id = 'integratedCombatExit';
  exit.href = info.ordinaryHref;
  exit.textContent = '일반 게임으로';
  for (const link of [compare, exit]) {
    link.style.color = 'var(--accent, #d9a441)';
    link.style.display = 'inline-flex';
    link.style.alignItems = 'center';
    link.style.minHeight = '44px';
    link.style.padding = '4px 6px';
  }
  const note = document.createElement('span');
  note.style.display = 'block';
  note.textContent = info.comparison === 'sword'
    ? '청강검 · B는 잡고 있으면 유지하고 놓으면 준비 자세로 복귀. 양쪽 몸 선행 협조·저장 선호 유지.'
    : info.comparison === 'force'
    ? '같은 청강검 통합판 · 좌우·사선 베기의 몸 협조 순서만 비교합니다. 근력·관성·저장 선호 유지.'
    : info.comparison === 'motion'
    ? '같은 통합 조합 · 드래그 방향·높이 유지. 팔 깊이와 몸통 협조만 비교합니다. 저장 선호 유지.'
    : '보정 끔 / 상대 보통 · 저장 선호 유지. 두 변경을 함께 비교합니다.';
  panel.append(label, compare, document.createTextNode(' · '), exit, note);
  menuSub.after(panel);
  // The old skill switches mix several features and do not describe this trial.
  const legacyRow = document.querySelector('[data-setting="skill"]')?.closest('.row');
  if (legacyRow) legacyRow.style.display = 'none';
}
