import { CHARACTERS_BY_ID } from '../characters.js';
import { traditionOf } from '../schools.js';
import { getWeapon } from '../weapons.js';
export const weaponSchool=id=>traditionOf(getWeapon(id));
export const shortName=id=>id==='player'?'여행자':CHARACTERS_BY_ID[id]?.name||id;
export const conditionName=m=>m.status==='dead'?'전투 불능':'부상';
