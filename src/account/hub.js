import './hub.css';

// Game objects and event handlers stay in place; only their menu containers move.
export function createHub() {
  const menu = document.querySelector('#menu'), card = menu.querySelector('.card');
  document.body.classList.add('account-experience'); card.classList.add('hs-hub');
  const title = card.querySelector('#menuTitle'), subtitle = card.querySelector('#menuSub');
  const actions = card.querySelector('.actions'), howto = card.querySelector('#howto');
  const settings = [...card.querySelectorAll(':scope > .row')];
  const header = document.createElement('header'); header.className = 'hs-topbar';
  header.innerHTML = `<button class="hs-brand" type="button" data-home aria-label="여정으로">적막<span>STILLNESS</span></button><div class="hs-top-actions"><button class="hs-wallet" type="button" data-wallet aria-label="보유 코인, 상점 열기"><i aria-hidden="true">◇</i> <b data-coins>0</b><span>코인</span></button><button class="hs-account-link" type="button" data-account><span class="hs-avatar" aria-hidden="true">旅</span><span><b data-hub-name>여행자</b><small data-account-mode>기기 저장</small></span></button><button class="hs-settings-link" type="button" data-settings aria-label="설정"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="#18120e"/><circle cx="16" cy="17" r="3" fill="#18120e"/></svg></button></div>`;
  const nav = document.createElement('nav'); nav.className = 'hs-nav'; nav.setAttribute('aria-label', '게임 메뉴');
  for (const [id, label] of [['journey','여정'],['shop','상점'],['inventory','보관함'],['growth','성장']]) {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.view = id; button.textContent = label;
    button.onclick = () => show(id); nav.append(button);
  }
  const body = document.createElement('div'); body.className = 'hs-body';
  const panels = {};
  for (const id of ['journey','shop','inventory','growth','account','settings']) {
    const p = document.createElement('section'); p.className = 'hs-page'; p.dataset.page = id; p.hidden = id !== 'journey'; panels[id] = p; body.append(p);
  }
  const hero = document.createElement('div'); hero.className = 'hs-journey-heading';
  hero.innerHTML = '<p class="hs-eyebrow">길 위의 기록</p>';
  hero.append(title,subtitle); panels.journey.append(hero);
  panels.settings.innerHTML = '<div class="hs-page-heading"><h2>설정</h2><p>당신의 손에 맞는 방식으로.</p></div>';
  panels.settings.append(...settings); if (howto) panels.settings.append(howto);
  const status = document.createElement('p'); status.className = 'hs-feedback'; status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
  const sync=document.createElement('div'); sync.className='hs-sync'; sync.hidden=true;
  sync.innerHTML='<span data-sync-status role="status" aria-live="polite"></span><button type="button" data-growth-retry>다시 연결</button>';
  card.replaceChildren(header,nav,body,status,sync,actions);
  const dialog = document.createElement('dialog'); dialog.className = 'hs-dialog'; dialog.setAttribute('aria-labelledby','hs-dialog-title');
  dialog.innerHTML = '<div class="hs-dialog-art" aria-hidden="true">◇</div><p class="hs-eyebrow" data-dialog-kind>상점</p><h2 id="hs-dialog-title"></h2><p data-dialog-description></p><p data-dialog-price class="hs-dialog-price"></p><div class="hs-dialog-actions"><button type="button" data-dialog-cancel>돌아가기</button><button type="button" data-dialog-confirm>구매하기</button></div>';
  document.body.append(dialog);
  let current = 'journey', confirmAction = null, restoreFocus = null;
  const closeDialog = () => { if (dialog.open) dialog.close(); confirmAction = null; };
  dialog.querySelector('[data-dialog-cancel]').onclick = closeDialog;
  dialog.addEventListener('close', () => { confirmAction = null; if (restoreFocus?.isConnected && menu.classList.contains('show')) restoreFocus.focus({preventScroll:true}); });
  dialog.querySelector('[data-dialog-confirm]').onclick = () => { const action = confirmAction; closeDialog(); if (action) void action(); };
  function show(id) {
    if (!panels[id]) return;
    if(current!==id) status.textContent='';
    current = id;
    for (const [key,p] of Object.entries(panels)) p.hidden = key !== id;
    for (const b of nav.querySelectorAll('button')) { b.classList.toggle('on',b.dataset.view === id); if (b.dataset.view === id) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); }
    header.querySelector('[data-account]').classList.toggle('on',id==='account');
    body.scrollTop = 0; card.dataset.currentPage = id;
  }
  header.querySelector('[data-home]').onclick=()=>show('journey');
  header.querySelector('[data-wallet]').onclick=()=>show('shop');
  header.querySelector('[data-account]').onclick=()=>show('account');
  header.querySelector('[data-settings]').onclick=()=>show('settings');
  new MutationObserver(() => {
    closeDialog();
    if (menu.classList.contains('show')) show('journey');
    else { status.textContent=''; menu.dataset.rewardVisible='false'; }
  }).observe(menu,{attributes:true,attributeFilter:['class']});
  show('journey');
  return {
    panel: id => panels[id], show,
    updateAccount(state) {
      header.querySelector('[data-hub-name]').textContent=state.profile.display_name;
      header.querySelector('[data-account-mode]').textContent = state.user ? (state.user.is_anonymous?'게스트 계정':'연결된 계정') : (state.status==='expired'?'로그인 필요':'기기 저장');
    },
    updateGrowth(view) {
      header.querySelector('[data-coins]').textContent = view.state.coins.toLocaleString('ko-KR');
      header.querySelector('[data-wallet]').setAttribute('aria-label',`보유 ${view.state.coins}코인, 상점 열기`);
    },
    feedback(text) { status.textContent=text; },
    updateSync(view,retry) {
      // Do not abandon an unsettled result by registering the next fight.
      const start=actions.querySelector('#btnStart'); if(start) start.disabled=!!view.pendingCount||view.busy;
      sync.hidden=!view.error&&!view.pendingCount&&view.ready;
      sync.querySelector('[data-sync-status]').textContent=view.error||view.status;
      const button=sync.querySelector('button'); button.disabled=view.busy||!view.identity; button.onclick=retry;
    },
    confirm({title,description,price,label='구매하기',kind='상점',action}) {
      restoreFocus=document.activeElement; dialog.querySelector('[data-dialog-kind]').textContent=kind;
      dialog.querySelector('h2').textContent=title; dialog.querySelector('[data-dialog-description]').textContent=description;
      dialog.querySelector('[data-dialog-price]').textContent=price; dialog.querySelector('[data-dialog-confirm]').textContent=label;
      confirmAction=action; dialog.showModal(); dialog.querySelector('[data-dialog-cancel]').focus();
    },
    closeDialog,
    get current() { return current; },
  };
}
