// 대기실 레벨·호칭·금화·머리 (샛별 저장소 3b280a1b): 레벨 = 1 + 얻은 물건·스킬북 수. 시작 지급품(나뭇가지 · 방어구 kettle)은 세지 않는다.
// 전리품/구매가 생기면 획득 사건마다 고유 receipt 를 넘긴다. 같은 사건을 재처리해도 중복 상승하지 않으며, 장착/해제는 레벨에 영향이 없다.
// 10/16 (docs/import/lobby_fix_2026-10-16.md §6): 스킬북을 금화로 산다(purchase — 사장님 04:1x '금화나 머리를 얻으면 교환해서 개방') · 산 책은 receipt 'skillbook:<유파>:<급>' 으로
//  acquisitions 에 남는다(가진 책 = 이것 하나 — 금화와 같은 저장에 같이 써서 반쯤 산 채로 남지 않는다) · 이미 받은 인장을 금화로(seal_coins.js addCoins).
//  금화 벌기 (사장님 결정 04:3x '승리시 랜덤으로 벌어. 5~15원 중 랜덤. 패배시 1~5원 감소'): 첫 화면·대기실 여정의 판 끝마다 journeyCoins — 0 아래로는 안 내려간다.
//  머리 (사장님 결정 04:3x '적의 머리를 베면 1개씩 주는 재화'): 같은 여정에서 상대의 목을 베면 1 (main.js — COMBAT_HOOKS.onDecapitate · 한 상대에 한 번, awardHead).
//   머리로 무엇을 사는지는 사장님 확인 전 (skill_books.js BOOK_HEAD_PRICE null). 디자인 보기용 주소 `?coins=N`(game_entry.js setCoins).
//  호칭 (사장님 10/16 15:3x ⑥ "호칭 시스템을 나중에 추가할 거라서 '여행자'는 내림박스 같은 기능을 만들어서 호칭 선택할 수 있게 해" · 16:0x "… 이미 가진 호칭인 여행자가 보이고"
//   — docs/import/ui_unify_2026-10-16.md §5): 기본 호칭 '여행자'는 늘 가짐 · 얻은 호칭은 titles(unlockEventTitle — 앞으로 호칭 제도가 부른다) · 고른 호칭은 title(selectTitle).
//   호칭을 새로 지어 넣지 않는다(지금 얻을 수 있는 호칭은 없다).
import { normalizeWander, wanderReward } from './wander_rules.js';
export const PROGRESS_KEY = 'stillness.lobby.progress.v1';
export const DEFAULT_TITLE = '여행자';
let session = { acquisitions: [], coins: 100, heads: 0, titles: [], title: DEFAULT_TITLE, wander: normalizeWander(null) };
let pendingSave = null;
const validText = s => typeof s === 'string' && s.length > 0 && s.length <= 160;
const count = n => Number.isSafeInteger(n) && n >= 0;
export function readProgress() {
  try {
    const value = JSON.parse(pendingSave ?? localStorage.getItem(PROGRESS_KEY));
    if (value?.version === 1) {
      const seen = new Set();
      const acquisitions = (Array.isArray(value.acquisitions) ? value.acquisitions : []).filter(a => {
        if (!a || !validText(a.receipt) || !['item', 'skillbook'].includes(a.kind) || seen.has(a.receipt)) return false;
        seen.add(a.receipt); return true;
      }).map(({receipt, kind}) => ({receipt, kind}));
      const titles = (Array.isArray(value.titles) ? value.titles : []).filter(t => t && validText(t.event) && validText(t.name));
      session = { acquisitions, titles, title: titles.some(t => t.name === value.title) ? value.title : DEFAULT_TITLE,
        coins: count(value.coins) ? value.coins : 100, heads: count(value.heads) ? value.heads : 0, wander: normalizeWander(value.wander) };
    }
  } catch { /* 이번 실행 동안 유지한다. */ }
  return { ...structuredClone(session), level: 1 + session.acquisitions.length };
}
function save() {
  const text = JSON.stringify({ version: 1, ...session });
  try { localStorage.setItem(PROGRESS_KEY, text); pendingSave = null; return true; }
  catch { pendingSave = text; return false; }
}

