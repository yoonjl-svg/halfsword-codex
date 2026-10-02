/** Actual two-AI duels. Candidate installation follows matched ordinary preparation.
 * No imposed body state, AI disable, stable-mode substitute, wound suppression or gain search.
 */
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {dirname} from 'node:path';
import {newRound,AI,DT,THREE,CONFIG} from '../harness_m.mjs';
import {Fighter} from '../../../src/fighter.js';
import {installForceLedger} from '../force_ledger.mjs';
import {loadArmCapacityCandidates} from './arm_capacity_candidate.mjs';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const opts=Object.fromEntries(process.argv.slice(2).map(a=>{const m=/^--(seconds|prepare|seeds|modes|out)=(.+)$/.exec(a);if(!m)throw Error('Use --seconds/prepare/seeds/modes/out=value');return[m[1],m[2]];}));
const seconds=Number(opts.seconds??30),prepare=Number(opts.prepare??3),seeds=(opts.seeds??'7,19').split(',').map(Number);
const modes=(opts.modes??'original,clone,finalCap,combined,runtimeFinalCap,runtimeFresh').split(',');
const pairs=[['sabre','longsword'],['zweihander','longsword']];
const output=opts.out??'/workspace/halfsword-hybrid-evidence/arm-capacity-duel-r1.json';
if(!Number.isFinite(seconds)||seconds<=0||!Number.isFinite(prepare)||prepare<0||seeds.some(s=>!Number.isInteger(s))
  ||modes.some(m=>!['original','clone','finalCap','combined','runtimeFinalCap','runtimeFresh'].includes(m))||!modes.includes('original')||!modes.includes('clone'))throw Error('Invalid duel configuration; original/clone are mandatory');
if(fs.existsSync(output))throw Error('Preserve existing evidence; select a new --out path');
const sha=x=>createHash('sha256').update(x).digest('hex');
const V=v=>new THREE.Vector3(v.x,v.y,v.z),Q=q=>new THREE.Quaternion(q.x,q.y,q.z,q.w);
const norm=v=>Math.hypot(v.x,v.y,v.z),vec=v=>({x:v.x,y:v.y,z:v.z});
const sourceFiles=(()=>{function scan(d){return fs.readdirSync(root+d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(d+'/'+e.name):e.name.endsWith('.js')?[d+'/'+e.name]:[]);}return [...scan('src'),
  'tools/sim/harness_m.mjs','tools/sim/force_ledger.mjs','tools/sim/experiments/arm_capacity_candidate.mjs','tools/sim/experiments/arm_capacity_duel_probe.mjs','package-lock.json'].sort();})();
const manifest=()=>Object.fromEntries(sourceFiles.map(p=>[p,sha(fs.readFileSync(root+p))]));
const sourceBefore=manifest(),modules=await loadArmCapacityCandidates();
const tolerance={torqueAbsPlusRelative:1e-8,powerAbsPlusRelative:1e-7,capAbsPlusRelative:1e-8};
const tripwires={newPelvisHeightMarginM:.75,bodySpeedFactor:3,bodySpeedMarginMps:10,newJointGapMarginM:.1,
  meaning:'Baseline-relative diagnostic review gates only, not human motion success thresholds and never used by a controller.'};
