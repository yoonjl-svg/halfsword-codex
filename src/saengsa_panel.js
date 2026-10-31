// 대기실 ③ '생사전' 칸 (사장님 10/29 14:1x 요지 — 탭 '이벤트'를 '생사전'으로 · 3단 영역에 부제 '3인의 맹약' · 짧은 설명 · 기본 설정 · 맨 아래 '생사전 입장' 단추):
//  스킬 칸처럼 ③ 창 안을 채우는 판 하나(lobby.css .saengsa-host — 창 안 폭 · 높이 그대로) — 설명 두 문장 · 내 팀 세 칸(나 · 동료 둘) · 안내 한 줄 · 고용 금화 · '생사전 입장'.
//  팀 칸을 누르면 판 안을 덮는 고르기 카드(스킬 상세 카드 자리 — 동료 고르기 · 그 사람에게 배정할 내 무기 · 확인 — 사장님 10/29 18:2x 무기는 내가 배정).
//  신청 창(밤 10시 ~ 새벽 2시) 안에서 '생사전 입장' = 이 팀으로 신청(고용 금화를 냄) + 생사전 화면 · 창 밖이거나 신청한 뒤에는 화면만 연다.
//  입장 조건(18:2x — 정복자 호칭 · 가진 무기 5 개)을 못 채우면 안내 줄에 모자란 것 · '생사전 입장'은 꺼짐 · '대진표' 단추로 화면을 보기만.
//  신청한 대회가 있으면 팀 칸은 그 대회의 팀(배정한 무기)을 보이기만 한다(경기마다 무기는 생사전 화면에서).
import { SAENGSA } from './config.js';
import { clockFrom, signupWindow } from './saengsa_clock.js';
import { scheduleState, canSignUp, myMatch, myTeamOut, sidesOf, winnerOf, readyAt, matchState, chestCount, seatOrder } from './saengsa_rules.js';
import { syncSaengsa, readSaengsa, saveDraft, signUp, newSeed } from './saengsa_store.js';
import { SAENGSA_DATA, HIRE_ROSTER, ownedWeapons, entryState, hireCostOf, nameOf, spokenName, fighterName, portraitOf, weaponName } from './saengsa_roster.js';
import { NAMELESS, validAssignment } from './saengsa_rules.js';
import { makeNamelessFaces } from './saengsa_nameless.js';
import { SAENGSA_TEXT as T, stateLine, signupHours, nextMatchLine, outLine, chestLine, hireLine, roundName, teamName, entryLine } from './saengsa_text.js';
import { COIN_ICON } from './wallet_icons.js';
import { readProgress } from './lobby_progress.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * host: ③ 창 안 판(#saengsaHost) · chip: 제목 줄 오른쪽 일정 알약 · status(text, tone): 대기실 알림 줄 · onEnter(): 생사전 화면으로 · onWallet(): 금화가 바뀜
 */
