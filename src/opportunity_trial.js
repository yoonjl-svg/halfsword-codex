/** Optional comparison on current physics plus the low-finish entry correction. */
const allowed = new Set(['opportunity', 'weapon']);
const weapons = Object.freeze({longsword: '롱소드', branch: '나뭇가지', rapier: '레이피어', estoc: '에스톡'});
const models = Object.freeze({baseline: '급소 보조 끔', assisted: '기존 급소 공략', precision: '목 우선 · 실제 경로 보조', 'head-region': '목·머리 영역 · 실제 경로 보조'});

export function configureOpportunityTrial(params) {
  const requested = params.has('opportunity'), model = params.get('opportunity');
  const weapon = params.get('weapon') ?? 'longsword';
  const active = requested && params.getAll('opportunity').length === 1 &&
    params.getAll('weapon').length <= 1 && Object.hasOwn(models, model) &&
    Object.hasOwn(weapons, weapon) && [...params.keys()].every(key => allowed.has(key));
  return {requested, active, model: active ? model : null, weapon: active ? weapon : null,
    opportunity: active && model === 'head-region' ? 'v3' : active && model === 'precision' ? 'v2' : active && model === 'assisted' ? 'v1' : 'off',
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
  note.textContent = info.model === 'head-region'
    ? '무너진 상대에게 톡 눌러 찌르세요. 목·머리에서 현재 검의 방향으로 접근하기 쉬운 곳을 겨눕니다. 공격 시작 뒤에는 상대를 따라가지 않습니다. 명중과 피해는 실제 충돌·갑옷으로 결정됩니다.'
    : '무너진 상대에게 톡 눌러 찌르거나 드래그해 공격하세요. 비교판의 무기 위력·공격 시간 설정·갑옷 규칙은 같습니다. 일반판과 저장 설정은 바뀌지 않습니다.';
  const link = document.createElement('a'); link.href = './feature-lab.html#' + (['precision', 'head-region'].includes(info.model) ? 'head-region' : 'opportunity');
  link.textContent = '비교판 선택'; link.style.cssText = 'display:inline-flex;align-items:center;min-height:44px;color:var(--accent,#d9a441)';
  panel.append(title, note, link); anchor.after(panel);
  const row = document.querySelector('[data-setting="skill"]')?.closest('.row');
  if (row) row.style.display = 'none';
}
