/** Bound report serialization while preserving every raw checkpoint in JSONL.
 * Can also recover a completed matrix if the optional monolithic writer fails.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import * as CONFIG from '../../../src/config.js';
const root=fileURLToPath(new URL('../../../',import.meta.url)),base=process.argv[2];
if(!base)throw Error('Provide executed probe --out path');
const start=JSON.parse(fs.readFileSync(base+'.start.json','utf8'));
const rows=fs.readFileSync(base+'.runs.jsonl','utf8').trim().split('\n').map(JSON.parse);
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const options=Object.fromEntries(start.command.slice(2).map(s=>{const p=s.indexOf('=');return [s.slice(2,p),s.slice(p+1)];}));
const seeds=(options.seeds??'7').split(',').map(Number),scenes=(options.scenes??'cloth,plate').split(','),modes=['unobserved','baseline','cut','arm','combined'];
if(rows.length!==seeds.length*scenes.length*modes.length)throw Error('Matrix incomplete');
const comparisons=[];
for(const scene of scenes)for(const seed of seeds){
 const group=modes.map(mode=>rows.find(r=>r.scene===scene&&r.seed===seed&&r.mode===mode));if(group.some(r=>!r))throw Error('Missing branch');
 const [unobserved,baseline,...variants]=group,first=(a,b)=>a.findIndex((h,i)=>h!==b[i]);
 comparisons.push({scene,seed,checkpointExact:group.every(r=>JSON.stringify(r.checkpoint)===JSON.stringify(baseline.checkpoint)),
   observationTraceExact:JSON.stringify(unobserved.frameHashes)===JSON.stringify(baseline.frameHashes),observationInputExact:JSON.stringify(unobserved.inputHashes)===JSON.stringify(baseline.inputHashes),
   branches:variants.map(r=>({mode:r.mode,firstTraceDifferenceFrame:first(baseline.frameHashes,r.frameHashes),firstReactiveInputDifferenceFrame:first(baseline.inputHashes,r.inputHashes)})),
   interpretation:'Same prepared native/controller/input state; later reactive AI inputs and contacts can diverge.'});
}
const sourceAfter=Object.fromEntries(Object.keys(start.sourceBefore).map(p=>[p,sha(fs.readFileSync(root+p))]));
const sourceStable=JSON.stringify(sourceAfter)===JSON.stringify(start.sourceBefore);
function retainedFrames(r){
 const frames=new Set(r.eventFrames.slice(0,64).map(f=>f.frame));
 const selectors=[e=>e.kind==='clash'&&e.info.fresh&&e.info.impulse>0,e=>e.kind==='strike'&&e.result?.severity>0&&e.woundHookDelta>0,
   e=>e.kind==='strike'&&e.glanceCandidate&&e.result&&e.woundHookDelta>0,e=>e.kind==='strike'&&e.plateBlocked&&e.woundHookDelta>0];
 for(const find of selectors){const e=r.events.find(find);if(e)frames.add(e.frame);}
 return r.eventFrames.filter(f=>frames.has(f.frame));
}
const report={createdUTC:new Date().toISOString(),baselineCommit:start.baselineCommit,command:['node','tools/sim/experiments/arm_cut_interaction_probe.mjs',...start.command.slice(2)].join(' '),
 configuration:{seconds:Number(options.seconds??30),prepare:Number(options.prepare??1),seeds,scenes,modes,DT:CONFIG.PHYSICS.timestep,
   AI:'Both original AI classes; native collision, ordinary wounds/recovery. No imposed outcomes.',walls:false,
   scenesDescription:{cloth:'Player kettle/gambeson longsword; default unarmored enemy zweihander',plate:'Player kettle/gambeson zweihander; actual Heinrich v2 full plate enemy longsword'},
   grip:CONFIG.GRIP.reactionModel,weightMode:CONFIG.BODY.weightMode,support:{assist:CONFIG.GAIT.assist,catchMode:CONFIG.GAIT.catchMode,catchScale:CONFIG.GAIT.catchScale}},
 sourceBefore:start.sourceBefore,sourceAfter,sourceStable,toolSHA256:start.probeSHA256,comparisons,
 tolerance:{momentum:8e-5,angular:3e-4,energy:2e-4,speed:2e-4,torque:1e-8},
 runs:rows.map(r=>({...r,eventFrames:retainedFrames(r)})),
 classification:{strike:'Actual Combat.strike dispatch; null/cooldown calls separate from actual wound hooks and stored applied wounds.',
   parry:'Actual onClash callback/fresh flag and native raw normal impulse; weapon contact surrogate, not intent.',
   glance:'Actual manifold normal and cached contact-point relative velocity: positive closing, speed>=0.5m/s and normal/speed<=.25. Observational kinematic grazing candidate, not game damage type.',
   plateBlock:'Actual result.plate=true, pass=false, severity=0, eff<=thr. Scaled wound energy is not actual mechanical loss.'},
 limitations:['Instant explicit cutting pair P/L/K/Eleft bounds do not close native joint/contact/motor work or whole-body energy.',
  'Native normal/tangent impulse arrays and solver point arrays have no guaranteed correspondence; native tangential world basis/work unavailable.',
  'Strike contact relative velocities use cached pre-physics values; cut impulse diagnostic uses live velocities at application. Their times differ.',
  'Wrist cap directly read; shoulder cap has no independent source readout here. Existing stable-source runtime parity reused. Shoulder/wrist actual reaction closure measured.',
  'Native elbow/FF/offhand/spine and grip spring are not included in this explicit arm final cap; instantaneous explicit torque power times dt is not total muscle or native work.',
  'Reactive AI input/contact sequences diverge; wound counts do not demonstrate damage efficacy, balance or human naturalness.',
  'Cloth and plate scenes also reverse weapon order and use different actual looks; their difference is not an armor-only or mass-only experiment.',
  'No mobile/human acceptance, default promotion or deployment. Full raw event frames preserved in JSONL; bounded report keeps first64 detailed frames plus first event example frames per row.'],
 finalization:{command:'node tools/sim/experiments/arm_cut_interaction_finalize.mjs '+base,fullRawCheckpoints:base+'.runs.jsonl',
   checkpointSHA256:sha(fs.readFileSync(base+'.runs.jsonl')),checkpointBytes:fs.statSync(base+'.runs.jsonl').size,
   initialManifest:base+'.start.json',nativeFreezeAfterObservedUTC:new Date().toISOString(),
   note:'Final source-after manifest and original comparison gates executed from completed checkpoint rows; no simulation rerun. Detailed frame output bounded, all operations/events/counts/frame hashes retained.'}};
report.pass=sourceStable&&comparisons.every(c=>c.checkpointExact&&c.observationTraceExact&&c.observationInputExact)&&rows.every(r=>r.stats.finite&&r.stats.wrappersPreserved&&r.stats.explicitTorqueClosurePass&&r.stats.cutClosurePass&&r.stats.cutPassivityPass&&r.stats.cutBudgetPass&&(!['arm','combined'].includes(r.mode)||r.stats.wristCapViolations.every(n=>n===0)));
const out=base.replace(/\.json$/,'.bounded.json');fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({out,pass:report.pass,rows:rows.length,sourceStable,comparisons}));process.exitCode=report.pass?0:1;
