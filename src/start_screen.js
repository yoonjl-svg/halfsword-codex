// 첫 화면: 공지 → 바람·낙엽과 픽셀 제목 'Stillness' → Stage 1 · 이어하기 → 곧바로 싸움 (샛별 저장소 시작 화면 — docs/import/lobby_port_2026-10-16.md §2)
//  사장님 10/17 11:2x: 게임 이름은 이제 Stillness — 한글 제목 줄을 지움 · '처음부터'는 모든 게 지워지는 것처럼 들려 'Stage 1'(첫 무대부터 — 금화 · 장비 · 스킬북 · 기록은 그대로) ·
//   첫 화면 → 대기실 → 싸움이 아니라 첫 화면에서 곧바로 싸움(game_entry.js depart — 대기실은 싸움의 정지 · 결과 창에서)
//  아래 꾸밈(ENTRANCE_HTML)과 동작은 샛별 쪽 마지막 판(e52d23b0) 그대로이고, 다른 점은:
//   ① 아래 줄 세 칸 = 공지사항 · 설정 · 계정 연결 (설정은 샛별 3b280a1b 판에 있던 것 — 마지막 판은 설정 자리에 계정 연결)
//   ② 계정 연결은 메일 6자리 번호로만 (src/account/title_account.js) · 그 모듈은 첫 화면이 뜬 뒤에 따로 받는다(첫 그림을 늦추지 않게)
//   ③ 픽셀 시안만 (첫 시안의 바람 장면 pixel_wind.js 는 들여오지 않았다)
//   ④ 단추 = 싸움 화면 단추 (사장님 10/16 15:3x ② — docs/import/ui_unify_2026-10-16.md): Stage 1 · 공지 확인 · 설정 확인 · 인증번호 받기 · 연결하기 = 주 단추(.primary),
//      이어하기 · 아래 줄 세 칸 · 계정 닫기 = 부 단추(.secondary — 그림 위면 .on-art · 작으면 .small) · 꼴은 entrance_ui.css
//   ⑤ '화면 60 fps 제한' · '지난 업데이트 숨김' = 싸움 화면 미닫이 (사장님 ③ "설정은 미닫이가 맞아") — role=switch · aria-checked, 하는 일 · 저장은 전과 같다
//  game_entry.js 가 Shadow DOM 안에 붙인다 — 게임 HUD 글자 규칙(index.html)과 섞이지 않는다.
import { UPDATE_NOTES } from './update_notes.js';
import { createPixelGrove, paintPixelWordmark } from './pixel_grove.js';

export const NOTICE_KEY = 'stillness.title.notices.v1';

