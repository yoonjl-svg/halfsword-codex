// Actual paired body-force observers and same-prefix suppression diagnostics.
// Suppression is causal research only, never a proposed controller or runtime option.
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runStroke,cleanupInputHelper,inputHelperSHA256} from './elbow_coordination_probe.mjs';
import {installElbowCoherentCandidate} from './elbow_coherent_candidate.mjs';
import {installForceLedger} from '../force_ledger.mjs';
import {THREE,DT} from '../harness_m.mjs';
const root=new URL('../../../',import.meta.url),sha=x=>createHash('sha256').update(x).digest('hex');
const V=v=>new THREE.Vector3(v.x,v.y,v.z),Q=q=>new THREE.Quaternion(q.x,q.y,q.z,q.w);
const opts=Object.fromEntries(process.argv.slice(2).map(s=>{const m=s.match(/^--([^=]+)=(.*)$/);if(!m)throw Error('Use --name=value');return[m[1],m[2]];}));
if(opts.level!=='0')throw Error('Use --level=0');
const startS=Number(opts.start??.075),base=opts.base??'coherent';
if(!Number.isFinite(startS)||startS<0||!['coherent','coupled','candidate','observe'].includes(base))throw Error('Invalid diagnostic');
const names=[...(await readdir(new URL('src/',root))).filter(n=>n.endsWith('.js')).sort().map(n=>'src/'+n),
  'tools/sim/harness_m.mjs','tools/sim/whole_body_strike_probe.mjs','tools/sim/force_ledger.mjs','tools/sim/experiments/elbow_coordination_probe.mjs',
  'tools/sim/experiments/elbow_coherent_candidate.mjs','tools/sim/experiments/arm_control_conflict_probe.mjs','node_modules/@dimforge/rapier3d-compat/rapier.mjs'];
