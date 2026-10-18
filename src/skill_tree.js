// 대기실 스킬북 화면 (docs/import/lobby_fix_2026-10-16.md §6) — 유파 탭 다섯 · 탭마다 책 다섯을 별자리처럼 룬 줄로 잇는다.
//  사장님 10/16 03:5x '스킬트리처럼 유파별 문서가 박힌 … 해금되면 색이 밝아지고 누르면 설명과 함께' · 04:3x '책은 책이지만 별자리나 스킬트리처럼 룬 문자처럼 연결돼 있어.
//   구입하면 밝아지고 사용 봉인 선택 가능. 사용하면 섬네일 자리를 둥근 빛이 감쌈.'
//  상태 셋 (skill_books.js bookState): 안 삼 = 어둡게 + 값 · 사용 = 밝게 + 둥근 빛 · 봉인 = 밝게, 빛 없음(판에서 꺼짐). 줄은 꾸밈 — 아무 차례로나 산다.
//  책을 누르면 판 위에 설명 카드: 이름 · 급 · 등급 · 유파 · 효과 한 줄(고유자세는 넷을 적고 '임시') · 짧은 출처 · 구입(안 삼) 또는 사용 / 봉인(산 책).
//  꾸밈: 판 틀은 픽셀 결(카드 틀 — 겉) · 책 · 금화 그림은 매끈한 3D 그림(속 — 스타일 규칙 '겉은 픽셀, 속은 매끈', docs/design_language.md §5) — 글자는 entrance_type.css 규칙, 색·자리는 lobby.css '스킬북' 칸.
import { BOOK_SCHOOLS, ROMAN, booksOf, readBooks, bookState, setBookInUse, buyBook, headPriceOf } from './skill_books.js';
import { readProgress } from './lobby_progress.js';
import { TRADITIONS } from './schools.js';
import { COIN_SRC } from './wallet_icons.js';
const short = (t) => String(t ?? '').replace(/\s*[(·].*$/, ''); // 고유 공격 이름에서 한글만 (괄호 원어 · 가운뎃점 뒤 설명은 뺀다)

// 별자리 꼴 (판 좌표 300 × 210 — 유파 무기·몸놀림을 본뜸): at = 책 I~V 자리 · links = 이은 줄 (책 번호 1~5).
//  폰 가로 판(263 px)에서 책·이름·값이 안 겹치고, 줄마다 책 칸 밖으로 룬 꾸밈이 들어갈 만큼 비스듬히 떨어지게 (위아래로 붙은 줄은 이름에 가려 안 쓴다).
//  판이 더 좁으면 책 크기를 판에 맞춰 줄인다(--s · 아래 fit) — 잰 도구 tools/browser/skill_tree_layout.mjs (문서 §6)
export const CONSTELLATIONS = Object.freeze({
  german: { at: [[70, 36], [70, 160], [150, 98], [230, 36], [230, 160]], links: [[1, 3], [2, 3], [3, 4], [3, 5]] }, // 엇갈린 두 칼(X): 가운데 III 에서 네 귀로
  italian: { at: [[36, 110], [104, 36], [196, 36], [264, 110], [150, 166]], links: [[1, 2], [2, 3], [3, 4], [4, 5], [5, 1]] }, // 레이피어 컵 고리(오각 고리)
  iberian: { at: [[32, 166], [82, 84], [150, 34], [218, 84], [268, 166]], links: [[1, 2], [2, 3], [3, 4], [4, 5]] }, // 몬탄테: 머리 위로 크게 도는 호
  japanese: { at: [[240, 36], [136, 36], [60, 100], [136, 164], [240, 164]], links: [[1, 2], [2, 3], [3, 4], [4, 5]] }, // 휜 칼날(초승달 꼴)
  chinese: { at: [[42, 46], [96, 164], [150, 70], [204, 164], [258, 46]], links: [[1, 2], [2, 3], [3, 4], [4, 5]] }, // 검무의 꺾이는 걸음(W)
});
const BOARD_PX = 263; // 폰 가로 844 × 390 의 판 너비 — 이보다 좁으면 책·이름·값을 같은 비로 줄인다(0.6 까지) · 넓으면 그대로
const GAP = 3; // 책 칸과 줄 끝 사이 (판 좌표)

const SVG_NS = 'http://www.w3.org/2000/svg';
/**
 * 책 섬네일 — 매끈한 3D 그림 public/ui/books/<유파>_<급>.webp (256 × 336 = 책 칸 32 × 42 와 같은 비 — .book-svg 가 칸을 꽉 채운다):
 *  유파마다 실제 옛 문서 꼴 하나(독일 가죽 펜히트부흐 · 이탈리아 그림 낱장 묶음 · 이베리아 말린 양피지와 밀랍 인장 · 일본 오륜서 두루마리 · 동방 죽간) ·
 *  급은 볼륨(두께 · 높이 · 길이 · 대쪽 수)과 끈 · 리본의 등급 색으로만 (로마 숫자 없음). 사장님 10/16 14:4x ③ · 15:3x ⑨ '무기 그림과 같은 방식' ·
 *  16:1x '유파별로 … 급수 별로 … 사실성' · 17:3x '말린 양피지나 서류더미처럼 여러 가지 형태 … 로마자는 빼도 돼' · 17:4x '실제 오륜서 … 동방 죽간'
 *  (만드는 도구 tools/browser/item_thumbs.mjs — docs/import/item_art_2026-10-16.md). 꾸밈 그림이라 화면 읽기에선 감춘다(책 단추가 이름 · 급 · 상태를 읽는다)
 */
const bookImg = (school, tier) => `<img class="book-svg" src="ui/books/${BOOK_SCHOOLS.includes(school) ? school : 'german'}_${tier}.webp" alt="" aria-hidden="true" draggable="false">`;
// 값 표지 금화 — 대기실 지갑과 같은 금화 그림 (wallet_icons.js — 꾸밈이라 감춤: 단추 이름이 '금화 N' 을 읽는다)
const PRICE_COIN = `<img class="price-coin" src="${COIN_SRC}" alt="" aria-hidden="true" draggable="false">`;

/** 책 자리 a 에서 b 쪽으로 — 그 책의 칸(섬네일 · 값 · 이름, 판 좌표 상자들)을 마지막으로 벗어나는 거리 + 틈 (칸 사이 작은 틈에서 멈추지 않게 끝까지 본다) */
function trimAt(a, b, boxes) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
  let last = -0.5;
  for (let t = 0; t < len; t += 0.5) {
    const x = a[0] + (dx * t) / len, y = a[1] + (dy * t) / len;
    if (boxes.some((r) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3])) last = t;
  }
  return last + 0.5 + GAP;
}

