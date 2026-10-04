// Research only: actual current manual B, original Fighter/AI/Combat, restored
// native engine. No C2, native joint replacement, force ledger, or injury injection.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {installNativeElbow} from './native_elbow_candidate.mjs';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const options=Object.fromEntries(process.argv.slice(2).map(s=>{const m=/^--(out|module|calibration|npm-reference)=(.+)$/.exec(s);assert(m,'Use named out/module/calibration/npm-reference options');return[m[1],m[2]];}));
const out=path.resolve(options.out??'/workspace/halfsword-handoff/native-onehand-stop-20261004/native-stop-run01.json');
const modulePath=path.resolve(options.module??'/workspace/halfsword-research-import-20261003/engine/rapier.mjs');
const calibrationPath=path.resolve(options.calibration??'/workspace/halfsword-research-import-20261003/engine/native-motor-api-r1.json');
const referencePath=path.resolve(options['npm-reference']??'/workspace/halfsword-handoff/onehand-stop-20261004/baseline-run01.json');
assert(!fs.existsSync(out)&&!fs.existsSync(out+'.summary.json'),'Fresh output paths required');
const sha=x=>createHash('sha256').update(x).digest('hex'),digest=x=>sha(JSON.stringify(x));
const bytes=fs.readFileSync(modulePath),engineHash=sha(bytes),calibrationBytes=fs.readFileSync(calibrationPath),calibration=JSON.parse(calibrationBytes);
const calibrationSource=sha(fs.readFileSync(path.join(root,'tools/sim/experiments/native_motor_api_probe.mjs')));
assert(engineHash==='a3be9d8361b386b0b664ee7ba771f14ae60e93eda9a4ab825f1de1260dbb5623'&&
 sha(calibrationBytes)==='90a7ef5a2e34c18ea601d61a04fff36e4b6a766e8a360a10a85196d5fa8a4089'&&
 calibration.pass&&calibration.sourceStable&&calibration.moduleSourceStable&&calibration.moduleSourceBefore===engineHash&&
 calibration.moduleSourceAfter===engineHash&&calibration.sourceBefore===calibrationSource&&calibration.sourceAfter===calibrationSource,
 'Exact passed native API calibration/module/source guard failed');
const referenceBytes=fs.readFileSync(referencePath),reference=JSON.parse(referenceBytes);
assert(reference.pass&&reference.sourceStable&&reference.observerParity,'Passed current npm reference required');
function scan(dir){return fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(dir+'/'+e.name):e.name.endsWith('.js')?[dir+'/'+e.name]:[]);}
const files=[...scan('src'),'package.json','package-lock.json','tools/sim/harness_m.mjs',
 'tools/sim/experiments/native_onehand_stop_probe.mjs','tools/sim/experiments/onehand_stop_reverse_probe.mjs',
 'tools/sim/experiments/native_motor_api_probe.mjs','tools/sim/experiments/native_elbow_candidate.mjs',
 'tools/sim/experiments/elbow_actuator_candidate.mjs','node_modules/three/build/three.module.js',
 'node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'];
const manifest=()=>Object.fromEntries(files.sort().map(p=>[p,sha(fs.readFileSync(path.join(root,p)))]));
const before=manifest(),startedUTC=new Date().toISOString(),start=performance.now();
const currentGameMatchesReference=Object.keys(before).filter(p=>p.startsWith('src/')||['package.json','package-lock.json','tools/sim/harness_m.mjs'].includes(p))
 .every(p=>reference.sourceBefore[p]===before[p]&&reference.sourceAfter[p]===before[p]);
