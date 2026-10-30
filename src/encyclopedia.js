import style from './encyclopedia.css?inline';
import { CATALOG_ITEMS, CATALOG_CHARACTERS, schoolName, catalogMeasurements } from './encyclopedia_data.js';
import { TIER_LABEL, getWeapon } from './weapons.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const label = e => e.tier ? TIER_LABEL[e.tier] : ({ player: '플레이어', base: '기본', alter: '얼터' }[e.kind]);

export function mountEncyclopedia(host) {
  const events = new AbortController();
  const listen = (node, type, fn) => node.addEventListener(type, fn, { signal: events.signal });
  let section = 'items', selected = null, savedScroll = 0, returnId = null, detailEntries = [];
  host.innerHTML = `<style>${style}</style><div class="encyclopedia">
    <div class="ec-masthead"><header class="ec-heading"><h2>도감</h2></header>
    <div class="ec-tabs" role="tablist" aria-label="도감 분류">
      <button role="tab" id="ecItemsTab" aria-controls="ecCatalogPanel" aria-selected="true" data-section="items">아이템</button>
      <button role="tab" id="ecCharactersTab" aria-controls="ecCatalogPanel" aria-selected="false" tabindex="-1" data-section="characters">캐릭터</button>
    </div></div>
    <div class="ec-panel" role="tabpanel" id="ecCatalogPanel" aria-labelledby="ecItemsTab">
      <div class="ec-browse">
        <div class="ec-scroll"><div class="ec-grid" role="list" aria-label="도감 목록"></div></div>
      </div>
    </div></div><dialog class="ec-dialog" aria-labelledby="ecDetailName"><div class="ec-dialog-shell">
      <header class="ec-dialog-head"><h3 id="ecDetailName"></h3><button class="secondary small ec-close" type="button" autofocus aria-label="상세 설명 닫기">닫기 ×</button></header>
      <article class="ec-detail"></article>
      <footer class="ec-dialog-foot"><button class="secondary small ec-prev" type="button">← 이전</button><span class="ec-position"></span><button class="secondary small ec-next" type="button">다음 →</button></footer>
    </div></dialog>`;
  const $ = s => host.querySelector(s), $$ = s => [...host.querySelectorAll(s)];
  const dialog = $('.ec-dialog'), detail = $('.ec-detail'), grid = $('.ec-grid'), scroll = $('.ec-scroll');
  const lobby = host.closest('.lobby');
  let previousOverflow = null;
  function unlockScroll() { if (lobby && previousOverflow !== null) lobby.style.overflow = previousOverflow; previousOverflow = null; }
  const entries = () => section === 'items' ? CATALOG_ITEMS : CATALOG_CHARACTERS;
  function renderList() {
    const found = entries(), character = section === 'characters';
    grid.classList.toggle('ec-models', character);
    grid.innerHTML = found.map((e, index) => {
      const image = character ? e.model : e.image;
      const facts = character ? [
        e.age == null ? '' : typeof e.age === 'number' ? `${e.age}세` : e.age,
        e.weapon ? getWeapon(e.weapon).nameKo : '선택 무기',
      ].filter(Boolean).join(' · ') : '';
      return `<div role="listitem"><button class="ec-card" data-entry="${esc(e.id)}" ${e.tier ? `data-tier="${e.tier}"` : ''} aria-label="${esc(e.name)} · ${esc(label(e))} 상세 보기">
        <span class="ec-art ${character ? 'ec-model' : ''}">${character ? `<span class="ec-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>` : ''}${image ? `<img src="${esc(image)}" alt="" loading="lazy" decoding="async" draggable="false">` : '<span>이미지 준비 중</span>'}</span>
        <span class="ec-card-text"><span class="ec-name">${esc(e.name)}</span><span class="ec-meta">${esc(character ? e.epithet || label(e) : label(e))}</span>${character ? `<span class="ec-card-facts">${esc(facts)}</span>` : ''}</span></button></div>`;
    }).join('');
  }
  function openSection(next, focus = false) {
    if (dialog.open) dialog.close();
    section = next; selected = null;
    const isItem = section === 'items';
    for (const b of $$('.ec-tabs button')) { const on = b.dataset.section === section; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); }
    const panel = $('.ec-panel'); panel.setAttribute('aria-labelledby', isItem ? 'ecItemsTab' : 'ecCharactersTab');
    renderList(); scroll.scrollTop = 0;
  }
  function restoreList() {
    if (dialog.open) return;
    unlockScroll();
    const id = returnId; selected = null;
    scroll.scrollTop = savedScroll;
    [...grid.querySelectorAll('button')].find(b => b.dataset.entry === id)?.focus({ preventScroll: true });
  }
  function back() { if (dialog.open) dialog.close(); }
  function navigate(delta) {
    const index = detailEntries.findIndex(e => e.id === selected?.id);
    if (index < 0 || detailEntries.length < 2) return;
    showEntry(detailEntries[(index + delta + detailEntries.length) % detailEntries.length]);
  }
  function showEntry(entry) {
    if (!selected) { savedScroll = scroll.scrollTop; returnId = entry.id; detailEntries = entries(); }
    selected = entry;
    const e = entry, character = section === 'characters';
    const rows = character ? [
      ['대표 유파', schoolName(e.school)], ['숙련도', e.proficiency == null ? '플레이에 따라' : String(e.proficiency)],
      ...(e.weapon ? [['기본 무기', getWeapon(e.weapon).nameKo]] : []),
      ...(e.age != null ? [['나이', typeof e.age === 'number' ? `${e.age}세` : e.age]] : []),
      ...(e.origin ? [['출신', e.origin]] : []),
    ] : e.kind === 'weapon' ? [['유파', schoolName(e.school)], ['규격', catalogMeasurements(e)]] : [['장착 부위', e.slot === 'head' ? '머리' : '목']];
    const relation = character && (e.variantOf ? CATALOG_CHARACTERS.find(c => c.id === e.variantOf) : CATALOG_CHARACTERS.find(c => c.variantOf === e.id));
    $('#ecDetailName').textContent = e.name;
    const fullImage = character ? e.image : e.illustration;
    detail.innerHTML = `<div class="ec-hero ${character ? 'ec-portrait' : 'ec-illustration'}"><img src="${esc(fullImage)}" alt="${esc(e.name)} ${character ? '프로필' : '전체 일러스트'}" draggable="false"></div>
      <div class="ec-detail-copy"><p class="ec-meta" ${e.tier ? `data-tier="${e.tier}"` : ''}>${esc(label(e))}${e.epithet ? ` · ${esc(e.epithet)}` : ''}</p>
      ${e.retired ? '<p class="ec-note">현재 카드 뽑기 제외</p>' : ''}${e.reviewOnly ? '<p class="ec-note">등장 준비 중</p>' : ''}
      <dl class="ec-facts">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      ${e.description ? `<p class="ec-description">${esc(e.description)}</p>` : ''}
      ${e.ability && !e.description.includes(e.ability) ? `<p class="ec-ability">${esc(e.ability)}</p>` : ''}
      ${relation ? `<button class="secondary small ec-related" data-related="${esc(relation.id)}">${e.variantOf ? '기본 모습' : '얼터 모습'} 보기 →</button>` : ''}</div>`;
    const index = detailEntries.findIndex(item => item.id === e.id);
    $('.ec-position').textContent = index >= 0 ? `${index + 1} / ${detailEntries.length}` : '';
    for (const button of [$('.ec-prev'), $('.ec-next')]) button.disabled = index < 0 || detailEntries.length < 2;
    detail.scrollTop = 0;
    if (!dialog.open) {
      if (lobby) { previousOverflow = lobby.style.overflow; lobby.style.overflow = 'hidden'; }
      dialog.showModal();
    }
    $('.ec-close').focus({ preventScroll: true });
  }
  for (const b of $$('.ec-tabs button')) {
    listen(b, 'click', () => openSection(b.dataset.section));
    listen(b, 'keydown', ev => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(ev.key)) { ev.preventDefault(); openSection(ev.key === 'Home' ? 'items' : ev.key === 'End' ? 'characters' : section === 'items' ? 'characters' : 'items', true); } });
  }
  listen(grid, 'click', ev => { const b = ev.target.closest('[data-entry]'); if (b) showEntry(entries().find(e => e.id === b.dataset.entry)); });
  listen(detail, 'click', ev => { const b = ev.target.closest('[data-related]'); if (b) showEntry(CATALOG_CHARACTERS.find(e => e.id === b.dataset.related)); });
  listen($('.ec-close'), 'click', back);
  listen($('.ec-prev'), 'click', () => navigate(-1));
  listen($('.ec-next'), 'click', () => navigate(1));
  listen(dialog, 'close', restoreList);
  listen(dialog, 'cancel', ev => { ev.preventDefault(); back(); });
  listen(dialog, 'click', ev => { if (ev.target !== dialog) return; const r = dialog.getBoundingClientRect(); if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) back(); });
  listen(dialog, 'keydown', ev => {
    if (ev.key === 'Tab') {
      const buttons = [...dialog.querySelectorAll('button:not(:disabled), a[href]')];
      const first = buttons[0], last = buttons.at(-1), active = dialog.getRootNode().activeElement;
      if (ev.shiftKey && active === first) { ev.preventDefault(); last?.focus(); }
      else if (!ev.shiftKey && active === last) { ev.preventDefault(); first?.focus(); }
    } else if (['ArrowLeft', 'ArrowRight'].includes(ev.key)) { ev.preventDefault(); navigate(ev.key === 'ArrowLeft' ? -1 : 1); }
  });
  // Keep a readable placeholder if a future asset is not delivered with its definition.
  host.addEventListener('error', ev => { if (ev.target.tagName === 'IMG') { const box = ev.target.parentElement; box.textContent = '이미지 준비 중'; box.classList.add('ec-missing'); } }, { capture: true, signal: events.signal });
  openSection('items');
  return { destroy() { events.abort(); if (dialog.open) dialog.close(); unlockScroll(); host.replaceChildren(); } };
}
