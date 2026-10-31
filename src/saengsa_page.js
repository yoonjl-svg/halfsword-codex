// 생사전 화면 (사장님 10/29 14:1x 요지 — '생사전 입장'을 누르면 생사전 화면 · 토너먼트 대진표 · 대진표 경기를 누르면 전투 진입 화면에서 출전할 수 있는 캐릭터 카드와 상태):
//  game_entry.js showSaengsa 가 대기실과 같은 덮개(Shadow DOM) 안에 연다 · '대기실' 단추로 돌아감. 꾸밈 = 대기실과 같은 숲 배경 · 액자 1 틀 · 싸움 화면 단추 꼴(entrance_ui.css).
//  ① 대진표: 대진마다 한 줄(16강 · 8강 · 4강 · 결승 · 우승) — 경기 칸 = 시각 · 남은 시간이나 한 줄 결과 · 두 팀(얼굴 셋 + 이름). 내 길은 금색 줄 · 지금 할 수 있는 내 경기는 금색 칸 '입장 가능'.
//     칸이 많아(16 팀) 틀 안에서 위아래로 내려 본다 — 열면 내 경기 자리로. 30 초마다 다시 셈(상대끼리 경기는 시각이 지나면 저절로 끝남 — saengsa_store.js syncSaengsa).
//  ② 경기 화면(경기 칸을 누름 — 화면 전체를 덮는 층): 상대 팀 카드 셋 · 내 팀 카드 셋(얼굴 · 이름 · 체력 막대 · 부상 · 무기 · 다섯 유파 숙련도 · 죽은 사람은 흐림).
//     내 경기면 내 카드를 한두 장 골라 '전투 입장' — 상대는 가린 채 함께 고르고 입장 때 함께 보인다(사장님 10/29 14:5x). 결과는 카드 위에 그대로(경기 뒤 체력 · 부상 · 죽음 · 출전 표시).
//     '무기 배정'(사장님 10/29 18:2x 경기마다 내가 배정): 살아 있는 내 팀 세 사람마다 가진 무기 한 자루 — 카드에 바로 보이고 '전투 입장' 때 저장.
//     내 경기는 실제 2:2 싸움(saengsa_engine.js — game.launchSaengsa · 나섬 = 내 몸 · 동료만 = 지켜봄) · 엔진이 없으면 빠른 셈 · 상대끼리 경기는 빠른 셈.
import uiStyle from './entrance_ui.css?inline';
import lobbyStyle from './lobby.css?inline';
import sgStyle from './saengsa.css?inline';
import typeStyle from './entrance_type.css?inline';
import { createPixelGrove, paintPixelWordmark } from './pixel_grove.js';
import { SAENGSA } from './config.js';
import { clockFrom, signupWindow, roundAt } from './saengsa_clock.js';
import { scheduleState, sidesOf, winnerOf, readyAt, matchState, myMatch, myTeamOut, roundsOf, matchById, matchSetup, chestCount, seatOrder, isSerious, isMine, assignWeapons, validAssignment, lockedSignatures, resumeOf } from './saengsa_rules.js';
import { syncSaengsa, readSaengsa, playMine, claimChests, signUp, newSeed, saveResume } from './saengsa_store.js';
import { fighterName, portraitOf, weaponName, weaponThumb, weaponInfo, SAENGSA_DATA, ownedWeapons, entryState, hireCostOf } from './saengsa_roster.js';
import { makeNamelessFaces } from './saengsa_nameless.js';
import { SAENGSA_TEXT as T, SCHOOL_KO, stateLine, clockText as clockWords, untilText, roundName, teamName, resultLine, myResultLine, nextMatchLine, outLine, chestLine, chestGot, injuryText, signupHours, entryLine } from './saengsa_text.js';
import { makeEngine } from './saengsa_engine.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const SCHOOL_CELLS = ['german', 'italian', 'iberian', 'japanese', 'chinese'];
const clockText = (at) => (SAENGSA.testMode ? '' : clockWords(at)); // 시험판은 시각을 보이지 않는다(모든 경기 바로 — 사장님 10/29 17:5x)