function near(a,b,tol){return Math.abs(a-b)<=tol*(1+Math.abs(a)+Math.abs(b));}
function ownState(object){
  const omit=new Set(['f','fighter','me','foe','world','scene','R','rb','body','parent','child','joint','rawSet','raw','__wbg_ptr','info','mesh','group','sword','grip','colliderSet','armTorqueModel']);
  const seen=new WeakSet();
  function encode(x,depth=0){
    if(x==null||typeof x==='string'||typeof x==='boolean')return x;
    if(typeof x==='number')return Number.isFinite(x)?x:{$number:String(x)};
    if(typeof x==='function'||depth>8||typeof x!=='object'||x.isObject3D||typeof x.isValid==='function')return undefined;
    if(x.isVector2||x.isVector3||x.isQuaternion||x.isEuler)return x.toArray();
    if(seen.has(x))return {$shared:true};seen.add(x);
    if(Array.isArray(x))return x.map(y=>encode(y,depth+1));
    if(x instanceof Set)return [...x].map(y=>encode(y,depth+1));
    if(x instanceof Map)return [...x].map(([k,v])=>[encode(k,depth+1),encode(v,depth+1)]);
    const out={};for(const [k,v]of Object.entries(x))if(!omit.has(k)){const y=encode(v,depth+1);if(y!==undefined)out[k]=y;}return out;
  }
  return encode(object);
}
function controls(f){
  const scalar={};for(const [k,v]of Object.entries(f))if(k!=='armTorqueModel'&&(v==null||['number','string','boolean'].includes(typeof v)||v?.isVector2||v?.isVector3||v?.isQuaternion))scalar[k]=ownState(v);
  return {scalar,limbs:{...f.limbs},wounds:ownState(f.wounds),bodyPose:{...f.bodyPose},bodyPoseVel:{...f.bodyPoseVel},
    skill:ownState(f.skill),gait:ownState(f.gait),finish:ownState(f.finish),footLoad:ownState(f.footLoad),prevU:ownState(f.prevU),
    joints:f.joints.map(j=>({name:j.name,k:j.k,d:j.d,max:j.max,gain:j.gain??1,target:j.target.toArray(),prevTarget:j.prevTarget?.toArray(),prevRV:j.prevRV?.toArray()}))};
}
function input(G){return {fighters:[G.player,G.enemy].map(f=>({handOffset:f.handOffset.toArray(),handHeld:f.handHeld,inputActive:f.inputActive,move:f.move.toArray(),stick:[f.stickX,f.stickY],tap:ownState(f.skill.tap)})),AI:[ownState(G.ai),ownState(G.ai2)]};}
function trace(G,state){return {timeS:G.t,bodies:state.bodies.map(b=>({handle:b.handle,label:b.label,mass:b.mass,p:b.position,q:b.rotation,com:b.com,v:b.velocity,w:b.omega,
  principalI:b.inertia.principal,principalFrame:b.inertia.localFrame,userForce:b.userForce,userTorque:b.userTorque})),
  fighters:[controls(G.player),controls(G.enemy)],AI:[ownState(G.ai),ownState(G.ai2)],
  wounds:G.wounds.map(w=>({t:w.t,att:w.att.index,vic:w.vic.index,zone:w.zone,type:w.type,energy:w.energy,severity:w.severity})),
  cutting:[...G.combat.cutting].map(([key,c])=>({key,seen:c.seen,applied:c.applied,Eleft:c.Eleft,stuck:c.stuck,stuckT:c.stuckT,mFree:c.mFree,cutBudgetDone:c.cutBudgetDone}))};}
function trackRandom(seed){
  const descriptor=Object.getOwnPropertyDescriptor(Math,'random');let actual=descriptor.value,tracked=actual,calls=0,resets=0,seedCalls=0;
  const history=createHash('sha256'),seedHistory=createHash('sha256'),known=new WeakMap();
  Object.defineProperty(Math,'random',{configurable:true,enumerable:descriptor.enumerable,get:()=>tracked,set(fn){
    resets++;
    if(known.has(fn)){tracked=fn;actual=known.get(fn);return;}
    actual=fn;const seedGenerator=String(fn).includes('0x6d2b79f5');
    tracked=function(){const result=fn();calls++;history.update(JSON.stringify(result)+'\n');
      if(seedGenerator){seedCalls++;seedHistory.update(JSON.stringify(result)+'\n');}return result;};
    known.set(tracked,fn);
  }});
  return {state:()=>({seed,generator:'Actual harness seedRandom mulberry32, no substituted draws; temporary visual RNG save/restore preserved',resets,calls,seedCalls,
    inferredStateUint32:(seed+Math.imul(seedCalls,0x6d2b79f5))>>>0,outputHistorySha256:history.copy().digest('hex'),seedOutputHistorySha256:seedHistory.copy().digest('hex'),functionSha256:sha(String(actual))}),
    restore:()=>Object.defineProperty(Math,'random',descriptor)};
}