const manifest=async()=>Object.fromEntries(await Promise.all(names.map(async p=>[p,sha(await readFile(new URL(p,root)))])));
const before=await manifest(),started=performance.now(),rows=[];
const condition={weapon:opts.weapon??'zweihander',direction:opts.direction??'cross',ending:'target_hold',reaction:'paired',seed:7,prepareS:3,durationS:.55,afterS:1.2,sampleHz:120};
const modes=(opts.modes??'baseline,observe,intact,noWrist,noGrip,noPrimary').split(',');
for(const mode of modes){
  if(!['baseline','observe','intact','noWrist','noGrip','noPrimary'].includes(mode))throw Error('Invalid mode');
  let f,candidate,ledger,step=0,role=null,restoreBefore=null;const undo=[],frames=[],prefix=createHash('sha256'),suppressed=[];
  const intervention={activate(ctx){
    f=ctx.f;ledger=ctx.ledger;
    if(mode!=='baseline')candidate=installElbowCoherentCandidate({...ctx,mode:mode==='observe'?'observe':base});
    for(const name of ['driveSword','offHand','manualMuscle']){
      // Read-only role tracking wraps existing ledger dispatch without replacing it.
      const original=f[name];f[name]=function(...args){const prev=role;role=name;try{return original.apply(this,args);}finally{role=prev;}};
      undo.push(()=>{f[name]=original;});
    }
    const originalBefore=ctx.G.before;ctx.G.before=(t)=>{originalBefore?.(t);};restoreBefore=()=>{ctx.G.before=originalBefore;};
    for(const [name,b]of [...Object.entries(f.bodies),['sword',f.sword]])for(const method of ['addTorque','addForceAtPoint']){
      const original=b[method];b[method]=function(...args){
        const active=step*DT+1e-12>=startS;
        const suppress=active&&((mode==='noWrist'&&role==='driveSword'&&method==='addTorque')||(mode==='noGrip'&&role==='offHand'&&method==='addForceAtPoint')||(mode==='noPrimary'&&role==='manualMuscle'&&method==='addTorque'));
        if(suppress){suppressed.push({step,role,name,method,args:args.map(a=>a&&typeof a==='object'?{...a}:a)});return;}
        return original.apply(this,args);
      };undo.push(()=>{b[method]=original;});
    }
  },afterStep({G,sample:s,iteration}){
    const seg=ledger.latest.physics[0],body=new Map(seg.pre.bodies.map(b=>[b.label,b]));
    const farm=body.get('0:farmS'),sword=body.get('0:sword');
    const grip=new THREE.Vector3(.13,0,0).applyQuaternion(Q(farm.rotation)).add(V(farm.position));
    const paths={};
    for(const [path,p]of Object.entries(seg.balance.byPath))if(/\.(driveSword|offHand|manualMuscle|elbowGravity)$/.test(path)){
      const name=path.split('.').at(-1),sw=p.bodies['0:sword'];
      const force=sw?V(sw.forceImpulse).divideScalar(DT):new THREE.Vector3();
      const moment=sw?V(sw.torqueCOMImpulse).divideScalar(DT):new THREE.Vector3();
      moment.add(V(sword.com).sub(grip).cross(force));
      paths[name]={workJ:p.workApproxJ,swordWorkJ:sw?.workApproxJ??0,swordForceN:force.toArray(),swordMomentAboutGripNm:moment.toArray(),bodies:p.bodies};
    }
    const a=paths.driveSword?.swordMomentAboutGripNm??[0,0,0],b=paths.offHand?.swordMomentAboutGripNm??[0,0,0];
    const ma=new THREE.Vector3(...a),mb=new THREE.Vector3(...b),cosine=ma.length()*mb.length()>1e-10?ma.dot(mb)/(ma.length()*mb.length()):null;
    const state={native:sha(G.world.takeSnapshot()),targets:f.joints.map(j=>[j.name,j.target?.toArray(),j.prevTarget?.toArray(),j.prevRV?.toArray()]),input:s.handOffsetM};
    if(iteration*DT<startS-1e-12)prefix.update(JSON.stringify(state));
    frames.push({timeS:s.timeS,phase:s.phase,bladeErrorRad:s.bladeAimErrorRad,handErrorM:s.handTargetErrorM,offHandGapM:s.offHandGapM,
      swordKJ:s.swordEnergy.translationJ+s.swordEnergy.rotationJ,gripping:s.gripping,wristGripMomentCosine:cosine,paths,
      primaryTarget:f.jointByName.uarmS.target.toArray(),secondaryTarget:f.jointByName.uarmO.target.toArray(),
      elbowTarget:f.jointByName.farmS.target.toArray(),secondaryElbowTarget:f.jointByName.farmO.target.toArray(),
      candidateRecord:candidate?.records.at(-1)??null});step=iteration+1;
  },restore(){for(const restore of undo.reverse())restore();restoreBefore?.();candidate?.restore();}};
  const r=runStroke({...condition,ledgerFactory:G=>installForceLedger(G,{fighters:[G.player],maxSamples:0}),intervention});
  const phaseWork={};for(const fr of frames){const bucket=fr.timeS<=.3?'early':fr.timeS<=.55?'stroke_late':fr.timeS<=.7?'stop_early':'stop_late';phaseWork[bucket]??={};for(const [n,v]of Object.entries(fr.paths))phaseWork[bucket][n]=(phaseWork[bucket][n]??0)+v.workJ;}
  const row={mode,condition,trace:r.traceSha256,startNative:r.startNativeSha256,startController:r.startSha256,input:r.inputSha256,prefix:prefix.digest('hex'),
    metrics:{afterAxisTravelRad:r.summary.afterInputBladeAxisTravelRad,finalBladeErrorRad:r.final.bladeAimErrorRad,finalSwordKJ:r.final.swordEnergy.translationJ+r.final.swordEnergy.rotationJ,peakTipMps:r.strokePeak.tipSpeedMps,strokeMaxBladeErrorRad:Math.max(...frames.filter(s=>s.phase==='stroke').map(s=>s.bladeErrorRad))},phaseWork,suppressed,frames};rows.push(row);console.log(JSON.stringify({mode,metrics:row.metrics,phaseWork,suppressed:suppressed.length}));
}
const after=await manifest(),sourceStable=JSON.stringify(before)===JSON.stringify(after),baseRow=rows.find(r=>r.mode==='baseline'),ob=rows.find(r=>r.mode==='observe'),intact=rows.find(r=>r.mode==='intact');
const checks={sourceStable,observerExact:!baseRow||!ob||baseRow.trace===ob.trace,preparedNativeExact:rows.every(r=>r.startNative===rows[0].startNative),preparedControllerExact:rows.every(r=>r.startController===rows[0].startController),externalInputExact:rows.every(r=>r.input===rows[0].input),prefixExact:!intact||rows.filter(r=>r.mode.startsWith('no')).every(r=>r.prefix===intact.prefix)};
const report={createdUTC:new Date().toISOString(),command:process.argv,sourceBefore:before,sourceAfter:after,inputHelperSHA256,startS,base,wallSeconds:(performance.now()-started)/1000,checks,rows,
  meaning:'Same-prefix removal of complete explicit action/reaction paths only. Native motor work remains unmeasured. Moment cosine is about actual pre-step primary grip, not a work or physiological efficiency score. Suppression is diagnosis, not a fix.'};
await writeFile(opts.out??'/tmp/arm-control-conflict.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});await cleanupInputHelper();if(Object.values(checks).some(v=>v===false))process.exitCode=1;
