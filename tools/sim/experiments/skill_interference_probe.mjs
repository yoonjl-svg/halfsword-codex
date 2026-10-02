/** Read-only actual runtime comparison after identical preparation; no new controller. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {runStroke} from '../whole_body_strike_probe.mjs';
import {THREE,DT} from '../harness_m.mjs';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const out=process.argv[2]??'/workspace/halfsword-hybrid-evidence/skill-interference-round1.json';
if(fs.existsSync(out))throw Error('Use a new output path to preserve evidence');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const files=['src/fighter.js','src/skill.js','src/guards.js','src/config.js','src/combat.js','src/cut_reaction.js','tools/sim/harness_m.mjs','tools/sim/whole_body_strike_probe.mjs','tools/sim/experiments/skill_interference_probe.mjs','package-lock.json'];
const manifest=()=>Object.fromEntries(files.map(p=>[p,sha(fs.readFileSync(root+p))]));
function readHead(){const head=fs.readFileSync(root+'.git/HEAD','utf8').trim();if(!head.startsWith('ref: '))return head;const ref=head.slice(5),p=root+'.git/'+ref;
  const value=fs.existsSync(p)?fs.readFileSync(p,'utf8').trim():fs.readFileSync(root+'.git/packed-refs','utf8').split('\n').find(x=>x.endsWith(' '+ref))?.split(' ')[0];
  if(!/^[a-f0-9]{40}$/.test(value??''))throw Error('Cannot read actual HEAD');return value;}
const sourceCommit=readHead();
const before=manifest();
const begin=performance.now(),rows=[];
function run(level,arm,ending,observed=true){
  const observations=[];let previousGoal=null,previousActual=null;
  const totals={maxSwordAngularRadps:0,maxDesiredAxisAngularRadps:0,maxFollowM:0,afterStopDesiredAxisTravelRad:0,afterStopActualAxisTravelRad:0,recoveringSteps:0,maxCorrectedHandGoalStepM:0};
  let previousHand=null;
  const row=runStroke({weapon:'zweihander',direction:'down',reaction:'paired',ending,seed:7,durationS:.55,prepareS:3,afterS:1.5,sampleHz:120,
    intervention:{activate({G,f}){f.skill.level=level;f.armTorqueModel=arm;G.combat.cutReactionModel='budgeted';},
      afterStep:observed?({G,f,sample,iteration})=>{
        const goal=f.debug.aim.clone().normalize(),actual=new THREE.Vector3(sample.bladeAxisWorld.x,sample.bladeAxisWorld.y,sample.bladeAxisWorld.z);
        const angle=(a,b)=>Math.acos(Math.max(-1,Math.min(1,a.dot(b))));
        const goalStep=previousGoal?angle(previousGoal,goal):0,actualStep=previousActual?angle(previousActual,actual):0;
        const hand=f.handTarget.clone(),handStep=previousHand?hand.distanceTo(previousHand):0;
        const sw=f.sword.angvel(),angular=Math.hypot(sw.x,sw.y,sw.z);
        totals.maxSwordAngularRadps=Math.max(totals.maxSwordAngularRadps,angular);
        totals.maxDesiredAxisAngularRadps=Math.max(totals.maxDesiredAxisAngularRadps,goalStep/DT);
        totals.maxFollowM=Math.max(totals.maxFollowM,f.skill.follow.length());
        totals.maxCorrectedHandGoalStepM=Math.max(totals.maxCorrectedHandGoalStepM,handStep);
        if(sample.phase==='after_input'){totals.afterStopDesiredAxisTravelRad+=goalStep;totals.afterStopActualAxisTravelRad+=actualStep;}
        if(f.skill.recovering)totals.recoveringSteps++;
        observations.push({timeS:sample.timeS,phase:sample.phase,requestedDragM:sample.phase==='stroke'?sample.handOffsetM:null,actualHandOffsetM:f.handOffset.toArray(),handHeld:f.handHeld,inputActive:f.inputActive,
          level:f.skill.level,guardWeight:f.guardWeight(),followM:f.skill.follow.toArray(),anchorM:f.skill.anchor.toArray(),aimRawM:f.skill.aimRaw.toArray(),aimM:f.skill.aim.toArray(),recovering:f.skill.recovering,
          guardNearestIndex:f.guardPose.nearest,guardHandM:[...f.guardPose.hand],guardDir:[...f.guardPose.dir],bodyGuardNearestIndex:f.bodyGuard.nearest,bodyPose:{...f.bodyPose},
          actualHandGoalWorldM:hand.toArray(),desiredBladeAxisWorld:goal.toArray(),actualBladeAxisWorld:actual.toArray(),swordAngularRadps:angular,cutContacts:G.combat.cutting.size});
        previousGoal=goal;previousActual=actual;previousHand=hand;
      }:null}});
  return {...row,level,arm,observed,totals:observed?totals:null,observations};
}
for(const ending of ['target_hold','release'])for(const level of [0,.4,.7])for(const arm of ['legacy','sharedCap'])rows.push(run(level,arm,ending));
const observerChecks=[];
for(const [level,arm]of [[0,'legacy'],[.4,'sharedCap']]){
  const fresh=run(level,arm,'target_hold',false),reference=rows.find(r=>r.level===level&&r.arm===arm&&r.ending==='target_hold');
  observerChecks.push({level,arm,physicalControlTraceExact:fresh.traceSha256===reference.traceSha256,inputExact:fresh.inputSha256===reference.inputSha256});
}
const after=manifest();
const result={probe:'skill_interference_probe',sourceCommit,command:process.argv,createdUTC:new Date().toISOString(),wallSeconds:(performance.now()-begin)/1000,
  sourceCommitAfter:readHead(),probeSha256:before['tools/sim/experiments/skill_interference_probe.mjs'],
  protocol:{weapon:'zweihander',direction:'down',seed:7,levels:[0,.4,.7],arm:['legacy','sharedCap'],cut:'budgeted',grip:'paired',prepareLevel:.7,
    preparation:'All rows prepare at level .7 with legacy arm/legacy grip for 3 seconds; level and arm changed only after identical preparation. This tests same-state incremental correction, not a whole game started at each level.',
    requestedInput:'Identical [.02,.52] to [.02,-.45] linear drag over .55s, then 1.5s hold or release; no post-stroke drag. Recovery may change actual handOffset after release.',
    inputHashScope:'Inherited runStroke input hash covers time and externally requested handOffset during drag only; deliberately excludes hold/release boolean. Per-step observations record handHeld/inputActive and actual handOffset separately.',
    exclusions:'Enemy parked; no combat contacts expected, no wounds/mobile/user-scene reproduction. Blade axis ignores twist. Angular speed includes twist. Readout targets precede native world step; actual body readouts follow it.'},
  sourceBefore:before,sourceAfter:after,sourceStableDuringRun:JSON.stringify(before)===JSON.stringify(after),sameStartNative:rows.every(r=>r.startNativeSha256===rows[0].startNativeSha256),sameStartControl:rows.every(r=>r.startSha256===rows[0].startSha256),sameRequestedInput:rows.every(r=>r.inputSha256===rows[0].inputSha256),observerChecks,rows};
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({out,sourceCommit,wallSeconds:result.wallSeconds,sourceStable:result.sourceStableDuringRun,sameStartNative:result.sameStartNative,sameStartControl:result.sameStartControl,sameRequestedInput:result.sameRequestedInput,observerChecks,
  rows:rows.map(r=>({level:r.level,arm:r.arm,ending:r.ending,peakTipMps:r.peak.tipSpeedMps,finalAimErrorRad:r.final.bladeAimErrorRad,maxHandErrorM:r.summary.maxHandTargetErrorM,...r.totals}))}));
if(result.sourceCommit!==result.sourceCommitAfter||!result.sourceStableDuringRun||!result.sameStartNative||!result.sameStartControl||!result.sameRequestedInput||observerChecks.some(x=>!x.physicalControlTraceExact||!x.inputExact))process.exitCode=1;
