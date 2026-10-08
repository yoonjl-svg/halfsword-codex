/** Isolated comparison on today's ordinary settings; never persists menu values. */
const allowed = new Set(['movementFix', 'weapon']);
const weapons = Object.freeze({longsword: '롱소드', qinggang: '청강검', zweihander: '츠바이핸더', rapier: '레이피어'});
const models = Object.freeze({baseline: 'A · 현재 일반판', finish: 'B · 내려찍기 교정'});

export function configureRecoveryFinishTrial(params) {
  const requested = params.has('movementFix'), model = params.get('movementFix');
  const weapon = params.get('weapon') ?? 'longsword';
  const active = requested && params.getAll('movementFix').length === 1 &&
    params.getAll('weapon').length <= 1 && Object.hasOwn(models, model) &&
    Object.hasOwn(weapons, weapon) && [...params.keys()].every(k => allowed.has(k));
  return {requested, active, model: active ? model : null, weapon: active ? weapon : null,
    finish: active && model === 'finish' ? 'low' : 'legacy',
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
  note.textContent = '검술 보정 v2·중력·무기 위력은 같습니다. 낮은 상대를 톡 눌렀을 때 접근·찍기·복귀를 비교하세요. 이번 비교는 내려찍기이며 일반판과 저장 설정은 바뀌지 않습니다.';
  const link = document.createElement('a'); link.href = './feature-lab.html#movement-fix';
  link.textContent = '비교판 선택'; link.style.cssText = 'display:inline-flex;align-items:center;min-height:44px;color:var(--accent,#d9a441)';
  panel.append(title, note, link); anchor.after(panel);
  const row = document.querySelector('[data-setting="skill"]')?.closest('.row');
  if (row) row.style.display = 'none';
}
