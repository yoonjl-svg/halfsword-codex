/** Isolated comparison on today's ordinary settings; never persists menu values. */
const allowed = new Set(['movementFix', 'weapon']);
const weapons = Object.freeze({longsword: '롱소드', qinggang: '청강검', zweihander: '츠바이핸더', rapier: '레이피어'});
const models = Object.freeze({baseline: 'A · 이전 진입 조건', finish: 'B · 일반판 내려찍기', 'getup-base': 'A · 기존 기립', 'getup-lead': 'B · 앞다리부터 기립'});

export function configureRecoveryFinishTrial(params) {
  const requested = params.has('movementFix'), model = params.get('movementFix');
  const weapon = params.get('weapon') ?? 'longsword';
  const active = requested && params.getAll('movementFix').length === 1 &&
    params.getAll('weapon').length <= 1 && Object.hasOwn(models, model) &&
    Object.hasOwn(weapons, weapon) && [...params.keys()].every(k => allowed.has(k));
  return {requested, active, model: active ? model : null, weapon: active ? weapon : null,
    finish: active && model !== 'baseline' ? 'low' : 'legacy',
    getupLeadDelay: active && model === 'getup-lead',
    recovery: 'legacy', // Recovery candidates failed physical regression; not exposed.
    settings: active ? {skill: '0.7', difficulty: 'normal'} : {}};
}

export function mountRecoveryFinishTrial(info) {
  if (!info.active || typeof document === 'undefined') return;
  const anchor = document.getElementById('menuSub');
  if (!anchor || document.getElementById('movementFixInfo')) return;
  const panel = document.createElement('p'); panel.id = 'movementFixInfo'; panel.className = 'sub';
  const title = document.createElement('strong'); title.style.display = 'block';
  title.textContent = `${models[info.model]} · ${weapons[info.weapon]}`;
  const note = document.createElement('span'); note.style.display = 'block';
  note.textContent = info.model.startsWith('getup-') ? 'B는 앞다리를 먼저 펴고 뒷다리가 뒤따라 일어납니다. 기립 시간과 힘 설정은 같습니다. 부상·피격 뒤의 발 디딤을 비교하는 시험판입니다.' : 'B의 내려찍기 조건이 일반판에 적용됐습니다. 검술 보정 v2·중력·무기 위력은 같습니다. 낮은 상대를 톡 눌렀을 때 접근·찍기·복귀를 비교하세요. 저장 설정은 바뀌지 않습니다.';
  const link = document.createElement('a'); link.href = './feature-lab.html#' + (info.model.startsWith('getup-') ? 'getup-lead' : 'movement-fix');
  link.textContent = '비교판 선택'; link.style.cssText = 'display:inline-flex;align-items:center;min-height:44px;color:var(--accent,#d9a441)';
  panel.append(title, note, link); anchor.after(panel);
  const row = document.querySelector('[data-setting="skill"]')?.closest('.row');
  if (row) row.style.display = 'none';
}
