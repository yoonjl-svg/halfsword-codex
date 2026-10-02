// Reproducible explanation fixtures: current engine laws, not a combat/naturalness score.
import assert from 'node:assert/strict';
import {readFile,writeFile,access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {RAPIER,CONFIG,DT,newRound} from '../harness_m.mjs';
const out=process.argv[2];if(!out)throw Error('Provide a fresh output JSON path');
try{await access(out);throw Error('Refusing evidence overwrite');}catch(e){if(e.code!=='ENOENT')throw e;}
const files=['src/config.js','src/main.js','src/fighter.js','src/weapons.js','tools/sim/harness_m.mjs','tools/sim/experiments/gravity_acceleration_explain.mjs','package-lock.json'];
const hashes=async()=>Object.fromEntries(await Promise.all(files.map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])));
const head=()=>execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const sourceBefore=await hashes(),headBefore=head(),laws=[];
for(const mass of [1,3]){
 const world=new RAPIER.World({x:0,y:CONFIG.PHYSICS.gravity,z:0});world.timestep=DT;
 try{
  const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,10,0));
  world.createCollider(RAPIER.ColliderDesc.ball(.2).setMass(mass),body);body.recomputeMassPropertiesFromColliders();
  const inertia=body.principalInertia(),actualMass=body.mass();
  body.addForce({x:3,y:0,z:0},true);body.addTorque({x:0,y:0,z:.1},true);
  world.step();const first={velocity:body.linvel(),omega:body.angvel(),position:body.translation()};
  for(let step=1;step<120;step++)world.step();
  const actual={velocity:body.linvel(),omega:body.angvel()},seconds=120*DT;
  const expected={vy:CONFIG.PHYSICS.gravity*seconds,vx:3/actualMass*seconds,wz:.1/inertia.z*seconds};
  const errors={vy:actual.velocity.y-expected.vy,vx:actual.velocity.x-expected.vx,wz:actual.omega.z-expected.wz};
  assert.ok(Object.values(errors).every(e=>Math.abs(e)<.001));
  body.resetForces(true);body.resetTorques(true);
  const v0=body.linvel();body.applyImpulse({x:1,y:0,z:0},true);const deltaV=body.linvel().x-v0.x;
  assert.ok(Math.abs(deltaV-1/actualMass)<1e-6);
  laws.push({massKg:actualMass,gravityMps2:CONFIG.PHYSICS.gravity,dtS:DT,seconds,forceN:{x:3,y:0,z:0},torqueNm:{x:0,y:0,z:.1},inertiaKgM2:inertia,first,actual,expected,errors,instantImpulse:{xNs:1,actualDeltaV:deltaV,expectedDeltaV:1/actualMass},pass:true});
 }finally{world.free();}
}
const weapons=[];
for(const weapon of ['longsword','zweihander']){
 const G=newRound({seed:7,weapon,walls:false});
 try{
  const b=G.player.sword;weapons.push({weapon,dynamic:b.isDynamic(),massKg:b.mass(),localCOM:b.localCom(),principalInertiaKgM2:b.principalInertia(),angularDamping:b.angularDamping(),gravityScale:b.gravityScale(),weightN:-CONFIG.PHYSICS.gravity*b.mass(),gravityWorkForOneMeterCOMDropJ:-CONFIG.PHYSICS.gravity*b.mass()});
 }finally{G.eventQueue.free();G.world.free();}
}
const sourceAfter=await hashes(),headAfter=head();assert.deepEqual(sourceAfter,sourceBefore);assert.equal(headAfter,headBefore);
const result={schemaVersion:1,headBefore,headAfter,sourceBefore,sourceAfter,sourceStable:true,pass:true,laws,weapons,scope:'No floor, joints, muscle controllers or damping in isolated sphere fixtures. Actual game weapons inspected at construction. No claim of reproducing held-sword acceleration, combat or perceived realism.'};
await writeFile(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({pass:true,laws,weapons,out}));