assert(currentGameMatchesReference,'Current unmodified game sources must match npm baseline reference');
fs.mkdirSync(path.dirname(out),{recursive:true});
const directory=fs.mkdtempSync(path.join(path.dirname(out),'absolute-native-harness-'));
const harnessURL=new URL('tools/sim/harness_m.mjs',pathToFileURL(root+'/'));
const source=fs.readFileSync(harnessURL,'utf8'),marker='../../node_modules/@dimforge/rapier3d-compat/rapier.mjs';
assert.equal(source.split(marker).length,2,'Expected one original harness native engine import');
const rewritten=source.replace(/from (['"])([^'"]+)\1/g,(_,q,p)=>'from '+JSON.stringify(p===marker?pathToFileURL(modulePath).href:p.startsWith('.')?new URL(p,harnessURL).href:import.meta.resolve(p)));
const harnessPath=path.join(directory,'harness.mjs');fs.writeFileSync(harnessPath,rewritten,{flag:'wx'});
const {newRound,DT,THREE,handPos,AI,CONFIG}=await import(pathToFileURL(harnessPath).href);
const V=o=>new THREE.Vector3(o.x,o.y,o.z),Q=o=>new THREE.Quaternion(o.x,o.y,o.z,o.w);
const point=(b,p)=>V(p).applyQuaternion(Q(b.rotation())).add(V(b.translation()));
// Same bounded plain-controller serializer as the current npm recording.
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
function energy(b){const w=V(b.angvel()).applyQuaternion(Q(b.rotation()).multiply(Q(b.principalInertiaLocalFrame())).invert()),I=b.principalInertia();
 const translationJ=.5*b.mass()*V(b.linvel()).lengthSq(),rotationJ=.5*(I.x*w.x*w.x+I.y*w.y*w.y+I.z*w.z*w.z);return {translationJ,rotationJ,totalJ:translationJ+rotationJ};}
function read(f){
 const blade=new THREE.Vector3(0,1,0).applyQuaternion(Q(f.sword.rotation())),w=V(f.sword.angvel());
 const gaps=f.joints.filter(j=>j.joint?.isValid()).map(j=>({name:j.name,m:point(j.parent,j.joint.anchor1()).distanceTo(point(j.child,j.joint.anchor2()))}));
 if(f.gripJoint?.isValid())gaps.push({name:'grip',m:point(f.gripJoint.body1(),f.gripJoint.anchor1()).distanceTo(point(f.gripJoint.body2(),f.gripJoint.anchor2()))});
 return {bodies:Object.fromEntries(['chest','uarmS','farmS','pelvis','footF','footB'].map(n=>[n,body(f.bodies[n])])),sword:body(f.sword),
  blade:blade.toArray(),swingOmega:w.clone().addScaledVector(blade,-w.dot(blade)).toArray(),axialOmega:w.dot(blade),swordOmegaRadS:w.length(),swordEnergy:energy(f.sword),
  aim:f.debug.aim.toArray(),aimErrorRad:blade.angleTo(f.debug.aim),handTarget:f.handTarget.toArray(),hand:handPos(f).toArray(),handErrorM:handPos(f).distanceTo(f.handTarget),
  handBase:f.handBase?.slice()??null,armFull:f.armFull,ready:own(f.onehandReady),jointGaps:gaps,
  missingJoints:f.joints.filter(j=>!j.joint?.isValid()).map(j=>j.name),shoulderTarget:f.jointByName.uarmS.target.toArray(),elbowTarget:f.jointByName.farmS.target.toArray(),
  health:{state:f.state,alive:f.alive,armed:f.armed,wounds:own(f.wounds),limbs:own(f.limbs),muscle:f.muscle,armHealth:f.armHealth}};
}
function swordContacts(G,f){const rows=[];for(const c of f.swordColliders)G.world.contactPairsWith(c,o=>G.world.contactPair(c,o,(m,flipped)=>{if(m.numContacts())rows.push({a:c.handle,b:o.handle,otherBody:o.parent()?.handle,flipped,normal:{...m.normal()},contacts:Array.from({length:m.numContacts()},(_,i)=>({distance:m.contactDist(i),impulse:m.contactImpulse(i)}))});}));return rows;}
function allContacts(G){const rows=[],seen=new Set();G.world.colliders.forEach(c=>G.world.contactPairsWith(c,o=>{const a=Math.min(c.handle,o.handle),b=Math.max(c.handle,o.handle),key=a+':'+b;if(seen.has(key))return;seen.add(key);
 G.world.contactPair(G.world.getCollider(a),G.world.getCollider(b),(m,flipped)=>rows.push({a,b,flipped,normal:{...m.normal()},contacts:Array.from({length:m.numContacts()},(_,i)=>({distance:m.contactDist(i),impulse:m.contactImpulse(i)})),
  solverPoints:Array.from({length:m.numSolverContacts()},(_,i)=>({point:{...m.solverContactPoint(i)},distance:m.solverContactDist(i)}))}));
}));rows.sort((a,b)=>a.a-b.a||a.b-b.b);return rows;}
function poses(G){return G.world.bodies.getAll().map(b=>({handle:b.handle,...body(b)})).sort((a,b)=>a.handle-b.handle);}
function spec(j){const raw=j.joint.rawSet,h=j.joint.handle;return {handle:h,type:j.type,manual:j.manual,k:j.k,d:j.d,max:j.max,anchor1:{...j.joint.anchor1()},anchor2:{...j.joint.anchor2()},frame1:{...j.joint.frameX1()},frame2:{...j.joint.frameX2()},contacts:j.joint.contactsEnabled(),limits:{enabled:raw.jointLimitsEnabled(h,3),min:raw.jointLimitsMin(h,3),max:raw.jointLimitsMax(h,3)}};}
function finite(v){if(typeof v==='number')return Number.isFinite(v);return !v||typeof v!=='object'||Object.values(v).every(finite);}
function adapter(){return {replaceObservedMethod(f,n,fn){const had=Object.hasOwn(f,n),prev=f[n];f[n]=fn;return ()=>{assert(f[n]===fn,'Dispatch ownership lost');if(had)f[n]=prev;else delete f[n];};}};}
const phases=[['ready',1,[.15,.1]],['raise',.35,[.10,.45]],['raiseHold',.45,[.10,.45]],['cut',.25,[.10,-.45]],['stop',.30,[.10,-.45]],['reverse',.25,[.10,.45]],['reverseHold',.70,[.10,.45]]];
const schedule=[];let nominal=[.15,.1];
for(const [phase,seconds,target]of phases){const initial=nominal.slice(),ticks=Math.round(seconds/DT);for(let i=0;i<ticks;i++){
 const next=initial.map((v,k)=>v+(target[k]-v)*(i+1)/ticks),delta=next.map((v,k)=>v-nominal[k]);
 schedule.push({phase,tick:schedule.length,nominal:next,delta,held:true,active:Math.hypot(...delta)>1e-5});nominal=next;
}}
assert(schedule.length===396&&digest(schedule)===reference.scheduleSHA256&&digest(schedule)===digest(reference.schedule),'Exact root 396-step schedule required');
function phaseSummary(frames){return Object.fromEntries(phases.map(([phase])=>{const xs=frames.filter(x=>x.phase===phase),readings=xs.map(x=>x.postCombat),max=f=>Math.max(...readings.map(f)),rms=f=>Math.sqrt(readings.reduce((s,x)=>s+f(x)**2,0)/readings.length);
 return [phase,{frames:xs.length,maxHandErrorM:max(x=>x.handErrorM),rmsHandErrorM:rms(x=>x.handErrorM),maxAimErrorRad:max(x=>x.aimErrorRad),rmsAimErrorRad:rms(x=>x.aimErrorRad),
  maxSwordOmegaRadS:max(x=>x.swordOmegaRadS),maxSwingOmegaRadS:max(x=>Math.hypot(...x.swingOmega)),maxAxialOmegaRadS:max(x=>Math.abs(x.axialOmega)),maxSwordEnergyJ:max(x=>x.swordEnergy.totalJ),
  maxJointGapM:Math.max(...readings.flatMap(x=>x.jointGaps.map(j=>j.m))),maxLastSubstepCapRatio:Math.max(...xs.map(x=>x.nativeReadback.lastSubstepCapRatio)),
  last:readings.at(-1),contactManifoldOccurrences:xs.reduce((s,x)=>s+x.contacts.length,0),swordContactFrames:xs.filter(x=>x.swordContacts.length).length,
  combatStart:xs[0].events,combatEnd:xs.at(-1).events}];}));}
function run(weapon,mode){const row={weapon,mode,frames:[],errors:[],counts:{driveSword:0,driveJoints:0,externalFFCalls:0,nativeConfigure:0,nativeReadback:0},finite:true,jointPreserved:true,missingJoints:[]};let G,native,undoRaw;const undo=[],random=Math.random;
 try{
  G=newRound({seed:7,weapon,weapon2:'longsword',skill:0,difficulty:'normal',onFighter:f=>{f.onehandArmModel='manual';}});const f=G.player;f.skill.autoGuard=false;
  assert(G.t===0&&!G.parkEnemy&&!G.ai2&&G.ai instanceof AI&&CONFIG.GRIP.reactionModel==='paired','Actual default enemy/manual prerequisites');
  row.creation={native:digest([]),controller:digest(control(G))};row.creation.native=sha(G.world.takeSnapshot());
  row.config={playerSkill:f.skill.level,autoGuard:f.skill.autoGuard,actors:[f.onehandArmModel,G.enemy.onehandArmModel],grip:CONFIG.GRIP.reactionModel,
   selectors:['armTorqueModel','armRecoveryModel','gripPointModel','edgeIntentModel','edgeTorqueModel','wristBrakingModel','onehandAimModel'].map(k=>[k,f[k]??null])};
  const j=f.jointByName.farmS,raw=j.joint.rawSet,h=j.joint.handle,initialSpec=JSON.stringify(spec(j)),dispatch=adapter();
  for(const name of ['driveSword','driveJoints','elbowGravity']){const original=f[name];undo.push(dispatch.replaceObservedMethod(f,name,function(...args){row.counts[name==='elbowGravity'?'externalFFCalls':name]++;return original.apply(this,args);}));}
  const originalConfigure=raw.jointConfigureMotor;let requests=[];
  const capture=function(handle,axis,target,velocity,k,d){if(handle===h){assert(axis===3);row.counts.nativeConfigure++;requests.push({axis,target,velocity,k,d,cap:j.max*k/(j.k*(j.gain||1)),dt:f.lastDt,solverIterations:G.world.integrationParameters.numSolverIterations});}return originalConfigure.call(this,handle,axis,target,velocity,k,d);};
  raw.jointConfigureMotor=capture;undoRaw=()=>{assert(raw.jointConfigureMotor===capture);raw.jointConfigureMotor=originalConfigure;};
  if(mode!=='baseline')native=installNativeElbow({f,ledger:dispatch,mode:mode==='observe'?'observe':'capped',maxRecords:0});
  row.installNativeUnchanged=row.creation.native===sha(G.world.takeSnapshot());
  let prePhysics,postPhysics;const originalStep=G.world.step;
  G.world.step=function(...args){prePhysics=read(f);try{return originalStep.apply(this,args);}finally{postPhysics=read(f);}};
  undo.push(()=>{delete G.world.step;});
  for(const request of schedule){requests=[];
   f.handOffset.x+=request.delta[0];f.handOffset.y+=request.delta[1];f.handHeld=request.held;f.inputActive=request.active;
   // Same neutral request writes as the root baseline; no locomotion intervention.
   f.move.set(0,0);f.stickX=f.stickY=0;G.step();const motor=native?.afterStep()??null;
   assert.equal(requests.length,1,'Exactly one actual player farmS configure per frame');
   const configured=requests[0],substepDT=configured.dt/configured.solverIterations,impulse=raw.jointMotorImpulse(h,3),cap=configured.cap;
   const readback={maxForce:raw.jointMotorMaxForce(h,3),enabled:raw.jointMotorEnabled(h,3),lastSubstepImpulseNms:impulse,
    capNm:cap,lastSubstepDT:substepDT,lastSubstepTorqueEquivalentNm:impulse/substepDT,lastSubstepCapRatio:cap>0?Math.abs(impulse)/(cap*substepDT):impulse===0?0:null};
   row.counts.nativeReadback++;assert(readback.enabled&&finite(readback),'Actual enabled finite motor readback');
   if(mode==='capped')assert(Math.abs(readback.maxForce-cap)<=2e-5&&readback.lastSubstepCapRatio<=1.0001,'Actual cap readback failed');
   row.jointPreserved&&=j.joint.isValid()&&JSON.stringify(spec(j))===initialSpec;
   const actualPose=poses(G),postCombat=read(f),ev=events(G),contacts=allContacts(G),swordContactRows=swordContacts(G,f);
   row.finite&&=finite(actualPose)&&finite(postCombat)&&finite(prePhysics)&&finite(postPhysics)&&finite(contacts)&&finite(motor);
   row.missingJoints.push(...postCombat.missingJoints);
   const input={request,pad:f.handOffset.toArray(),aim:f.skill.aim.toArray(),aimRaw:f.skill.aimRaw.toArray(),aimVel:f.skill.aimVel.toArray(),held:f.handHeld,active:f.inputActive};
   row.frames.push({tick:request.tick,timeS:G.t,phase:request.phase,input,prePhysics,postPhysics,postCombat,contacts,swordContacts:swordContactRows,events:ev,
    elbowMotorRequests:requests,nativeReadback:readback,motor,trace:{native:sha(G.world.takeSnapshot()),pose:digest(actualPose),controller:digest(control(G)),input:digest(input),events:digest(ev),contacts:digest(contacts)}});
  }
  row.nativeSummary=native?{...native.summary}:null;row.summary=phaseSummary(row.frames);row.finalEvents=events(G);
  row.executionPass=row.finite&&row.jointPreserved&&row.installNativeUnchanged&&!row.missingJoints.length&&row.frames.length===396&&
   ['driveSword','driveJoints','nativeConfigure','nativeReadback'].every(k=>row.counts[k]===396)&&(!native||native.summary.nativeCalls===396&&native.summary.measurements===396&&!native.summary.errors.length)&&
   (mode!=='capped'||native.summary.explicitGravityCalls===396&&row.counts.externalFFCalls===0);
 }catch(e){row.errors.push(e.stack??String(e));row.executionPass=false;row.nativeSummary=native?{...native.summary}:null;}
 finally{try{native?.restore();undoRaw?.();undo.reverse().forEach(fn=>fn());}catch(e){row.errors.push(e.stack??String(e));row.executionPass=false;}G?.eventQueue.free();G?.world.free();Math.random=random;}
 return row;
}
function firstDifference(a,b,read){const i=a.frames.findIndex((x,i)=>digest(read(x))!==digest(read(b.frames[i])));return i<0?null:{tick:i,timeS:a.frames[i].timeS,phase:a.frames[i].phase};}
const traceKeys=['native','pose','controller','input','events','contacts'];
const normalizedPose=read=>({bodies:Object.fromEntries(Object.entries(read.bodies).map(([k,b])=>[k,{p:b.p,q:b.q,v:b.v,w:b.w}])),sword:{p:read.sword.p,q:read.sword.q,v:read.sword.v,w:read.sword.w}});
const rows=[],comparisons=[],engineComparisons=[];
for(const weapon of ['sabre','qinggang']){
 const group=[];for(const mode of ['baseline','observe','capped']){const row=run(weapon,mode);rows.push(row);group.push(row);
  console.log(JSON.stringify({weapon,mode,executionPass:row.executionPass,steps:row.frames.length,counts:row.counts,native:row.nativeSummary,errors:row.errors}));}
 const [base,observe,capped]=group;
 const parity=traceKeys.every(k=>base.frames.length===observe.frames.length&&base.frames.every((f,i)=>f.trace[k]===observe.frames[i]?.trace[k]));
 comparisons.push({weapon,observerFullTraceExact:parity,observerCreationExact:digest(base.creation)===digest(observe.creation),
  allCreationNativeExact:group.every(r=>r.creation.native===base.creation.native),sameDefaultSelectors:group.every(r=>digest(r.config)===digest(base.config)),
  observerRawNativeReadbacksExact:base.frames.every((f,i)=>digest(f.nativeReadback)===digest(observe.frames[i]?.nativeReadback)),
  firstCappedDivergence:Object.fromEntries(traceKeys.map(k=>[k,firstDifference(base,capped,f=>f?.trace[k])]))});
 const npm=reference.rows.find(r=>r.weapon===weapon&&r.observed);assert(npm?.frames.length===396,'Exact matching npm frame row required');
 const comparison={weapon,selectedPlayerBodyScope:['chest','uarmS','farmS','pelvis','footF','footB','sword'],phaseTimeExact:base.frames.every((f,i)=>f.phase===npm.frames[i].phase&&f.timeS===npm.frames[i].timeS),
  firstPostPhysicsPoseDifference:firstDifference(base,npm,f=>normalizedPose(f.postPhysics)),firstPostCombatPoseDifference:firstDifference(base,npm,f=>normalizedPose(f.postCombat)),
  firstInputDifference:firstDifference(base,npm,f=>f.input),firstSwordContactDifference:firstDifference(base,npm,f=>f.swordContacts),firstEventDifference:firstDifference(base,npm,f=>f.events),
  firstControllerTraceDifference:base.frames.findIndex((f,i)=>f.trace.controller!==npm.trace[i].controller)};
 comparison.recordedTrajectoryExact=comparison.phaseTimeExact&&['firstPostPhysicsPoseDifference','firstPostCombatPoseDifference','firstInputDifference','firstSwordContactDifference','firstEventDifference'].every(k=>comparison[k]===null);
 comparison.meaning='Exact equality only for this recorded current manual-B protocol and the selected player body poses/input/sword-contact/events. Native binary/snapshot equality and broad engine equivalence are not inferred.';
 engineComparisons.push(comparison);
}
const after=manifest(),engineAfter=sha(fs.readFileSync(modulePath));
const sourceStable=digest(before)===digest(after)&&engineHash===engineAfter&&sha(fs.readFileSync(calibrationPath))===sha(calibrationBytes)&&sha(fs.readFileSync(referencePath))===sha(referenceBytes);
const report={schemaVersion:1,sourceCommit:reference.sourceCommit,sourceProvenance:'Commit label from passed npm reference; no Git invoked/accessed. New probe bytes recorded by manifest, actual game source compared to the passed reference.',
 startedUTC,completedUTC:new Date().toISOString(),wallSeconds:(performance.now()-start)/1000,argv:process.argv.slice(2),sourceBefore:before,sourceAfter:after,sourceStable,
 engine:{modulePath,sha256:engineHash,sha256After:engineAfter,calibrationPath,calibrationSHA256:sha(calibrationBytes),calibrationSourceSHA256:calibrationSource},
 reference:{path:referencePath,sha256:sha(referenceBytes),sourceCommit:reference.sourceCommit,currentGameMatchesReference},
 transformed:{harnessPath,harnessSHA256:sha(rewritten),toolSHA256:before['tools/sim/experiments/native_onehand_stop_probe.mjs']},
 dt:DT,schedule,scheduleSHA256:digest(schedule),rows,comparisons,engineComparisons,
 protocol:{weapons:['sabre','qinggang'],modes:['baseline','observe','capped'],seed:7,manual:'Both actor manual selectors set before initializeOnehandReadyPose; player skill0 and autoGuardfalse. Original normal enemy, default gap/walls; no AI2/park/C2/body/health injection.',
  input:'Exact original396-step schedule; nominal deltas add to live pad, heldtrue, active iff delta length>1e-5, same neutral move/stick writes as root recording.',
  candidate:'Player farmS native cap from creation. Same native hinge handle/anchors/frames/limits retained; existing gravity FF inside ForceBased target bias and original explicit FF suppressed. Other muscles retain current defaults.',
  baseline:'Counting wrappers and actual rawconfigure/readback capture, no installNativeElbow; observe additionally installs actual native configure observer.',
  motor:'Actual last solver substep impulse/cap ratio. impulse/substepDT is a last-substep torque equivalent, not outer-step average torque, whole motor work, or a physiological muscle cap.',
  contacts:'Actual full-world post-solver manifold trace plus npm-compatible player sword contacts. Raw contact impulses are not paired with solver point arrays.',
  acceptance:'Measurement validity only. Force cap compliance or reduced speed/energy does not establish game benefit, physical/human acceptance, or current-engine equivalence outside recorded comparison.'}};
report.executionPass=sourceStable&&rows.length===6&&rows.every(r=>r.executionPass)&&comparisons.every(c=>c.observerFullTraceExact&&c.observerCreationExact&&c.allCreationNativeExact&&c.sameDefaultSelectors&&c.observerRawNativeReadbacksExact);
report.recordedNpmTrajectoryExact=engineComparisons.every(c=>c.recordedTrajectoryExact);
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
fs.writeFileSync(out+'.summary.json',JSON.stringify({...report,rows:rows.map(({frames,...r})=>({...r,frameCount:frames.length}))},null,2)+'\n',{flag:'wx'});
fs.copyFileSync(fileURLToPath(import.meta.url),out+'.tool.mjs',fs.constants.COPYFILE_EXCL);
console.log(JSON.stringify({out,rawSHA256:sha(fs.readFileSync(out)),executionPass:report.executionPass,sourceStable,recordedNpmTrajectoryExact:report.recordedNpmTrajectoryExact,wallSeconds:report.wallSeconds,comparisons,engineComparisons}));
if(!report.executionPass)process.exitCode=1;
