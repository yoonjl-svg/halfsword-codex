/** Four fresh-round timing fixtures. Run only after the parent freezes runtime.
 * Existing npm game, unchanged force ledger, scripted player and original enemy.
 * Optional new read observers do not dispatch replacement Fighter controllers.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {newRound, DT, RAPIER, THREE, handPos} from '../harness_m.mjs';
import {installForceLedger} from '../force_ledger.mjs';
import {applyMotionAssist, MOTION_ASSIST} from '../../../src/motion_assist.js';
import {applyBladeShapeTrial} from '../../../src/blade_shape_trial.js';
import {CHARACTERS_BY_ID} from '../../../src/characters.js';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const opts=Object.fromEntries(process.argv.slice(2).map(arg=>{
  const m=/^--(out|weapons|models|extraObservers|scene)=(.+)$/.exec(arg);
  assert(m,'Use --out/--weapons/--models/--extraObservers/--scene=value');return [m[1],m[2]];
}));
const out=opts.out;
assert(out && path.isAbsolute(out) && !fs.existsSync(out) && !fs.existsSync(out+'.receipt.json'),'Use a fresh absolute --out path and receipt');
const weapons=(opts.weapons??'qinggang,sabre').split(',');
const models=(opts.models??'baseline,sequenced').split(',');
const extraObservers=opts.extraObservers!=='false';
const scene=opts.scene??'distant';assert(['distant','live'].includes(scene));
assert(weapons.length && weapons.every(w=>['qinggang','sabre'].includes(w)) && new Set(weapons).size===weapons.length);
assert(models.length && models.every(m=>['original','baseline','sequenced'].includes(m)) && new Set(models).size===models.length);
assert(opts.extraObservers===undefined || ['true','false'].includes(opts.extraObservers));
const sha=x=>createHash('sha256').update(x).digest('hex');
const scan=d=>fs.readdirSync(path.join(root,d),{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(d+'/'+e.name):e.name.endsWith('.js')?[d+'/'+e.name]:[]);
const sourceFiles=()=>[...scan('src'),'tools/sim/harness_m.mjs','tools/sim/force_ledger.mjs',
  'tools/sim/experiments/motion_assist_probe.mjs','tools/sim/experiments/motion_force_probe.mjs',
  'tools/sim/experiments/motion_force_probe.derive.mjs','package-lock.json',
  'node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'].sort();
const manifest=()=>Object.fromEntries(sourceFiles().map(f=>[f,sha(fs.readFileSync(path.join(root,f)))]));
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const sourceBefore=manifest(),sourceCommit=git('rev-parse','HEAD'),dirtyBefore=git('status','--porcelain');
const V=v=>new THREE.Vector3(v.x,v.y,v.z),Q=q=>new THREE.Quaternion(q.x,q.y,q.z,q.w);
const point=(b,v)=>V(v).applyQuaternion(Q(b.rotation())).add(V(b.translation()));
const plain=(value,depth=0,seen=new WeakSet())=>{
  if(value==null || ['string','boolean'].includes(typeof value))return value;
  if(typeof value==='number')return Number.isFinite(value)?value:{$number:String(value)};
  if(typeof value!=='object' || depth>8)return undefined;
  if(value.isVector2 || value.isVector3 || value.isQuaternion || value.isEuler)return value.toArray();
  if(seen.has(value))return {$shared:true};seen.add(value);
  if(Array.isArray(value))return value.map(x=>plain(x,depth+1,seen));
  return Object.fromEntries(Object.entries(value).filter(([k,v])=>!['f','fighter','foe','world','scene','R','raw','rawSet'].includes(k) && typeof v!=='function').map(([k,v])=>[k,plain(v,depth+1,seen)]).filter(([,v])=>v!==undefined));
};
function timing(f) {
  const stateKey=['motionTimingState','motionTiming','timingState'].find(k=>f[k]!==undefined);
  return {model:f.motionTimingModel,stateKey:stateKey??null,state:stateKey?plain(f[stateKey]):null,
    refs:plain(f.motionTimingState?.targetRefs??f.motionTimingRefs??f.motionTimingTargets??f.timingRefs??null)};
}
function controls(f) {
  return {pad:f.handOffset.toArray(),raw:f.skill.aimRaw.toArray(),aim:f.skill.aim.toArray(),follow:f.skill.follow.toArray(),
    held:f.handHeld??false,active:f.inputActive??false,move:f.move.toArray(),handBase:f.handBase?.slice()??null,
    bodyPose:{...f.bodyPose},bodyPoseVelocity:{...f.bodyPoseVel},bodyWeight:f.bodyGuardWeight(),guardWeight:f.guardWeight(),
    jointTargetRefs:Object.fromEntries(f.joints.map(j=>[j.name,{target:j.target.toArray(),prevTarget:j.prevTarget?.toArray()??null,prevRotationVector:j.prevRV?.toArray()??null,k:j.k,d:j.d,max:j.max,gain:j.gain??1,manual:!!j.manual}])),
    timing:timing(f),finish:{on:f.finish.on,weight:f.finish.amt},tap:plain(f.skill.tap),thrustWeight:f.skill.thrustPose.w};
}
function health(f) {
  return {state:f.state,alive:f.alive,armed:f.armed,gripValid:!!f.gripJoint?.isValid(),armHealth:f.armHealth,legHealth:f.legHealth,
    limbs:{...f.limbs},muscle:f.muscle,vigor:f.vigor,pain:f.pain,blood:f.blood,consciousness:f.consciousness,
    wounds:f.wounds.map(w=>({part:w.part,type:w.type,severity:w.severity}))};
}
function physical(f,intent,previousBlade) {
  const sword=f.sword,blade=new THREE.Vector3(0,1,0).applyQuaternion(Q(sword.rotation())),omega=V(sword.angvel());
  const tip=f.bladePoint(1,new THREE.Vector3()),tipVelocity=V(sword.velocityAtPoint(tip));
  const direction=intent?new THREE.Vector3(...intent.directionWorld):null;
  const gaps=Object.fromEntries(f.joints.filter(j=>j.joint?.isValid()).map(j=>[j.name,point(j.parent,j.joint.anchor1()).distanceTo(point(j.child,j.joint.anchor2()))]));
  if(f.gripJoint?.isValid())gaps.mainGrip=point(f.gripJoint.body1(),f.gripJoint.anchor1()).distanceTo(point(f.gripJoint.body2(),f.gripJoint.anchor2()));
  const hand=handPos(f),aim=f.debug.aim.clone();
  return {actualBodies:Object.fromEntries(['pelvis','chest','uarmS','farmS'].map(n=>{const b=f.bodies[n];return [n,{position:V(b.translation()).toArray(),quaternion:Q(b.rotation()).toArray(),velocity:V(b.linvel()).toArray(),omega:V(b.angvel()).toArray()}];})),
    sword:{root:V(sword.translation()).toArray(),tip:tip.toArray(),quaternion:Q(sword.rotation()).toArray(),axis:blade.toArray(),omega:omega.toArray(),
      omegaMagnitudeRadps:omega.length(),axialOmegaRadps:omega.dot(blade),axisAngularChangeRad:previousBlade?blade.angleTo(previousBlade):null,
      axisAngularSpeedRadps:previousBlade?blade.angleTo(previousBlade)/DT:null,tipVelocity:tipVelocity.toArray(),tipSpeedMps:tipVelocity.length(),
      signedIntentDirectionTipSpeedMps:direction?tipVelocity.dot(direction):null},
    handWorld:hand.toArray(),handTargetWorld:f.handTarget.toArray(),handErrorM:hand.distanceTo(f.handTarget),aimWorld:aim.toArray(),aimErrorRad:blade.angleTo(aim),
    gaps,tiltDeg:f.tiltDeg(),support:Object.fromEntries(Object.entries(f.gait.legs).map(([k,l])=>[k,{stance:l.stance,N:l.N,soleY:l.soleY}]))};
}

// Original macro through releaseCross, unchanged values/durations; add a paired
// diagonal cut/stop/reverse/recut from one explicit preparation.
const schedule=[];let nominal=[.15,.1];
function phase(name,seconds,target,held=true,tap=false,move=0) {
  const start=nominal.slice(),ticks=Math.round(seconds/DT);
  for(let i=0;i<ticks;i++){
    const next=start.map((v,k)=>v+(target[k]-v)*(i+1)/ticks),delta=next.map((v,k)=>v-nominal[k]);
    schedule.push({tick:schedule.length,id:schedule.length,timeS:schedule.length*DT,phase:name,nominal:next,delta,held,
      active:Math.hypot(...delta)>1e-5,tap:tap&&i===0,move});nominal=next;
  }
}
phase('ready',1,[.15,.1]);phase('slowRaise',.8,[.10,.45]);phase('cut',.25,[.10,-.45]);phase('stop',.3,[.10,-.45]);
phase('reverse',.25,[.10,.45]);phase('tap',.6,[.10,.45],false,true);phase('recut',.25,[-.35,-.42]);phase('release',.8,[-.35,-.42],false);
phase('crossPrepare',.7,[-.42,.03]);phase('crossCut',.25,[.42,.03]);phase('heldStop',.7,[.42,.03]);phase('releaseCross',.6,[.42,.03],false);
phase('diagonalPrepare',.7,[-.35,.42]);phase('diagonalCut',.25,[.35,-.42]);phase('diagonalStop',.3,[.35,-.42]);
phase('diagonalReverse',.25,[-.35,.42]);phase('diagonalRecut',.25,[.35,-.42]);phase('diagonalRelease',.6,[.35,-.42],false);
if(scene==='live'){
  // Existing live macro, after the unchanged paired screening/diagonal prefix.
  phase('lower',.7,[.1,-.45]);phase('slowReturn',.8,[.15,.1]);phase('tapAgain',.6,[.15,.1],false,true);
  phase('approach',1.4,[.15,.1],false,false,.5);phase('combatRaise',.7,[.10,.45]);phase('combatCut',.25,[.10,-.45]);
  phase('combatStop',.3,[.10,-.45]);phase('combatReverse',.25,[.10,.45]);phase('combatTap',.6,[.10,.45],false,true);
  phase('combatRecut',.25,[-.35,-.42]);phase('finalRelease',1.2,[-.35,-.42],false);
}

// Adds read observers only. Each intercepted call invokes its original once.
function installExtraObservers(G,frame) {
  const undo=[],counts={worldStepOriginalCalls:0,nativeOriginalCalls:0,restorationPass:false},jointMeta=new Map(),rawSets=new Set();
  for(const f of [G.player,G.enemy])for(const j of [...f.joints.map(x=>({joint:x.joint,name:x.name})),{joint:f.uprightJoint,name:'upright'},{joint:f.gripJoint,name:'mainGrip'},{joint:f.offGripJoint,name:'offGrip'}]) {
    if(!j.joint?.isValid())continue;jointMeta.set(j.joint.handle,{owner:f.index,name:j.name});rawSets.add(j.joint.rawSet);
  }
  function wrap(object,name,make) {
    if(typeof object?.[name]!=='function')return;
    const descriptor=Object.getOwnPropertyDescriptor(object,name),original=object[name],wrapper=make(original);
    object[name]=wrapper;assert.equal(object[name],wrapper,'Observer must own its wrapper');
    undo.push(()=>{assert.equal(object[name],wrapper,'Observer replacement changed during fixture');if(descriptor)Object.defineProperty(object,name,descriptor);else delete object[name];});
  }
  for(const raw of rawSets)for(const name of ['jointConfigureMotor','jointConfigureMotorPosition','jointConfigureMotorVelocity','jointConfigureMotorModel','jointSetMotorMaxForce'])wrap(raw,name,original=>function(...args){
    const meta=jointMeta.get(args[0]);if(meta?.owner===0)frame.nativeRequests.push({method:name,joint:meta.name,handle:String(args[0]),arguments:plain(args)});
    counts.nativeOriginalCalls++;return original.apply(this,args);
  });
  wrap(G.world,'step',original=>function(...args){frame.preSolver=controls(G.player);counts.worldStepOriginalCalls++;return original.apply(this,args);});
  return {counts,restore(){for(const fn of undo.reverse())fn();counts.restorationPass=true;}};
}
const isPlayerPath=e=>e.owner===0 && e.method==='addTorque' && (e.path.includes('.manualMuscle') || e.path.includes('.driveSword'));
function ledgerReadout(frame) {
  return {balance:frame.balance,physics:frame.physics.map(s=>({dt:s.dt,preTotal:s.pre.total,postTotal:s.post.total,
    selectedPreBodies:s.pre.bodies.filter(b=>['pelvis','chest','uarmS','farmS','sword'].includes(b.part)),
    selectedPostBodies:s.post.bodies.filter(b=>['pelvis','chest','uarmS','farmS','sword'].includes(b.part)),
    explicitPathWork:Object.fromEntries(Object.entries(s.balance.byPath).filter(([p])=>p.includes('.manualMuscle') || p.includes('.driveSword'))),contactsRaw:s.contactsRaw})),
    explicitShoulderWristTorqueCalls:frame.operations.filter(isPlayerPath),
    stateOverridesAndMassRequests:frame.operations.filter(e=>['stateOverride','massOrGravityPropertyRequest','explicitImpulse'].includes(e.kind)),
    forceBookMismatch:frame.physics.map(s=>s.forceBook.map(b=>({label:b.label,forceMismatch:b.mismatchF,torqueMismatch:b.mismatchT})))};
}
const rows=[],comparisons=[],startedUTC=new Date().toISOString(),started=performance.now(),random=Math.random;
let error=null,fixturePass=false,executions=0;
try {
  const {recordMotionTimingInput,applyMotionTiming}=await import('../../../src/motion_timing.js');
  assert.equal(typeof recordMotionTimingInput,'function','Timing input contract is required before running');
  assert.equal(typeof applyMotionTiming,'function','Timing installation contract is required before running');
  for(const weapon of weapons)for(const model of models){
    let G,ledger,extra,row;
    try{
      const character=CHARACTERS_BY_ID.heinrich;
      G=newRound({seed:7,weapon,weapon2:'longsword',skill:0,gap:scene==='distant'?14:undefined,walls:scene==='distant'?false:undefined,look2:character.look,difficulty:character.ai.level,
        persona:{...character.ai.persona,school:'longsword'},onFighter:f=>{
          if(f.index!==0)return;f.onehandArmModel='manual';
          if(weapon==='qinggang')assert(applyMotionAssist({active:true,motionAssist:'weak'},f));
          else {f.motionAssistModel='coordinated';f.motionAssistStrength=MOTION_ASSIST.strength;} // isolated research, no public sabre support
          if(model==='original')return; // existing B: no timing model/state attributes or input recorder
          const info={active:true,comparison:'force',motionTiming:model};
          if(weapon==='qinggang')assert(applyMotionTiming(info,f));
          else {
            // Same helper initializes the same state schema on a temporary JS
            // eligibility view. Transfer only timing state/model; the actual
            // fighter, shared weapon definition, geometry and native body stay.
            const view=Object.create(f);
            Object.defineProperty(view,'weapon',{value:{...f.weapon,id:'qinggang'}});
            assert(applyMotionTiming(info,view));
            f.motionTimingModel=view.motionTimingModel;f.motionTimingState=view.motionTimingState;
          }
        }});
      const f=G.player;f.skill.autoGuard=false;f.thrustEdgeModel='transported';
      if(weapon==='qinggang')assert(applyBladeShapeTrial({active:true,model:'profile'},f,RAPIER));
      G.combat.finishRuleModel='armorCausal';G.combat.finishRuleFighter=f;
      const creationNative=sha(G.world.takeSnapshot()),creation=controls(f),inputHash=createHash('sha256'),actualInputHash=createHash('sha256'),nativeHash=createHash('sha256');
      const observerFrame={nativeRequests:[],preSolver:null};ledger=installForceLedger(G,{fighters:[f],maxSamples:0});
      if(extraObservers)extra=installExtraObservers(G,observerFrame);
      let beforeFighter=null,previousBlade=null,intent=null;
      G.before=()=>{beforeFighter={player:controls(f),enemyInput:{pad:G.enemy.handOffset.toArray(),aim:G.enemy.skill.aim.toArray(),move:G.enemy.move.toArray()},enemyAI:{mode:G.ai.mode,phase:G.ai.phase,why:G.ai.why}};};
      row={scene,weapon,model,creationNative,creation,researchSabreActivation:weapon==='sabre',timingContract:model==='original'?'Original B: no timing attributes installed, record API not called':'Helper-installed timing state; one input record per supplied event',frames:[],taps:[],wounds:[],fixtureChecks:{finite:true,timingInputAccepted:true,oneWorldStepPerGameStep:true,...(scene==='distant'?{playerHealthy:true,noOpponentContact:true}:{})},observations:{allFramesPlayerHealthy:true,noOpponentContact:true,firstOpponentContactTimeS:null,firstUnhealthyTimeS:null},observerMode:extraObservers?'ledger_plus_native_target_observers':'ledger_without_native_target_observers'};
      rows.push(row);executions++;
      for(const request of schedule){
        inputHash.update(JSON.stringify(request));observerFrame.nativeRequests=[];observerFrame.preSolver=null;
        const inputBefore=f.handOffset.toArray();if(f.alive){f.handOffset.x+=request.delta[0];f.handOffset.y+=request.delta[1];}
        f.handHeld=request.held;f.inputActive=request.active;f.move.set(0,request.move);f.stickX=0;f.stickY=request.move;
        const event={id:request.id,timeS:request.timeS,dx:request.delta[0],dy:request.delta[1],held:request.held,active:request.active};
        const recordResult=model==='original'?null:recordMotionTimingInput(f,event); // supplied once per new event, before original G.step
        row.fixtureChecks.timingInputAccepted&&=model==='original'?(f.motionTimingModel===undefined&&f.motionTimingState===undefined):recordResult===true;
        const inputApplied={pad:f.handOffset.toArray(),held:f.handHeld,active:f.inputActive,move:f.move.toArray()};actualInputHash.update(JSON.stringify(inputApplied));
        if(request.active){const d=new THREE.Vector3(0,request.delta[1],request.delta[0]).applyQuaternion(f.yaw).normalize();intent={eventId:request.id,directionWorld:d.toArray(),meaning:'Last nonzero supplied planar-hand direction; retained for residual-motion readout, not permission to keep driving'};}
        if(request.tap)row.taps.push({tick:request.tick,accepted:f.skill.thrust(),h0:f.skill.tap?.h0?.slice()??null,handBase:f.handBase?.slice()??null});
        G.step();
        const native=sha(G.world.takeSnapshot());nativeHash.update(native+'\n');
        const nativeFinite=G.world.bodies.getAll().every(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].every(v=>Object.values(v).every(Number.isFinite)));
        const h=health(f),healthy=h.alive&&h.armed&&h.gripValid&&h.state==='stand'&&h.wounds.length===0&&h.pain<=1e-12&&Object.values(h.limbs).every(v=>v>=1-1e-12)&&h.consciousness>=1-1e-12;
        const observedLedger=ledgerReadout(ledger.latest),opponentContact=observedLedger.physics.some(s=>s.contactsRaw.some(c=>
          (c.labelA?.startsWith('0:')&&c.labelB?.startsWith('1:') || c.labelA?.startsWith('1:')&&c.labelB?.startsWith('0:')) && (c.solverPoints.length || c.impulses.length)));
        row.fixtureChecks.finite&&=nativeFinite;
        if(scene==='distant'){row.fixtureChecks.playerHealthy&&=healthy;row.fixtureChecks.noOpponentContact&&=!opponentContact;}
        row.observations.allFramesPlayerHealthy&&=healthy;row.observations.noOpponentContact&&=!opponentContact;
        if(opponentContact&&row.observations.firstOpponentContactTimeS===null)row.observations.firstOpponentContactTimeS=G.t;
        if(!healthy&&row.observations.firstUnhealthyTimeS===null)row.observations.firstUnhealthyTimeS=G.t;
        row.fixtureChecks.oneWorldStepPerGameStep&&=ledger.latest.physics.length===1;
        const actual=physical(f,intent,previousBlade);previousBlade=new THREE.Vector3(...actual.sword.axis);
        row.frames.push({tick:request.tick,timeS:G.t,phase:request.phase,request,inputBefore,inputApplied,timingInputEvent:event,timingInputResult:plain(recordResult),intent,
          nativeSHA256:native,nativeFinite,playerHealthy:healthy,opponentContact,beforeFighter,preSolver:observerFrame.preSolver,postControl:controls(f),health:h,enemyHealth:health(G.enemy),actual,
          nativeMotorRequests:observerFrame.nativeRequests,ledger:observedLedger});
        if(!nativeFinite)break;
      }
      row.inputSHA256=inputHash.digest('hex');row.appliedInputSHA256=actualInputHash.digest('hex');row.nativeTraceSHA256=nativeHash.digest('hex');
      row.wounds=G.wounds.map(w=>({callbackTimeS:w.t,attacker:w.att.index,victim:w.vic.index,zone:w.zone,type:w.type,severity:w.severity,energyJ:w.energy}));
      row.clashes=G.clashes;row.ledgerSummary=ledger.summary();row.extraObserverCounts=extra?.counts??null;
      row.fixtureChecks.completeSchedule=row.frames.length===schedule.length;
      console.log(JSON.stringify({scene,weapon,model,steps:row.frames.length,fixtureChecks:row.fixtureChecks,observations:row.observations,clashes:row.clashes,wounds:row.wounds.length}));
    }finally{
      const cleanupErrors=[];
      for(const clean of [()=>extra?.restore(),()=>ledger?.restore(),()=>G?.eventQueue.free(),()=>G?.world.free()])try{clean();}catch(e){cleanupErrors.push(e);}
      if(cleanupErrors.length)throw new AggregateError(cleanupErrors,'Fixture cleanup failed');
    }
  }
  for(const weapon of weapons){
    const group=rows.filter(r=>r.weapon===weapon),base=group.find(r=>r.model==='baseline'),candidate=group.find(r=>r.model==='sequenced');
    if(!base||!candidate)continue;
    const inputExact=base.frames.length===candidate.frames.length && base.frames.every((a,i)=>{
      const b=candidate.frames[i];return JSON.stringify(a.inputApplied)===JSON.stringify(b.inputApplied) &&
        ['pad','raw','aim','follow','held','active','move','handBase'].every(k=>JSON.stringify(a.postControl[k])===JSON.stringify(b.postControl[k]));
    });
    comparisons.push({weapon,creationNativeExact:base.creationNative===candidate.creationNative,suppliedInputHashExact:base.inputSHA256===candidate.inputSHA256,
      appliedInputHashExact:base.appliedInputSHA256===candidate.appliedInputSHA256,playerRawAimHandBaseTraceExact:inputExact,
      bodyWeightTraceExact:base.frames.length===candidate.frames.length&&base.frames.every((a,i)=>a.postControl.bodyWeight===candidate.frames[i].postControl.bodyWeight)});
  }
  fixturePass=rows.length===weapons.length*models.length && rows.every(r=>Object.values(r.fixtureChecks).every(Boolean)) && comparisons.every(c=>scene==='distant'?Object.entries(c).every(([k,v])=>k==='weapon'||v===true):c.creationNativeExact&&c.suppliedInputHashExact);
}catch(e){error={name:e.name,message:e.message,stack:e.stack};process.exitCode=1;}
finally{
  Math.random=random;const sourceAfter=manifest(),sourceStable=JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter),headStable=sourceCommit===git('rev-parse','HEAD');
  fixturePass&&=sourceStable&&headStable;
  fs.mkdirSync(path.dirname(out),{recursive:true});
  const report={schemaVersion:1,probe:'motion_force_timing',fixturePass,effectAccepted:false,error,sourceCommit,sourceBefore,sourceAfter,sourceStable,headStable,dirtyBefore,
    command:process.argv,startedUTC,completedUTC:new Date().toISOString(),wallSeconds:(performance.now()-started)/1000,executionCount:executions,dt:DT,
    protocol:{weapons,models,seed:7,scene,gap:scene==='distant'?14:'ARENA.startGap',walls:scene==='distant'?false:'ARENA default walls',playerSkill:0,playerAutoGuard:false,playerOnehandArm:'manual',motionAssistModel:'coordinated',motionAssistStrength:.15,
      playerTimingModels:{original:'No timing attributes or record API',baseline:'none, helper-installed observation state',sequenced:'sequenced, helper-installed state'},opponent:'Original reactive Heinrich AI, forced longsword as existing motion_assist fixture',extraObservers,sabre:'Internal research activation only; no public sabre support'},
    observerContract:{forceLedger:'Unchanged force_ledger.mjs reused; no automatic old-ledger noninterference reruns',newObservers:'Native motor requests and pre-solver target reads, originals called once, restored finally',
      noninterference:'Not independently replay-verified in this batch; --extraObservers=false supports an explicit parent-authorized check. No automatic extra physics runs.'},
    definitions:{fixturePass:'Distant: complete finite healthy no-opponent-contact fixtures with same per-weapon creation/input/raw aim/handBase/bodyWeight. Live: complete finite fixtures with same creation and supplied input; wounds, states and reactive input divergence remain observations. Both require input API, one world step and source/head stability. No observer noninterference, efficacy or naturalness certification.',
      torque:'Final explicit addTorque calls and application-body reactions, including transported/gravity/twist requests in original path; no inferred native motor impulse.',
      work:'Unchanged ledger midpoint approximate signed work; excludes native motor/constraint/contact/upright work and energy insertion. Residual is not error or efficiency.',
      contact:'Last native manifold impulse entries and separate solver world points. Relative point speeds are observations, not load-certified slip/COP or calibrated tangential work.',
      intentSpeed:'Actual sword-tip world velocity projected onto last nonzero planar hand-input direction. A local motion proxy; higher speed alone is not force-transfer acceptance.',
      eventTiming:'One fresh physics-time event per step, event id/time preserved. Human/render event-spacing/substep reuse requires a separate explicit regression; no frame-rate invariance claim.'},
    scope:'Actual npm Rapier from spawn, manual scripted player/original reactive opponent. Default distant open-floor gap14 healthy control; optional live default gap/walls retains native contacts and appends the existing approach/combat macro. No park, forced health/state/pose/velocity or solver/gain changes. Optional original row checks absence of timing attributes. Both timing groups use same existing .15 assistance. Contact/state/AI divergence prevents victory or injury-prevention claims; scripted physics inputs do not establish human input equivalence.',
    schedule,scheduleSHA256:sha(JSON.stringify(schedule)),rows,comparisons};
  fs.writeFileSync(out,JSON.stringify(report)+'\n',{flag:'wx'}); // Same JSON contract; avoid repeated indentation in large raw books.
  const bytes=fs.readFileSync(out);fs.writeFileSync(out+'.receipt.json',JSON.stringify({rawPath:out,rawBytes:bytes.length,rawSHA256:sha(bytes),sourceCommit,probeSHA256:sourceBefore['tools/sim/experiments/motion_force_probe.mjs'],command:process.argv,fixturePass,sourceStable,headStable,executionCount:executions},null,2)+'\n',{flag:'wx'});
  if(!fixturePass)process.exitCode=1;
}
