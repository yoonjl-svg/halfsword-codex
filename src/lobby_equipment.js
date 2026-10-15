// 대기실의 장착 표시. 여정의 무기 카드/이어하기 저장과 별도로 유지한다.
export const LOBBY_ITEMS = Object.freeze(['tree_branch', 'longsword']);
export const LOBBY_ARMOR = Object.freeze({ id: 'kettle', nameKo: '투구', rarity: '커먼', description: '여행자의 필수품. 뒤집으면 요리를 할 수 있다.', thumbnail: 'ui/armor/kettle.webp' });
export const EQUIPMENT_KEY = 'stillness.fork.lobbyEquipment.v1';
const ARMOR_KEY = 'stillness.fork.lobbyArmor.v1';
let equipped = null;
let armor = 'kettle';
export function readLobbyArmor() {
  try {
    const value = JSON.parse(localStorage.getItem(ARMOR_KEY));
    if (value?.version === 1 && [null, LOBBY_ARMOR.id].includes(value.armor)) armor = value.armor;
  } catch { /* 이번 실행 동안 유지한다. */ }
  return armor;
}
export function saveLobbyArmor(id) {
  if (id !== null && id !== LOBBY_ARMOR.id) return false;
  armor = id;
  try { localStorage.setItem(ARMOR_KEY, JSON.stringify({ version: 1, armor: id })); return true; }
  catch { return false; }
}
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
