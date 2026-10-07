/** Player-only finish-rule comparison; main.js keeps the ordinary v2 physics. */
const allowed = new Set(['finishV2', 'weapon']);
const weapons = Object.freeze({longsword: '롱소드', rapier: '레이피어'});

export function configureFinishV2Trial(params) {
  const requested = params.has('finishV2'), model = params.get('finishV2');
  const weapon = params.has('weapon') ? params.get('weapon') : 'longsword';
  const active = requested && params.getAll('finishV2').length === 1 &&
    ['baseline', 'armor'].includes(model) && params.getAll('weapon').length <= 1 &&
    Object.hasOwn(weapons, weapon) && [...params.keys()].every(key => allowed.has(key));
  return {requested, active, model: active ? model : null,
    finishModel: active && model === 'armor' ? 'armorGuard' : 'legacy',
    weapon: active ? weapon : null, foe: active ? 'heinrich' : null,
    foeWeapon: active ? 'longsword' : null,
    settings: active ? {skill: '0.7', difficulty: 'normal'} : {},
    playerOnly: true, labHref: './feature-lab.html#finish-v2-comparison', ordinaryHref: './'};
}

export function mountFinishV2Trial(info) {
  if (!info.active || typeof document === 'undefined') return;
  const anchor = document.getElementById('menuSub');
  if (!anchor || document.getElementById('finishV2TrialInfo')) return;
  const panel = document.createElement('p'); panel.id = 'finishV2TrialInfo'; panel.className = 'sub';
  const title = document.createElement('span'); title.style.display = 'block';
  title.textContent = `마무리 ${info.model === 'armor' ? 'B · 갑옷 보호' : 'A · 기존 규칙'} · ${weapons[info.weapon]}`;
  const note = document.createElement('span'); note.style.display = 'block';
  note.textContent = '넘어진 상대의 갑옷 부위를 톡 눌러 마무리를 비교해 보세요. 검술 보정 v2와 중력 9.81은 두 판이 같습니다.';
  const rule = document.createElement('span'); rule.style.display = 'block';
  rule.textContent = 'A는 기존 마무리입니다. B는 갑옷이 보호하는 부위에서 상처 문턱을 넘지 못한 마무리의 특례 즉사를 막습니다. 일반 상처·기절·죽음은 생길 수 있습니다.';
  const lab = document.createElement('a'); lab.id = 'finishV2TrialLab'; lab.href = info.labHref; lab.textContent = '마무리 비교 화면';
  const exit = document.createElement('a'); exit.id = 'finishV2TrialExit'; exit.href = info.ordinaryHref; exit.textContent = '일반 게임으로';
  for (const link of [lab, exit]) {link.style.color = 'var(--accent, #d9a441)'; link.style.display = 'inline-flex'; link.style.alignItems = 'center'; link.style.minHeight = '44px'; link.style.padding = '4px 6px';}
  panel.append(title, note, rule, lab, document.createTextNode(' · '), exit); anchor.after(panel);
  const row = document.querySelector('[data-setting="skill"]')?.closest('.row');
  if (row) row.style.display = 'none';
}
