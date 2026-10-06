import assert from 'node:assert/strict';
import { configureCombatDefaults } from '../../../src/combat_defaults.js';
import { configureSwordsmanshipDefault } from '../../../src/swordsmanship_default.js';
import { WEAPON_LIST } from '../../../src/weapons.js';
const legacy = {stance:'legacy',cut:'legacy',roll:'legacy'};
let checks = 0;
for (const weapon of WEAPON_LIST) {
  const expected = {
    longsword:{stance:'legacy',cut:'centerline',roll:'bounded'},
    qinggang:{stance:'legacy',cut:'legacy',roll:'bounded'},
    zweihander:{stance:'fresh',cut:'centerline',roll:'legacy'},
  }[weapon.id] || legacy;
  assert.deepEqual(configureCombatDefaults(configureSwordsmanshipDefault(new URLSearchParams()),weapon),expected); checks++;
  for (const query of ['recutV2=baseline','recutV2=bounded','recoveryContactV2=combined','contactV2=legacy','stanceV2=fresh','gravityV2=plus15','combatTrial=integrated','swordsmanship=legacy','swordsmanship=bad']) {
    assert.deepEqual(configureCombatDefaults(configureSwordsmanshipDefault(new URLSearchParams(query)),weapon),legacy);checks++;
  }
}
console.log(JSON.stringify({pass:true,checks,physicsExecuted:false,scope:'ordinary resolved weapon scope and explicit research isolation'}));