/** 룬 줄 하나 (판 좌표): 두 책 칸 사이에 보이는 곧은 줄(t0 · t1 = 양 끝에서 비운 거리) + 그 가운데 룬 꺾쇠 둘(ᚲ 꼴) + 작은 마름모 — 짧으면 마름모만 */
function runeLink(a, b, lit, t0, t1) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const p = (t, n = 0) => `${(a[0] + ux * t + nx * n).toFixed(1)} ${(a[1] + uy * t + ny * n).toFixed(1)}`;
  const vis = len - t0 - t1, m = t0 + vis / 2, rune = vis >= 22 ? 'full' : vis >= 10 ? 'gem' : 'line';
  let d = vis > 1 ? `M${p(t0)} L${p(len - t1)}` : '';
  if (rune === 'full') d += ` M${p(m - 9, 6)} L${p(m - 3)} L${p(m - 9, -6)} M${p(m + 3, 6)} L${p(m + 9)} L${p(m + 3, -6)}`;
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', `rune-link${lit ? ' lit' : ''}`);
  g.dataset.visible = vis.toFixed(1); // 시험 도구가 읽는다 (skill_tree_layout.mjs)
  g.dataset.rune = rune;
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', d);
  g.append(path);
  if (rune !== 'line') {
    const gem = document.createElementNS(SVG_NS, 'path');
    gem.setAttribute('class', 'rune-gem');
    gem.setAttribute('d', `M${p(m, 0)} m0 -3 l3 3 l-3 3 l-3 -3 z`);
    g.append(gem);
  }
  return g;
}

/**
 * root: 스킬북 칸(Shadow root 안의 #skillTreeHost) · test: 테스트 경로(모두 열림 — 사고팔기 없음) · onWallet(): 금화가 바뀌면(대기실 내 정보 칸 다시 그리기) ·
 * announce(text): 화면 읽기 알림 (10/18: 대기실 3D 몸에 알리던 onBooks 는 그 몸과 같이 지움)
 */
