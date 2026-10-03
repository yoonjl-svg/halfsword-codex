/** Session-local stopping forecast. Ordinary play keeps the nominal estimate. */
export function configureWristBrakingTrial(params, armTrial) {
  const requested = params.get('wristBraking');
  const valid = requested === 'legacy' || requested === 'available';
  const blocked = valid && armTrial.model !== 'legacy';
  return {active: valid && !blocked, blocked, model: valid && !blocked ? requested : 'legacy'};
}

export function applyWristBrakingTrial(info, player) {
  if (info.active) player.wristBrakingModel = info.model;
}

export function mountWristBrakingTrial(info) {
  if ((!info.active && !info.blocked) || typeof document === 'undefined') return;
  const menu = document.getElementById('menuSub');
  if (!menu) return;
  const panel = document.createElement('p');
  panel.id = 'wristBrakingTrialInfo';
  panel.className = 'sub';
  panel.textContent = info.blocked ? '검 거두기 비교와 팔 제어 비교는 따로 실행해 주세요.'
    : `검 거두기 비교 ${info.model === 'available' ? 'B' : 'A'} · 강하게 베고 멈추거나 반대로 거두어 보세요.`;
  menu.after(panel);
}
