// 대기실의 장착 표시. 여정의 무기 카드/이어하기 저장과 별도로 유지한다.
export const LOBBY_ITEMS = Object.freeze(['tree_branch', 'longsword']);
export const EQUIPMENT_KEY = 'stillness.fork.lobbyEquipment.v1';
let equipped = null;
export function readLobbyEquipment() {
  try {
    const value = JSON.parse(localStorage.getItem(EQUIPMENT_KEY));
    if (value?.version === 1) equipped = LOBBY_ITEMS.includes(value.weapon) ? value.weapon : null;
  } catch { /* 저장 불가 시 이번 실행 동안 유지한다. */ }
  return equipped;
}
export function saveLobbyEquipment(id) {
  if (id !== null && !LOBBY_ITEMS.includes(id)) return false;
  equipped = id;
  try { localStorage.setItem(EQUIPMENT_KEY, JSON.stringify({ version: 1, weapon: id })); return true; }
  catch { return false; }
}