function jointObservation(f){
  const gaps=[];
  for(const j of f.joints)if(j.joint?.isValid()){
    const a=V(j.joint.anchor1()).applyQuaternion(Q(j.parent.rotation())).add(V(j.parent.translation()));
    const b=V(j.joint.anchor2()).applyQuaternion(Q(j.child.rotation())).add(V(j.child.translation()));
    gaps.push({name:j.name,gapM:a.distanceTo(b)});
  }
  if(f.gripJoint?.isValid()){
    const j=f.gripJoint,a=V(j.anchor1()).applyQuaternion(Q(j.body1().rotation())).add(V(j.body1().translation()));
    const b=V(j.anchor2()).applyQuaternion(Q(j.body2().rotation())).add(V(j.body2().translation()));gaps.push({name:'mainGrip',gapM:a.distanceTo(b)});
  }
  return {maxGapM:Math.max(0,...gaps.map(g=>g.gapM)),max:gaps.reduce((a,b)=>b.gapM>a.gapM?b:a,{name:null,gapM:0}),validMainGrip:!!f.gripJoint?.isValid()};
}
const blankActuator=()=>({diagnosticCalls:0,actualTorqueCalls:0,diagnosticTorqueMatches:true,actualPowerMatches:true,
  maxTorqueMismatchNm:0,maxPowerMismatchW:0,maxTorqueClosureNm:0,maxPowerIdentityErrorW:0,
  capViolations:0,maxCapRatio:0,zeroCapNonzeroTorque:0,maxActualTorqueNm:0,
  maxDiagnosticTorqueNm:0,sumInstantSignedPowerDtJ:0,sumInstantPositivePowerDtJ:0,sumInstantNegativePowerDtJ:0});

