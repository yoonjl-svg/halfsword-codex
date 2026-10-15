import style from './lobby.css?inline';
import titleStyle from './start_pixel.css?inline';
import { createPixelGrove, paintPixelWordmark } from './pixel_grove.js';
import { LOBBY_ITEMS, LOBBY_ARMOR, readLobbyEquipment, saveLobbyEquipment, readLobbyArmor, saveLobbyArmor } from './lobby_equipment.js';
import { createLobbyCharacter } from './lobby_character.js';
import { readProfile, renamePlayer } from './player_profile.js';
import { readProgress } from './lobby_progress.js';
import { journeyClears, masteryOf, SEAL_NAMES, PLAYER_UNIQUE } from './unique_assist.js';
import { TRADITIONS } from './schools.js';
import { getWeapon } from './weapons.js';

export function mountLobby({ root, game, choice, onDepart, onBack }) {
  root.innerHTML = `<style>${titleStyle}\n${style}</style><main class="lobby" data-start-theme="pixel" aria-labelledby="lobbyHeading">
    <canvas class="lobby-backdrop" id="lobbyGrove" aria-hidden="true"></canvas><div class="lobby-shade" aria-hidden="true"></div>
    <header class="lobby-header"><h1 id="lobbyHeading" tabindex="-1"><span>대기실</span></h1><button id="lobbyBack">‹ 첫 화면으로</button></header>
    <div class="lobby-columns">
      <section class="character-panel"><div class="portrait-card card-frame" aria-label="내 캐릭터"><div class="character-view" id="characterView" tabindex="0" role="group" aria-label="캐릭터 360도 보기. 드래그 또는 좌우 방향키로 회전, Home으로 정면"></div><p class="rotate-hint">↔ 드래그하여 회전</p></div><div class="departure-actions start-actions"><button class="depart" id="lobbyDepart">${choice === 'continue' ? '여정 이어가기' : '여정 시작'}</button></div><p id="lobbyStatus" class="lobby-status" role="status"></p></section>
      <section class="profile-panel" aria-label="내 정보">
        <dl class="profile-data"><dt class="sr-only">레벨과 호칭</dt><dd id="lobbyRank"></dd><dt class="sr-only">이름</dt><dd class="name-row"><span id="lobbyName"></span><button class="edit-name" id="editName" aria-label="이름 수정"><svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m3 10 7-7 3 3-7 7-4 1 1-4ZM9 4l3 3M2 14h12"/></svg></button></dd><dt>대표 유파</dt><dd id="lobbySchool"></dd></dl>
        <p class="duel-record"><span>대면 결과</span><b id="duelRecord"></b></p>
        <p class="coin-balance"><svg class="coin-icon" viewBox="0 0 16 16" role="img" aria-label="금화" shape-rendering="crispEdges"><path fill="#674823" d="M2 0h12v2h2v12h-2v2H2v-2H0V2h2Z"/><path fill="#d9a441" d="M3 1h10v2h2v10h-2v2H3v-2H1V3h2Z"/><path fill="#f3d785" d="M4 3h8v2H5v7H3V4h1Z"/><path fill="#93662b" d="M11 5h2v7h-1v1H5v-2h6Z"/><path fill="#f3d785" d="M7 6h2v4H7Z"/></svg><span id="lobbyCoins"></span></p>
        <nav class="lobby-tabs start-actions" role="tablist" aria-label="대기실 메뉴">
          <button role="tab" id="tabWeapons" aria-controls="panelInventory" aria-selected="true" data-panel="Inventory" data-category="weapon">무기</button>
          <button role="tab" id="tabArmor" aria-controls="panelInventory" aria-selected="false" tabindex="-1" data-panel="Inventory" data-category="armor">방어구</button>
          <button role="tab" id="tabShop" aria-controls="panelShop" aria-selected="false" tabindex="-1" data-panel="Shop">상점</button>
          <button role="tab" id="tabSkills" aria-controls="panelSkills" aria-selected="false" tabindex="-1" data-panel="Skills">스킬북</button>
        </nav>
      </section>
      <section class="contents-panel" aria-label="대기실 상세">
        <div role="tabpanel" id="panelInventory" aria-labelledby="tabWeapons">
          <div class="panel-heading"><h2 id="inventoryHeading">무기</h2><span id="inventoryCount"></span></div>
          <div class="inventory-frame card-frame"><div class="inventory-grid" aria-label="가로 5칸 세로 4칸"></div>
          <div class="item-detail" id="armorDetail" hidden><p><b id="armorName"></b><span id="armorRarity"></span></p><p id="armorDescription"></p></div></div>
          <div class="equipment-actions start-actions"><button id="equipItem" disabled>장착</button><button id="unequipItem" disabled>해제</button></div>
          <p id="equipmentStatus" class="sr-only" role="status"></p>
        </div>
        <div role="tabpanel" id="panelShop" aria-labelledby="tabShop" hidden><div class="panel-heading"><h2>상점</h2></div><p class="empty-panel">아직 판매 중인 물품이 없습니다.</p></div>
        <div role="tabpanel" id="panelSkills" aria-labelledby="tabSkills" hidden><div class="panel-heading"><h2>스킬북</h2><span>유파 숙련</span></div><div id="skillList"></div></div>
      </section>
    </div>
  </main><dialog class="name-dialog" id="nameDialog" aria-labelledby="nameHeading"><form id="nameForm"><h2 id="nameHeading">이름 수정</h2><label for="playerNameInput">이름 · 최대 16자</label><input id="playerNameInput" name="playerName" autocomplete="off" required maxlength="32"><p class="name-error" id="nameError" role="status"></p><div class="dialog-actions start-actions"><button type="button" id="cancelName">취소</button><button type="submit">저장</button></div></form></dialog>`;
  const $ = id => root.getElementById(id), events = new AbortController();
  const listen = (el, type, fn) => el.addEventListener(type, fn, { signal: events.signal });
  const grove = createPixelGrove($('lobbyGrove'), matchMedia('(prefers-reduced-motion: reduce)')); grove.gust();
  paintPixelWordmark($('lobbyHeading'), { text: '대기실', font: '600 18px Pretendard', height: 29, baseline: 22, tracking: 2 });
  const profile = readProfile(), mastery = masteryOf(journeyClears());
  const representative = Object.keys(mastery).sort((a,b) => mastery[b] - mastery[a])[0];
  const level = mastery[representative];
  const progress = readProgress();
  $('lobbyRank').textContent = `Lv.${progress.level} ${progress.title}`;
  $('lobbyCoins').textContent = progress.coins.toLocaleString('ko-KR');
  $('lobbySchool').textContent = level ? `${TRADITIONS[representative].nameKo} 유파` : '아직 없음';
  $('lobbyName').textContent = profile.name;
  const total = profile.wins + profile.losses;
  $('duelRecord').textContent = `${profile.wins}승리 ${profile.losses}패배 (${total ? Math.round(profile.wins / total * 100) : 0}%)`;
  const preview = createLobbyCharacter($('characterView'), game.getLobbyPlayer());
  let selectedItem = null, category = 'weapon';
  const equipped = { weapon: readLobbyEquipment(), armor: readLobbyArmor() };
  preview.setWeapon(equipped.weapon); preview.setArmor(equipped.armor);
  for (const [school, stage] of Object.entries(mastery)) {
    const section = document.createElement('section'); section.className = 'skill-group';
    const heading = document.createElement('h3'); heading.textContent = TRADITIONS[school].nameKo;
    const rank = document.createElement('span'); rank.textContent = stage ? SEAL_NAMES[stage - 1] : '미해금'; heading.append(rank); section.append(heading);
    for (const entry of PLAYER_UNIQUE[school]) {
      const def = TRADITIONS[school].unique.find(u => u.name === (entry.path || entry.name));
      const line = document.createElement('p'), unlocked = stage >= entry.stage;
      line.classList.toggle('unlocked', unlocked);
      line.textContent = `${unlocked ? '◆' : '◇'} ${entry.nameKo || def?.nameKo || entry.name}`;
      section.append(line);
    }
    const secret = document.createElement('p'); secret.classList.toggle('unlocked', stage >= 5);
    secret.textContent = `${stage >= 5 ? '◆' : '◇'} 비기 · ${TRADITIONS[school].secret?.nameKo || '미해금'}`;
    section.append(secret); $('skillList').append(section);
  }
  const tabs = [...root.querySelectorAll('[role=tab]')];
  function selectTab(tab) {
    for (const item of tabs) {
      const selected = item === tab; item.setAttribute('aria-selected', String(selected)); item.tabIndex = selected ? 0 : -1;
    }
    for (const panel of root.querySelectorAll('[role=tabpanel]')) panel.hidden = panel.id !== 'panel' + tab.dataset.panel;
    if (tab.dataset.category) {
      category = tab.dataset.category; selectedItem = null;
      $('panelInventory').setAttribute('aria-labelledby', tab.id); renderInventory();
    }
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
  const itemName = id => category === 'armor' ? LOBBY_ARMOR.nameKo : getWeapon(id).nameKo;
  function renderInventory() {
    const items = category === 'armor' ? [LOBBY_ARMOR.id] : LOBBY_ITEMS;
    $('inventoryHeading').textContent = category === 'armor' ? '방어구' : '무기';
    $('inventoryCount').textContent = `${items.length}개`;
    grid.innerHTML = Array.from({length:20}, (_, i) => {
      const id = items[i];
      if (!id) return '<span class="inventory-slot" aria-hidden="true"></span>';
      const thumbnail = category === 'armor' ? LOBBY_ARMOR.thumbnail : `ui/weapons/${id}.webp`;
      return `<button class="inventory-item" data-item="${id}" data-${category}="${id}" aria-pressed="false"><img src="${thumbnail}" alt="${itemName(id)}" draggable="false"><span class="equipped-badge" hidden>장착 중</span></button>`;
    }).join('');
    refreshEquipment();
  }
  function refreshEquipment() {
    for (const button of grid.querySelectorAll('[data-item]')) {
      const id = button.dataset.item;
      button.setAttribute('aria-pressed', String(id === selectedItem));
      button.querySelector('.equipped-badge').hidden = id !== equipped[category];
      button.setAttribute('aria-label', `${itemName(id)}${id === equipped[category] ? ' · 장착 중' : ''} 선택`);
    }
    $('equipItem').disabled = !selectedItem || selectedItem === equipped[category];
    $('unequipItem').disabled = !selectedItem || selectedItem !== equipped[category];
    $('armorDetail').hidden = category !== 'armor' || !selectedItem;
    $('armorName').textContent = LOBBY_ARMOR.nameKo; $('armorRarity').textContent = LOBBY_ARMOR.rarity;
    $('armorDescription').textContent = LOBBY_ARMOR.description;
  }
  listen(grid, 'click', event => {
    const id = event.target.closest('[data-item]')?.dataset.item;
    selectedItem = !id || id === selectedItem ? null : id; refreshEquipment();
  });
  function equip(id) {
    try {
      if (category === 'armor') preview.setArmor(id); else preview.setWeapon(id);
      equipped[category] = id;
      const saved = category === 'armor' ? saveLobbyArmor(id) : saveLobbyEquipment(id);
      $('equipmentStatus').textContent = `${id ? itemName(id) + ' 장착' : '장착 해제'}${saved ? '' : '. 이번 실행 동안 유지됩니다.'}`;
      refreshEquipment();
    } catch { $('equipmentStatus').textContent = '장비를 표시하지 못했습니다. 다시 시도해 주세요.'; }
  }
  listen($('equipItem'), 'click', () => { if (selectedItem && selectedItem !== equipped[category]) equip(selectedItem); });
  listen($('unequipItem'), 'click', () => { if (selectedItem && selectedItem === equipped[category]) equip(null); });
  renderInventory();
  listen($('editName'), 'click', () => { $('playerNameInput').value = readProfile().name; $('nameError').textContent = ''; $('nameDialog').showModal(); $('playerNameInput').select(); });
  listen($('cancelName'), 'click', () => $('nameDialog').close());
  listen($('nameForm'), 'submit', e => {
    e.preventDefault(); const result = renamePlayer($('playerNameInput').value);
    if (!result.ok) { $('nameError').textContent = '이름을 입력해 주세요.'; return; }
    $('lobbyName').textContent = readProfile().name; $('nameDialog').close();
    $('lobbyStatus').textContent = result.saved ? '' : '이름은 이번 실행 동안 유지됩니다.';
  });
  listen($('lobbyBack'), 'click', onBack);
  let departing = false;
  listen($('lobbyDepart'), 'click', async () => {
    if (departing) return; departing = true; $('lobbyDepart').disabled = true; $('lobbyBack').disabled = true;
    try { await onDepart(); } catch { $('lobbyStatus').textContent = '여정을 열지 못했습니다. 다시 시도해 주세요.'; }
    finally { departing = false; $('lobbyDepart').disabled = false; $('lobbyBack').disabled = false; }
  });
  $('lobbyHeading').focus();
  return { destroy() { events.abort(); $('nameDialog').close(); preview.dispose(); grove.dispose(); } };
}
