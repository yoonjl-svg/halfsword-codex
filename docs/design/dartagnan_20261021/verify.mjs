// Run from the repository root: node docs/design/dartagnan_20261021/verify.mjs
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {WEAPONS as W} from '../../../src/weapons.js';
import {resolveSwordArt} from '../../../src/sword_art.js';
import {schoolOf} from '../../../src/schools.js';
import {LOOKS} from '../../../src/looks.js';
const d=W.dartagnan, r=W.rapier;
assert.equal(r.tier,'common'); assert.equal(d.tier,'epic');
assert.equal(r.power,1); assert.equal(d.power,1.1);
assert.equal(r.fragility,.056); assert.equal(d.fragility,.0104);
// Ignore appearance colour only; compare collider, mass/COM/inertia, blade and local pose.
const physical=w=>w.buildParts(LOOKS.player).map(p=>p.map((x,i)=>i===3?null:x));
assert.deepEqual(physical(d),physical(r));
const mass=d.buildParts(LOOKS.player).reduce((n,p)=>n+p[2][0],0);
assert(Math.abs(mass-1.1)<1e-12);
for(const persona of [null,{school:'dartagnan'}]) {
  const a=resolveSwordArt(d,persona), b=resolveSwordArt(r,persona?{school:'rapier'}:null);
  assert.equal(a.tradition,'italian');
  for(const key of ['table','measure','grip','parry','tech','offArm','motion']) {
    assert.notEqual(a[key],undefined,key);
    assert.deepEqual(a[key],b[key],key);
  }
}
assert.equal(schoolOf('dartagnan').tradition,'italian');
const result={physicalPartsIdentical:true,playerAndAIFamily:'italian',power:{rapier:r.power,dartagnan:d.power},fragility:{rapier:r.fragility,dartagnan:d.fragility},massKg:mass,bladeLength:d.bladeLength,registered:Object.keys(W).length};
writeFileSync(new URL('./contracts.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(result);
