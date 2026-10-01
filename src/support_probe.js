const SOURCE_BASE = '14bcf1f+혼합수정';

function ratio(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 && number <= 1 ? number : null;
}

/** 탐색 옵션은 이번 접속의 GAIT에만 적용한다. 저장된 게임 설정은 읽거나 쓰지 않는다. */
export function configureSupportProbe(params, gait) {
  const active = params.get('supportProbe') === '1';
  if (active) {
    const assist = ratio(params.get('assist'));
    const catchScale = ratio(params.get('catchScale'));
    const catchMode = params.get('catch');
    if (assist !== null) gait.assist = assist;
    if (catchScale !== null) gait.catchScale = catchScale;
    if (['on', 'fall', 'off'].includes(catchMode)) gait.catchMode = catchMode;
  }
  return {
    active,
    assist: gait.assist,
    catchMode: gait.catchMode,
    catchScale: gait.catchScale,
    sourceBase: SOURCE_BASE,
  };
}

/** 메뉴 DOM이 준비된 뒤 호출한다. 여러 번 호출해도 표시를 하나만 만든다. */
export function mountSupportProbe(info) {
  if (!info.active || typeof document === 'undefined') return;
  const menuSub = document.getElementById('menuSub');
  if (!menuSub) return;
  let panel = document.getElementById('supportProbeInfo');
  if (!panel) {
    panel = document.createElement('p');
    panel.id = 'supportProbeInfo';
    panel.className = 'sub';
    menuSub.after(panel);
  }
  const label = document.createElement('span');
  label.textContent = `비교 후보 · 받침 ${info.assist} · 반사 ${info.catchMode} · 반사 세기 ${info.catchScale} `;
  const link = document.createElement('a');
  link.href = './support-lab.html';
  link.textContent = '후보 비교로 돌아가기';
  link.style.color = 'var(--accent, #d9a441)';
  panel.replaceChildren(label, link);
}
