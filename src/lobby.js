// 대기실 (샛별 저장소 817db21c · b73a9c82 · 3b280a1b — docs/import/lobby_port_2026-10-16.md §3 · 고친 것 docs/import/lobby_fix_2026-10-16.md): 첫 화면의 처음부터·이어하기와 여정 사이의 세 칸
//  ① 캐릭터 프로필(정사각 그림 — 10/17 22:1x 사장님: 3D 미리보기(360° · 장착)를 없애고 프로필 사진 자리 · 10/18 04:1x '옛 3d 지워' 로 그 코드도 지움, docs/design/portrait_ui_2026-10-17.md) + 출발 단추
//  ② 내 정보(레벨 · 호칭 · 이름 · 대면 결과 · 금화 · 머리) + 메뉴 넷 ③ 아이템 · 상점 · 스킬북 · 이벤트
//  우리 손댐 (사장님 10/16 01:0x): 무기는 나뭇가지 하나(롱소드 뺌) · 나뭇가지도 방어구처럼 설명 카드(이름 · 등급 · 설명 — 우리 weapons.js 의 nameKo · tier · desc 그대로, 등급 글은 무기 카드와 같은 TIER_LABEL)
//  10/16 03:5x~04:3x (lobby_fix): 장착은 실제 싸움에 (main.js journeyLoadout) · 케틀 햇 레전드 + '생존술: 기력 +30' · 글자는 싸움 화면 규칙(entrance_type.css) ·
//   스킬북 = 유파별 별자리(skill_tree.js — 금화로 사고 사용 / 봉인) · 머리(천 주머니) · 이미 받은 인장을 금화로 한 번(seal_coins.js)
//  10/16 14:0x: 첫 화면·대기실도 가로 화면만 — 세로 폰이면 싸움과 같은 '폰을 가로로 돌려 주세요'가 덮어(game_entry.js openHost) 대기실 안 '싸움은 가로 화면입니다' 줄은 지움
//  10/16 15:3x · 16:0x (사장님 ② ④ ⑤ ⑥ ⑨ — docs/import/ui_unify_2026-10-16.md): 단추 · 탭 = 싸움 화면 꼴(entrance_ui.css) · 창 = 싸움 창 · 세 칸 위아래 줄 맞춤 · 사슬 틀 크기 ·
//   호칭 내림 상자(대표 유파 칸은 뺌) · 재고 칸 그림 = 매끈 · 칸의 80 % · 등급 빛 · '장착 중'은 칸 귀퉁이 작은 알약 · 장착 · 해제는 설명 카드 안(스킬북 설명 카드의 구입 · 사용 · 봉인과 같은 자리)
//  10/17 (사장님 '용사의 눈물 … 방어구에 넣어둬' — docs/import/hero_tear_2026-10-17.md): 방어구 칸 = 케틀 햇 · 용사의 눈물 (lobby_equipment.js LOBBY_ARMORS) ·
//   장착은 물건마다 제 자리(armorSlot — 머리 · 목)라 둘을 같이 건다 · 용사의 눈물은 겉모습 변화가 없다(프로필 그림은 장착과 무관)
//  10/18 04:1x (사장님 "무기+방어구 합쳐서 '아이템'으로 만들고 남는 한 칸은 '이벤트'로. 상점처럼 아직 비공개임. 아이템은 현재 가로 5칸에서 6칸으로 확장. 순서는 (윗칸에) 아이템 상점 (아랫칸에) 스킬북 이벤트"
//   — docs/design/portrait_ui_2026-10-17.md §10): 메뉴 2 × 2 = [아이템][상점] / [스킬북][이벤트] · 아이템 칸 = 무기 다음 방어구를 한 판에(칸 6 × 4 = 24 · 정사각 — lobby.css) ·
//   장착 규칙은 물건 종류마다 그대로(무기 = 한 자리 · 방어구 = armorSlot 의 제 자리) · 이벤트 = 상점처럼 빈 안내 한 줄
import style from './lobby.css?inline';
import uiStyle from './entrance_ui.css?inline';
import typeStyle from './entrance_type.css?inline';
import { createPixelGrove, paintPixelWordmark } from './pixel_grove.js';
import { LOBBY_ITEMS, LOBBY_ARMORS, armorSlot, readLobbyEquipment, saveLobbyEquipment, readLobbyArmor, saveLobbyArmor, readLobbyNeck, saveLobbyNeck } from './lobby_equipment.js';
import { portraitSrc, portraitMode, portraitGrid } from './portraits.js'; // ① 프로필 칸 (10/17 — 전: 3D 미리보기 · 10/18 그 코드 지움)
import { readProfile, renamePlayer } from './player_profile.js';
import { readProgress, titleOptions, selectTitle } from './lobby_progress.js';
import { mountSkillTree } from './skill_tree.js';
import { convertSeals, takeSealNotice } from './seal_coins.js';
import { getWeapon, TIER_LABEL, weaponSpecText } from './weapons.js';
import { COIN_ICON, POUCH_ICON } from './wallet_icons.js'; // 금화 · 머리 그림 — 결과 창 금화 줄과 같은 그림