export const ENTRANCE_HTML = `<main id="entrance" data-phase="notice">
  <canvas id="windScene" aria-hidden="true"></canvas>
  <div class="scene-shade" aria-hidden="true"></div>
  <section id="titleScreen" class="title-screen" aria-label="시작 화면" inert>
    <div class="title-group">
      <h1 class="pixel-wordmark"><span>Stillness</span></h1>
      <div class="title-rule" aria-hidden="true"><span></span></div>
      <div class="start-actions" aria-label="여정 선택">
        <button type="button" id="newJourney" class="primary" aria-pressed="false" aria-label="Stage 1 — 첫 무대부터">Stage 1</button>
        <button type="button" id="continueJourney" class="secondary on-art" aria-pressed="false">이어하기</button>
      </div>
      <p id="selectionStatus" class="sr-only" role="status"></p>
    </div>
    <footer class="title-footer"><button id="openNotices" type="button" class="secondary small on-art utility">공지사항</button><button id="openSettings" type="button" class="secondary small on-art utility">설정</button><button id="openAccount" type="button" class="secondary small on-art utility" disabled>계정 연결</button></footer>
  </section>
  <dialog id="noticeDialog" aria-labelledby="noticeHeading" aria-describedby="noticeIntro">
    <header class="notice-header">
      <h2 id="noticeHeading" tabindex="-1">공지사항</h2>
      <span id="noticeCount" class="notice-count"></span>
      <p id="noticeIntro" class="sr-only">최근 업데이트를 확인하세요.</p>
    </header>
    <div id="noticeList" class="notice-list" tabindex="0" aria-label="업데이트 목록, 스크롤 가능"></div>
    <footer class="notice-footer">
      <label class="hide-read" for="hideRead"><button id="hideRead" type="button" class="toggle" role="switch" aria-checked="false" aria-labelledby="hideReadLabel"></button><span id="hideReadLabel">지난 업데이트 숨김</span></label>
      <button id="confirmNotices" class="confirm-button primary" type="button">확인<span aria-hidden="true">→</span></button>
    </footer>
  </dialog>
  <dialog id="settingsDialog" aria-labelledby="settingsHeading">
    <header class="notice-header"><h2 id="settingsHeading" tabindex="-1">설정</h2></header>
    <div class="settings-content"><label class="setting-row" for="titleFps"><span id="titleFpsLabel">화면 60 fps 제한</span><button id="titleFps" type="button" class="toggle" role="switch" aria-checked="true" aria-labelledby="titleFpsLabel"></button></label><p>화면 갱신을 제한해 배터리 소모를 줄입니다.</p><p id="settingsStatus" role="status"></p></div>
    <footer class="notice-footer"><button id="closeSettings" class="confirm-button primary" type="button">확인</button></footer>
  </dialog>
  <dialog id="accountDialog" aria-labelledby="accountHeading">
    <header class="notice-header"><h2 id="accountHeading" tabindex="-1">계정 연결</h2></header>
    <div class="account-content">
      <div id="accountConnected" hidden><p id="accountAddress"></p><button id="accountLogout" class="account-text-button" type="button">이 기기에서 로그아웃</button></div>
      <div id="accountForms">
        <form id="accountEmailForm"><p id="accountIntro">이메일로 받은 6자리 인증번호로 연결합니다.</p><label for="accountEmail">이메일</label><input id="accountEmail" type="email" autocomplete="email" autocapitalize="none" spellcheck="false" required /><button id="accountSend" class="account-submit primary" type="submit">인증번호 받기</button><button id="accountMode" class="account-text-button" type="button">기존 계정으로 로그인</button></form>
        <form id="accountCodeForm" hidden><p id="accountCodeHelp"></p><label for="accountCode">인증번호</label><input id="accountCode" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" minlength="6" maxlength="10" required /><button id="accountVerify" class="account-submit primary" type="submit">연결하기</button><div class="account-secondary"><button id="accountResend" class="account-text-button" type="button">다시 받기</button><button id="accountEditEmail" class="account-text-button" type="button">이메일 수정</button></div></form>
      </div>
      <p id="accountStatus" role="status"></p><p class="account-note">여정 기록은 현재 기기에 저장됩니다.</p>
    </div>
    <footer class="notice-footer"><button id="closeAccount" class="confirm-button secondary" type="button">닫기</button></footer>
  </dialog>
</main>`;

/**
 * root: ENTRANCE_HTML 이 붙은 곳(Shadow root) · onChoice('new' | 'continue') · settings: () => Promise<{ get(): { fpsCap }, set(bool) }> (게임 설정 — main.js)
 * accountLoader: () => import('./account/title_account.js') (없으면 계정 단추를 숨긴다) · accountOptions: 시험에서 인증 객체를 바꿔 끼울 때 ({ auth })
 */
