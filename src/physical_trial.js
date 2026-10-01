/** One-page research option; never writes saved game settings. */
export function configurePhysicalTrial(params, grip, body) {
  const requested = params.get('physicsTrial');
  const kind = ['legacyGrip', 'grip', 'support'].includes(requested) ? requested : null;
  grip.reactionModel = kind === 'legacyGrip' ? 'legacy' : 'paired';
  body.supportModel = kind === 'support' ? 'axial' : 'legacy';
  return {
    active: kind !== null,
    kind,
    gripReaction: grip.reactionModel,
    supportModel: body.supportModel,
  };
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
  label.textContent = info.kind === 'support'
    ? '다리·지면 지지 시험 · 현재 기준 그립 사용 '
    : info.kind === 'legacyGrip'
      ? '이전 그립 비교 · 일반 게임과 다른 이전 방식 '
      : '현재 기준 그립 · 양손 무기에 적용 ';
  const link = document.createElement('a');
  link.href = info.kind === 'support' ? './support-transfer-lab.html' : './force-lab.html';
  link.textContent = '비교 화면으로';
  link.style.color = 'var(--accent, #d9a441)';
  panel.replaceChildren(label, link);
}
