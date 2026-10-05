/** One current-v2 armed recovery: reuse the completed P5 baseline, run one player-only fresh candidate.
 * Initial stance is deliberately untouched; subsequent Gait.enter calls clear only Nf.
 * No global setting, AI, injury, force, target or timer is changed by the candidate.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {newRound,AI,THREE,DT,CONFIG} from '../harness_m.mjs';
import {applySwordsmanship,recordSwordsmanshipInput} from '../../../src/swordsmanship.js';
import {clearStanceFrictionMemory} from '../../../src/stance_memory.js';
import {collectSupportContacts} from '../../../src/support_contacts.js';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const m=/^--(out|reference|mode|input|bridge)=(.+)$/.exec(a);assert(m,'Unknown argument');return[m[1],m[2]];}));
assert(args.out&&path.isAbsolute(args.out)&&!fs.existsSync(args.out));assert(args.reference&&path.isAbsolute(args.reference));
const sha=x=>createHash('sha256').update(x).digest('hex'),norm=v=>Math.hypot(v.x,v.y,v.z),V=v=>({x:v.x,y:v.y,z:v.z});
const production=!!args.bridge;const bridgeBytes=production?fs.readFileSync(args.bridge):null,bridge=production?JSON.parse(bridgeBytes):null;
const mode=args.mode??'fresh',scripted=args.input==='recut';if(production)assert(mode==='fresh'&&scripted&&bridge.measurementValid);
assert(['fresh','legacy'].includes(mode));assert(!args.input||scripted);assert(mode==='fresh'||scripted);
const source=JSON.parse(fs.readFileSync(path.join(root,'SOURCE.json'),'utf8'));
const referenceBytes=fs.readFileSync(args.reference),reference=JSON.parse(referenceBytes),baseline=reference.rows[2];
assert(reference.measurementValid&&reference.head===source.head);
assert.deepEqual(baseline.weapons,['zweihander','longsword']);assert.equal(baseline.mode,'legacy');assert.equal(baseline.seed,7);
assert.equal(CONFIG.GAIT.stanceMemory,'legacy');assert.equal(CONFIG.BODY.supportModel,'legacy');
const scan=d=>fs.readdirSync(path.join(root,d),{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(d+'/'+e.name):e.name.endsWith('.js')?[d+'/'+e.name]:[]);
const files=[...scan('src'),'tools/sim/harness_m.mjs','tools/sim/experiments/recovery_v2_memory_probe.mjs','package-lock.json','node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'].sort();
const manifest=()=>Object.fromEntries(files.map(p=>[p,sha(fs.readFileSync(path.join(root,p)))]));
const sourceBefore=manifest(),sourceChanges=[];
const bridgePaths=['src/gait.js','src/main.js','src/stance_v2_trial.js','src/swordsmanship_default.js'];
for(const p of files.filter(p=>!p.includes('recovery_v2_memory_probe'))){
 if(sourceBefore[p]===reference.sourceBefore[p])continue;
 assert(production&&bridgePaths.includes(p),`Unexpected reference source difference: ${p}`);
 assert.equal(sourceBefore[p],source.bridgeAllowedChanges?.[p],`Frozen reviewed bridge hash differs: ${p}`);
 sourceChanges.push({path:p,oldSHA256:reference.sourceBefore[p]??null,newSHA256:sourceBefore[p]});
}
if(production)assert(sourceChanges.some(c=>c.path==='src/gait.js'));
fs.mkdirSync(args.out,{recursive:true});
const entryTick=1477,endTick=scripted?1746:entryTick+240,startedUTC=new Date().toISOString(),started=performance.now();
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

const gaitState=g=>({active:g.active,started:g.started,lev:g.lev,levH:g.levH,levC:g.levC,handU:g.handU,Nsum:g.Nsum,legs:Object.fromEntries(Object.entries(g.legs).map(([k,l])=>[k,Object.fromEntries(['stance','N','Nf','pinF','pinLim','soleY','toeY','heel','plant','pinC','pinT'].map(p=>[p,plain(l[p])]))]))});
const withoutNf=g=>Object.fromEntries(Object.entries(plain(g.legs)).map(([k,l])=>[k,Object.fromEntries(Object.entries(l).filter(([p])=>p!=='Nf'))]));
const body=b=>({p:V(b.translation()),q:{...b.rotation()},v:V(b.linvel()),w:V(b.angvel()),mass:b.mass(),userForce:V(b.userForce()),userTorque:V(b.userTorque())});
const feet=f=>Object.fromEntries(['F','B'].map(k=>[k,body(f.bodies['foot'+k])]));
const row={mode:'player_reentry_'+mode,inputMode:scripted?'scripted_recut':'original_ai',requestedInputs:[],motion:[],swordContacts:[],seed:7,weapons:baseline.weapons,frames:[],metrics:[],window:[],entries:[],pinObservations:[],contacts:[],transitions:[],firstInputDifferenceTick:null};
const checks={creationExact:false,prefixExact:true,helperOnlyNf:true,onlyPlayer:true,globalLegacy:true,finite:true,contactQueriesNativeExact:true};
let G,tick=0,currentInput=null,inPin=null,error=null,priorHealth=null,firstDifferenceTick=null,firstEffectiveEntryTick=null;
const savedRandom=Math.random;
let stopSignal=null;const stop=s=>{stopSignal=s;};const interrupt=()=>stop('SIGINT'),terminate=()=>stop('SIGTERM');process.on('SIGINT',interrupt);process.on('SIGTERM',terminate);
try{
 G=newRound({seed:7,weapon:'zweihander',weapon2:'longsword',walls:false,AIClass:AI,AI2Class:AI,onFighter:f=>{
  if(f.index!==0)return;f.onehandArmModel='manual';if(production)f.stanceMemoryModel='fresh';
  const enter=f.gait.enter;
  f.gait.enter=function(...a){
   // Configured at creation. No historical stance exists at the initial call.
   const restarted=!!this.started,before=gaitState(this),nativeBefore=sha(f.world.takeSnapshot()),otherBefore=JSON.stringify(withoutNf(this));
   if(restarted){if(!row.entries.some(e=>e.restarted))assert.equal(tick,entryTick,'Unexpected first recovery entry');if(mode==='fresh'&&!production)clearStanceFrictionMemory(this);}
   const afterClear=gaitState(this),helperOnlyNf=sha(f.world.takeSnapshot())===nativeBefore&&JSON.stringify(withoutNf(this))===otherBefore;
   checks.helperOnlyNf&&=helperOnlyNf;
   if(mode==='fresh'&&restarted&&Object.values(before.legs).some(l=>l.Nf>0)&&firstEffectiveEntryTick==null)firstEffectiveEntryTick=tick;
   const result=enter.apply(this,a);
   if(production&&restarted)assert(Object.values(this.legs).every(l=>l.Nf===0),'Production Gait.enter did not clear Nf');
   row.entries.push({clearLocation:production?'production Gait.enter':'observer wrapper (fresh only)',tick,timeBeforeStepS:G?.t??0,restarted,before,afterClear,afterOriginal:gaitState(this),helperOnlyNf,nativeBefore,limbs:{...f.limbs},state:f.state,armed:f.armed});return result;
  };
  const pin=f.gait.pinFeet;
  f.gait.pinFeet=function(...a){
   if(tick<entryTick)return pin.apply(this,a);
   const beforeQuery=sha(f.world.takeSnapshot()),contacts=collectSupportContacts(f),afterQuery=sha(f.world.takeSnapshot());checks.contactQueriesNativeExact&&=beforeQuery===afterQuery;
   inPin={tick,timeBeforeStepS:G.t,before:gaitState(this),feetBefore:feet(f),contactsBefore:contacts,applied:[]};
   try{return pin.apply(this,a);}finally{inPin.after=gaitState(this);inPin.feetAfter=feet(f);row.pinObservations.push(inPin);inPin=null;}
  };
  for(const k of ['F','B']){
   const rb=f.bodies['foot'+k];
   for(const method of ['addForceAtPoint','addTorque']){
    const original=rb[method];rb[method]=function(...a){
     if(inPin)inPin.applied.push({foot:k,method,vector:V(a[0]),point:method==='addForceAtPoint'?V(a[1]):null,magnitude:norm(a[0])});
     return original.apply(this,a);
    };
   }
  }
 }});
 assert(applySwordsmanship(G.player));assert.equal(G.player.skill.level,0);assert.equal(G.player.skill.autoGuard,false);
 G.combat.cutReactionModel='legacy';G.combat.cutReactionFighter=null;
 row.creationNativeSHA256=sha(G.world.takeSnapshot());checks.creationExact=row.creationNativeSHA256===baseline.creationNativeSHA256;assert(checks.creationExact,'Creation mismatch');
 let prev=G.player.handOffset.clone();
 G.before=()=>{
  const f=G.player;
  if(scripted&&tick>=entryTick){
   const cutting=tick>=1621&&tick<=1650,held=tick>=1621&&tick<=1686;
   const dx=cutting?.40/30:0,dy=cutting?-.70/30:0,active=Math.abs(dx)+Math.abs(dy)>1e-5;
   if(f.alive&&!f.weapon?.gun){f.handOffset.x+=dx;f.handOffset.y+=dy;}
   f.handHeld=held;f.inputActive=active;f.move.set(0,0);f.stickX=f.stickY=0;
   currentInput={id:tick,timeS:G.t,dx:f.alive&&!f.weapon?.gun?dx:0,dy:f.alive&&!f.weapon?.gun?dy:0,held,active};
  }else{const delta=f.handOffset.clone().sub(prev);currentInput={id:tick,timeS:G.t,dx:delta.x,dy:delta.y,held:!!f.handHeld,active:!!f.inputActive};}
  assert(recordSwordsmanshipInput(f,currentInput));
  if(tick>=entryTick)row.requestedInputs.push({...currentInput});
 };
 for(tick=0;tick<=endTick;tick++){
  if(tick%120===0)await new Promise(resolve=>setImmediate(resolve));
  if(stopSignal)throw Error(`Measurement interrupted by ${stopSignal}; completed rows preserved`);
  if(scripted&&tick===entryTick)G.ai2=null;
  G.step();prev.copy(G.player.handOffset);
  const native=sha(G.world.takeSnapshot()),control=sha(JSON.stringify({fighters:[controls(G.player),controls(G.enemy)],ai:plain(G.ai),ai2:plain(G.ai2)})),input=sha(JSON.stringify({player:currentInput,enemy:{pad:G.enemy.handOffset.toArray(),active:G.enemy.inputActive,move:G.enemy.move.toArray(),tap:plain(G.enemy.skill.tap)}}));
  const frame=[tick,native,control,input];row.frames.push(frame);
  const exact=JSON.stringify(frame)===JSON.stringify(baseline.frames[tick]);
  if(!exact&&firstDifferenceTick==null)firstDifferenceTick=tick;
  if(tick<entryTick&&!exact){checks.prefixExact=false;throw Error(`Pre-intervention native/control/input mismatch at ${tick}; comparison stopped`);}
  if(input!==baseline.frames[tick][3]&&row.firstInputDifferenceTick==null)row.firstInputDifferenceTick=tick;
  checks.globalLegacy&&=CONFIG.GAIT.stanceMemory==='legacy'&&CONFIG.BODY.supportModel==='legacy';
  checks.onlyPlayer&&=!Object.hasOwn(G.enemy.gait,'enter');
  checks.finite&&=G.world.bodies.getAll().every(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].every(v=>Object.values(v).every(Number.isFinite)));
  if(tick>=entryTick-3){
   if(scripted&&tick>=entryTick){
    const f=G.player,tip=f.bladePoint(1,new THREE.Vector3()),tipV=f.sword.velocityAtPoint(tip),v=f.sword.linvel(),w=new THREE.Vector3().copy(f.sword.angvel()),q=new THREE.Quaternion().copy(f.sword.rotation()),I=f.sword.principalInertia();
    const localW=w.clone().applyQuaternion(q.clone().multiply(new THREE.Quaternion().copy(f.sword.principalInertiaLocalFrame())).invert());
    const wrist=new THREE.Vector3(.13,0,0).applyQuaternion(new THREE.Quaternion().copy(f.bodies.farmS.rotation())).add(new THREE.Vector3().copy(f.bodies.farmS.translation()));
    row.motion.push({tick,timeS:G.t,tipSpeedMps:norm(tipV),tipVelocity:V(tipV),swordKineticJ:.5*f.sword.mass()*norm(v)**2+.5*(I.x*localW.x**2+I.y*localW.y**2+I.z*localW.z**2),swordOmega:V(w),handTarget:f.handTarget.toArray(),wrist:wrist.toArray(),handErrorM:wrist.distanceTo(f.handTarget),pad:f.handOffset.toArray(),assist:plain(f.swordsmanshipState),state:f.state,armHealth:f.armHealth,pain:f.pain,gripping:!!f.gripping});
    const pairs=[];for(let ci=0;ci<f.sword.numColliders();ci++){
     const own=f.sword.collider(ci);G.world.contactPairsWith(own,other=>{const info=f.colliderInfo.get(other.handle);G.world.contactPair(own,other,(m,flipped)=>{pairs.push({own:own.handle,other:other.handle,otherFighter:info?.fighter?.index??null,otherPart:info?.part??null,flipped,normal:V(m.normal()),impulseNs:Array.from({length:m.numContacts()},(_,i)=>m.contactImpulse(i)),solverPoints:Array.from({length:m.numSolverContacts()},(_,i)=>({point:V(m.solverContactPoint(i)),distanceM:m.solverContactDist(i)}))});});});
    }row.swordContacts.push({tick,timeS:G.t,pairs});
   }
   const state=selectedState(G),health=JSON.stringify(state.fighters.map(f=>[f.state,f.alive,f.armed,f.gripValid,f.limbs,f.control.assist.owner]));
   row.window.push({tick,...state});row.metrics.push({tick,timeS:G.t,fighters:state.fighters.map(f=>{const peak=(xs,k)=>xs.reduce((a,b)=>!a||Math.abs(b[k])>Math.abs(a[k])?b:a,null);return {...f,gaps:undefined,spin:undefined,maxJoint:peak(f.gaps,'gapM'),gripGap:f.gaps.find(g=>g.name==='grip')??null,maxSpeed:peak(f.spin,'speedMps'),maxHeight:peak(f.spin,'heightM'),maxOmega:peak(f.spin,'omegaRadps'),maxLimbAxial:peak(f.spin.filter(s=>s.part.startsWith('uarm')||s.part.startsWith('farm')||s.part.startsWith('thigh')||s.part.startsWith('shin')),'axialRadps'),sword:f.spin.find(s=>s.part==='sword')};})});
   if(health!==priorHealth)row.transitions.push({tick,timeS:G.t,fighters:state.fighters.map(f=>({index:f.index,state:f.state,alive:f.alive,armed:f.armed,gripValid:f.gripValid,limbs:f.limbs,control:f.control}))});priorHealth=health;
   if(tick>=entryTick){const n=sha(G.world.takeSnapshot());row.contacts.push({tick,timeS:G.t,feet:feet(G.player),gait:gaitState(G.player.gait),contacts:collectSupportContacts(G.player)});checks.contactQueriesNativeExact&&=n===sha(G.world.takeSnapshot());}
  }
  assert(checks.finite,'Nonfinite body');
 }
 row.wounds=G.wounds.map(w=>({timeS:w.t,attacker:w.att.index,victim:w.vic.index,type:w.type,zone:w.zone,energyJ:w.energy,severity:w.severity}));
 assert.equal(firstEffectiveEntryTick,mode==='fresh'?entryTick:null);assert.equal(firstDifferenceTick,entryTick);
 if(production){checks.fullTraceMatchesResearch=JSON.stringify(row.frames)===JSON.stringify(bridge.row.frames);checks.requestsMatchResearch=JSON.stringify(row.requestedInputs)===JSON.stringify(bridge.row.requestedInputs);assert(checks.fullTraceMatchesResearch&&checks.requestsMatchResearch,'Production trace/request mismatch');}
}catch(e){error={name:e.name,message:e.message,stack:e.stack};}
finally{
 if(G){row.wounds=G.wounds.map(w=>({timeS:w.t,attacker:w.att.index,victim:w.vic.index,type:w.type,zone:w.zone,energyJ:w.energy,severity:w.severity}));row.finalObservedState=selectedState(G);}
 process.off('SIGINT',interrupt);process.off('SIGTERM',terminate);
 G?.eventQueue.free();G?.world.free();Math.random=savedRandom;
 const sourceAfter=manifest(),sourceStable=JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter);
 const measurementValid=!error&&sourceStable&&Object.values(checks).every(Boolean)&&row.frames.length===endTick+1;
 const report={schemaVersion:1,experiment:production?'recovery_v2_memory_runtime_bridge':'recovery_v2_memory',productionBridge:production?{reference:args.bridge,referenceSHA256:sha(bridgeBytes),sourceChanges,scope:'Actual production Gait.enter only; no observer helper clear. Whole native/control/input trace required exact.'}:null,head:source.head,sourceBefore,sourceAfter,sourceStable,source,command:process.argv,startedUTC,completedUTC:new Date().toISOString(),wallSeconds:(performance.now()-started)/1000,measurementValid,effectAccepted:false,error,checks,firstDifferenceTick,firstEffectiveEntryTick,protocol:{entryTick,endTick,dt:DT,executionCount:1,reference:{path:args.reference,sha256:sha(referenceBytes),rowIndex:2},candidate:production?'Production player.stanceMemoryModel=fresh; Gait.enter applies existing helper on restarted player stance. Observer never clears.':mode==='fresh'?'Only player Gait.enter with started=true clears Nf via existing runtime helper. Initial enter deliberately untouched. Configured from spawn.':'Legacy baseline; same observers, no Nf change',input:scripted?'Original AI2 through1476, then AI2=null; original opponent remains.1477–1620 zero delta/not held;1621–1650 delta(.40,-.70)/30 held;1651–1686 held/zero;1687–1746 notheld/zero. Main L1 threshold1e-5 and recordSwordsmanshipInput.120Hz headless, no render cadence or hitstop equivalence claimed.':'Same original reactive AI2 + explicit recordSwordsmanshipInput as P5. No human release/re-input; effects after first input divergence not same-input causal evidence.',observation:'Actual addForceAtPoint/addTorque arguments inside pinFeet. pinF remains pre-clamp request/stale cache. Contact getter native state checked unchanged. No ground support model changed.'},baseline:{creationNativeSHA256:baseline.creationNativeSHA256,frames:baseline.frames.slice(0,endTick+1),metrics:baseline.metrics.filter(x=>x.tick>=entryTick-3&&x.tick<=endTick),window:baseline.window.filter(x=>x.tick>=entryTick-3&&x.tick<=endTick),supportWindows:baseline.supportWindows.filter(x=>x.tick>=entryTick-3&&x.tick<=endTick),transitions:baseline.transitions.filter(x=>x.tick>=entryTick-3&&x.tick<=endTick),wounds:baseline.wounds.filter(x=>x.timeS<=(endTick+1)*DT)},row};
 const file=path.join(args.out,'report.json');fs.writeFileSync(file,JSON.stringify(report)+'\n');const bytes=fs.readFileSync(file);fs.writeFileSync(path.join(args.out,'receipt.json'),JSON.stringify({rawPath:file,bytes:bytes.length,sha256:sha(bytes),measurementValid,error,checks,firstDifferenceTick,firstEffectiveEntryTick,executionCount:1,steps:row.frames.length,wallSeconds:report.wallSeconds,sourceStable,command:process.argv},null,2)+'\n');
 console.log(JSON.stringify({measurementValid,error,checks,firstDifferenceTick,firstEffectiveEntryTick,steps:row.frames.length,firstInputDifferenceTick:row.firstInputDifferenceTick,wallSeconds:report.wallSeconds}));if(!measurementValid)process.exitCode=1;
}
