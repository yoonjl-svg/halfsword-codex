import { mountTitleAccount } from './account/title_account.js';
import { UPDATE_NOTES } from './update_notes.js';
import { createPixelWind } from './pixel_wind.js';
import { createPixelGrove, paintPixelWordmark } from './pixel_grove.js';

export function mountStartScreen({ root = document, pixelTheme = false, storageKey, onChoice } = {}) {
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
    text: '적막', font: '600 18px Pretendard', height: 29, baseline: 22, tracking: 4, letterOffsets: [0, 1],
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
const account = $('openAccount') ? mountTitleAccount(root) : null;
for (const id of ['newJourney', 'continueJourney']) listen($(id), 'click', () => {
  if (onChoice) { onChoice(id === 'newJourney' ? 'new' : 'continue'); return; }
  for (const other of ['newJourney', 'continueJourney']) $(other).setAttribute('aria-pressed', String(other === id));
  entrance.dataset.choice = id === 'newJourney' ? 'new' : 'continue';
  $('selectionStatus').textContent = `${$(id).textContent} 선택`;
});
showNotices();

return {
  setStatus(text) { $('selectionStatus').textContent = text; $('selectionStatus').classList.remove('sr-only'); },
  setBusy(busy) { for (const id of ['newJourney', 'continueJourney', 'openNotices', 'openAccount']) if ($(id)) $(id).disabled = busy; },
  destroy() { clearTimeout(transition); events.abort(); if (dialog.open) dialog.close(); account?.destroy(); if (scene.dispose) scene.dispose(); else scene.calm(); },
};
}
