/** Same-state ablation using actual game controllers. Only isolated option values change. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {newRound,THREE,CONFIG,DT,handPos} from '../harness_m.mjs';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const output=process.argv[2]??'/workspace/halfsword-hybrid-evidence/skill-interference-round2.json';
if(fs.existsSync(output))throw Error('Choose a fresh evidence path');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const vec=x=>new THREE.Vector3(x.x,x.y,x.z),angle=(a,b)=>Math.acos(Math.max(-1,Math.min(1,a.dot(b))));
const original={followGain:CONFIG.SKILL.followGain,grip:CONFIG.GRIP.reactionModel,random:Math.random};
const motions={down:[[.02,.52],[.02,-.45]],up:[[.02,-.45],[.02,.52]],horizontal:[[-.42,.03],[.42,.03]]};
const variants={weak:{level:.4,autoGuard:true,followGain:original.followGain},noAuto:{level:.4,autoGuard:false,followGain:original.followGain},noFollow:{level:.4,autoGuard:true,followGain:0},both:{level:.4,autoGuard:false,followGain:0},off:{level:0,autoGuard:true,followGain:original.followGain}};
function head(){const value=fs.readFileSync(root+'.git/HEAD','utf8').trim();if(!value.startsWith('ref: '))return value;const ref=value.slice(5),file=root+'.git/'+ref;
  const result=fs.existsSync(file)?fs.readFileSync(file,'utf8').trim():fs.readFileSync(root+'.git/packed-refs','utf8').split('\n').find(x=>x.endsWith(' '+ref))?.split(' ')[0];if(!/^[a-f0-9]{40}$/.test(result??''))throw Error('Cannot read HEAD');return result;}
function scan(dir){return fs.readdirSync(root+dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?scan(dir+'/'+x.name):x.name.endsWith('.js')?[dir+'/'+x.name]:[]);}
const sourceFiles=[...scan('src'),'tools/sim/harness_m.mjs','tools/sim/experiments/skill_interference_round2.mjs','package-lock.json','node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'];
const manifest=()=>Object.fromEntries(sourceFiles.sort().map(p=>[p,sha(fs.readFileSync(root+p))]));
const before=manifest(),sourceCommit=head(),begin=performance.now();
function control(f){return {level:f.skill.level,autoGuard:f.skill.autoGuard,handOffset:f.handOffset.toArray(),move:f.move.toArray(),handHeld:f.handHeld,inputActive:f.inputActive,state:f.state,stateTime:f.stateTime,
  skill:Object.fromEntries(Object.entries(f.skill).filter(([k,v])=>k!=='f'&&(v===null||typeof v!=='object'||v?.isVector2)).map(([k,v])=>[k,v?.isVector2?v.toArray():v])),
  bodyPose:{...f.bodyPose},bodyPoseVel:{...f.bodyPoseVel},yaw:f.yaw.toArray(),heading:f.heading,wristBrake:f.wristBrake??false,wristHill:f.wristHill??null,prevAim:f.prevAim?.toArray(),
  joints:f.joints.map(j=>[j.name,j.target.toArray(),j.prevTarget?.toArray(),j.prevRV?.toArray(),j.gain??1])};}
// This read-only intent reference uses Fighter.guardDir's existing raw mapping formula.
// It never substitutes the variant's authored pose or autoGuard-updated handOffset.
function rawDirection(x,y){const el=y<=.1?Math.max(-.6,(y-.1)*1.1):Math.min(1.75,((y-.1)/.5)*1.65),az=THREE.MathUtils.clamp((x-.05)*1.7,-1.1,1.3),c=Math.cos(el);return new THREE.Vector3(c*Math.cos(az),Math.sin(el),c*Math.sin(az));}
function rawHand(x,y){const R=CONFIG.WEAPON.reach,depth=.12+.5*Math.sqrt(Math.max(0,1-(x*x+y*y)/(R*R)));return new THREE.Vector3(depth,.1+y,.1+x);}
function bodyState(G){return [...G.world.bodies.getAll()].map(b=>({h:b.handle,p:b.translation(),q:b.rotation(),v:b.linvel(),w:b.angvel()}));}
function run(variant,motion,ending,observed=true){
  let G;const frames=[],trace=crypto.createHash('sha256'),input=crypto.createHash('sha256');
  let lastActual=null,lastGoal=null,lastRawGoal=null,peakGoal={speedRadps:0};
  const stats={finite:true,afterAxisTravelRad:0,afterGoalTravelRad:0,afterOriginalRawGoalTravelRad:0,maxSwordAngularRadps:0,maxFollowM:0,recoveringSteps:0,maxCutContacts:0,
    ownAimErrorIntegralRads:0,originalRawAimErrorIntegralRads:0,fixedWorldRawAimErrorIntegralRads:0,maxRawHandErrorM:0,maxOwnHandErrorM:0,afterDurationS:0};
  try{
    CONFIG.SKILL.followGain=original.followGain;CONFIG.GRIP.reactionModel='legacy';
    G=newRound({seed:7,walls:false,weapon:'zweihander',weapon2:'longsword'});G.park();const f=G.player,[from,to]=motions[motion];
    f.handOffset.set(...from);for(const name of ['prev','aim','aimRaw','anchor'])f.skill[name].set(...from);
    f.skill.aimVel.set(0,0);f.skill.vel.set(0,0);f.skill.follow.set(0,0);f.handHeld=true;f.inputActive=false;f.skill.autoGuard=true;
    for(let i=0;i<Math.round(3/DT);i++)G.step();
    const start={native:sha(G.world.takeSnapshot()),control:sha(JSON.stringify(control(f))),followM:f.skill.follow.toArray()};
    const yawAtStart=f.yaw.clone();const config=variants[variant];f.skill.level=config.level;f.skill.autoGuard=config.autoGuard;CONFIG.SKILL.followGain=config.followGain;
    CONFIG.GRIP.reactionModel='paired';f.armTorqueModel='sharedCap';G.combat.cutReactionModel='budgeted';
    const duration=.55,after=1.5,steps=Math.ceil((duration+after)/DT);
    for(let i=0;i<steps;i++){
      const t=i*DT,inStroke=t<duration,u=inStroke?Math.min(1,(t+DT)/duration):1,requested=[from[0]+(to[0]-from[0])*u,from[1]+(to[1]-from[1])*u];
      if(inStroke){f.handOffset.set(...requested);f.handHeld=true;f.inputActive=true;}else{f.handHeld=ending==='hold';f.inputActive=false;}
      input.update(JSON.stringify({timeS:t,requested,handHeld:f.handHeld,inputActive:f.inputActive}));
      G.step();const state=bodyState(G),ctrl=control(f);trace.update(JSON.stringify({state,ctrl}));
      for(const body of state)for(const field of ['p','q','v','w'])if(!Object.values(body[field]).every(Number.isFinite))throw Error('Nonfinite body');
      if(!observed)continue;
      const actual=new THREE.Vector3(0,1,0).applyQuaternion(new THREE.Quaternion().copy(f.sword.rotation())),goal=f.debug.aim.clone().normalize();
      const rawLocal=rawDirection(...requested),raw=rawLocal.clone().applyQuaternion(f.yaw),fixed=rawLocal.clone().applyQuaternion(yawAtStart);
      const hand=handPos(f),rawHandWorld=rawHand(...requested).applyQuaternion(f.yaw).add(vec(f.bodies.chest.translation()));
      const ownError=angle(actual,goal),rawError=angle(actual,raw),fixedError=angle(actual,fixed),ownHandError=hand.distanceTo(f.handTarget),rawHandError=hand.distanceTo(rawHandWorld);
      const goalStep=lastGoal?angle(lastGoal,goal):0,actualStep=lastActual?angle(lastActual,actual):0,rawGoalStep=lastRawGoal?angle(lastRawGoal,raw):0;
      if(goalStep/DT>peakGoal.speedRadps)peakGoal={speedRadps:goalStep/DT,timeS:(i+1)*DT,phase:inStroke?'stroke':'after',stepRad:goalStep};
      const omega=vec(f.sword.angvel()).length();stats.maxSwordAngularRadps=Math.max(stats.maxSwordAngularRadps,omega);stats.maxFollowM=Math.max(stats.maxFollowM,f.skill.follow.length());
      stats.maxCutContacts=Math.max(stats.maxCutContacts,G.combat.cutting.size);stats.maxOwnHandErrorM=Math.max(stats.maxOwnHandErrorM,ownHandError);stats.maxRawHandErrorM=Math.max(stats.maxRawHandErrorM,rawHandError);
      if(f.skill.recovering)stats.recoveringSteps++;
      if(!inStroke){stats.afterDurationS+=DT;stats.afterAxisTravelRad+=actualStep;stats.afterGoalTravelRad+=goalStep;stats.afterOriginalRawGoalTravelRad+=rawGoalStep;stats.ownAimErrorIntegralRads+=ownError*DT;stats.originalRawAimErrorIntegralRads+=rawError*DT;stats.fixedWorldRawAimErrorIntegralRads+=fixedError*DT;}
      frames.push({timeS:(i+1)*DT,phase:inStroke?'stroke':'after',requestedHandOffsetM:requested,actualHandOffsetM:f.handOffset.toArray(),handHeld:f.handHeld,inputActive:f.inputActive,followM:f.skill.follow.toArray(),recovering:f.skill.recovering,
        rawAimM:f.skill.aimRaw.toArray(),filteredAimM:f.skill.aim.toArray(),bodyPose:{...f.bodyPose},desiredAxis:goal.toArray(),actualAxis:actual.toArray(),originalRawAxis:raw.toArray(),fixedWorldOriginalRawAxis:fixed.toArray(),
        actualHandWorldM:hand.toArray(),ownHandGoalWorldM:f.handTarget.toArray(),rawHandGoalWorldM:rawHandWorld.toArray(),ownAimErrorRad:ownError,originalRawAimErrorRad:rawError,fixedWorldOriginalRawAimErrorRad:fixedError,ownHandErrorM:ownHandError,rawHandErrorM:rawHandError,swordAngularRadps:omega,state:f.state});
      lastActual=actual;lastGoal=goal;lastRawGoal=raw;
    }
    if(observed){stats.afterOwnAimMeanErrorRad=stats.ownAimErrorIntegralRads/stats.afterDurationS;stats.afterOriginalRawAimMeanErrorRad=stats.originalRawAimErrorIntegralRads/stats.afterDurationS;stats.afterFixedWorldRawAimMeanErrorRad=stats.fixedWorldRawAimErrorIntegralRads/stats.afterDurationS;}
    return {variant,motion,ending,observed,config:{...config,arm:'sharedCap',grip:'paired',cut:'budgeted'},start,inputSha256:input.digest('hex'),traceSha256:trace.digest('hex'),stats:observed?stats:null,peakGoal:observed?peakGoal:null,final:frames.at(-1)??null,frames};
  }finally{G?.eventQueue.free();G?.world.free();CONFIG.SKILL.followGain=original.followGain;CONFIG.GRIP.reactionModel=original.grip;Math.random=original.random;}
}
const rows=[];for(const motion of Object.keys(motions))for(const ending of ['hold','release'])for(const variant of Object.keys(variants))rows.push(run(variant,motion,ending));
const observers=[];for(const [variant,motion,ending]of [['weak','down','release'],['both','up','hold'],['off','horizontal','release']]){const a=rows.find(r=>r.variant===variant&&r.motion===motion&&r.ending===ending),b=run(variant,motion,ending,false);observers.push({variant,motion,ending,traceExact:a.traceSha256===b.traceSha256,inputExact:a.inputSha256===b.inputSha256});}
const groups=Object.keys(motions).flatMap(motion=>['hold','release'].map(ending=>{const group=rows.filter(r=>r.motion===motion&&r.ending===ending),a=group[0];return {motion,ending,nativeExact:group.every(r=>r.start.native===a.start.native),controllerExact:group.every(r=>r.start.control===a.start.control),requestedInputAndEndingExact:group.every(r=>r.inputSha256===a.inputSha256),zeroStartFollow:group.every(r=>r.start.followM.every(x=>x===0))};}));
const after=manifest(),sourceCommitAfter=head(),sourceStable=JSON.stringify(before)===JSON.stringify(after)&&sourceCommit===sourceCommitAfter;
const result={probe:'skill_interference_round2',sourceCommit,sourceCommitAfter,createdUTC:new Date().toISOString(),command:process.argv,wallSeconds:(performance.now()-begin)/1000,sourceStable,sourceBefore:before,sourceAfter:after,probeSHA256:before['tools/sim/experiments/skill_interference_round2.mjs'],
  protocol:{motions,weapon:'zweihander',seed:7,preparationLevel:.7,prepareS:3,dragS:.55,afterS:1.5,variants,arm:'sharedCap',grip:'paired',cut:'budgeted',sameState:'Each motion prepares at original .7 autoGuard/normal follow/legacy grip. Ablation values change after matching native/controller preparation. Every global option restored before next prep.',
    reference:'True original-input intent benchmark is the uncorrected guardDir/raw hand mapping evaluated at externally requested offset, held at drag endpoint after input. Both current-body yaw and fixed initial-world yaw axis errors are recorded. This is an explicit raw-mapping reference, not proof of a human intended angle.',
    hashes:'Requested input hash includes full external path and ending handHeld/inputActive flags; automatic changes to actual handOffset are recorded separately.',limits:'No contact/wound/AI-duel/browser/mobile/user-scene reproduction. No claim of ergonomic calibration equivalence. Axis travel omits twist, omega includes twist. Controller target readouts pre-step versus actual body post-step; raw hand reference uses post-step chest/yaw.'},
  observationsRestored:CONFIG.SKILL.followGain===original.followGain&&CONFIG.GRIP.reactionModel===original.grip&&Math.random===original.random,groups,observers,rows};
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
const metrics={...result,raw:{path:output,sha256:sha(fs.readFileSync(output))},rows:rows.map(({frames,...r})=>({...r,sampleCount:frames.length}))};delete metrics.sourceAfter;
fs.writeFileSync(root+'docs/strike/skill_interference_round2.json',JSON.stringify(metrics,null,2)+'\n');
console.log(JSON.stringify({output,wallSeconds:result.wallSeconds,sourceStable,groups,observers,observationsRestored:result.observationsRestored,rows:metrics.rows.map(r=>({variant:r.variant,motion:r.motion,ending:r.ending,travel:r.stats.afterAxisTravelRad,ownMean:r.stats.afterOwnAimMeanErrorRad,rawMean:r.stats.afterOriginalRawAimMeanErrorRad,rawFinal:r.final.originalRawAimErrorRad,ownFinal:r.final.ownAimErrorRad}))}));
if(!sourceStable||!result.observationsRestored||groups.some(x=>!x.nativeExact||!x.controllerExact||!x.requestedInputAndEndingExact||!x.zeroStartFollow)||observers.some(x=>!x.traceExact||!x.inputExact))process.exitCode=1;
