// Read-only catalog: the existing game tables remain the source of truth.
import { WEAPON_LIST, RETIRED_WEAPONS, getWeapon, TIER_LABEL, weaponSpecText } from './weapons.js';
import { LOBBY_ARMORS, armorSlot } from './lobby_equipment.js';
import { CHARACTERS_BY_ID } from './characters.js';
import { TRADITIONS, traditionOf } from './schools.js';
import { portraitSrc } from './portraits.js';

export const CATALOG_SCHOOLS = Object.entries(TRADITIONS).map(([id, t]) => ({ id, name: t.nameKo }));
export const schoolName = id => TRADITIONS[id]?.nameKo ?? '선택에 따라';
export const CATALOG_ITEMS = Object.freeze([
  ...WEAPON_LIST.map(w => ({ id: w.id, kind: 'weapon', name: w.nameKo, tier: w.tier, school: traditionOf(w),
    image: `ui/weapons/${w.id}.webp`, illustration: `ui/encyclopedia/items/${w.id}.${w.id === 'druid_whip' ? 'png' : 'webp'}`, description: w.desc ?? '', ability: w.ability ?? '',
    retired: RETIRED_WEAPONS.has(w.id), spec: w })).sort((a, b) => Number(a.retired) - Number(b.retired)),
  ...LOBBY_ARMORS.map(a => ({ id: a.id, kind: 'armor', name: a.nameKo, tier: a.tier, school: '',
    image: a.thumbnail, illustration: `ui/encyclopedia/items/${a.id}.webp`, description: a.description, ability: a.ability, slot: armorSlot(a.id) })),
]);
const characters = Object.values(CHARACTERS_BY_ID);
const orderedCharacters = [], seen = new Set();
function appendCharacter(c) {
  if (seen.has(c.id)) return;
  seen.add(c.id); orderedCharacters.push(c);
  for (const child of characters.filter(v => v.variantOf === c.id)) appendCharacter(child);
}
characters.filter(c => !c.variantOf).forEach(appendCharacter);
characters.forEach(appendCharacter); // Orphaned or nested variants must not disappear.
export const CATALOG_CHARACTERS = Object.freeze([
  { id: 'player', kind: 'player', name: '플레이어', image: portraitSrc('player', 'pixel'), model: 'ui/encyclopedia/characters/player.webp', school: '', description: '' },
  ...orderedCharacters,
].map(c => c.id === 'player' ? c : ({ id: c.id, kind: c.variantOf ? 'alter' : 'base', name: c.name,
  image: portraitSrc(c.id, 'pixel'), model: `ui/encyclopedia/characters/${c.id}.webp`, school: traditionOf(getWeapon(c.weapon)), epithet: c.epithet,
  age: c.age, origin: c.origin, description: c.backstory ?? '', proficiency: c.ai?.proficiency,
  weapon: c.weapon, variantOf: c.variantOf, reviewOnly: !!c.reviewOnly })));

const normal = text => String(text ?? '').normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/\s+/g, '');
export function filterCatalog(entries, { query = '', kind = '', school = '', tier = '' } = {}) {
  const q = normal(query);
  return entries.filter(e => (!kind || e.kind === kind) && (!school || e.school === school) && (!tier || e.tier === tier)
    && (!q || normal(`${e.name} ${e.epithet ?? ''} ${schoolName(e.school)} ${TIER_LABEL[e.tier] ?? ''}`).includes(q)));
}
const measurements = new Map();
export function catalogMeasurements(entry) {
  if (entry.kind !== 'weapon') return '';
  if (!measurements.has(entry.id)) measurements.set(entry.id, weaponSpecText(entry.spec));
  return measurements.get(entry.id);
}
