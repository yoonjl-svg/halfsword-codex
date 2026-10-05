/** Player-only combination of the existing recovery and contact candidates. */
const allowed = new Set(['recoveryContactV2', 'weapon']);
export function configureRecoveryContactV2Trial(params) {
  const requested = params.has('recoveryContactV2'), model = params.get('recoveryContactV2');
  const active = requested && params.getAll('recoveryContactV2').length === 1 &&
    ['baseline', 'combined'].includes(model) && params.getAll('weapon').length <= 1 &&
    (!params.has('weapon') || params.get('weapon') === 'zweihander') &&
    [...params.keys()].every(key => allowed.has(key));
  return {requested, active, model: active ? model : null,
    cutModel: active && model === 'combined' ? 'centerline' : 'legacy',
    stanceModel: active ? 'fresh' : 'legacy',
    weapon: active ? 'zweihander' : null, foeWeapon: active ? 'longsword' : null,
    settings: active ? {skill: '0.7', difficulty: 'normal'} : {},
    playerOnly: true, labHref: './feature-lab.html#recovery-contact-v2-comparison', ordinaryHref: './'};
}

export function mountRecoveryContactV2Trial(info) {
  if (!info.active || typeof document === 'undefined') return;
  const anchor = document.getElementById('menuSub');
  if (!anchor || document.getElementById('recoveryContactV2TrialInfo')) return;
  const panel = document.createElement('p'); panel.id = 'recoveryContactV2TrialInfo'; panel.className = 'sub';
  const title = document.createElement('span'); title.style.display = 'block';
  title.textContent = `${info.model === 'combined' ? '회복+타격 B' : '기준 · 기존 회복 B'} · 츠바이핸더`;
  const note = document.createElement('span'); note.style.display = 'block';
  note.textContent = '검술 보정 v2·중력 9.81은 같습니다. 시작 2초 뒤 칼을 낮춰 공격을 기다리고, 일어서면 조금 전진하며 다시 베어 보세요.';
  const lab = document.createElement('a'); lab.id = 'recoveryContactV2TrialLab'; lab.href = info.labHref; lab.textContent = '통합 비교 화면';
  const exit = document.createElement('a'); exit.id = 'recoveryContactV2TrialExit'; exit.href = info.ordinaryHref; exit.textContent = '일반 게임으로';
  for (const link of [lab, exit]) {link.style.color = 'var(--accent, #d9a441)'; link.style.display = 'inline-flex'; link.style.alignItems = 'center'; link.style.minHeight = '44px'; link.style.padding = '4px 6px';}
  panel.append(title, note, lab, document.createTextNode(' · '), exit); anchor.after(panel);
  const row = document.querySelector('[data-setting="skill"]')?.closest('.row');
  if (row) row.style.display = 'none';
}
