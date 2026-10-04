/** Narrow session-only entry for the compound Qinggang mobile comparison. */
const COMMON = {
  combatTrial: 'integrated',
  weapon: 'qinggang',
  foeWeapon: 'longsword',
  foe: 'heinrich',
  targetCorrection: 'none',
  onehandArm: 'manual',
  bladeShape: 'profile',
};
const KEYS = new Set([...Object.keys(COMMON), 'thrustPlane', 'finishRule']);

export function configureIntegratedCombatTrial(params) {
  const requested = params.has('combatTrial');
  const common = Object.entries(COMMON).every(([key, value]) =>
    params.getAll(key).length === 1 && params.get(key) === value);
  const known = [...params.keys()].every(key => KEYS.has(key));
  const uniqueModes = ['thrustPlane', 'finishRule'].every(key => params.getAll(key).length === 1);
  const baseline = params.get('thrustPlane') === 'legacy' && params.get('finishRule') === 'legacy';
  const combined = params.get('thrustPlane') === 'transported' && params.get('finishRule') === 'armorCausal';
  const active = common && known && uniqueModes && (baseline || combined);
  return {
    requested,
    active,
    variant: active ? (combined ? 'B' : 'A') : null,
    model: active ? (combined ? 'combined' : 'baseline') : 'legacy',
    reason: active ? 'exact_compound_tuple' : requested ? 'unsupported_or_incomplete_tuple' : 'not_requested',
    settings: active ? { skill: '0', difficulty: 'normal' } : {},
    playerOnly: true,
    finishRule: active && combined ? 'armorCausal' : 'legacy',
    thrustPlane: active && combined ? 'transported' : 'legacy',
    foe: active ? 'heinrich' : null,
    compareHref: './feature-lab.html#integrated-combat-comparison',
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
  label.textContent = info.variant === 'B'
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
  note.textContent = '보정 끔 / 상대 보통 · 저장 선호 유지. 두 변경을 함께 비교합니다.';
  panel.append(label, compare, document.createTextNode(' · '), exit, note);
  menuSub.after(panel);
}
