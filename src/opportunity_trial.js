/** Optional comparison on current physics plus the low-finish entry correction. */
const allowed = new Set(['opportunity', 'weapon', 'drill']);
const weapons = Object.freeze({longsword: '롱소드', branch: '나뭇가지', rapier: '레이피어', estoc: '에스톡'});
const models = Object.freeze({baseline: '급소 보조 끔', assisted: '기존 급소 공략', precision: '목 우선 · 실제 경로 보조', 'head-region': '목·머리 영역 · 실제 경로 보조', distance: 'A · 간격 준비 후 목·머리 찌르기', flow: 'B · 빠르게 이어지는 간격 준비'});

export function configureOpportunityTrial(params) {
  const requested = params.has('opportunity'), model = params.get('opportunity');
  const weapon = params.get('weapon') ?? 'longsword';
  const drill = params.get('drill'), rangeModel = model === 'distance' || model === 'flow';
  const validDrill = !params.has('drill') ||
    (params.getAll('drill').length === 1 && rangeModel && ['rapier', 'estoc'].includes(weapon) && ['near', 'far'].includes(drill));
  const active = requested && params.getAll('opportunity').length === 1 &&
    params.getAll('weapon').length <= 1 && Object.hasOwn(models, model) &&
    Object.hasOwn(weapons, weapon) && validDrill && [...params.keys()].every(key => allowed.has(key));
  return {requested, active, model: active ? model : null, weapon: active ? weapon : null,
    opportunity: active && rangeModel ? 'v4' : active && model === 'head-region' ? 'v3' : active && model === 'precision' ? 'v2' : active && model === 'assisted' ? 'v1' : 'off',
    tempo: active && model === 'flow' ? 1.2 : 1,
    drill: active && drill ? drill : null,
    drillGap: active && drill ? (drill === 'near' ? 1.25 : 2.15) : null,
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
  note.textContent = ['distance', 'flow'].includes(info.model)
    ? `${info.drill ? '반격 없는 무릎 연습 상대입니다. 시작 대기가 끝나면 스틱을 놓고 톡 누르세요. ' : '무너진 상대에게 톡 누르면 간격을 맞춘 뒤 목·머리를 찌릅니다. '}A는 기존 준비, B는 준비 이동·자세 목표를 20% 빠르게 잇습니다. 실제 찌르기의 시간·힘 설정은 같습니다. 스틱이나 새 드래그는 준비를 취소하며 공격 시작 뒤에는 상대를 따라 겨누지 않습니다.`
    : info.model === 'head-region'
    ? '무너진 상대에게 톡 눌러 찌르세요. 목·머리에서 현재 검의 방향으로 접근하기 쉬운 곳을 겨눕니다. 공격 시작 뒤에는 상대를 따라가지 않습니다. 명중과 피해는 실제 충돌·갑옷으로 결정됩니다.'
    : '무너진 상대에게 톡 눌러 찌르거나 드래그해 공격하세요. 비교판의 무기 위력·공격 시간 설정·갑옷 규칙은 같습니다. 일반판과 저장 설정은 바뀌지 않습니다.';
  const link = document.createElement('a'); link.href = './feature-lab.html#' + (['distance', 'flow'].includes(info.model) ? 'continuity' : ['precision', 'head-region'].includes(info.model) ? 'head-region' : 'opportunity');
  link.textContent = '비교판 선택'; link.style.cssText = 'display:inline-flex;align-items:center;min-height:44px;color:var(--accent,#d9a441)';
  panel.append(title, note, link); anchor.after(panel);
  const row = document.querySelector('[data-setting="skill"]')?.closest('.row');
  if (row) row.style.display = 'none';
}
