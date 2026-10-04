// Domain, collider metadata and authored mass invariants; no human-motion acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {newRound,RAPIER} from '../harness_m.mjs';
import {configureBladeShapeTrial,applyBladeShapeTrial} from '../../../src/blade_shape_trial.js';
import {inspectWeapon,useVisibleHull} from './contact_geometry_capture.mjs';
const out=process.argv[2];assert(out&&!fs.existsSync(out));
const names=['src/blade_shape_trial.js','src/main.js','src/fighter.js','src/weapons.js','src/weapon_looks.js','tools/sim/experiments/contact_geometry_capture.mjs','tools/sim/experiments/blade_shape_contract.test.mjs','tools/sim/harness_m.mjs','package-lock.json'];
const manifest=()=>Object.fromEntries(names.map(p=>[p,createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const sourceBefore=manifest(),tests=[];
for(const query of ['', 'weapon=qinggang&onehandArm=manual','weapon=sabre&onehandArm=manual&bladeShape=profile','weapon=qinggang&bladeShape=profile','weapon=qinggang&onehandArm=manual&bladeShape=invalid']){
 assert.equal(configureBladeShapeTrial(new URLSearchParams(query)).active,false);tests.push({name:'inactive:'+query,pass:true});
}
const G=newRound({seed:7,weapon:'qinggang',weapon2:'qinggang',skill:0,onFighter:f=>{f.onehandArmModel='manual';}});
try{
 const before=inspectWeapon(G.player),enemy=inspectWeapon(G.enemy);
 for(const info of [{active:false,model:'profile'},{active:true,model:'box'}]){
  assert.equal(applyBladeShapeTrial(info,G.player,RAPIER),false);assert.deepEqual(inspectWeapon(G.player),before);
 }
 assert.equal(applyBladeShapeTrial({active:true,model:'profile'},G.enemy,RAPIER),false);assert.deepEqual(inspectWeapon(G.enemy),enemy);
 G.player.onehandArmModel='legacy';assert.equal(applyBladeShapeTrial({active:true,model:'profile'},G.player,RAPIER),false);assert.deepEqual(inspectWeapon(G.player),before);G.player.onehandArmModel='manual';
 tests.push({name:'default/A/legacy-arm/enemy-shape-unchanged',pass:true});
 const diagnostic=useVisibleHull(G.player,RAPIER);assert.equal(diagnostic.newShapeType,9);assert.equal(diagnostic.oldShapeType,1);assert.deepEqual(inspectWeapon(G.enemy),enemy);
 tests.push({name:'production-profile-preserves-body-mass-inertia-state-grip-and-collider-metadata',pass:true,diagnostic});
 const once=inspectWeapon(G.player);assert(applyBladeShapeTrial({active:true,model:'profile'},G.player,RAPIER));assert.deepEqual(inspectWeapon(G.player),once);
 tests.push({name:'repeat-shape-application-preserves-state',pass:true});
}finally{G.eventQueue.free();G.world.free();}
const sourceAfter=manifest();assert.deepEqual(sourceAfter,sourceBefore);
fs.writeFileSync(out,JSON.stringify({pass:true,sourceStable:true,sourceBefore,sourceAfter,tests,scope:'Production API domain/mass/metadata fixtures at creation. No native steps or motion/contact efficacy.'},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({pass:true,tests:tests.length}));
