/** One-page research option; never writes saved game settings. */
export function configurePhysicalTrial(params, grip) {
  const active = params.get('physicsTrial') === 'grip';
  grip.reactionModel = active ? 'paired' : 'legacy';
  return { active, kind: active ? 'grip' : null, gripReaction: grip.reactionModel };
}

export function mountPhysicalTrial(info) {
  if (!info.active || typeof document === 'undefined') return;
  const menuSub = document.getElementById('menuSub');
  if (!menuSub) return;
  let panel = document.getElementById('physicalTrialInfo');
  if (!panel) {
    panel = document.createElement('p');
    panel.id = 'physicalTrialInfo';
    panel.className = 'sub';
    menuSub.after(panel);
  }
  const label = document.createElement('span');
  label.textContent = '그립 반작용 시험 · 양손 무기에 적용 ';
  const link = document.createElement('a');
  link.href = './force-lab.html';
  link.textContent = '비교 화면으로';
  link.style.color = 'var(--accent, #d9a441)';
  panel.replaceChildren(label, link);
}
