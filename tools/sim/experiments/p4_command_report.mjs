// Small report map; raw observations and old failed runs remain immutable.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const opts=Object.fromEntries(process.argv.slice(2).map(s=>{const m=/^--(evidence|out)=(.+)$/.exec(s);assert(m);return[m[1],m[2]];}));
assert(opts.evidence&&opts.out&&!fs.existsSync(opts.out));
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=n=>JSON.parse(fs.readFileSync(path.join(opts.evidence,n)));
const artifact=p=>{const bytes=fs.readFileSync(p);return{path:p,bytes:bytes.length,sha256:sha(bytes)};};
const observe=read('command-observe01.json'),pair=read('command-ls01.json'),analysis=read('command-analysis01.json'),spawn=read('command-spawn01.json');
const contactOff=read('command-contact01/report.json'),contactEarly=read('command-contact03/report.json'),contactFinal=read('command-contact04/report.json');
const failureAccounting=read('command-contact03-failure-accounting.json');
const names=['command-observe01.json','command-ls01.json','command-ls01-proof.json','command-ls01-runner.mjs','command-analysis01.json','command-spawn01.json','command-spawn01-proof.json','command-spawn01-runner.mjs','command-spawn01-producer.mjs','command-spawn01-corrected-aggregate.json','source-bridge01.json','command-q-boundary01.json',
  'command-contact01/report.json','command-contact01/receipt.json','command-contact01-preparation.json','command-contact01-producer.mjs',
  'command-contact02-preparation.json','command-contact02-producer.mjs',
  'command-contact03/report.json','command-contact03/receipt.json','command-contact03-preparation.json','command-contact03-producer.mjs','command-contact03-failure-accounting.json',
  'command-contact04/report.json','command-contact04/receipt.json','command-contact04-preparation.json'];
