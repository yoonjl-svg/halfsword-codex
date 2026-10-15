import { UPDATE_NOTES } from './update_notes.js';
import { createPixelWind } from './pixel_wind.js';
import { createPixelGrove, paintPixelWordmark } from './pixel_grove.js';

export function mountStartScreen({ root = document, pixelTheme = false, storageKey, onChoice, settings } = {}) {
const STORAGE_KEY = storageKey || (pixelTheme ? 'stillness.start-preview.pixel.notices.v1' : 'stillness.start-preview.notices.v1');
const $ = id => root.getElementById(id);
const events = new AbortController();
const listen = (el, type, fn, options = {}) => el.addEventListener(type, fn, { ...options, signal: events.signal });
const entrance = $('entrance'), title = $('titleScreen'), dialog = $('noticeDialog');
const list = $('noticeList'), checkbox = $('hideRead'), seen = new Set();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const scene = (pixelTheme ? createPixelGrove : createPixelWind)($('windScene'), reducedMotion);
if (pixelTheme) {
  paintPixelWordmark(root.querySelector('.pixel-wordmark'));
  paintPixelWordmark(root.querySelector('.title-korean'), {
    text: '적막', font: '600 18px Pretendard', height: 29, baseline: 22, tracking: 4,
  });
}
let saved = { hideRead: false, readIds: [] }, transition = 0, visibleNotes = [];
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
  clearTimeout(transition);
  entrance.dataset.phase = 'notice'; title.inert = true; scene.calm(); seen.clear();
  visibleNotes = UPDATE_NOTES.filter(note => all || !saved.hideRead || !read.has(note.id));
  if (!visibleNotes.length) { showTitle(); return; }
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
  checkbox.checked = saved.hideRead; dialog.showModal(); list.scrollTop = 0;
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
  saved = { hideRead: checkbox.checked, readIds: [...read] };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch { /* private mode / quota */ }
  showTitle();
});
listen(dialog, 'cancel', event => { event.preventDefault(); $('confirmNotices').click(); });
listen(list, 'scroll', recordVisible, { passive: true });
listen($('openNotices'), 'click', () => showNotices(true));
// 비교 시안의 설정은 메모리에만 둔다. 실제 게임은 기존 설정 API를 전달한다.
let previewFps = true;
const settingsApi = settings || { get: () => ({ fpsCap: previewFps }), set: value => { previewFps = value; } };
if ($('openSettings')) {
  listen($('openSettings'), 'click', async () => {
    $('settingsDialog').showModal(); $('settingsHeading').focus();
    $('titleFps').disabled = true; $('settingsStatus').textContent = '';
    try {
      const api = await (typeof settingsApi === 'function' ? settingsApi() : settingsApi);
      if (events.signal.aborted) return;
      $('titleFps').checked = api.get().fpsCap; $('titleFps').disabled = false;
    } catch { if (!events.signal.aborted) $('settingsStatus').textContent = '설정을 불러오지 못했습니다. 다시 시도해 주세요.'; }
  });
  listen($('titleFps'), 'change', async () => {
    const value = $('titleFps').checked;
    try { const api = await (typeof settingsApi === 'function' ? settingsApi() : settingsApi); if (!events.signal.aborted) api.set(value); }
    catch { if (!events.signal.aborted) { $('titleFps').checked = !value; $('settingsStatus').textContent = '설정을 저장하지 못했습니다.'; } }
  });
  listen($('closeSettings'), 'click', () => $('settingsDialog').close());
}
for (const id of ['newJourney', 'continueJourney']) listen($(id), 'click', () => {
  if (onChoice) { onChoice(id === 'newJourney' ? 'new' : 'continue'); return; }
  for (const other of ['newJourney', 'continueJourney']) $(other).setAttribute('aria-pressed', String(other === id));
  entrance.dataset.choice = id === 'newJourney' ? 'new' : 'continue';
  $('selectionStatus').textContent = `${$(id).textContent} 선택`;
});
showNotices();

return {
  setStatus(text) { $('selectionStatus').textContent = text; $('selectionStatus').classList.remove('sr-only'); },
  setBusy(busy) { for (const id of ['newJourney', 'continueJourney', 'openNotices', 'openSettings']) if ($(id)) $(id).disabled = busy; },
  destroy() { clearTimeout(transition); events.abort(); if (dialog.open) dialog.close(); $('settingsDialog')?.close(); if (scene.dispose) scene.dispose(); else scene.calm(); },
};
}
