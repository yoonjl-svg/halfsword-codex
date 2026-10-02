import { readFile,writeFile,readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { execFileSync } from 'node:child_process';
import { runStroke,observer,summarize,inputHelperSHA256,cleanupInputHelper } from './elbow_coordination_probe.mjs';
import {loadIntentEdge} from './intent_edge_candidate.mjs';
import { installElbowSwivelCandidate } from './elbow_swivel_candidate.mjs';
import { installElbowCoherentCandidate } from './elbow_coherent_candidate.mjs';
import { installForceLedger } from '../force_ledger.mjs';
const root=new URL('../../../',import.meta.url),sha=x=>createHash('sha256').update(x).digest('hex');
const opts=Object.fromEntries(process.argv.slice(2).map(s=>{const m=s.match(/^--([^=]+)=(.*)$/);if(!m)throw Error('Use --name=value');return[m[1],m[2]];}));
if(opts.level!=='0')throw Error('Use --level=0');
const base=opts.base??'coupled';if(!['candidate','coupled','coherent'].includes(base))throw Error('Unknown base');
let sourceCommit;try{sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();}catch(e){if(e.status!==0||!e.stdout)throw e;sourceCommit=e.stdout.trim();}
const files=[...(await readdir(new URL('src/',root))).filter(n=>n.endsWith('.js')).sort().map(n=>'src/'+n),
  'tools/sim/harness_m.mjs','tools/sim/whole_body_strike_probe.mjs','tools/sim/force_ledger.mjs','tools/sim/experiments/elbow_coordination_probe.mjs',
  'tools/sim/experiments/elbow_coherent_candidate.mjs','tools/sim/experiments/intent_edge_probe.mjs','tools/sim/experiments/intent_edge_candidate.mjs','tools/sim/experiments/elbow_swivel_candidate.mjs','node_modules/@dimforge/rapier3d-compat/rapier.mjs'];
const manifest=async()=>Object.fromEntries(await Promise.all(files.map(async p=>[p,sha(await readFile(new URL(p,root)))])));
const before=await manifest(),begin=performance.now(),rows=[],checks=[],loaded=await loadIntentEdge();
for(const weapon of(opts.weapons??'sabre,zweihander').split(','))for(const direction of(opts.directions??'down,up,cross').split(','))for(const ending of(opts.endings??'target_hold,release').split(',')){
  const c={weapon,direction,ending,reaction:'paired',seed:7,prepareS:3,durationS:.55,afterS:1.2,sampleHz:120},group=[];
  for(const mode of(opts.modes??'baseline,observe,edge,intact,swivel,combined').split(',')){
    const o=observer();let candidate=null,follow=null,installUnchanged=true,undoEdge=null;const edgeFrames=[];
    const exp={activate(ctx){o.activate(ctx);if(mode!=='baseline'){const native=sha(ctx.G.world.takeSnapshot()); if(['observe','edge','combined'].includes(mode)){ctx.f.intentEdgeEnabled=mode!=='observe'; const proto=ctx.f.constructor.prototype, old=proto.driveSword;proto.driveSword=loaded.module.Fighter.prototype.driveSword;undoEdge=()=>{proto.driveSword=old;};}candidate=installElbowCoherentCandidate({...ctx,mode:['observe','edge'].includes(mode)?'observe':base}); if(['swivel','observe','combined'].includes(mode))follow=installElbowSwivelCandidate({...ctx,observe:mode==='observe'});installUnchanged=native===sha(ctx.G.world.takeSnapshot());}},afterStep(ctx){o.afterStep(ctx);edgeFrames.push(loaded.module.readEdge(ctx.f)??null);},restore(){follow?.restore();candidate?.restore();undoEdge?.();o.restore();}};
    const r=runStroke({...c,ledgerFactory:G=>installForceLedger(G,{fighters:[G.player],maxSamples:0}),intervention:exp});
    const evidence=o.evidence();
    if(candidate)for(let i=0;i<evidence.frames.length;i++)evidence.frames[i].requestShoulderDistanceM=candidate.records[i].appliedRadiusM;
    const stroke=r.samples.filter(x=>x.phase==='stroke'),after=r.samples.filter(x=>x.phase==='after_input');
    const metrics={strokePeakTipMps:r.strokePeak.tipSpeedMps,strokeMaxHandErrorM:Math.max(...stroke.map(s=>s.handTargetErrorM)),
      strokeMaxBladeAimErrorRad:Math.max(...stroke.map(s=>s.bladeAimErrorRad)),afterAxisTravelRad:r.summary.afterInputBladeAxisTravelRad,
      finalBladeAimErrorRad:r.final.bladeAimErrorRad,finalHandErrorM:r.final.handTargetErrorM,finalSwordKJ:r.final.swordEnergy.translationJ+r.final.swordEnergy.rotationJ,
      afterMaxBladeAimErrorRad:Math.max(...after.map(s=>s.bladeAimErrorRad)),maxSwordOmegaRadps:Math.max(...r.samples.map(s=>Math.hypot(...Object.values(s.sword.angularVelocityRadps))))};
    if(candidate){
      metrics.originalRawHandMaxErrorM=Math.max(...r.samples.map((s,i)=>Math.hypot(...candidate.records[i].requested.map((v,k)=>v-Object.values(s.actualHandWorldM)[k]))));
      metrics.secondaryUnreachableFrames=candidate.records.filter(x=>x.secondary&&(x.secondary.desiredDistanceM>x.secondary.maxRadiusM+1e-8||x.secondary.desiredDistanceM<x.secondary.minRadiusM-1e-8)).length;
    }else{metrics.originalRawHandMaxErrorM=Math.max(...r.samples.map(s=>s.handTargetErrorM));metrics.secondaryUnreachableFrames=null;}
    const row={condition:c,mode,startNativeSha256:r.startNativeSha256,startSha256:r.startSha256,inputSha256:r.inputSha256,traceSha256:r.traceSha256,
      controllerAxisTraceSha256:sha(JSON.stringify(r.samples.map(s=>({phase:s.phase,aim:s.desiredBladeAxisWorldFromPreStep,offset:s.handOffsetM,filtered:s.filteredAimM})))),
      installUnchanged,summary:summarize(evidence.frames),metrics,phaseExplicitWorkApproxJ:evidence.phaseWork,frames:evidence.frames,samples:r.samples,
      edgeFrames,swivel:follow?.records??null,candidate:candidate?{geometry:candidate.geometry,records:candidate.records}:null};
    group.push(row);rows.push(row);
  }
  const find=mode=>group.find(r=>r.mode===mode),b=find('baseline'),ob=find('observe'),ed=find('edge'),sw=find('swivel'),ca=find('combined');
  if(!b||!ob)throw Error('Baseline and observe required');
  const check={...c,preparedNativeExact:group.every(r=>r.startNativeSha256===b.startNativeSha256),preparedControllerExact:group.every(r=>r.startSha256===b.startSha256),
    requestedInputExact:group.every(r=>r.inputSha256===b.inputSha256),observerTraceExact:ob.traceSha256===b.traceSha256,installsNativeUnchanged:group.every(r=>r.installUnchanged),endpointPreserved:!sw||sw.swivel.every(r=>r.endpointDeltaM<1e-12),closestOrientation:!sw||sw.swivel.every(r=>r.newErrorRad<=r.oldErrorRad+1e-7),combinedEndpointPreserved:!ca||ca.swivel.every(r=>r.endpointDeltaM<1e-12),combinedClosestOrientation:!ca||ca.swivel.every(r=>r.newErrorRad<=r.oldErrorRad+1e-7),edgeFirstStepExact:!ed||JSON.stringify(ed.samples[0])===JSON.stringify(b.samples[0]),edgeCommandsFinite:!ed||ed.edgeFrames.every((r,i)=>r&&(!i||(Number.isFinite(r.commandSpeedMps)&&Number.isFinite(r.commandBlend))))};
  checks.push(check);console.log(JSON.stringify({check,rows:group.map(r=>({mode:r.mode,metrics:r.metrics,summary:r.summary}))}));
}
const after=await manifest(),sourceStable=JSON.stringify(before)===JSON.stringify(after);
const executionPass=sourceStable&&checks.every(c=>c.preparedNativeExact&&c.preparedControllerExact&&c.requestedInputExact&&c.observerTraceExact&&c.installsNativeUnchanged&&c.endpointPreserved&&c.closestOrientation&&c.combinedEndpointPreserved&&c.combinedClosestOrientation&&c.edgeFirstStepExact&&c.edgeCommandsFinite);
const report={schemaVersion:1,base,generatedModuleSHA256:loaded.generatedSHA256,createdUTC:new Date().toISOString(),sourceCommit,command:process.argv.join(' '),sourceBefore:before,sourceAfter:after,sourceStable,inputHelperSHA256,
  wallSeconds:(performance.now()-begin)/1000,executionPass,
  hypothesis:'Retain commanded cutting-plane normal as blade flat target instead of motion-feedback edge alignment and resting RIGHT recovery. Gains/torque caps/reaction formulas unchanged, resulting torques differ. Compare alone and combined with closest-shoulder IK.',
  limitations:'Same prepared state and external input, realized targets and work can differ. Actual-pose dependent target velocity may weaken damping or drift the elbow plane; assess measured outcome, not just smaller joint error. Native motor work unmeasured. Open-space strokes only; no contact, mobile or player acceptance.', checks,rows};
await writeFile(opts.out??'/tmp/intent-edge.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});await cleanupInputHelper();await loaded.cleanup();
console.log(JSON.stringify({executionPass,sourceStable,rows:rows.length,wallSeconds:report.wallSeconds}));if(!executionPass)process.exitCode=1;