export function mountStartScreen({ root = document, storageKey = NOTICE_KEY, onChoice, settings, accountLoader, accountOptions } = {}) {
const STORAGE_KEY = storageKey;
const $ = id => root.getElementById(id);
const events = new AbortController();
const listen = (el, type, fn, options = {}) => el.addEventListener(type, fn, { ...options, signal: events.signal });
const entrance = $('entrance'), title = $('titleScreen'), dialog = $('noticeDialog');
const list = $('noticeList'), hideRead = $('hideRead'), seen = new Set();
// 미닫이(role=switch — 싸움 화면 .toggle 꼴): 켜짐 = aria-checked="true"
const isOn = el => el.getAttribute('aria-checked') === 'true';
const setOn = (el, on) => el.setAttribute('aria-checked', String(!!on));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const scene = createPixelGrove($('windScene'), reducedMotion);
paintPixelWordmark(root.querySelector('.pixel-wordmark'));
let saved = { hideRead: false, readIds: [] }, transition = 0, visibleNotes = [];
// 첫 화면 아래 줄 '공지사항'으로 연 공지 (처음 들어올 때의 공지 → 첫 화면과 다른 길): 확인 = 창만 닫는다 — 첫 화면 바람·제목 나타남을 다시 틀지 않는다
//  (사장님 10/16 08:3x '공지사항 눌렀다가 확인 누르면 창이 닫히는 게 아니라 다시 애니메이션이 재생되는데 고칠 수 있나' — docs/import/ui_fix_2026-10-16.md §2)
let noticeFromTitle = false;
try {
  const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (value && typeof value === 'object') saved = {
    hideRead: value.hideRead === true,
    readIds: Array.isArray(value.readIds) ? value.readIds.filter(id => typeof id === 'string').slice(-500) : [],
  };
} catch { /* 저장소를 사용할 수 없으면 이번 실행에서만 기억한다. */ }
const read = new Set(saved.readIds);

function recordVisible() {
  if (!dialog.open) return;
  const viewport = list.getBoundingClientRect();
  for (const article of list.children) {
    const rect = article.getBoundingClientRect();
    const height = Math.min(rect.bottom, viewport.bottom) - Math.max(rect.top, viewport.top);
    if (height >= Math.min(80, rect.height * .55)) seen.add(article.dataset.noticeId);
  }
}

function showNotices(all = false) {
  noticeFromTitle = all && entrance.dataset.phase === 'ready';
  if (!noticeFromTitle) { clearTimeout(transition); entrance.dataset.phase = 'notice'; title.inert = true; scene.calm(); }
  seen.clear();
  visibleNotes = UPDATE_NOTES.filter(note => all || !saved.hideRead || !read.has(note.id));
  if (!visibleNotes.length) { if (!noticeFromTitle) showTitle(); return; }
  list.replaceChildren();
  for (const note of visibleNotes) {
    const article = document.createElement('article');
    article.className = 'notice-entry'; article.dataset.noticeId = note.id;
    const meta = document.createElement('div'); meta.className = 'notice-meta';
    const time = document.createElement('time'); time.dateTime = note.date.replaceAll('.', '-'); time.textContent = note.date;
    const status = document.createElement('span'); status.textContent = read.has(note.id) ? '읽음' : '새 소식';
    if (!read.has(note.id)) status.className = 'unread';
    const heading = document.createElement('h3'); heading.textContent = note.title;
    const body = document.createElement('p'); body.textContent = note.body;
    meta.append(time, status); article.append(meta, heading, body); list.append(article);
  }
  $('noticeCount').textContent = `업데이트 ${visibleNotes.length}`;
  setOn(hideRead, saved.hideRead); dialog.showModal(); list.scrollTop = 0;
  $('noticeHeading').focus(); requestAnimationFrame(recordVisible);
}

function showTitle() {
  if (dialog.open) dialog.close();
  entrance.dataset.phase = 'wind'; scene.gust();
  transition = setTimeout(() => {
    entrance.dataset.phase = 'ready'; title.inert = false; $('newJourney').focus({ preventScroll: true });
  }, reducedMotion.matches ? 0 : 1800);
}

listen($('confirmNotices'), 'click', () => {
  recordVisible();
  // 실제로 화면에 들어온 항목만 읽음 처리한다. 아래까지 스크롤하지 않은 공지는 다음에도 남는다.
  for (const id of seen) read.add(id);
  saved = { hideRead: isOn(hideRead), readIds: [...read] };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch { /* private mode / quota */ }
  if (noticeFromTitle) { dialog.close(); $('openNotices').focus({ preventScroll: true }); } // 첫 화면에서 연 공지: 창만 닫음 (첫 화면은 그대로 'ready')
  else showTitle(); // 처음 들어올 때: 공지 → 첫 화면 넘어감 그대로
});
listen(hideRead, 'click', () => setOn(hideRead, !isOn(hideRead))); // 저장은 확인을 누를 때 (전 네모 체크와 같게)
listen(dialog, 'cancel', event => { event.preventDefault(); $('confirmNotices').click(); });
listen(list, 'scroll', recordVisible, { passive: true });
listen($('openNotices'), 'click', () => showNotices(true));
// 설정 (샛별 3b280a1b — 대기실에 있던 설정을 첫 화면 공지사항 옆으로): 게임 설정 '화면 60 fps 제한' 하나 (우리 메뉴의 설정 줄과 같은 값 · 같은 저장 gladiator-settings)
if (settings) {
  listen($('openSettings'), 'click', async () => {
    $('settingsDialog').showModal(); $('settingsHeading').focus();
    $('titleFps').disabled = true; $('settingsStatus').textContent = '';
    try {
      const api = await settings();
      if (events.signal.aborted) return;
      setOn($('titleFps'), api.get().fpsCap); $('titleFps').disabled = false;
    } catch { if (!events.signal.aborted) $('settingsStatus').textContent = '설정을 불러오지 못했습니다. 다시 시도해 주세요.'; }
  });
  // 미닫이를 누르면 바로 바꾸고 바로 저장 (전 체크 상자의 change 와 같은 때) — 저장을 못 하면 되돌린다
  listen($('titleFps'), 'click', async () => {
    const value = !isOn($('titleFps'));
    setOn($('titleFps'), value);
    try { const api = await settings(); if (!events.signal.aborted) api.set(value); }
    catch { if (!events.signal.aborted) { setOn($('titleFps'), !value); $('settingsStatus').textContent = '설정을 저장하지 못했습니다.'; } }
  });
  listen($('closeSettings'), 'click', () => $('settingsDialog').close());
} else $('openSettings').hidden = true;
// 계정 연결 (샛별 3688f391 — 메일 6자리 번호로만 고침): 인증 SDK 묶음은 크니 첫 화면을 그린 뒤 따로 받는다. 받기 전에는 단추를 잠가 둔다(누름이 헛돌지 않게)
let account = null, busyNow = false;
if (accountLoader) accountLoader().then(({ mountTitleAccount }) => {
  if (events.signal.aborted) return;
  account = mountTitleAccount(root, accountOptions);
  $('openAccount').disabled = busyNow;
}).catch(() => { if (!events.signal.aborted) $('openAccount').hidden = true; });
else $('openAccount').hidden = true;
for (const id of ['newJourney', 'continueJourney']) listen($(id), 'click', () => {
  if (onChoice) { onChoice(id === 'newJourney' ? 'new' : 'continue'); return; }
  for (const other of ['newJourney', 'continueJourney']) $(other).setAttribute('aria-pressed', String(other === id));
  entrance.dataset.choice = id === 'newJourney' ? 'new' : 'continue';
  $('selectionStatus').textContent = `${$(id).textContent} 선택`;
});
showNotices();

return {
  setStatus(text) { $('selectionStatus').textContent = text; $('selectionStatus').classList.remove('sr-only'); },
  setBusy(busy) {
    busyNow = busy;
    for (const id of ['newJourney', 'continueJourney', 'openNotices', 'openSettings']) $(id).disabled = busy;
    if (account) $('openAccount').disabled = busy;
  },
  destroy() { clearTimeout(transition); events.abort(); if (dialog.open) dialog.close(); $('settingsDialog').close(); account?.destroy(); scene.dispose(); },
};
}