/** root: 덮개 Shadow root · game: 게임 모듈(2단계 launchSaengsa) · onBack(): 대기실로 */
export function mountSaengsa({ root, game, onBack, now = clockFrom() }) {
  root.innerHTML = `<style>${uiStyle}\n${lobbyStyle}\n${sgStyle}\n${typeStyle}</style><main class="saengsa" aria-labelledby="sgHeading">
    <canvas class="lobby-backdrop" id="sgGrove" aria-hidden="true"></canvas><div class="lobby-shade" aria-hidden="true"></div>
    <header class="lobby-header sg-header"><div class="sg-titles"><h1 id="sgHeading" tabindex="-1"><span>${T.title}</span></h1><span class="sg-sub">${T.subtitle}</span></div>
      <p id="sgStatus" class="lobby-status" role="status"></p><button id="sgBack" class="secondary small on-art utility">${T.back}</button></header>
    <section class="sg-board" aria-labelledby="sgBoardTitle">
      <div class="sg-board-head"><h2 class="sr-only" id="sgBoardTitle">${T.bracket}</h2><span class="sg-state" id="sgChip"></span><p class="sg-next" id="sgNext"></p>
        <div class="sg-prize" id="sgPrize" hidden><span id="sgPrizeText"></span><button type="button" class="primary" id="sgOpen">${T.open}</button></div>
        <button type="button" class="primary sg-nextcup" id="sgNextCup" hidden>${T.nextCup}</button></div>
      <div class="sg-scroll" id="sgScroll"><div class="sg-bracket" id="sgBracket" role="list"></div><p class="sg-empty" id="sgEmpty" hidden></p></div>
    </section>
    <section class="sg-match" id="sgMatch" hidden aria-labelledby="sgMatchTitle">
      <header class="sg-mh"><button type="button" class="secondary small" id="sgMatchBack">${T.bracket}</button><b id="sgMatchTitle" tabindex="-1"></b><span class="sg-mh-sub" id="sgMatchSub"></span></header>
      <div class="sg-rows"><div class="sg-row"><p class="sg-row-label" id="sgRowA"></p><div class="sg-cards" id="sgCardsA"></div></div>
        <div class="sg-row"><p class="sg-row-label" id="sgRowB"></p><div class="sg-cards" id="sgCardsB"></div></div></div>
      <footer class="sg-mf"><p class="sg-outcome" id="sgOutcome" hidden><b id="sgOutBig"></b><span id="sgOutLine"></span></p><p class="sg-hint" id="sgHint"></p>
        <button type="button" class="secondary" id="sgArmBtn" hidden>${T.arm}</button><button type="button" class="primary" id="sgFight">${T.fightEnter}</button><button type="button" class="primary" id="sgDone" hidden>${T.confirm}</button></footer>
      <section class="sg-armbox" id="sgArm" hidden aria-labelledby="sgArmTitle"><button type="button" class="detail-close" id="sgArmClose" aria-label="닫기">×</button>
        <b class="sg-pick-title" id="sgArmTitle" tabindex="-1">${T.arm}</b><div class="sg-arm-rows" id="sgArmRows"></div>
        <div class="sg-pick-actions"><button type="button" class="primary" id="sgArmOk">${T.confirm}</button></div></section>
    </section></main>`;
  const $ = (id) => root.getElementById(id), events = new AbortController();
  const on = (el, type, fn) => el.addEventListener(type, fn, { signal: events.signal });
  const grove = createPixelGrove($('sgGrove'), matchMedia('(prefers-reduced-motion: reduce)')); grove.gust();
  paintPixelWordmark($('sgHeading'), { text: T.title, font: '600 18px Pretendard', height: 29, baseline: 22, tracking: 2 });
  const engine = makeEngine(game);
  const status = (text, tone = '') => { $('sgStatus').textContent = text; if (tone) $('sgStatus').dataset.tone = tone; else delete $('sgStatus').dataset.tone; };
  let t = null, open = null; // open = { id, picks: [key], result, arms: [무기 × 3] } — 경기 화면이 열린 동안 (arms = 이 경기에 배정할 내 팀 무기)
  let armDraft = null; // 무기 배정 창이 열린 동안 고르는 중인 [무기 × 3]
  let busy = false;

  // ── 이름 · 얼굴 ──
  const seatNo = (team) => seatOrder(t).indexOf(team) + 1;
  const tName = (team) => (team == null ? '' : teamName(seatNo(team), team === 0));
  const faces = (team) => (team == null ? '' : `<span class="sg-faces">${t.teams[team].members.map((f) => `<img src="${esc(portraitOf(f.id, f.cloth))}" alt="" draggable="false"${f.dead ? ' data-dead' : ''}>`).join('')}</span>`);
  const deathsIn = (m) => Object.values(m.result?.fighters ?? {}).filter((o) => !o.alive).length;
  /** 내 길 (내 팀이 지나왔거나 — 아직 남아 있으면 — 지나갈 경기) */
  function onPath(m) {
    if (isMine(t, m)) return true;
    if (myTeamOut(t)) return false;
    const seat = seatOrder(t).indexOf(0);
    return m.round > 0 && Math.floor(seat / 2 ** (m.round + 1)) === m.index;
  }
  // ── ① 대진표 ──
  function stateOf(m, t0) {
    const st = matchState(t, m, t0), at = readyAt(t, m);
    if (st === 'done') {
      const [A, B] = sidesOf(t, m), W = winnerOf(t, m);
      return { st, time: clockText(m.result.at), text: resultLine(tName(W), tName(W === A ? B : A), m.result, deathsIn(m)) };
    }
    const time = clockText(at ?? roundAt(t.day, m.round));
    if (st === 'soon') return { st, time, text: untilText(at - t0) };
    if (st === 'ready') return { st, time, text: T.ready };
    return { st, time, text: '' }; // 'wait' 앞 경기를 기다림 · 'due' 다음 셈에 끝남
  }
  function renderBracket(t0) {
    const n = t.teams.length, R = roundsOf(n), rows = n / 2;
    const box = $('sgBracket');
    box.style.setProperty('--rounds', R);
    box.style.setProperty('--rows', rows);
    let html = '';
    for (let r = 0; r < R; r++) html += `<p class="sg-col-head" style="grid-column:${r + 1}">${roundName(n, r)}</p>`;
    html += `<p class="sg-col-head" style="grid-column:${R + 1}">${T.champion}</p>`;
    for (const m of t.matches) {
      const span = 2 ** m.round, [A, B] = sidesOf(t, m), W = winnerOf(t, m), s = stateOf(m, t0);
      const team = (x) => `<span class="sg-t"${x != null && W === x ? ' data-win' : ''}${x != null && W != null && W !== x ? ' data-lose' : ''}${x === 0 ? ' data-me' : ''}>${faces(x)}<span class="sg-tn">${x == null ? '—' : esc(tName(x))}</span></span>`;
      const label = `${roundName(n, m.round)}${s.time ? ` ${s.time}` : ''} · ${tName(A) || '—'} · ${tName(B) || '—'}${s.text ? ` · ${s.text}` : ''}`;
      html += `<button type="button" class="sg-m" role="listitem" data-match="${m.id}" data-state="${s.st}"${onPath(m) ? ' data-path' : ''}${A == null || B == null ? ' disabled' : ''} style="grid-column:${m.round + 1};grid-row:${2 + m.index * span} / span ${span}" aria-label="${esc(label)}">
        <span class="sg-m-head"><span class="sg-m-time">${s.time}</span><span class="sg-m-state">${esc(s.text)}</span></span>${team(A)}${team(B)}</button>`;
    }
    const champ = t.champion;
    html += `<div class="sg-champ" style="grid-column:${R + 1};grid-row:2 / span ${rows}"${champ === 0 ? ' data-me' : ''}>${champ == null ? '<span class="sg-tn">—</span>' : `${faces(champ)}<span class="sg-tn">${esc(tName(champ))}</span>`}</div>`;
    box.innerHTML = html;
  }
  function render({ scroll = false } = {}) {
    const t0 = now(), st = syncSaengsa(t0);
    t = st.current;
    const sched = scheduleState(t0, t);
    $('sgChip').textContent = stateLine(sched);
    $('sgChip').dataset.kind = sched.kind;
    $('sgBracket').hidden = !t;
    $('sgEmpty').hidden = !!t;
    $('sgPrize').hidden = true;
    $('sgNextCup').hidden = true;
    if (!t) {
      const w = signupWindow(t0);
      $('sgNext').textContent = '';
      $('sgEmpty').textContent = `${T.noTournament} ${signupHours(w.from, w.to)}`;
      return;
    }
    const n = t.teams.length, m = myMatch(t);
    if (t.status === 'done') {
      $('sgNext').textContent = `${T.champion} · ${tName(t.champion)}`;
      const chests = chestCount(t);
      if (chests && !t.chests) { $('sgPrize').hidden = false; $('sgPrizeText').textContent = chestLine(chests); }
      else if (SAENGSA.testMode) $('sgNextCup').hidden = false; // 시험판: 하사품을 연 뒤(없으면 바로) 다음 대회
    } else if (m) $('sgNext').textContent = nextMatchLine(roundName(n, m.round), readyAt(t, m) ?? 0, matchState(t, m, t0), t0);
    else if (myTeamOut(t)) {
      const lost = t.matches.find((x) => x.result && sidesOf(t, x).includes(0) && winnerOf(t, x) !== 0);
      $('sgNext').textContent = outLine(roundName(n, lost.round), lost.result.by === 'forfeit');
    }
    renderBracket(t0);
    if (scroll) {
      const target = (m && $('sgBracket').querySelector(`[data-match="${m.id}"]`)) || $('sgBracket').querySelector('.sg-m[data-path]');
      if (target) { const sc = $('sgScroll'), r = target.getBoundingClientRect(), b = sc.getBoundingClientRect(); sc.scrollTop += r.top - b.top - (sc.clientHeight - r.height) / 2; }
    }
    if (open && !open.result) renderMatch(); // 경기 화면이 열려 있으면 시각 · 상태만 새로
  }
  on($('sgBracket'), 'click', (e) => { const b = e.target.closest('.sg-m'); if (b && !b.disabled) openMatch(b.dataset.match); });
  on($('sgOpen'), 'click', () => {
    const got = claimChests();
    if (got) status(chestGot(got.reduce((s, x) => s + (x.kind === 'coins' ? x.amount : 0), 0)), 'notice');
    render();
    if (!$('sgNextCup').hidden) $('sgNextCup').focus({ preventScroll: true });
  });
  // 시험판 '다음 대회': 지난 팀(동료 · 신청 때 배정한 무기) 그대로 바로 새 대회 — 고용 금화는 시험판 지갑에서
  on($('sgNextCup'), 'click', () => {
    const t0 = now(), d = readSaengsa().draft, entry = entryState();
    const res = signUp({ now: t0, companions: d.companions, weapons: d.weapons, seed: newSeed(), data: { ...SAENGSA_DATA, owned: entry.owned, hasTitle: entry.hasTitle, hireCostOf } });
    if (!res.ok) { status({ coins: T.noCoins, busy: T.busy, team: T.pickTwo, weapons: T.pickWeapons, entry: entryLine(entry.missing) }[res.why] ?? T.saveFail, 'alert'); return; }
    status(T.signed, 'notice');
    render({ scroll: true });
    $('sgHeading').focus({ preventScroll: true });
  });

  // ── ② 경기 화면 ──
  function card(f, { mine, pick, picked, entrant, result }) {
    const o = result?.fighters?.[f.key], hp = o ? o.hp : f.hp, inj = o ? o.injuries : f.injuries, dead = o ? !o.alive : f.dead;
    const hpPct = Math.max(0, Math.min(100, Math.round((hp / SAENGSA.hpMax) * 100)));
    // 다섯 유파 + 무유파가 주 유파인 인물만 무유파 칸 (숙련도 표에 none 이 있는 사람 — 브론 · 마야 · 김씨) · 든 무기의 유파 칸을 강조
    const cells = f.prof && 'none' in f.prof && f.id !== 'player' ? [...SCHOOL_CELLS, 'none'] : SCHOOL_CELLS;
    const prof = cells.map((s) => `<span class="sg-pc"${s === f.school ? ' data-on' : ''}><small>${SCHOOL_KO[s]}</small><b>${f.prof?.[s] ?? 0}</b></span>`).join('');
    const tag = pick ? 'button' : 'div';
    const label = `${fighterName(f)} · 체력 ${hp} · ${injuryText(inj, (i) => isSerious(i))} · ${weaponName(f.weapon)}${f.broken ? ` ${T.broken}` : ''}${dead ? ` · ${T.dead}` : ''}`;
    return `<${tag} ${pick ? 'type="button" ' : ''}class="sg-card" data-key="${f.key}"${pick ? ` aria-pressed="${picked}"` : ''}${dead ? ' data-dead' : ''}${entrant ? ' data-entrant' : ''}${mine ? ' data-mine' : ''}${pick && dead ? ' disabled' : ''} aria-label="${esc(label)}">
      <img class="sg-face" src="${esc(portraitOf(f.id, f.cloth))}" alt="" draggable="false">
      <span class="sg-card-body"><b class="sg-name">${esc(fighterName(f))}</b>
        <span class="sg-hp"><span class="sg-hp-bar"><i style="width:${hpPct}%"></i></span><span class="sg-hp-num">${hp}</span></span>
        <span class="sg-wpn"><img src="${esc(weaponThumb(f.weapon))}" alt="" draggable="false"><span>${esc(weaponName(f.weapon))}</span>${f.broken ? `<i class="sg-tag" data-kind="broken">${T.broken}</i>` : ''}</span>
        <span class="sg-inj"${inj.length ? ' data-hurt' : ''}>${esc(injuryText(inj, (i) => isSerious(i)))}</span></span>
      <span class="sg-prof" aria-hidden="true">${prof}</span>${dead ? `<span class="sg-badge" data-kind="dead">${T.dead}</span>` : entrant ? `<span class="sg-badge">${T.entrant}</span>` : ''}</${tag}>`;
  }
  function openMatch(id) {
    open = { id, picks: [], result: null, arms: t.teams[0].members.map((f) => f.weapon) };
    renderMatch();
    $('sgMatch').hidden = false;
    $('sgMatchTitle').focus({ preventScroll: true });
  }
  function closeMatch() {
    const id = open?.id;
    open = null;
    armDraft = null;
    $('sgArm').hidden = true;
    $('sgMatch').hidden = true;
    render();
    $('sgBracket').querySelector(`[data-match="${id}"]`)?.focus({ preventScroll: true });
  }
  function renderMatch() {
    const m = matchById(t, open.id), t0 = now();
    if (!m) { closeMatch(); return; }
    const [A, B] = sidesOf(t, m), result = open.result ?? m.result, n = t.teams.length;
    const mineSide = A === 0 ? 'a' : B === 0 ? 'b' : null;
    const playable = !result && mineSide && myMatch(t)?.id === m.id && matchState(t, m, t0) === 'ready';
    // 싸우던 경기(몸 상태 이어받기 — SAENGSA.resumeState · 사장님 10/30 08:2x '둘 다 켜'): 같은 사람 · 같은 무기로 묶음(고르기 · 무기 배정 잠금)
    const R = playable ? resumeOf(t, m.id) : null;
    if (R) { open.picks = [...R.picks]; open.arms = [...R.arms]; }
    // 내 경기면 위 = 상대 · 아래 = 내 팀 / 그 밖은 위 = a · 아래 = b
    const top = mineSide === 'a' ? 'b' : 'a', bottom = top === 'a' ? 'b' : 'a';
    const teamOf = (side) => (side === 'a' ? A : B);
    const s = stateOf(m, t0);
    $('sgMatchTitle').textContent = s.time ? `${roundName(n, m.round)} · ${s.time}` : roundName(n, m.round);
    $('sgMatchSub').textContent = result ? '' : s.text;
    // 결과 뒤 카드: 결과 전 상태(pre)에 결과 몫을 겹쳐 그린다 — 쉬며 되찾은 체력 · 나은 경상은 대진표 카드에
    // 배정 중인 무기는 내 카드에 바로 (저장은 '전투 입장' 때)
    const brokenMine = new Set(t.broken ?? []);
    const armed = (f, i) => (open.arms[i] && open.arms[i] !== f.weapon && !f.dead ? { ...f, weapon: open.arms[i], ...weaponInfo(open.arms[i]), broken: brokenMine.has(open.arms[i]) } : f);
    const membersAt = (side) => (result?.pre ? result.pre[side] : teamOf(side) === 0 && playable ? t.teams[0].members.map(armed) : t.teams[teamOf(side)].members);
    const row = (side, el, labelEl) => {
      const team = teamOf(side), mine = team === 0, entrants = result?.entrants?.[side] ?? [];
      // 상대 팀 무기 다섯(사장님 10/29 19:5x) — 이름표 줄 끝에 작게 · 지금 든 무기는 밝게
      const members = membersAt(side), pool = mine ? null : t.teams[team].pool;
      const held = new Set(members.filter((f) => !f.dead).map((f) => f.weapon));
      const poolHtml = Array.isArray(pool) && pool.length ? `<span class="sg-row-pool"> · ${T.teamPool} ${pool.map((w) => `<i${held.has(w.weapon) ? ' data-on' : ''}>${esc(weaponName(w.weapon))}${w.broken ? ` ${T.broken}` : ''}</i>`).join(' · ')}</span>` : '';
      labelEl.innerHTML = esc(mine ? T.myTeam : `${mineSide ? `${T.foeTeam} · ` : ''}${tName(team)}`) + poolHtml;
      $(el).innerHTML = members.map((f) => card(f, { mine, pick: playable && mine && !R, picked: open.picks.includes(f.key), entrant: R && mine ? R.picks.includes(f.key) : entrants.includes(f.key), result })).join('');
    };
    row(top, 'sgCardsA', $('sgRowA'));
    row(bottom, 'sgCardsB', $('sgRowB'));
    const armsOk = armsValid();
    $('sgFight').hidden = !playable;
    $('sgArmBtn').hidden = !playable || !!R;
    $('sgFight').disabled = !(open.picks.length >= 1 && open.picks.length <= SAENGSA.entrantsMax) || !armsOk || busy;
    $('sgDone').hidden = !open.result;
    $('sgHint').textContent = playable ? (R ? T.resumeHint : armsOk ? `${T.pickHint} ${T.foeHidden}` : T.pickWeapons) : '';
    $('sgHint').hidden = !playable;
    const out = $('sgOutcome');
    out.hidden = !result;
    if (result) {
      const W = winnerOf(t, m) ?? (result.winner === 'a' ? A : B);
      if (mineSide) {
        const won = W === 0;
        $('sgOutBig').textContent = won ? T.win : T.loss;
        $('sgOutLine').textContent = myResultLine(won, result.by === 'forfeit' && !won);
        out.dataset.won = String(won);
      } else {
        $('sgOutBig').textContent = '';
        $('sgOutLine').textContent = resultLine(tName(W), tName(W === A ? B : A), result, deathsIn({ result }));
        delete out.dataset.won;
      }
    }
  }
  on($('sgMatch'), 'click', (e) => {
    const c = e.target.closest('button.sg-card');
    if (!c || c.disabled || !open || open.result) return;
    const k = c.dataset.key, i = open.picks.indexOf(k);
    if (i >= 0) open.picks.splice(i, 1);
    else { open.picks.push(k); if (open.picks.length > SAENGSA.entrantsMax) open.picks.shift(); } // 셋째를 누르면 먼저 고른 사람을 뺀다
    renderMatch();
    root.querySelector(`button.sg-card[data-key="${k}"]`)?.focus({ preventScroll: true });
  });
  // ── 무기 배정 (경기마다 — 살아 있는 내 팀 세 사람 · 가진 무기 · 한 무기는 한 사람에게(SAENGSA.assignUnique)) ──
  const aliveIdx = () => t.teams[0].members.map((f, i) => (f.dead ? -1 : i)).filter((i) => i >= 0);
  const armsValid = () => !!open && validAssignment(open.arms, ownedWeapons(), aliveIdx()) && !aliveIdx().some((i) => lockedSignatures(t).has(open.arms[i])); // 상대 팀이 가진 전용무기는 못 씀 (사장님 10/29 22:3x)
  function drawArm() {
    const owned = ownedWeapons(), members = t.teams[0].members, brokenMine = new Set(t.broken ?? []);
    $('sgArmRows').innerHTML = members.map((f, i) => {
      if (f.dead) return '';
      const taken = new Set([...(SAENGSA.assignUnique ? aliveIdx().filter((j) => j !== i).map((j) => armDraft[j]) : []), ...lockedSignatures(t)]); // 다른 사람에게 준 무기 · 상대 팀이 가진 전용무기
      const chips = owned.map((w) => `<button type="button" class="sg-chip-btn" role="radio" data-slot="${i}" data-weapon="${w}" aria-checked="${armDraft[i] === w}"${taken.has(w) ? ' disabled' : ''}${brokenMine.has(w) ? ' data-broken' : ''}>${esc(weaponName(w))}${brokenMine.has(w) ? ` · ${T.broken}` : ''}</button>`).join('');
      return `<div class="sg-arm-row"><span class="sg-arm-who"><img src="${esc(portraitOf(f.id, f.cloth))}" alt="" draggable="false"><b>${esc(fighterName(f))}</b></span><div class="sg-chips" role="radiogroup" aria-label="${esc(fighterName(f))} · ${T.weapon}">${chips}</div></div>`;
    }).join('');
    $('sgArmOk').disabled = !validAssignment(armDraft, owned, aliveIdx()) || aliveIdx().some((j) => lockedSignatures(t).has(armDraft[j]));
  }
  function openArm() {
    armDraft = [...open.arms];
    drawArm();
    $('sgArm').hidden = false;
    $('sgArmTitle').focus({ preventScroll: true });
  }
  function closeArm(save) {
    if (save && armDraft) open.arms = [...armDraft];
    armDraft = null;
    $('sgArm').hidden = true;
    if (open) { renderMatch(); $('sgArmBtn').focus({ preventScroll: true }); }
  }
  on($('sgArmBtn'), 'click', () => { if (open && !open.result) openArm(); });
  on($('sgArmRows'), 'click', (e) => {
    const b = e.target.closest('.sg-chip-btn');
    if (!b || b.disabled || !armDraft) return;
    armDraft[+b.dataset.slot] = b.dataset.weapon;
    drawArm();
    root.querySelector(`#sgArmRows .sg-chip-btn[data-slot="${b.dataset.slot}"][data-weapon="${b.dataset.weapon}"]`)?.focus({ preventScroll: true });
  });
  on($('sgArmOk'), 'click', () => closeArm(true));
  on($('sgArmClose'), 'click', () => closeArm(false));

  on($('sgFight'), 'click', async () => {
    if (!open || busy) return;
    const t0 = now(), m = matchById(t, open.id), arm = { weapons: open.arms, owned: ownedWeapons(), weaponInfo };
    const armedT = structuredClone(t); // 배정한 무기로 판을 세운다(2단계 엔진이 받는 판 — 저장은 playMine 이 한 번에)
    if (!assignWeapons(armedT, arm.weapons, arm)) { status(T.pickWeapons); renderMatch(); return; }
    const setup = matchSetup(armedT, matchById(armedT, m.id), open.picks, t0);
    if (!setup) { status(T.notReady); render(); return; }
    if (SAENGSA.resumeState) { // 몸 상태 이어받기 (사장님 10/30 08:2x '둘 다 켜'): 그만둔 경기면 넷의 몸 사본을 입히고 · 싸우는 동안 엔진이 넘기는 사본을 대회 저장에
      const R = resumeOf(t, m.id), picks = [...open.picks], arms = [...arm.weapons];
      if (R) setup.resume = R.bodies;
      setup.resumeSave = (bodies) => saveResume(m.id, { picks, arms, bodies, at: now() });
    }
    busy = true;
    try {
      let res = null;
      if (engine.real) { res = await engine.play(setup); if (!res) { render(); status(SAENGSA.resumeState ? T.notPlayedResume : T.notPlayed); return; } } // 실제 싸움 (saengsa_engine.js — 그만두고 나오면 null = 아직 하지 않은 경기: 지지 않음 · 적지 않음)
      const result = playMine(open.id, open.picks, now(), res, { arm });
      if (!result) { status(T.saveFail); return; }
      render();
      open.result = result;
      renderMatch();
      $('sgDone').focus({ preventScroll: true });
    } finally { busy = false; if (open) renderMatch(); }
  });
  on($('sgDone'), 'click', closeMatch);
  on($('sgMatchBack'), 'click', closeMatch);
  on(root, 'keydown', (e) => { if (e.key !== 'Escape' || !open) return; e.preventDefault(); if (armDraft) closeArm(false); else closeMatch(); });
  on($('sgBack'), 'click', () => onBack?.());

  render({ scroll: true });
  makeNamelessFaces().then((ok) => { if (!ok) return; render(); if (open) renderMatch(); }); // 무명 검객 얼굴(옷 색마다)을 칠한 뒤 다시 그림
  $('sgHeading').focus({ preventScroll: true });
  const timer = setInterval(() => render(), 30e3);
  return {
    refresh: () => render(),
    destroy() { clearInterval(timer); events.abort(); grove.dispose(); },
    openMatch, // 사진 도구 · 시험: page.openMatch('r0m3')
  };
}
