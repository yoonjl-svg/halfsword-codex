/** Session-only recut comparison using the current ordinary sword controller. */
export const RECUT_V2_WEAPONS = Object.freeze({longsword: '롱소드', qinggang: '청강검'});
const keys = new Set(['recutV2', 'weapon']);
export function configureRecutV2Trial(params) {
  const requested = params.has('recutV2'), model = params.get('recutV2');
  const weapon = params.get('weapon') || 'longsword';
  const active = requested && params.getAll('recutV2').length === 1 &&
    ['baseline', 'bounded'].includes(model) && params.getAll('weapon').length <= 1 &&
    (!params.has('weapon') || !!params.get('weapon')) &&
    Object.hasOwn(RECUT_V2_WEAPONS, weapon) && [...params.keys()].every(key => keys.has(key));
  return {requested, active, model: active ? model : null,
    rollModel: active && model === 'bounded' ? 'bounded' : 'legacy',
    weapon: active ? weapon : null, foeWeapon: active ? 'longsword' : null,
    settings: active ? {skill: '0.7', difficulty: 'normal'} : {}, playerOnly: true,
    labHref: './feature-lab.html#recut-v2-comparison', ordinaryHref: './'};
}

export function mountRecutV2Trial(info) {
  if (!info.active || typeof document === 'undefined') return;
  const anchor = document.getElementById('menuSub');
  if (!anchor || document.getElementById('recutV2TrialInfo')) return;
  const panel = document.createElement('p'); panel.id = 'recutV2TrialInfo'; panel.className = 'sub';
  const title = document.createElement('span'); title.style.display = 'block';
  title.textContent = `재베기 방향 전환 ${info.model === 'bounded' ? 'B' : 'A'} · ${RECUT_V2_WEAPONS[info.weapon]}`;
  const note = document.createElement('span'); note.style.display = 'block';
  note.textContent = '공격 뒤 반대로 베거나, 손을 놓았다 다시 베어 보세요. 검술 보정 v2와 중력은 같습니다.';
  const lab = document.createElement('a'); lab.id = 'recutV2TrialLab'; lab.href = info.labHref; lab.textContent = '비교 화면';
  const exit = document.createElement('a'); exit.id = 'recutV2TrialExit'; exit.href = info.ordinaryHref; exit.textContent = '일반 게임으로';
  for (const link of [lab, exit]) {link.style.color = 'var(--accent, #d9a441)'; link.style.display = 'inline-flex'; link.style.alignItems = 'center'; link.style.minHeight = '44px'; link.style.padding = '4px 6px';}
  panel.append(title, note, lab, document.createTextNode(' · '), exit); anchor.after(panel);
  const row = document.querySelector('[data-setting="skill"]')?.closest('.row');
  if (row) row.style.display = 'none';
}
