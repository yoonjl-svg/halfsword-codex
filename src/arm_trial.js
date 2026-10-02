/** URL-only explicit shoulder/wrist allocation trial; ordinary play stays legacy. */
export function configureArmTrial(params) {
  const requested = params.get('armTrial');
  return {
    active: requested === 'legacy' || requested === 'sharedCap',
    model: requested === 'sharedCap' ? 'sharedCap' : 'legacy',
  };
}

export function mountArmTrial(info) {
  if (!info.active || typeof document === 'undefined') return;
  const menuSub = document.getElementById('menuSub');
  if (!menuSub) return;
  let panel = document.getElementById('armTrialInfo');
  if (!panel) {
    panel = document.createElement('p');
    panel.id = 'armTrialInfo';
    panel.className = 'sub';
    menuSub.after(panel);
  }
  const label = document.createElement('span');
  label.textContent = info.model === 'sharedCap'
    ? '팔 제어 비교 B · 베기와 멈춤 시험 '
    : '팔 제어 비교 A · 현재 방식 ';
  const link = document.createElement('a');
  link.href = './feature-lab.html#arm-comparison';
  link.textContent = '비교 화면으로';
  link.style.color = 'var(--accent, #d9a441)';
  panel.replaceChildren(label, link);
}
