/** One session-only swordsmanship trial; no strength or feature switches in its URL. */
import { WEAPON_LIST } from './weapons.js';

// Preserve the published roster of this older trial. Current ordinary/preview
// adoption is decided separately in swordsmanship_default.js.
const WITHHELD = new Set(['monohoshizao', 'lightsaber']);
export const SWORDSMANSHIP_WEAPONS = Object.freeze(WEAPON_LIST.filter(weapon => !WITHHELD.has(weapon.id)).map(weapon =>
  Object.freeze({ id: weapon.id, name: weapon.nameKo })));
const WEAPON_IDS = new Set(SWORDSMANSHIP_WEAPONS.map(weapon => weapon.id));
const KEYS = new Set(['swordsmanshipTrial', 'weapon']);

export function configureSwordsmanshipTrial(params) {
  const requested = params.has('swordsmanshipTrial');
  const weapon = params.has('weapon') ? params.get('weapon') : 'qinggang';
  const active = requested && params.getAll('swordsmanshipTrial').length === 1 &&
    params.get('swordsmanshipTrial') === 'unified' && params.getAll('weapon').length <= 1 &&
    WEAPON_IDS.has(weapon) && [...params.keys()].every(key => KEYS.has(key));
  return {
    requested, active,
    model: active ? 'unified' : 'legacy',
    weapon: active ? weapon : null,
    reason: active ? 'exact_unified_entry' : requested ? 'unsupported_or_incomplete_entry' : 'not_requested',
    settings: active ? { skill: '0.7', difficulty: 'normal' } : {},
    playerOnly: true,
    foe: active ? 'heinrich' : null,
    foeWeapon: active ? 'longsword' : null,
    labHref: './feature-lab.html#swordsmanship-trial',
    ordinaryHref: './',
  };
}

/** Navigation only. The caller applies the fixed session policy before the first step. */
export function mountSwordsmanshipTrial(info) {
  if (!info.active || typeof document === 'undefined') return;
  const menuSub = document.getElementById('menuSub');
  if (!menuSub || document.getElementById('swordsmanshipTrialInfo')) return;
  const panel = document.createElement('p');
  panel.id = 'swordsmanshipTrialInfo';
  panel.className = 'sub';
  const label = document.createElement('span');
  label.style.display = 'block';
  label.textContent = `검술 보정 통합 시험 · ${SWORDSMANSHIP_WEAPONS.find(weapon => weapon.id === info.weapon).name}`;
  const lab = document.createElement('a');
  lab.id = 'swordsmanshipLab';
  lab.href = info.labHref;
  lab.textContent = '무기 바꾸기';
  const exit = document.createElement('a');
  exit.id = 'swordsmanshipExit';
  exit.href = info.ordinaryHref;
  exit.textContent = '일반 게임으로';
  for (const link of [lab, exit]) {
    link.style.color = 'var(--accent, #d9a441)';
    link.style.display = 'inline-flex';
    link.style.alignItems = 'center';
    link.style.minHeight = '44px';
    link.style.padding = '4px 6px';
  }
  const note = document.createElement('span');
  note.style.display = 'block';
  note.textContent = '무기는 시험 화면에서 바꿀 수 있습니다. 설정은 이번 플레이에만 적용됩니다.';
  panel.append(label, lab, document.createTextNode(' · '), exit, note);
  menuSub.after(panel);
  const skillRow = document.querySelector('[data-setting="skill"]')?.closest('.row');
  if (skillRow) skillRow.style.display = 'none';
}
