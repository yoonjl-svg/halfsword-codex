/** Legacy arm/cut acceptance with actual from-start helper and actual reactive-AI combat. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {newRound,THREE,CONFIG,DT,handPos} from '../harness_m.mjs';

const root=fileURLToPath(new URL('../../../',import.meta.url)),rawPath=process.argv[2]??'/workspace/halfsword-hybrid-evidence/skill-manual-combat-round1.json';
if(fs.existsSync(rawPath))throw Error('Choose fresh evidence output');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const V=x=>new THREE.Vector3(x.x,x.y,x.z),Q=x=>new THREE.Quaternion(x.x,x.y,x.z,x.w),angle=(a,b)=>Math.acos(Math.max(-1,Math.min(1,a.dot(b))));
const saved={grip:CONFIG.GRIP.reactionModel,random:Math.random};
const roundWindow=process.argv.includes('--round-window'),diagnose=process.argv.includes('--diagnose')||roundWindow;
const modes={weak:{level:.4,autoGuard:true},off:{level:0,autoGuard:false}},paths={down:[[.02,.52],[.02,-.45]],up:[[.02,-.45],[.02,.52]],cross:[[-.42,.03],[.42,.03]]};
const helperURL=new URL('./skill_from_start_probe.mjs',import.meta.url),originalHelper=fs.readFileSync(helperURL,'utf8');
const splitMarker='const rows=[],observerChecks=[];';if(originalHelper.split(splitMarker).length!==2)throw Error('Expected one from-start main marker');
let helper=originalHelper.split(splitMarker)[0];
for(const [before,after]of [["f.armTorqueModel='sharedCap'","f.armTorqueModel='legacy'"],["G.combat.cutReactionModel='budgeted'","G.combat.cutReactionModel='legacy'"]]){if(helper.split(before).length!==2)throw Error('Expected one actual option assignment');helper=helper.replace(before,after);}
helper=helper.replace("const root=fileURLToPath(new URL('../../../',import.meta.url));",'const root='+JSON.stringify(root)+';');
helper=helper.replace(/from (['"])([^'"]+)\1/g,(_,q,p)=>'from '+JSON.stringify(p.startsWith('.')?new URL(p,helperURL).href:import.meta.resolve(p)));
helper+='\nexport {run as fromStartRun,ownState,control,nativeBodies,kinetic,rawDirection};\n';
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'skill-legacy-helper-')),helperPath=path.join(temporary,'helper.mjs');fs.writeFileSync(helperPath,helper);
const {fromStartRun,ownState,control,nativeBodies,kinetic,rawDirection}=await import(pathToFileURL(helperPath).href);
function head(){const h=fs.readFileSync(root+'.git/HEAD','utf8').trim();if(!h.startsWith('ref: '))return h;const ref=h.slice(5),p=root+'.git/'+ref,v=fs.existsSync(p)?fs.readFileSync(p,'utf8').trim():fs.readFileSync(root+'.git/packed-refs','utf8').split('\n').find(x=>x.endsWith(' '+ref))?.split(' ')[0];if(!/^[a-f0-9]{40}$/.test(v??''))throw Error('Cannot read HEAD');return v;}
function scan(d){return fs.readdirSync(root+d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(d+'/'+e.name):e.name.endsWith('.js')?[d+'/'+e.name]:[]);}
const files=[...scan('src'),'tools/sim/harness_m.mjs','tools/sim/experiments/skill_from_start_probe.mjs','tools/sim/experiments/skill_manual_combat_probe.mjs','package-lock.json','node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'];
const manifest=()=>Object.fromEntries(files.sort().map(p=>[p,sha(fs.readFileSync(root+p))]));
const before=manifest(),sourceCommit=head(),begin=performance.now();
const primary=[],primaryObserverChecks=[];
if(!diagnose)for(const weapon of ['sabre','zweihander'])for(const motion of ['down','up','cross'])for(const mode of ['weak','off']){
  const r=fromStartRun(weapon,motion,'reinput',mode,true);primary.push(r);
  if(weapon==='zweihander'&&motion==='cross'){const b=fromStartRun(weapon,motion,'reinput',mode,false);primaryObserverChecks.push({weapon,motion,mode,nativeExact:r.nativeTraceSha256===b.nativeTraceSha256,controlExact:r.traceSha256===b.traceSha256,inputExact:r.inputSha256===b.inputSha256,prepExact:r.prepared.trace===b.prepared.trace});}
}
if(!diagnose)for(const mode of ['weak','off'])primary.push(fromStartRun('zweihander','cross','hold',mode,true));
console.log(JSON.stringify({phase:'legacy_from_start_finished',rows:primary.length,wallSeconds:(performance.now()-begin)/1000,observerChecks:primaryObserverChecks}));
function point(body,p){return V(p).applyQuaternion(Q(body.rotation())).add(V(body.translation()));}
function validGaps(f){const rows=[];for(const j of f.joints)if(j.joint?.isValid()&&j.parent.isValid()&&j.child.isValid())rows.push({name:j.name,m:point(j.parent,j.joint.anchor1()).distanceTo(point(j.child,j.joint.anchor2()))});
  if(f.gripJoint?.isValid()){const j=f.gripJoint;rows.push({name:'grip',m:point(j.body1(),j.anchor1()).distanceTo(point(j.body2(),j.anchor2()))});}return rows;}
function script(time){const t=time%4.4,from=paths.down[0],low=paths.down[1],left=paths.cross[0],right=paths.cross[1],mix=(a,b,u)=>[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u];
  if(t<.6)return {offset:from,write:true,held:true,active:false,phase:'guard'};
  if(t<1.15)return {offset:mix(from,low,(t-.6)/.55),write:true,held:true,active:true,phase:'down'};
  if(t<1.55)return {offset:low,write:false,held:false,active:false,phase:'release'};
  if(t<2.1)return {offset:mix(low,from,(t-1.55)/.55),write:true,held:true,active:true,phase:'up'};
  if(t<2.45)return {offset:mix(from,left,(t-2.1)/.35),write:true,held:true,active:true,phase:'prepare_cross'};
  if(t<3)return {offset:mix(left,right,(t-2.45)/.55),write:true,held:true,active:true,phase:'cross'};
  if(t<3.6)return {offset:right,write:false,held:true,active:false,phase:'hold'};
  return {offset:mix(right,from,(t-3.6)/.8),write:true,held:true,active:true,phase:'reinput'};
}
function combatRun(weapon,seed,mode,observed=true){
  let G;const nativeTrace=crypto.createHash('sha256'),controllerTrace=crypto.createHash('sha256'),requested=crypto.createHash('sha256'),enemyInput=crypto.createHash('sha256');
  const frames=[],events=[],tapRequests=[];let previousAxis=null,previousState=[],requestFrame=null,step=0,physicsSteps=0;
  const lifecycle={enabled:roundWindow,realFrameDtS:DT,realFrames:0,realTimeS:0,roundOver:false,roundOverTimeS:0,deathDetected:null,paused:false,pause:null,accumulatorS:0};
  function roundCheck(){
    if(!roundWindow)return;
    if(!lifecycle.roundOver){if(!G.player.alive||!G.enemy.alive){lifecycle.roundOver=true;lifecycle.deathDetected={realTimeS:lifecycle.realTimeS,physicsTimeS:G.t,alive:[G.player.alive,G.enemy.alive]};}return;}
    lifecycle.roundOverTimeS+=DT;
    if(lifecycle.roundOverTimeS>3.5){lifecycle.paused=true;lifecycle.pause={realTimeS:lifecycle.realTimeS,physicsTimeS:G.t,roundOverTimeS:lifecycle.roundOverTimeS,alive:[G.player.alive,G.enemy.alive]};}
  }
  const summary={finite:true,seconds:18,rawAimMeanErrorRad:0,rawAimAfterMeanErrorRad:0,rawAfterSamples:0,axisTravelRad:0,maxBodySpeedMps:0,maxBodyOmegaRadps:0,maxSwordOmegaRadps:0,maxSwordSwingRadps:0,maxSwordTwistRadps:0,maxPelvisHeightM:[0,0],maxJointGapM:[0,0],falls:[0,0],stateFrames:[{},{}],strikes:0,contactWounds:0,clashes:0,freshClashes:0,playerWounds:0,enemyWounds:0,playerEnterParry:0,enemyEnterParry:0,tapAccepted:0,tapPushFrames:0,peakSwordKJ:0};
  const diagnostics={jointPeak:[null,null],liveJointPeak:[null,null],bodyOmegaPeak:null,bodySpeedPeak:null,liveBodyOmegaPeak:null,peakWindows:[]};
  try{
    CONFIG.GRIP.reactionModel='paired';G=newRound({seed,walls:false,weapon,weapon2:'longsword',gap:1.85,skill:modes[mode].level,difficulty:'normal'});const f=G.player;
    f.skill.autoGuard=modes[mode].autoGuard;f.armTorqueModel='legacy';G.enemy.armTorqueModel='legacy';G.combat.cutReactionModel='legacy';
    f.handOffset.set(...paths.down[0]);for(const key of ['prev','aim','aimRaw','anchor'])f.skill[key].set(...paths.down[0]);f.skill.aimVel.set(0,0);f.skill.vel.set(0,0);f.skill.follow.set(0,0);f.handHeld=true;f.inputActive=false;
    const first={native:sha(G.world.takeSnapshot()),control:sha(JSON.stringify(control(G))),armModels:[f.armTorqueModel,G.enemy.armTorqueModel],cut:G.combat.cutReactionModel,playerLevel:f.skill.level,autoGuard:f.skill.autoGuard};
    if(observed){const strike=G.combat.strike;G.combat.strike=function(...args){const r=strike.apply(this,args);summary.strikes++;if(r)events.push({kind:'strike',timeS:G.t,part:args[0]?.v?.part,attacker:args[0]?.w?.fighter?.index,result:ownState(r)});return r;};
      const clash=G.combat.hooks.onClash;G.combat.hooks.onClash=(p,s,info)=>{clash?.(p,s,info);summary.clashes++;if(info.fresh)summary.freshClashes++;events.push({kind:'clash',timeS:G.t,speedMps:s,info:ownState(info)});};
      G.onWound=(a,v,r)=>{summary.contactWounds++;if(a.index===0)summary.playerWounds++;else summary.enemyWounds++;events.push({kind:'wound',timeS:G.t,attacker:a.index,victim:v.index,result:ownState(r),victimState:v.state,limbs:{...v.limbs},blood:v.blood,consciousness:v.consciousness});};}
    G.before=time=>{requestFrame=script(time);if(requestFrame.write&&f.alive)f.handOffset.set(...requestFrame.offset);f.handHeld=requestFrame.held;f.inputActive=requestFrame.active;
      f.move.set(0,time<2?.25:((time%4.4)<.6?.08:0));f.stickX=0;f.stickY=f.move.y;
      // Explicit tap commands are real Skill.thrust requests inside the unchanged G.step input phase.
      const tapIndex=[2.2,6.6,11,15.4].findIndex(t=>Math.abs(time-t)<DT/2);
      if(tapIndex>=0){const accepted=f.skill.thrust();tapRequests.push({timeS:time,accepted,alive:f.alive,armed:f.armed,state:f.state,skillLevel:f.skill.level});if(accepted)summary.tapAccepted++;}
      requested.update(JSON.stringify({timeS:time,request:requestFrame,move:f.move.toArray(),tapCommand:tapIndex>=0}));};
    for(step=0;step<Math.round(summary.seconds/DT);step++){
      if(roundWindow){lifecycle.realFrames++;lifecycle.realTimeS=lifecycle.realFrames*DT;lifecycle.accumulatorS+=DT*(lifecycle.roundOver?.5:1);if(lifecycle.accumulatorS+1e-14<DT){roundCheck();if(lifecycle.paused)break;continue;}lifecycle.accumulatorS-=DT;}
      G.step();physicsSteps++;roundCheck();const bodies=nativeBodies(G);for(const b of bodies){for(const k of ['p','q','v','w'])if(!Object.values(b[k]).every(Number.isFinite))throw Error('Nonfinite native combat body');summary.maxBodySpeedMps=Math.max(summary.maxBodySpeedMps,V(b.v).length());summary.maxBodyOmegaRadps=Math.max(summary.maxBodyOmegaRadps,V(b.w).length());}
      const n=sha(G.world.takeSnapshot());nativeTrace.update(n);controllerTrace.update(JSON.stringify({native:n,control:control(G),wounds:G.wounds.map(w=>({...w,att:w.att.index,vic:w.vic.index}))}));enemyInput.update(JSON.stringify({timeS:G.t,hand:G.enemy.handOffset.toArray(),move:G.enemy.move.toArray(),AI:ownState(G.ai)}));
      if(!observed){if(lifecycle.paused)break;continue;}
      if(diagnose){
        const status=x=>({fighter:x.index,state:x.state,alive:x.alive,armed:x.armed,gripping:!!x.gripping,gripJointValid:!!x.gripJoint?.isValid(),detachedParts:ownState(x.detachedParts??new Set()),tap:ownState(x.skill.tap),thrustPush:x.skill.thrustPush,finishOn:x.finish.on,finishAmt:x.finish.amt,plunge:ownState(x.finish.plunge)});
        const bodyIdentity=handle=>{for(const x of [f,G.enemy]){for(const [name,body]of Object.entries(x.bodies))if(body.handle===handle)return {fighter:x.index,part:name,alive:x.alive,state:x.state,detached:!!x.detachedParts?.has(name)};if(x.sword.handle===handle)return {fighter:x.index,part:'sword',alive:x.alive,state:x.state,detached:!x.armed};}
          for(const info of G.combat.info.values())if(info.body?.handle===handle)return {fighter:info.fighter?.index??null,part:info.part??info.kind??null,alive:info.fighter?.alive??null,state:info.fighter?.state??null,detached:null};return {fighter:null,part:'unclassified',alive:null,state:null,detached:null};};
        for(const body of bodies){const identity=bodyIdentity(body.handle),w=V(body.w).length(),speed=V(body.v).length();if(!diagnostics.bodyOmegaPeak||w>diagnostics.bodyOmegaPeak.radps)diagnostics.bodyOmegaPeak={timeS:G.t,radps:w,handle:body.handle,identity,body};if(!diagnostics.bodySpeedPeak||speed>diagnostics.bodySpeedPeak.mps)diagnostics.bodySpeedPeak={timeS:G.t,mps:speed,handle:body.handle,identity,body};if(identity.alive&&identity.detached===false&&(!diagnostics.liveBodyOmegaPeak||w>diagnostics.liveBodyOmegaPeak.radps))diagnostics.liveBodyOmegaPeak={timeS:G.t,radps:w,handle:body.handle,identity,body};}
        for(const x of [f,G.enemy])for(const gap of validGaps(x)){const j=gap.name==='grip'?x.gripJoint:x.jointByName[gap.name]?.joint;
          const record={timeS:G.t,name:gap.name,gapM:gap.m,jointValid:!!j?.isValid(),body1Valid:!!j?.body1()?.isValid(),body2Valid:!!j?.body2()?.isValid(),status:status(x),otherStatus:status(x.index===0?G.enemy:f)};
          if(!diagnostics.jointPeak[x.index]||gap.m>diagnostics.jointPeak[x.index].gapM)diagnostics.jointPeak[x.index]=record;
          if(x.alive&&!x.detachedParts?.has(gap.name)&&(!diagnostics.liveJointPeak[x.index]||gap.m>diagnostics.liveJointPeak[x.index].gapM))diagnostics.liveJointPeak[x.index]=record;
          if(gap.m>.02&&x.index===0)diagnostics.peakWindows.push(record);
        }
      }
      const axis=new THREE.Vector3(0,1,0).applyQuaternion(Q(f.sword.rotation())),raw=rawDirection(...requestFrame.offset).applyQuaternion(f.yaw),own=f.debug.aim.clone().normalize(),omega=V(f.sword.angvel()),twist=Math.abs(omega.dot(axis)),swing=omega.clone().addScaledVector(axis,-omega.dot(axis)).length(),rawError=angle(axis,raw);
      summary.rawAimMeanErrorRad+=rawError;summary.axisTravelRad+=previousAxis?angle(previousAxis,axis):0;previousAxis=axis;
      if(requestFrame.phase==='hold'||requestFrame.phase==='release'){summary.rawAimAfterMeanErrorRad+=rawError;summary.rawAfterSamples++;}
      summary.maxSwordOmegaRadps=Math.max(summary.maxSwordOmegaRadps,omega.length());summary.maxSwordTwistRadps=Math.max(summary.maxSwordTwistRadps,twist);summary.maxSwordSwingRadps=Math.max(summary.maxSwordSwingRadps,swing);summary.peakSwordKJ=Math.max(summary.peakSwordKJ,kinetic(f.sword));
      for(const x of [f,G.enemy]){const gap=validGaps(x);summary.maxJointGapM[x.index]=Math.max(summary.maxJointGapM[x.index],0,...gap.map(x=>x.m));summary.maxPelvisHeightM[x.index]=Math.max(summary.maxPelvisHeightM[x.index],x.bodies.pelvis.translation().y);summary.stateFrames[x.index][x.state]=(summary.stateFrames[x.index][x.state]??0)+1;
        if(previousState[x.index]&&x.state==='down'&&previousState[x.index]!=='down')summary.falls[x.index]++;previousState[x.index]=x.state;}
      if(f.skill.thrustPush)summary.tapPushFrames++;
      summary.playerEnterParry=f.skill.enters??0;summary.enemyEnterParry=G.enemy.skill.enters??0;
      if(roundWindow||step%4===0||f.skill.thrustPush)frames.push({timeS:G.t,realTimeS:roundWindow?lifecycle.realTimeS:null,roundOver:lifecycle.roundOver,phase:requestFrame.phase,externalHandOffsetM:requestFrame.offset,actualHandOffsetM:f.handOffset.toArray(),handHeld:f.handHeld,inputActive:f.inputActive,skillLevel:f.skill.level,ownAimErrorRad:angle(axis,own),rawAimErrorRad:rawError,actualAxis:axis.toArray(),originalRawAxis:raw.toArray(),swordOmegaRadps:omega.length(),swordTwistRadps:twist,swordSwingRadps:swing,swordKJ:kinetic(f.sword),handErrorM:handPos(f).distanceTo(f.handTarget),states:[f.state,G.enemy.state],alive:[f.alive,G.enemy.alive],armed:[f.armed,G.enemy.armed],limbs:[{...f.limbs},{...G.enemy.limbs}],tapActive:!!f.skill.tap,thrustPush:f.skill.thrustPush,playerEnterParry:f.skill.enters??0,jolt:f.jolt,foeDistanceM:f.foeDistance()});
      if(lifecycle.paused)break;
    }
    summary.seconds=G.t;summary.physicsSteps=physicsSteps;
    if(observed){summary.rawAimMeanErrorRad/=physicsSteps;summary.rawAimAfterMeanErrorRad=summary.rawAfterSamples?summary.rawAimAfterMeanErrorRad/summary.rawAfterSamples:null;}
    return {weapon,seed,mode,observed,first,lifecycle,summary:observed?summary:null,diagnostics:diagnose&&observed?diagnostics:null,finite:true,nativeTraceSha256:nativeTrace.digest('hex'),controllerTraceSha256:controllerTrace.digest('hex'),externalRequestedInputSha256:requested.digest('hex'),reactiveEnemyInputSha256:enemyInput.digest('hex'),tapRequests,wounds:G.wounds.map(w=>({...w,att:w.att.index,vic:w.vic.index})),final:{player:{state:f.state,alive:f.alive,armed:f.armed,limbs:{...f.limbs},blood:f.blood},enemy:{state:G.enemy.state,alive:G.enemy.alive,armed:G.enemy.armed,limbs:{...G.enemy.limbs},blood:G.enemy.blood}},events,frames};
  }finally{G?.eventQueue.free();G?.world.free();CONFIG.GRIP.reactionModel=saved.grip;Math.random=saved.random;}
}
const narrowDiagnosis=diagnose&&!roundWindow;
const combat=[];for(const weapon of narrowDiagnosis?['zweihander']:['sabre','zweihander'])for(const seed of narrowDiagnosis?[19]:[7,19])for(const mode of ['weak','off'])combat.push(combatRun(weapon,seed,mode,true));
const observedWeapon=narrowDiagnosis?'zweihander':'sabre',observedSeed=narrowDiagnosis?19:7,b=combatRun(observedWeapon,observedSeed,'off',false),a=combat.find(x=>x.weapon===observedWeapon&&x.seed===observedSeed&&x.mode==='off');
const combatObserver={weapon:observedWeapon,seed:observedSeed,mode:'off',firstNativeExact:a.first.native===b.first.native,firstControlExact:a.first.control===b.first.control,nativeExact:a.nativeTraceSha256===b.nativeTraceSha256,controllerExact:a.controllerTraceSha256===b.controllerTraceSha256,externalInputExact:a.externalRequestedInputSha256===b.externalRequestedInputSha256,reactiveAIInputExact:a.reactiveEnemyInputSha256===b.reactiveEnemyInputSha256,woundsExact:JSON.stringify(a.wounds)===JSON.stringify(b.wounds),tapRequestsExact:JSON.stringify(a.tapRequests)===JSON.stringify(b.tapRequests)};
const after=manifest(),sourceCommitAfter=head(),sourceStable=JSON.stringify(before)===JSON.stringify(after)&&sourceCommit===sourceCommitAfter;
const result={probe:'skill_manual_combat_probe',sourceCommit,sourceCommitAfter,sourceStable,sourceBefore:before,sourceAfter:after,createdUTC:new Date().toISOString(),command:process.argv,wallSeconds:(performance.now()-begin)/1000,
  helper:{originalSourceSha256:sha(originalHelper),isolatedSourceSha256:sha(helper),contract:'Exact original from-start helper prefix, import URLs/root rebased; only actual player arm sharedCap->legacy and combat cut budgeted->legacy assignments changed. Classes/native step and paired grip unchanged. Original helper file never edited.'},
  protocol:{primary:'12 reinput rows (2weapons×3directions×2modes) + zweihander cross hold weak/off2rows; observer repeats weak/off cross reinput2rows',combat:'18s scripted player versus original reactive normal AI longsword, sabre/zweihander×seed7/19×weak/off8rows + sabre7off exact observer duplicate. Start gap1.85m, no walls, paired grip, both arm legacy, cut legacy.',
    input:'External hand path/tap commands fixed by time; forward stick .25 first2s then .08 during guard phases. No player AI. Enemy original AI reacts normally. Once player dies external hand writes obey alive gate.',
    limits:'Different correction modes produce different contact/AI/health trajectories; same seed is not same-hit parity. Errors after death/drop are retained, never called controllability improvements. No synthetic contact/wound or direct body health/strength/pose/velocity injections.'},
  roundWindowContract:roundWindow?{frameDtS:DT,check:'After physics or zero-step real frame: first dead detection sets roundOver and returns; later frames add unscaled real dt; >3.5s pauses and stops input/physics.',scale:'1 before roundOver; .5 afterward. 120Hz virtual real frames, native DT fixed. Max18 real seconds.',limitations:'Main calls checkRoundEnd once per rAF with clamped real dt, after all physics; decisive slowMo(.25), hitStop(.12) and variable rAF are not emulated. This is lifecycle-equivalent detection/pause bookkeeping with a conservative post-death physics-time upper bound, not browser-exact replay. External hand/tap script remains on physics clock and writes at physics input phase.'}:null,
  optionsRestored:CONFIG.GRIP.reactionModel===saved.grip&&Math.random===saved.random,primaryObserverChecks,combatObserver,primary,combat};
fs.writeFileSync(rawPath,JSON.stringify(result,null,2)+'\n');const metrics={...result,raw:{path:rawPath,sha256:sha(fs.readFileSync(rawPath))},primary:primary.map(({frames,...r})=>({...r,frameCount:frames.length})),combat:combat.map(({frames,events,...r})=>({...r,frameCount:frames.length,eventCount:events.length}))};
if(!diagnose)fs.writeFileSync(root+'docs/strike/skill_manual_combat_round1.json',JSON.stringify(metrics,null,2)+'\n');fs.rmSync(temporary,{recursive:true,force:true});
console.log(JSON.stringify({rawPath,wallSeconds:result.wallSeconds,sourceStable,primaryObserverChecks,combatObserver,combat:combat.map(x=>({weapon:x.weapon,seed:x.seed,mode:x.mode,...x.summary,final:x.final,taps:x.tapRequests}))}));
if(!sourceStable||!result.optionsRestored||Object.values(combatObserver).some(v=>v===false)||primaryObserverChecks.some(x=>Object.values(x).some(v=>v===false)))process.exitCode=1;
