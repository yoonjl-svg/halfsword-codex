/** Session-only one-hand recovery comparison; never persisted as a setting. */
export function configureArmRecoveryTrial(params) {
  const requested = params.get('armRecoveryTrial');
  return {
    active: requested === 'legacy' || requested === 'independent',
    model: requested === 'independent' ? 'independent' : 'legacy',
  };
}
export function applyArmRecoveryTrial(info, player) {
  if (info.active) player.armRecoveryModel = info.model;
}
export function mountArmRecoveryTrial(info) {
  if (!info.active || typeof document === 'undefined') return;
  const menu = document.getElementById('menuSub');
  if (!menu) return;
  const panel = document.createElement('p');
  panel.id = 'armRecoveryTrialInfo';
  panel.className = 'sub';
  const label = document.createElement('span');
  label.textContent = info.model === 'independent'
    ? '한손 회복 비교 B · 피격 후 팔 제어 시험 '
    : '한손 회복 비교 A · 현재 방식 ';
  const link = document.createElement('a');
  link.href = './feature-lab.html#arm-recovery-comparison';
  link.textContent = '비교 화면으로';
  link.style.color = 'var(--accent, #d9a441)';
  panel.replaceChildren(label, link);
  menu.after(panel);
}
