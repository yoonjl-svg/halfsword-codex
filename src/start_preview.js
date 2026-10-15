import './start_screen.css';
import './start_pixel.css';
import { UPDATE_NOTES } from './update_notes.js';
import { createPixelWind } from './pixel_wind.js';
import { createPixelGrove, paintPixelWordmark } from './pixel_grove.js';

// 시안은 게임의 진행/설정/계정 저장소를 읽거나 지우지 않는다.
const pixelTheme = document.documentElement.dataset.startTheme === 'pixel';
const STORAGE_KEY = pixelTheme ? 'stillness.start-preview.pixel.notices.v1' : 'stillness.start-preview.notices.v1';
const $ = id => document.getElementById(id);
const entrance = $('entrance'), title = $('titleScreen'), dialog = $('noticeDialog');
const list = $('noticeList'), checkbox = $('hideRead'), seen = new Set();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const scene = (pixelTheme ? createPixelGrove : createPixelWind)($('windScene'), reducedMotion);
if (pixelTheme) paintPixelWordmark(document.querySelector('.pixel-wordmark'));
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

$('confirmNotices').addEventListener('click', () => {
  recordVisible();
  // 실제로 화면에 들어온 항목만 읽음 처리한다. 아래까지 스크롤하지 않은 공지는 다음에도 남는다.
  for (const id of seen) read.add(id);
  saved = { hideRead: checkbox.checked, readIds: [...read] };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch { /* private mode / quota */ }
  showTitle();
});
dialog.addEventListener('cancel', event => { event.preventDefault(); $('confirmNotices').click(); });
list.addEventListener('scroll', recordVisible, { passive: true });
$('openNotices').addEventListener('click', () => showNotices(true));
for (const id of ['newJourney', 'continueJourney']) $(id).addEventListener('click', () => {
  for (const other of ['newJourney', 'continueJourney']) $(other).setAttribute('aria-pressed', String(other === id));
  entrance.dataset.choice = id === 'newJourney' ? 'new' : 'continue';
  $('selectionStatus').textContent = `${$(id).textContent} 선택`;
});
showNotices();
