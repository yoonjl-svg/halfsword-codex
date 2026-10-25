import { mountLobby } from "../lobby.js";
import ui from "./ui.css?inline";
import {
  CANDIDATES,
  SCHOOLS,
  SCHOOL_NAMES,
  shortName,
  conditionName,
  weaponName,
  weaponSchool,
} from "./catalog.js";
import {
  STATE_KEY,
  CLOCK_KEY,
  HOUR,
  ROUND_NAMES,
  schedule,
  dateText,
  createState,
  readState,
  saveState,
  setCompanion,
  equip,
  register,
  refreshNpc,
  ownMatch,
  availableAt,
  weaponOf,
  toggleSelect,
  startMatch,
  settle,
} from "./state.js";
const store = window.__oathStorage,
  host = document.getElementById("tournamentApp"),
  root = host.attachShadow({ mode: "open" });
let state,
  offset = Number(store.getItem(CLOCK_KEY) || 0) || 0,
  view = "lobby",
  lobby = null,
  battle = null,
  bracketObserver = null,
  selectedMatch = null,
  loadToken = 0;
const now = () => Date.now() + offset;
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const img = (id) => `ui/portraits/${id}.webp`;
function toast(text) {
  document.getElementById("globalStatus").textContent = text;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(
    () => (document.getElementById("globalStatus").textContent = ""),
    6000,
  );
}
try {
  state = readState(store);
  if (!store.getItem(STATE_KEY)) saveState(store, state, 0, now());
} catch (e) {
  state = null;
  toast(e.message);
}
function change(action, draw = true) {
  try {
    if (!state) throw Error("저장을 먼저 복구해 주십시오.");
    const next = structuredClone(state),
      answer = action(next);
    saveState(store, next, state.revision, now());
    state = next;
    if (draw) render();
    return { ok: true, answer };
  } catch (e) {
    toast(e.message);
    return { ok: false };
  }
}
function teardown() {
  bracketObserver?.disconnect();
  bracketObserver = null;
  lobby?.destroy();
  lobby = null;
}
function setupMarkup() {
  const window = schedule(now()),
    reg = state.registration,
    closed = !reg && !window.open;
  return `<div class="oath-setup"><div class="setup-scroll"><h3>3인의 맹약</h3><p class="setup-copy">세 사람이 이름을 올립니다.<br>매 대진마다 한 명 또는 두 명을 골라 함께 싸우십시오.</p><label class="setup-field"><span>팀 이름</span><input id="teamName" maxlength="16" value="${esc(state.teamName)}" ${reg ? "disabled" : ""}></label>${state.roster.map((m, i) => `<div class="setup-person"><img src="${img(m.id)}" alt=""><div class="person-body">${i === 0 ? `<b>${shortName(m.id)}</b>` : `<select aria-label="동료 ${i} 선택" data-companion="${i}" ${reg ? "disabled" : ""}>${CANDIDATES.map((id) => `<option value="${id}" ${m.id === id ? "selected" : ""} ${state.roster.some((x, j) => j !== i && x.id === id) ? "disabled" : ""}>${shortName(id)}</option>`).join("")}</select>`}<small>${SCHOOL_NAMES[m.main]} ${m.skills[m.main]} · ${weaponName(weaponOf(m))}</small></div></div>`).join("")}<p class="setup-schedule">신청 22:00–02:00 · 개막 10:00<br>경기를 마친 뒤 2시간 후 다음 대진<br><span class="gold">늦게 와도 기권되지 않습니다.</span></p></div><div class="setup-bottom"><small id="setupTime">${reg ? `신청 완료 · ${dateText(reg.startsAt)} 개막` : window.open ? `접수 중 · ${dateText(window.closesAt)} 마감` : `다음 접수 ${dateText(window.opensAt)}`}</small><button id="enterTournament" class="primary" ${closed ? "disabled" : ""}>생사전 입장</button></div></div>`;
}
function lobbyView() {
  teardown();
  lobby = mountLobby({
    root,
    game: {
      getSkillBookContext: () => ({ test: true }),
      lobbyPortraitId: () => "player",
      getWanderStatus: () => ({
        unlocked: false,
        cleared: 0,
        total: 30,
        name: "방랑",
        ongoing: false,
      }),
    },
    choice: "continue",
    onDepart: () => toast("이 페이지에서는 생사전 흐름을 시험합니다."),
    onBack: () => toast("생사전 검토판입니다. 가운데 생사전을 눌러 주십시오."),
  });
  const style = document.createElement("style");
  style.textContent = ui;
  root.append(style);
  root.getElementById("tournamentSetup").innerHTML = setupMarkup();
  root.getElementById("tabEvent").click();
  root.getElementById("teamName").addEventListener("change", (e) =>
    change((s) => {
      if (s.registration) return;
      s.teamName = e.target.value.trim().slice(0, 16) || "이름 없는 맹약";
    }),
  );
  root
    .querySelectorAll("[data-companion]")
    .forEach(
      (el) =>
        (el.onchange = () =>
          change((s) => setCompanion(s, +el.dataset.companion, el.value))),
    );
  root.getElementById("enterTournament").onclick = () => {
    const r = state.registration
      ? { ok: true }
      : change((s) => register(s, now()), false);
    if (r.ok) {
      view = "bracket";
      selectedMatch = ownMatch(state)?.id;
      render();
      window.scrollTo(0, 0);
    }
  };
}
function teamName(id) {
  return state.teams.find((t) => t.id === id)?.name || "앞 경기 승자";
}
function selectedDetail(m) {
  if (!m) return "";
  const opponent = m.teams.find((t) => t && t !== "team-0"),
    t = state.teams.find((t) => t.id === opponent);
  if (!m.teams.includes("team-0"))
    return `<div class="match-detail">${esc(teamName(m.teams[0]))} 대 ${esc(teamName(m.teams[1]))} · ${m.winner ? `${esc(teamName(m.winner))} 승리` : "대기 중"}<br>다른 팀의 결과는 시험판에서 모의 진행합니다.</div>`;
  return `<div class="match-detail"><b>${esc(t?.name || "다음 상대 미정")}</b> · 상대 출전 예정 2명<br>${(t?.roster.slice(0, 2) || []).map((f) => `<img src="${img(f.id)}" alt="">${shortName(f.id)} · ${weaponName(weaponOf(f))} · ${SCHOOL_NAMES[weaponSchool(weaponOf(f))]} ${f.skills[weaponSchool(weaponOf(f))] || 0}`).join("<br>")}</div>`;
}
function fighterCard(m) {
  const order = state.selected.indexOf(m.id),
    role = order === 0 ? "직접 조작" : order === 1 ? "AI 동료" : "대기",
    selected = order >= 0,
    locked = !!state.pending || m.status === "dead";
  const school = weaponSchool(weaponOf(m));
  return `<article class="fighter-card ${selected ? "selected" : ""} ${m.status === "dead" ? "dead" : ""}" data-member="${m.id}"><button class="choose-fighter" aria-label="${shortName(m.id)} 출전 선택" aria-pressed="${selected}" data-select="${m.id}" ${locked ? "disabled" : ""}><img src="${img(m.id)}" alt="${shortName(m.id)} 프로필"><div><h3>${shortName(m.id)}</h3><span class="choice-role">${m.status === "dead" ? conditionName(m) : role}</span><p class="muted">대표 ${SCHOOL_NAMES[m.main]}</p></div></button><div class="fighter-details"><div class="health-row"><span>체력</span><b>${Math.round(m.hp)} / 100</b></div><div class="health-meter"><span style="width:${Math.max(0, Math.min(100, m.hp))}%"></span></div><p class="injury">${esc(conditionName(m))}${m.weaponBroken ? " · 무기 파손" : ""}</p><div class="skill-row" aria-label="유파별 숙련도">${SCHOOLS.map((s) => `<span class="${school === s ? "current" : ""}">${SCHOOL_NAMES[s]} ${m.skills[s]}</span>`).join("")}</div><div class="gear"><img src="ui/weapons/${weaponOf(m)}.webp" alt=""><label>장착 무기<select data-equip="${m.id}" aria-label="${shortName(m.id)} 장착 무기" ${locked ? "disabled" : ""}><option value="" ${!m.override ? "selected" : ""}>지급 · ${weaponName(m.assignedWeapon)}</option>${state.inventory.map((w) => `<option value="${w}" ${m.override === w ? "selected" : ""} ${state.roster.some((x) => x.id !== m.id && x.override === w) ? "disabled" : ""}>보유 · ${weaponName(w)}</option>`).join("")}</select></label></div></div></article>`;
}
function bracketView() {
  teardown();
  const current = ownMatch(state);
  selectedMatch ||= current?.id;
  const chosen = state.matches.find((m) => m.id === selectedMatch) || current,
    finished = ["champion", "eliminated"].includes(state.phase),
    ready = now() >= availableAt(state),
    isCurrent = chosen?.id === current?.id;
  root.innerHTML = `<style>${ui}</style><main class="oath-page"><header class="oath-header"><div><h1>생사전 <span class="muted">— 3인의 맹약</span></h1><p>${esc(state.teamName)} · ${dateText(state.registration.startsAt)} 개막</p></div><button id="toLobby" class="secondary">대기실</button></header><div class="oath-shell">${finished ? `<section class="result-banner"><h2>${state.phase === "champion" ? "맹약을 지켰습니다 · 우승" : "이번 생사전이 끝났습니다"}</h2><p>대진과 팀원의 마지막 상태가 저장되었습니다.</p><small>검토판은 본게임의 보상·보유 캐릭터에 영향을 주지 않습니다.</small></section>` : ""}<section class="oath-frame"><div class="section-head"><h2>대진표</h2><p>8팀 · 최대 2명 동시 출전</p></div><div class="bracket">${ROUND_NAMES.map(
    (name, r) =>
      `<section class="bracket-column"><h3>${name}</h3>${state.matches
        .filter((m) => m.round === r)
        .map(
          (m) =>
            `<button class="match ${m.teams.includes("team-0") ? "ours" : ""} ${m.id === selectedMatch ? "active" : ""}" data-match="${m.id}" aria-pressed="${m.id === selectedMatch}" aria-label="${name} ${m.teams.map(teamName).join(" 대 ")}">${m.teams.map((id) => `<span class="match-team ${m.winner && m.winner === id ? "win" : m.winner ? "lost" : ""}"><span>${esc(teamName(id))}</span><span>${m.winner && m.winner === id ? "승" : id === "team-0" ? "나" : ""}</span></span>`).join("")}<span class="match-note">${m.winner ? "경기 종료" : m.teams.includes("team-0") && m.round === state.round ? (ready ? "출전 선택 가능" : `${dateText(availableAt(state))} 이후`) : `${dateText(state.registration.startsAt + r * 2 * HOUR)} 이후`}</span></button>`,
        )
        .join("")}</section>`,
  ).join(
    "",
  )}</div>${selectedDetail(chosen)}</section><section class="oath-frame squad-section"><div class="section-head"><div><h2>출전할 동료를 고르십시오</h2><p>첫 카드 직접 조작 · 두 번째 AI 동료 · 남은 한 명은 휴식</p></div><span class="gold">${state.selected.length} / 2</span></div><div class="squad-grid">${state.roster.map(fighterCard).join("")}</div><footer class="round-footer"><div><p id="roundReady">${finished ? "대회 종료" : state.pending ? "진행 중인 전투가 있습니다. 부상·기력을 유지하고 시작 위치에서 재개합니다." : ready ? "지금 출전할 수 있습니다. 마감 시각은 없습니다." : `${dateText(availableAt(state))}부터 출전 가능 · 기권 없음`}</p><small>장비한 보유 무기는 반드시 들고 출전합니다. 부상은 대회 동안 유지됩니다.</small></div><button class="primary" id="battleEnter" ${finished || (!state.pending && (!ready || !state.selected.length || !isCurrent)) ? "disabled" : ""}>${state.pending ? "전투 이어하기" : "전투 입장"}</button></footer></section><details class="history"><summary>경기 기록 · ${state.history.length}전 / 저장 ${state.lastSavedAt ? dateText(state.lastSavedAt) : "없음"}</summary><ul>${state.history.map((h) => `<li>${ROUND_NAMES[h.round]} · ${h.win ? "승리" : "패배"} · ${h.selected.map(shortName).join(" / ")} · ${dateText(h.completedAt)}${h.source === "demo" ? " · 시험 결과" : ""}</li>`).join("")}</ul><p>체력은 기존 전투의 남은 혈액량입니다. 의식·사지 부상도 별도로 이어집니다.</p></details></div></main>`;
  root.getElementById("toLobby").onclick = () => {
    view = "lobby";
    render();
  };
  root.querySelectorAll("[data-match]").forEach(
    (el) =>
      (el.onclick = () => {
        selectedMatch = el.dataset.match;
        render();
      }),
  );
  root
    .querySelectorAll("[data-select]")
    .forEach(
      (el) =>
        (el.onclick = () => change((s) => toggleSelect(s, el.dataset.select))),
    );
  root
    .querySelectorAll("[data-equip]")
    .forEach(
      (el) =>
        (el.onchange = () =>
          change((s) => equip(s, el.dataset.equip, el.value || null))),
    );
  root.getElementById("battleEnter").onclick = enterBattle;
  connectBracket();
}
function connectBracket() {
  const box = root.querySelector(".bracket"),
    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("bracket-lines");
  svg.setAttribute("aria-hidden", "true");
  box.prepend(svg);
  const draw = () => {
    if (!box.isConnected) return;
    const r = box.getBoundingClientRect();
    svg.setAttribute("viewBox", `0 0 ${r.width} ${r.height}`);
    svg.replaceChildren();
    for (let i = 0; i < 6; i++) {
      const from = root
          .querySelector(`[data-match="match-${i}"]`)
          .getBoundingClientRect(),
        to = root
          .querySelector(
            `[data-match="match-${i < 4 ? 4 + Math.floor(i / 2) : 6}"]`,
          )
          .getBoundingClientRect(),
        mid = (from.right + to.left) / 2 - r.left;
      const path = document.createElementNS(svg.namespaceURI, "path");
      path.setAttribute(
        "d",
        `M ${from.right - r.left} ${from.top + from.height / 2 - r.top} H ${mid} V ${to.top + to.height / 2 - r.top} H ${to.left - r.left}`,
      );
      svg.append(path);
    }
  };
  bracketObserver = new ResizeObserver(draw);
  bracketObserver.observe(box);
  requestAnimationFrame(draw);
}
async function enterBattle() {
  const r = change((s) => startMatch(s, now()), false);
  if (!r.ok) return;
  view = "battle";
  teardown();
  const token = ++loadToken;
  root.innerHTML = `<style>${ui}</style><div class="battle-screen"><div class="battle-center"><h2>대면을 준비합니다</h2><p>선택한 장비와 팀원을 불러오는 중입니다.</p></div></div>`;
  try {
    const { mountBattle } = await import("./battle.js");
    if (token !== loadToken) return;
    const mounted = await mountBattle({
      root,
      style: ui,
      pending: structuredClone(state.pending),
      isCurrent: () => token === loadToken && view === "battle",
      onCheckpoint: (checkpoint) =>
        change((s) => {
          if (s.pending) s.pending.checkpoint = checkpoint;
        }, false),
      onLeave: () => {
        battle?.dispose();
        battle = null;
        view = "bracket";
        selectedMatch = ownMatch(state)?.id || selectedMatch;
        render();
        window.scrollTo(0, 0);
      },
      onComplete: (r) => completeBattle(r, true),
    });
    if (!mounted) return;
    if (token !== loadToken) {
      mounted.dispose();
      return;
    }
    battle = mounted;
  } catch (e) {
    console.error(e);
    toast("전투를 열지 못했습니다. 출전 기록은 유지됩니다. " + e.message);
    view = "bracket";
    render();
  }
}
function completeBattle(result, stay = false) {
  const r = change((s) => settle(s, result, now()), false);
  if (!r.ok) return false;
  if (stay) return true;
  ++loadToken;
  battle?.dispose();
  battle = null;
  view = "bracket";
  selectedMatch = ownMatch(state)?.id || selectedMatch;
  render();
  window.scrollTo(0, 0);
  return true;
}
function render() {
  if (!state) {
    root.innerHTML = `<style>${ui}</style><main class="oath-page"><h1>저장 데이터를 확인해 주십시오</h1><p>시험 도구에서 새 대회로 초기화할 수 있습니다. 본게임 저장은 유지됩니다.</p></main>`;
    return;
  }
  if (view === "lobby") lobbyView();
  else if (view === "bracket") bracketView();
  updateClock();
}
function updateClock() {
  document.getElementById("testClock").textContent =
    `한국시간 ${dateText(now())}${offset ? " · 시험 시각" : ""}`;
}
function setClock(time) {
  try {
    const next = time - Date.now();
    store.setItem(CLOCK_KEY, String(next));
    offset = next;
    change((s) => refreshNpc(s, now()));
  } catch (e) {
    toast("시험 시각을 저장하지 못했습니다.");
  }
}
document.querySelectorAll("[data-clock]").forEach(
  (el) =>
    (el.onclick = () => {
      if (view === "battle") {
        toast("전투를 마치거나 잠시 나간 뒤 시간을 바꿀 수 있습니다.");
        return;
      }
      const k = el.dataset.clock;
      if (k === "real") setClock(Date.now());
      else if (k === "registration") {
        const w = schedule(now());
        setClock(w.open ? now() : w.opensAt + 60000);
      } else if (!state?.registration) toast("먼저 참가 신청을 해 주십시오.");
      else
        setClock(
          Math.max(
            now(),
            k === "start" ? state.registration.startsAt : availableAt(state),
          ) + 1000,
        );
    }),
);
document.getElementById("testReset").onclick = () => {
  if (!confirm("생사전 시험 저장만 지우고 새 팀을 만드시겠습니까?")) return;
  ++loadToken;
  battle?.dispose();
  battle = null;
  try {
    store.removeItem(STATE_KEY);
    state = createState();
    saveState(store, state, 0, now());
    view = "lobby";
    selectedMatch = null;
    render();
  } catch (e) {
    toast(e.message);
  }
};
function demoResult(win) {
  if (!state?.pending) {
    toast("출전 카드를 고르고 전투 입장 후 사용할 수 있습니다.");
    return;
  }
  const pending = state.pending,
    result = {
      id: pending.id,
      win,
      source: "demo",
      members: pending.allies.map((m, i) => ({
        ...m,
        hp: win ? Math.max(15, m.hp - 18 - i * 8) : 0,
        status: win ? "injured" : "dead",
        injuries: win ? ["팔 경상"] : ["전사"],
        consciousness: win ? 0.85 : 0,
        limbs: { ...m.limbs, armS: win ? 0.8 : 0 },
      })),
    };
  completeBattle(result);
}
document.getElementById("testVictory").onclick = () => demoResult(true);
document.getElementById("testDefeat").onclick = () => demoResult(false);
window.addEventListener("storage", (e) => {
  if (e.key === STATE_KEY) {
    toast("다른 창에서 생사전 기록이 바뀌었습니다. 새로고침 후 이어 주십시오.");
    battle?.pause?.();
  }
});
let timeGate = "";
setInterval(() => {
  updateClock();
  const key = state?.registration
    ? String(now() >= availableAt(state))
    : String(schedule(now()).open);
  if (view !== "battle" && key !== timeGate) {
    timeGate = key;
    render();
  }
  if (view !== "battle" && state?.registration) {
    const next = structuredClone(state);
    refreshNpc(next, now());
    if (JSON.stringify(next.matches) !== JSON.stringify(state.matches))
      change((s) => refreshNpc(s, now()));
    else {
      const b = root.getElementById("battleEnter");
      if (
        b &&
        !state.pending &&
        !["champion", "eliminated"].includes(state.phase)
      )
        b.disabled =
          now() < availableAt(state) ||
          !state.selected.length ||
          selectedMatch !== ownMatch(state)?.id;
    }
  }
}, 1000);
window.oathTest = {
  get state() {
    return structuredClone(state);
  },
  get battle() {
    return battle;
  },
  get now() {
    return now();
  },
  setClock,
  root,
  showBracket() {
    if (state.registration) {
      view = "bracket";
      selectedMatch = ownMatch(state)?.id;
      render();
      window.scrollTo(0, 0);
    }
  },
  demoResult,
};
render();
