/** Research integration: real two-sided AI duels, observed afterStep dispatch only.
 * No stable-mode substitution, wound suppression, freezes, source edits or deployment.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {newRound,AI,DT,THREE,handPos,CONFIG} from '../harness_m.mjs';
import {installForceLedger} from '../force_ledger.mjs';
import {loadCutReactionCombat} from './cut_reaction_candidate.mjs';

const repo=fileURLToPath(new URL('../../../',import.meta.url));
const originalRandom=Math.random;
const vec=v=>({x:v.x,y:v.y,z:v.z});
const V=v=>new THREE.Vector3(v.x,v.y,v.z);
const add=(a,b)=>V(a).add(V(b));
const length=v=>Math.hypot(v.x,v.y,v.z);
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const sourceFiles=['src/combat.js','src/fighter.js','src/gait.js','src/config.js','src/ai.js','tools/sim/harness_m.mjs'];
const hashes=()=>Object.fromEntries(sourceFiles.map(p=>[p,sha(fs.readFileSync(repo+p))]));
const sourceBefore=hashes();
const cloned=await loadCutReactionCombat({mode:'legacy'}),candidate=await loadCutReactionCombat(),budgeted=await loadCutReactionCombat({mode:'budgeted'});
const args=Object.fromEntries(process.argv.slice(2).filter(a=>a.startsWith('--')).map(a=>{const i=a.indexOf('=');return [a.slice(2,i),a.slice(i+1)];}));
const seconds=Number(args.seconds??30),seeds=(args.seeds??'7,17').split(',').map(Number);
const out=args.out??'/workspace/halfsword-hybrid-evidence/cut-reaction-integration-budgeted.json';
const tolerance={momentumAbsPlusRelative:8e-5,angularAbsPlusRelative:3e-4,energyAbsPlusRelative:2e-4,speedAbsPlusRelative:2e-4};
const within=(error,scale,tol)=>Math.abs(error)<=tol*(1+scale);
function controls(f){return {state:f.state,stateTime:f.stateTime,handOffset:f.handOffset.toArray(),handHeld:f.handHeld,
  inputActive:f.inputActive,move:f.move.toArray(),heading:f.heading,blood:f.blood,consciousness:f.consciousness,pain:f.pain,
  limbs:{...f.limbs},bodyPose:{...f.bodyPose},bodyPoseVel:{...f.bodyPoseVel},
  skill:{aim:f.skill.aim.toArray(),aimRaw:f.skill.aimRaw.toArray(),aimVel:f.skill.aimVel.toArray(),
    follow:f.skill.follow.toArray(),anchor:f.skill.anchor.toArray(),activity:f.skill.activity,recovering:f.skill.recovering},
  joints:f.joints.map(j=>({name:j.name,target:j.target?.toArray(),prevTarget:j.prevTarget?.toArray(),prevRV:j.prevRV?.toArray()}))};}
function input(f){return {handOffset:f.handOffset.toArray(),handHeld:f.handHeld,inputActive:f.inputActive,move:f.move.toArray(),
  skill:{tap:f.skill.tap?{...f.skill.tap}:null,thrustPush:f.skill.thrustPush}};}
function fullTrace(G,state){return {timeS:G.t,bodies:state.bodies.map(b=>({handle:b.handle,label:b.label,mass:b.mass,position:b.position,
  rotation:b.rotation,com:b.com,v:b.velocity,w:b.omega,inertia:b.inertia})),fighters:[controls(G.player),controls(G.enemy)],
  wounds:G.wounds.map(w=>({t:w.t,att:w.att.index,vic:w.vic.index,zone:w.zone,type:w.type,energy:w.energy,severity:w.severity})),
  cutting:[...G.combat.cutting].map(([key,c])=>({key,seen:c.seen,applied:c.applied,Eleft:c.Eleft,stuck:c.stuck,stuckT:c.stuckT,mFree:c.mFree,cutBudgetDone:c.cutBudgetDone}))};}
function run({mode,seed,weapons}){
  const start=performance.now(),G=newRound({seed,walls:false,weapon:weapons[0],weapon2:weapons[1],AIClass:AI,AI2Class:AI});
  const ledger=installForceLedger(G,{maxSamples:0}),wrapper=G.combat.afterStep;
  let undo=null;
  if(mode!=='original')undo=ledger.replaceObservedMethod(G.combat,'afterStep',(mode==='clone'?cloned:mode==='budgeted'?budgeted:candidate).Combat.prototype.afterStep);
  const traceHash=crypto.createHash('sha256'),inputHash=crypto.createHash('sha256'),frameHashes=[],inputHashes=[];
  const initialNative=sha(G.world.takeSnapshot()),initialControls=sha(JSON.stringify([controls(G.player),controls(G.enemy)]));
  const stats={finite:true,steps:0,falls:[0,0],stateFrames:[{},{}],maxGripGapM:[0,0],maxOffHandGapM:[0,0],
    maxValidMainGripJointGapM:[0,0],mainGripJointValidFrames:[0,0],mainGripJointInvalidFrames:[0,0],
    mainGripArmedJointMismatchFrames:[0,0],offHandGrippingFrames:[0,0],mainGripJointEpisodes:[[],[]],
    gripGapAllFramePeak:[null,null],validMainGripJointGapPeak:[null,null],
    peakTotalKJ:0,peakSwordKJ:[0,0],maxBodySpeedMps:0,maxBodyAngularSpeedRadps:0,
    cutImpulsePairs:0,cutMapActiveFrames:0,candidateCallbacks:0,candidatePositivePairs:0,
    candidateRequestedSumNs:0,candidateAppliedSumNs:0,candidatePredictedDeltaKSumJ:0,candidateActualDeltaKSumJ:0,
    maxInstantPairDeltaP:0,maxInstantPairDeltaL:0,maxInstantEnergyPredictionErrorJ:0,
    instantClosurePass:true,instantPassivityPass:true,budgetedDragPairs:0,budgetClosurePass:true,
    budgetDebitSumJ:0,maxBudgetMeasuredLossErrorJ:0,observedDispatchPreserved:G.combat.afterStep===wrapper};
  const instantRows=[],sampleRows=[];let callbacks=[],lastStates=[G.player.state,G.enemy.state],lastJointValid=[null,null];
  G.combat.onCutReaction=d=>callbacks.push(d);
  try{
    const frames=Math.ceil(seconds/DT);
    for(let i=0;i<frames;i++){
      callbacks=[];G.step();stats.steps++;
      const latest=ledger.latest,state=latest.postGame;
      const trace=JSON.stringify(fullTrace(G,state)),inText=JSON.stringify([input(G.player),input(G.enemy)]);
      traceHash.update(trace);inputHash.update(inText);frameHashes.push(sha(trace));inputHashes.push(sha(inText));
      for(const b of state.bodies){
        for(const v of [b.position,b.rotation,b.velocity,b.omega])if(!Object.values(v).every(Number.isFinite))stats.finite=false;
        stats.maxBodySpeedMps=Math.max(stats.maxBodySpeedMps,length(b.velocity));
        stats.maxBodyAngularSpeedRadps=Math.max(stats.maxBodyAngularSpeedRadps,length(b.omega));
        if(b.part==='sword')stats.peakSwordKJ[b.owner]=Math.max(stats.peakSwordKJ[b.owner],b.K);
      }
      stats.peakTotalKJ=Math.max(stats.peakTotalKJ,state.total.K);
      [G.player,G.enemy].forEach((f,index)=>{
        if(f.state==='down'&&lastStates[index]!=='down')stats.falls[index]++;
        lastStates[index]=f.state;stats.stateFrames[index][f.state]=(stats.stateFrames[index][f.state]??0)+1;
        const q=new THREE.Quaternion().copy(f.sword.rotation()),hilt=V(f.sword.translation());
        const jointValid=!!f.gripJoint?.isValid(),allFrameGap=handPos(f).distanceTo(hilt);
        const context={frame:i,timeS:G.t,jointValid,armed:f.armed,alive:f.alive,state:f.state,blood:f.blood,
          consciousness:f.consciousness,causeOfDeath:f.causeOfDeath,primaryForearmDetached:!!f.detachedParts?.has('farmS')};
        if(allFrameGap>stats.maxGripGapM[index]){stats.maxGripGapM[index]=allFrameGap;stats.gripGapAllFramePeak[index]={...context,gapM:allFrameGap};}
        if(jointValid!==lastJointValid[index]){
          const episodes=stats.mainGripJointEpisodes[index],last=episodes.at(-1);
          if(last){last.endFrame=i-1;last.endTimeS=i*DT;last.durationS=(last.endFrame-last.startFrame+1)*DT;}
          episodes.push({...context,startFrame:i,startTimeS:i*DT,endFrame:null,endTimeS:null,durationS:null});
          lastJointValid[index]=jointValid;
        }
        if(jointValid){
          stats.mainGripJointValidFrames[index]++;
          const joint=f.gripJoint,b1=joint.body1(),b2=joint.body2();
          const p1=V(joint.anchor1()).applyQuaternion(new THREE.Quaternion().copy(b1.rotation())).add(V(b1.translation()));
          const p2=V(joint.anchor2()).applyQuaternion(new THREE.Quaternion().copy(b2.rotation())).add(V(b2.translation()));
          const gap=p1.distanceTo(p2);
          if(gap>stats.maxValidMainGripJointGapM[index]){stats.maxValidMainGripJointGapM[index]=gap;stats.validMainGripJointGapPeak[index]={...context,gapM:gap};}
        }else stats.mainGripJointInvalidFrames[index]++;
        if(jointValid!==!!f.armed)stats.mainGripArmedJointMismatchFrames[index]++;
        const pommel=V({x:0,y:f.weaponCfg.gripAlong,z:0}).applyQuaternion(q).add(hilt);
        const offHand=V({x:0,y:-.135,z:0}).applyQuaternion(new THREE.Quaternion().copy(f.bodies.farmO.rotation())).add(V(f.bodies.farmO.translation()));
        if(f.gripping){stats.offHandGrippingFrames[index]++;stats.maxOffHandGapM[index]=Math.max(stats.maxOffHandGapM[index],offHand.distanceTo(pommel));}
      });
      if(G.combat.cutting.size)stats.cutMapActiveFrames++;
      // Nested rebound/steel impulses carry longer observed paths and are excluded.
      const cutOps=latest.operations.filter(e=>e.path==='combat.afterStep'&&e.method==='applyImpulseAtPoint');
      if(cutOps.length%2)throw new Error('Odd cutting impulse operation count');
      stats.cutImpulsePairs+=cutOps.length/2;
      if(mode==='candidate'||mode==='budgeted'){
        const positive=callbacks.filter(d=>d.J>0);
        if(positive.length*2!==cutOps.length)throw new Error('Candidate diagnostic/observed operation count mismatch');
        stats.candidateCallbacks+=callbacks.length;
        positive.forEach((d,index)=>{
          const a=cutOps[index*2],b=cutOps[index*2+1];
          if(a.handle===b.handle||JSON.stringify(a.point)!==JSON.stringify(b.point))throw new Error('Cut pair did not use distinct bodies at same point');
          const deltaP=add(a.deltaP,b.deltaP),deltaL=add(a.deltaL,b.deltaL),deltaK=a.deltaK+b.deltaK;
          const pScale=length(a.deltaP)+length(b.deltaP),lScale=length(a.deltaL)+length(b.deltaL),
            kScale=Math.abs(a.deltaK)+Math.abs(b.deltaK)+Math.abs(d.deltaKPredicted);
          const closure=within(length(deltaP),pScale,tolerance.momentumAbsPlusRelative)
            &&within(length(deltaL),lScale,tolerance.angularAbsPlusRelative);
          const prediction=within(deltaK-d.deltaKPredicted,kScale,tolerance.energyAbsPlusRelative);
          const passive=deltaK<=tolerance.energyAbsPlusRelative*(1+kScale)
            &&d.sAfterMeasured>=-tolerance.speedAbsPlusRelative*(1+Math.abs(d.s));
          stats.candidatePositivePairs++;stats.candidateRequestedSumNs+=d.requestedJ;stats.candidateAppliedSumNs+=d.J;
          stats.candidatePredictedDeltaKSumJ+=d.deltaKPredicted;stats.candidateActualDeltaKSumJ+=deltaK;
          stats.maxInstantPairDeltaP=Math.max(stats.maxInstantPairDeltaP,length(deltaP));
          stats.maxInstantPairDeltaL=Math.max(stats.maxInstantPairDeltaL,length(deltaL));
          stats.maxInstantEnergyPredictionErrorJ=Math.max(stats.maxInstantEnergyPredictionErrorJ,Math.abs(deltaK-d.deltaKPredicted));
          stats.instantClosurePass&&=closure;stats.instantPassivityPass&&=passive&&prediction;
          let budgetClosurePass=null;
          if(mode==='budgeted'&&d.regime==='drag'){
            stats.budgetedDragPairs++;stats.budgetDebitSumJ+=d.budgetDebitJ;
            const budgetError=d.budgetBeforeJ-d.budgetAfterJ+deltaK;
            stats.maxBudgetMeasuredLossErrorJ=Math.max(stats.maxBudgetMeasuredLossErrorJ,Math.abs(budgetError));
            budgetClosurePass=d.budgetAfterJ>=0&&d.budgetDebitJ<=d.budgetBeforeJ+1e-10
              &&within(budgetError,kScale,tolerance.energyAbsPlusRelative)
              &&within(d.budgetDebitJ+d.deltaKPredicted,kScale,1e-10);
            stats.budgetClosurePass&&=budgetClosurePass;
          }
          instantRows.push({frame:i,timeS:G.t,diagnostic:d,deltaP:vec(deltaP),deltaL:vec(deltaL),deltaK,
            closurePass:closure,predictionPass:prediction,passivityPass:passive,budgetClosurePass,operations:[a,b]});
        });
      }
      if(i%120===0||i===frames-1)sampleRows.push({frame:i,timeS:G.t,KJ:state.total.K,states:[G.player.state,G.enemy.state],
        wounds:G.wounds.length,cutting:G.combat.cutting.size,blood:[G.player.blood,G.enemy.blood]});
      if(!stats.finite)break;
    }
    for(const episodes of stats.mainGripJointEpisodes){const last=episodes.at(-1);if(last){last.endFrame=stats.steps-1;last.endTimeS=stats.steps*DT;last.durationS=(last.endFrame-last.startFrame+1)*DT;}}
    const damage={woundEvents:G.wounds.length,byType:{},sumReportedEnergyJ:0,sumSeverity:0,
      final:[G.player,G.enemy].map(f=>({blood:f.blood,consciousness:f.consciousness,pain:f.pain,limbs:{...f.limbs},
        wounds:f.wounds.length,state:f.state,dead:f.dead,causeOfDeath:f.causeOfDeath}))};
    for(const w of G.wounds){damage.byType[w.type]=(damage.byType[w.type]??0)+1;damage.sumReportedEnergyJ+=w.energy;damage.sumSeverity+=w.severity;}
    return {mode,seed,weapons,seconds:stats.steps*DT,wallSeconds:(performance.now()-start)/1000,initialNative,initialControls,
      traceSHA256:traceHash.digest('hex'),inputSHA256:inputHash.digest('hex'),frameHashes,inputHashes,stats,damage,instantRows,sampleRows};
  }finally{undo?.();ledger.restore();G.eventQueue.free();G.world.free();Math.random=originalRandom;}
}
const runs=[],comparisons=[];
for(const weapons of [['longsword','zweihander'],['zweihander','longsword']])for(const seed of seeds){
  const group=[];
  for(const mode of ['original','clone','candidate','budgeted']){
    const r=run({mode,seed,weapons});runs.push(r);group.push(r);
    console.log(JSON.stringify({mode,seed,weapons,seconds:r.seconds,wallSeconds:r.wallSeconds,finite:r.stats.finite,
      cuts:r.stats.cutImpulsePairs,candidateCalls:r.stats.candidateCallbacks,falls:r.stats.falls,wounds:r.damage.woundEvents,peakK:r.stats.peakTotalKJ}));
  }
  const [a,b,c,d]=group;
  comparisons.push({seed,weapons,preparationNativeExact:group.every(r=>a.initialNative===r.initialNative),
    preparationControlExact:group.every(r=>a.initialControls===r.initialControls),
    originalCloneFullTraceExact:a.traceSHA256===b.traceSHA256&&JSON.stringify(a.frameHashes)===JSON.stringify(b.frameHashes),
    originalCloneInputTraceExact:a.inputSHA256===b.inputSHA256,
    firstCandidateTraceDifferenceFrame:a.frameHashes.findIndex((h,i)=>h!==c.frameHashes[i]),
    firstCandidateReactiveInputDifferenceFrame:a.inputHashes.findIndex((h,i)=>h!==c.inputHashes[i]),
    firstBudgetedTraceDifferenceFrame:a.frameHashes.findIndex((h,i)=>h!==d.frameHashes[i]),
    firstBudgetedReactiveInputDifferenceFrame:a.inputHashes.findIndex((h,i)=>h!==d.inputHashes[i]),
    inputInterpretation:'Same seed, native initial state, controllers and AI classes. Candidate changes physics; reactive AI inputs can diverge afterward. Not a same-input candidate comparison.'});
}
const sourceAfter=hashes();
const report={createdUTC:new Date().toISOString(),baselineCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),
  command:`node tools/sim/experiments/cut_reaction_integration_probe.mjs --seconds=${seconds} --seeds=${seeds.join(',')} --out=${out}`,
  configuration:{seconds,seeds,weapons:[['longsword','zweihander'],['zweihander','longsword']],AI:'real AI on both fighters',
    walls:false,DT,gripReaction:CONFIG.GRIP.reactionModel,weightMode:CONFIG.BODY.weightMode,
    support:{assist:CONFIG.GAIT.assist,catchMode:CONFIG.GAIT.catchMode,catchScale:CONFIG.GAIT.catchScale}},
  tolerance,sourceBefore,sourceAfter,sourceStable:JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter),comparisons,runs,
  researchSourceSHA256:Object.fromEntries(['cut_reaction_candidate.mjs','cut_reaction_candidate.test.mjs','cut_reaction_integration_probe.mjs']
    .map(p=>[p,sha(fs.readFileSync(new URL(p,import.meta.url)))])),
  gapDefinitions:{mainHand:'farmS local (+.13,0,0) to sword origin; all frames',
    validMainGripJoint:'live native joint anchor1/body1 to anchor2/body2; only gripJoint.isValid() frames',
    unboundPeriods:'gripJoint.isValid() false frame counts/episodes; armed/alive/detached and causeOfDeath observed, not inferred defects',
    offHand:'farmO local (0,-.135,0) to sword local (0,weaponCfg.gripAlong,0); only actual gripping frames'},
  limitations:['Instant cutting pair conservation is distinct from native collision/joint/motor residuals',
    'Candidate keeps legacy requested-J*s Eleft; budgeted closes only instant paired kinetic loss, not later native/body energy',
    'AI reacts to changed physical state after branching; candidate inputs are not held identical',
    'Naturalness/play feel and native whole-body realism remain unverified','Research only, no activation or deployment']};
report.pass=report.sourceStable&&comparisons.every(c=>c.preparationNativeExact&&c.preparationControlExact&&c.originalCloneFullTraceExact&&c.originalCloneInputTraceExact)
  &&runs.every(r=>r.stats.finite&&r.stats.observedDispatchPreserved&&r.stats.instantClosurePass&&r.stats.instantPassivityPass&&r.stats.budgetClosurePass)
  &&runs.filter(r=>r.mode==='candidate'||r.mode==='budgeted').every(r=>r.stats.candidateCallbacks>0&&r.stats.candidatePositivePairs>0);
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pass:report.pass,runs:runs.length,out,sourceStable:report.sourceStable,comparisons}));
process.exitCode=report.pass?0:1;