// 칸 그림 맞춤 (사장님 ⑨ — 감독 검토 §2 '케틀 햇이 칸 폭의 약 45 %'): 그림 파일의 투명한 가장자리를 빼고, 보이는 부분의 긴 쪽이 칸의 80 % 가 되게 키우고 가운데에 둔다.
//  같은 그림은 한 번만 잰다(이번 실행 동안). 재기 전 · 못 재면 그림 상자 = 칸의 80 % 그대로 (lobby.css .inventory-item img 의 --fit · --fx · --fy)
const thumbFits = new Map();
function fitThumb(img) {
  const apply = f => { img.style.setProperty('--fit', f.fit.toFixed(3)); img.style.setProperty('--fx', f.x.toFixed(3)); img.style.setProperty('--fy', f.y.toFixed(3)); img.dataset.fit = 'content'; if (f.busy) img.dataset.top = 'busy'; };
  const known = thumbFits.get(img.src);
  if (known) { apply(known); return; }
  img.decode().then(() => {
    const n = 64, canvas = document.createElement('canvas'); canvas.width = canvas.height = n;
    const g = canvas.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, n, n);
    const a = g.getImageData(0, 0, n, n).data;
    let x0 = n, y0 = n, x1 = -1, y1 = -1;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (a[(y * n + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return;
    const f = { fit: Math.min(1.6, n / Math.max(x1 - x0 + 1, y1 - y0 + 1)), x: (x0 + x1 + 1) / 2 / n - .5, y: (y0 + y1 + 1) / 2 / n - .5 };
    // '장착 중' 알약 자리에 그림이 있나 (목걸이처럼 위 가장자리가 찬 그림 — 10/17 점검에서 찾음): 낮은 화면 칸(폭 54 px 안팎)에서 알약이 덮는 곳 =
    //  칸 왼쪽 68 % · 위 18 %. 그림은 보이는 부분의 긴 쪽이 칸의 80 % · 가운데라, 칸 좌표 u, v → 그림 좌표 = 가운데 + (u − .5) × 긴 쪽 / .8 . 찼으면 lobby.css 가 장착 중일 때만 줄여 내린다
    const span = Math.max(x1 - x0 + 1, y1 - y0 + 1), cx = (x0 + x1 + 1) / 2, cy = (y0 + y1 + 1) / 2, k = span / .8;
    const zx0 = Math.max(0, Math.floor(cx - .5 * k)), zx1 = Math.min(n - 1, Math.ceil(cx + .18 * k)), zy0 = Math.max(0, Math.floor(cy - .5 * k)), zy1 = Math.min(n - 1, Math.ceil(cy - .32 * k));
    for (let y = zy0; y <= zy1 && !f.busy; y++) for (let x = zx0; x <= zx1; x++) if (a[(y * n + x) * 4 + 3] > 24) { f.busy = true; break; }
    thumbFits.set(img.src, f); apply(f);
  }).catch(() => {});
}
const CHEVRON = '<svg class="chevron" viewBox="0 0 10 10" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3.5 5 6.5 8 3.5"/></svg>';
const CHECK = '<svg class="check" viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6.5 5 9 9.5 3.5"/></svg>';

export function mountLobby({ root, game, choice, onDepart, onBack }) {
  const ctx = game.getSkillBookContext?.() ?? { test: false };
  root.innerHTML = `<style>${uiStyle}\n${style}\n${typeStyle}</style><main class="lobby" aria-labelledby="lobbyHeading">
    <canvas class="lobby-backdrop" id="lobbyGrove" aria-hidden="true"></canvas><div class="lobby-shade" aria-hidden="true"></div>
    <header class="lobby-header"><h1 id="lobbyHeading" tabindex="-1"><span>대기실</span></h1><p id="lobbyStatus" class="lobby-status" role="status"></p><button id="lobbyBack" class="secondary small on-art utility">첫 화면</button></header>
    <div class="lobby-columns">
      <section class="character-panel"><figure class="portrait-card" id="lobbyPortrait" aria-label="내 캐릭터 프로필"><img id="lobbyPortraitImg" alt="" draggable="false" decoding="async"></figure><button class="primary depart" id="lobbyDepart">Stage 입장</button></section>
      <section class="profile-panel" aria-label="내 정보">
        <dl class="profile-data"><dt class="sr-only">레벨과 호칭</dt><dd id="lobbyRank" class="rank-row"><span id="lobbyLevel"></span><span class="title-picker"><button type="button" id="titleSelect" class="title-select" aria-haspopup="listbox" aria-expanded="false" aria-controls="titleList" aria-labelledby="titleLabel titleCurrent"><span id="titleLabel" class="sr-only">호칭</span><span id="titleCurrent"></span>${CHEVRON}</button><ul id="titleList" class="title-list" role="listbox" aria-labelledby="titleLabel" hidden></ul></span></dd><dt class="sr-only">이름</dt><dd class="name-row"><span id="lobbyName"></span><button class="edit-name" id="editName" aria-label="이름 수정"><svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m3 10 7-7 3 3-7 7-4 1 1-4ZM9 4l3 3M2 14h12"/></svg></button></dd></dl>
        <p class="duel-record"><span>대면 결과</span><b id="duelRecord"></b></p>
        <p class="coin-balance wallet">${COIN_ICON}<span id="lobbyCoins"></span>${POUCH_ICON}<span id="lobbyHeads"></span></p>
        <nav class="lobby-tabs" role="tablist" aria-label="대기실 메뉴">
          <button role="tab" id="tabItems" aria-controls="panelInventory" aria-selected="true" data-panel="Inventory">아이템</button>
          <button role="tab" id="tabShop" aria-controls="panelShop" aria-selected="false" tabindex="-1" data-panel="Shop">상점</button>
          <button role="tab" id="tabSkills" aria-controls="panelSkills" aria-selected="false" tabindex="-1" data-panel="Skills">스킬북</button>
          <button role="tab" id="tabEvent" aria-controls="panelEvent" aria-selected="false" tabindex="-1" data-panel="Event">이벤트</button>
        </nav>
      </section>
      <section class="contents-panel" aria-label="대기실 상세">
        <div role="tabpanel" id="panelInventory" aria-labelledby="tabItems">
          <div class="panel-heading"><h2 id="inventoryHeading">아이템</h2><span id="inventoryCount"></span></div>
          <div class="inventory-frame card-frame"><div class="inventory-grid" aria-label="가로 6칸 세로 4칸"></div>
          <div class="item-detail" id="itemDetail" hidden><p class="item-head"><b id="itemName"></b><span id="itemRarity"></span></p><p id="itemDescription"></p><div class="equipment-actions"><button type="button" id="equipItem" disabled>장착</button><button type="button" id="unequipItem" disabled>해제</button></div></div></div>
          <p id="equipmentStatus" class="sr-only" role="status"></p>
        </div>
        <div role="tabpanel" id="panelShop" aria-labelledby="tabShop" hidden><div class="panel-heading"><h2>상점</h2></div><p class="empty-panel">아직 판매 중인 물품이 없습니다.</p></div>
        <div role="tabpanel" id="panelSkills" aria-labelledby="tabSkills" hidden><div class="panel-heading"><h2>스킬북</h2><span class="wallet panel-wallet">${COIN_ICON}<b id="skillCoins"></b>${POUCH_ICON}<b id="skillHeads"></b></span></div><div id="skillTreeHost" class="skill-tree-host"></div><p id="skillStatus" class="sr-only" role="status"></p></div>
        <div role="tabpanel" id="panelEvent" aria-labelledby="tabEvent" hidden><div class="panel-heading"><h2>이벤트</h2></div><p class="empty-panel">아직 진행 중인 이벤트가 없습니다.</p></div>
      </section>
    </div>
  </main><dialog class="name-dialog" id="nameDialog" aria-labelledby="nameHeading"><form id="nameForm"><h2 id="nameHeading">이름 수정</h2><label for="playerNameInput">이름 · 최대 16자</label><input id="playerNameInput" name="playerName" autocomplete="off" required maxlength="32"><p class="name-error" id="nameError" role="status"></p><div class="dialog-actions"><button type="button" id="cancelName" class="secondary">취소</button><button type="submit" class="primary">저장</button></div></form></dialog>`;
  const $ = id => root.getElementById(id), events = new AbortController();
  const listen = (el, type, fn) => el.addEventListener(type, fn, { signal: events.signal });
  const grove = createPixelGrove($('lobbyGrove'), matchMedia('(prefers-reduced-motion: reduce)')); grove.gust();
  paintPixelWordmark($('lobbyHeading'), { text: '대기실', font: '600 18px Pretendard', height: 29, baseline: 22, tracking: 2 });
  // 이미 받은 인장 → 금화 (사장님 10/16 04:2x — 한 번만, seal_coins.js · 인장 제도는 08:1x 에 없앰). 바꾸기는 판을 처음 연 때 main.js 가 이미 했다 — 여기선 남은 것만(안전)
  //  알림은 아직 안 띄운 바꿈이 있을 때 한 번 (takeSealNotice). 테스트 경로에서는 바꾸지도 알리지도 않는다
  const converted = ctx.test ? null : (convertSeals(), takeSealNotice());
  const profile = readProfile();
  const status = (text, tone = '') => { $('lobbyStatus').textContent = text; if (tone) $('lobbyStatus').dataset.tone = tone; else delete $('lobbyStatus').dataset.tone; };
  // 대표 유파 칸은 뺐다 (사장님 10/16 15:3x ⑥ '대표 유파 정보는 없어도 되겠다')
  function renderWallet() {
    const progress = readProgress();
    $('lobbyLevel').textContent = `Lv.${progress.level}`; // 레벨은 글 그대로 (금색 아님 — 강조 색은 누를 것 · 꼭 볼 것만)
    $('lobbyCoins').textContent = $('skillCoins').textContent = progress.coins.toLocaleString('ko-KR');
    $('lobbyHeads').textContent = $('skillHeads').textContent = progress.heads.toLocaleString('ko-KR');
  }
  // ── 호칭 내림 상자 (사장님 10/16 15:3x ⑥ "'여행자'는 내림박스 같은 기능을 만들어서 호칭 선택할 수 있게 해" ·
  //    16:0x "호칭 내림 상자를 누르면 아래로 열리는 투명도를 가진 박스에 이미 가진 호칭인 여행자가 보이고, '호칭 없음' 같은 시스템 알림은 거기서 빼자"):
  //  단추 = 지금 호칭 + 작은 갈매기표(싸움 화면 부 단추 꼴 — 금색 아님) · 누르면 바로 아래로 반투명 창(--panel)이 열려 가진 호칭만 보인다(지금은 기본 '여행자' 하나 — 지금 호칭 = ✓).
  //  고르면 title 에 저장(lobby_progress.js selectTitle). 키보드: 단추에서 ↓ ↑ = 열기 · 목록에서 ↑ ↓ Home End = 옮기기 · Enter Space = 고르기 · Esc = 닫고 단추로 · Tab = 닫기 / 바깥을 누르면 닫힘
  const picker = $('titleSelect'), titleList = $('titleList');
  const titleItems = () => [...titleList.querySelectorAll('[role=option]')];
  function renderTitles() {
    const { title } = readProgress();
    $('titleCurrent').textContent = title;
    titleList.replaceChildren(...titleOptions().map((name, i) => {
      const li = document.createElement('li');
      li.id = `titleOption${i}`; li.setAttribute('role', 'option'); li.tabIndex = -1; li.dataset.title = name;
      li.setAttribute('aria-selected', String(name === title));
      li.innerHTML = `<span class="title-name"></span>${CHECK}`; li.firstChild.textContent = name;
      return li;
    }));
  }
  function openTitles(at = 'current') {
    renderTitles();
    titleList.hidden = false; picker.setAttribute('aria-expanded', 'true');
    const items = titleItems(), current = items.findIndex(o => o.getAttribute('aria-selected') === 'true');
    items[at === 'last' ? items.length - 1 : Math.max(0, current)]?.focus({ preventScroll: true });
  }
  function closeTitles(refocus = true) {
    if (titleList.hidden) return;
    titleList.hidden = true; picker.setAttribute('aria-expanded', 'false');
    if (refocus) picker.focus({ preventScroll: true });
  }
  function chooseTitle(name) {
    const result = selectTitle(name);
    if (result.ok) { renderTitles(); if (!result.saved) status('호칭은 이번 실행 동안 유지됩니다.'); }
    closeTitles();
  }
  listen(picker, 'click', () => (titleList.hidden ? openTitles() : closeTitles()));
  listen(picker, 'keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); openTitles(e.key === 'ArrowUp' ? 'last' : 'current'); }
    else if (e.key === 'Escape' && !titleList.hidden) { e.preventDefault(); closeTitles(); }
  });
  listen(titleList, 'keydown', e => {
    const items = titleItems(), i = items.indexOf(root.activeElement);
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : Math.min(items.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)));
      items[next]?.focus({ preventScroll: true });
    } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (items[i]) chooseTitle(items[i].dataset.title); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeTitles(); }
    else if (e.key === 'Tab') closeTitles(); // 단추로 돌린 뒤 브라우저가 다음 칸으로 옮긴다
  });
  listen(titleList, 'click', e => { const item = e.target.closest('[role=option]'); if (item) chooseTitle(item.dataset.title); });
  listen(root, 'pointerdown', e => { if (!titleList.hidden && !e.composedPath().some(n => n === picker || n === titleList)) closeTitles(false); });
  renderWallet(); renderTitles();
  $('lobbyName').textContent = profile.name;
  const total = profile.wins + profile.losses;
  $('duelRecord').textContent = `${profile.wins}승리 ${profile.losses}패배 (${total ? Math.round(profile.wins / total * 100) : 0}%)`;
  if (converted?.coins) status(`인장 ${converted.seals}개를 금화 ${converted.coins.toLocaleString('ko-KR')}으로 바꿨습니다.`, 'notice');
  // ① 프로필 칸 (사장님 10/17 22:1x — 3D 미리보기를 없애고 정사각 프로필 사진 자리 · docs/design/portrait_ui_2026-10-17.md): 지금 플레이어의 프로필
  //  (10/18 16:3x 기본 = 샛별 새 투명 배경 도트판 · 플레이어 = player2 그림 · ?portrait=hd / low 예비 · ?portraitGrid=1 칸 줄 — portraits.js).
  //  ?hero=<인물 id> 로 다른 영웅이면 그 그림(main.js lobbyPortraitId). 그림 안에 액자 1 이 있어 CSS 틀은 없다 · 못 불러오면 빈 액자 1(data-empty — lobby.css)
  const portraitId = game.lobbyPortraitId?.() ?? 'player', portraitImg = $('lobbyPortraitImg');
  $('lobbyPortrait').dataset.portrait = portraitId; $('lobbyPortrait').dataset.mode = portraitMode();
  if (portraitGrid()) $('lobbyPortrait').dataset.grid = '';
  portraitImg.alt = `${profile.name} 프로필`;
  listen(portraitImg, 'error', () => { $('lobbyPortrait').dataset.empty = ''; portraitImg.alt = ''; });
  portraitImg.src = portraitSrc(portraitId) ?? portraitSrc('player');
  let selectedItem = null; // 고른 칸 { kind: 'weapon' | 'armor', id } — 무기 · 방어구가 한 판이라 종류도 같이 쥔다
  // 장착 자리: 무기 · 머리(케틀 햇) · 목(용사의 눈물 — 10/17)
  const equipped = { weapon: readLobbyEquipment(), head: readLobbyArmor(), neck: readLobbyNeck() };
  const tree = mountSkillTree($('skillTreeHost'), { test: ctx.test, onWallet: renderWallet, announce: text => { $('skillStatus').textContent = text; } });
  const tabs = [...root.querySelectorAll('.lobby-tabs [role=tab]')]; // 차례 = 2 × 2 칸 차례(윗줄 아이템 · 상점 · 아랫줄 스킬북 · 이벤트) — ↑ ↓ 는 같은 칸 줄, ← → 는 다음 · 앞
  function selectTab(tab) {
    for (const item of tabs) {
      const selected = item === tab; item.setAttribute('aria-selected', String(selected)); item.tabIndex = selected ? 0 : -1;
    }
    for (const panel of root.querySelectorAll('.contents-panel > [role=tabpanel]')) panel.hidden = panel.id !== 'panel' + tab.dataset.panel;
    if (tab.dataset.panel === 'Inventory') { selectedItem = null; renderInventory(); } // 아이템 칸으로 오면 고른 것 없이 (전 무기 · 방어구 탭과 같게)
    if (tab.dataset.panel === 'Skills') tree.refresh();
    root.querySelector('.contents-panel').scrollTop = 0;
  }
  for (const tab of tabs) {
    listen(tab, 'click', () => selectTab(tab));
    listen(tab, 'keydown', e => {
      if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
      e.preventDefault(); const index = tabs.indexOf(tab);
      const offset = { ArrowUp: -2, ArrowDown: 2, ArrowLeft: -1, ArrowRight: 1 }[e.key];
      const next = tabs[e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (index + offset + tabs.length) % tabs.length];
      selectTab(next); next.focus();
    });
  }
  const grid = root.querySelector('.inventory-grid');
  const armorOf = id => LOBBY_ARMORS.find(a => a.id === id);
  // 아이템 칸 차례 (사장님 10/18 04:1x '무기+방어구 합쳐서 아이템'): 무기 다 → 방어구 다 — lobby_equipment.js 의 두 표 그대로(LOBBY_ITEMS · LOBBY_ARMORS)
  const ITEMS = Object.freeze([...LOBBY_ITEMS.map(id => ({ kind: 'weapon', id })), ...LOBBY_ARMORS.map(a => ({ kind: 'armor', id: a.id }))]);
  const COLS = 6, ROWS = 4; // 칸 판 6 × 4 = 24 칸 (사장님 10/18 04:1x '가로 5칸에서 6칸으로' · 세로 4 줄 그대로 — 칸 크기는 lobby.css --cell, 줄 수는 lobby.css 판 높이와 같게)
  const itemOf = button => ({ kind: 'weapon' in button.dataset ? 'weapon' : 'armor', id: button.dataset.item }); // 칸 단추 → 물건 (data-weapon · data-armor 가 종류)
  const sameItem = (a, b) => !!a && !!b && a.kind === b.kind && a.id === b.id;
  const slotOf = item => item.kind === 'armor' ? armorSlot(item.id) : 'weapon'; // 이 물건을 거는 자리 (equipped 열쇠 — 무기 · 머리 · 목)
  const isOn = item => equipped[slotOf(item)] === item.id;
  const itemName = item => item.kind === 'armor' ? armorOf(item.id).nameKo : getWeapon(item.id).nameKo;
  // 설명 카드: 방어구는 lobby_equipment.js 의 글(설명 뒤에 특수 능력 — 등급 색), 무기는 우리 무기 자료 그대로 (카드 설명의 줄바꿈은 빈칸으로 — 무기 카드 .wdesc 와 같게)
  const itemCard = item => {
    if (item.kind === 'armor') { const a = armorOf(item.id); return { name: a.nameKo, tier: a.tier, description: a.description, ability: a.ability }; }
    const spec = getWeapon(item.id);
    const sp = weaponSpecText(spec); // 스펙은 대기실 아이템 창에서만 — 설명 뒤 한 칸 띄고 (종류, 길이, 무게) (사장님 10/19 02:0x)
    return { name: spec.nameKo, tier: TIER_LABEL[spec.tier] ? spec.tier : 'common', description: `${spec.desc || ''}${sp ? ` (${sp})` : ''}`.trim(), ability: '' };
  };
  // 칸: 그림 = 칸의 80 % · 매끈하게 줄임 · 뒤에 등급 빛(무기 카드 앞면 .wthumb 와 같은 원 빛 — data-tier · lobby.css) — 사장님 ⑨ 1 단계(감독 검토 §2)
  //  칸 수 = 24(빈 칸이 채움) · 물건이 24 개보다 많으면 6 칸씩 줄을 더한다 — 판 높이는 4 줄 그대로라 판 안에서 내려 본다(숨기지 않음 · 담는 수 규칙 없음)
  function renderInventory() {
    const slots = Math.max(COLS * ROWS, Math.ceil(ITEMS.length / COLS) * COLS);
    $('inventoryCount').textContent = `${ITEMS.length}개`;
    grid.setAttribute('aria-label', `가로 ${COLS}칸 세로 ${slots / COLS}칸`);
    grid.innerHTML = Array.from({ length: slots }, (_, i) => {
      const item = ITEMS[i];
      if (!item) return '<span class="inventory-slot" aria-hidden="true"></span>';
      const thumbnail = item.kind === 'armor' ? armorOf(item.id).thumbnail : `ui/weapons/${item.id}.webp`;
      return `<button class="inventory-item" data-item="${item.id}" data-${item.kind}="${item.id}" data-tier="${itemCard(item).tier}" aria-pressed="false"><img src="${thumbnail}" alt="${itemName(item)}" draggable="false"><span class="equipped-badge" hidden>장착 중</span></button>`;
    }).join('');
    grid.scrollTop = 0;
    for (const img of grid.querySelectorAll('.inventory-item img')) fitThumb(img);
    refreshEquipment();
  }
  function refreshEquipment() {
    for (const button of grid.querySelectorAll('[data-item]')) {
      const item = itemOf(button), on = isOn(item);
      button.setAttribute('aria-pressed', String(sameItem(item, selectedItem)));
      button.querySelector('.equipped-badge').hidden = !on;
      button.classList.toggle('is-equipped', on); // lobby.css — 알약 자리가 찬 그림은 장착 중일 때 줄여 내림
      button.setAttribute('aria-label', `${itemName(item)}${on ? ' · 장착 중' : ''} 선택`);
    }
    // 장착 · 해제: 지금 누를 수 있는 쪽 = 주 단추 · 다른 쪽 = 누를 수 없는 부 단추 (꼴은 entrance_ui.css — 누를 수 있나로 고른다)
    $('equipItem').disabled = !selectedItem || isOn(selectedItem);
    $('unequipItem').disabled = !selectedItem || !isOn(selectedItem);
    $('itemDetail').hidden = !selectedItem;
    if (selectedItem) {
      const card = itemCard(selectedItem);
      $('itemDetail').dataset.tier = card.tier;
      $('itemName').textContent = card.name; $('itemRarity').textContent = TIER_LABEL[card.tier];
      $('itemDescription').textContent = card.description;
      if (card.ability) { const a = document.createElement('span'); a.className = 'item-ability'; a.textContent = ` ${card.ability}`; $('itemDescription').append(a); }
    }
  }
  listen(grid, 'click', event => {
    const button = event.target.closest('[data-item]'), item = button && itemOf(button);
    selectedItem = !item || sameItem(item, selectedItem) ? null : item; refreshEquipment();
  });
  // 걸기(on) · 벗기 — 그 물건의 자리만 바뀐다 (무기 = 무기 자리 · 케틀 햇 = 머리 · 용사의 눈물 = 목 — 케틀 햇을 벗어도 용사의 눈물은 그대로 · 반대도). 프로필 그림은 장착과 무관(10/17 — 3D 미리보기 없앰)
  function equip(item, on) {
    try {
      const slot = slotOf(item), value = on ? item.id : null;
      equipped[slot] = value;
      const saved = slot === 'weapon' ? saveLobbyEquipment(value) : slot === 'head' ? saveLobbyArmor(value) : saveLobbyNeck(value);
      $('equipmentStatus').textContent = `${itemName(item)} ${on ? '장착' : '장착 해제'}${saved ? '' : '. 이번 실행 동안 유지됩니다.'}`;
      refreshEquipment();
    } catch { $('equipmentStatus').textContent = '장비를 표시하지 못했습니다. 다시 시도해 주세요.'; }
  }
  // 누른 단추가 사라지지 않게 초점을 짝 단추로 (장착하면 해제가, 해제하면 장착이 주 단추가 된다)
  listen($('equipItem'), 'click', () => { if (selectedItem && !isOn(selectedItem)) { equip(selectedItem, true); $('unequipItem').focus({ preventScroll: true }); } });
  listen($('unequipItem'), 'click', () => { if (selectedItem && isOn(selectedItem)) { equip(selectedItem, false); $('equipItem').focus({ preventScroll: true }); } });
  renderInventory();
  listen($('editName'), 'click', () => { $('playerNameInput').value = readProfile().name; $('nameError').textContent = ''; $('nameDialog').showModal(); $('playerNameInput').select(); });
  listen($('cancelName'), 'click', () => $('nameDialog').close());
  listen($('nameForm'), 'submit', e => {
    e.preventDefault(); const result = renamePlayer($('playerNameInput').value);
    if (!result.ok) { $('nameError').textContent = '이름을 입력해 주세요.'; return; }
    $('lobbyName').textContent = readProfile().name; $('nameDialog').close();
    status(result.saved ? '' : '이름은 이번 실행 동안 유지됩니다.');
  });
  listen($('lobbyBack'), 'click', onBack);
  let departing = false;
  listen($('lobbyDepart'), 'click', async () => {
    if (departing) return; departing = true; $('lobbyDepart').disabled = true; $('lobbyBack').disabled = true;
    try { await onDepart(); } catch { status('여정을 열지 못했습니다. 다시 시도해 주세요.'); }
    finally { departing = false; $('lobbyDepart').disabled = false; $('lobbyBack').disabled = false; }
  });
  $('lobbyHeading').focus();
  return {
    tree, // 시험·사진 도구: lobby.tree.show('german', 2)
    destroy() { events.abort(); tree.destroy(); $('nameDialog').close(); grove.dispose(); },
  };
}
