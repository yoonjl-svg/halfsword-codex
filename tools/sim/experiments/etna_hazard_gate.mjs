// Native sensor boundary cases and production Fighter death. Setup poses/impulses
// are explicit fixtures; this is not a player success-rate or visual-quality test.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { RAPIER as R, newRound, DT } from '../harness_m.mjs';
import { GROUND_GROUPS } from '../../../src/fighter.js';
import { ETNA, createArenaGround, applyTerrainHazards } from '../../../src/etna_ground.js';
const out=process.argv[2];assert(out?.startsWith('/tmp/'));const cases=[];let failure;
function check(name,fn){fn();cases.push(name);}
function fixture({above=0,part='footF',kind='body',detached=false}={}){
 const world=new R.World({x:0,y:0,z:0}),env=createArenaGround(R,world,GROUND_GROUPS,{stageId:'etna',walls:false});
 const body=world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0,ETNA.lavaLevel+.02+above,6));
 const col=world.createCollider(R.ColliderDesc.cuboid(.02,.02,.02).setCollisionGroups(GROUND_GROUPS),body);
 const f={alive:true,bodies:{[part]:body},revival:{active:true},detachedParts:new Set(detached?[part]:[]),die(cause,final){this.alive=false;this.causeOfDeath=cause;this.final=final;}};
 const info=new Map([[col.handle,{fighter:f,kind,part,body}]]);world.step();const events=applyTerrainHazards(env,info);return{world,env,f,events};
}
try{
 for(const [name,opts,dead] of [['above surface',{above:.001},false],['foot intersects surface',{above:-.001},true],['head contacts',{above:-.01,part:'head'},true],['weapon only',{above:-.01,kind:'weapon',part:'blade'},false],['detached arm',{above:-.01,part:'farmO',detached:true},false]]) check(name,()=>{const q=fixture(opts);try{assert.equal(!q.f.alive,dead);if(dead){assert.equal(q.f.causeOfDeath,'용암');assert(q.f.final);assert.equal(q.f.revival,null);assert.equal(applyTerrainHazards(q.env,new Map()).length,0);}}finally{q.world.free();}});
 check('ordinary stage has no lava sensor',()=>{const w=new R.World({x:0,y:-9.81,z:0});try{const e=createArenaGround(R,w,GROUND_GROUPS);assert.equal(e.terrain,null);assert.equal(e.lava,null);assert.deepEqual(applyTerrainHazards(e,new Map()),[]);}finally{w.free();}});
 for(const who of ['player','enemy'])check('actual '+who+' lava bypasses revival',()=>{const g=newRound({seed:24,stageId:'etna',playerZ:who==='player'?6:0,enemyZ:who==='enemy'?6:0,revive:{count:1},revive2:{count:1}});try{for(let i=0;i<3;i++)g.step();const f=g[who];assert(!f.alive);assert.equal(f.causeOfDeath,'용암');assert.equal(f.revival,null);assert(f.terrainDeath.part);assert(g[who==='player'?'enemy':'player'].alive);}finally{g.world.free();g.eventQueue.free();}});
 check('native downhill walking enters lava; safe spawn stays alive',()=>{const g=newRound({seed:31,stageId:'etna',heading:-Math.PI/2,weapon:'longsword'});try{g.park();g.faceP={x:-2.8,y:0,z:100};const f=g.player;let diedAt=null;for(let i=0;i<1200;i++){g.before=()=>f.move.set(0,i<240?0:1);g.step();if(i<240)assert(f.alive);if(!f.alive){diedAt=i*DT;break;}}assert(diedAt!==null);assert.equal(f.causeOfDeath,'용암');assert(f.terrainDeath.position.z>=ETNA.lavaEdgeZ-.3);cases.push({walkDeathSeconds:diedAt,part:f.terrainDeath.part});}finally{g.world.free();g.eventQueue.free();}});
}catch(e){failure={message:e.message,stack:e.stack};process.exitCode=1;}
const sources=Object.fromEntries(['src/etna_ground.js','src/main.js','src/fighter.js','src/gait.js','tools/sim/harness_m.mjs', 'tools/sim/experiments/etna_hazard_gate.mjs'].map(p=>[p,createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
fs.writeFileSync(out,JSON.stringify({pass:!failure,completedUTC:new Date().toISOString(),cases,failure,sources},null,2));console.log(JSON.stringify({pass:!failure,cases,failure}));
