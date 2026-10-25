import assert from 'node:assert/strict';import fs from 'node:fs';
import {WEAPONS,isOneHandSword}from '../../../src/weapons.js';import{WEAPON_ABILITY,JOINTS,SECRET}from '../../../src/config.js';import{duelOneHandMult}from '../../../src/combat.js';
assert(isOneHandSword(WEAPONS.pappenheimer));assert(WEAPONS.dartagnan.duelOneHand);assert.equal(WEAPON_ABILITY.duelOneHand,1.15);assert.equal(JOINTS.wristPronate,1);assert.equal(JOINTS.swivelHuman,1);
const attacking={weapon:WEAPONS.dartagnan},defending={weapon:WEAPONS.pappenheimer,armed:true};assert.equal(duelOneHandMult(attacking,defending),1.15);defending.armed=false;assert.equal(duelOneHandMult(attacking,defending),1);
const r={pappenheimerIsOneHandSword:true,dartagnanMultiplier:WEAPON_ABILITY.duelOneHand,duelAgainstArmed:1.15,duelAgainstDisarmed:1,wristPronate:JOINTS.wristPronate,swivelHuman:JOINTS.swivelHuman,gonoSen:{enter:SECRET.gnsEnter,enterAI:SECRET.gnsEnterAI,long:SECRET.gnsLong,wary:SECRET.gnsWary}};
fs.writeFileSync(new URL('./current-integration.json',import.meta.url),JSON.stringify(r,null,2));console.log(r);
