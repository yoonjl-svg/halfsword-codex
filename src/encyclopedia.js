import style from './encyclopedia.css?inline';
import { CATALOG_ITEMS, CATALOG_CHARACTERS, CATALOG_SCHOOLS, filterCatalog, schoolName, catalogMeasurements } from './encyclopedia_data.js';
import { TIER_LABEL, TIERS, getWeapon } from './weapons.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const options = list => list.map(([id, name]) => `<option value="${esc(id)}">${esc(name)}</option>`).join('');
const label = e => e.tier ? TIER_LABEL[e.tier] : ({ player: '플레이어', base: '기본', alter: '얼터' }[e.kind]);

export function mountEncyclopedia(host) {
  const events = new AbortController();
  const listen = (node, type, fn) => node.addEventListener(type, fn, { signal: events.signal });
  const state = { items: { query: '', kind: '', school: '', tier: '' }, characters: { query: '', kind: '', school: '', tier: '' } };
  let section = 'items', selected = null, savedScroll = 0, returnId = null;
  host.innerHTML = `<style>${style}</style><div class="encyclopedia">
    <div class="ec-masthead"><header class="ec-heading"><h2>도감</h2><span class="ec-total">아이템 ${CATALOG_ITEMS.length} · 캐릭터 ${CATALOG_CHARACTERS.length}</span></header>
    <div class="ec-tabs" role="tablist" aria-label="도감 분류">
      <button role="tab" id="ecItemsTab" aria-controls="ecCatalogPanel" aria-selected="true" data-section="items">아이템</button>
      <button role="tab" id="ecCharactersTab" aria-controls="ecCatalogPanel" aria-selected="false" tabindex="-1" data-section="characters">캐릭터</button>
    </div></div>
    <div class="ec-panel" role="tabpanel" id="ecCatalogPanel" aria-labelledby="ecItemsTab">
      <div class="ec-browse">
        <div class="ec-search"><input type="search" aria-label="도감 이름 검색" placeholder="이름 검색" autocomplete="off"><button class="ec-reset" type="button">초기화</button></div>
        <div class="ec-filters"><select aria-label="종류"></select><select aria-label="유파"><option value="">모든 유파</option>${options(CATALOG_SCHOOLS.map(s => [s.id, s.name]))}</select><select aria-label="등급"><option value="">모든 등급</option>${options(TIERS.map(t => [t, TIER_LABEL[t]]))}</select></div>
        <p class="ec-count" role="status" aria-live="polite" aria-atomic="true"></p>
        <div class="ec-scroll"><div class="ec-grid" role="list" aria-label="도감 목록"></div><p class="ec-empty" hidden>조건에 맞는 항목이 없습니다.</p></div>
      </div><article class="ec-detail" hidden></article>
    </div></div>`;
  const $ = s => host.querySelector(s), $$ = s => [...host.querySelectorAll(s)];
  const browse = $('.ec-browse'), detail = $('.ec-detail'), grid = $('.ec-grid'), scroll = $('.ec-scroll');
  const search = $('input'), kind = $('select[aria-label="종류"]'), school = $('select[aria-label="유파"]'), tier = $('select[aria-label="등급"]');
  const entries = () => section === 'items' ? CATALOG_ITEMS : CATALOG_CHARACTERS;
  function renderList() {
    const found = filterCatalog(entries(), state[section]);
    $('.ec-count').textContent = `${found.length} / ${entries().length}`;
    $('.ec-empty').hidden = found.length > 0;
    grid.classList.toggle('ec-roster', section === 'characters');
    grid.innerHTML = found.map(e => `<div role="listitem"><button class="ec-card" data-entry="${esc(e.id)}" ${e.tier ? `data-tier="${e.tier}"` : ''} aria-label="${esc(e.name)} · ${esc(label(e))} 상세 보기">
      <span class="ec-art ${section === 'characters' ? 'ec-portrait' : ''}">${e.image ? `<img src="${esc(e.image)}" alt="" loading="lazy" decoding="async" draggable="false">` : '<span>초상 준비 중</span>'}</span>
      <span class="ec-card-text"><span class="ec-name">${esc(e.name)}</span><span class="ec-meta">${esc(e.tier ? `${label(e)}${e.retired ? ' · 뽑기 제외' : ''}` : `${label(e)} · ${e.epithet ?? ''}`.replace(/ · $/, ''))}</span></span>${section === 'characters' ? `<span class="ec-roster-stat">${esc(schoolName(e.school))}<span class="ec-meta">${e.proficiency == null ? '숙련도 —' : `숙련도 ${e.proficiency}`}</span></span>` : ''}</button></div>`).join('');
  }
  function openSection(next, focus = false) {
    section = next; selected = null; browse.hidden = false; detail.hidden = true;
    const isItem = section === 'items', s = state[section];
    for (const b of $$('.ec-tabs button')) { const on = b.dataset.section === section; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); }
    const panel = $('.ec-panel'); panel.setAttribute('aria-labelledby', isItem ? 'ecItemsTab' : 'ecCharactersTab');
    kind.innerHTML = '<option value="">모든 종류</option>' + options(isItem ? [['weapon', '무기'], ['armor', '방어구·장신구']] : [['base', '기본 캐릭터'], ['alter', '얼터 캐릭터'], ['player', '플레이어']]);
    tier.hidden = !isItem; $('.ec-filters').classList.toggle('ec-two', !isItem);
    search.value = s.query; kind.value = s.kind; school.value = s.school; tier.value = s.tier;
    renderList(); scroll.scrollTop = 0;
  }
  function back() {
    const id = returnId; selected = null; detail.hidden = true; browse.hidden = false;
    scroll.scrollTop = savedScroll;
    [...grid.querySelectorAll('button')].find(b => b.dataset.entry === id)?.focus({ preventScroll: true });
  }
  function showEntry(entry) {
    if (!selected) { savedScroll = scroll.scrollTop; returnId = entry.id; }
    selected = entry;
    const e = entry, character = section === 'characters';
    const rows = character ? [
      ['대표 유파', schoolName(e.school)], ['숙련도', e.proficiency == null ? '플레이에 따라' : String(e.proficiency)],
      ...(e.weapon ? [['기본 무기', getWeapon(e.weapon).nameKo]] : []),
      ...(e.age != null ? [['나이', typeof e.age === 'number' ? `${e.age}세` : e.age]] : []),
      ...(e.origin ? [['출신', e.origin]] : []),
    ] : e.kind === 'weapon' ? [['유파', schoolName(e.school)], ['규격', catalogMeasurements(e)]] : [['장착 부위', e.slot === 'head' ? '머리' : '목']];
    const relation = character && (e.variantOf ? CATALOG_CHARACTERS.find(c => c.id === e.variantOf) : CATALOG_CHARACTERS.find(c => c.variantOf === e.id));
    detail.innerHTML = `<button class="secondary small ec-back" type="button">← 목록</button>
      <div class="ec-detail-top"><div class="ec-hero ${character ? 'ec-portrait' : ''}">${e.image ? `<img src="${esc(e.image)}" alt="${esc(e.name)}" draggable="false">` : '초상 준비 중'}</div>
      <div><p class="ec-meta" ${e.tier ? `data-tier="${e.tier}"` : ''}>${esc(label(e))}${e.epithet ? ` · ${esc(e.epithet)}` : ''}</p><h3 tabindex="-1">${esc(e.name)}</h3>
      ${e.retired ? '<p class="ec-note">현재 카드 뽑기 제외</p>' : ''}${e.reviewOnly ? '<p class="ec-note">등장 준비 중</p>' : ''}</div></div>
      <dl class="ec-facts">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      ${e.description ? `<p class="ec-description">${esc(e.description)}</p>` : ''}
      ${e.ability && !e.description.includes(e.ability) ? `<p class="ec-ability">${esc(e.ability)}</p>` : ''}
      ${relation ? `<button class="secondary small ec-related" data-related="${esc(relation.id)}">${e.variantOf ? '기본 모습' : '얼터 모습'} 보기 →</button>` : ''}`;
    browse.hidden = true; detail.hidden = false; detail.scrollTop = 0; $('h3').focus({ preventScroll: true });
  }
  for (const b of $$('.ec-tabs button')) {
    listen(b, 'click', () => openSection(b.dataset.section));
    listen(b, 'keydown', ev => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(ev.key)) { ev.preventDefault(); openSection(ev.key === 'Home' ? 'items' : ev.key === 'End' ? 'characters' : section === 'items' ? 'characters' : 'items', true); } });
  }
  function filter() { Object.assign(state[section], { query: search.value, kind: kind.value, school: school.value, tier: tier.value }); renderList(); scroll.scrollTop = 0; }
  listen(search, 'input', filter); for (const node of [kind, school, tier]) listen(node, 'change', filter);
  listen($('.ec-reset'), 'click', () => { state[section] = { query: '', kind: '', school: '', tier: '' }; openSection(section); search.focus(); });
  listen(grid, 'click', ev => { const b = ev.target.closest('[data-entry]'); if (b) showEntry(entries().find(e => e.id === b.dataset.entry)); });
  listen(detail, 'click', ev => { if (ev.target.closest('.ec-back')) back(); const b = ev.target.closest('[data-related]'); if (b) showEntry(CATALOG_CHARACTERS.find(e => e.id === b.dataset.related)); });
  listen(host, 'keydown', ev => { if (ev.key === 'Escape' && selected) { ev.preventDefault(); ev.stopPropagation(); back(); } });
  // Keep a readable placeholder if a future asset is not delivered with its definition.
  host.addEventListener('error', ev => { if (ev.target.tagName === 'IMG') { const box = ev.target.parentElement; box.textContent = '이미지 준비 중'; box.classList.add('ec-missing'); } }, { capture: true, signal: events.signal });
  openSection('items');
  return { destroy() { events.abort(); host.replaceChildren(); } };
}
