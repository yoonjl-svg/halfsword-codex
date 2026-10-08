/** Optional comparison on current physics plus the low-finish entry correction. */
const allowed = new Set(['opportunity', 'weapon']);
const weapons = Object.freeze({longsword: '롱소드', branch: '나뭇가지', rapier: '레이피어'});
const models = Object.freeze({baseline: 'A · 내려찍기 B 기반', assisted: 'B · 급소 공략 추가'});

export function configureOpportunityTrial(params) {
  const requested = params.has('opportunity'), model = params.get('opportunity');
  const weapon = params.get('weapon') ?? 'longsword';
  const active = requested && params.getAll('opportunity').length === 1 &&
    params.getAll('weapon').length <= 1 && Object.hasOwn(models, model) &&
    Object.hasOwn(weapons, weapon) && [...params.keys()].every(key => allowed.has(key));
  return {requested, active, model: active ? model : null, weapon: active ? weapon : null,
    opportunity: active && model === 'assisted' ? 'v1' : 'off',
    finish: active ? 'low' : 'legacy', recovery: 'legacy',
    settings: active ? {skill: '0.7', difficulty: 'normal'} : {}};
}

export function mountOpportunityTrial(info) {
  if (!info.active || typeof document === 'undefined') return;
  const anchor = document.getElementById('menuSub');
  if (!anchor || document.getElementById('opportunityInfo')) return;
  const panel = document.createElement('p'); panel.id = 'opportunityInfo'; panel.className = 'sub';
  const title = document.createElement('strong'); title.style.display = 'block';
  title.textContent = `${models[info.model]} · ${weapons[info.weapon]}`;
  const note = document.createElement('span'); note.style.display = 'block';
  note.textContent = '두 판 모두 내려찍기 진입 교정을 사용합니다. B는 상대가 빈틈을 보일 때 베기로 목, 둔기로 머리, 찌르기로 목·얼굴을 노립니다. 보통 톡 누르기와 드래그 조작은 유지됩니다. 일반판과 저장 설정은 바뀌지 않습니다.';
  const link = document.createElement('a'); link.href = './feature-lab.html#opportunity';
  link.textContent = '비교판 선택'; link.style.cssText = 'display:inline-flex;align-items:center;min-height:44px;color:var(--accent,#d9a441)';
  panel.append(title, note, link); anchor.after(panel);
  const row = document.querySelector('[data-setting="skill"]')?.closest('.row');
  if (row) row.style.display = 'none';
}