export function mountSkillTree(root, { test = false, onWallet = () => {}, announce = () => {} } = {}) {
  root.innerHTML = `<div class="school-tabs" role="tablist" aria-label="유파">${BOOK_SCHOOLS.map((s, i) => `<button role="tab" data-school="${s}" aria-selected="${i === 0}" tabindex="${i ? -1 : 0}">${TRADITIONS[s].nameKo}</button>`).join('')}</div>
    <div class="tree-frame card-frame"><div class="tree-board" role="tabpanel" aria-label="스킬북 별자리"><svg class="tree-links" viewBox="0 0 300 210" preserveAspectRatio="none" aria-hidden="true"></svg><div class="tree-nodes"></div>
    <section class="book-detail" hidden aria-labelledby="bookTitle"><button type="button" class="detail-close" aria-label="설명 닫기">×</button>
      <div class="detail-head"><span class="book-thumb detail-thumb"></span><div><b id="bookTitle" tabindex="-1"></b><small id="bookMeta"></small></div></div>
      <p id="bookEffect" class="detail-effect"></p><ul id="bookList" class="detail-list" hidden></ul><p id="bookSource" class="detail-source"></p><p id="bookState" class="detail-state" role="status"></p>
      <div class="detail-actions start-actions"><button type="button" id="buyBook">구입</button><button type="button" id="useBook">사용</button><button type="button" id="sealBook">봉인</button></div>
    </section></div></div>`;
  const events = new AbortController();
  const on = (el, type, fn) => el.addEventListener(type, fn, { signal: events.signal });
  const $ = (sel) => root.querySelector(sel);
  const tabs = [...root.querySelectorAll('.school-tabs [role=tab]')];
  let school = BOOK_SCHOOLS[0], selected = null, lastNode = null;
  const stateOf = (books, id) => (test ? 'use' : bookState(books, id));

  // 줄은 책 칸을 잰 뒤 그린다 (책 크기는 판 너비를 따른다 — 판이 숨어 있으면 보일 때 ResizeObserver 가 다시 부른다)
  function drawLinks(books = readBooks()) {
    const board = $('.tree-board'), br = board.getBoundingClientRect(), C = CONSTELLATIONS[school], list = booksOf(school);
    if (!br.width || !br.height) return;
    const kx = 300 / br.width, ky = 210 / br.height;
    const boxes = [...root.querySelectorAll('.book-node')].map((n) => [...n.querySelectorAll('.book-thumb, .book-cat, .book-price')].map((e) => {
      const r = e.getBoundingClientRect();
      return [(r.left - br.left) * kx, (r.top - br.top) * ky, (r.right - br.left) * kx, (r.bottom - br.top) * ky];
    }));
    $('.tree-links').replaceChildren(...C.links.map(([i, j]) => {
      const a = C.at[i - 1], b = C.at[j - 1], lit = stateOf(books, list[i - 1].id) !== 'unowned' && stateOf(books, list[j - 1].id) !== 'unowned';
      return runeLink(a, b, lit, trimAt(a, b, boxes[i - 1]), trimAt(b, a, boxes[j - 1]));
    }));
  }
  const board = $('.tree-board');
  function fit() {
    const w = board.clientWidth;
    if (w) board.style.setProperty('--s', Math.min(1, Math.max(0.6, w / BOARD_PX)).toFixed(3));
    drawLinks();
  }
  const sizer = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
  sizer?.observe(board);

  function render() {
    const books = readBooks(), C = CONSTELLATIONS[school], list = booksOf(school);
    $('.tree-nodes').innerHTML = list.map((b, k) => {
      const st = stateOf(books, b.id), [x, y] = C.at[k];
      const label = `${b.title} · ${ROMAN[b.tier]}급 ${b.rarityKo} · ${st === 'unowned' ? `금화 ${b.price} · 사지 않음` : st === 'use' ? '사용 중' : '봉인'}`;
      return `<button type="button" class="book-node" data-tier="${b.rarity}" data-book="${b.tier}" data-state="${st}" style="left:${(x / 3).toFixed(2)}%;top:${(y / 2.1).toFixed(2)}%" aria-label="${label}" aria-pressed="${selected === b.tier}">
        <span class="book-thumb" data-tier="${b.rarity}">${bookImg(school, b.tier)}</span>
        <span class="book-cat">${b.label}</span>${st === 'unowned' ? `<span class="book-price">${PRICE_COIN}${b.price}</span>` : ''}</button>`;
    }).join('');
    root.dataset.school = school;
    drawLinks(books);
    renderDetail(books);
  }

  function renderDetail(books = readBooks()) {
    const box = $('.book-detail');
    if (!selected) { box.hidden = true; return; }
    const b = booksOf(school)[selected - 1], st = stateOf(books, b.id), coins = readProgress().coins;
    box.hidden = false;
    box.dataset.state = st;
    $('.detail-thumb').dataset.tier = b.rarity;
    $('.detail-thumb').innerHTML = bookImg(school, b.tier);
    $('.detail-head').dataset.state = st;
    $('#bookTitle').textContent = b.orig ? `${b.title} (${b.orig})` : b.title; // 원어는 스킬북에서만 (10/19 3차)
    $('#bookTitle').dataset.tier = b.rarity;
    // 급 · 등급 · 유파 · 지금 상태(사용 중 = 싸움에서 켜짐 · 봉인 = 꺼짐) 한 줄 — 폰 가로의 좁은 판에서도 단추까지 한눈에 들어오게
    $('#bookMeta').textContent = `${ROMAN[b.tier]}급 · ${b.rarityKo} · ${b.schoolKo} 유파${test ? '' : st === 'use' ? ' · 사용 중' : st === 'sealed' ? ' · 봉인' : ''}`;
    $('#bookMeta').dataset.tier = b.rarity;
    $('#bookEffect').textContent = b.effect; // '(임시)' 꼬리는 개발 말이라 뺌 (10/19 글 방침 2판 — 자료 provisional 은 그대로)
    $('#bookList').hidden = !b.list;
    $('#bookList').innerHTML = (b.list ?? []).map((n) => `<li>${n}</li>`).join(''); // 고유 공격 넷 — 한글 이름만 이어서(원어는 싸움 화면 기술 칸에)
    $('#bookSource').textContent = `출처 · ${b.source}`;
    const head = headPriceOf(b.tier); // 머리로 사는 값 — 사장님 확인 전 (지금 null — 단추 없음)
    const note = test ? '테스트 경로 — 모든 책이 열려 있습니다'
      : st === 'unowned' && coins < b.price ? `금화가 모자랍니다 — 가진 금화 ${coins}${head != null ? ` · 머리 ${head}` : ''}` : st === 'unowned' && head != null ? `머리 ${head}` : '';
    $('#bookState').textContent = note;
    $('#bookState').hidden = !note;
    $('#buyBook').hidden = test || st !== 'unowned';
    $('#buyBook').textContent = `구입 · 금화 ${b.price}`;
    $('#buyBook').disabled = coins < b.price;
    for (const id of ['#useBook', '#sealBook']) $(id).hidden = test || st === 'unowned';
    $('#useBook').disabled = st === 'use';
    $('#sealBook').disabled = st === 'sealed';
  }

  function select(tier, node = null) {
    selected = selected === tier ? null : tier;
    lastNode = node;
    render();
    if (selected) $('#bookTitle').focus({ preventScroll: true });
  }
  function selectTab(tab) {
    for (const t of tabs) { const sel = t === tab; t.setAttribute('aria-selected', String(sel)); t.tabIndex = sel ? 0 : -1; }
    school = tab.dataset.school; selected = null; render();
  }
  for (const tab of tabs) {
    on(tab, 'click', () => selectTab(tab));
    on(tab, 'keydown', (e) => {
      const k = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
      if (k == null && e.key !== 'Home' && e.key !== 'End') return;
      e.preventDefault();
      const i = tabs.indexOf(tab), next = tabs[e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + k + tabs.length) % tabs.length];
      selectTab(next); next.focus();
    });
  }
  on($('.tree-nodes'), 'click', (e) => { const n = e.target.closest('.book-node'); if (n) select(+n.dataset.book, n); });
  on($('.detail-close'), 'click', () => { const n = lastNode; selected = null; render(); root.querySelector(`.book-node[data-book="${n?.dataset.book}"]`)?.focus(); });
  on($('#buyBook'), 'click', () => {
    const b = booksOf(school)[selected - 1];
    const r = buyBook(school, b.tier);
    announce(r.ok ? `${b.title} 구입 — 금화 ${b.price}${r.saved ? '' : '. 이번 실행 동안 유지됩니다.'}` : r.why === 'coins' ? '금화가 모자랍니다.' : '살 수 없습니다.');
    render(); onWallet();
  });
  for (const [id, use] of [['#useBook', true], ['#sealBook', false]]) on($(id), 'click', () => {
    const b = booksOf(school)[selected - 1];
    const saved = setBookInUse(b.id, use);
    announce(`${b.title} ${use ? '사용' : '봉인'}${saved ? '' : '. 이번 실행 동안 유지됩니다.'}`);
    render();
  });
  render();
  return {
    refresh: render,
    show(s, tier = null) { const tab = tabs.find((t) => t.dataset.school === s); if (tab) selectTab(tab); if (tier) select(tier); },
    destroy() { events.abort(); sizer?.disconnect(); },
  };
}
