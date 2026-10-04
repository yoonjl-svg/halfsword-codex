// Replay the saved actual manual combat prefix; no restored contact snapshot.
// Contact-pair suppression is one-step diagnosis, never a playable proposal.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {receiveGripAngularImpulse} from './impact_grip_candidate.mjs';
import {armNativeGrip} from './native_grip_candidate.mjs';
const opts=Object.fromEntries(process.argv.slice(2).map(s=>{const m=/^--(out|reference|modes|tick|module|after)=(.+)$/.exec(s);assert(m);return[m[1],m[2]];}));
assert(opts.out&&path.isAbsolute(opts.out)&&!fs.existsSync(opts.out),'Fresh absolute output');
assert(opts.reference&&path.isAbsolute(opts.reference));
const sha=b=>createHash('sha256').update(b).digest('hex');
const harnessURL=new URL('../harness_m.mjs',import.meta.url);
let harness=harnessURL,enginePath=path.resolve('node_modules/@dimforge/rapier3d-compat/rapier.mjs'),engineHarness=null;
if(opts.module){
 assert(path.isAbsolute(opts.module));enginePath=opts.module;
 assert.equal(sha(fs.readFileSync(enginePath)),'a3be9d8361b386b0b664ee7ba771f14ae60e93eda9a4ab825f1de1260dbb5623','Verified restored research engine');
 const marker='../../node_modules/@dimforge/rapier3d-compat/rapier.mjs',source=fs.readFileSync(harnessURL,'utf8');assert.equal(source.split(marker).length,2);
 const rewritten=source.replace(/from (['"])([^'"]+)\1/g,(_,q,p)=>'from '+JSON.stringify(p===marker?pathToFileURL(enginePath).href:p.startsWith('.')?new URL(p,harnessURL).href:import.meta.resolve(p)));
 const directory=fs.mkdtempSync(path.join(path.dirname(opts.out),'native-harness-'));engineHarness=path.join(directory,'harness.mjs');fs.writeFileSync(engineHarness,rewritten,{flag:'wx'});harness=pathToFileURL(engineHarness);
}
const {newRound,DT,THREE,CONFIG,RAPIER}=await import(harness.href);
const modes=(opts.modes??'observe,noSwordPair').split(',');assert(modes.every(m=>['observe','noSwordPair','coupled','nativeGrip'].includes(m)));assert(!modes.includes('nativeGrip')||opts.module,'Capped native grip requires the restored engine');
const target=Number(opts.tick??965);assert(Number.isInteger(target)&&target>=0);
const after=Number(opts.after??1);assert(Number.isInteger(after)&&after>=1&&after<=60);
const V=o=>new THREE.Vector3(o.x,o.y,o.z),Q=o=>new THREE.Quaternion(o.x,o.y,o.z,o.w);
const referenceBytes=fs.readFileSync(opts.reference),reference=JSON.parse(referenceBytes);
const ref=reference.rows.find(r=>r.weapon==='qinggang'&&r.mode==='steady'&&r.observed);assert(ref&&reference.pass&&reference.sourceStable);
assert.equal(reference.dt,DT);assert(reference.schedule[target+after]);
function own(object){
 const omit=new Set(['f','fighter','me','foe','world','scene','R','rb','body','parent','child','joint','rawSet','raw','__wbg_ptr','info','mesh','group','sword','grip','colliderSet','thrustEdgeModel']);const seen=new WeakSet();
 const copy=(v,n=0)=>{if(v===null||['boolean','string'].includes(typeof v))return v;if(typeof v==='number')return Number.isFinite(v)?v:{$number:String(v)};
  if(typeof v!=='object'||n>8||v.isObject3D||typeof v.isValid==='function')return undefined;
  if(v.isVector2||v.isVector3||v.isQuaternion||v.isEuler)return v.toArray();if(seen.has(v))return {$shared:true};seen.add(v);
  if(Array.isArray(v))return v.map(x=>copy(x,n+1));if(v instanceof Set)return [...v].map(x=>copy(x,n+1));if(v instanceof Map)return [...v].map(([k,x])=>[copy(k,n+1),copy(x,n+1)]);
  return Object.fromEntries(Object.entries(v).filter(([k])=>!omit.has(k)).map(([k,x])=>[k,copy(x,n+1)]).filter(([,x])=>x!==undefined));};return copy(object);
}
const control=G=>({player:own(G.player),enemy:own(G.enemy),ai:own(G.ai),combat:own(G.combat)});
const events=G=>({clashes:G.clashes,wounds:G.wounds.map(w=>({timeS:w.t,att:w.att.index,vic:w.vic.index,zone:w.zone,type:w.type,severity:w.severity,energyJ:w.energy})),fighters:[G.player,G.enemy].map(f=>({state:f.state,alive:f.alive,armed:f.armed,wounds:own(f.wounds),limbs:own(f.limbs),detached:own(f.detachedParts)}))});
function momentum(b){const frame=Q(b.rotation()).multiply(Q(b.principalInertiaLocalFrame())),w=V(b.angvel()).applyQuaternion(frame.clone().invert()),I=V(b.principalInertia());return {L:w.clone().multiply(I).applyQuaternion(frame).toArray(),rotationalKJ:.5*w.clone().multiply(w).dot(I),principalInertia:I.toArray(),principalFrame:Q(b.principalInertiaLocalFrame()).toArray(),inverseWorldInertia:[...b.effectiveWorldInvInertia().elements]};}
function state(f){
 const b=f.sword,blade=new THREE.Vector3(0,1,0).applyQuaternion(Q(b.rotation())),w=V(b.angvel()),farm=f.bodies.farmS;
 return {p:V(b.translation()).toArray(),com:V(b.worldCom()).toArray(),q:Q(b.rotation()).toArray(),v:V(b.linvel()).toArray(),w:w.toArray(),blade:blade.toArray(),axial:w.dot(blade),relativeAxial:w.clone().sub(V(farm.angvel())).dot(blade),F:V(b.userForce()).toArray(),T:V(b.userTorque()).toArray(),swordMomentum:momentum(b),farmS:{w:V(farm.angvel()).toArray(),q:Q(farm.rotation()).toArray(),momentum:momentum(farm)},chestMomentum:momentum(f.bodies.chest),cap:f.debug.wristCap,preTwistWrist:f.debug.wristTorque.toArray(),health:{state:f.state,limbs:own(f.limbs),wounds:own(f.wounds)},aim:f.debug.aim.toArray(),handErrorM:V(farm.translation()).add(new THREE.Vector3(.13,0,0).applyQuaternion(Q(farm.rotation()))).distanceTo(f.handTarget)};
}
const info=i=>i?{actor:i.fighter?.index,kind:i.kind,part:i.part,body:i.body?.handle}:null;
function contacts(G,f){const rows=[];for(const c of f.swordColliders)G.world.contactPairsWith(c,o=>G.world.contactPair(c,o,(m,flipped)=>{
 if(!m.numContacts())return;rows.push({a:c.handle,b:o.handle,aInfo:info(G.combat.info.get(c.handle)),bInfo:info(G.combat.info.get(o.handle)),flipped,normal:{...m.normal()},solverPoints:Array.from({length:m.numSolverContacts()},(_,i)=>({...m.solverContactPoint(i)})),contacts:Array.from({length:m.numContacts()},(_,i)=>({distance:m.contactDist(i),normalImpulse:m.contactImpulse(i),tangentX:m.contactTangentImpulseX(i),tangentY:m.contactTangentImpulseY(i),local1:m.localContactPoint1(i),local2:m.localContactPoint2(i)}))});
 }));return rows;}
const scan=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(d+'/'+e.name):e.name.endsWith('.js')?[d+'/'+e.name]:[]);
const files=[...scan('src'),'tools/sim/harness_m.mjs','tools/sim/experiments/qinggang_contact_probe.mjs','tools/sim/experiments/impact_grip_candidate.mjs','package-lock.json','node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'];
files.push('tools/sim/experiments/native_grip_candidate.mjs');
if(opts.module)files.push(enginePath,engineHarness);
const manifest=()=>Object.fromEntries(files.map(n=>[n,sha(fs.readFileSync(n))]));
const sourceBefore=manifest(),startedUTC=new Date().toISOString(),start=performance.now(),random=Math.random,rows=[];let pass=false;
try{for(const mode of modes){let G;try{
 G=newRound({seed:7,weapon:'qinggang',weapon2:'longsword',skill:0,difficulty:'normal',onFighter:f=>{f.onehandArmModel='manual';f.thrustEdgeModel='steady';}});
 const f=G.player;f.skill.autoGuard=false;const creation={native:sha(G.world.takeSnapshot()),controller:sha(JSON.stringify(control(G)))};assert.deepEqual(creation,ref.creation,'Original creation must match');
 const frames=[],prefix=createHash('sha256');let tick=0,tapAttempted=false,stage=null;
 const originalClash=G.combat.bladeClash,originalSet=f.sword.setAngvel;let inClash=false;
 G.combat.bladeClash=function(...args){inClash=true;try{return originalClash.apply(this,args);}finally{inClash=false;}};
 f.sword.setAngvel=function(request,wake){
  if(mode==='coupled'&&tick===target&&inClash){
   const a=new THREE.Vector3(0,1,0).applyQuaternion(Q(this.rotation())),w=V(this.angvel()),axial=w.dot(a),lim=Math.max(Math.abs(f.cache.sword.w.dot(a)),CONFIG.STEEL.gripTwistMax);
   const expected=w.clone().addScaledVector(a,-(axial-Math.sign(axial)*lim));
   assert(Math.abs(axial)>lim&&expected.distanceTo(V(request))<1e-7,'Exact existing gripTwist setAngvel boundary');
   stage.reception=receiveGripAngularImpulse(f);
   fs.writeFileSync(opts.out+'.reception.json',JSON.stringify({mode,tick,before:stage.before,postPhysics:stage.postPhysics,reception:stage.reception,afterReception:state(f)},null,2)+'\n',{flag:'wx'});
   if(stage.reception.applied){assert(stage.reception.combinedTorqueNorm<=stage.reception.budgetCapNm+1e-8);assert(Math.hypot(...stage.reception.angularMomentumClosure)<1e-7);assert(stage.reception.pairKineticEnergyChangeJ<=1e-7);return;}
  }
  return originalSet.call(this,request,wake);
 };
 const worldStep=G.world.step.bind(G.world);G.world.step=function(queue,hooks){
  if(tick>=target-2)stage={tick,before:state(f),preNativeSHA256:sha(G.world.takeSnapshot()),suppressedPairs:[]};
  let useHooks=hooks;
  if(tick===target&&mode==='noSwordPair')useHooks={...hooks,filterContactPair:(a,b)=>{const A=G.combat.info.get(a),B=G.combat.info.get(b);if(A?.kind==='weapon'&&B?.kind==='weapon'&&A.fighter!==B.fighter&&(A.fighter===f||B.fighter===f)){stage.suppressedPairs.push({a,b,A:info(A),B:info(B)});return 0;}return hooks.filterContactPair(a,b);}};
  let native;if(tick===target&&mode==='nativeGrip')native=armNativeGrip(f,RAPIER);
  const result=worldStep(queue,useHooks);if(stage){stage.postPhysics=state(f);stage.contactsAfterPhysics=contacts(G,f);if(native)stage.nativeGrip=native.afterStep();}return result;
 };
 for(const request of reference.schedule.slice(0,target+after+1)){
  tick=request.tick;f.handOffset.x+=request.delta[0];f.handOffset.y+=request.delta[1];f.handHeld=request.held;f.inputActive=request.active;f.move.set(0,0);f.stickX=f.stickY=0;
  const encountered=contacts(G,f).length>0||G.wounds.length>0;let tapAccepted=null;if(!tapAttempted&&encountered){tapAttempted=true;tapAccepted=f.skill.thrust();}G.step();
  const event=events(G),input={request,pad:f.handOffset.toArray(),aim:f.skill.aim.toArray(),aimRaw:f.skill.aimRaw.toArray(),aimVel:f.skill.aimVel.toArray(),held:f.handHeld,active:f.inputActive,tapAccepted};
  const trace={tick,native:sha(G.world.takeSnapshot()),controller:sha(JSON.stringify(control(G))),input:sha(JSON.stringify(input)),events:sha(JSON.stringify(event))};
  if(tick<target||mode==='observe')assert.deepEqual(trace,ref.trace[tick],'Replay reference trace at tick '+tick);
  if(tick<target)prefix.update(JSON.stringify(trace));
  if(stage){stage.afterCombat=state(f);stage.events=event;stage.input=input;stage.trace=trace;frames.push(stage);stage=null;}
 }
 rows.push({mode,creation,prefixFrames:target,prefixSHA256:prefix.digest('hex'),frames});console.log(JSON.stringify({mode,frames:frames.map(f=>({tick:f.tick,pre:f.before.axial,physics:f.postPhysics.axial,combat:f.afterCombat.axial,suppressed:f.suppressedPairs.length,contacts:f.contactsAfterPhysics.length}))}));
 }finally{G?.eventQueue.free();G?.world.free();}}
 assert(rows.every(r=>r.prefixSHA256===rows[0].prefixSHA256));pass=true;
}finally{Math.random=random;const sourceAfter=manifest();fs.mkdirSync(path.dirname(opts.out),{recursive:true});fs.writeFileSync(opts.out,JSON.stringify({pass,startedUTC,completedUTC:new Date().toISOString(),wallSeconds:(performance.now()-start)/1000,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceBefore,sourceAfter,sourceStable:JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter),reference:{path:opts.reference,sha256:sha(referenceBytes),sourceCommit:reference.sourceCommit,sourceBefore:reference.sourceBefore},argv:process.argv.slice(2),targetTick:target,dt:DT,scope:'Actual original seeded manual combat from spawn using saved live nominal deltas and original reactive AI, tap on first contact/wound. Complete original creation/native/controller/input/events must match saved reference through the common prefix; observe must match beyond the target. One-step selected sword-pair solver suppression is diagnostic only. No snapshot restoration or prescribed pose/health/velocity/timestep changes. noSwordPair suppresses selected solver contacts for diagnosis; coupled replaces the existing post-step clamp with a paired impulse; nativeGrip configures existing grip motors at the target step. These candidate interventions are not gameplay approval. Manifold normal/tangent scalars have no supplied tangent basis and are not advertised as a closed contact torque.',rows},null,2)+'\n',{flag:'wx'});}
