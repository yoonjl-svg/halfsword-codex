import assert from 'node:assert/strict';
import { configureCombatDefaults } from '../../../src/combat_defaults.js';
import { configureSwordsmanshipDefault, swordsmanshipDefaultSupportsWeapon } from '../../../src/swordsmanship_default.js';
import { WEAPON_LIST } from '../../../src/weapons.js';
const legacy = {stance:'legacy',cut:'legacy',roll:'legacy'};
const sharp = {stance:'fresh',cut:'centerline',roll:'bounded'};
const blunt = {stance:'fresh',cut:'legacy',roll:'bounded'};
const gun = {stance:'fresh',cut:'legacy',roll:'legacy'};
const ordinary = configureSwordsmanshipDefault(new URLSearchParams());
let checks = 0;
const capabilities = [
  [{edged:true,gun:false},sharp], [{edged:false,gun:false},blunt],
  [{edged:false,gun:true},gun], [{edged:true,gun:true},gun],
  [{edged:true,trialOnly:true},legacy],
];
for(const [capability,expected] of capabilities) {
  for(const id of ['future-weapon','longsword','pistol']) {
    const weapon={...capability,id};
    assert.deepEqual(configureCombatDefaults(ordinary,weapon),expected);checks++;
    assert.deepEqual(configureCombatDefaults({active:false},weapon),legacy);checks++;
  }
}
assert.deepEqual(configureCombatDefaults(ordinary,null),legacy);checks++;
const counts={fresh:0,centerline:0,bounded:0,v2:0};
for (const weapon of WEAPON_LIST) {
  const actual=configureCombatDefaults(ordinary,weapon);
  const expected=weapon.gun?gun:weapon.edged?sharp:blunt;
  assert.deepEqual(actual,expected);checks++;
  assert.deepEqual(configureCombatDefaults(ordinary,{...weapon,id:'unlisted-future-id'}),actual);checks++;
  assert.deepEqual(configureCombatDefaults(ordinary,{...weapon,trialOnly:true}),legacy);checks++;
  counts.fresh+=actual.stance==='fresh';counts.centerline+=actual.cut==='centerline';counts.bounded+=actual.roll==='bounded';
  counts.v2+=swordsmanshipDefaultSupportsWeapon(weapon);
  for (const query of ['recutV2=baseline','recutV2=bounded','recoveryContactV2=combined','contactV2=legacy','stanceV2=fresh','gravityV2=plus15','combatTrial=integrated','swordsmanship=legacy','swordsmanship=bad','limbTrial=1']) {
    assert.deepEqual(configureCombatDefaults(configureSwordsmanshipDefault(new URLSearchParams(query)),weapon),legacy);checks++;
  }
}
assert.deepEqual(counts,{fresh:16,centerline:11,bounded:15,v2:14});checks++;
for(const id of ['monohoshizao','lightsaber']) {
 const weapon=WEAPON_LIST.find(w=>w.id===id);
 assert.equal(swordsmanshipDefaultSupportsWeapon(weapon),id==='monohoshizao');
 assert.deepEqual(configureCombatDefaults(ordinary,weapon),sharp);checks+=2;
}
console.log(JSON.stringify({pass:true,checks,counts,physicsExecuted:false,scope:'capability contracts, identifier independence, roster coverage and research isolation; monohoshizao v2 adopted'}));
