// 스테이지 시작 지점만 저장한다. 해금·설정·전투 중 물리 상태는 이 키에 넣지 않는다.
export const JOURNEY_SAVE_KEY = 'stillness.fork.journey.v1';
export function isDirectGameLink(params) {
  return ['test', 'weapon', 'foe', 'foeWeapon', 'stage', 'hero', 'look', 'lookv'].some(k => params.has(k));
}
const id = value => typeof value === 'string' && /^[a-z0-9_]{1,64}$/.test(value);
export function readJourney(storage) {
  try {
    storage ??= globalThis.localStorage;
    const value = JSON.parse(storage.getItem(JOURNEY_SAVE_KEY));
    if (!value || value.version !== 1 || !id(value.stage)) return null;
    for (const key of ['foe', 'foeWeapon', 'weapon', 'lastWeapon']) if (value[key] != null && !id(value[key])) return null;
    if (value.cards != null && (!Array.isArray(value.cards) || value.cards.length !== 2 || !value.cards.every(id))) return null;
    if ((value.weapon || value.cards) && (!value.foe || !value.foeWeapon)) return null;
    return { stage: value.stage, foe: value.foe ?? null, foeWeapon: value.foeWeapon ?? null, weapon: value.weapon ?? null, lastWeapon: value.lastWeapon ?? null, cards: value.cards ?? null };
  } catch { return null; }
}
export function writeJourney(checkpoint, storage) {
  try { storage ??= globalThis.localStorage; storage.setItem(JOURNEY_SAVE_KEY, JSON.stringify({ ...checkpoint, version: 1 })); return true; }
  catch { return false; }
}
