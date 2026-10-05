/** Existing ordinary-v2 actual partial main-arm injury followed by one input tape.
 * Preserves P5 row0 through its real tick1066 cut; no health/force/state rewrite.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {newRound,AI,THREE,DT,CONFIG} from '../harness_m.mjs';
import {applySwordsmanship,recordSwordsmanshipInput} from '../../../src/swordsmanship.js';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const m=/^--(out|reference)=(.+)$/.exec(a);assert(m);return[m[1],m[2]];}));
assert(args.out&&path.isAbsolute(args.out)&&!fs.existsSync(args.out));assert(args.reference&&path.isAbsolute(args.reference));
const source=JSON.parse(fs.readFileSync(path.join(root,'SOURCE.json'),'utf8'));
const sha=x=>createHash('sha256').update(x).digest('hex'),norm=v=>Math.hypot(v.x,v.y,v.z),V=v=>({x:v.x,y:v.y,z:v.z});
const referenceBytes=fs.readFileSync(args.reference),reference=JSON.parse(referenceBytes),baseline=reference.rows[0];
assert(reference.measurementValid);assert.deepEqual(baseline.weapons,['longsword','zweihander']);assert.equal(baseline.mode,'legacy');
const scan=d=>fs.readdirSync(path.join(root,d),{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(d+'/'+e.name):e.name.endsWith('.js')?[d+'/'+e.name]:[]);
const files=[...scan('src'),'tools/sim/harness_m.mjs','tools/sim/experiments/injury_v2_gate_probe.mjs','package-lock.json','node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'].sort();
const manifest=()=>Object.fromEntries(files.map(p=>[p,sha(fs.readFileSync(path.join(root,p)))]));
const sourceBefore=manifest(),sourceChanges=[];
for(const p of files.filter(p=>!p.includes('injury_v2_gate_probe'))){
 if(sourceBefore[p]===reference.sourceBefore[p])continue;
 assert(['src/gait.js','src/main.js','src/stance_v2_trial.js','src/swordsmanship_default.js'].includes(p),`Unexpected reference source change: ${p}`);
 assert.equal(sourceBefore[p],source.allowedReferenceChanges[p],`Reviewed source bridge differs: ${p}`);
 sourceChanges.push({path:p,referenceSHA256:reference.sourceBefore[p]??null,currentSHA256:sourceBefore[p]});
}
const injuryTick=1066,firstInputTick=1067;
const tape=[['release',36,[0,0],false],['reverse',30,[-.40,.70],true],['hold',30,[0,0],true],['recut',30,[.40,-.70],true],['releaseAfter',54,[0,0],false]].flatMap(([phase,steps,delta,held])=>Array.from({length:steps},()=>({phase,dx:delta[0]/steps,dy:delta[1]/steps,held,active:Math.abs(delta[0]/steps)+Math.abs(delta[1]/steps)>1e-5})));
const endTick=firstInputTick+tape.length-1;
fs.mkdirSync(args.out,{recursive:true});
function plain(v,depth=0,seen=new WeakSet()){
 if(v==null||['string','number','boolean'].includes(typeof v))return v;
 if(typeof v!=='object'||depth>7)return undefined;
 if(v.isVector2||v.isVector3||v.isQuaternion||v.isEuler)return v.toArray();
 if(seen.has(v))return {$shared:true};seen.add(v);
 if(Array.isArray(v))return v.map(x=>plain(x,depth+1,seen));
 return Object.fromEntries(Object.entries(v).filter(([k,x])=>!['me','f','fighter','foe','world','scene','R','raw','rawSet','profile','table'].includes(k)&&typeof x!=='function').map(([k,x])=>[k,plain(x,depth+1,seen)]).filter(([,x])=>x!==undefined));
}
const controls=f=>({state:f.state,stateTime:f.stateTime,alive:f.alive,armed:f.armed,handOffset:f.handOffset.toArray(),handHeld:f.handHeld,inputActive:f.inputActive,move:f.move.toArray(),heading:f.heading,blood:f.blood,pain:f.pain,limbs:{...f.limbs},bodyPose:{...f.bodyPose},bodyPoseVel:{...f.bodyPoseVel},skill:plain(f.skill),gait:plain(f.gait),assist:plain(f.swordsmanshipState),joints:f.joints.map(j=>({name:j.name,target:j.target.toArray(),k:j.k,d:j.d,max:j.max,gain:j.gain??1}))});
function selectedState(G){return {timeS:G.t,fighters:[G.player,G.enemy].map(f=>{
 const q=new THREE.Quaternion().copy(f.bodies.chest.rotation()),up=new THREE.Vector3(0,1,0).applyQuaternion(q);
 const gaps=[...f.joints.map(j=>({name:j.name,joint:j.joint})),{name:'grip',joint:f.gripJoint}].filter(x=>x.joint?.isValid()).map(({name,joint:j})=>{
  const a=new THREE.Vector3().copy(j.anchor1()).applyQuaternion(new THREE.Quaternion().copy(j.body1().rotation())).add(new THREE.Vector3().copy(j.body1().translation()));
  const b=new THREE.Vector3().copy(j.anchor2()).applyQuaternion(new THREE.Quaternion().copy(j.body2().rotation())).add(new THREE.Vector3().copy(j.body2().translation()));return {name,gapM:a.distanceTo(b)};
 });
 const spin=Object.entries({...f.bodies,sword:f.sword}).filter(([,b])=>b?.isValid()).map(([part,b])=>{const axis=new THREE.Vector3(...(['uarmS','farmS'].includes(part)?[1,0,0]:[0,1,0])).applyQuaternion(new THREE.Quaternion().copy(b.rotation()));return {part,heightM:b.translation().y,detached:f.detachedParts?.has(part)??false,speedMps:norm(b.linvel()),omegaRadps:norm(b.angvel()),axialRadps:axis.dot(new THREE.Vector3().copy(b.angvel()))};});
 return {index:f.index,control:{armHealth:f.armHealth,pain:f.pain,handOffset:f.handOffset.toArray(),inputActive:!!f.inputActive,handHeld:!!f.handHeld,assist:{phase:f.swordsmanshipState?.phase,owner:f.swordsmanshipState?.owner,eligible:f.swordsmanshipState?.eligible,availability:f.swordsmanshipState?.availability},wristTorque:f.debug.wristTorque?.toArray(),wristCap:f.debug.wristCap},state:f.state,alive:f.alive,armed:f.armed,gripping:!!f.gripping,gripValid:!!f.gripJoint?.isValid(),blood:f.blood,consciousness:f.consciousness,limbs:{...f.limbs},chestTiltRad:Math.acos(Math.max(-1,Math.min(1,up.y))),pelvisHeightM:f.bodies.pelvis.translation().y,gaps,spin};
})};}

const row={frames:[],requests:[],drive:[],observations:[],boundary:null};
const checks={creationExact:false,prefixExact:true,realInjuryBoundaryExact:false,inputAccepted:true,finite:true,ordinaryV2:true};
let G,tick=0,currentInput=null,activeDrive=null,error=null,stopSignal=null;
const startedUTC=new Date().toISOString(),started=performance.now(),savedRandom=Math.random;
const interrupt=()=>{stopSignal='SIGINT';},terminate=()=>{stopSignal='SIGTERM';};process.on('SIGINT',interrupt);process.on('SIGTERM',terminate);
function driveContext(f){return{alive:f.alive,armed:f.armed,state:f.state,armHealth:f.armHealth,limbs:{...f.limbs},pain:f.pain,muscle:f.muscle,assist:{phase:f.swordsmanshipState?.phase,owner:f.swordsmanshipState?.owner,eligible:f.swordsmanshipState?.eligible,availability:f.swordsmanshipState?.availability},gripValid:!!f.gripJoint?.isValid(),offGripValid:!!f.offGripJoint?.isValid()};}
try{
 G=newRound({seed:7,weapon:'longsword',weapon2:'zweihander',walls:false,AIClass:AI,AI2Class:AI,onFighter:f=>{
  if(f.index!==0)return;f.onehandArmModel='manual';
  const drive=f.driveSword;f.driveSword=function(...a){
   if(tick<injuryTick-1)return drive.apply(this,a);
   activeDrive={tick,timeBeforeStepS:G.t,pre:driveContext(f),torqueCalls:[]};
   try{return drive.apply(this,a);}finally{activeDrive.postDebug={wristTorque:f.debug.wristTorque?.toArray(),wristCap:f.debug.wristCap};row.drive.push(activeDrive);activeDrive=null;}
  };
  for(const [part,b]of [['sword',f.sword],['farmS',f.bodies.farmS]]){const add=b.addTorque;b.addTorque=function(...a){if(activeDrive)activeDrive.torqueCalls.push({part,torqueNm:V(a[0]),magnitudeNm:norm(a[0]),omegaAtCall:V(b.angvel())});return add.apply(this,a);};}
 }});
 assert(applySwordsmanship(G.player));G.combat.cutReactionModel='legacy';G.combat.cutReactionFighter=null;
 assert.equal(G.player.skill.level,0);assert.equal(G.player.skill.autoGuard,false);assert.equal(CONFIG.GAIT.stanceMemory,'legacy');
 row.creationNativeSHA256=sha(G.world.takeSnapshot());checks.creationExact=row.creationNativeSHA256===baseline.creationNativeSHA256;assert(checks.creationExact);
 let previous=G.player.handOffset.clone();
 G.before=()=>{
  const f=G.player;
  if(tick>=firstInputTick){
   const request=tape[tick-firstInputTick];f.handHeld=request.held;f.inputActive=request.active;f.move.set(0,0);f.stickX=f.stickY=0;
   const dx=f.alive&&!f.weapon?.gun?request.dx:0,dy=f.alive&&!f.weapon?.gun?request.dy:0;
   f.handOffset.x+=dx;f.handOffset.y+=dy;currentInput={id:tick,timeS:G.t,dx,dy,held:request.held,active:request.active};
   const accepted=recordSwordsmanshipInput(f,currentInput);checks.inputAccepted&&=accepted;row.requests.push({tick,phase:request.phase,requested:{...request},applied:{...currentInput},accepted,beforeGameStep:driveContext(f)});
  }else{const delta=f.handOffset.clone().sub(previous);currentInput={id:tick,timeS:G.t,dx:delta.x,dy:delta.y,held:!!f.handHeld,active:!!f.inputActive};checks.inputAccepted&&=recordSwordsmanshipInput(f,currentInput);}
 };
 for(tick=0;tick<=endTick;tick++){
  if(tick%120===0)await new Promise(resolve=>setImmediate(resolve));if(stopSignal)throw Error(`Interrupted by ${stopSignal}; partial measurement preserved`);
  if(tick===firstInputTick)G.ai2=null;
  G.step();previous.copy(G.player.handOffset);
  const frame=[tick,sha(G.world.takeSnapshot()),sha(JSON.stringify({fighters:[controls(G.player),controls(G.enemy)],ai:plain(G.ai),ai2:plain(G.ai2)})),sha(JSON.stringify({player:currentInput,enemy:{pad:G.enemy.handOffset.toArray(),active:G.enemy.inputActive,move:G.enemy.move.toArray(),tap:plain(G.enemy.skill.tap)}}))];row.frames.push(frame);
  if(tick<=injuryTick&&JSON.stringify(frame)!==JSON.stringify(baseline.frames[tick])){checks.prefixExact=false;throw Error(`Prefix mismatch at ${tick}; comparison stopped`);}
  if(tick===injuryTick){const f=G.player;row.boundary={tick,timeS:G.t,context:driveContext(f),nativeSHA256:frame[1],controlSHA256:frame[2],inputSHA256:frame[3]};checks.realInjuryBoundaryExact=f.alive&&f.armed&&f.gripJoint.isValid()&&f.armHealth===baseline.metrics[tick].fighters[0].control.armHealth;assert(checks.realInjuryBoundaryExact);}
  checks.finite&&=G.world.bodies.getAll().every(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].every(v=>Object.values(v).every(Number.isFinite)));
  checks.ordinaryV2&&=G.player.swordsmanshipState?.version==='unified-20261005-r2'&&G.player.skill.level===0&&G.player.skill.autoGuard===false&&G.combat.cutReactionModel==='legacy'&&CONFIG.GAIT.stanceMemory==='legacy'&&G.player.stanceMemoryModel!=='fresh';
  if(tick>=injuryTick-1){const f=G.player,wrist=new THREE.Vector3(.13,0,0).applyQuaternion(new THREE.Quaternion().copy(f.bodies.farmS.rotation())).add(new THREE.Vector3().copy(f.bodies.farmS.translation())),tip=f.bladePoint(1,new THREE.Vector3());
   row.observations.push({tick,phase:tick>=firstInputTick?tape[tick-firstInputTick].phase:'pre_input',...selectedState(G),postCombat:driveContext(f),handTarget:f.handTarget.toArray(),handWorld:wrist.toArray(),handErrorM:wrist.distanceTo(f.handTarget),tipSpeedMps:norm(f.sword.velocityAtPoint(tip)),inputState:{handHeld:f.handHeld,inputActive:f.inputActive,pad:f.handOffset.toArray()},v2:plain(f.swordsmanshipState)});
  }
  assert(checks.finite,'Nonfinite state');
 }
}catch(e){error={name:e.name,message:e.message,stack:e.stack};}
finally{
 if(G){row.wounds=G.wounds.map(w=>({timeS:w.t,attacker:w.att.index,victim:w.vic.index,type:w.type,zone:w.zone,energyJ:w.energy,severity:w.severity}));row.final=driveContext(G.player);}
 process.off('SIGINT',interrupt);process.off('SIGTERM',terminate);G?.eventQueue.free();G?.world.free();Math.random=savedRandom;
 const sourceAfter=manifest(),sourceStable=JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter),measurementValid=!error&&sourceStable&&Object.values(checks).every(Boolean)&&row.frames.length===endTick+1;
 const report={schemaVersion:1,experiment:'injury_v2_gate',head:source.head,source,sourceBefore,sourceAfter,sourceStable,sourceChanges,command:process.argv,startedUTC,completedUTC:new Date().toISOString(),wallSeconds:(performance.now()-started)/1000,measurementValid,effectAccepted:false,error,checks,protocol:{injuryTick,firstInputTick,endTick,executionCount:1,dt:DT,reference:{path:args.reference,sha256:sha(referenceBytes),row:0},scope:'Current ordinary v2r2, actual main-arm .80847 injury; large partial damage not exposed. Same P5 prefix, then player AI only stopped and one release/reverse/hold/recut/release tape. Original opponent remains. No force/health/pain/state/availability overwrite. Main L1 threshold1e-5 and held/release record contract; no browser120Hz cadence or hitstop equivalence claimed.',tape,driveObservation:'Actual sword/farmS addTorque arguments inside driveSword, with pre-drive context. postDebug is last computed request, not by itself proof of a new call; postCombat health may change after that drive.'},row};
 const file=path.join(args.out,'report.json');fs.writeFileSync(file,JSON.stringify(report)+'\n');const bytes=fs.readFileSync(file);fs.writeFileSync(path.join(args.out,'receipt.json'),JSON.stringify({rawPath:file,rawBytes:bytes.length,rawSHA256:sha(bytes),measurementValid,error,checks,steps:row.frames.length,executionCount:1,wallSeconds:report.wallSeconds,sourceStable,command:process.argv},null,2)+'\n');console.log(JSON.stringify({measurementValid,error,checks,steps:row.frames.length,requests:row.requests.length,wallSeconds:report.wallSeconds,final:row.final}));if(!measurementValid)process.exitCode=1;
}
