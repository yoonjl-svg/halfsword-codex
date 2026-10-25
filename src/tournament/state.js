// Preview-only event state. No campaign/account/economy writes.
import {
  SCHOOLS,
  CANDIDATES,
  RANDOM_WEAPONS,
  OWNED_WEAPONS,
  person,
  weaponSchool,
} from "./catalog.js";
export const HOUR = 3600000,
  DAY = 24 * HOUR,
  KST = 9 * HOUR;
export const STATE_KEY = "stillness.tournament.preview.v1";
export const CLOCK_KEY = "stillness.tournament.preview.clock.v1";
export const ROUND_NAMES = ["8강", "준결승", "결승"];
export function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash(s) {
  let n = 2166136261;
  for (const c of String(s)) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return n >>> 0;
}
export function schedule(now) {
  const day = Math.floor((now + KST) / DAY) * DAY - KST,
    hour = (now - day) / HOUR;
  const eventDay = hour < 2 ? day : day + DAY;
  return {
    open: hour >= 22 || hour < 2,
    opensAt: hour < 2 ? day - 2 * HOUR : day + 22 * HOUR,
    closesAt: eventDay + 2 * HOUR,
    startsAt: eventDay + 10 * HOUR,
    eventDay,
  };
}
export const dateText = (t) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(t);
export function member(id, seed) {
  const p = person(id),
    rng = seeded(hash(`${seed}:${id}`)),
    main = weaponSchool(p.weapon) || "german";
  const mainLevel = p.ai?.proficiency ?? 3;
  const skills = Object.fromEntries(
    SCHOOLS.map((s) => [
      s,
      1 + Math.floor(rng() * Math.max(1, Math.min(3, mainLevel - 1))),
    ]),
  );
  skills[main] = mainLevel;
  const favored = RANDOM_WEAPONS.filter((w) => skills[weaponSchool(w)] >= 2),
    pool = favored.length ? favored : RANDOM_WEAPONS;
  return {
    id,
    main,
    skills,
    assignedWeapon: pool[Math.floor(rng() * pool.length)],
    override: null,
    hp: 100,
    consciousness: 1,
    limbs: { armS: 1, armO: 1, legF: 1, legB: 1 },
    injuries: [],
    status: "ready",
    weaponBroken: false,
  };
}
export function createState(seed = Date.now()) {
  return {
    version: 1,
    revision: 0,
    seed,
    teamName: "이름 없는 맹약",
    roster: ["player", "isolde", "liao"].map((id) => member(id, seed)),
    inventory: [...OWNED_WEAPONS],
    registration: null,
    matches: [],
    teams: [],
    round: 0,
    phase: "setup",
    selected: [],
    pending: null,
    history: [],
    lastSavedAt: null,
  };
}
export function weaponOf(m) {
  return m.override || m.assignedWeapon;
}
export function setCompanion(s, slot, id) {
  if (s.registration) throw Error("신청한 뒤에는 동료를 바꿀 수 없습니다.");
  if (
    ![1, 2].includes(slot) ||
    !CANDIDATES.includes(id) ||
    s.roster.some((m, i) => i !== slot && m.id === id)
  )
    throw Error("서로 다른 동료 두 명을 골라 주십시오.");
  s.roster[slot] = member(id, s.seed);
  return s;
}
export function equip(s, id, weapon) {
  if (s.pending) throw Error("전투 중에는 장비를 바꿀 수 없습니다.");
  const m = s.roster.find((m) => m.id === id);
  if (!m) throw Error("팀원을 찾을 수 없습니다.");
  if (weapon !== null && !s.inventory.includes(weapon))
    throw Error("보유한 무기만 지급할 수 있습니다.");
  if (weapon && s.roster.some((x) => x.id !== id && x.override === weapon))
    throw Error("그 무기는 다른 팀원이 사용 중입니다.");
  m.override = weapon;
  m.weaponBroken = false;
  return s;
}
export function register(s, now) {
  if (s.registration) throw Error("이미 참가 신청한 대회입니다.");
  const w = schedule(now);
  if (!w.open) throw Error("참가 신청은 매일 22:00~02:00입니다.");
  if (new Set(s.roster.map((m) => m.id)).size !== 3)
    throw Error("서로 다른 세 명이 필요합니다.");
  s.registration = {
    at: now,
    startsAt: w.startsAt,
    closesAt: w.closesAt,
    id: `oath-${w.eventDay}-${s.seed}`,
  };
  s.phase = "registered";
  const names = [
    "이름 없는 맹약",
    "잿빛 깃발",
    "고요한 칼날",
    "붉은 매듭",
    "세 갈래 길",
    "서리의 맹세",
    "저문 태양",
    "검은 월계",
  ];
  s.teams = names.map((name, i) => ({
    id: `team-${i}`,
    name: i === 0 ? s.teamName : name,
    roster:
      i === 0
        ? s.roster
        : [0, 1, 2].map((j) =>
            member(
              CANDIDATES[(i * 2 + j) % CANDIDATES.length],
              s.seed + i * 31,
            ),
          ),
  }));
  s.matches = Array.from({ length: 7 }, (_, i) => ({
    id: `match-${i}`,
    round: i < 4 ? 0 : i < 6 ? 1 : 2,
    teams: i < 4 ? [`team-${i * 2}`, `team-${i * 2 + 1}`] : [null, null],
    winner: null,
    completedAt: null,
    source: null,
  }));
  return s;
}
export function ownMatch(s) {
  return (
    s.matches.find((m) => m.round === s.round && m.teams.includes("team-0")) ||
    null
  );
}
export function availableAt(s) {
  if (!s.registration) return null;
  const last = s.history.at(-1);
  return last
    ? Math.max(
        s.registration.startsAt + s.round * 2 * HOUR,
        last.completedAt + 2 * HOUR,
      )
    : s.registration.startsAt;
}
function advanceBracket(s, m) {
  const i = s.matches.findIndex((x) => x.id === m.id);
  if (i >= 6) return;
  const next = s.matches[i < 4 ? 4 + Math.floor(i / 2) : 6];
  next.teams[i % 2] = m.winner;
}
export function refreshNpc(s, now) {
  if (!s.registration) return;
  for (const m of s.matches) {
    if (m.winner || m.teams.includes("team-0") || m.teams.some((t) => !t))
      continue;
    if (now < s.registration.startsAt + m.round * 2 * HOUR) continue;
    const r = seeded(hash(`${s.registration.id}:${m.id}`));
    m.winner = m.teams[r() < 0.5 ? 0 : 1];
    m.completedAt = s.registration.startsAt + m.round * 2 * HOUR;
    m.source = "npc-preview";
    advanceBracket(s, m);
  }
}
export function toggleSelect(s, id) {
  const m = s.roster.find((m) => m.id === id);
  if (!m || m.status === "dead")
    throw Error("전사한 팀원은 출전할 수 없습니다.");
  if (s.pending) throw Error("진행 중인 경기를 먼저 마쳐 주십시오.");
  if (s.selected.includes(id)) s.selected = s.selected.filter((x) => x !== id);
  else {
    if (s.selected.length >= 2)
      throw Error("최대 두 명까지 출전할 수 있습니다.");
    s.selected.push(id);
  }
  return s;
}
export function startMatch(s, now) {
  if (!s.registration || ["eliminated", "champion"].includes(s.phase))
    throw Error("진행할 대진이 없습니다.");
  if (s.pending) return s.pending;
  refreshNpc(s, now);
  const m = ownMatch(s);
  if (!m || m.teams.some((t) => !t))
    throw Error("상대 대진이 아직 정해지지 않았습니다.");
  if (now < availableAt(s)) throw Error("아직 전투 입장 시각이 아닙니다.");
  if (s.selected.length < 1 || s.selected.length > 2)
    throw Error("출전할 캐릭터를 한 명 또는 두 명 고르십시오.");
  const allies = s.selected.map((id) => s.roster.find((m) => m.id === id));
  if (allies.some((x) => !x || x.status === "dead"))
    throw Error("출전할 수 없는 캐릭터가 있습니다.");
  const foe = s.teams.find(
    (t) => t.id === m.teams.find((id) => id !== "team-0"),
  );
  s.pending = {
    id: `${s.registration.id}:${m.id}`,
    matchId: m.id,
    startedAt: now,
    selected: [...s.selected],
    allies: structuredClone(allies),
    enemies: structuredClone(foe.roster.slice(0, 2)),
    checkpoint: null,
  };
  s.phase = "fighting";
  return s.pending;
}
export function settle(s, result, now) {
  if (s.history.some((h) => h.id === result.id)) return false;
  if (!s.pending || s.pending.id !== result.id)
    throw Error("진행 중인 경기와 결과가 다릅니다.");
  const match = s.matches.find((m) => m.id === s.pending.matchId);
  if (match.winner) throw Error("이미 저장한 대진입니다.");
  if (
    !Array.isArray(result.members) ||
    result.members.length !== s.pending.selected.length ||
    new Set(result.members.map((m) => m.id)).size !== result.members.length
  )
    throw Error("팀원 결과가 누락되었습니다.");
  for (const x of result.members) {
    if (
      !s.pending.selected.includes(x.id) ||
      !Number.isFinite(x.hp) ||
      x.hp < 0 ||
      x.hp > 100 ||
      !["ready", "injured", "dead"].includes(x.status)
    )
      throw Error("잘못된 전투 결과입니다.");
  }
  for (const x of result.members) {
    const m = s.roster.find((m) => m.id === x.id);
    for (const k of [
      "hp",
      "consciousness",
      "limbs",
      "injuries",
      "status",
      "weaponBroken",
      "severed",
      "cause",
      "pain",
      "wounds",
    ])
      if (x[k] !== undefined) m[k] = structuredClone(x[k]);
  }
  match.winner = result.win
    ? "team-0"
    : match.teams.find((t) => t !== "team-0");
  match.completedAt = now;
  match.source = result.source || "combat";
  advanceBracket(s, match);
  s.history.push({
    id: result.id,
    round: s.round,
    win: !!result.win,
    completedAt: now,
    selected: [...s.pending.selected],
    members: structuredClone(result.members),
    source: match.source,
  });
  s.pending = null;
  s.selected = [];
  if (result.win && s.round < 2) {
    s.round++;
    s.phase = s.roster.some((m) => m.status !== "dead")
      ? "waiting"
      : "eliminated";
  } else s.phase = result.win ? "champion" : "eliminated";
  refreshNpc(s, now);
  return true;
}
export function readState(storage) {
  const raw = storage.getItem(STATE_KEY);
  if (!raw) return createState();
  const s = JSON.parse(raw);
  if (
    s.version !== 1 ||
    !Array.isArray(s.roster) ||
    s.roster.length !== 3 ||
    !Array.isArray(s.history) ||
    !Number.isInteger(s.revision)
  )
    throw Error(
      "저장 데이터를 읽지 못했습니다. 시험 도구에서 새 대회를 시작할 수 있습니다.",
    );
  if (
    !Array.isArray(s.selected) ||
    !Array.isArray(s.matches) ||
    !Array.isArray(s.teams) ||
    !Array.isArray(s.inventory) ||
    s.roster.some(
      (m) =>
        !person(m.id) ||
        !m.skills ||
        !Array.isArray(m.injuries) ||
        !Number.isFinite(m.hp),
    )
  )
    throw Error(
      "저장 내용이 올바르지 않습니다. 시험 도구에서 새 대회를 시작해 주십시오.",
    );
  return s;
}
export function saveState(storage, s, expected = s.revision, now = Date.now()) {
  const raw = storage.getItem(STATE_KEY);
  if (raw && JSON.parse(raw).revision !== expected)
    throw Error("다른 창에서 저장이 바뀌었습니다. 새로고침 후 이어 주십시오.");
  const next = { ...s, revision: expected + 1, lastSavedAt: now };
  storage.setItem(STATE_KEY, JSON.stringify(next));
  s.revision = next.revision;
  s.lastSavedAt = now;
  return s;
}
