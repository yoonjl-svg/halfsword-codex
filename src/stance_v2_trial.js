/** Session-only recovery comparison on the current swordsmanship controller. */
const allowed = new Set(['stanceV2', 'weapon']);
export function configureStanceV2Trial(params) {
  const requested = params.has('stanceV2'), model = params.get('stanceV2');
  const weapon = params.get('weapon') || 'zweihander';
  const active = requested && params.getAll('stanceV2').length === 1 &&
    ['legacy', 'fresh'].includes(model) && params.getAll('weapon').length <= 1 &&
    (!params.has('weapon') || !!params.get('weapon')) && weapon === 'zweihander' &&
    [...params.keys()].every(key => allowed.has(key));
  return {requested, active, model: active ? model : 'legacy', weapon: active ? weapon : null,
    foeWeapon: active ? 'longsword' : null, settings: active ? {skill: '0.7', difficulty: 'normal'} : {},
    playerOnly: true, labHref: './feature-lab.html#stance-v2-comparison', ordinaryHref: './'};
}

export function mountStanceV2Trial(info) {
  if (!info.active || typeof document === 'undefined') return;
  const anchor = document.getElementById('menuSub');
  if (!anchor || document.getElementById('stanceV2TrialInfo')) return;
  const panel = document.createElement('p'); panel.id = 'stanceV2TrialInfo'; panel.className = 'sub';
  const title = document.createElement('span'); title.style.display = 'block';
  title.textContent = `일어난 뒤 다시 베기 ${info.model === 'fresh' ? 'B' : 'A'} · 츠바이핸더`;
  const note = document.createElement('span'); note.style.display = 'block';
  note.textContent = '검술 보정 v2는 같습니다. 넘어진 뒤 일어나 다시 베는 동작을 비교하세요.';
  const lab = document.createElement('a'); lab.id = 'stanceV2TrialLab'; lab.href = info.labHref; lab.textContent = '비교 화면';
  const exit = document.createElement('a'); exit.id = 'stanceV2TrialExit'; exit.href = info.ordinaryHref; exit.textContent = '일반 게임으로';
  for (const link of [lab, exit]) {link.style.color = 'var(--accent, #d9a441)'; link.style.display = 'inline-flex'; link.style.alignItems = 'center'; link.style.minHeight = '44px'; link.style.padding = '4px 6px';}
  panel.append(title, note, lab, document.createTextNode(' · '), exit); anchor.after(panel);
  const row = document.querySelector('[data-setting="skill"]')?.closest('.row');
  if (row) row.style.display = 'none';
}
