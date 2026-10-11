import { GrowthController } from './growth-controller.js';
import { createLocalGrowth } from './growth-local.js';

// A small SVG made for the interface: the seal is a name ornament, not armour.
const sealArt = `<svg viewBox="0 0 180 190" aria-hidden="true"><defs><linearGradient id="seal-metal" x2="1" y2="1"><stop stop-color="#f3d894"/><stop offset=".5" stop-color="#ad7c31"/><stop offset="1" stop-color="#e1ba65"/></linearGradient></defs><path d="M61 8Q90 56 119 8M73 10Q90 46 107 10" fill="none" stroke="#74634d" stroke-width="5"/><circle cx="90" cy="56" r="11" fill="none" stroke="#c39b53" stroke-width="5"/><path d="M90 61l46 29v57l-46 29-46-29V90Z" fill="#3f3021" stroke="url(#seal-metal)" stroke-width="5"/><path d="M90 72l36 23v46l-36 23-36-23V95Z" fill="#211c17" stroke="#957340" stroke-width="1.5"/><path d="M90 84l7 26 21 12-21 9-7 24-7-24-21-9 21-12Z" fill="url(#seal-metal)"/><circle cx="90" cy="121" r="6" fill="#211c17"/><path d="M64 100l6 3m40 0 6-3m-52 44 6-3m40 0 6 3" stroke="#d2ab62" stroke-width="2"/></svg>`;

