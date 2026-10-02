// Q03 first screen: reuse actual stroke/controller/native solver and its calibrated API.
// No engine rebuild, source edits, imposed movement, coefficient search or free-coast claim.
import {readFile,writeFile,readdir,mkdtemp,rm,mkdir,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import * as THREE from 'three';
import {installForceLedger} from '../force_ledger.mjs';
import {installNativeElbow} from './native_elbow_candidate.mjs';

const root=new URL('../../../',import.meta.url),sha=x=>createHash('sha256').update(x).digest('hex');
const opts=Object.fromEntries(process.argv.slice(2).map(a=>{const m=/^--(module|calibration|screen|out)=(.+)$/.exec(a);if(!m)throw Error('Use --module/calibration/screen/out=value');return[m[1],m[2]];}));
const screen=opts.screen??'cheap',calibrationPath=resolve(opts.calibration??'/workspace/halfsword-hybrid-evidence/native-motor-api-r1.json');
if(!['cheap','healthy','wound'].includes(screen))throw Error('screen is cheap, healthy or wound');
const out=opts.out??`/workspace/halfsword-hybrid-evidence/native-elbow-followthrough-r1-${screen}.json`;
try{await access(out);throw Error('Refusing to overwrite existing evidence');}catch(e){if(e.code!=='ENOENT')throw e;}
const calibrationBytes=await readFile(calibrationPath),calibration=JSON.parse(calibrationBytes);
const engine=pathToFileURL(resolve(opts.module??calibration.modulePath)),engineBefore=sha(await readFile(engine));
const calibrationSource=sha(await readFile(new URL('tools/sim/experiments/native_motor_api_probe.mjs',root)));
if(!calibration.pass||!calibration.sourceStable||!calibration.moduleSourceStable||calibration.moduleSourceBefore!==engineBefore
  ||calibration.moduleSourceAfter!==engineBefore||calibration.sourceBefore!==calibrationSource||calibration.sourceAfter!==calibrationSource)
  throw Error('Exact passed native API calibration/module/source guard failed');
const V=v=>new THREE.Vector3(v.x,v.y,v.z),Q=q=>new THREE.Quaternion(q.x,q.y,q.z,q.w);
const modeList=screen==='cheap'?['baseline','observe','nativeCap']:['baseline','observe','nativeCap','explicitCap','combined'];
const cases=screen==='cheap'?[{weapon:'zweihander',direction:'down',ending:'target_hold',condition:'healthy'}]:
  ['sabre','zweihander'].flatMap(weapon=>(screen==='wound'?['down']:['down','up']).flatMap(direction=>
    (screen==='wound'?['target_hold']:['target_hold','release']).map(ending=>({weapon,direction,ending,condition:screen==='wound'?'armCut':'healthy'}))));
async function manifest(){
  async function scan(dir){const result=[];for(const e of await readdir(new URL(dir,root),{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())result.push(...await scan(p));else if(e.name.endsWith('.js'))result.push(p);}return result;}
  const files=[...await scan('src'),'package-lock.json','tools/sim/harness_m.mjs','tools/sim/whole_body_strike_probe.mjs','tools/sim/force_ledger.mjs',
    'tools/sim/experiments/native_motor_api_probe.mjs','tools/sim/experiments/native_elbow_candidate.mjs',
    'tools/sim/experiments/elbow_actuator_candidate.mjs','tools/sim/experiments/native_elbow_followthrough_probe.mjs'];
  return Object.fromEntries(await Promise.all(files.sort().map(async p=>[p,sha(await readFile(new URL(p,root)))])));
}
function jointSpec(j){const raw=j.joint.rawSet,h=j.joint.handle;return {handle:h,type:j.type,manual:j.manual,k:j.k,d:j.d,max:j.max,
  anchor1:{...j.joint.anchor1()},anchor2:{...j.joint.anchor2()},frame1:{...j.joint.frameX1()},frame2:{...j.joint.frameX2()},contacts:j.joint.contactsEnabled(),
  limits:{enabled:raw.jointLimitsEnabled(h,3),min:raw.jointLimitsMin(h,3),max:raw.jointLimitsMax(h,3)}};}
function controller(f,startState){return {startState,limbs:{...f.limbs},strength:f.strength,muscle:f.muscle,armHealth:f.armHealth,
  pain:f.pain,balance:f.balance,blood:f.blood,bleed:f.bleed,consciousness:f.consciousness,cloth:{...f.cloth},
  wounds:f.wounds.map(w=>({...w,local:w.local?.toArray()}))};}
function gap(f){let maximum=0;for(const j of f.joints)if(j.joint?.isValid()){
  const a=V(j.joint.anchor1()).applyQuaternion(Q(j.parent.rotation())).add(V(j.parent.translation()));
  const b=V(j.joint.anchor2()).applyQuaternion(Q(j.child.rotation())).add(V(j.child.translation()));maximum=Math.max(maximum,a.distanceTo(b));}return maximum;}
const totalK=s=>s.swordEnergy.translationJ+s.swordEnergy.rotationJ+Object.values(s.bodyEnergy).reduce((a,e)=>a+e.translationJ+e.rotationJ,0);
const swordK=s=>s.swordEnergy.translationJ+s.swordEnergy.rotationJ;
function contactSlip(G,latest,summary,phase){
  for(const segment of latest.physics)for(const c of segment.contactsRaw){
    const aPlayer=c.labelA?.startsWith('0:'),bPlayer=c.labelB?.startsWith('0:');
    if(!aPlayer&&!bPlayer)continue;
    summary.manifoldFrames++;summary.rawNormalImpulseNs+=c.rawNormalImpulseNs;
    const other=G.world.getRigidBody(Number(aPlayer?c.bodyB:c.bodyA));
    if(!other?.isFixed()||Math.abs(c.normal.y)<.7)continue; // Walls are absent; actual fixed floor support.
    summary.floorManifoldFrames++;summary.floorNormalImpulseNs+=c.rawNormalImpulseNs;
    const normal=V(c.normal).normalize();
    for(const p of c.solverPoints){
      const relative=V(p.velocityA).sub(V(p.velocityB)),speed=relative.addScaledVector(normal,-relative.dot(normal)).length();
      summary.floorPointSamples++;summary.maxFloorTangentialRelativeSpeedMps=Math.max(summary.maxFloorTangentialRelativeSpeedMps,speed);
      summary.sumFloorTangentialRelativeSpeedMps+=speed;summary.byPhase[phase].maxSlipMps=Math.max(summary.byPhase[phase].maxSlipMps,speed);
      summary.byPhase[phase].pointSamples++;
    }
  }
}
function experiment(mode,condition,CONFIG){
  let native=null,f,ledger,previousModel,previousAxis,previousQuaternion,firstActualStep=true;
  const undo=[],record={mode,condition,errors:[],frames:[],counts:{driveSword:0,driveJoints:0,baselineElbowGravity:0},native:null,wound:null,
    jointPreserved:true,explicitFFDuplicateCalls:0,maxJointGapM:0,maxPelvisHeightM:-Infinity,maxBodySpeedMps:0,maxBodyAngularSpeedRadps:0,
    phase:{stroke:{frames:0,swordGravityWorkApproxJ:0,explicitActuatorWorkApproxJ:0},after_input:{frames:0,swordGravityWorkApproxJ:0,explicitActuatorWorkApproxJ:0}},
    ending:{frames:0,fullOrientationTravelRad:0,bladeAxisTravelRad:0,peakSwordKJ:0,sumSwordKJ:0,peakWholeKJ:0},
    contacts:{manifoldFrames:0,rawNormalImpulseNs:0,floorManifoldFrames:0,floorNormalImpulseNs:0,floorPointSamples:0,
      maxFloorTangentialRelativeSpeedMps:0,sumFloorTangentialRelativeSpeedMps:0,byPhase:{stroke:{maxSlipMps:0,pointSamples:0},after_input:{maxSlipMps:0,pointSamples:0}}}};
  const nativeFrames=createHash('sha256'),actualController=createHash('sha256');
  return {record,activate(context){
    ({f,ledger}=context);const {G,startState,initial}=context;previousModel=f.armTorqueModel;
    if(condition==='armCut'){
      const payload={part:'farmS',zone:'arm',type:'cut',severity:.6,energy:76,bleedPerSev:CONFIG.ANATOMY.arm.bleed,
        local:new THREE.Vector3(0,0,0),helmet:false,plate:false,pass:true,passing:false};
      const before=controller(f,startState),beforeNative=sha(G.world.takeSnapshot());f.applyWound(payload);
      record.wound={payload:{...payload,local:payload.local.toArray()},before,after:controller(f,startState),
        bodyNativeUnchanged:beforeNative===sha(G.world.takeSnapshot()),actualWoundAdded:f.wounds.length===before.wounds.length+1,
        interpretation:'Synthetic bounded payload through the real applyWound API; no armS field injection and no claimed blade impact. Severity/energy reflect arm threshold22 + .6*90 at unit quality/power; no passing sever path.'};
      if(!record.wound.actualWoundAdded||!record.wound.bodyNativeUnchanged||f.detachedParts?.has('farmS')||!f.armed||f.state==='dead')throw Error('Bounded actual wound precondition failed');
    }
    record.checkpoint={nativeSha256:sha(G.world.takeSnapshot()),controllerSha256:sha(JSON.stringify(controller(f,startState))),jointSpec:jointSpec(f.jointByName.farmS)};
    record.expectedSteps=Math.ceil((.55+1.2)/context.DT);previousAxis=V(initial.bladeAxisWorld);previousQuaternion=Q(initial.sword.orientation).normalize();
    for(const name of ['driveSword','driveJoints','elbowGravity']){
      const original=f.constructor.prototype[name];undo.push(ledger.replaceObservedMethod(f,name,function(...args){
        record.counts[name==='elbowGravity'?'baselineElbowGravity':name]++;return original.apply(this,args);}));
    }
    if(['explicitCap','combined'].includes(mode))f.armTorqueModel='sharedCap';
    if(['observe','nativeCap','combined'].includes(mode))native=installNativeElbow({f,ledger,mode:mode==='observe'?'observe':'capped',maxRecords:record.expectedSteps});
    record.installNativeUnchanged=record.checkpoint.nativeSha256===sha(G.world.takeSnapshot());
    record.jointPreserved=JSON.stringify(record.checkpoint.jointSpec)===JSON.stringify(jointSpec(f.jointByName.farmS));
  },afterStep({G,DT,sample,iteration}){
    const motor=native?.afterStep()??null,j=f.jointByName.farmS,phase=sample.phase;
    if(firstActualStep){record.firstStepModel=f.armTorqueModel??null;firstActualStep=false;}
    record.jointPreserved&&=JSON.stringify(record.checkpoint.jointSpec)===JSON.stringify(jointSpec(j));
    const ffCalls=ledger.latest.operations.filter(e=>e.owner===f.index&&e.method==='addTorque'&&e.path.endsWith('.elbowGravity')).length;
    if(['nativeCap','combined'].includes(mode))record.explicitFFDuplicateCalls+=ffCalls;
    const bodies=ledger.latest.postGame.bodies;nativeFrames.update(JSON.stringify(bodies)+'\n');
    actualController.update(JSON.stringify({handHeld:sample.handHeld,inputActive:sample.inputActive,offset:sample.handOffsetM,aim:sample.filteredAimM,rawAim:sample.rawAimM,bodyPose:sample.bodyPose})+'\n');
    for(const b of bodies){record.maxBodySpeedMps=Math.max(record.maxBodySpeedMps,V(b.velocity).length());record.maxBodyAngularSpeedRadps=Math.max(record.maxBodyAngularSpeedRadps,V(b.omega).length());}
    record.maxPelvisHeightM=Math.max(record.maxPelvisHeightM,sample.pelvis.positionM.y);record.maxJointGapM=Math.max(record.maxJointGapM,gap(f));
    record.phase[phase].frames++;
    for(const segment of ledger.latest.physics){
      const a=segment.pre.bodies.find(b=>b.label==='0:sword'),b=segment.post.bodies.find(b=>b.label==='0:sword');
      if(a&&b)record.phase[phase].swordGravityWorkApproxJ+=DT*CONFIG.PHYSICS.gravity*a.mass*a.gravityScale*(a.velocity.y+b.velocity.y)/2;
      for(const [path,p]of Object.entries(segment.balance.byPath))if(/\.(driveSword|manualMuscle|elbowGravity)$/.test(path))record.phase[phase].explicitActuatorWorkApproxJ+=p.workApproxJ;
    }
    contactSlip(G,ledger.latest,record.contacts,phase);
    const axis=V(sample.bladeAxisWorld),orientation=Q(sample.sword.orientation).normalize();
    if(phase==='after_input'){
      record.ending.frames++;record.ending.fullOrientationTravelRad+=2*Math.acos(Math.min(1,Math.abs(orientation.dot(previousQuaternion))));
      record.ending.bladeAxisTravelRad+=Math.acos(Math.max(-1,Math.min(1,axis.dot(previousAxis))));
      record.ending.peakSwordKJ=Math.max(record.ending.peakSwordKJ,swordK(sample));record.ending.sumSwordKJ+=swordK(sample);
      record.ending.peakWholeKJ=Math.max(record.ending.peakWholeKJ,totalK(sample));record.ending.finalSwordKJ=swordK(sample);record.ending.finalWholeKJ=totalK(sample);
      record.ending.finalTipMps=sample.tipSpeedMps;record.ending.finalHandErrorM=sample.handTargetErrorM;
    }else{record.ending.strokeEndSwordKJ=swordK(sample);record.ending.strokeEndWholeKJ=totalK(sample);}
    previousAxis=axis;previousQuaternion=orientation;
    if(iteration%4===0||iteration===record.expectedSteps-1)record.frames.push({iteration,timeS:sample.timeS,phase,state:sample.state,tipMps:sample.tipSpeedMps,
      handErrorM:sample.handTargetErrorM,gripGapM:sample.offHandGapM,gripping:sample.gripping,swordKJ:swordK(sample),wholeKJ:totalK(sample),motor});
    if(!record.jointPreserved||record.explicitFFDuplicateCalls)throw Error('Existing hinge/limits/FF isolation failed');
  },restore(){
    if(!f)return;record.native=native?.summary??null;native?.restore();for(const u of undo.reverse())u();
    if(previousModel===undefined)delete f.armTorqueModel;else f.armTorqueModel=previousModel;
    record.nativeBodyTraceSha256=nativeFrames.digest('hex');record.actualControllerSha256=actualController.digest('hex');
    record.ending.meanSwordKJ=record.ending.frames?record.ending.sumSwordKJ/record.ending.frames:null;
    record.contacts.meanFloorTangentialRelativeSpeedMps=record.contacts.floorPointSamples?record.contacts.sumFloorTangentialRelativeSpeedMps/record.contacts.floorPointSamples:null;
  }};
}
const sourceBefore=await manifest(),begin=performance.now(),directory=await mkdtemp(join(tmpdir(),'halfsword-elbow-followthrough-'));
const rows=[],comparisons=[],transformed={};let error=null,failedRun=null;
try{
  const rewrite=(s,url,special={})=>s.replace(/from (['"])([^'"]+)\1/g,(_,q,p)=>'from '+JSON.stringify(special[p]??(p.startsWith('.')?new URL(p,url).href:import.meta.resolve(p))));
  const harnessURL=new URL('tools/sim/harness_m.mjs',root),harness=await readFile(harnessURL,'utf8'),marker='../../node_modules/@dimforge/rapier3d-compat/rapier.mjs';
  if(harness.split(marker).length!==2)throw Error('Expected one actual harness engine import');
  const harnessPath=join(directory,'harness.mjs'),harnessText=rewrite(harness,harnessURL,{[marker]:engine.href});await writeFile(harnessPath,harnessText);transformed.harnessSha256=sha(harnessText);
  const strokeURL=new URL('tools/sim/whole_body_strike_probe.mjs',root),stroke=await readFile(strokeURL,'utf8');
  if(stroke.split('./harness_m.mjs').length!==2)throw Error('Expected one actual stroke harness import');
  const strokePath=join(directory,'stroke.mjs'),strokeText=rewrite(stroke,strokeURL,{'./harness_m.mjs':pathToFileURL(harnessPath).href});
  await writeFile(strokePath,strokeText);transformed.strokeSha256=sha(strokeText);
  const {runStroke}=await import(pathToFileURL(strokePath).href),{CONFIG}=await import(pathToFileURL(harnessPath).href);
  for(const c of cases){const group=[];
    for(const mode of modeList){
      const exp=experiment(mode,c.condition,CONFIG);let row;
      try{row=runStroke({...c,reaction:'paired',seed:7,durationS:.55,prepareS:3,afterS:1.2,sampleHz:30,
        ledgerFactory:G=>installForceLedger(G,{fighters:[G.player],maxSamples:0}),intervention:exp});}
      catch(error){failedRun={...c,mode,record:exp.record,error:String(error)};throw error;}
      row.experiment=exp.record;const e=exp.record,n=e.native;
      row.executionPass=row.finite&&e.installNativeUnchanged&&e.jointPreserved&&e.errors.length===0&&e.explicitFFDuplicateCalls===0
        &&e.counts.driveSword===e.expectedSteps&&e.counts.driveJoints===e.expectedSteps
        &&(!n||n.nativeCalls===e.expectedSteps&&n.measurements===n.nativeCalls&&n.errors.length===0)
        &&(!['nativeCap','combined'].includes(mode)||n.explicitGravityCalls===n.nativeCalls&&n.maxLastSubstepCapRatio<=1+1e-4)
        &&(!['explicitCap','combined'].includes(mode)||e.firstStepModel==='sharedCap');
      row.mode=mode;row.condition=c.condition;rows.push(row);group.push(row);
      console.log(JSON.stringify({mode,...c,executionPass:row.executionPass,peakTipMps:row.strokePeak.tipSpeedMps,wholePeakTipMps:row.peak.tipSpeedMps,
        maxHandErrorM:row.summary.maxHandTargetErrorM,gripGapM:row.summary.maxOffHandGapM,ending:e.ending,
        maxJointGapM:e.maxJointGapM,contactSlipMps:e.contacts.maxFloorTangentialRelativeSpeedMps,native:n}));
      if(!row.executionPass)throw Error('Actual native ending dispatch/diagnostic gate failed');
    }
    const base=group[0],observe=group.find(r=>r.mode==='observe');
    const comparison={...c,samePreparedNative:group.every(r=>r.startNativeSha256===base.startNativeSha256),
      samePreparedController:group.every(r=>r.startSha256===base.startSha256),
      sameConfiguredNative:group.every(r=>r.experiment.checkpoint.nativeSha256===base.experiment.checkpoint.nativeSha256),
      sameConfiguredController:group.every(r=>r.experiment.checkpoint.controllerSha256===base.experiment.checkpoint.controllerSha256),
      sameRequestedInput:group.every(r=>r.inputSha256===base.inputSha256),observerFullPhysicalControlTraceExact:observe.traceSha256===base.traceSha256,
      observerAllNativeBodyTraceExact:observe.experiment.nativeBodyTraceSha256===base.experiment.nativeBodyTraceSha256,
      observerActualControllerTraceExact:observe.experiment.actualControllerSha256===base.experiment.actualControllerSha256,
      candidateDeltas:group.filter(r=>!['baseline','observe'].includes(r.mode)).map(r=>({mode:r.mode,
        peakTipMps:r.strokePeak.tipSpeedMps-base.strokePeak.tipSpeedMps,maxHandErrorM:r.summary.maxHandTargetErrorM-base.summary.maxHandTargetErrorM,
        afterAxisTravelRad:r.summary.afterInputBladeAxisTravelRad-base.summary.afterInputBladeAxisTravelRad,
        afterFinalSwordKJ:r.experiment.ending.finalSwordKJ-base.experiment.ending.finalSwordKJ,
        afterWholeOrientationTravelRad:r.experiment.ending.fullOrientationTravelRad-base.experiment.ending.fullOrientationTravelRad,
        newNumericalReview:r.experiment.maxPelvisHeightM>base.experiment.maxPelvisHeightM+.75||r.experiment.maxJointGapM>base.experiment.maxJointGapM+.1,
        interpretation:'Peak speed is descriptive; lower peak alone does not reject a cap. Error/continuation/braking/contact changes require separate review.'}))};
    comparisons.push(comparison);if(Object.values(comparison).some(v=>v===false))throw Error('Mandatory same-engine preparation/observe exact gate failed');
    console.log(JSON.stringify({comparison}));
  }
}catch(e){error=e.stack??String(e);}finally{await rm(directory,{recursive:true,force:true});}
const sourceAfter=await manifest(),engineAfter=sha(await readFile(engine)),sourceStable=JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter)&&engineBefore===engineAfter;
const report={schemaVersion:1,createdUTC:new Date().toISOString(),sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  command:`node tools/sim/experiments/native_elbow_followthrough_probe.mjs --module=${engine.pathname} --calibration=${calibrationPath} --screen=${screen} --out=${out}`,
  screen,sourceBefore,sourceAfter,sourceStable,engine:{module:engine.href,sha256:engineBefore,sha256After:engineAfter,calibrationPath,calibrationSHA256:sha(calibrationBytes),calibrationSourceSHA256:calibrationSource},
  transformed,wallSeconds:(performance.now()-begin)/1000,error,protocol:{seed:7,prepareS:3,durationS:.55,afterS:1.2,reaction:'paired',cases,modeList,
    preparation:'Unmodified actual game high/low preparation under legacy grip, per existing runStroke contract. Candidate selection follows matched checkpoint.',
    release:'handHeld false with normal autocenter/recovery retained; not free coast.',
    candidateKnobs:['Existing one-axis native farmS cap including its existing gravity FF','Existing runtime sharedCap for explicit shoulder/wrist'],
    input:'Same external requested drag/hold/release schedule within each case; actual controller feedback can diverge under candidate dynamics.',
    wound:'Optional separate screen invokes real applyWound with one documented bounded synthetic payload. It is not a sword-contact wound and not a direct limb-health-field injection.',
    motorReadout:'Last native solver substep only; no outer-step motor impulse or native work inferred.',
    contactReadout:'Actual post-solver fixed-floor contact point relative tangential speeds; impulse and solver-point arrays are not paired or used as weights.',
    K:'Actual rigid-body translational plus rotational kinetic energy. It is not wound energy, physiological work, or a native actuator energy budget.'},
  limitations:['Healthy screen is 40 rows, wound screen only down/hold for two weapons; no broad seed repeats or duel/mobile claims.',
    'Native elbow changes gravity FF from an external torque to a target bias inside the same coupled native actuator; not a control-equivalent external-FF implementation.',
    'Explicit actuator and sword-gravity work are midpoint approximations. Native motor/constraint work and passive limits are not included.',
    'Physical/control trace is the existing runStroke trace plus all selected dynamic native-body ledger states; source and transformed import hashes identify the exact executed code.',
    'Baseline-relative height/gap flags are observational review thresholds, never gameplay constraints or human naturalness criteria.'],
  rows,comparisons,failedRun};
report.executionPass=!error&&sourceStable&&rows.length===cases.length*modeList.length&&rows.every(r=>r.executionPass);
report.numericalReview=comparisons.flatMap(c=>c.candidateDeltas.filter(d=>d.newNumericalReview).map(d=>({weapon:c.weapon,direction:c.direction,ending:c.ending,...d})));
report.pass=report.executionPass&&report.numericalReview.length===0;
await mkdir(dirname(out),{recursive:true});await writeFile(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({out,pass:report.pass,executionPass:report.executionPass,sourceStable,rows:rows.length,error,numericalReview:report.numericalReview,wallSeconds:report.wallSeconds}));
process.exitCode=report.pass?0:1;
