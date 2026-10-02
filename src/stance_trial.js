/** URL-only legacy-support stance-memory comparison; never saved. */
export function configureStanceTrial(params, gait) {
  const requested = params.get('stanceTrial');
  const model = requested === 'fresh' ? 'fresh' : 'legacy';
  gait.stanceMemory = model;
  return { active: requested === 'fresh' || requested === 'legacy', model };
}

export function mountStanceTrial(info) {
  if (!info.active || typeof document === 'undefined') return;
  const menuSub = document.getElementById('menuSub');
  if (!menuSub) return;
  let panel = document.getElementById('stanceTrialInfo');
  if (!panel) {
    panel = document.createElement('p');
    panel.id = 'stanceTrialInfo';
    panel.className = 'sub';
    menuSub.after(panel);
  }
  const label = document.createElement('span');
  label.textContent = info.model === 'fresh'
    ? '기립 비교 B · 새 발 디딤 시험 '
    : '기립 비교 A · 현재 방식 ';
  const link = document.createElement('a');
  link.href = './feature-lab.html#stance-comparison';
  link.textContent = '비교 화면으로';
  link.style.color = 'var(--accent, #d9a441)';
  panel.replaceChildren(label, link);
}
