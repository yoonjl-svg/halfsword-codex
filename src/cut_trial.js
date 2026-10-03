/** The failed cutting candidate is withdrawn, including previously shared URLs. */
export function configureCutTrial(params) {
  const requested = params.get('cutTrial');
  return {
    active: requested === 'legacy',
    withdrawn: requested === 'budgeted',
    model: 'legacy',
  };
}

export function mountCutTrial(info) {
  if ((!info.active && !info.withdrawn) || typeof document === 'undefined') return;
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
  label.textContent = info.withdrawn
    ? '절삭 B는 자세·동작 악화로 철회했습니다. 현재 절삭 방식으로 실행합니다. '
    : '절삭 비교 A · 현재 방식 ';
  const link = document.createElement('a');
  link.href = './feature-lab.html#cut-comparison';
  link.textContent = info.withdrawn ? '철회 안내' : '시험판 안내';
  link.style.color = 'var(--accent, #d9a441)';
  panel.replaceChildren(label, link);
}