export function mountSaengsaPanel(host, { chip, status = () => {}, onEnter = () => {}, onWallet = () => {}, now = clockFrom() } = {}) {
  host.innerHTML = `<div class="sg-body"><p class="sg-desc">${esc(T.desc)}</p>
    <div class="sg-team" role="group" aria-label="${T.myTeam}">${[0, 1, 2].map((i) => `<button type="button" class="sg-slot" data-slot="${i}"></button>`).join('')}</div>
    <p class="sg-note" id="sgNote"></p></div>
    <div class="sg-foot"><span class="sg-cost wallet" id="sgCost" hidden>${COIN_ICON}<b></b></span><button type="button" class="secondary small sg-look" id="sgLook" hidden>${T.bracket}</button><button type="button" class="primary sg-enter" id="saengsaEnter">${T.enter}</button></div>
    <section class="sg-picker" id="sgPicker" hidden aria-labelledby="sgPickTitle"><button type="button" class="detail-close" id="sgPickClose" aria-label="닫기">×</button>
      <b class="sg-pick-title" id="sgPickTitle" tabindex="-1"></b>
      <div class="sg-roster" id="sgRoster" role="listbox" aria-label="${T.pick}"></div>
      <div class="sg-arm"><span class="sg-arm-label">${T.weapon}</span><div class="sg-chips" id="sgChips" role="radiogroup" aria-label="${T.weapon}"></div>
        <div class="sg-pick-actions"><button type="button" class="primary" id="sgPickOk">${T.confirm}</button></div></div>
    </section>`;
  const $ = (sel) => host.querySelector(sel), events = new AbortController();
  const on = (el, type, fn) => el.addEventListener(type, fn, { signal: events.signal });
  const slots = [...host.querySelectorAll('.sg-slot')];
  let picker = null; // { slot, id, weapon } — 고르기 카드가 열린 동안
  let view = null; // 지금 그린 것 { editable, draft, t, cost }

  const draftOf = () => readSaengsa().draft;
  const armText = (w) => (w ? weaponName(w) : T.noWeapon); // 배정한 무기 · 아직 없으면 '무기 없음'
  function slotHtml({ id, weapon, price, empty, cloth = 0, name = nameOf(id) }) {
    if (empty) return `<span class="sg-slot-empty">${T.pick}</span>${price ?? ''}`;
    // 칸 = 얼굴 · 이름 · (무기 · 고용 금화) — '나' · '동료' 는 칸 자리로 읽히고 화면 읽기 글(aria-label)에 있다
    return `<img class="sg-slot-face" src="${esc(portraitOf(id, cloth))}" alt="" draggable="false"><span class="sg-slot-body"><b class="sg-slot-name">${esc(name)}</b><span class="sg-slot-meta"><small class="sg-slot-weapon"${weapon ? '' : ' data-none'}>${esc(armText(weapon))}</small>${price ?? ''}</span></span>`;
  }
  const priceHtml = (id) => { const c = hireCostOf(id); return c.coins != null ? `<span class="sg-price">${COIN_ICON}${c.coins}</span>` : ''; };

  function render() {
    const t0 = now(), st = syncSaengsa(t0), t = st.current, sched = scheduleState(t0, t), w = signupWindow(t0);
    chip.textContent = stateLine(sched);
    chip.dataset.kind = sched.kind;
    const editable = !t || canSignUp(t0, t); // 신청할 수 있거나(창 안) 신청한 대회가 없을 때(창 밖 — 미리 골라 둠)
    const draft = st.draft, arms = draft.weapons, entry = entryState(), blocked = editable && entry.missing.length > 0;
    view = { editable, draft, t, blocked };
    $('#saengsaEnter').disabled = blocked; // 입장 조건을 못 채움 — 신청은 못 하고 대진표 보기만(사장님 10/29 18:2x)
    $('#sgLook').hidden = !blocked;
    if (editable) {
      // 신청 전: 고른 것(draft)
      const ids = ['player', ...draft.companions];
      slots.forEach((b, i) => {
        const id = ids[i];
        b.disabled = false;
        b.dataset.state = id ? 'set' : 'empty';
        b.innerHTML = slotHtml({ id, empty: !id, weapon: arms[i], price: id && i ? priceHtml(id) : '', cloth: i - 1 }); // 내 무명 검객 옷 색 = 자리 1 → 줄 0 · 자리 2 → 줄 1 (saengsa_rules.js createTournament 와 같게)
        const price = id && i ? hireCostOf(id).coins : null;
        b.setAttribute('aria-label', id ? `${i ? T.companion : T.me} · ${spokenName(id, i - 1)} · ${armText(arms[i])}${price != null ? ` · ${hireLine(price)}` : ''}` : T.pick);
      });
      const cost = draft.companions.filter(Boolean).reduce((s, id) => s + (hireCostOf(id).coins ?? 0), 0);
      view.cost = cost;
      $('#sgCost').hidden = !cost;
      $('#sgCost b').textContent = cost.toLocaleString('ko-KR');
      $('#sgCost').setAttribute('aria-label', hireLine(cost));
      const full = draft.companions.every(Boolean), armed = validAssignment(arms, entry.owned);
      const poor = readProgress().coins < cost;
      $('#sgNote').textContent = blocked ? entryLine(entry.missing) : !w.open ? signupHours(w.from, w.to) : !full ? T.pickTwo : !armed ? T.pickWeapons : poor ? T.noCoins : T.willSign;
      $('#sgNote').dataset.tone = blocked || (w.open && full && armed && poor) ? 'alert' : '';
    } else {
      // 신청한 대회 (또는 끝난 대회): 그 팀 그대로 · 누를 수 없음
      const members = t.teams[0].members;
      slots.forEach((b, i) => {
        const f = members[i];
        b.disabled = true;
        b.dataset.state = f?.dead ? 'dead' : 'set';
        b.innerHTML = f ? slotHtml({ id: f.id, weapon: f.weapon, cloth: f.cloth, name: fighterName(f) }) : '';
        b.setAttribute('aria-label', f ? `${i ? T.companion : T.me} · ${fighterName(f)} · ${weaponName(f.weapon)}${f.dead ? ` · ${T.dead}` : ''}` : '');
      });
      $('#sgCost').hidden = true;
      $('#sgNote').textContent = noteFor(t, t0);
      $('#sgNote').dataset.tone = '';
    }
  }
  function noteFor(t, t0) {
    const n = t.teams.length;
    if (t.status === 'done') {
      const chests = chestCount(t);
      if (chests && !t.chests) return chestLine(chests);
      return t.champion === 0 ? `${T.champion} · ${T.myTeam}` : `${T.champion} · ${teamName(seatNo(t, t.champion), false)}`;
    }
    if (myTeamOut(t)) {
      const lost = t.matches.find((m) => m.result && sidesOf(t, m).includes(0) && winnerOf(t, m) !== 0);
      return outLine(roundName(n, lost.round), lost.result.by === 'forfeit');
    }
    const m = myMatch(t);
    if (!m) return '';
    return nextMatchLine(roundName(n, m.round), readyAt(t, m) ?? 0, matchState(t, m, t0), t0);
  }
  const seatNo = (t, team) => seatOrder(t).indexOf(team) + 1;

  // ── 고르기 카드 ──
  function openPicker(slot) {
    const d = draftOf();
    picker = { slot, id: slot ? d.companions[slot - 1] : 'player', weapon: d.weapons[slot] ?? null };
    $('#sgRoster').hidden = !slot;
    drawPicker();
    $('#sgPicker').hidden = false;
    $('#sgPickTitle').focus({ preventScroll: true });
  }
  function drawPicker() {
    const d = draftOf(), other = picker.slot ? d.companions[2 - picker.slot] : null;
    if (picker.slot) {
      $('#sgRoster').innerHTML = HIRE_ROSTER.map((id) => {
        const taken = id === other && id !== NAMELESS, on = id === picker.id; // 무명 검객은 두 자리 모두 고를 수 있다
        return `<button type="button" class="sg-pick" role="option" data-id="${id}" aria-selected="${on}" ${taken ? 'disabled' : ''}><img src="${esc(portraitOf(id, picker.slot - 1))}" alt="" draggable="false"><span class="sg-pick-name">${esc(nameOf(id))}</span>${priceHtml(id)}</button>`;
      }).join('');
    }
    // 가진 무기 — 다른 자리에 배정한 무기는 누를 수 없음(SAENGSA.assignUnique — 한 자루씩)
    const takenW = new Set(SAENGSA.assignUnique ? d.weapons.filter((w, i) => w && i !== picker.slot) : []);
    $('#sgChips').innerHTML = ownedWeapons().map((w) => `<button type="button" class="sg-chip-btn" role="radio" data-weapon="${w}" aria-checked="${picker.weapon === w}"${takenW.has(w) ? ' disabled' : ''}>${esc(weaponName(w))}</button>`).join('');
    $('#sgPickOk').disabled = !!picker.slot && !picker.id;
    $('#sgPickTitle').textContent = `${picker.slot ? `${T.companion} ${picker.slot}` : T.me}${picker.id && picker.slot ? ` · ${nameOf(picker.id)}` : ''}`; // 고른 사람 이름 (칸 이름표는 좁아 줄어들 수 있다)
  }
  function closePicker(save) {
    if (save && picker) {
      const d = draftOf();
      if (picker.slot) d.companions[picker.slot - 1] = picker.id;
      d.weapons[picker.slot] = picker.weapon;
      if (!saveDraft(d)) status(T.saveFail);
    }
    const slot = picker?.slot;
    picker = null;
    $('#sgPicker').hidden = true;
    render();
    if (slot != null) slots[slot].focus({ preventScroll: true });
  }
  for (const b of slots) on(b, 'click', () => { if (!b.disabled) openPicker(+b.dataset.slot); });
  on($('#sgRoster'), 'click', (e) => { const b = e.target.closest('.sg-pick'); if (!b || b.disabled) return; picker.id = b.dataset.id; drawPicker(); });
  on($('#sgChips'), 'click', (e) => { const b = e.target.closest('.sg-chip-btn'); if (!b || b.disabled) return; picker.weapon = b.dataset.weapon || null; drawPicker(); });
  on($('#sgPickOk'), 'click', () => closePicker(true));
  on($('#sgPickClose'), 'click', () => closePicker(false));
  on(host, 'keydown', (e) => { if (e.key === 'Escape' && picker) { e.preventDefault(); e.stopPropagation(); closePicker(false); } });

  // ── 생사전 입장: 신청 창 안 · 신청 전이면 신청 → 화면 / 그 밖은 화면만 ──
  on($('#saengsaEnter'), 'click', () => {
    const t0 = now(), st = readSaengsa();
    if (canSignUp(t0, st.current) && view?.editable) {
      const d = st.draft, entry = entryState();
      if (entry.missing.length) { status(entryLine(entry.missing)); render(); return; }
      if (!d.companions.every(Boolean)) { status(T.pickTwo); return; }
      if (!validAssignment(d.weapons, entry.owned)) { status(T.pickWeapons); return; }
      const res = signUp({ now: t0, companions: d.companions, weapons: d.weapons, seed: newSeed(), data: { ...SAENGSA_DATA, owned: entry.owned, hasTitle: entry.hasTitle, hireCostOf } });
      if (!res.ok) { status({ coins: T.noCoins, busy: T.busy, team: T.pickTwo, weapons: T.pickWeapons, entry: entryLine(entryState().missing), closed: signupHours(signupWindow(t0).from, signupWindow(t0).to) }[res.why] ?? T.saveFail); render(); return; }
      onWallet();
      status(T.signed, 'notice');
    }
    onEnter();
  });

  on($('#sgLook'), 'click', () => onEnter()); // 입장 조건을 못 채웠을 때 — 신청 없이 대진표만 본다

  render();
  makeNamelessFaces().then((ok) => { if (ok) { if (picker) drawPicker(); else render(); } }); // 무명 검객 얼굴(옷 색마다)을 칠한 뒤 다시 그림
  const timer = setInterval(() => { if (host.offsetParent && !picker) render(); }, 30e3);
  return {
    refresh: () => { if (!picker) render(); },
    destroy() { clearInterval(timer); events.abort(); },
  };
}
