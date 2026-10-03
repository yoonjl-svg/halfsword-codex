/** Public URL activation is held until the remaining combat/regression gates pass. */
export function configureArmRecoveryTrial(params) {
  const requested = params.get('armRecoveryTrial');
  return {
    active: false,
    pending: requested === 'legacy' || requested === 'independent',
    model: 'legacy',
  };
}
export function applyArmRecoveryTrial(info, player) {
  if (info.active) player.armRecoveryModel = info.model;
}
export function mountArmRecoveryTrial(info) {
  if (!info.pending || typeof document === 'undefined') return;
  const menu = document.getElementById('menuSub');
  if (!menu) return;
  const panel = document.createElement('p');
  panel.id = 'armRecoveryTrialInfo';
  panel.className = 'sub';
  const label = document.createElement('span');
  label.textContent = '한손 회복 시험은 실제 전투·제동·발 지지 검증이 남아 공개를 보류했습니다. 현재 방식으로 실행합니다. ';
  const link = document.createElement('a');
  link.href = './feature-lab.html#arm-recovery-comparison';
  link.textContent = '검증 진행 안내';
  link.style.color = 'var(--accent, #d9a441)';
  panel.replaceChildren(label, link);
  menu.after(panel);
}
