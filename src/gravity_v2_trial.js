/** Temporary world-gravity comparison; controller force constants stay unchanged. */
const levels = Object.freeze({base: -9.81, plus15: -11.2815, plus25: -12.2625});
const allowed = new Set(['gravityV2', 'weapon']);
export function configureGravityV2Trial(params) {
  const requested = params.has('gravityV2'), level = params.get('gravityV2');
  const active = requested && params.getAll('gravityV2').length === 1 &&
    Object.hasOwn(levels, level) && params.getAll('weapon').length <= 1 &&
    (!params.has('weapon') || params.get('weapon') === 'zweihander') &&
    [...params.keys()].every(key => allowed.has(key));
  return {requested, active, level: active ? level : null,
    gravity: active ? levels[level] : null, stanceModel: active ? 'fresh' : 'legacy',
    weapon: active ? 'zweihander' : null, foeWeapon: active ? 'longsword' : null,
    settings: active ? {skill: '0.7', difficulty: 'normal'} : {},
    labHref: './feature-lab.html#gravity-v2-comparison', ordinaryHref: './'};
}

export function mountGravityV2Trial(info) {
  if (!info.active || typeof document === 'undefined') return;
  const anchor = document.getElementById('menuSub');
  if (!anchor || document.getElementById('gravityV2TrialInfo')) return;
  const panel = document.createElement('p'); panel.id = 'gravityV2TrialInfo'; panel.className = 'sub';
  const title = document.createElement('span'); title.style.display = 'block';
  const label = {base: '기준', plus15: '+15%', plus25: '+25%'}[info.level];
  title.textContent = `중력 ${label} · ${-info.gravity} · 츠바이핸더`;
  const note = document.createElement('span'); note.style.display = 'block';
  note.textContent = '검술 보정 v2·다시 발 딛기 B는 같습니다. 이동·베기·옆 디딤을 비교하세요.';
  const lab = document.createElement('a'); lab.id = 'gravityV2TrialLab'; lab.href = info.labHref; lab.textContent = '중력 비교 화면';
  const exit = document.createElement('a'); exit.id = 'gravityV2TrialExit'; exit.href = info.ordinaryHref; exit.textContent = '일반 게임으로';
  for (const link of [lab, exit]) {link.style.color = 'var(--accent, #d9a441)'; link.style.display = 'inline-flex'; link.style.alignItems = 'center'; link.style.minHeight = '44px'; link.style.padding = '4px 6px';}
  panel.append(title, note, lab, document.createTextNode(' · '), exit); anchor.after(panel);
  const row = document.querySelector('[data-setting="skill"]')?.closest('.row');
  if (row) row.style.display = 'none';
}
