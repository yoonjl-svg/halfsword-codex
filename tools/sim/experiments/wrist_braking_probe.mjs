/** Controlled player stroke with a live enemy, real contacts, and creation replay.
 * Research only: optional estimator flag; no native state or skill-history seeding.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {newRound,CONFIG,DT,THREE,handPos} from '../harness_m.mjs';
import {mainArmMuscle} from '../../../src/arm_recovery_activation.js';
import {beforeWristResponse,afterWristResponse} from './derive_wrist_response.mjs';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const opts=Object.fromEntries(process.argv.slice(2).map(a=>{
  const m=/^--(out|weapons|endings|response|seed)=(.+)$/.exec(a);
  if(!m)throw Error('Unknown wrist braking argument');return [m[1],m[2]];
}));
const evidenceRoot='/workspace/halfsword-handoff/research-wrist-braking-20261003';
if(!opts.out||fs.existsSync(opts.out)||!path.resolve(opts.out).startsWith(evidenceRoot+'/'))
  throw Error('Use --out=NEW_PATH under '+evidenceRoot);
const weapons=(opts.weapons??'sabre,zweihander').split(','),endings=(opts.endings??'hold,reverse').split(',');
if(weapons.some(w=>!['sabre','zweihander'].includes(w))||new Set(weapons).size!==weapons.length||
   endings.some(e=>!['hold','reverse'].includes(e))||new Set(endings).size!==endings.length)
  throw Error('Use unique supported weapons/endings');
if(opts.response&&!['on','off'].includes(opts.response))throw Error('Use response=on|off');
const responseMode=opts.response!=='off',seed=Number(opts.seed??7);
if(!Number.isSafeInteger(seed)||seed<0)throw Error('Use a nonnegative integer seed');
const modes=['original','available'];
const prepareSteps=Math.round(2/DT),raiseSteps=Math.round(.5/DT),strokeSteps=Math.round(.25/DT),afterSteps=Math.round(1.2/DT);
const totalSteps=prepareSteps+strokeSteps+afterSteps,high=[.02,.52],low=[.02,-.45];
const sha=x=>createHash('sha256').update(x).digest('hex');
const V=v=>new THREE.Vector3(v.x,v.y,v.z),Q=q=>new THREE.Quaternion(q.x,q.y,q.z,q.w);
const axisAngle=(a,b)=>Math.atan2(new THREE.Vector3().crossVectors(a,b).length(),a.dot(b));
const head=()=>execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
function scan(d){return fs.readdirSync(path.join(root,d),{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(d+'/'+e.name):e.name.endsWith('.js')?[d+'/'+e.name]:[]);}
const files=[...scan('src'),'tools/sim/harness_m.mjs','tools/sim/experiments/wrist_braking_probe.mjs',
  'tools/sim/experiments/derive_wrist_response.mjs','package-lock.json','node_modules/@dimforge/rapier3d-compat/rapier.mjs',
  'node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'].sort();
const manifest=()=>Object.fromEntries(files.map(f=>[f,sha(fs.readFileSync(path.join(root,f)))]));

// Broad controller digest, not native solver state. Avoid object graphs pointing
// back into engine/rendering. Omit only treatment selector and its diagnostics.
function ownState(object){
  const omit=new Set(['f','fighter','me','foe','world','scene','R','rb','body','parent','child','joint','rawSet','raw',
    '__wbg_ptr','info','mesh','group','sword','grip','colliderSet','wristStopBudget','wristBrakingModel']);
  const seen=new WeakSet();
  function copy(x,depth=0){
    if(x===null||typeof x==='string'||typeof x==='boolean')return x;
    if(typeof x==='number')return Number.isFinite(x)?x:{$number:String(x)};
    if(typeof x!=='object'||depth>8||x.isObject3D||typeof x.isValid==='function')return undefined;
    if(x.isVector2||x.isVector3||x.isQuaternion||x.isEuler)return x.toArray();
    if(seen.has(x))return {$shared:true};seen.add(x);
    if(Array.isArray(x))return x.map(v=>copy(v,depth+1));
    if(x instanceof Set)return [...x].map(v=>copy(v,depth+1));
    if(x instanceof Map)return [...x].map(([k,v])=>[copy(k,depth+1),copy(v,depth+1)]);
    const y={};for(const [k,v]of Object.entries(x))if(!omit.has(k)){const z=copy(v,depth+1);if(z!==undefined)y[k]=z;}return y;
  }
  return copy(object);
}
function control(G){return {player:ownState(G.player),enemy:ownState(G.enemy),ai:ownState(G.ai),
  combat:{step:G.combat.stepNo,cutting:ownState(G.combat.cutting),touching:ownState(G.combat.touching),cut:G.combat.cutReactionModel}};}
function inputState(f){return {index:f.index,hand:f.handOffset.toArray(),held:f.handHeld??false,active:f.inputActive??null,
  move:f.move.toArray(),stick:[f.stickX??null,f.stickY??null],skill:ownState(f.skill),gait:ownState(f.gait),
  finish:ownState(f.finish),canShove:f.canShove,closeArmed:f.closeArmed??null,barge:ownState(f.barge),emoMods:ownState(f.emoMods)};}
function events(G){return {clashes:G.clashes,wounds:G.wounds.map(w=>({t:w.t,att:w.att.index,vic:w.vic.index,
  zone:w.zone,type:w.type,energy:w.energy,severity:w.severity})),fighters:[G.player,G.enemy].map(f=>({index:f.index,
  state:f.state,alive:f.alive,armed:f.armed,cause:f.causeOfDeath??null,weaponBroken:f.weaponBroken??false,
  detachedParts:ownState(f.detachedParts),limbs:ownState(f.limbs),wounds:ownState(f.wounds)}))};}
function body(b){return {p:V(b.translation()).toArray(),q:Q(b.rotation()).toArray(),v:V(b.linvel()).toArray(),w:V(b.angvel()).toArray(),
  mass:b.mass(),I:V(b.principalInertia()).toArray(),IFrame:Q(b.principalInertiaLocalFrame()).toArray(),
  localCom:V(b.localCom()).toArray(),angularDamping:b.angularDamping(),linearDamping:b.linearDamping()};}
function properties(G){return G.world.bodies.getAll().map(b=>({handle:b.handle,...body(b)}));}
function assertFinite(G){for(const b of G.world.bodies.getAll())for(const v of [b.translation(),b.rotation(),b.linvel(),b.angvel()])
  if(Object.values(v).some(x=>!Number.isFinite(x)))throw Error('Nonfinite native state');}
function kinetic(b){const w=V(b.angvel()).applyQuaternion(Q(b.rotation()).multiply(Q(b.principalInertiaLocalFrame())).invert()),I=b.principalInertia();
  return .5*b.mass()*V(b.linvel()).lengthSq()+.5*(I.x*w.x*w.x+I.y*w.y*w.y+I.z*w.z*w.z);}
function gaps(f){const p=(b,a)=>V(a).applyQuaternion(Q(b.rotation())).add(V(b.translation()));
  const rows=f.joints.filter(j=>j.joint?.isValid()).map(j=>({name:j.name,m:p(j.parent,j.joint.anchor1()).distanceTo(p(j.child,j.joint.anchor2()))}));
  if(f.gripJoint?.isValid()){const j=f.gripJoint;rows.push({name:'grip',m:p(j.body1(),j.anchor1()).distanceTo(p(j.body2(),j.anchor2()))});}return rows;}
function health(G){return [G.player,G.enemy].map(f=>({index:f.index,state:f.state,alive:f.alive,armed:f.armed,armHealth:f.armHealth,
  legHealth:f.legHealth,blood:f.blood,pain:f.pain,consciousness:f.consciousness,vigor:f.vigor,limbs:ownState(f.limbs),
  positiveCallbacks:G.wounds.filter(w=>w.vic.index===f.index&&w.severity>0).length}));}
function scheduled(i,ending,initial){
  if(i<prepareSteps){const u=Math.min(1,(i+1)/raiseSteps);return {phase:i<raiseSteps?'raise':'prepareHold',
    hand:initial.map((v,k)=>v+(high[k]-v)*u),active:i<raiseSteps,held:true};}
  const j=i-prepareSteps;
  if(j<strokeSteps){const u=(j+1)/strokeSteps;return {phase:'down',hand:high.map((v,k)=>v+(low[k]-v)*u),active:true,held:true};}
  if(ending==='reverse'&&j<2*strokeSteps){const u=(j-strokeSteps+1)/strokeSteps;return {phase:'reverse',
    hand:low.map((v,k)=>v+(high[k]-v)*u),active:true,held:true};}
  return {phase:'hold',hand:(ending==='reverse'?high:low).slice(),active:false,held:true};
}
const sourceBefore=manifest(),sourceCommit=head(),started=performance.now(),originalRandom=Math.random;
const configBefore={grip:CONFIG.GRIP.reactionModel,support:CONFIG.BODY.supportModel,stance:CONFIG.GAIT.stanceMemory};
function run(weapon,ending,mode,observed=true){
  let G,activePath=null,response=null,ops=[],issued=[],previousYaw=null;
  const undo=[],frames=[],metrics=[],counts={driveSword:0},hashes=Object.fromEntries(['native','control','input','event'].map(k=>[k,createHash('sha256')]));
  const begin=performance.now();
  try{
    CONFIG.GRIP.reactionModel='paired';CONFIG.BODY.supportModel='legacy';CONFIG.GAIT.stanceMemory='legacy';
    G=newRound({seed,walls:false,weapon,weapon2:'longsword',skill:0});const f=G.player;
    const createdProperties=JSON.stringify(properties(G));f.skill.autoGuard=false;
    const creationPropertiesRetained=createdProperties===JSON.stringify(properties(G));
    if(!creationPropertiesRetained||G.t!==0||G.parkEnemy||G.ai2)throw Error('From-creation scope violated');
    const initial=f.handOffset.toArray(),creation={native:sha(G.world.takeSnapshot()),control:sha(JSON.stringify(control(G))),
      health:health(G),properties:properties(G),playerSkill:f.skill.level,autoGuard:f.skill.autoGuard};
    const original=f.driveSword;
    f.driveSword=function(...args){
      counts.driveSword++;const activation=mainArmMuscle(this),eligible=this.armed&&activation>=.12;
      const before=observed&&responseMode&&eligible?beforeWristResponse(this,previousYaw):null;
      activePath='driveSword';
      try{return original.apply(this,args);}finally{
        try{if(before)response=afterWristResponse(this,before,activation);previousYaw=this.yaw.toArray();}
        finally{activePath=null;}
      }
    };undo.push(()=>{delete f.driveSword;});
    // Command-call observation is present on observer-off rows too, so complete
    // input records retain AI thrust and native gait requests in both paths.
    for(const actor of [G.player,G.enemy])for(const [owner,key]of [[actor.skill,'thrust'],[actor.gait,'requestStep']]){
      if(!owner||typeof owner[key]!=='function')continue;const call=owner[key];
      owner[key]=function(...args){issued.push({actor:actor.index,method:key,args:ownState(args)});return call.apply(this,args);};
      undo.push(()=>{delete owner[key];});
    }
    if(observed)for(const [part,b]of [['sword',f.sword],['farmS',f.bodies.farmS],['chest',f.bodies.chest]]){
      const add=b.addTorque;b.addTorque=function(t,wake){if(activePath){const w=this.angvel();ops.push({path:activePath,part,
        T:[t.x,t.y,t.z],omega:[w.x,w.y,w.z],instantaneousPowerW:t.x*w.x+t.y*w.y+t.z*w.z});}return add.call(this,t,wake);};
      undo.push(()=>{delete b.addTorque;});
    }
    let commandBoundary=null,boundaryController=null,currentRequest=null,branch=null;
    G.before=()=>{commandBoundary={requested:currentRequest,actors:[G.player,G.enemy].map(inputState),issued:issued.slice(),
      aiIntent:{mode:G.ai.mode,phase:G.ai.phase,tech:G.ai.tech?.id??G.ai.tech?.name??null,closeWant:G.ai.closeWant,closeBind:G.ai.closeBind}};
      boundaryController=sha(JSON.stringify(control(G)));};
    let previousAxis=new THREE.Vector3(0,1,0).applyQuaternion(Q(f.sword.rotation())),totalAxisTravel=0,afterAxisTravel=0;
    let peakTwist={absRadps:0,i:null,timeS:null},twistAbove30S=0,twistAbove60S=0,twistAbove100S=0;
    let maxGap=0,maxPelvisHeight=-Infinity,maxPelvisUpwardSpeed=-Infinity,maxBodySpeed=0,maxClosure=0,fallbackCalls=0,opposingCalls=0,forecastChecks=0;
    for(let i=0;i<totalSteps;i++){
      if(i===prepareSteps){
        branch={timeS:G.t,native:sha(G.world.takeSnapshot()),control:sha(JSON.stringify(control(G))),health:health(G),properties:properties(G)};
        const before=JSON.stringify(branch.properties);if(mode==='available')f.wristBrakingModel='available';
        branch.propertiesRetained=before===JSON.stringify(properties(G));
        if(!branch.propertiesRetained)throw Error('Estimator selection changed native properties');
      }
      currentRequest=scheduled(i,ending,initial);f.handOffset.set(...currentRequest.hand);f.handHeld=currentRequest.held;f.inputActive=currentRequest.active;
      ops=[];issued=[];response=null;const beforeTimeS=G.t;G.step();assertFinite(G);
      const native=sha(G.world.takeSnapshot()),controller=sha(JSON.stringify(control(G))),input=sha(JSON.stringify(commandBoundary)),event=events(G);
      const eventHash=sha(JSON.stringify(event));hashes.native.update(native);hashes.control.update(controller);hashes.input.update(input);hashes.event.update(eventHash);
      const frame={i,beforeTimeS,timeS:G.t,phase:currentRequest.phase,beforeController:boundaryController,native,control:controller,input,event:eventHash,
        commands:commandBoundary,events:event,state:f.state,alive:f.alive,armed:f.armed};frames.push(frame);
      if(!observed)continue;
      const blade=new THREE.Vector3(0,1,0).applyQuaternion(Q(f.sword.rotation())),travel=axisAngle(previousAxis,blade);previousAxis=blade;
      totalAxisTravel+=travel;if(i>=prepareSteps+strokeSteps)afterAxisTravel+=travel;
      const twist=V(f.sword.angvel()).dot(blade.clone().normalize()),absTwist=Math.abs(twist),jointGaps=gaps(f);
      if(absTwist>peakTwist.absRadps)peakTwist={absRadps:absTwist,i,timeS:G.t};
      if(absTwist>30)twistAbove30S+=DT;if(absTwist>60)twistAbove60S+=DT;if(absTwist>100)twistAbove100S+=DT;
      const closure=ops.reduce((s,t)=>s.map((v,k)=>v+t.T[k]),[0,0,0]),closureNorm=Math.hypot(...closure);
      maxClosure=Math.max(maxClosure,closureNorm);if(closureNorm>1e-8)throw Error('Selected explicit wrist reaction closure failed');
      const budget=f.debug.wristStopBudget?JSON.parse(JSON.stringify(f.debug.wristStopBudget)):null;
      if(budget?.reason==='nonOpposingFallback')fallbackCalls++;
      if(budget?.reason==='opposing')opposingCalls++;
      let forecastOutputCheck=null;
      if(budget?.applicable&&response&&response.selectedDamping===f.weaponCfg.aimDamping){
        if(!Array.isArray(budget.previewTorque)||budget.previewTorque.length!==3)throw Error('Invalid forecast torque');
        forecastOutputCheck={torqueError:V({x:budget.previewTorque[0],y:budget.previewTorque[1],z:budget.previewTorque[2]}).distanceTo(f.debug.wristTorque),
          hillError:Math.abs(budget.previewHill-f.wristHill),capError:Math.abs(budget.previewCap-f.debug.wristCap)};
        if(Object.values(forecastOutputCheck).some(x=>!Number.isFinite(x)||x>1e-9))throw Error('Selected high-damping forecast differs from actual original output');
        forecastChecks++;
      }
      const pelvis=f.bodies.pelvis,bodySpeed=Math.max(...Object.values(f.bodies).map(b=>V(b.linvel()).length()));
      maxGap=Math.max(maxGap,...jointGaps.map(g=>g.m));maxPelvisHeight=Math.max(maxPelvisHeight,pelvis.translation().y);
      maxPelvisUpwardSpeed=Math.max(maxPelvisUpwardSpeed,pelvis.linvel().y);maxBodySpeed=Math.max(maxBodySpeed,bodySpeed);
      const tip=f.bladePoint(1,new THREE.Vector3());
      metrics.push({i,beforeTimeS,timeS:G.t,phase:currentRequest.phase,state:f.state,armed:f.armed,health:health(G),
        sword:body(f.sword),swordKJ:kinetic(f.sword),bladeAxis:blade.clone().normalize().toArray(),
        bladeAngleErrorRad:axisAngle(blade,f.debug.aim),tipSpeedMps:V(f.sword.velocityAtPoint(tip)).length(),bladeTwistRadps:twist,
        handErrorM:handPos(f).distanceTo(f.handTarget),pelvis:body(pelvis),forearm:body(f.bodies.farmS),chest:body(f.bodies.chest),
        bodyAndSwordKJ:kinetic(f.sword)+Object.values(f.bodies).reduce((s,b)=>s+kinetic(b),0),jointGaps,
        wristBrake:f.wristBrake??false,wristBrakeAngleRad:f.wristBrakeAng??null,wristHill:f.wristHill??null,
        wristCapNm:f.debug.wristCap,wristTorqueBeforeTwist:f.debug.wristTorque.toArray(),budget,
        wristResponse:response,forecastOutputCheck,torques:ops,reactionClosureNm:closure,totalAxisTravelRad:totalAxisTravel,afterAxisTravelRad:afterAxisTravel});
    }
    if(counts.driveSword!==frames.length)throw Error('Original driveSword dispatch mismatch');
    const healthyBeforeBranch=branch.health.every(h=>h.state==='stand'&&h.alive&&h.armed&&h.armHealth===1&&h.legHealth===1&&
      h.positiveCallbacks===0&&h.pain===0&&h.consciousness===creation.health[h.index].consciousness&&h.blood===creation.health[h.index].blood);
    const firstPlayerCallback=frames.flatMap(r=>r.events.wounds).find(w=>w.vic===0)??null;
    const firstPositivePlayerWound=frames.flatMap(r=>r.events.wounds).find(w=>w.vic===0&&w.severity>0)??null;
    return {weapon,ending,mode,seed,observed,responseMode,creationPropertiesRetained,creation,branch,healthyBeforeBranch,
      counts,frames,metrics,nativeTraceSha256:hashes.native.digest('hex'),controllerTraceSha256:hashes.control.digest('hex'),
      inputTraceSha256:hashes.input.digest('hex'),eventTraceSha256:hashes.event.digest('hex'),wallSeconds:(performance.now()-begin)/1000,
      summary:{steps:frames.length,durationS:G.t,finite:true,healthyBeforeBranch,firstPlayerCallback,firstPositivePlayerWound,
        clashes:G.clashes,woundCallbacks:G.wounds.length,playerAlive:f.alive,enemyAlive:G.enemy.alive,playerArmed:f.armed,
        afterAxisTravelRad:observed?afterAxisTravel:null,peakTwist:observed?peakTwist:null,
        twistDurationDiagnosticS:observed?{above30:twistAbove30S,above60:twistAbove60S,above100:twistAbove100S}:null,
        maxGapM:observed?maxGap:null,maxPelvisHeightM:observed?maxPelvisHeight:null,
        maxPelvisUpwardSpeedMps:observed?maxPelvisUpwardSpeed:null,maxBodySpeedMps:observed?maxBodySpeed:null,
        maxSelectedReactionClosureNm:observed?maxClosure:null,fallbackCalls:observed?fallbackCalls:null,
        opposingForecastCalls:observed?opposingCalls:null,forecastOutputChecks:observed?forecastChecks:null}};
  }finally{undo.reverse().forEach(fn=>fn());G?.eventQueue.free();G?.world.free();Math.random=originalRandom;
    CONFIG.GRIP.reactionModel=configBefore.grip;CONFIG.BODY.supportModel=configBefore.support;CONFIG.GAIT.stanceMemory=configBefore.stance;}
}
function firstDifference(a,b,select){const i=a.findIndex((x,i)=>JSON.stringify(select(x))!==JSON.stringify(select(b[i])));
  return i<0?null:{i,beforeTimeS:a[i].beforeTimeS,timeS:a[i].timeS,original:select(a[i]),available:select(b[i])};}
function actualCommands(frame){return {requested:frame.commands.requested,issued:frame.commands.issued,
  actors:frame.commands.actors.map(a=>({index:a.index,hand:a.hand,held:a.held,active:a.active,move:a.move,stick:a.stick,
    canShove:a.canShove,emoMods:a.emoMods}))};}
const torqueVectors=metric=>metric.torques.map(t=>({path:t.path,part:t.part,T:t.T}));
function incomingWithoutSelector(response){if(!response)return null;const {wristBrakingModel,...incoming}=response.before;return incoming;}
const rows=[],checks=[],effects=[];let error=null;
try{
  for(const weapon of weapons)for(const ending of endings)for(const mode of modes){const row=run(weapon,ending,mode);rows.push(row);
    console.log(JSON.stringify({weapon,ending,mode,summary:row.summary}));}
  // Default batch: eight controlled runs plus the two exact diagnostic controls.
  const offWeapon=weapons.includes('zweihander')?'zweihander':weapons.at(-1),offEnding=endings.includes('reverse')?'reverse':endings.at(-1);
  for(const mode of modes)rows.push(run(offWeapon,offEnding,mode,false));
  for(const weapon of weapons)for(const ending of endings){
    const [a,b]=modes.map(mode=>rows.find(r=>r.weapon===weapon&&r.ending===ending&&r.mode===mode&&r.observed));
    checks.push({weapon,ending,creationExact:JSON.stringify(a.creation)===JSON.stringify(b.creation),
      prefixExact:JSON.stringify(a.frames.slice(0,prepareSteps))===JSON.stringify(b.frames.slice(0,prepareSteps)),
      branchExact:JSON.stringify(a.branch)===JSON.stringify(b.branch),propertiesRetained:a.branch.propertiesRetained&&b.branch.propertiesRetained,
      healthyBeforeBranch:a.healthyBeforeBranch&&b.healthyBeforeBranch,
      playerRequestsExact:a.frames.every((f,i)=>JSON.stringify(f.commands.requested)===JSON.stringify(b.frames[i].commands.requested))});
    effects.push({weapon,ending,firstNative:firstDifference(a.frames,b.frames,r=>r.native),firstController:firstDifference(a.frames,b.frames,r=>r.control),
      firstInput:firstDifference(a.frames,b.frames,actualCommands),
      firstCommandBoundaryState:firstDifference(a.frames,b.frames,r=>r.commands),firstEvents:firstDifference(a.frames,b.frames,r=>r.events),
      firstDamping:responseMode?firstDifference(a.metrics,b.metrics,r=>r.wristResponse?.selectedDamping??null):null,
      firstActualWristTorque:firstDifference(a.metrics,b.metrics,torqueVectors),
      firstWristTorqueOrIncomingOmega:firstDifference(a.metrics,b.metrics,r=>r.torques),
      firstDampingCall:responseMode?(()=>{const index=a.metrics.findIndex((r,i)=>r.wristResponse?.selectedDamping!==b.metrics[i].wristResponse?.selectedDamping);
        return index<0?null:{i:index,beforeTimeS:a.metrics[index].beforeTimeS,timeS:a.metrics[index].timeS,
          incomingExactExcludingSelector:JSON.stringify(incomingWithoutSelector(a.metrics[index].wristResponse))===JSON.stringify(incomingWithoutSelector(b.metrics[index].wristResponse)),
          resolvedAimExact:JSON.stringify(a.metrics[index].wristResponse?.aimWorld)===JSON.stringify(b.metrics[index].wristResponse?.aimWorld),
          original:a.metrics[index].wristResponse,available:b.metrics[index].wristResponse,budget:b.metrics[index].budget,
          actualOriginal:a.metrics[index].torques,actualAvailable:b.metrics[index].torques};})():null});
  }
  for(const b of rows.filter(r=>!r.observed)){const a=rows.find(r=>r.observed&&r.weapon===b.weapon&&r.ending===b.ending&&r.mode===b.mode);
    checks.push({weapon:b.weapon,ending:b.ending,mode:b.mode,observerNativeExact:a.nativeTraceSha256===b.nativeTraceSha256,
      observerControllerExact:a.controllerTraceSha256===b.controllerTraceSha256,observerInputExact:a.inputTraceSha256===b.inputTraceSha256,
      observerEventsExact:a.eventTraceSha256===b.eventTraceSha256,observerFullFramesExact:JSON.stringify(a.frames)===JSON.stringify(b.frames)});}
}catch(e){error=String(e?.stack??e);}
const sourceAfter=manifest(),sourceCommitAfter=head(),sourceStable=sourceCommit===sourceCommitAfter&&JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter);
const expectedRows=weapons.length*endings.length*2+2;
const measurementValid=!error&&sourceStable&&rows.length===expectedRows&&checks.every(c=>Object.values(c).every(v=>typeof v!=='boolean'||v));
const report={schemaVersion:1,createdUTC:new Date().toISOString(),sourceCommit,sourceCommitAfter,sourceBefore,sourceAfter,sourceStable,
  measurementValid,error,executionCount:rows.length,expectedExecutions:expectedRows,wallSeconds:(performance.now()-started)/1000,rows,checks,effects,
  protocol:{weapons,endings,seed,responseMode,prepareSteps,raiseSteps,strokeSteps,afterSteps,dtS:DT,
    treatment:'At t=2 seconds only player wristBrakingModel=available; original flag absent. Legacy torque and paired grip; margin/gains/caps/mass/drag/goals unchanged.',
    scene:'Real harness from creation: controlled player skill0 autoGuardfalse, active enemy AI, normal Combat/native contacts. No park or pose/velocity/health/history rewrite.',
    inputs:'Raise ordinary hand commands over0.5s then hold through2s; strong downstroke0.25s then hold1.2s, or reverse0.25s within that1.2s then hold. Both actors complete skill/gait command-boundary states and issued thrust/requestStep calls retained each step.',
    comparison:'Identical creation/preparation/branch, fixed player command schedule. Enemy remains reactive; later AI input/contact/injury changes are episode outcomes, not equal-input braking efficiency.',
    controllerDigest:'Broad serializable own state with depth8 and engine/render references omitted; estimator selector and wristStopBudget omitted. Full native snapshots hashed separately.',
    inputDigest:'Complete command-boundary record, including skill/gait state. firstInput compares actual command channels/calls; firstCommandBoundaryState also includes derived skill/gait state and AI intent. Broad controller hash is stored separately.',
    observation:'Read-only derivation once per eligible driveSword, selected explicit sword/forearm/chest reaction and pre-solver power. Native motor/grip/offHand/contact/drag work excluded.',
    limits:'Forecast equality checks only selected high damping and applicable preview. Twist durations are simulation-step diagnostic thresholds, not human limits. Finite/healthy checks and AI endings do not establish human motion or felt realism.'}};
fs.mkdirSync(path.dirname(opts.out),{recursive:true});fs.writeFileSync(opts.out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({out:opts.out,measurementValid,executionCount:rows.length,wallSeconds:report.wallSeconds,error}));
if(!measurementValid)process.exitCode=1;