function run(mode,seed,weapons){
  const begin=performance.now(),rng=trackRandom(seed);let G,ledger;
  const runtime=mode==='runtimeFinalCap'||mode==='runtimeFresh';
  const installed=[],diagnosticRows=[],summary={finite:true,steps:0,observedWrappersPreserved:true,diagnosticErrors:[],
    diagnosticMismatchFrames:0,candidateCapPass:true,torqueClosurePass:true,powerIdentityPass:true,
    maxBodySpeedMps:0,maxBodyAngularSpeedRadps:0,maxBodyHeightM:-Infinity,peakTotalKJ:0,
    maxPelvisHeightM:[-Infinity,-Infinity],maxJointGapM:[0,0],jointPeaks:[null,null],pelvisPeaks:[null,null],
    falls:[0,0],stateFrames:[{},{}],deathTransitions:[],contacts:{manifoldFrames:0,solverPointSamples:0,rawNormalImpulseNs:0},
    actuation:[{shoulder:blankActuator(),wrist:blankActuator()},{shoulder:blankActuator(),wrist:blankActuator()}]};
  const samples=[],anomalies=[],transitions=[],framesHash=createHash('sha256'),inputsHash=createHash('sha256'),frameHashes=[],inputHashes=[];
  let callbacks=[],lastStates,lastAlive,checkpoint,result;
  try{
    G=newRound({seed,walls:false,weapon:weapons[0],weapon2:weapons[1],AIClass:AI,AI2Class:AI,
      onFighter:mode==='runtimeFresh'?f=>{f.armTorqueModel='sharedCap';}:undefined});
    const beforeFirstStepProperties=[G.player,G.enemy].map(f=>f.armTorqueModel??null);
    for(let i=0;i<Math.round(prepare/DT);i++)G.step();
    const fighters=[G.player,G.enemy];
    checkpoint={timeS:G.t,nativeSha256:sha(G.world.takeSnapshot()),controlSha256:sha(JSON.stringify(fighters.map(controls))),
      AISha256:sha(JSON.stringify([ownState(G.ai),ownState(G.ai2)])),inputControllerSha256:sha(JSON.stringify(input(G))),rng:rng.state()};
    ledger=installForceLedger(G,{maxSamples:0});
    for(const f of fighters){
      const wrappers={driveSword:f.driveSword,manualMuscle:f.manualMuscle};
      if(mode==='original'||runtime){
        if(runtime)f.armTorqueModel='sharedCap';
        const counts={variant:mode,dispatchSource:'Actual imported Fighter.prototype methods, counting observer only',driveSwordCalls:0,manualMuscleCalls:0,errors:[]},undo=[];
        for(const method of ['driveSword','manualMuscle'])undo.push(ledger.replaceObservedMethod(f,method,function(...args){counts[method+'Calls']++;return Fighter.prototype[method].apply(this,args);}));
        installed.push({summary:counts,restore(){for(const u of undo.reverse())u();}});
      }else{
        installed.push(modules.installer({f,ledger,variant:mode,onDiagnostic:d=>callbacks.push(d)}));
      }
      summary.observedWrappersPreserved&&=f.driveSword===wrappers.driveSword&&f.manualMuscle===wrappers.manualMuscle;
    }
    lastStates=fighters.map(f=>f.state);lastAlive=fighters.map(f=>f.alive);
    const frames=Math.round(seconds/DT);
    for(let i=0;i<frames;i++){
      callbacks=[];G.step();summary.steps++;
      const latest=ledger.latest,state=latest.postGame;
      const frameText=JSON.stringify(trace(G,state)),inputText=JSON.stringify(input(G));
      framesHash.update(frameText+'\n');inputsHash.update(inputText+'\n');frameHashes.push(sha(frameText));inputHashes.push(sha(inputText));
      for(const b of state.bodies){
        for(const field of ['position','rotation','velocity','omega'])if(!Object.values(b[field]).every(Number.isFinite))summary.finite=false;
        summary.maxBodySpeedMps=Math.max(summary.maxBodySpeedMps,norm(b.velocity));
        summary.maxBodyAngularSpeedRadps=Math.max(summary.maxBodyAngularSpeedRadps,norm(b.omega));summary.maxBodyHeightM=Math.max(summary.maxBodyHeightM,b.position.y);
      }
      summary.peakTotalKJ=Math.max(summary.peakTotalKJ,state.total.K);
      const operations=latest.operations.filter(e=>e.method==='addTorque');
      let mismatch=false;
      for(const f of fighters)for(const actuator of ['shoulder','wrist']){
        const bucket=summary.actuation[f.index][actuator],method=actuator==='shoulder'?'manualMuscle':'driveSword';
        const ops=operations.filter(e=>e.owner===f.index&&e.path.endsWith('.'+method));
        bucket.actualTorqueCalls+=ops.length;
        const childLabel=f.index+':'+(actuator==='shoulder'?'uarmS':'sword'),child=ops.find(e=>e.label===childLabel);
        if(child)bucket.maxActualTorqueNm=Math.max(bucket.maxActualTorqueNm,norm(child.input));
        const actualClosure=ops.reduce((sum,op)=>sum.add(V(op.input)),new THREE.Vector3());
        const observedPower=ops.reduce((sum,op)=>sum+op.instantPowerAtCallW,0);
        bucket.maxTorqueClosureNm=Math.max(bucket.maxTorqueClosureNm,actualClosure.length());
        summary.torqueClosurePass&&=near(actualClosure.length(),0,tolerance.torqueAbsPlusRelative);
        bucket.sumInstantSignedPowerDtJ+=observedPower*DT;
        bucket.sumInstantPositivePowerDtJ+=Math.max(0,observedPower)*DT;bucket.sumInstantNegativePowerDtJ+=Math.min(0,observedPower)*DT;
        if(runtime&&child){
          bucket.actualRuntimeBranchEligibleCalls=(bucket.actualRuntimeBranchEligibleCalls??0)+1;
          if(actuator==='wrist'){
            const cap=f.debug.wristCap,ratio=cap>0?norm(child.input)/cap:0;
            bucket.maxCapRatio=Math.max(bucket.maxCapRatio,ratio);
            if(norm(child.input)>cap+tolerance.capAbsPlusRelative*(1+cap))bucket.capViolations++;
            if(bucket.capViolations)summary.candidateCapPass=false;
          }else bucket.capObservation='Not directly emitted by source; actual method branch/property and matched runtimeFinalCap exact comparison verify this path.';
        }
        const d=callbacks.find(d=>d.fighterIndex===f.index&&d.actuator===actuator);
        if(!d){if(mode!=='original'&&!runtime&&ops.length)mismatch=true;continue;}
        bucket.diagnosticCalls++;
        const recipients=actuator==='shoulder'?['uarmS','chest']:['sword','farmS','chest'];
        const expected=actuator==='shoulder'?[d.reactions.child,d.reactions.parent]:[d.reactions.child,d.reactions.parent,d.reactions.chest];
        let torqueMatch=ops.length===recipients.length,closure=new THREE.Vector3(),actualPower=0;
        for(let k=0;k<recipients.length;k++){
          const op=ops.find(e=>e.label===f.index+':'+recipients[k]);
          if(!op){torqueMatch=false;continue;}
          const difference=V(op.input).distanceTo(V(expected[k]));bucket.maxTorqueMismatchNm=Math.max(bucket.maxTorqueMismatchNm,difference);
          torqueMatch&&=near(difference,0,tolerance.torqueAbsPlusRelative);
          closure.add(V(op.input));actualPower+=op.instantPowerAtCallW;
        }
        const powerError=Math.abs(actualPower-d.explicitRecipientPowerW),powerMatch=near(actualPower,d.explicitRecipientPowerW,tolerance.powerAbsPlusRelative);
        bucket.maxPowerMismatchW=Math.max(bucket.maxPowerMismatchW,powerError);bucket.diagnosticTorqueMatches&&=torqueMatch;bucket.actualPowerMatches&&=powerMatch;
        bucket.maxTorqueClosureNm=Math.max(bucket.maxTorqueClosureNm,closure.length());bucket.maxPowerIdentityErrorW=Math.max(bucket.maxPowerIdentityErrorW,Math.abs(d.powerIdentityResidualW));
        bucket.maxDiagnosticTorqueNm=Math.max(bucket.maxDiagnosticTorqueNm,norm(d.torque));
        if(d.capNm>0)bucket.maxCapRatio=Math.max(bucket.maxCapRatio,norm(d.torque)/d.capNm);
        else if(norm(d.torque)>tolerance.capAbsPlusRelative)bucket.zeroCapNonzeroTorque++;
        if(norm(d.torque)>d.capNm+tolerance.capAbsPlusRelative*(1+d.capNm))bucket.capViolations++;
        const capped=['finalCap','combined','runtimeFinalCap'].includes(mode);
        if(capped&&bucket.capViolations)summary.candidateCapPass=false;
        summary.torqueClosurePass&&=near(closure.length(),0,tolerance.torqueAbsPlusRelative);
        summary.powerIdentityPass&&=near(d.powerIdentityResidualW,0,tolerance.powerAbsPlusRelative);
        if(!torqueMatch||!powerMatch)mismatch=true;
        if((!torqueMatch||!powerMatch||(capped&&bucket.capViolations))&&diagnosticRows.length<24)diagnosticRows.push({frame:i,timeS:G.t,diagnostic:d,operations:ops});
      }
      if(mismatch)summary.diagnosticMismatchFrames++;
      for(const segment of latest.physics)for(const c of segment.contactsRaw){summary.contacts.manifoldFrames++;summary.contacts.solverPointSamples+=c.solverPoints.length;summary.contacts.rawNormalImpulseNs+=c.rawNormalImpulseNs;}
      for(const f of fighters){
        const owner=f.index,observation=jointObservation(f),height=f.bodies.pelvis.translation().y;
        const context={frame:i,timeS:G.t,state:f.state,alive:f.alive,blood:f.blood,consciousness:f.consciousness,armed:f.armed,validMainGrip:observation.validMainGrip};
        if(observation.maxGapM>summary.maxJointGapM[owner]){summary.maxJointGapM[owner]=observation.maxGapM;summary.jointPeaks[owner]={...context,...observation.max};}
        if(height>summary.maxPelvisHeightM[owner]){summary.maxPelvisHeightM[owner]=height;summary.pelvisPeaks[owner]={...context,heightM:height,velocityMps:vec(f.bodies.pelvis.linvel())};}
        summary.stateFrames[owner][f.state]=(summary.stateFrames[owner][f.state]??0)+1;
        if(f.state!==lastStates[owner]){const transition={owner,frame:i,timeS:G.t,from:lastStates[owner],to:f.state,alive:f.alive,causeOfDeath:f.causeOfDeath};transitions.push(transition);if(f.state==='down')summary.falls[owner]++;lastStates[owner]=f.state;}
        if(lastAlive[owner]&&!f.alive)summary.deathTransitions.push({...context,owner,causeOfDeath:f.causeOfDeath});lastAlive[owner]=f.alive;
      }
      for(const s of installed)if(s.summary.errors?.length)summary.diagnosticErrors=[...summary.diagnosticErrors,...s.summary.errors].slice(0,32);
      const sample={frame:i,timeS:G.t,states:fighters.map(f=>f.state),alive:fighters.map(f=>f.alive),blood:fighters.map(f=>f.blood),
        pelvisHeightM:fighters.map(f=>f.bodies.pelvis.translation().y),wounds:G.wounds.length,clashes:G.clashes,KJ:state.total.K,maxJointGapM:fighters.map(f=>jointObservation(f).maxGapM)};
      if(i%Math.round(1/DT)===0||i===frames-1)samples.push(sample);
      if((mismatch||!summary.finite||sample.pelvisHeightM.some(y=>y>3)||sample.maxJointGapM.some(g=>g>.25))&&anomalies.length<24)anomalies.push(sample);
      if(!summary.finite||summary.diagnosticErrors.length)break;
    }
    const damage={woundEvents:G.wounds.length,clashes:G.clashes,byType:{},sumReportedEnergyJ:0,sumSeverity:0,
      final:[G.player,G.enemy].map(f=>({alive:f.alive,state:f.state,blood:f.blood,consciousness:f.consciousness,pain:f.pain,limbs:{...f.limbs},wounds:f.wounds.length,
        armed:f.armed,causeOfDeath:f.causeOfDeath}))};
    for(const w of G.wounds){damage.byType[w.type]=(damage.byType[w.type]??0)+1;damage.sumReportedEnergyJ+=w.energy;damage.sumSeverity+=w.severity;}
    result={mode,seed,weapons,preparationSeconds:prepare,observedSeconds:summary.steps*DT,wallSeconds:(performance.now()-begin)/1000,
      checkpoint,beforeFirstStepProperties,runtimeSelectionTiming:mode==='runtimeFresh'?'Constructor onFighter before first G.step, including preparation':runtime?'After matched preparation checkpoint':'No runtime selection',traceSha256:framesHash.digest('hex'),actualInputControllerSha256:inputsHash.digest('hex'),frameHashes,inputHashes,
      finalRng:rng.state(),dispatch:installed.map(s=>s.summary),summary,damage,transitions,samples,anomalies,diagnosticRows,
      appliedRuntimeProperties:[G.player,G.enemy].map(f=>f.armTorqueModel??null)};
    result.executionPass=summary.finite&&summary.steps===Math.round(seconds/DT)&&summary.observedWrappersPreserved&&summary.diagnosticErrors.length===0
      &&summary.diagnosticMismatchFrames===0&&summary.candidateCapPass&&summary.torqueClosurePass&&summary.powerIdentityPass
      &&installed.every(s=>s.summary.driveSwordCalls===summary.steps&&s.summary.manualMuscleCalls>0)
      &&(mode==='original'||runtime||summary.actuation.every(owner=>owner.shoulder.diagnosticCalls>0&&owner.wrist.diagnosticCalls>0))
      &&(!runtime||result.appliedRuntimeProperties.every(x=>x==='sharedCap')&&summary.actuation.every(owner=>owner.shoulder.actualRuntimeBranchEligibleCalls>0&&owner.wrist.actualRuntimeBranchEligibleCalls>0))
      &&(mode!=='runtimeFresh'||beforeFirstStepProperties.every(x=>x==='sharedCap')); 
    return result;
  }finally{for(const x of installed.reverse())x.restore();ledger?.restore();G?.eventQueue.free();G?.world.free();rng.restore();}
}

