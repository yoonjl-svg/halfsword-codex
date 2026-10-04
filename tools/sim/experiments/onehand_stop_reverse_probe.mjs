// Actual manual-onehand game: one controlled raise/cut/stop/reverse segment.
// Observe real requests and native motion; never infer native motor work from PD.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {newRound as ordinaryNewRound,DT,THREE,handPos} from '../harness_m.mjs';
import {pathToFileURL} from 'node:url';
import {mainArmMuscle} from '../../../src/arm_recovery_activation.js';
import {beforeWristResponse,afterWristResponse} from './derive_wrist_response.mjs';

const options=Object.fromEntries(process.argv.slice(2).map(s=>{
  const m=/^--(out|weapons|observerRepeats|modes|scenario)=(.+)$/.exec(s);assert(m,'Use named out/weapons/observerRepeats');return [m[1],m[2]];
}));
const out=options.out;assert(out&&!fs.existsSync(out),'Fresh --out required');
const scenario=options.scenario??'stroke';assert(['stroke','tap','live'].includes(scenario));
const weapons=(options.weapons??'sabre,qinggang').split(',');assert(weapons.every(w=>['sabre','qinggang'].includes(w))&&new Set(weapons).size===weapons.length);
assert(!options.observerRepeats||['true','false'].includes(options.observerRepeats));
const modes=(options.modes??'original').split(',');assert(modes.every(m=>['original','continuous'].includes(m))&&new Set(modes).size===modes.length);
const repeats=options.observerRepeats!=='false',sha=x=>createHash('sha256').update(x).digest('hex');
let newRound=ordinaryNewRound,candidateGeneration=null;
// A research-only transformed copy of the actual Fighter/harness. Main game
// files and browser URLs never expose this unpublished candidate.
if(modes.includes('continuous')){
 const baseRoot=new URL('../../../',import.meta.url),fighterURL=new URL('src/fighter.js',baseRoot),harnessURL=new URL('tools/sim/harness_m.mjs',baseRoot);
 const source=fs.readFileSync(fighterURL,'utf8'),helper=new URL('onehand_aim_candidate.mjs',import.meta.url);
 let patched="import {continuousOnehandElevation} from "+JSON.stringify(helper.href)+";\n"+source;
 const replaceOne=(from,to)=>{assert.equal(patched.split(from).length,2,'Expected unique source marker: '+from);patched=patched.replace(from,to);};
 replaceOne('function guardDir(x, y) {','function guardDir(x, y, continuous = false) {');
 replaceOne('  const el = y <= 0.1 ?','  let el = y <= 0.1 ?');
 replaceOne('  // 옆으로 뺄수록 칼이 그쪽으로 눕는다',"  if (continuous) el = continuousOnehandElevation(y, el);\n  // 옆으로 뺄수록 칼이 그쪽으로 눕는다");
 replaceOne('guardDir(0.15, 0.1)',"guardDir(0.15, 0.1, this.onehandAimModel === 'continuous')");
 replaceOne('guardDir(off.x, off.y)',"guardDir(off.x, off.y, manualOnehand && this.onehandAimModel === 'continuous')");
 const rewrite=(text,origin,special)=>text.replace(/from (['"])([^'"]+)\1/g,(_,q,p)=>'from '+JSON.stringify(special?.(p)??(p.startsWith('.')?new URL(p,origin).href:p.startsWith('file:')?p:import.meta.resolve(p))));
 fs.mkdirSync(path.dirname(out),{recursive:true});const dir=fs.mkdtempSync(path.join(path.dirname(out),'candidate-runtime-'));
 const fighterPath=path.join(dir,'fighter.mjs'),harnessPath=path.join(dir,'harness.mjs');
 const fighter=rewrite(patched,fighterURL);fs.writeFileSync(fighterPath,fighter,{flag:'wx'});
 const harnessSource=fs.readFileSync(harnessURL,'utf8');assert.equal(harnessSource.split('../../src/fighter.js').length,2);
 const harness=rewrite(harnessSource,harnessURL,p=>p==='../../src/fighter.js'?pathToFileURL(fighterPath).href:null);fs.writeFileSync(harnessPath,harness,{flag:'wx'});
 candidateGeneration={originalFighterSHA256:sha(source),patchedFighterSHA256:sha(patched),helperSHA256:sha(fs.readFileSync(helper)),directory:dir,rewrittenFighterSHA256:sha(fighter),rewrittenHarnessSHA256:sha(harness),scope:'Source-identical Fighter except optional centre-preserving C2 guard elevation. Imports rewritten to current original modules; original harness control/native/Combat ordering retained.'};
 newRound=(await import(pathToFileURL(harnessPath).href)).newRound;
}
const V=o=>new THREE.Vector3(o.x,o.y,o.z),Q=o=>new THREE.Quaternion(o.x,o.y,o.z,o.w);
const point=(b,p)=>V(p).applyQuaternion(Q(b.rotation())).add(V(b.translation()));
function scan(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(d+'/'+e.name):e.name.endsWith('.js')?[d+'/'+e.name]:[]);}
const files=[...scan('src'),'package.json','package-lock.json','tools/sim/harness_m.mjs',
  'tools/sim/experiments/derive_wrist_response.mjs','tools/sim/experiments/onehand_aim_candidate.mjs','tools/sim/experiments/onehand_stop_reverse_probe.mjs',
  'node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'];
const manifest=()=>Object.fromEntries(files.sort().map(p=>[p,sha(fs.readFileSync(p))]));
function own(object){
 const omit=new Set(['f','fighter','me','foe','world','scene','R','rb','body','parent','child','joint','rawSet','raw','__wbg_ptr','info','mesh','group','sword','grip','colliderSet','onehandAimModel']);const seen=new WeakSet();
 const copy=(v,n=0)=>{if(v===null||['boolean','string'].includes(typeof v))return v;if(typeof v==='number')return Number.isFinite(v)?v:{$number:String(v)};
  if(typeof v!=='object'||n>8||v.isObject3D||typeof v.isValid==='function')return undefined;
  if(v.isVector2||v.isVector3||v.isQuaternion||v.isEuler)return v.toArray();if(seen.has(v))return {$shared:true};seen.add(v);
  if(Array.isArray(v))return v.map(x=>copy(x,n+1));if(v instanceof Set)return [...v].map(x=>copy(x,n+1));if(v instanceof Map)return [...v].map(([k,x])=>[copy(k,n+1),copy(x,n+1)]);
  return Object.fromEntries(Object.entries(v).filter(([k])=>!omit.has(k)).map(([k,x])=>[k,copy(x,n+1)]).filter(([,x])=>x!==undefined));};return copy(object);
}
const control=G=>({player:own(G.player),enemy:own(G.enemy),ai:own(G.ai),combat:own(G.combat)});
const events=G=>({clashes:G.clashes,wounds:G.wounds.map(w=>({timeS:w.t,att:w.att.index,vic:w.vic.index,zone:w.zone,type:w.type,severity:w.severity,energyJ:w.energy})),fighters:[G.player,G.enemy].map(f=>({state:f.state,alive:f.alive,armed:f.armed,wounds:own(f.wounds),limbs:own(f.limbs),detached:own(f.detachedParts)}))});
const body=b=>({p:V(b.translation()).toArray(),q:Q(b.rotation()).toArray(),v:V(b.linvel()).toArray(),w:V(b.angvel()).toArray(),F:V(b.userForce()).toArray(),T:V(b.userTorque()).toArray()});
function read(f){
 const blade=new THREE.Vector3(0,1,0).applyQuaternion(Q(f.sword.rotation())),w=V(f.sword.angvel());
 const gaps=f.joints.filter(j=>j.joint?.isValid()).map(j=>({name:j.name,m:point(j.parent,j.joint.anchor1()).distanceTo(point(j.child,j.joint.anchor2()))}));
 if(f.gripJoint?.isValid())gaps.push({name:'grip',m:point(f.gripJoint.body1(),f.gripJoint.anchor1()).distanceTo(point(f.gripJoint.body2(),f.gripJoint.anchor2()))});
 return {bodies:Object.fromEntries(['chest','uarmS','farmS','pelvis','footF','footB'].map(n=>[n,body(f.bodies[n])])),sword:body(f.sword),
  blade:blade.toArray(),swingOmega:w.clone().addScaledVector(blade,-w.dot(blade)).toArray(),axialOmega:w.dot(blade),
  aim:f.debug.aim.toArray(),aimErrorRad:blade.angleTo(f.debug.aim),handTarget:f.handTarget.toArray(),hand:handPos(f).toArray(),handErrorM:handPos(f).distanceTo(f.handTarget),
  handBase:f.handBase?.slice()??null,armFull:f.armFull,ready:own(f.onehandReady),jointGaps:gaps,
  shoulderTarget:f.jointByName.uarmS.target.toArray(),elbowTarget:f.jointByName.farmS.target.toArray(),health:{state:f.state,alive:f.alive,armed:f.armed,wounds:own(f.wounds),limbs:own(f.limbs),muscle:f.muscle,armHealth:f.armHealth}};
}
function contacts(G,f){const rows=[];for(const c of f.swordColliders)G.world.contactPairsWith(c,o=>G.world.contactPair(c,o,(m,flipped)=>{if(m.numContacts())rows.push({a:c.handle,b:o.handle,otherBody:o.parent()?.handle,flipped,normal:{...m.normal()},contacts:Array.from({length:m.numContacts()},(_,i)=>({distance:m.contactDist(i),impulse:m.contactImpulse(i)}))});}));return rows;}
const phases=[['ready',1,[.15,.1]],['raise',.35,[.10,.45]],['raiseHold',.45,[.10,.45]],['cut',.25,[.10,-.45]],['stop',.30,[.10,-.45]],['reverse',.25,[.10,.45]],['reverseHold',scenario==='live'?5.4:.70,[.10,.45]]];
const schedule=[];let nominal=[.15,.1];
for(const [phase,seconds,target]of phases){const start=nominal.slice(),ticks=Math.round(seconds/DT);for(let i=0;i<ticks;i++){
 const next=start.map((v,k)=>v+(target[k]-v)*(i+1)/ticks),delta=next.map((v,k)=>v-nominal[k]);
 schedule.push({phase,tick:schedule.length,nominal:next,delta,held:true,active:Math.hypot(...delta)>1e-5});nominal=next;
}}
const before=manifest(),startedUTC=new Date().toISOString(),start=performance.now(),random=Math.random,rows=[];let pass=false;
function run(weapon,observed,mode){
 let G;const undo=[],frames=[],trace=[],operations=[],motors=[],stack=[];let response=null,priorYaw=null,prePhysics=null,postPhysics=null;
 try{G=newRound({seed:7,weapon,weapon2:'longsword',skill:0,difficulty:'normal',onFighter:f=>{f.onehandArmModel='manual';f.onehandAimModel=mode==='continuous'?'continuous':'legacy';}});const f=G.player;f.skill.autoGuard=false;
  assert(G.t===0&&!G.parkEnemy&&!G.ai2);const creation={native:sha(G.world.takeSnapshot()),controller:sha(JSON.stringify(control(G)))};
  const counts={driveSword:0,driveJoints:0,elbowGravity:0,wristReconstructed:0};
  if(observed){
   for(const name of ['driveSword','driveJoints','manualMuscle','elbowGravity']){const original=f[name];f[name]=function(...args){
    stack.push(name);if(name in counts)counts[name]++;const activation=name==='driveSword'?mainArmMuscle(f):0;
    const pre=name==='driveSword'&&f.armed&&activation>=.12?beforeWristResponse(f,priorYaw):null;
    try{return original.apply(this,args);}finally{if(pre){response=afterWristResponse(f,pre,activation);priorYaw=f.yaw.toArray();counts.wristReconstructed++;}stack.pop();}
   };undo.push(()=>{delete f[name];});}
   for(const [name,b]of [['sword',f.sword],['farmS',f.bodies.farmS],['uarmS',f.bodies.uarmS],['chest',f.bodies.chest]]){const original=b.addTorque;b.addTorque=function(t,wake){
    if(stack.length)operations.push({path:stack.join('.'),body:name,torque:[t.x,t.y,t.z],omega:V(this.angvel()).toArray(),powerW:t.x*this.angvel().x+t.y*this.angvel().y+t.z*this.angvel().z});return original.call(this,t,wake);
   };undo.push(()=>{delete b.addTorque;});}
   const j=f.jointByName.farmS,raw=j.joint.rawSet,original=raw.jointConfigureMotor;
   raw.jointConfigureMotor=function(h,a,target,velocity,k,d){if(h===j.joint.handle)motors.push({axis:a,target,velocity,k,d,nominalMax:j.max,relativeOmega:V(j.child.angvel()).sub(V(j.parent.angvel())).toArray(),nativeImpulseGetterAvailable:typeof raw.jointMotorImpulse==='function'});return original.call(this,h,a,target,velocity,k,d);};undo.push(()=>{raw.jointConfigureMotor=original;});
   const originalStep=G.world.step;G.world.step=function(...args){prePhysics=read(f);try{return originalStep.apply(this,args);}finally{postPhysics=read(f);}};undo.push(()=>{delete G.world.step;});
  }
  for(const request of schedule){
   f.handOffset.x+=request.delta[0];f.handOffset.y+=request.delta[1];f.handHeld=request.held;f.inputActive=request.active;f.move.set(0,0);f.stickX=f.stickY=0;
   operations.length=0;motors.length=0;response=null;const tapAccepted=scenario==='tap'&&request.phase==='stop'&&schedule[request.tick-1]?.phase!=='stop'?f.skill.thrust():null;G.step();
   assert(G.world.bodies.getAll().every(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].every(v=>Object.values(v).every(Number.isFinite))),'Native finite');
   const event=events(G),input={request,pad:f.handOffset.toArray(),aim:f.skill.aim.toArray(),aimRaw:f.skill.aimRaw.toArray(),aimVel:f.skill.aimVel.toArray(),held:f.handHeld,active:f.inputActive,tapAccepted};
   trace.push({tick:request.tick,native:sha(G.world.takeSnapshot()),controller:sha(JSON.stringify(control(G))),input:sha(JSON.stringify(input)),events:sha(JSON.stringify(event))});
   if(observed){const closure=operations.filter(x=>x.path==='driveSword').reduce((s,x)=>s.map((v,k)=>v+x.torque[k]),[0,0,0]);assert(Math.hypot(...closure)<1e-8,'Explicit wrist reaction closure');
    frames.push({tick:request.tick,timeS:G.t,phase:request.phase,input,response,prePhysics,postPhysics,postCombat:read(f),operations:structuredClone(operations),elbowMotorRequests:structuredClone(motors),explicitWristClosure:closure,swordContacts:contacts(G,f),events:event});
   }
  }
  const summary=observed?{maxHandErrorM:Math.max(...frames.map(x=>x.postCombat.handErrorM)),maxSwingOmega:Math.max(...frames.map(x=>Math.hypot(...x.postCombat.swingOmega))),maxAxialOmega:Math.max(...frames.map(x=>Math.abs(x.postCombat.axialOmega))),maxJointGapM:Math.max(...frames.flatMap(x=>x.postCombat.jointGaps.map(j=>j.m))),wristChecks:counts.wristReconstructed}:null;
  console.log(JSON.stringify({weapon,mode,observed,steps:trace.length,summary}));return {weapon,mode,observed,creation,counts,summary,trace,frames};
 }finally{undo.reverse().forEach(fn=>fn());G?.eventQueue.free();G?.world.free();}
}
try{for(const weapon of weapons)for(const mode of modes){const base=repeats?run(weapon,false,mode):null,observed=run(weapon,true,mode);if(base){assert.deepEqual(base.creation,observed.creation);assert.deepEqual(base.trace,observed.trace);rows.push(base);}rows.push(observed);}pass=true;}
finally{Math.random=random;const after=manifest();fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({pass,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),argv:process.argv.slice(2),sourceBefore:before,sourceAfter:after,sourceStable:JSON.stringify(before)===JSON.stringify(after),startedUTC,completedUTC:new Date().toISOString(),wallSeconds:(performance.now()-start)/1000,dt:DT,scenario,candidateGeneration,schedule,scheduleSHA256:sha(JSON.stringify(schedule)),scope:'Actual manual B before spawn, original normal enemy/default gap and walls; continuous uses documented research-only transformed Fighter/harness; player skill0 autoGuardfalse, nominal deltas added to live pad, all holds held. No AI2/park/body/force/health injection. Wrist reconstruction is read-only and exact against current cap/torque/Hill/latch. Native configure is a request only; npm actual motor impulse/work unavailable. Noninterference compares full native/controller/input/event trace with no observer installer.',observerParity:repeats&&pass,rows},null,2)+'\n',{flag:'wx'});}
console.log(JSON.stringify({pass,rows:rows.length,sourceStable:JSON.stringify(before)===JSON.stringify(manifest())}));
