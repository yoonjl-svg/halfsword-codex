import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {newRound,RAPIER,DT,THREE} from '../harness_m.mjs';
import {GROUND_GROUPS} from '../../../src/fighter.js';
import {configureWetlandMovement} from '../../../src/wetland_ground.js';
import {configureStageObstacle,clampStageCamera,BEAR_NAVIGATION,routeAroundStageObstacle} from '../../../src/arena_obstacle.js';
import {CHARACTERS_BY_ID} from '../../../src/characters.js';
const out=process.argv[2];assert(out?.startsWith('/tmp/'));
const report={pass:false,checks:[],runs:[],failure:null};
const check=(name,value)=>{assert(value,name);report.checks.push(name);};
const close=g=>{g.player.clearLoose();g.enemy.clearLoose();g.eventQueue.free();g.world.free();};
try{
 // Reproduce route-endpoint and revive-hold regressions using the production helper.
 const fake=(x,z,move=[0,-.6],target={x:-2.8,z:0})=>({me:{alive:true,state:'stand',heading:0,index:1,arenaObstacle:BEAR_NAVIGATION,move:new THREE.Vector2(...move),bodies:{pelvis:{translation:()=>({x,z})}}},foe:{alive:true,bodies:{pelvis:{translation:()=>target}}}});
 const revive=fake(2.8,0);revive.me.revival={phase:'stand'};routeAroundStageObstacle(revive);
 check('Revival hold is never overridden',revive.me.move.x===0&&revive.me.move.y===-.6);
 const closeTarget=fake(2.8,0,[0,-.6],{x:1.8,z:0});routeAroundStageObstacle(closeTarget);
 check('Same-side target inside margin does not cause endless orbit',closeTarget.me.move.x===0&&closeTarget.me.move.y===-.6);
 const closeStart=fake(1.8,0,[0,.6],{x:2.8,z:0});closeStart.obstacleSide=1;routeAroundStageObstacle(closeStart);
 check('Approacher inside margin exits routing on the same side',closeStart.obstacleSide===null&&closeStart.me.move.x===0&&closeStart.me.move.y===.6);
 const retreat=fake(2.8,0,[0,.6]);routeAroundStageObstacle(retreat);check('Retreat input preserved',retreat.me.move.x===0&&retreat.me.move.y===.6);
 const stopped=fake(2.8,0,[0,0]);routeAroundStageObstacle(stopped);check('Stationary attack input preserved',stopped.me.move.length()===0);
 const approach=fake(2.8,0);routeAroundStageObstacle(approach);check('Approach redirects without increasing stick magnitude',Math.abs(approach.me.move.length()-.6)<1e-9&&Math.abs(approach.me.move.x)>.1);
 const w=new RAPIER.World({x:0,y:-9.81,z:0});
 let stone=configureStageObstacle(RAPIER,w,'sluice',GROUND_GROUPS);
 check('Eight real fixed statue colliders',stone.handles.size===8&&w.colliders.len()===8);
 w.step();
 for(const [y,z] of [[.6,.8],[1.05,-.65],[1.9,0],[2.5,0],[4,0]]){
  const ray=new RAPIER.Ray({x:-4,y,z},{x:1,y:0,z:0});
  const hit=w.castRay(ray,8,true);check('Stone obstructs solid leg/torso at '+y+','+z,!!hit&&stone.handles.has(hit.collider.handle));
 }
 check('Visible gap between legs remains open',!w.castRay(new RAPIER.Ray({x:-4,y:.6,z:0},{x:1,y:0,z:0}),8,true));
 const moving=w.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(-3,2.5,0).setGravityScale(0).setLinvel(5,0,0).setCcdEnabled(true));
 w.createCollider(RAPIER.ColliderDesc.ball(.12).setMass(1).setRestitution(0),moving);
 for(let i=0;i<180;i++)w.step();
 check('Dynamic body cannot pass through torso',moving.translation().x<-.55);
 w.removeRigidBody(moving);
 stone=configureStageObstacle(RAPIER,w,'castle',GROUND_GROUPS,stone);
 check('Changing stage removes all stone bodies/colliders',!stone&&w.colliders.len()===0&&w.bodies.len()===0);w.free();
 for(let i=0;i<72;i++){
  const a=i*Math.PI/36,o={x:Math.cos(a)*2,y:1.1,z:Math.sin(a)*2};
  const c={x:-o.x*1.4,y:2.3,z:-o.z*1.4};clampStageCamera(o,c,BEAR_NAVIGATION);
  assert(Math.hypot(c.x,c.z)>BEAR_NAVIGATION.radius+.27);assert(Object.values(c).every(Number.isFinite));
 }
 check('Camera segment clearance at 72 directions',true);
 for(const seed of [73,131,209]){
  const g=newRound({seed,weapon:'sain',weapon2:CHARACTERS_BY_ID.ratna.weapon,look2:CHARACTERS_BY_ID.ratna.look,persona:CHARACTERS_BY_ID.ratna.ai.persona,onFighter(f){
   configureWetlandMovement(f,'sluice');f.arenaObstacle=BEAR_NAVIGATION;
   if(f.index===1)f.terrainTraits=CHARACTERS_BY_ID.ratna.terrainTraits;
  }});
  try{
   const stone=configureStageObstacle(RAPIER,g.world,'sluice',GROUND_GROUPS);
   let minDistance=Infinity,maxSide=0,inside=0,firstApproach=null;const samples=[];
   for(let i=0;i<2160;i++){
    g.step();const p=g.player.bodies.pelvis.translation(),e=g.enemy.bodies.pelvis.translation();
    assert([p,e,g.enemy.sword.linvel()].flatMap(Object.values).every(Number.isFinite));
    minDistance=Math.min(minDistance,Math.hypot(e.x-p.x,e.z-p.z));maxSide=Math.max(maxSide,Math.abs(e.z));
    if(firstApproach===null&&minDistance<2)firstApproach=i*DT;
    if([...stone.handles].some(h=>g.world.getCollider(h).containsPoint(e)))inside++;
    if(i%120===0)samples.push({t:i*DT,x:e.x,z:e.z,state:g.enemy.state,scale:g.enemy.surfaceSpeedScale,route:g.ai.obstacleSide});
   }
   report.runs.push({seed,minDistance,maxSide,pelvisInsideStone:inside,firstApproach,samples});
   check('AI goes around and reaches opponent seed '+seed,maxSide>BEAR_NAVIGATION.radius&&minDistance<2);
   check('AI pelvis stays outside physical stone seed '+seed,inside===0);
  }finally{close(g);}
 }
 report.pass=true;
}catch(e){report.failure={message:e.message,stack:e.stack};process.exitCode=1;}
report.sources=Object.fromEntries(['src/arena_obstacle.js','src/stage_sluice_bear.js','src/ai.js','src/gait.js','src/fighter.js','src/wetland_ground.js','src/gun.js','src/main.js','tools/sim/experiments/marsh_obstacle_gate.mjs'].map(p=>[p,createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
report.completedUTC=new Date().toISOString();
report.limits=['Ray and native dynamic-body obstruction are tested, not every attack or weapon.','Three native AI approaches against a passive player; not a win-rate or human-motion benchmark.','Camera cylinder clearance is conservative; actual framing needs browser review.'];
fs.writeFileSync(out,JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,checks:report.checks.length,failure:report.failure?.message,runs:report.runs.map(({seed,minDistance,maxSide,pelvisInsideStone})=>({seed,minDistance,maxSide,pelvisInsideStone}))}));