const selected=['tipPeakMps','tipMeanMps','kineticPeakJ','kineticMeanJ','axialPeakRadps','axialTravelRad','actualEdgeErrorWeightedRad','maximumTargetSlewRad','maxGapM'];
const phases=['firstCut','followHold','reverse','reverseHold','tap','recut','recutHold','release'];
const comparison=Object.fromEntries(['longsword','qinggang'].map(weapon=>[weapon,Object.fromEntries(phases.map(phase=>[phase,Object.fromEntries(selected.map(key=>[key,['legacy','commandDirection'].map(mode=>spawn.rows.find(r=>r.weapon===weapon&&r.mode===mode).summary[phase][key])]))]))]));
const result={schemaVersion:1,status:'research_preserved_unpublished_contact_not_observed',effectAccepted:false,runtimeIntegrated:false,publicChanged:false,
  headAtReport:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),frozenSourceCommit:pair.sourceCommit,
  purpose:'Preserve commanded cutting progress and meaningful inertia while reducing unwanted recut roll; no score requires every scalar to improve.',
  hypothesis:'During an active cut, final hand+aim command-point direction may be a useful alternative to the residual physical-velocity direction.',
  candidate:'Only when inputActive && skill.swinging && !skill.tap && thrustPose.w===0 and transverse command is nonzero: use normal(blade×commandPointVelocity) in the existing moving-plane blend. Existing physical speed weight, rest plane, nearest-flat sign choice, torque/damping/caps and reaction laws remain. No normal memory at rest.',
  oldFailuresNotEnabled:['restHemisphere','continuedNormal','planePotential','planeMixture','tensorMean','freshPhysicalVelocity','commandedPlane/commandedPlaneC1','pointIntent plane memory'],
  observation:{steps:observe.physicsSteps,nativeAndAppliedInputExact:observe.nativeAndAppliedInputExact,sourceStable:observe.sourceStable,
    boundaryTicks:[324,325],worldCommandNormalSlewDeg:observe.frames.find(f=>f.tick===325).command.planes.world.normalSlewDeg,
    bodyRelativeCommandNormalSlewDeg:observe.frames.find(f=>f.tick===325).command.planes.bodyRelative.normalSlewDeg,
    physicalNormalSlewDeg:observe.frames.find(f=>f.tick===325).command.planes.physical.normalSlewDeg,
    limitation:'World command includes actual chest/yaw motion; bodyRelative decomposition is retained. Command trajectory is not guaranteed reachable.'},
  matchedLongsword:{comparison:pair.comparisons[0],measurementValid:pair.pass,firstEligibleActiveTick:analysis.rows[1].firstEligibleActiveTick,
    recut:analysis.rows.map(r=>({mode:r.mode,...r.summary.recut})),limits:analysis.limitations},
  fromCreation:{newCandidateExecutions:2,reusedBaselineRows:2,comparisons:spawn.comparisons,measurementValid:spawn.pass,phaseComparisons:comparison,
    correctedSameWindowAggregate:read('command-spawn01-corrected-aggregate.json'),
    retainedCounterexamples:[{weapon:'qinggang',tick:208,kind:'Existing nearest-actual-flat branch remains',targetStepDeg:84.73,commandTransverseMps:[.45,.65]},
      {weapon:'qinggang',tick:323,kind:'Command plane itself turns about88deg; stable-command prerequisite does not generalize',targetStepDeg:-91.97,axialOmegaRadps:[21.71,-31.22]},
      {weapon:'longsword',tick:321,kind:'Discrete eligible entry selects a different normal',targetStepDeg:-28.25},
      {weapon:'longsword',ticks:[344,347],kind:'Return roll lobe remains after the longer main turn',travelRad:.19528650439212913}]},
  commandJumpDecomposition:read('command-q-boundary01.json'),
  contact:{status:'not_accepted_no_exposed_actual_player_cut',attempts:[
    {name:'contact01',measurementValid:contactOff.measurementValid,runs:2,steps:contactOff.rows.reduce((n,r)=>n+r.frames.length,0),sourceStable:contactOff.sourceStable,
      reason:'Original AI2 input never sets human active/held flags. Candidate intervention0, both native traces exact. Actual cuts occurred but do not validate candidate contact.'},
    {name:'contact02',runs:0,steps:0,reason:'Prepared-only L2 active-threshold variant. Never executed; corrected to actual main.js L1 threshold before next execution.'},
    {name:'contact03',measurementValid:false,runs:1,steps:failureAccounting.physicsSteps,sourceStable:contactEarly.sourceStable,
      reason:'AI requested-delta fixture had no eligible cut by arbitrary5second deadline; baseline aborted, candidate never ran.',accounting:failureAccounting},
    {name:'contact04',measurementValid:contactFinal.measurementValid,runs:2,steps:contactFinal.rows.reduce((n,r)=>n+r.frames.length,0),sourceStable:contactFinal.sourceStable,
      reason:'Explicit previously validated touch schedule, default newRound startGap5.6m, original reactive opponent, stationary player without AI. Candidate exposed, but this6second pad-only fixture did not produce player cutting-reaction pairs or wounds. Ended without seed/gap search.',
      comparisons:contactFinal.comparisons,rows:contactFinal.rows.map(r=>({mode:r.mode,steps:r.frames.length,exposure:r.exposure,commandedFrames:r.commandedFrames,firstCommandedTick:r.firstCommandedTick,
        firstPlayerCutTick:r.firstPlayerCutTick,cutEvents:r.events.length,woundCount:r.wounds.length,checks:r.checks,
        finalFighters:r.finalStates.map(f=>({state:f.state,alive:f.alive,armed:f.armed,blood:f.blood,limbs:f.limbs}))}))}],
    limits:['Contact04 has valid control exposure and identical player events, but no observed cutting contact; it is not contact safety acceptance.','Reactive opponent input diverges at150, after player native divergence134.','End-state stand/alive/armed is not a proof of human naturalness or full-body recovery.','No new seed/gap search, gain tuning or candidate modification followed.']},
  execution:{newPhysicsExecutions:10,physicsSteps:observe.physicsSteps+pair.physicsSteps+spawn.physicsSteps+contactOff.rows.reduce((n,r)=>n+r.frames.length,0)+failureAccounting.physicsSteps+contactFinal.rows.reduce((n,r)=>n+r.frames.length,0),
    breakdown:[{kind:'read-only original baseline replay',runs:1,steps:observe.physicsSteps},{kind:'same recut prefix baseline/candidate',runs:2,steps:pair.physicsSteps},{kind:'candidate from creation, baseline data reused',runs:2,steps:spawn.physicsSteps},
      {kind:'contact fixture without candidate exposure',runs:2,steps:2528},{kind:'early aborted AI-delta fixture baseline; partial raw trace lost, source/error-derived count',runs:1,steps:601},{kind:'scripted contact fixture, candidate exposed but player cut absent',runs:2,steps:1440}],
    physicsWallSeconds:observe.wallSeconds+pair.wallSeconds+spawn.wallSeconds+contactOff.wallSeconds+contactEarly.wallSeconds+contactFinal.wallSeconds,
    fixtureCorrectionElapsedSeconds:(Date.parse(contactFinal.completedUTC)-Date.parse(contactOff.completedUTC))/1000,
    fixtureTimeDefinition:'Elapsed from first no-exposure contact completion to final scripted-fixture completion; includes diagnosis, edits, coordination and execution, not just physics CPU.',noPhysicsFromAnalysis:true},
  sourceBridge:read('source-bridge01.json'),artifacts:names.map(n=>artifact(path.join(opts.evidence,n))),
  tools:['p4_command_observe.mjs','p4_command_candidate.mjs','p4_command_probe.mjs','p4_command_analyze.mjs','p4_command_contact.mjs','p4_command_report.mjs'].map(n=>artifact(new URL(n,import.meta.url).pathname)),
  reportingCorrection:'Original spawn raw retains an afterIntervention summary whose reused baseline starts132 while candidate starts0. Do not compare that field. Same0:443 aggregate is recomputed in its separate artifact; no game rerun.',
  next:'Close this execution round; no more physics now. Preserve the unchanged candidate for possible future longsword review; no public integration. A future actual-contact fixture must explicitly combine normal joystick approach with the identical touch tape at ordinary startGap5.6m. Do not search seeds/gaps or count pad-only noncontact as contact acceptance. Q remains excluded; its hand/aim/chest decomposition needs observation before any new controller model. Full P4 closure and human naturalness are not established.'};
const director=path.resolve(opts.evidence,'../director/recut-review.json');if(fs.existsSync(director))result.directorIndependentAnalysis=artifact(director);
fs.writeFileSync(opts.out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({out:opts.out,status:result.status,runs:result.execution.newPhysicsExecutions,steps:result.execution.physicsSteps}));
