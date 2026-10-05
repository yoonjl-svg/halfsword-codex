/** Native snapshot fixtures, no world stepping; independent P/L/K measurement. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {RAPIER} from '../harness_m.mjs';
import {snapshotWorld} from '../force_ledger.mjs';
import {applyCenterlineCutImpulse,centerlineCutEnabled} from '../../../src/cut_centerline.js';
const args=Object.fromEntries(process.argv.slice(2).map(x=>{const m=/^--(raw|out)=(.+)$/.exec(x);assert(m);return[m[1],m[2]];}));
assert(args.raw&&args.out&&!fs.existsSync(args.out));
const sha=x=>createHash('sha256').update(x).digest('hex'),raw=fs.readFileSync(args.raw),data=JSON.parse(raw),dir=path.dirname(args.raw);
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z,sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z}),norm=x=>Math.hypot(x.x,x.y,x.z);
const results=[];
for(const row of data.rows.filter(x=>x.observer)){
 const e=row.events[0],native=fs.readFileSync(path.join(dir,row.weapons.join('-')+'-first-pair.native.bin'));assert.equal(sha(native),row.firstPairNativeSHA256);
 for(const test of ['originalRequest','capRequest','separating']){
  if(test==='separating'&&row.weapons[0]!=='longsword')continue;
  const world=RAPIER.World.restoreSnapshot(native);try{
   const a=world.getRigidBody(Number(e.before.bodies[0].handle)),b=world.getRigidBody(Number(e.before.bodies[1].handle));
   const before=snapshotWorld(world,{bodies:[a,b]}),n=test==='separating'?{x:-e.dir.x,y:-e.dir.y,z:-e.dir.z}:e.dir;
   const J=test==='capRequest'?e.J*100:e.J,snapBefore=world.takeSnapshot();
   const r=applyCenterlineCutImpulse(a,b,e.pointA,n,J),after=snapshotWorld(world,{bodies:[a,b]});
   const dP=norm(sub(after.total.P,before.total.P)),dL=norm(sub(after.total.L,before.total.L)),dK=after.total.K-before.total.K;
   assert(dP<2e-5&&dL<2e-5,'Free pair must close P and L');assert(dK<=2e-5,'Passive instant pair');
   assert(Math.abs(dK-r.deltaKPredicted)<2e-4,'Independent native K matches formula');assert(r.sAfterMeasured>=-2e-5||r.J===0,'No reversal');
   if(test==='originalRequest')assert.equal(r.J,J);
   if(test==='capRequest')assert(r.J<J&&Math.abs(r.sAfterMeasured)<2e-5);
   if(test==='separating'){assert.equal(r.J,0);assert.equal(sha(world.takeSnapshot()),sha(snapBefore));}
   results.push({weapons:row.weapons,test,deltaPNs:dP,deltaLNms:dL,deltaKJ:dK,result:r});
  }finally{world.free();}
 }
}
const p={index:0},e={index:1},c={cutReactionModel:'centerline',cutReactionFighter:p};assert(centerlineCutEnabled(c,p));assert(!centerlineCutEnabled(c,e));assert(!centerlineCutEnabled(c,{index:0}));assert(!centerlineCutEnabled({...c,cutReactionModel:'legacy'},p));assert(!centerlineCutEnabled({...c,cutReactionFighter:null},p));
assert.throws(()=>applyCenterlineCutImpulse({}, {},{x:0,y:0,z:0},{x:0,y:0,z:0},1),TypeError);
const report={measurementValid:true,groups:6,nativeImpulseFixtures:5,worldSteps:0,sourceRaw:{path:args.raw,sha256:sha(raw)},helperSHA256:sha(fs.readFileSync(new URL('../../../src/cut_centerline.js',import.meta.url))),scopeAndInvalidInput:true,results};fs.writeFileSync(args.out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({measurementValid:true,groups:6,nativeImpulseFixtures:5,worldSteps:0,results:results.map(x=>({weapons:x.weapons,test:x.test,deltaPNs:x.deltaPNs,deltaLNms:x.deltaLNms,deltaKJ:x.deltaKJ,J:x.result.J,requestedJ:x.result.requestedJ}))}));
