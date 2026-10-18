import assert from 'node:assert/strict';
import {installForceCap} from './contact_force_cap.mjs';
import {writeFileSync} from 'node:fs';
const results=[];
for(const floor of [.2])for(const hold of [.60]){
 const observed=[];
 const f={alive:true,armed:true,state:'stand',stamina:{time:3,attackId:7},flowArmScale:.8,
  joints:[{name:'uarmS',k:320,d:26,max:80},{name:'farmS',k:400,d:38,max:80},{name:'uarmO',k:80,d:12,max:40},{name:'farmO',k:60,d:8,max:30},{name:'chest',k:500,d:40,max:120}],
  weaponCfg:{maxAimTorque:22,aimStiffness:70,aimDamping:11,wristVmax:34},
  driveJoints(){observed.push(structuredClone(this.joints));},driveSword(){observed.push({...this.weaponCfg});}};
 const before=JSON.stringify([f.joints,f.weaponCfg]),c=installForceCap(f,{floor,hold,recovery:.40});assert(c.begin({index:0}));assert.equal(JSON.stringify([f.joints,f.weaponCfg]),before);assert(!c.begin({index:0}));
 f.stamina.time=3+hold/2;assert.equal(c.scale(),floor);f.driveJoints();f.driveSword();
 assert.equal(JSON.stringify([f.joints,f.weaponCfg]),before);
 for(let i=0;i<5;i++){
  assert.equal(observed[0][i].k,f.joints[i].k);assert.equal(observed[0][i].d,f.joints[i].d);
  assert.equal(observed[0][i].max,f.joints[i].max*(i<4?floor:1));
 }
 assert.equal(observed[1].maxAimTorque,22*floor);
 for(const k of ['aimStiffness','aimDamping','wristVmax'])assert.equal(observed[1][k],f.weaponCfg[k]);
 assert.equal(f.flowArmScale,.8);
 f.stamina.time=3+hold+.20;assert(Math.abs(c.scale()-(1+floor)/2)<1e-10);
 f.stamina.time=3+hold+.40+1e-9;assert.equal(c.scale(),1);assert(!c.begin({index:0}));
 f.stamina.time+=.13;f.stamina.attackId++;assert(c.begin({index:0}));f.armed=false;assert.equal(c.scale(),1);
 results.push({floor,hold,recovery:.40,gainsAndDampingAndSpeedUnchanged:true,onlyArmAndWristCeilingsChanged:true,restoredFields:true,noSameAttackRepeat:true,disabledWhenUnarmed:true});
}
writeFileSync('docs/research/iberian_force80_playtest_20261019/checks.json',JSON.stringify(results,null,2));console.log('PASS exact 80% decrease / .60 hold / .40 recovery: cap scope, gains, damping, speed, field restoration, timing and duplicate guards');
