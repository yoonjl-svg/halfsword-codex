/** Session-only player blade-plane torque comparison, selected before step one. */
export function configureEdgeTorqueTrial(params) {
  const requested = params.get('edgeTrial');
  return {
    active: requested === 'legacy' || requested === 'continuous',
    model: requested === 'continuous' ? 'planePotential' : 'legacy',
  };
}

export function applyEdgeTorqueTrial(info, player) {
  if (info.active) player.edgeTorqueModel = info.model;
}

export function mountEdgeTorqueTrial(info) {
  if (!info.active || typeof document === 'undefined') return;
  const menuSub = document.getElementById('menuSub');
  if (!menuSub) return;
  let panel = document.getElementById('edgeTorqueTrialInfo');
  if (!panel) {
    panel = document.createElement('p');
    panel.id = 'edgeTorqueTrialInfo';
    panel.className = 'sub';
    menuSub.after(panel);
  }
  const label = document.createElement('span');
  label.textContent = info.model === 'planePotential'
    ? '날 정렬 비교 B · 급회전 완화 시험 '
    : '날 정렬 비교 A · 현재 방식 ';
  const link = document.createElement('a');
  link.href = './feature-lab.html#edge-comparison';
  link.textContent = '비교 화면으로';
  link.style.color = 'var(--accent, #d9a441)';
  panel.replaceChildren(label, link);
}
