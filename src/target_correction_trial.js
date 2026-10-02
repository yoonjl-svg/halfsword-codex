/** Session-only player target correction; applied when a new round is created. */
export function configureTargetCorrectionTrial(params) {
  const requested = params.get('targetCorrection');
  const valid = requested === 'none' || requested === 'weak';
  const blockedByVertical = valid && params.get('inputComparison') === 'vertical';
  const active = valid && !blockedByVertical;
  const level = requested === 'weak' ? 0.4 : 0;
  return {
    requested: valid ? requested : null,
    active,
    blockedByVertical,
    model: active ? requested : 'legacy',
    level: active ? level : null,
    autoGuard: active ? requested === 'weak' : null,
    settings: active ? { skill: String(level), difficulty: 'normal' } : {},
  };
}

/** Call after normal player initialization and before any controller/physics step. */
export function applyTargetCorrectionTrial(info, player) {
  if (!info.active) return false;
  player.skill.level = info.level;
  player.skill.autoGuard = info.autoGuard;
  return true;
}

/** Compare the round-local candidate; this does not promote ordinary settings. */
export function mountTargetCorrectionTrial(info) {
  if ((!info.active && !info.blockedByVertical) || typeof document === 'undefined') return;
  const menuSub = document.getElementById('menuSub');
  if (!menuSub) return;
  let panel = document.getElementById('targetCorrectionTrialInfo');
  if (!panel) {
    panel = document.createElement('p');
    panel.id = 'targetCorrectionTrialInfo';
    panel.className = 'sub';
    menuSub.after(panel);
  }
  panel.textContent = info.blockedByVertical
    ? '세로 입력 비교 조건을 우선 적용합니다. 보정 비교 옵션은 적용되지 않습니다.'
    : `보정 ${info.model === 'none' ? '끔' : '약'} · 비교 후보 · 새 라운드에 적용 · 저장 설정 유지. 짧은 칼은 막은 뒤 자동으로 내딛을 수 있습니다.`;
}
