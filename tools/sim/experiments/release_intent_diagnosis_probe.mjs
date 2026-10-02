// Q04 observation only. No controller candidate, disabled return, cap or gain change.
import {runStroke} from '../whole_body_strike_probe.mjs';
import {installForceLedger} from '../force_ledger.mjs';
import {THREE} from '../harness_m.mjs';
import {readFile,writeFile,readdir,mkdtemp,rm,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
const root=new URL('../../../',import.meta.url),fighterURL=new URL('src/fighter.js',root),sha=x=>createHash('sha256').update(x).digest('hex');
const output=process.argv[2]??'/workspace/halfsword-hybrid-evidence/q04-release-intent-r1.json';
try{await access(output);throw Error('Refuse overwrite');}catch(e){if(e.code!=='ENOENT')throw e;}
function once(s,a,b){if(s.split(a).length!==2)throw Error('Source observation marker mismatch: '+a);return s.replace(a,b);}
async function loadObserver(){
 let source=await readFile(fighterURL,'utf8');
 source=once(source,'    torque.addScaledVector(wSwing.sub(wAim), -damp);',`    rdRecords.set(this,{wrist:{targetOmega:wAim.toArray(),actualSwingOmega:wSwing.toArray(),actualWorldOmega:w.toArray(),forearmOmega:Object.values(forearm.angvel()),
      positionRequestNm:torque.toArray(),targetSpeedRequestNm:wAim.clone().multiplyScalar(damp).toArray(),actualDampingRequestNm:wSwing.clone().multiplyScalar(-damp).toArray(),damping:damp,angleErrorRad:angle,braking:!!this.wristBrake}});
    torque.addScaledVector(wSwing.sub(wAim), -damp);`);
 source=once(source,'    torque.add(_mG);','    rdRecords.get(this).wrist.gravityRequestNm=_mG.toArray();\n    torque.add(_mG);');
 source=once(source,'    const tl = torque.length();','    rdRecords.get(this).wrist.preLimitRequestNm=torque.toArray();\n    const tl = torque.length();');
 source=once(source,'    sword.addTorque(vecArg(torque), true);','    rdRecords.get(this).wrist.appliedNm=torque.toArray();rdRecords.get(this).wrist.capNm=cap;\n    sword.addTorque(vecArg(torque), true);');
 source=once(source,'    // 휘두르는 방향(뼈에 수직)\n    _mT.copy(_mE)',`    rdRecords.get(this).shoulder={targetRelativeOmega:wT.toArray(),actualRelativeOmega:[wc.x-wp.x,wc.y-wp.y,wc.z-wp.z],parentOmega:[wp.x,wp.y,wp.z],targetWorldOmegaApprox:[wT.x+wp.x,wT.y+wp.y,wT.z+wp.z],boneAxis:boneAxis.toArray(),targetTwistRadps:wT.dot(boneAxis),actualTwistRadps:wTw,targetQuaternion:j.target.toArray()};
    // 휘두르는 방향(뼈에 수직)
    _mT.copy(_mE)`);
 source=once(source,'    const wErr = _mW.sub(wT);','    rdRecords.get(this).shoulder.positionRequestNm=_mT.toArray();\n    const wErr = _mW.sub(wT);');
 source=once(source,'    // 중력 보상: 팔과 칼의 무게를 미리 알고 버틴다',`    rdRecords.get(this).shoulder.preGravityRequestNm=_mT.toArray();
    rdRecords.get(this).shoulder.targetSpeedRequestNm=wT.clone().addScaledVector(boneAxis,-wT.dot(boneAxis)).multiplyScalar(d).toArray();
    // 중력 보상: 팔과 칼의 무게를 미리 알고 버틴다`);
 source=once(source,'    const twistFF = THREE.MathUtils.clamp(_mG.dot(boneAxis), -10, 10);','    rdRecords.get(this).shoulder.gravityRequestNm=_mG.toArray();\n    const twistFF = THREE.MathUtils.clamp(_mG.dot(boneAxis), -10, 10);');
 source=once(source,'    const tlen = _mT.length();','    rdRecords.get(this).shoulder.preLimitSwingRequestNm=_mT.toArray();\n    const tlen = _mT.length();');
 source=once(source,'    j.child.addTorque(vecArg(_mT), true);','    rdRecords.get(this).shoulder.appliedNm=_mT.toArray();rdRecords.get(this).shoulder.capNm=cap;\n    j.child.addTorque(vecArg(_mT), true);');
 source='const rdRecords=new WeakMap();export function rdRead(f){return rdRecords.get(f);}\n'+source;
 source=source.replace(/from (['"])([^'"]+)\1/g,(_,q,s)=>'from '+JSON.stringify(s.startsWith('.')?new URL(s,fighterURL).href:import.meta.resolve(s)));
 const directory=await mkdtemp(join(tmpdir(),'q04-release-observe-')),path=join(directory,'observe.mjs');await writeFile(path,source);
 try{return {module:await import(pathToFileURL(path).href),sourceSHA256:sha(source),cleanup:()=>rm(directory,{recursive:true,force:true})};}catch(e){await rm(directory,{recursive:true,force:true});throw e;}
}
async function manifest(){
 async function scan(dir){const out=[];for(const e of await readdir(new URL(dir,root),{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())out.push(...await scan(p));else if(e.name.endsWith('.js'))out.push(p);}return out;}
 const files=[...await scan('src'),'package-lock.json','tools/sim/whole_body_strike_probe.mjs','tools/sim/harness_m.mjs','tools/sim/force_ledger.mjs','tools/sim/experiments/release_intent_diagnosis_probe.mjs','node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'];
 return Object.fromEntries(await Promise.all(files.sort().map(async p=>[p,sha(await readFile(new URL(p,root)))])));
}
function intervention(module,observe){
 const undo=[],native=createHash('sha256'),stroke=createHash('sha256');const record={frames:[],dispatch:{driveSword:0,manualMuscle:0}};
 return {record,activate({f,ledger}){
  if(observe)for(const method of ['driveSword','manualMuscle'])undo.push(ledger.replaceObservedMethod(f,method,function(...args){record.dispatch[method]++;return module.Fighter.prototype[method].apply(this,args);}));
 },afterStep({G,f,ledger,sample:s,iteration,DT}){
  const snapshot=G.world.takeSnapshot();native.update(snapshot);if(s.phase==='stroke')stroke.update(snapshot);
  if(!observe)return;
  const paths={},torques=[];let swordGravityWorkJ=0;
  for(const p of ledger.latest.physics){const a=p.pre.bodies.find(x=>x.label==='0:sword'),b=p.post.bodies.find(x=>x.label==='0:sword');swordGravityWorkJ+=a.V-b.V;
   for(const [path,x] of Object.entries(p.balance.byPath))if(/\.(manualMuscle|driveSword|elbowGravity|offHand)$/.test(path)){const y=paths[path]??={workApproxJ:0,bodyWork:{}};y.workApproxJ+=x.workApproxJ;for(const [body,z] of Object.entries(x.bodies))y.bodyWork[body]=(y.bodyWork[body]??0)+z.workApproxJ;}
  }
  for(const e of ledger.latest.operations)if(e.method==='addTorque'&&/\.(manualMuscle|driveSword|elbowGravity)$/.test(e.path))torques.push({path:e.path,body:e.label,torqueNm:e.input});
  record.frames.push({step:iteration,controlTimeS:s.timeS-DT,postTimeS:s.timeS,phase:s.phase,handHeld:f.handHeld,inputActive:f.inputActive,actualHandOffset:f.handOffset.toArray(),
    skill:{aim:f.skill.aim.toArray(),aimRaw:f.skill.aimRaw.toArray(),aimVel:f.skill.aimVel.toArray(),rawInputVelocity:f.skill.vel.toArray(),anchor:f.skill.anchor.toArray(),follow:f.skill.follow.toArray(),swinging:f.skill.swinging,recovering:f.skill.recovering,cutPending:f.skill.cutPending,idle:f.skill.idle,activity:f.skill.activity,filterW:f.skill.filterW},
    handTarget: s.desiredHandWorldMFromPreStep,aimTarget:s.desiredBladeAxisWorldFromPreStep,preController:module.rdRead(f),postActual:{chestOmega:s.chest.angularVelocityRadps,swordOmega:s.sword.angularVelocityRadps,swordKJ:s.swordEnergy.translationJ+s.swordEnergy.rotationJ,handErrorM:s.handTargetErrorM,bladeErrorRad:s.bladeAimErrorRad},swordGravityWorkJ,paths,torques});
 },restore(){record.nativeTraceSHA256=native.digest('hex');record.strokeNativeTraceSHA256=stroke.digest('hex');for(const restore of undo.reverse())restore();}};
}
const before=await manifest(),start=performance.now(),rows=[],guards=[];let observer,error=null;
try{
 observer=await loadObserver();
 for(const weapon of ['longsword','zweihander'])for(const direction of ['down','up'])for(const ending of ['release','target_hold']){
  const condition={weapon,direction,ending,reaction:'paired'},off=intervention(null,false),plain=runStroke({...condition,intervention:off});
  const on=intervention(observer.module,true),row=runStroke({...condition,ledgerFactory:G=>installForceLedger(G,{fighters:[G.player],sampleEvery:8,maxSamples:0}),intervention:on});row.diagnosis=on.record;rows.push(row);
  const guard={weapon,direction,ending,startNativeExact:plain.startNativeSha256===row.startNativeSha256,startControllerExact:plain.startSha256===row.startSha256,inputExact:plain.inputSha256===row.inputSha256,physicalControlTraceExact:plain.traceSha256===row.traceSha256,nativeTraceExact:off.record.nativeTraceSHA256===on.record.nativeTraceSHA256,dispatchExact:on.record.dispatch.driveSword===210&&on.record.dispatch.manualMuscle===210,finite:row.finite};guards.push(guard);if(Object.values(guard).includes(false))throw Error('Observer gate failed:'+JSON.stringify(guard));console.log(JSON.stringify({progress:condition,guard}));
 }
}catch(e){error=e.stack;}finally{await observer?.cleanup();}
const after=await manifest(),sourceStable=JSON.stringify(before)===JSON.stringify(after),h=(await readFile(new URL('.git/HEAD',root),'utf8')).trim(),commit=h.startsWith('ref: ')?(await readFile(new URL('.git/'+h.slice(5),root),'utf8')).trim():h;
const result={probe:'q04-release-intent-observation',sourceCommit:commit,sourceSHA256:before,sourceSHA256After:after,sourceStable,temporaryObserverSHA256:observer?.sourceSHA256,error,wallSeconds:(performance.now()-start)/1000,guards,executedRows:16,observedRows:8,
 protocol:{preparation:'Legacy3s, pairedmeasurement; drag.55s; ending1.2s; seed7; actual G.step/native unchanged.',controlTime:'pre-physics timestamp; skill update already complete. Skill recovery writes handOffset AFTER aimRaw/filter in that frame, so aim responds next step.',torque:'Controller component requests before Hill/cap plus actual applied vectors separately. No counterfactual component work; path signed midpoint work includes recorded reaction bodies.',angularVelocity:'Shoulder targetRelativeOmega is parent-relative rate expressed in world; targetWorldOmegaApprox adds actual pre-step parent omega. Wrist targetOmega is the existing world target cross-product rate projected perpendicular to current blade. Actual rates recorded before physics and after physics.',limits:'No intervention/return/cap/gain changes; only unopposed healthy strokes. No native total work or human/mobile verdict.'},rows};
await writeFile(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({output,sourceStable,error,wallSeconds:result.wallSeconds}));if(error||!sourceStable)process.exitCode=1;
