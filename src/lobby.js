import style from './lobby.css?inline';
import { createLobbyCharacter } from './lobby_character.js';
import { readProfile, renamePlayer } from './player_profile.js';
import { journeyClears, masteryOf, SEAL_NAMES, PLAYER_UNIQUE } from './unique_assist.js';
import { TRADITIONS } from './schools.js';
import { getWeapon } from './weapons.js';

export function mountLobby({ root, game, choice, onDepart, onBack }) {
  root.innerHTML = `<style>${style}</style><main class="lobby" aria-labelledby="lobbyHeading">
    <header class="lobby-header"><h1 id="lobbyHeading" tabindex="-1">대기실</h1><button id="lobbyBack">‹ 타이틀로</button></header>
    <div class="lobby-columns">
      <section class="portrait-card" aria-label="내 캐릭터"><div class="character-view" id="characterView" tabindex="0" role="group" aria-label="캐릭터 360도 보기. 드래그 또는 좌우 방향키로 회전, Home으로 정면"></div><p class="rotate-hint">↔ 드래그하여 회전</p></section>
      <section class="profile-panel" aria-label="내 정보">
        <dl class="profile-data"><dt>레벨 호칭</dt><dd id="lobbyRank"></dd><dt>대표 유파</dt><dd id="lobbySchool"></dd><dt>이름</dt><dd class="name-row"><span id="lobbyName"></span><button class="edit-name" id="editName" aria-label="이름 수정"><svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m3 10 7-7 3 3-7 7-4 1 1-4ZM9 4l3 3M2 14h12"/></svg></button></dd></dl>
        <p class="duel-record"><span>대면 후 전적</span><b id="duelRecord"></b></p>
        <nav class="lobby-tabs" role="tablist" aria-label="대기실 메뉴" aria-orientation="vertical">
          <button role="tab" id="tabInventory" aria-controls="panelInventory" aria-selected="true" data-panel="Inventory">인벤토리</button>
          <button role="tab" id="tabSkills" aria-controls="panelSkills" aria-selected="false" tabindex="-1" data-panel="Skills">스킬북</button>
          <button role="tab" id="tabSettings" aria-controls="panelSettings" aria-selected="false" tabindex="-1" data-panel="Settings">설정</button>
        </nav>
        <button class="depart" id="lobbyDepart">${choice === 'continue' ? '여정 이어가기' : '여정 시작'}</button><p id="lobbyStatus" class="lobby-status" role="status"></p>
      </section>
      <section class="contents-panel" aria-label="대기실 상세">
        <div role="tabpanel" id="panelInventory" aria-labelledby="tabInventory">
          <div class="panel-heading"><h2>인벤토리</h2><span>무기 · 2</span></div>
          <div class="inventory-grid" aria-label="6칸 곱하기 5칸 인벤토리">
            ${['tree_branch','longsword'].map(id => `<button class="inventory-item" data-weapon="${id}" aria-label="${getWeapon(id).nameKo} 정보" aria-pressed="false"><img src="ui/weapons/${id}.webp" alt="${getWeapon(id).nameKo}" draggable="false"></button>`).join('')}
          </div>
          <div class="item-detail" aria-live="polite"><h3 id="itemName">무기를 살펴보세요</h3><p id="itemDescription">아이템을 누르면 정보를 볼 수 있습니다.</p></div>
          <p class="inventory-note">대련 무기는 입장 후 카드에서 선택합니다.</p>
        </div>
        <div role="tabpanel" id="panelSkills" aria-labelledby="tabSkills" hidden><div class="panel-heading"><h2>스킬북</h2><span>유파 숙련</span></div><div id="skillList"></div></div>
        <div role="tabpanel" id="panelSettings" aria-labelledby="tabSettings" hidden><div class="panel-heading"><h2>설정</h2></div><label class="setting-row">화면 60 fps 제한<input id="lobbyFps" type="checkbox"></label><p class="setting-note">화면 갱신을 제한해 배터리 소모를 줄입니다.</p></div>
      </section>
    </div>
  </main><dialog class="name-dialog" id="nameDialog" aria-labelledby="nameHeading"><form id="nameForm"><h2 id="nameHeading">이름 수정</h2><label for="playerNameInput">이름 · 최대 16자</label><input id="playerNameInput" name="playerName" autocomplete="off" required maxlength="32"><p class="name-error" id="nameError" role="status"></p><div class="dialog-actions"><button type="button" id="cancelName">취소</button><button type="submit">저장</button></div></form></dialog>`;
  const $ = id => root.getElementById(id), events = new AbortController();
  const listen = (el, type, fn) => el.addEventListener(type, fn, { signal: events.signal });
  const profile = readProfile(), mastery = masteryOf(journeyClears());
  const representative = Object.keys(mastery).sort((a,b) => mastery[b] - mastery[a])[0];
  const level = mastery[representative];
  $('lobbyRank').textContent = level ? SEAL_NAMES[level - 1] : '입문자';
  $('lobbySchool').textContent = level ? `${TRADITIONS[representative].nameKo} 유파` : '아직 없음';
  $('lobbyName').textContent = profile.name;
  const total = profile.wins + profile.losses;
  $('duelRecord').textContent = `${profile.wins}승리 ${profile.losses}패배 (${total ? Math.round(profile.wins / total * 100) : 0}%)`;
  const preview = createLobbyCharacter($('characterView'), game.getLobbyPlayer());
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
      $('panel' + item.dataset.panel).hidden = !selected;
    }
    root.querySelector('.contents-panel').scrollTop = 0;
  }
  for (const tab of tabs) {
    listen(tab, 'click', () => selectTab(tab));
    listen(tab, 'keydown', e => {
      if (!['ArrowUp','ArrowDown','Home','End'].includes(e.key)) return;
      e.preventDefault(); const index = tabs.indexOf(tab);
      const next = tabs[e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (index + (e.key === 'ArrowDown' ? 1 : -1) + tabs.length) % tabs.length];
      selectTab(next); next.focus();
    });
  }
  for (const item of root.querySelectorAll('[data-weapon]')) listen(item, 'click', () => {
    for (const button of root.querySelectorAll('[data-weapon]')) button.setAttribute('aria-pressed', String(item === button));
    const weapon = getWeapon(item.dataset.weapon);
    $('itemName').textContent = weapon.nameKo; $('itemDescription').textContent = weapon.desc || weapon.nameEn;
  });
  $('lobbyFps').checked = game.getLobbySettings().fpsCap;
  listen($('lobbyFps'), 'change', () => game.setLobbyFps($('lobbyFps').checked));
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
  return { destroy() { events.abort(); $('nameDialog').close(); preview.dispose(); } };
}
