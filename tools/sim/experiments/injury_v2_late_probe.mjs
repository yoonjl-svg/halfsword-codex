// Diagnostic late control handover after an archived real legacy injury. Never a from-spawn v2 trial.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {newRound,AI,DT,THREE,CONFIG} from '../harness_m.mjs';
import {mainArmMuscle} from '../../../src/arm_recovery_activation.js';
import {applySwordsmanship,recordSwordsmanshipInput} from '../../../src/swordsmanship.js';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const opts=Object.fromEntries(process.argv.slice(2).map(s=>{const m=/^--(out|reference)=(.+)$/.exec(s);assert(m);return[m[1],m[2]];}));
assert(opts.out&&path.isAbsolute(opts.out)&&!fs.existsSync(opts.out));assert(opts.reference&&path.isAbsolute(opts.reference));
const sha=b=>createHash('sha256').update(b).digest('hex');
const source=JSON.parse(fs.readFileSync(path.join(root,'SOURCE.json')));
const refBytes=fs.readFileSync(opts.reference),reference=JSON.parse(refBytes),ref=reference.rows.find(r=>r.mode==='originalAI');
assert(reference.pass&&reference.sourceStable&&ref);
const boundary=1535;
assert.equal(ref.frames[boundary].p.armHealth,.3665712838676919);
const phases=[{name:'painWait',ticks:240,delta:[0,0],held:false},{name:'release',ticks:36,delta:[0,0],held:false},{name:'reverse',ticks:30,delta:[-.40/30,.74/30],held:true},{name:'reverseHold',ticks:30,delta:[0,0],held:true},{name:'reentryCut',ticks:30,delta:[.32/30,-.64/30],held:true},{name:'finalRelease',ticks:54,delta:[0,0],held:false}];
const schedule=phases.flatMap(p=>Array.from({length:p.ticks},(_,i)=>({phase:p.name,phaseTick:i,delta:p.delta.slice(),held:p.held,active:Math.abs(p.delta[0])+Math.abs(p.delta[1])>1e-5}))).map((r,i)=>({...r,tick:boundary+1+i}));
const end=boundary+schedule.length;
const scan=d=>fs.readdirSync(path.join(root,d),{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(d+'/'+e.name):e.name.endsWith('.js')?[d+'/'+e.name]:[]);
const files=[...scan('src'),'package.json','package-lock.json','tools/sim/harness_m.mjs','tools/sim/experiments/injury_v2_late_probe.mjs','node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'].sort();
const manifest=()=>Object.fromEntries(files.map(f=>[f,sha(fs.readFileSync(path.join(root,f)))]));
const sourceBefore=manifest(),bridge=[];
for(const[f,h]of Object.entries(reference.sourceBefore).filter(([f])=>f.startsWith('src/')||f==='tools/sim/harness_m.mjs'||f.startsWith('node_modules'))){
 if(sourceBefore[f]===h)continue;
 assert.equal(sourceBefore[f],source.allowedReferenceChanges[f],'Reviewed source change '+f);bridge.push({path:f,before:h,after:sourceBefore[f]});
}
for(const[f,h]of Object.entries(source.files))assert.equal(sourceBefore[f],h,'Frozen source '+f);
fs.mkdirSync(opts.out,{recursive:true});
const V = p => new THREE.Vector3(p.x,p.y,p.z), Q = p => new THREE.Quaternion(p.x,p.y,p.z,p.w);
const point = (body,p) => V(p).applyQuaternion(Q(body.rotation())).add(V(body.translation()));
function recordedState(f) {
  let gap=0; for(const j of f.joints) if(j.joint?.isValid()) gap=Math.max(gap,point(j.parent,j.joint.anchor1()).distanceTo(point(j.child,j.joint.anchor2())));
  const bodies=[...Object.values(f.bodies),f.sword], actualHand=point(f.bodies.farmS,{x:.13,y:0,z:0});
  const measurement={commandValid:f.lastDt>0,actualHand:actualHand.toArray(),handTarget:f.handTarget.toArray(),handErrorM:actualHand.distanceTo(f.handTarget),muscle:f.muscle,armMuscle:mainArmMuscle(f),strength:f.strength,vigor:f.vigor,jolt:f.jolt,wristCap:f.debug.wristCap??null,preTwistWrist:f.debug.wristTorque.toArray(),sword:{p:Object.values(f.sword.translation()),q:Object.values(f.sword.rotation()),v:Object.values(f.sword.linvel()),w:Object.values(f.sword.angvel()),F:Object.values(f.sword.userForce()),T:Object.values(f.sword.userTorque())}};
  return {measurement,state:f.state,alive:f.alive,armed:f.armed,armHealth:f.armHealth,legHealth:f.legHealth,pain:f.pain,limbs:{...f.limbs},finishOn:f.finish.on,finishWeight:f.finish.amt,hand:f.handOffset.toArray(),aim:f.skill.aim.toArray(),held:f.handHeld??false,inputActive:f.inputActive??false,handBase:f.handBase?[...f.handBase]:null,tapDown:!!f.skill.tap?.down,tapGo:!!f.skill.tap?.go,thrusts:f.skill.thrusts,gapM:gap,armOmegaRadps:Math.max(...['uarmS','farmS'].map(k=>V(f.bodies[k].angvel()).length())),finite:bodies.every(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].every(v=>Object.values(v).every(Number.isFinite))),wounds:f.wounds.map(w=>({part:w.part,type:w.type,severity:w.severity}))};
}
// Hash serializable controller state; native handles/world are covered by snapshot separately.
function own(object) {
  const omit=new Set(['f','fighter','me','foe','world','scene','R','rb','body','parent','child','joint','rawSet','raw','__wbg_ptr','info','mesh','group','sword','grip','colliderSet']);
  const seen=new WeakSet();
  const copy=(v,n=0)=>{
    if(v===null||['boolean','string'].includes(typeof v)) return v;
    if(typeof v==='number') return Number.isFinite(v)?v:{$number:String(v)};
    if(typeof v!=='object'||n>8||v.isObject3D||typeof v.isValid==='function') return undefined;
    if(v.isVector2||v.isVector3||v.isQuaternion||v.isEuler) return v.toArray();
    if(seen.has(v)) return {$shared:true}; seen.add(v);
    if(Array.isArray(v)) return v.map(x=>copy(x,n+1));
    if(v instanceof Set) return [...v].map(x=>copy(x,n+1));
    if(v instanceof Map) return [...v].map(([k,x])=>[copy(k,n+1),copy(x,n+1)]);
    return Object.fromEntries(Object.entries(v).filter(([k])=>!omit.has(k)).map(([k,x])=>[k,copy(x,n+1)]).filter(([,x])=>x!==undefined));
  }; return copy(object);
}
const events = G => ({clashes:G.clashes,wounds:G.wounds.map(w=>({timeS:w.t,attacker:w.att.index,victim:w.vic.index,zone:w.zone,type:w.type,energyJ:w.energy,severity:w.severity}))});
const controller = G => ({player:own(G.player),enemy:own(G.enemy),ai:own(G.ai),ai2:own(G.ai2),combat:own(G.combat)});
function extra(G,f) {
  const blade=new THREE.Vector3(0,1,0).applyQuaternion(Q(f.sword.rotation())), w=V(f.sword.angvel());
  const contacts=[];
  for(const c of f.swordColliders) G.world.contactPairsWith(c,o=>G.world.contactPair(c,o,(m,flipped)=>{
    if(m.numContacts()) contacts.push({a:c.handle,b:o.handle,otherFighter:G.combat.info.get(o.handle)?.fighter?.index??null,flipped,
      normal:{...m.normal()},points:Array.from({length:m.numContacts()},(_,i)=>({distance:m.contactDist(i),impulse:m.contactImpulse(i)}))});
  }));
  const hand=point(f.bodies.farmS,{x:.13,y:0,z:0});
  const gripGap=f.gripJoint?.isValid()?point(f.gripJoint.body1(),f.gripJoint.anchor1()).distanceTo(point(f.gripJoint.body2(),f.gripJoint.anchor2())):null;
  return {blade:blade.toArray(),aim:f.debug.aim.toArray(),aimErrorRad:blade.angleTo(f.debug.aim),axialOmegaRadS:w.dot(blade),swingOmegaRadS:w.clone().addScaledVector(blade,-w.dot(blade)).length(),tipVelocityMps:V(f.sword.velocityAtPoint(f.bladePoint(1,new THREE.Vector3()))).length(),actualHandVelocityMps:V(f.bodies.farmS.velocityAtPoint(hand)).length(),gripGapM:gripGap,missingJoints:f.joints.filter(j=>!j.joint?.isValid()).map(j=>j.name),contacts,
    input:{pad:f.handOffset.toArray(),held:!!f.handHeld,active:!!f.inputActive,move:f.move.toArray(),stick:[f.stickX??null,f.stickY??null]},
    skill:{level:f.skill.level,autoGuard:f.skill.autoGuard,swinging:f.skill.swinging,swings:f.skill.swings,cutPending:f.skill.cutPending,recovering:f.skill.recovering,idle:f.skill.idle,vel:f.skill.vel.toArray(),aimRaw:f.skill.aimRaw.toArray(),aimVel:f.skill.aimVel.toArray(),activity:f.skill.activity,lunge:f.skill.lunge,tap:own(f.skill.tap)},
    retained:{strength:f.strength,emoMods:own(f.emoMods),bound:own(f.bound),barge:own(f.barge),finish:own(f.finish),gait:own(f.gait)}};
}

