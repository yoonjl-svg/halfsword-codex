// Actual fresh-round game, supplied gesture deltas, original reactive enemy.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {newRound, DT, RAPIER, THREE, handPos} from '../harness_m.mjs';
import {applyMotionAssist, MOTION_ASSIST} from '../../../src/motion_assist.js';
import {applyBladeShapeTrial} from '../../../src/blade_shape_trial.js';
import {CHARACTERS_BY_ID} from '../../../src/characters.js';

const out=process.argv[2];
assert(out && path.isAbsolute(out) && !fs.existsSync(out), 'Provide a fresh absolute output path');
const sha=b=>createHash('sha256').update(b).digest('hex');
const scan=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(d+'/'+e.name):e.name.endsWith('.js')?[d+'/'+e.name]:[]);
const files=[...scan('src'),'tools/sim/harness_m.mjs','tools/sim/experiments/motion_assist_probe.mjs','package-lock.json','node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'];
const manifest=()=>Object.fromEntries(files.sort().map(f=>[f,sha(fs.readFileSync(f))]));
const before=manifest(),sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const V=v=>new THREE.Vector3(v.x,v.y,v.z),Q=q=>new THREE.Quaternion(q.x,q.y,q.z,q.w);
const point=(b,v)=>V(v).applyQuaternion(Q(b.rotation())).add(V(b.translation()));
function footContacts(G, f) {
 return Object.fromEntries(['F','B'].map(k=>{
  const body=f.bodies['foot'+k],col=body.collider(0);let normalImpulseNs=0,points=0,maxHorizontalPointSpeedMps=0;
  G.world.contactPairsWith(col,other=>{
   if(other.parent()?.bodyType()!==RAPIER.RigidBodyType.Fixed)return;
   G.world.contactPair(col,other,m=>{
    for(let i=0;i<m.numContacts();i++){normalImpulseNs+=m.contactImpulse(i);points++;}
    for(let i=0;i<m.numSolverContacts();i++) {
     const v=body.velocityAtPoint(m.solverContactPoint(i));maxHorizontalPointSpeedMps=Math.max(maxHorizontalPointSpeedMps,Math.hypot(v.x,v.z));
    }
   });
  });
  return [k,{normalImpulseNs,points,maxHorizontalPointSpeedMps,quaternion:Object.values(body.rotation()),omega:Object.values(body.angvel())}];
 }));
}
const schedule=[]; let nominal=[.15,.1];
function phase(name,seconds,target,held=true,tap=false,move=0) {
  const start=nominal.slice(),ticks=Math.round(seconds/DT);
  for(let i=0;i<ticks;i++) {
    const next=start.map((v,k)=>v+(target[k]-v)*(i+1)/ticks),delta=next.map((v,k)=>v-nominal[k]);
    schedule.push({tick:schedule.length,phase:name,nominal:next,delta,held,active:Math.hypot(...delta)>1e-5,tap:tap&&i===0,move});nominal=next;
  }
}
phase('ready',1,[.15,.1]); phase('slowRaise',.8,[.10,.45]);
phase('cut',.25,[.10,-.45]); phase('stop',.3,[.10,-.45]);
phase('reverse',.25,[.10,.45]); phase('tap',.6,[.10,.45],false,true);
phase('recut',.25,[-.35,-.42]); phase('release',.8,[-.35,-.42],false);
phase('crossPrepare',.7,[-.42,.03]); phase('crossCut',.25,[.42,.03]);
phase('heldStop',.7,[.42,.03]); phase('releaseCross',.6,[.42,.03],false);
phase('lower',.7,[.1,-.45]); phase('slowReturn',.8,[.15,.1]);
phase('tapAgain',.6,[.15,.1],false,true);
phase('approach',1.4,[.15,.1],false,false,.5);
phase('combatRaise',.7,[.10,.45]); phase('combatCut',.25,[.10,-.45]);
phase('combatStop',.3,[.10,-.45]); phase('combatReverse',.25,[.10,.45]);
phase('combatTap',.6,[.10,.45],false,true);
phase('combatRecut',.25,[-.35,-.42]); phase('finalRelease',1.2,[-.35,-.42],false);
const rows=[],startedUTC=new Date().toISOString(),started=performance.now(),random=Math.random;
let error=null,pass=false;
try {
 for(const scene of ['distant','live']) for(const strength of (scene==='distant'?[0,.15,.25]:[0,MOTION_ASSIST.strength])) {
  let G;
  try {
   const character=CHARACTERS_BY_ID.heinrich;
   G=newRound({seed:7,weapon:'qinggang',weapon2:'longsword',skill:0,
    gap:scene==='distant'?14:undefined,walls:scene==='distant'?false:undefined,look2:character.look,difficulty:character.ai.level,
    persona:{...character.ai.persona,school:'longsword'},
    onFighter:f=>{if(f.index===0)f.onehandArmModel='manual';}});
   const f=G.player; f.skill.autoGuard=false; f.thrustEdgeModel='transported';
   assert(applyBladeShapeTrial({active:true,model:'profile'},f,RAPIER));
   assert(applyMotionAssist({active:true,motionAssist:strength?'weak':'none'},f));
   if(strength) f.motionAssistStrength=strength; // named internal research ablation, never a URL strength
   G.combat.finishRuleModel='armorCausal'; G.combat.finishRuleFighter=f;
   const creationNative=sha(G.world.takeSnapshot()),inputHash=createHash('sha256'),frames=[],taps=[];
   const steps=scene==='distant'?schedule.slice(0,Math.round(7.25/DT)):schedule;
   for(const request of steps) {
    inputHash.update(JSON.stringify(request));
    if(f.alive){f.handOffset.x+=request.delta[0];f.handOffset.y+=request.delta[1];}
    f.handHeld=request.held;f.inputActive=request.active;f.move.set(0,request.move);f.stickX=0;f.stickY=request.move;
    if(request.tap)taps.push({tick:request.tick,accepted:f.skill.thrust(),state:f.state});
    G.step();
    assert(G.world.bodies.getAll().every(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].every(v=>Object.values(v).every(Number.isFinite))), 'Nonfinite native state');
    const blade=new THREE.Vector3(0,1,0).applyQuaternion(Q(f.sword.rotation())),omega=V(f.sword.angvel());
    const gaps=Object.fromEntries(f.joints.filter(j=>j.joint?.isValid()).map(j=>[j.name,point(j.parent,j.joint.anchor1()).distanceTo(point(j.child,j.joint.anchor2()))]));
    if(f.gripJoint?.isValid())gaps.grip=point(f.gripJoint.body1(),f.gripJoint.anchor1()).distanceTo(point(f.gripJoint.body2(),f.gripJoint.anchor2()));
    frames.push({tick:request.tick,timeS:G.t,phase:request.phase,input:{pad:f.handOffset.toArray(),aim:f.skill.aim.toArray(),raw:f.skill.aimRaw.toArray(),follow:f.skill.follow.toArray(),move:f.move.toArray()},
     native:sha(G.world.takeSnapshot()),handBase:f.handBase?.slice(),bodyPose:{...f.bodyPose},bodyWeight:f.bodyGuardWeight(),guardWeight:f.guardWeight(),
     actualBodies:Object.fromEntries(['pelvis','chest','uarmS','farmS'].map(n=>[n,{quaternion:Object.values(f.bodies[n].rotation()),omega:Object.values(f.bodies[n].angvel())}])),
     footContacts:footContacts(G,f),
     handErrorM:handPos(f).distanceTo(f.handTarget),handWorld:handPos(f).toArray(),targetWorld:f.handTarget.toArray(),
     aim:f.debug.aim.toArray(),aimErrorRad:blade.angleTo(f.debug.aim),omegaRadS:omega.length(),axialRadS:omega.dot(blade),
     tipMps:V(f.sword.velocityAtPoint(f.bladePoint(1,new THREE.Vector3()))).length(),gaps,tiltDeg:f.tiltDeg(),
     support:Object.fromEntries(Object.entries(f.gait.legs).map(([k,l])=>[k,{stance:l.stance,N:l.N,soleY:l.soleY}])),
     state:f.state,alive:f.alive,armed:f.armed,armHealth:f.armHealth,skill:{swings:f.skill.swings,thrusts:f.skill.thrusts,tap:!!f.skill.tap,tapWeight:f.skill.thrustPose.w,autoGuard:f.skill.autoGuard,level:f.skill.level}});
   }
   const wounds=G.wounds.map(w=>({timeS:w.t,victim:w.vic.index,attacker:w.att.index,zone:w.zone,type:w.type,severity:w.severity,energyJ:w.energy}));
   rows.push({scene,strength,creationNative,inputSHA256:inputHash.digest('hex'),frames,taps,wounds,clashes:G.clashes});
   console.log(JSON.stringify({scene,strength,steps:frames.length,taps,wounds:wounds.length,clashes:G.clashes,finalState:f.state}));
  } finally {G?.eventQueue.free();G?.world.free();}
 }
 // Supplied deltas are identical within a scene. In the no-contact prefix the
 // planar hand goals must also remain exact: assistance owns depth/body only.
 for(const scene of ['distant','live']) {
  const group=rows.filter(r=>r.scene===scene),base=group[0];
  assert(group.every(r=>r.creationNative===base.creationNative && r.inputSHA256===base.inputSHA256));
 }
 const distant=rows.filter(r=>r.scene==='distant');
 for(const row of distant.slice(1)) for(let i=0;i<row.frames.length;i++) {
  const a=distant[0].frames[i],b=row.frames[i];
  assert.deepEqual(b.input,a.input,'Distant raw/filtered input remains exact '+i);
  assert.equal(b.handBase[1],a.handBase[1]);assert.equal(b.handBase[2],a.handBase[2]);
  assert(Math.abs(b.handBase[0]-a.handBase[0])<=MOTION_ASSIST.depthScale*row.strength+1e-12);
 }
 pass=true;
}catch(e){error={name:e.name,message:e.message,stack:e.stack};process.exitCode=1;}
finally {
 Math.random=random;const after=manifest(),sourceStable=JSON.stringify(before)===JSON.stringify(after);
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({pass,error,sourceStable,sourceCommit,sourceBefore:before,sourceAfter:after,
  command:process.argv,dt:DT,startedUTC,completedUTC:new Date().toISOString(),wallSeconds:(performance.now()-started)/1000,
  scope:'Actual npm game from spawn, seed7 original reactive Heinrich with forced longsword as public. Distant gap14 uses an open floor without arena walls: isolated healthy control, not normal arena equivalence. Live uses default gap and walls. Candidate modifies motor goals; fixture adds no park/forced injury/live pose/velocity/damping/motor changes. Identical supplied physics-time gestures, not human touch/frame timing. Internal .25 ablation is not a public strength. Reactive outcomes after divergence cannot establish victory or injury prevention. Native snapshots and body/foot contact observations are read-only; naturalness requires player judgement.',
  schedule,scheduleSHA256:sha(JSON.stringify(schedule)),rows},null,2)+'\n',{flag:'wx'});
 assert(sourceStable,'Runtime changed during measurement');
}
