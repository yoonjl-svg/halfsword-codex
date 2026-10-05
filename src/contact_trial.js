/** Two matched session-only contact comparisons on the ordinary v2 controller. */
export const CONTACT_TRIAL_WEAPONS = Object.freeze({longsword: '롱소드', zweihander: '츠바이핸더'});
const keys = new Set(['contactV2', 'weapon']);
export function configureContactTrial(params) {
  const requested = params.has('contactV2');
  const model = params.get('contactV2');
  const weapon = params.get('weapon') || 'longsword';
  const active = requested && params.getAll('contactV2').length === 1 &&
    ['legacy', 'centerline'].includes(model) && params.getAll('weapon').length <= 1 &&
    (!params.has('weapon') || !!params.get('weapon')) &&
    Object.hasOwn(CONTACT_TRIAL_WEAPONS, weapon) && [...params.keys()].every(key => keys.has(key));
  return {requested, active, model: active ? model : 'legacy', weapon: active ? weapon : null,
    foeWeapon: active ? (weapon === 'longsword' ? 'zweihander' : 'longsword') : null,
    settings: active ? {skill: '0.7', difficulty: 'normal'} : {}, playerOnly: true,
    labHref: './feature-lab.html#contact-v2-comparison', ordinaryHref: './'};
}

export function mountContactTrial(info) {
  if (!info.active || typeof document === 'undefined') return;
  const anchor = document.getElementById('menuSub');
  if (!anchor || document.getElementById('contactTrialInfo')) return;
  const panel = document.createElement('p'); panel.id = 'contactTrialInfo'; panel.className = 'sub';
  const title = document.createElement('span'); title.style.display = 'block';
  title.textContent = `타격 반작용 비교 ${info.model === 'centerline' ? 'B' : 'A'} · ${CONTACT_TRIAL_WEAPONS[info.weapon]}`;
  const note = document.createElement('span'); note.style.display = 'block';
  note.textContent = '검술 보정 v2는 같습니다. 타격 직후 상대의 반응과 팔·검의 움직임을 비교하세요.';
  const lab = document.createElement('a'); lab.id = 'contactTrialLab'; lab.href = info.labHref; lab.textContent = '비교 화면';
  const exit = document.createElement('a'); exit.id = 'contactTrialExit'; exit.href = info.ordinaryHref; exit.textContent = '일반 게임으로';
  for (const link of [lab, exit]) {link.style.color = 'var(--accent, #d9a441)'; link.style.display = 'inline-flex'; link.style.alignItems = 'center'; link.style.minHeight = '44px'; link.style.padding = '4px 6px';}
  panel.append(title, note, lab, document.createTextNode(' · '), exit); anchor.after(panel);
  const row = document.querySelector('[data-setting="skill"]')?.closest('.row');
  if (row) row.style.display = 'none';
}