function compatibleController(G){
 assert.equal(G.combat.cutReactionFighter,null);assert.equal(G.combat.finishRuleModel,'legacy');assert.equal(G.combat.finishRuleFighter,null);
 const c=controller(G);delete c.combat.cutReactionFighter;delete c.combat.finishRuleModel;delete c.combat.finishRuleFighter;return c;
}
function ctx(f){return{state:f.state,alive:f.alive,armed:f.armed,limbs:{...f.limbs},armHealth:f.armHealth,pain:f.pain,muscle:f.muscle,gripValid:!!f.gripJoint?.isValid(),v2:f.swordsmanshipState?{phase:f.swordsmanshipState.phase,owner:f.swordsmanshipState.owner,eligible:f.swordsmanshipState.eligible,availability:f.swordsmanshipState.availability}:null};}
const norm=v=>Math.hypot(v.x,v.y,v.z),vec=v=>({x:v.x,y:v.y,z:v.z});
const row={frames:[],drive:[],requests:[],handover:null},checks={creationNativeExact:false,creationCompatibleControlExact:false,prefixExact:true,nativeHandoverUnchanged:false,injuryPreserved:false,finite:true,inputsAccepted:true};
let G,tick=0,driveNow=null,error=null,signal=null;
const stop=()=>{signal='interrupt';};process.on('SIGINT',stop);process.on('SIGTERM',stop);
const startedUTC=new Date().toISOString(),started=performance.now(),originalRandom=Math.random;
try{
 G=newRound({seed:7,walls:false,weapon:'qinggang',weapon2:'longsword',skill:.7,difficulty:'normal',AI2Class:AI,onFighter:f=>{
  f.onehandArmModel='legacy';if(f.index!==0)return;
  const drive=f.driveSword;f.driveSword=function(...a){if(tick<=boundary)return drive.apply(this,a);driveNow={tick,pre:ctx(f),calls:[]};try{return drive.apply(this,a);}finally{driveNow.postDebug={swing:f.debug.wristTorque.toArray(),swingCap:f.debug.wristCap};row.drive.push(driveNow);driveNow=null;}};
  for(const[part,b]of [['sword',f.sword],['farmS',f.bodies.farmS]]){const add=b.addTorque;b.addTorque=function(...a){if(driveNow)driveNow.calls.push({part,torque:vec(a[0]),magnitudeNm:norm(a[0]),omega:vec(b.angvel())});return add.apply(this,a);};}
 }});
 const f=G.player;row.creation={native:sha(G.world.takeSnapshot()),compatibleController:sha(JSON.stringify(compatibleController(G)))};
 checks.creationNativeExact=row.creation.native===ref.creation.native;checks.creationCompatibleControlExact=row.creation.compatibleController===ref.creation.controller;
 assert(checks.creationNativeExact,'Creation native differs');assert(checks.creationCompatibleControlExact,'Creation compatible controller differs');
 for(tick=0;tick<=end;tick++){
  if(tick%120===0)await new Promise(r=>setImmediate(r));if(signal)throw Error('Interrupted; partial retained');
  let request=tick>boundary?schedule[tick-boundary-1]:null;
  if(tick===boundary+1){
   const before=ctx(f),nativeBefore=sha(G.world.takeSnapshot());assert(before.alive&&before.armed&&before.state==='stand'&&before.armHealth===ref.frames[boundary].p.armHealth,'Real injury boundary');
   G.ai2=null;f.onehandArmModel='manual';assert(applySwordsmanship(f));
   const after=ctx(f),nativeAfter=sha(G.world.takeSnapshot());checks.nativeHandoverUnchanged=nativeBefore===nativeAfter;checks.injuryPreserved=JSON.stringify(before.limbs)===JSON.stringify(after.limbs)&&before.pain===after.pain&&before.muscle===after.muscle;
   row.handover={tick,before,after,nativeBefore,nativeAfter,scope:'Late v2 plus manual at real legacy injury; no onehand spawn pose, collider/edge/finish change. Body goals and old skill change explicitly, so not A/B efficacy or ordinary from-spawn v2.'};assert(checks.nativeHandoverUnchanged&&checks.injuryPreserved);
  }
  if(request){
   if(f.alive){f.handOffset.x+=request.delta[0];f.handOffset.y+=request.delta[1];}
   f.handHeld=request.held;f.inputActive=request.active;f.move.set(0,0);f.stickX=f.stickY=0;
   const supplied={id:tick,timeS:G.t,dx:f.alive?request.delta[0]:0,dy:f.alive?request.delta[1]:0,held:request.held,active:request.active};const accepted=recordSwordsmanshipInput(f,supplied);checks.inputsAccepted&&=accepted;row.requests.push({tick,request,supplied,accepted,before:ctx(f)});
  }
  G.step();const p=recordedState(f),e=recordedState(G.enemy),observed=extra(G,f),event=events(G);
  checks.finite&&=p.finite&&e.finite;
  const trace={native:sha(G.world.takeSnapshot()),controller:sha(JSON.stringify(compatibleController(G))),events:sha(JSON.stringify(event)),input:sha(JSON.stringify(observed.input))};
  row.frames.push({tick,timeS:G.t,phase:request?.phase??'legacyAI',p,e,observed,trace,post:ctx(f)});
  if(tick<=boundary){
   if(JSON.stringify(trace)!==JSON.stringify(ref.frames[tick].trace)){checks.prefixExact=false;throw Error('Native/controller/input/events prefix mismatch at '+tick);}
   assert.deepEqual(p,ref.frames[tick].p,'Saved player observation '+tick);assert.deepEqual(e,ref.frames[tick].e,'Saved enemy observation '+tick);
  }
  assert(checks.finite,'Nonfinite at '+tick);
 }
}catch(e){error={name:e.name,message:e.message,stack:e.stack};}
finally{
 if(G)row.final=ctx(G.player);G?.eventQueue.free();G?.world.free();Math.random=originalRandom;process.off('SIGINT',stop);process.off('SIGTERM',stop);
 const sourceAfter=manifest(),sourceStable=JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter),measurementValid=!error&&sourceStable&&Object.values(checks).every(Boolean)&&row.frames.length===end+1;
 const report={schemaVersion:1,head:source.head,experiment:'injury_v2_late',source,sourceBefore,sourceAfter,sourceStable,bridge,checks,measurementValid,error,executionCount:1,startedUTC,completedUTC:new Date().toISOString(),wallSeconds:(performance.now()-started)/1000,command:process.argv,reference:{path:opts.reference,bytes:refBytes.length,sha256:sha(refBytes),head:reference.sourceCommit,row:'originalAI'},controllerCompatibility:'Only three verified new inactive Combat fields are removed for historical controller hashing; native,input,events and old player/enemy recorded state remain exact until1535.',protocol:{boundary,end,dt:DT,phases,scope:'Legacy natural injury prefix then LATE current v2/manual handover. Not current ordinary-from-spawn v2, no artificial wound/pain/availability/body state. Same active enemy. 240-step release wait before previous180-step injured input tape; actual pain may remain high because of new combat.'},row};
 const file=path.join(opts.out,'report.json');fs.writeFileSync(file,JSON.stringify(report)+'\n');const b=fs.readFileSync(file);fs.writeFileSync(path.join(opts.out,'receipt.json'),JSON.stringify({path:file,bytes:b.length,sha256:sha(b),measurementValid,error,checks,steps:row.frames.length,wallSeconds:report.wallSeconds},null,2)+'\n');console.log(JSON.stringify({measurementValid,error,checks,steps:row.frames.length,final:row.final,wallSeconds:report.wallSeconds}));if(!measurementValid)process.exitCode=1;
}
