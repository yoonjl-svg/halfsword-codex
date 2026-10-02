import { readFile,writeFile,readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { execFileSync } from 'node:child_process';
import { runStroke,observer,summarize,inputHelperSHA256,cleanupInputHelper } from './elbow_coordination_probe.mjs';
import { installElbowCoherentCandidate } from './elbow_coherent_candidate.mjs';
import { installForceLedger } from '../force_ledger.mjs';
const root=new URL('../../../',import.meta.url),sha=x=>createHash('sha256').update(x).digest('hex');
const opts=Object.fromEntries(process.argv.slice(2).map(s=>{const m=s.match(/^--([^=]+)=(.*)$/);if(!m)throw Error('Use --name=value');return[m[1],m[2]];}));
if(opts.level!=='0')throw Error('Use --level=0');
let sourceCommit;try{sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();}catch(e){if(e.status!==0||!e.stdout)throw e;sourceCommit=e.stdout.trim();}
const files=[...(await readdir(new URL('src/',root))).filter(n=>n.endsWith('.js')).sort().map(n=>'src/'+n),
  'tools/sim/harness_m.mjs','tools/sim/whole_body_strike_probe.mjs','tools/sim/force_ledger.mjs','tools/sim/experiments/elbow_coordination_probe.mjs',
  'tools/sim/experiments/elbow_coherent_candidate.mjs','tools/sim/experiments/elbow_coherent_probe.mjs','node_modules/@dimforge/rapier3d-compat/rapier.mjs'];
const manifest=async()=>Object.fromEntries(await Promise.all(files.map(async p=>[p,sha(await readFile(new URL(p,root)))])));
const before=await manifest(),begin=performance.now(),rows=[],checks=[];
for(const weapon of(opts.weapons??'sabre,zweihander').split(','))for(const direction of(opts.directions??'down,up,cross').split(','))for(const ending of(opts.endings??'target_hold,release').split(',')){
  const c={weapon,direction,ending,reaction:'paired',seed:7,prepareS:3,durationS:.55,afterS:1.2,sampleHz:120},group=[];
  for(const mode of['baseline','observe','defer','candidate','coupled','coherent']){
    const o=observer();let candidate=null,installUnchanged=true;
    const exp={activate(ctx){o.activate(ctx);if(mode!=='baseline'){const native=sha(ctx.G.world.takeSnapshot());candidate=installElbowCoherentCandidate({...ctx,mode});installUnchanged=native===sha(ctx.G.world.takeSnapshot());}},afterStep(ctx){o.afterStep(ctx);},restore(){candidate?.restore();o.restore();}};
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
      candidate:candidate?{geometry:candidate.geometry,records:candidate.records}:null};
    group.push(row);rows.push(row);
  }
  const [b,ob,df,relative,coupled,ca]=group,records=ca.candidate.records,geom=ca.candidate.geometry;
  const check={...c,preparedNativeExact:group.every(r=>r.startNativeSha256===b.startNativeSha256),preparedControllerExact:group.every(r=>r.startSha256===b.startSha256),
    requestedInputExact:group.every(r=>r.inputSha256===b.inputSha256),observerTraceExact:ob.traceSha256===b.traceSha256,deferTraceExact:df.traceSha256===b.traceSha256,
    installsNativeUnchanged:group.every(r=>r.installUnchanged),worldAxisTraceExact:ca.controllerAxisTraceSha256===b.controllerAxisTraceSha256,
    nativeFlexLimits:records.every(r=>r.targetFlexRad>=geom.minFlexRad-1e-8&&r.targetFlexRad<=geom.maxFlexRad+1e-8),
    firstShoulderToActualRad:records[0].targetToActualShoulderRad,firstFlexToActualRad:Math.abs(records[0].targetFlexRad-records[0].actualFlexBeforeRad),
    actualCandidateCalls:records.filter(r=>r.active).length,initCalls:records.filter(r=>r.init).length,minDirectionDot:Math.min(...records.filter(r=>r.directionDot!==null).map(r=>r.directionDot)),
    deltas:Object.fromEntries(Object.entries(ca.metrics).map(([k,v])=>[k,v-(k==='secondaryUnreachableFrames'?ob.metrics[k]:b.metrics[k])])),
    coupledDeltas:Object.fromEntries(Object.entries(ca.metrics).map(([k,v])=>[k,v-coupled.metrics[k]])),
    relativeDeltas:Object.fromEntries(Object.entries(ca.metrics).map(([k,v])=>[k,v-relative.metrics[k]]))};checks.push(check);
  console.log(JSON.stringify({weapon,direction,ending,check,baseline:b.metrics,candidate:ca.metrics,flex:ca.summary.actualFlexRangeRad,targetFlex:ca.summary.targetFlexRangeRad}));
}
const after=await manifest(),sourceStable=JSON.stringify(before)===JSON.stringify(after);
const executionPass=sourceStable&&checks.every(c=>c.preparedNativeExact&&c.preparedControllerExact&&c.requestedInputExact&&c.observerTraceExact&&c.deferTraceExact&&c.installsNativeUnchanged&&c.nativeFlexLimits&&c.actualCandidateCalls===210);
const report={schemaVersion:1,createdUTC:new Date().toISOString(),sourceCommit,command:process.argv.join(' '),sourceBefore:before,sourceAfter:after,sourceStable,inputHelperSHA256,
  wallSeconds:(performance.now()-begin)/1000,executionPass,
  hypothesis:'After coupled reach projection, offArmIK uses the same desired primary hand+sword axis as main arm. Compare coupled-only to coherent both-hand desired pose. Physical spring endpoints/force/caps and all motor strengths unchanged.',
  limitations:'Absolute hand mapping changes and becomes gesture/history dependent. First filter increment is reanchored; existing blade-axis mapping remains absolute. No C1 continuity claim beyond initial actual velocity seeding; native gaps can perturb pose. Same external input, not identical realized world-axis target or native work. Hold/release may duplicate OFF strokes. Opponent contact, wounds, mobile and reinput require follow-up. Coupled mode projects the primary target into two outer reach balls. Coherent mode also moves the offArmIK request origin to primary handTarget; physical grip spring endpoints and force/caps remain unchanged. Inner bounds are checked after primary IK. Native extension permits 0rad/full .565m without old 5mm IK slack to seed the actual legal pose.',checks,rows};
await writeFile(opts.out??'/tmp/elbow-coherent-round4.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});await cleanupInputHelper();
console.log(JSON.stringify({executionPass,sourceStable,rows:rows.length,wallSeconds:report.wallSeconds}));if(!executionPass)process.exitCode=1;
