// Actual Fighter/Rapier walking, with an isolated parked opponent. Not a combat win-rate test.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { newRound, DT } from '../harness_m.mjs';
import { applySwordsmanship } from '../../../src/swordsmanship.js';
import { configureWetlandMovement, wetlandMoveScale, WETLAND_PUDDLES, puddleOutline } from '../../../src/wetland_ground.js';
const out=process.argv[2];assert(out?.startsWith('/tmp/'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const rows=[];let failure=null;
function run(name,{stage=null,z=0,x=-2.8,walk=true,weapon='falchion',immune=false}={}){
 const g=newRound({seed:73,weapon,weapon2:weapon,walls:false,skill:0.7,onFighter(f){
  f.armSupportModel='linked';f.finishEntryModel='grounded';
  if(f.index===0){f.onehandArmModel='manual';f.stanceMemoryModel='fresh';}
  if(f.index===0 && immune) f.terrainTraits={wetlandImmunity:true};
  configureWetlandMovement(f,stage);
 }});g.park();
 const f=g.player;applySwordsmanship(f);
 // Shift the complete initial body, weapon and anchor together, before any step.
 if(z||x!==-2.8)for(const b of new Set([...Object.values(f.bodies),f.sword,f.anchor])){const p=b.translation();b.setTranslation({x:p.x+x+2.8,y:p.y,z:p.z+z},true);}
 g.faceP={x:100,y:1,z};
 const samples=[],frames=[];let began;
 try{
  for(let tick=0;tick<1680;tick++){
   g.before=()=>f.move.set(0,walk&&tick>=240?1:0);
   g.step();const p=f.bodies.pelvis.translation(),v=f.bodies.pelvis.linvel();
   if(tick===240)began={...p};
   assert([...Object.values(p),...Object.values(v),...Object.values(f.sword.angvel())].every(Number.isFinite));
   if(tick%6===0)samples.push({tick,t:tick*DT,x:p.x,z:p.z,y:p.y,vx:v.x,state:f.state,scale:f.surfaceSpeedScale,tilt:f.tiltDeg()});
   if(tick%60===0)frames.push(hash(g.world.takeSnapshot()));
  }
  const core=samples.filter(s=>s.tick>300&&s.x>=-1.65&&s.x<=0.3&&Math.abs(s.z-z)<0.8);
  const mean=core.reduce((sum,s)=>sum+s.vx,0)/(core.length||1);
  const row={name,stage,z,walk,weapon,immune,begin:began,coreSamples:core.length,coreMeanVx:mean,last:samples.at(-1),frames,samples};rows.push(row);return row;
 }finally{g.player.clearLoose();g.enemy.clearLoose();g.eventQueue.free();g.world.free();}
}
try{
 // Drawing and collision-free movement agree at every boundary direction.
 for(const p of WETLAND_PUDDLES){assert.equal(wetlandMoveScale(p.x,p.z),0.4);for(let i=0;i<56;i++){
  const a=i/56*Math.PI*2,r=puddleOutline(a,p.phase),x=p.x+Math.cos(a)*p.rx*r,z=p.z+Math.sin(a)*p.rz*r;
  assert(wetlandMoveScale(x,z)>0.9999,'Visible edge must not hide a slow region outside it');
 }}
 assert.equal(wetlandMoveScale(-2.8,0),1);assert.equal(wetlandMoveScale(2.8,0),1);
 const dry=run('ordinary-dry'),safe=run('wetland-dry',{stage:'sluice'});
 assert.deepEqual(dry.frames,safe.frames,'Dry ground must preserve native trajectories exactly');
 const still=run('ordinary-idle',{x:-0.5,z:-2,walk:false}),wetStill=run('wetland-idle',{stage:'sluice',x:-0.5,z:-2,walk:false});
 assert(wetStill.samples.filter(s=>s.tick>240).every(s=>s.scale===0.4),'Idle test must actually remain in mud');
 assert.deepEqual(still.frames,wetStill.frames,'Standing in mud must not alter automatic balance');
 for(const weapon of ['falchion','longsword']){
  const a=run(weapon+'-dry-route',{z:-2,weapon}),b=run(weapon+'-mud-route',{stage:'sluice',z:-2,weapon});
  const immune=run(weapon+'-reed-shoes',{stage:'sluice',z:-2,weapon,immune:true});
  assert.deepEqual(a.frames,immune.frames,'Reed shoes must retain dry native movement through puddles');
  assert(immune.samples.every(s=>s.scale===1));
  assert(a.coreSamples>=8&&b.coreSamples>=8,'Need actual motion inside the spatial core');
  assert(b.coreMeanVx<a.coreMeanVx*0.75,'Mud should visibly slow actual travel by at least25%');
  assert(b.last.scale===1&&b.last.x>6.5,'Must leave the mud without becoming trapped');
  assert(b.samples.every(s=>s.state==='stand'),'Uninjured walking must not create a fall');
 }
}catch(e){failure={message:e.message,stack:e.stack};process.exitCode=1;}
const sources=Object.fromEntries(['src/fighter.js','src/wetland_ground.js','src/config.js','tools/sim/harness_m.mjs', 'tools/sim/experiments/wetland_movement_gate.mjs'].map(p=>[p,hash(fs.readFileSync(p))]));
fs.writeFileSync(out,JSON.stringify({pass:!failure,completedUTC:new Date().toISOString(),sources,method:'120Hz actual native walking. Same seed,input,full initial translation. Opponent parked; no claim of natural combat or human gait validity.',failure,rows},null,2));
console.log(JSON.stringify({pass:!failure,failure:failure?.message,rows:rows.map(({name,coreMeanVx,coreSamples,last})=>({name,coreMeanVx,coreSamples,last}))}));
