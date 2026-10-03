/** The stopping forecast remains research-only after the gameplay screen. */
export function configureWristBrakingTrial(params, armTrial) {
  const requested = params.get('wristBraking');
  const valid = requested === 'legacy' || requested === 'available';
  const blocked = valid && armTrial.model !== 'legacy';
  return {active: false, pending: valid && !blocked, blocked, model: 'legacy'};
}

export function applyWristBrakingTrial(info, player) {
  if (info.active) player.wristBrakingModel = info.model;
}

export function mountWristBrakingTrial(info) {
  if ((!info.pending && !info.blocked) || typeof document === 'undefined') return;
  const menu = document.getElementById('menuSub');
  if (!menu) return;
  const panel = document.createElement('p');
  panel.id = 'wristBrakingTrialInfo';
  panel.className = 'sub';
  panel.textContent = info.blocked ? '검 거두기 후보는 공개 보류 중입니다. 선택한 팔 제어로 실행합니다.'
    : '검 거두기 후보는 체감 개선 근거가 부족해 공개를 보류했습니다. 현재 방식으로 실행합니다.';
  menu.after(panel);
}
