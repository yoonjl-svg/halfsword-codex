// One isolated radial mapping candidate, retaining real runtime joints/native solver.
import { readFile,writeFile,readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { execFileSync } from 'node:child_process';
import { runStroke,observer,summarize,inputHelperSHA256,cleanupInputHelper } from './elbow_coordination_probe.mjs';
import { installElbowReachCandidate } from './elbow_reach_candidate.mjs';
import { installForceLedger } from '../force_ledger.mjs';
import { newRound,CONFIG,DT } from '../harness_m.mjs';
const root=new URL('../../../',import.meta.url),sha=x=>createHash('sha256').update(x).digest('hex');
let sourceCommit;try{sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();}catch(e){if(e.status!==0||!e.stdout)throw e;sourceCommit=e.stdout.trim();}
const opts=Object.fromEntries(process.argv.slice(2).map(s=>{const m=s.match(/^--([^=]+)=(.*)$/);if(!m)throw Error('Use --name=value');return[m[1],m[2]];}));
if(opts.level!=='0')throw Error('Candidate requires --level=0 for preparation and baseline');
const files=[...(await readdir(new URL('src/',root))).filter(n=>n.endsWith('.js')).sort().map(n=>'src/'+n),
  'tools/sim/harness_m.mjs','tools/sim/whole_body_strike_probe.mjs','tools/sim/force_ledger.mjs','tools/sim/experiments/elbow_coordination_probe.mjs',
  'tools/sim/experiments/elbow_reach_candidate.mjs','tools/sim/experiments/elbow_reach_probe.mjs','node_modules/@dimforge/rapier3d-compat/rapier.mjs'];
const manifest=async()=>Object.fromEntries(await Promise.all(files.map(async p=>[p,sha(await readFile(new URL(p,root)))])));
const before=await manifest(),begin=performance.now(),rows=[],checks=[];
for(const weapon of(opts.weapons??'sabre,zweihander').split(','))for(const direction of(opts.directions??'down,up,cross').split(','))for(const ending of(opts.endings??'target_hold,release').split(',')){
  const c={weapon,direction,ending,reaction:'paired',seed:7,prepareS:3,durationS:.55,afterS:1.2,sampleHz:120};const group=[];
  for(const mode of['baseline','observe','candidate']){
    const o=observer();let candidate=null,firstNative=null,installUnchanged=true;
    const exp={activate(ctx){o.activate(ctx);if(mode!=='baseline'){firstNative=sha(ctx.G.world.takeSnapshot());
      // Observer's armIK capture is replaced by this original-forwarding candidate; no duplicate game calls.
      candidate=installElbowReachCandidate({...ctx,mode});installUnchanged=firstNative===sha(ctx.G.world.takeSnapshot());}},
      afterStep(ctx){o.afterStep(ctx);},restore(){candidate?.restore();o.restore();}};
    const r=runStroke({...c,ledgerFactory:G=>installForceLedger(G,{fighters:[G.player],maxSamples:0}),intervention:exp});
    const evidence=o.evidence();
    // Candidate wrapper replaces diagnostic IK observer, so reconstruct its exact pre-solver requested/applied radius.
    if(candidate)for(let i=0;i<evidence.frames.length;i++)evidence.frames[i].requestShoulderDistanceM=candidate.records[i].appliedRadiusM;
    const summary=summarize(evidence.frames),stroke=r.samples.filter(x=>x.phase==='stroke'),after=r.samples.filter(x=>x.phase==='after_input');
    const metrics={strokePeakTipMps:r.strokePeak.tipSpeedMps,strokeMaxHandErrorM:Math.max(...stroke.map(s=>s.handTargetErrorM)),
      strokeMaxBladeAimErrorRad:Math.max(...stroke.map(s=>s.bladeAimErrorRad)),afterAxisTravelRad:r.summary.afterInputBladeAxisTravelRad,
      afterMaxBladeAimErrorRad:Math.max(...after.map(s=>s.bladeAimErrorRad)),finalBladeAimErrorRad:r.final.bladeAimErrorRad,
      finalHandErrorM:r.final.handTargetErrorM,finalSwordKJ:r.final.swordEnergy.translationJ+r.final.swordEnergy.rotationJ};
    const row={condition:c,mode,startNativeSha256:r.startNativeSha256,startSha256:r.startSha256,inputSha256:r.inputSha256,traceSha256:r.traceSha256,
      controllerAxisTraceSha256:sha(JSON.stringify(r.samples.map(s=>({phase:s.phase,aim:s.desiredBladeAxisWorldFromPreStep,offset:s.handOffsetM,filtered:s.filteredAimM})))),
      installUnchanged,summary,metrics,phaseExplicitWorkApproxJ:evidence.phaseWork,frames:evidence.frames,samples:r.samples,
      candidate:candidate?{nativeReachM:candidate.nativeReachM,nativeUpperM:candidate.nativeUpperM,nativeForeM:candidate.nativeForeM,records:candidate.records}:null};
    group.push(row);rows.push(row);
  }
  const b=group[0],ob=group[1],ca=group[2];
  const check={...c,preparedNativeExact:group.every(r=>r.startNativeSha256===b.startNativeSha256),preparedControllerExact:group.every(r=>r.startSha256===b.startSha256),
    requestedInputExact:group.every(r=>r.inputSha256===b.inputSha256),observerTraceExact:ob.traceSha256===b.traceSha256,
    installsNativeUnchanged:group.every(r=>r.installUnchanged),requestedAxisControllerExact:ca.controllerAxisTraceSha256===b.controllerAxisTraceSha256,
    directionPreserved:ca.candidate.records.every(r=>r.directionDot>1-1e-10),actualCandidateCalls:ca.candidate.records.filter(r=>r.active).length,
    deltas:Object.fromEntries(Object.entries(ca.metrics).map(([k,v])=>[k,v-b.metrics[k]]))};
  checks.push(check);console.log(JSON.stringify({check,baseline:b.metrics,candidate:ca.metrics}));
}
const boundary=[];
for(const normalizedRadius of[.96,.989,1-1e-8,1,1+1e-8,1.04]){
  const G=newRound({seed:7,walls:false,weapon:'sabre',weapon2:'longsword',skill:0});G.park();const f=G.player;
  f.handOffset.set(0,0);for(const name of['prev','aim','aimRaw','anchor'])f.skill[name].set(0,0);
  f.skill.aimVel.set(0,0);f.skill.vel.set(0,0);f.skill.follow.set(0,0);f.handHeld=true;f.inputActive=false;f.skill.autoGuard=true;
  for(let i=0;i<Math.round(3/DT);i++)G.step();
  const ledger=installForceLedger(G,{fighters:[f],maxSamples:0}),candidate=installElbowReachCandidate({f,ledger});
  const trace=[];
  for(let i=0;i<120;i++){
    f.handOffset.set(CONFIG.WEAPON.reach*normalizedRadius,0);f.handHeld=true;f.inputActive=true;G.step();
    const rec=candidate.records.at(-1),q=f.jointByName.farmS.target;
    const targetFlexRad=2*Math.atan2(q.z,q.w);
    const finite=[...Object.values(f.bodies),f.sword].every(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].every(v=>Object.values(v).every(Number.isFinite)));
    trace.push({timeS:(i+1)*DT,finite,targetFlexRad,elbowMaxRad:f.jointByName.farmS.joint.limitsMax(),...rec});
  }
  boundary.push({normalizedRadius,frames:trace,finite:trace.every(x=>x.finite),maxTargetFlexRad:Math.max(...trace.map(x=>x.targetFlexRad)),
    requestsPastNativeFlexLimit:trace.filter(x=>x.targetFlexRad>x.elbowMaxRad+1e-6).length,
    maxAppliedTargetStepM:Math.max(...trace.slice(1).map((x,i)=>Math.hypot(...x.applied.map((v,k)=>v-trace[i].applied[k]))))});
  candidate.restore();ledger.restore();G.eventQueue.free();G.world.free();
}
const after=await manifest(),sourceStable=JSON.stringify(before)===JSON.stringify(after),executionPass=sourceStable&&checks.every(c=>c.preparedNativeExact&&c.preparedControllerExact&&c.requestedInputExact&&c.observerTraceExact&&c.installsNativeUnchanged&&c.directionPreserved&&c.actualCandidateCalls===210)&&boundary.every(b=>b.finite);
const report={schemaVersion:1,createdUTC:new Date().toISOString(),sourceCommit,command:process.argv.join(' '),sourceBefore:before,sourceAfter:after,sourceStable,
  inputHelperSHA256,wallSeconds:(performance.now()-begin)/1000,executionPass,
  hypothesis:'Input radius controls arm radial reach inside native .560m reach; original shoulder-to-hand direction and weapon aim request formula retained. Center extends, outer input folds. Research-only geometric hypothesis, no gain/cap/strength/native replacement.',
  limits:'Same intended weapon direction can differ after controller feedback, so requestedAxisControllerExact is reported separately. Hand error references applied mapped target; original requested point also saved and cannot be claimed more accurately reached. Explicit work excludes native motor/constraint/contact work. No physiological timing success or playtest claims.',
  boundaryProtocol:'Six separate sabre OFF preparations, then actual held input at .96/.989/(1±1e-8)/1/1.04 normalized reach for120 actual G.step frames. No direct aim/velocity assignment during measurement; finite and native elbow-limit target consistency measured.',
  checks,rows,boundary};
await writeFile(opts.out??'/tmp/elbow-reach-round1.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});await cleanupInputHelper();console.log(JSON.stringify({executionPass,sourceStable,rows:rows.length,wallSeconds:report.wallSeconds}));if(!executionPass)process.exitCode=1;
