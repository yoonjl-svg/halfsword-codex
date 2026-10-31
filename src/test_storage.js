// 생사전 시험판 저장 가르기 (사장님 10/29 17:5x — 시험 페이지는 본 게임 저장을 건드리지 않는다 · docs/design/saengsa_2026-10-29.md §시험판)
//  시험판 빌드(config SAENGSA.testMode — `VITE_SAENGSA_TEST=1`)에서만 켜진다. game_entry.js 의 첫 들여오기라 다른 모듈이 저장을 읽기 전에 건다.
//  같은 출처(github.io)의 본 게임과 localStorage 를 함께 쓰므로, 이 페이지의 localStorage 읽기 · 쓰기를 모두 TEST_PREFIX 를 붙인 열쇠로 돌린다
//   (Storage.prototype 의 getItem · setItem · removeItem · key · length · clear — localStorage 일 때만 · sessionStorage 는 그대로).
//   그래서 본 게임의 금화 · 스킬트리 · 장비 · 여정 · 생사전 저장(열쇠 앞이 붙지 않은 것)은 읽지도 고치지도 않는다. clear() 도 시험판 열쇠만 지운다.
//  시험판 저장이 비었으면(처음 열 때) 시험판 저장에만: 금화 SAENGSA.testCoins · 정복자 호칭(생사전 입장 조건 — 사장님 10/29 18:2x) · 가진 무기 SAENGSA.testWeapons(배정을 해 보게)
//   (모두 확인 전 — 무기 줄은 owned_weapons.js 의 상점 꼴 receipt 'weapon:<id>' · kind 'item').
import { SAENGSA } from './config.js';

export const TEST_PREFIX = 'stillness.test.';

function installTestStorage() {
  let ls = null;
  try { ls = globalThis.localStorage ?? null; } catch { return false; }
  if (!ls || typeof Storage === 'undefined') return false;
  const P = Storage.prototype;
  if (P.__stillnessTest) return true;
  const { getItem, setItem, removeItem, key, clear } = P;
  const lengthOf = Object.getOwnPropertyDescriptor(P, 'length').get;
  const isLocal = (s) => s === ls;
  const testKeys = (s) => {
    const out = [];
    for (let i = 0, n = lengthOf.call(s); i < n; i++) {
      const k = key.call(s, i);
      if (k != null && k.startsWith(TEST_PREFIX)) out.push(k);
    }
    return out;
  };
  P.getItem = function (k) { return getItem.call(this, isLocal(this) ? TEST_PREFIX + k : k); };
  P.setItem = function (k, v) { return setItem.call(this, isLocal(this) ? TEST_PREFIX + k : k, v); };
  P.removeItem = function (k) { return removeItem.call(this, isLocal(this) ? TEST_PREFIX + k : k); };
  P.key = function (i) {
    if (!isLocal(this)) return key.call(this, i);
    const k = testKeys(this)[i];
    return k == null ? null : k.slice(TEST_PREFIX.length);
  };
  P.clear = function () {
    if (!isLocal(this)) return clear.call(this);
    for (const k of testKeys(this)) removeItem.call(this, k);
  };
  Object.defineProperty(P, 'length', { configurable: true, enumerable: true, get() { return isLocal(this) ? testKeys(this).length : lengthOf.call(this); } });
  Object.defineProperty(P, '__stillnessTest', { value: true });
  return true;
}

if (SAENGSA.testMode && installTestStorage()) {
  const [{ PROGRESS_KEY, update }, { titleName }, { weaponReceipt }] = await Promise.all([import('./lobby_progress.js'), import('./title_rules.js'), import('./owned_weapons.js')]);
  let fresh = false;
  try { fresh = localStorage.getItem(PROGRESS_KEY) == null; } catch { /* 저장이 막힘 */ }
  if (fresh) {
    update((d) => {
      d.coins = SAENGSA.testCoins;
      const event = SAENGSA.entry.title;
      if (!d.titles.some((x) => x.event === event)) d.titles.push({ event, name: titleName(event), seen: true }); // 알림 창 없이
      for (const id of SAENGSA.testWeapons) if (!d.acquisitions.some((a) => a.receipt === weaponReceipt(id))) d.acquisitions.push({ receipt: weaponReceipt(id), kind: 'item' });
      return true;
    });
  }
}
