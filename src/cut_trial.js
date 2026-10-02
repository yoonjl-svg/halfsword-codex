/** Session-only cutting comparison; no saved setting or default promotion. */
export function configureCutTrial(params) {
  const requested = params.get('cutTrial');
  return {
    active: requested === 'legacy' || requested === 'budgeted',
    model: requested === 'budgeted' ? 'budgeted' : 'legacy',
  };
}

export function mountCutTrial(info) {
  if (!info.active || typeof document === 'undefined') return;
  const menuSub = document.getElementById('menuSub');
  if (!menuSub) return;
  let panel = document.getElementById('cutTrialInfo');
  if (!panel) {
    panel = document.createElement('p');
    panel.id = 'cutTrialInfo';
    panel.className = 'sub';
    menuSub.after(panel);
  }
  const label = document.createElement('span');
  label.textContent = info.model === 'budgeted'
    ? '절삭 B · 자세 이상으로 재검증 중인 이전 시험 '
    : '절삭 비교 A · 현재 방식 ';
  const link = document.createElement('a');
  link.href = './feature-lab.html#cut-comparison';
  link.textContent = '비교 화면으로';
  link.style.color = 'var(--accent, #d9a441)';
  panel.replaceChildren(label, link);
}