export function mountGrowth({ account, transport, storage, adapter, hub }) {
  const journey = hub.panel('journey'), shop = hub.panel('shop'), inventory = hub.panel('inventory'), strength = hub.panel('growth');
  const content = document.createElement('div'); journey.append(content);
  content.innerHTML = `<div class="hs-reward" data-reward hidden role="status" aria-live="polite"><span class="hs-eyebrow">전투의 기록</span><h2 data-reward-title></h2><p data-reward-detail></p></div>
    <div class="hs-summary"><div><b data-wins>0</b><span>누적 승리</span></div><div><b data-points-summary>0</b><span>성장 포인트</span></div><div><b data-strength-summary>0</b><span>힘 단계</span></div></div>
    <p data-seal class="hs-equipped-name" hidden>✦ 여행자의 인장</p><p class="hs-save-line" data-growth-mode></p><button type="button" class="hs-text-button" data-backup>내 기록과 계정 →</button>
    <p class="hs-save-line">시험 규칙 · 승리마다 10코인, 3승마다 1포인트</p><p class="hs-save-line" data-growth-status role="status"></p>`;
  shop.innerHTML = `<div class="hs-page-heading"><p class="hs-eyebrow">승리로 모은 작은 것들</p><h2>길 위의 상점</h2><p>당신의 이름에 하나의 표식을 더하세요.</p></div><article class="hs-product"><div class="hs-art">${sealArt}</div><div><span class="hs-tag">이름 장식</span><h3>여행자의 인장</h3><p>길을 지나온 사람의 작은 증표. 장착하면 여정 화면의 이름 곁에 표시됩니다.</p><p class="hs-save-line">전투 능력은 바뀌지 않습니다.</p><div class="hs-buy-row"><span class="hs-price">◇ 30 <small>코인</small></span><button class="hs-action" type="button" data-purchase>구매하기</button></div><p class="hs-save-line" data-purchase-hint></p></div></article><p class="hs-save-line">현재는 이 장식 하나를 사고 장착할 수 있습니다. 무기·갑옷 상점은 아직 준비 중입니다.</p>`;
  inventory.innerHTML = `<div class="hs-page-heading"><p class="hs-eyebrow">당신의 소지품</p><h2>보관함</h2><p>구매한 장식을 고르고, 이름에 달아 보세요.</p></div><div class="hs-empty" data-inventory-empty><span aria-hidden="true">◇</span><h3>아직은 가벼운 여정</h3><p>상점에서 얻은 장식이 이곳에 보관됩니다.</p><button class="hs-action hs-quiet" type="button" data-visit-shop>상점 둘러보기</button></div><article class="hs-product" data-inventory-item hidden><div class="hs-art">${sealArt.replaceAll('seal-metal','owned-seal-metal')}</div><div><span class="hs-tag" data-equipped-label>보유 중</span><h3>여행자의 인장</h3><p>이름 곁에 표시하는 장식입니다.</p><button type="button" class="hs-action" data-equip>장착하기</button></div></article>`;
  strength.innerHTML = `<div class="hs-page-heading"><p class="hs-eyebrow">조금씩 단단하게</p><h2>나의 성장</h2><p>승리로 얻은 포인트를 다음 싸움의 힘으로.</p></div><div class="hs-growth-card"><div class="hs-growth-heading"><h3>힘 <b data-strength>0</b><small> / 5</small></h3><span>보유 <b data-points>0</b>포인트</span></div><div class="hs-progress" aria-hidden="true">${'<i></i>'.repeat(5)}</div><p data-strength-effect></p><p class="hs-save-line">한 단계마다 근력 계수 +2%. 다음 경기부터 적용됩니다. 피해량이 그대로 2% 늘어나는 것은 아닙니다.</p><button type="button" class="hs-action" data-allocate>힘 강화 · 1포인트</button><p class="hs-save-line" data-milestone></p></div><p class="hs-save-line">성장 수치는 시험용입니다. 지금은 플레이어의 힘만 강화할 수 있습니다.</p>`;
  const el = selector => [content, shop, inventory, strength].map(p=>p.querySelector(selector)).find(Boolean);
  const rpc = transport?.growthRpc || createLocalGrowth(storage, navigator.locks);
  let identity, reward = null, lastView;
  const growth = new GrowthController({ rpc, storage, onChange: render, onSettled: settled });
  function settled({method,args,previous,state}) {
    if (method==='finish_round') {
      const coins=state.coins-previous.coins, points=state.points-previous.points;
      // A response may also contain another device's changes; do not attribute
      // a merged snapshot's entire balance delta to this single fight.
      const singleWin=state.wins-previous.wins===1;
      reward={title: args.p_win ? (singleWin&&coins===10?'+10 코인':'승리 기록 확인됨') : '이번 싸움을 기록했습니다', detail: singleWin&&points===1?`성장 포인트 +${points} · 성장 화면에서 사용하세요.`:(args.p_win?'보상을 저장했습니다. 다음 여정을 준비하세요.':'승리 보상은 다음 싸움에서 만나요.')};
    } else if (method==='purchase') { hub.show('inventory'); hub.feedback('구매했습니다. 보관함에서 장착하세요.'); }
    else if (method==='equip') hub.feedback(state.equipped?'여행자의 인장을 장착했습니다.':'장식을 해제했습니다.');
    else if (method==='allocate') hub.feedback('힘을 강화했습니다. 다음 경기부터 적용됩니다.');
  }
  function render(view) {
    lastView=view;
    if (identity!==view.identity) { identity=view.identity; reward=null; hub.closeDialog(); }
    if (view.roundActive) reward=null;
    const s=view.state, level=s.characters.player.strength, owned=s.inventory.includes('wayfarer_seal');
    const blocked=!view.ready||view.busy||view.pendingCount>0;
    hub.updateGrowth(view);
    for (const [key,value] of [['wins',s.wins],['points',s.points],['points-summary',s.points],['strength',level],['strength-summary',level]]) el(`[data-${key}]`).textContent=value;
    el('[data-growth-status]').textContent=view.status;
    hub.updateSync(view,()=>void growth.refresh());
    el('[data-growth-mode]').textContent=transport?'계정에 저장 · 온라인에서 등록된 경기만 보상합니다.':'이 기기에만 저장되는 연습판입니다. 여기서 얻은 코인·강화는 실제 계정으로 옮겨지지 않습니다.';
    el('[data-reward]').hidden=!reward;
    if(reward) { el('[data-reward-title]').textContent=reward.title; el('[data-reward-detail]').textContent=reward.detail; }
    el('[data-purchase]').disabled=blocked||(!owned&&s.coins<30);
    el('[data-purchase]').textContent=owned?'보관함 보기':'구매하기';
    el('[data-purchase-hint]').textContent=owned?'이미 보유한 장식입니다.':s.coins<30?`${30-s.coins}코인을 더 모으면 구매할 수 있습니다.`:'구매 후 30코인이 차감됩니다.';
    el('[data-inventory-empty]').hidden=owned; el('[data-inventory-item]').hidden=!owned;
    el('[data-equip]').disabled=blocked||!owned; el('[data-equip]').textContent=s.equipped?'장착 해제':'장착하기';
    el('[data-equipped-label]').textContent=s.equipped?'장착 중':'보유 중'; el('[data-seal]').hidden=!s.equipped;
    const name=document.querySelector('[data-hub-name]'); if(name) name.dataset.seal=s.equipped?'✦':'';
    el('[data-allocate]').disabled=blocked||s.points<1||level>=5;
    el('[data-allocate]').textContent=level>=5?'힘 성장을 마쳤습니다':'힘 강화 · 1포인트';
    el('[data-strength-effect]').textContent=`현재 근력 계수 +${level*2}%${level<5?` → 다음 단계 +${(level+1)*2}%`:''}`;
    [...strength.querySelectorAll('.hs-progress i')].forEach((p,i)=>p.classList.toggle('on',i<level));
    el('[data-milestone]').textContent=`다음 성장 포인트까지 ${3-s.wins%3}승`;
  }
  el('[data-purchase]').onclick=()=>{
    if(growth.state.inventory.includes('wayfarer_seal')) { hub.show('inventory');return; }
    hub.confirm({title:'여행자의 인장을 구매할까요?',description:'이름 옆에 표시하는 장식입니다. 전투 능력은 바뀌지 않습니다.',price:`30코인 · 구매 후 ${growth.state.coins-30}코인`,action:()=>growth.enqueue('purchase',{p_item_id:'wayfarer_seal'})});
  };
  el('[data-allocate]').onclick=()=>hub.confirm({title:'힘을 한 단계 높일까요?',description:'근력 계수가 2% 높아집니다. 다음 경기부터 적용됩니다.',price:`성장 포인트 1개 · 사용 후 ${growth.state.points-1}개`,label:'힘 강화',kind:'성장',action:()=>growth.enqueue('allocate',{p_character_id:'player',p_stat:'strength'})});
  el('[data-equip]').onclick=()=>void growth.enqueue('equip',{p_item_id:growth.state.equipped?null:'wayfarer_seal'});
  el('[data-visit-shop]').onclick=()=>hub.show('shop'); el('[data-backup]').onclick=()=>hub.show('account');
  window.addEventListener('online',()=>void growth.refresh());
  window.addEventListener('storage',event=>{if(event.key?.startsWith(growth.prefix()))void growth.refresh();});
  account.subscribe(state=>{void growth.identify(transport?state.user?.id||null:'practice');});
  adapter.connect(growth);
  if(!lastView) growth.emit();
  return growth;
}
