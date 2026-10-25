import { CHARACTERS_BY_ID } from "../characters.js";
import { getWeapon, WEAPON_LIST } from "../weapons.js";
import { traditionOf } from "../schools.js";
import { LOBBY_ITEMS } from "../lobby_equipment.js";
export const SCHOOLS = ["german", "italian", "iberian", "japanese", "chinese"];
export const SCHOOL_NAMES = {
  german: "독일",
  italian: "이탈리아",
  iberian: "이베리아",
  japanese: "일본",
  chinese: "동방",
};
export const CANDIDATES = [
  "isolde",
  "liao",
  "minami",
  "tome",
  "heinrich",
  "chanda",
  "omari",
  "ratna",
];
export const OWNED_WEAPONS = [...LOBBY_ITEMS];
export const RANDOM_WEAPONS = WEAPON_LIST.filter(
  (w) =>
    ["common", "rare"].includes(w.tier) &&
    SCHOOLS.includes(traditionOf(w)) &&
    !w.gun &&
    !w.flexible,
).map((w) => w.id);
export const weaponName = (id) => getWeapon(id)?.nameKo || id;
export const weaponSchool = (id) => traditionOf(getWeapon(id));
export const person = (id) =>
  id === "player"
    ? {
        id,
        name: "나",
        epithet: "맹약의 주인",
        weapon: "longsword",
        ai: { proficiency: 3 },
      }
    : CHARACTERS_BY_ID[id];
export function shortName(id) {
  const names = {
    player: "나",
    isolde: "이졸데",
    liao: "랴오",
    minami: "미나미",
    tome: "토메",
    heinrich: "하인리히",
    chanda: "찬다",
    omari: "오마리",
    ratna: "라트나",
  };
  return names[id] || person(id)?.name || id;
}

export const conditionName = (m) =>
  m.status === "dead"
    ? m.cause === "기절"
      ? "기절 · 출전 불가"
      : "전사 · 출전 불가"
    : m.injuries.length
      ? m.injuries.slice(0, 2).join(" · ")
      : "부상 없음";