// 무대 클리어와 방랑 저장. 보상·방랑 판 상태를 같은 localStorage 항목에 써서
// 새로고침/대기실 복귀/다시 겨루기로 같은 보스 보상을 두 번 받지 않는다.
export function recordCampaignStage(stage, required) {
  readProgress();
  if (!required.includes(stage)) return false;
  const w = session.wander;
  if (!w.cleared.includes(stage)) w.cleared.push(stage);
  w.unlocked ||= required.every(s => w.cleared.includes(s));
  save();
  return w.unlocked;
}
export function migrateCampaignStages(checkpoint, clears, required) {
  readProgress();
  const w = session.wander;
  if (w.legacyChecked) return;
  w.legacyChecked = true;
  // 기존 순차 여정의 저장 위치 앞 무대만 증거로 인정한다.
  // 누적 29승은 Stage 1을 29번 반복한 것일 수도 있어 그것만으로 해금하지 않는다.
  const index = required.indexOf(checkpoint?.stage);
  if (index > 0 && clears >= index) w.cleared = [...new Set([...w.cleared, ...required.slice(0, index)])];
  w.unlocked ||= required.every(s => w.cleared.includes(s));
  save();
}
export function ensureWanderRun(makeEncounter) {
  readProgress();
  if (!session.wander.unlocked) return null;
  const old = session.wander.run;
  if (old?.status === 'active') return structuredClone(old);
  const next = makeEncounter();
  session.wander.run = {
    id: old?.status === 'won' ? old.id : (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`),
    round: old?.status === 'won' ? old.round + 1 : 1,
    wins: old?.status === 'won' ? old.wins : 0,
    ...next, status: 'active', weapon: null, cards: null,
    lastWeapon: old?.status === 'won' ? old.weapon || old.lastWeapon : null,
    headTaken: false, reward: null,
  };
  save();
  return structuredClone(session.wander.run);
}
export function saveWanderLoadout({ weapon, cards, lastWeapon }) {
  readProgress();
  const run = session.wander.run;
  if (!run || run.status !== 'active') return false;
  Object.assign(run, { weapon, cards, lastWeapon });
  return save();
}
export function awardWanderHead() {
  readProgress();
  const run = session.wander.run;
  if (!run || run.headTaken || run.status !== 'active') return false;
  run.headTaken = true;
  session.heads += 2;
  save();
  return true;
}
export function settleWander(win, roll = rollInt) {
  readProgress();
  const run = session.wander.run;
  if (!run || run.status !== 'active') return null;
  const reward = wanderReward(win, run.foe, roll(...(win ? JOURNEY_COINS.win : JOURNEY_COINS.loss)));
  const before = session.coins;
  session.coins = Math.max(0, before + reward.coins);
  session.heads += reward.heads;
  run.status = win ? 'won' : 'lost';
  if (win) run.wins++;
  run.reward = { coins: session.coins - before, heads: reward.heads + (run.headTaken ? 2 : 0), bonus: reward.bonus };
  save();
  return structuredClone(run.reward);
}
export function recordAcquisition({ receipt, kind, source }) {
  readProgress();
  if (source === 'starter' || !validText(receipt) || !['item', 'skillbook'].includes(kind) || session.acquisitions.some(a => a.receipt === receipt)) return false;
  session.acquisitions.push({ receipt, kind }); save(); return true;
}
/** 이 receipt 를 이미 얻었나 (스킬북 'skillbook:<유파>:<급>') */
export function owns(receipt) {
  return readProgress().acquisitions.some(a => a.receipt === receipt);
}
/**
 * 사기: 금화 price 를 내고 receipt 를 얻는다 — 한 번의 저장(금화·얻은 것 같이). 이미 가졌거나 금화가 모자라면 아무것도 안 바뀐다.
 *  돌려줌 { ok, saved, why } — why: 'owned' · 'coins' · 'bad'. 레벨 = 1 + 얻은 수라 스킬북 한 권마다 Lv +1 (지금 레벨 규칙 그대로)
 */
export function purchase({ receipt, kind, price }) {
  readProgress();
  if (!validText(receipt) || !['item', 'skillbook'].includes(kind) || !count(price)) return { ok: false, saved: false, why: 'bad' };
  if (session.acquisitions.some(a => a.receipt === receipt)) return { ok: false, saved: false, why: 'owned' };
  if (session.coins < price) return { ok: false, saved: false, why: 'coins' };
  session.coins -= price;
  session.acquisitions.push({ receipt, kind });
  return { ok: true, saved: save(), why: null };
}
/** 금화 더하기 (인장 → 금화 바꾸기 — seal_coins.js). 돌려줌: 저장했나 */
export function addCoins(amount) {
  readProgress();
  if (!count(amount)) return false;
  session.coins += amount;
  return save();
}
/** 금화를 이 값으로 (디자인 보기용 주소 `?coins=N` — game_entry.js) */
export function setCoins(amount) {
  readProgress();
  if (!count(amount) || amount > 1e7) return false;
  session.coins = amount;
  return save();
}
// ── 여정 판 끝 금화 · 머리 (사장님 결정 10/16 04:3x) ──
export const JOURNEY_COINS = Object.freeze({ win: [5, 15], loss: [1, 5] }); // 이기면 +5~15 · 지면 −1~5 (정수, 양 끝 포함)
/** [lo, hi] 정수 하나 — 게임 난수(Math.random — AI 가 쓰는 흐름)를 건드리지 않게 crypto 로 */
export function rollInt(lo, hi) {
  const span = hi - lo + 1;
  const c = globalThis.crypto;
  const u = c?.getRandomValues ? c.getRandomValues(new Uint32Array(1))[0] / 4294967296 : Math.random();
  return lo + Math.min(span - 1, Math.floor(u * span));
}
/**
 * 판 끝 금화 (main.js checkRoundEnd — 첫 화면·대기실 여정만): 이기면 +rollInt(5, 15) · 지면 −rollInt(1, 5), 0 아래로는 안 내려간다.
 *  돌려줌 { delta: 실제로 바뀐 값(지면 음수 — 금화가 모자라면 그만큼만), coins: 바뀐 뒤 금화, saved }
 */
export function journeyCoins(win, roll = rollInt) {
  readProgress();
  const [lo, hi] = win ? JOURNEY_COINS.win : JOURNEY_COINS.loss;
  const amount = roll(lo, hi);
  const before = session.coins;
  session.coins = win ? before + amount : Math.max(0, before - amount);
  return { delta: session.coins - before, coins: session.coins, saved: save() };
}
/** 머리 더하기 (상대의 목을 벤 판 — main.js). 돌려줌: 저장했나 */
export function addHeads(amount = 1) {
  readProgress();
  if (!count(amount)) return false;
  session.heads += amount;
  return save();
}
/** 이 상대의 머리를 처음 벤 때만 1 (한 상대에 한 번 — 같은 몸이 두 번 알려도) · 돌려줌: 이번에 더했나 */
export function awardHead(foe) {
  if (!foe || foe.headTaken) return false;
  foe.headTaken = true;
  addHeads(1);
  return true;
}
// ── 호칭 ──
/**
 * 호칭 얻기 (앞으로 호칭 제도가 부른다 — 지금은 부르는 곳 없음): 사건(event)마다 한 번 · 이벤트 조건은 해당 이벤트에서 판정한다.
 *  호칭은 레벨/유파로 자동 해금하지 않는다. 기본 호칭 '여행자'는 얻을 것이 아니라 늘 가진 것. 돌려줌: 이번에 얻었나
 */
export function unlockEventTitle(event, name) {
  readProgress();
  if (!validText(event) || !validText(name) || name === DEFAULT_TITLE || session.titles.some(t => t.event === event)) return false;
  session.titles.push({ event, name }); save(); return true;
}
/** 가진 호칭 — 기본 '여행자' 먼저, 그 뒤 얻은 호칭(얻은 차례 · 같은 이름은 하나). 대기실 호칭 내림 상자가 이것만 보인다 (사장님 16:0x '이미 가진 호칭') */
export function titleOptions() {
  return [...new Set([DEFAULT_TITLE, ...readProgress().titles.map(t => t.name)])];
}
/** 호칭 고르기: 가진 호칭만 · 고른 것은 title 에 저장. 돌려줌 { ok, saved } (저장 못 하면 이번 실행 동안 유지) */
export function selectTitle(name) {
  if (!titleOptions().includes(name)) return { ok: false, saved: false };
  session.title = name;
  return { ok: true, saved: save() };
}