const runs=[],comparisons=[];let error=null;
try{
  for(const weapons of pairs)for(const seed of seeds){
    const group=[];
    for(const mode of modes){const row=run(mode,seed,weapons);runs.push(row);group.push(row);
      console.log(JSON.stringify({mode,seed,weapons,seconds:row.observedSeconds,wallSeconds:row.wallSeconds,executionPass:row.executionPass,
        maxPelvisY:row.summary.maxPelvisHeightM,maxJointGap:row.summary.maxJointGapM,maxSpeed:row.summary.maxBodySpeedMps,wounds:row.damage.woundEvents,
        alive:row.damage.final.map(f=>f.alive),states:row.damage.final.map(f=>f.state),diagnosticErrors:row.summary.diagnosticErrors}));
    }
    const original=group.find(r=>r.mode==='original'),clone=group.find(r=>r.mode==='clone');
    const matched=group.filter(r=>r.mode!=='runtimeFresh');
    const comparison={seed,weapons,matchedPreparationModes:matched.map(r=>r.mode),freshPreparationExcluded:'runtimeFresh is intentionally active during preparation and does not claim same prepared state.',preparedNativeExact:matched.every(r=>r.checkpoint.nativeSha256===original.checkpoint.nativeSha256),
      preparedControlExact:matched.every(r=>r.checkpoint.controlSha256===original.checkpoint.controlSha256),preparedAIExact:matched.every(r=>r.checkpoint.AISha256===original.checkpoint.AISha256),
      preparedInputControllerExact:matched.every(r=>r.checkpoint.inputControllerSha256===original.checkpoint.inputControllerSha256),
      preparedRngExact:matched.every(r=>['seed','seedCalls','inferredStateUint32','seedOutputHistorySha256','functionSha256'].every(k=>r.checkpoint.rng[k]===original.checkpoint.rng[k])),
      preparedRngScope:'Actual gameplay mulberry32 state and output history. Render-only visualRandom has persistent separate module state; its recorded output history is not a gameplay RNG equality gate.',
      originalCloneTraceExact:original.traceSha256===clone.traceSha256&&JSON.stringify(original.frameHashes)===JSON.stringify(clone.frameHashes),
      originalCloneActualInputControllerExact:original.actualInputControllerSha256===clone.actualInputControllerSha256,
      candidates:group.filter(r=>!['original','clone'].includes(r.mode)).map(row=>({mode:row.mode,
        matchedPreparation:row.mode!=='runtimeFresh',
        firstPhysicalControlDifferenceFrame:original.frameHashes.findIndex((h,i)=>h!==row.frameHashes[i]),
        firstReactiveInputControllerDifferenceFrame:original.inputHashes.findIndex((h,i)=>h!==row.inputHashes[i]),
        newNonfiniteFailure:original.summary.finite&&!row.summary.finite,
        newDiagnosticFailure:row.summary.diagnosticMismatchFrames>0||row.summary.diagnosticErrors.length>0,
        newExcessivePelvisHeight:row.summary.maxPelvisHeightM.map((y,i)=>y>original.summary.maxPelvisHeightM[i]+tripwires.newPelvisHeightMarginM),
        excessiveBodySpeed:row.summary.maxBodySpeedMps>original.summary.maxBodySpeedMps*tripwires.bodySpeedFactor+tripwires.bodySpeedMarginMps,
        newJointGap:row.summary.maxJointGapM.map((g,i)=>g>original.summary.maxJointGapM[i]+tripwires.newJointGapMarginM),
        damageWoundDelta:row.damage.woundEvents-original.damage.woundEvents,
        newlyDeadComparedWithBaseline:row.damage.final.map((f,i)=>original.damage.final[i].alive&&!f.alive),
        note:'Death/damage differences alone are duel outcomes, not newly diagnosed implementation defects.'})),
      inputInterpretation:'Same external seed/config/time schedule and matched native/controller/AI/RNG preparation. Both real AI update through G.step; candidate physics can change reactive inputs and later RNG consumption. No forced same-input claim.'};
    const runtime=group.find(r=>r.mode==='runtimeFinalCap'),capped=group.find(r=>r.mode==='finalCap');
    if(runtime&&capped)comparison.runtimeFinalCapExact={trace:capped.traceSha256===runtime.traceSha256,inputController:capped.actualInputControllerSha256===runtime.actualInputControllerSha256,
      trialFlagExcludedFromPhysicalControllerTrace:'armTorqueModel only; separately recorded runtime property'};
    comparisons.push(comparison);
    if(!comparison.originalCloneTraceExact||!comparison.originalCloneActualInputControllerExact)throw Error('Mandatory original/clone exact gate failed');
    if(![comparison.preparedNativeExact,comparison.preparedControlExact,comparison.preparedAIExact,comparison.preparedInputControllerExact,comparison.preparedRngExact].every(Boolean))throw Error('Matched preparation gate failed');
  }
}catch(e){error=e.stack||String(e);}finally{await modules.cleanup();}
const sourceAfter=manifest(),sourceStable=JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter);
const report={schemaVersion:1,createdUTC:new Date().toISOString(),sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  command:`node tools/sim/experiments/arm_capacity_duel_probe.mjs --seconds=${seconds} --prepare=${prepare} --seeds=${seeds.join(',')} --modes=${modes.join(',')} --out=${output}`,
  configuration:{seconds,prepare,seeds,modes,pairs,AI:'actual imported AI on both fighters',walls:false,DT,gripReaction:CONFIG.GRIP.reactionModel,
    supportModel:CONFIG.BODY.supportModel,weightMode:CONFIG.BODY.weightMode,cutReactionModel:'ordinary legacy; not changed',
    externalSchedule:'Run ordinary two-AI G.step for prepare seconds, install on both fighters while ledger idle, then continue ordinary G.step for observation seconds.',
    runtimeSelection:'Optional --modes including runtimeFinalCap; runtimeFinalCap: after matched checkpoint assign armTorqueModel=sharedCap; runtimeFresh: constructor onFighter before first G.step. Both use actual Fighter.prototype methods with counting observers only.'},
  scope:modules.scope,tolerance,tripwires,sourceBefore,sourceAfter,sourceStable,actualRuntimeMethodHashes:{driveSword:sha(String(Fighter.prototype.driveSword)),manualMuscle:sha(String(Fighter.prototype.manualMuscle))},candidateSourceHashes:modules.sourceHashes,runs,comparisons,error,
  boundedEvidence:{periodicSampleHz:1,maxAnomalySamplesPerRun:24,maxDiagnosticMismatchSamplesPerRun:24,fullPerFrameRowsRetained:false,
    frameHashesRetained:true,traceCoverage:'All dynamic world bodies native position/orientation/COM/velocities/mass/principal inertia/user accumulators; selected fighter controls and own AI/skill/gait state, wounds and cutting records.'},
  limitations:['Torque and recipient power match actual observed addTorque calls; these exclude native elbow/offhand/spine motor work.',
    'Instant power*dt is left-endpoint explicit-actuator work approximation, not total physiological work or exact native energy closure.',
    'Same initial RNG state/output history and schedule do not imply same AI inputs after physical feedback diverges.',
    'Baseline-relative launch/speed/gap gates request review; cause must be inspected, and they are never gameplay control limits.',
    'Rendering/mobile input/play feel/naturalness and hardware performance are not assessed.']};
report.executionPass=sourceStable&&!error&&runs.length===pairs.length*seeds.length*modes.length&&runs.every(r=>r.executionPass)
  &&comparisons.every(c=>c.originalCloneTraceExact&&c.originalCloneActualInputControllerExact&&c.preparedNativeExact&&c.preparedControlExact&&c.preparedAIExact&&c.preparedInputControllerExact&&c.preparedRngExact
    &&(!c.runtimeFinalCapExact||c.runtimeFinalCapExact.trace&&c.runtimeFinalCapExact.inputController));
report.newFailureReview=comparisons.flatMap(c=>c.candidates.filter(x=>x.newNonfiniteFailure||x.newDiagnosticFailure||x.excessiveBodySpeed||x.newExcessivePelvisHeight.some(Boolean)||x.newJointGap.some(Boolean)).map(x=>({seed:c.seed,weapons:c.weapons,...x})));
report.pass=report.executionPass&&report.newFailureReview.length===0;
fs.mkdirSync(dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output,pass:report.pass,executionPass:report.executionPass,sourceStable,runs:runs.length,newFailureReview:report.newFailureReview,error}));
process.exitCode=report.pass?0:1;
