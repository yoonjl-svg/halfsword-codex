/** Actual-game screening for the unified swordsmanship controller.
 * Fixed seed and supplied gestures, original reactive enemy, no pose/health
 * injection. Run only after the director freezes the runtime source.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { newRound, DT, RAPIER, THREE, CONFIG, handPos } from '../harness_m.mjs';
import { installForceLedger } from '../force_ledger.mjs';
import { WEAPONS } from '../../../src/weapons.js';
import { CHARACTERS_BY_ID } from '../../../src/characters.js';
import { applyMotionAssist } from '../../../src/motion_assist.js';
import { applyMotionTiming, recordMotionTimingInput } from '../../../src/motion_timing.js';
import { applySwordAssistV2 } from '../../../src/sword_assist_v2.js';
import { applyBladeShapeTrial } from '../../../src/blade_shape_trial.js';
import { applySwordsmanship, recordSwordsmanshipInput } from '../../../src/swordsmanship.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const options = Object.fromEntries(process.argv.slice(2).map(arg => {
  const match = /^--(out|weapons|models|scene|ledger|extraObservers)=(.+)$/.exec(arg);
  assert(match, 'Use --out/--weapons/--models/--scene/--ledger/--extraObservers=value');
  return [match[1], match[2]];
}));
const out = options.out;
assert(out && path.isAbsolute(out) && !fs.existsSync(out) && !fs.existsSync(out+'.receipt.json'), 'Use a fresh absolute output and receipt path.');
const scene = options.scene ?? 'screen';
assert(['screen','smoke','live'].includes(scene));
const weapons = (options.weapons ?? (scene === 'smoke' ? Object.keys(WEAPONS).join(',') : 'qinggang,longsword')).split(',');
const models = (options.models ?? (scene === 'smoke' ? 'candidate' : 'reference,candidate')).split(',');
assert(weapons.length && weapons.every(x => Object.hasOwn(WEAPONS, x)) && new Set(weapons).size === weapons.length);
assert(models.length && models.every(x => ['reference','candidate'].includes(x)) && new Set(models).size === models.length);
for (const key of ['ledger','extraObservers']) assert(options[key] === undefined || ['true','false'].includes(options[key]));
const ledgerEnabled = options.ledger === undefined ? scene !== 'smoke' : options.ledger === 'true';
const extraObservers = options.extraObservers !== 'false';
const sha = x => createHash('sha256').update(x).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding:'utf8' }).trim();
const scan = dir => fs.readdirSync(path.join(root, dir), { withFileTypes:true }).flatMap(e => e.isDirectory() ? scan(dir+'/'+e.name) : e.name.endsWith('.js') ? [dir+'/'+e.name] : []);
const files = () => [...scan('src'), 'tools/sim/harness_m.mjs', 'tools/sim/force_ledger.mjs',
  'tools/sim/experiments/swordsmanship_probe.mjs', 'tools/sim/experiments/swordsmanship_probe.derive.mjs',
  'tools/sim/experiments/swordsmanship.test.mjs',
  'package-lock.json', 'node_modules/@dimforge/rapier3d-compat/rapier.mjs', 'node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'].sort();
const manifest = () => Object.fromEntries(files().map(f => [f, sha(fs.readFileSync(path.join(root, f)))]));
const sourceBefore = manifest(), sourceCommit = git('rev-parse','HEAD'), dirtyBefore = git('status','--porcelain');
const V = v => new THREE.Vector3(v.x,v.y,v.z), Q = q => new THREE.Quaternion(q.x,q.y,q.z,q.w);
const point = (b,p) => V(p).applyQuaternion(Q(b.rotation())).add(V(b.translation()));
function plain(v, depth=0, seen=new WeakSet()) {
  if (v == null || ['string','boolean'].includes(typeof v)) return v;
  if (typeof v === 'number') return Number.isFinite(v) ? v : { $number:String(v) };
  if (typeof v !== 'object' || depth > 7) return undefined;
  if (v.isVector2 || v.isVector3 || v.isQuaternion || v.isEuler) return v.toArray();
  if (seen.has(v)) return { $shared:true }; seen.add(v);
  if (Array.isArray(v)) return v.map(x => plain(x,depth+1,seen));
  return Object.fromEntries(Object.entries(v).filter(([k,x]) => !['f','fighter','foe','world','scene','R','raw','rawSet','profile','table'].includes(k) && typeof x !== 'function')
    .map(([k,x]) => [k,plain(x,depth+1,seen)]).filter(([,x]) => x !== undefined));
}
function control(f) {
  return {
    pad:f.handOffset.toArray(), raw:f.skill.aimRaw.toArray(), aim:f.skill.aim.toArray(), handBase:f.handBase?.slice() ?? null,
    bodyPose:{...f.bodyPose}, bodyWeight:f.bodyGuardWeight(), guardWeight:f.guardWeight(),
    legacyLevel:f.skill.level, autoGuard:f.skill.autoGuard,
    guard:{hand:f.guardPose.hand?.slice(),dir:f.guardPose.dir?.slice(),nearest:f.guardPose.nearest},
    assist:{model:f.swordsmanshipModel ?? f.swordAssistModel ?? 'legacy',state:plain(f.swordsmanshipState ?? f.swordAssistState ?? null)},
    input:{previousPad:f.skill.prev.toArray(),velocity:f.skill.vel.toArray(),anchor:f.skill.anchor.toArray(),aimVelocity:f.skill.aimVel.toArray(),follow:f.skill.follow.toArray(),
      swinging:f.skill.swinging,swings:f.skill.swings,lunge:f.skill.lunge,recovering:f.skill.recovering,cutPending:f.skill.cutPending},
    tap:plain(f.skill.tap),thrustWeight:f.skill.thrustPose.w,finish:{on:f.finish.on,weight:f.finish.amt},
    timing:{model:f.motionTimingModel ?? null,state:plain(f.motionTimingState ?? null)},
    joints:Object.fromEntries(f.joints.map(j => [j.name,{target:j.target.toArray(),k:j.k,d:j.d,max:j.max,gain:j.gain ?? 1,manual:!!j.manual}])),
  };
}
function health(f) {
  return {state:f.state,alive:f.alive,armed:f.armed,gripValid:!!f.gripJoint?.isValid(),limbs:{...f.limbs},armHealth:f.armHealth,
    muscle:f.muscle,vigor:f.vigor,pain:f.pain,blood:f.blood,consciousness:f.consciousness,wounds:f.wounds.map(w => ({part:w.part,type:w.type,severity:w.severity}))};
}
function physical(f, intent) {
  const sword=f.sword,axis=new THREE.Vector3(0,1,0).applyQuaternion(Q(sword.rotation())),omega=V(sword.angvel());
  const tip=f.bladePoint(1,new THREE.Vector3()),tipVelocity=V(sword.velocityAtPoint(tip)),hand=handPos(f),aim=f.debug.aim.clone();
  const gaps=Object.fromEntries(f.joints.filter(j => j.joint?.isValid()).map(j => [j.name,point(j.parent,j.joint.anchor1()).distanceTo(point(j.child,j.joint.anchor2()))]));
  for (const [name,j] of [['mainGrip',f.gripJoint],['offGrip',f.offGripJoint]]) if (j?.isValid()) gaps[name]=point(j.body1(),j.anchor1()).distanceTo(point(j.body2(),j.anchor2()));
  return {
    handWorld:hand.toArray(),handTargetWorld:f.handTarget.toArray(),handErrorM:hand.distanceTo(f.handTarget),aimWorld:aim.toArray(),aimErrorRad:axis.angleTo(aim),
    sword:{root:V(sword.translation()).toArray(),axis:axis.toArray(),omega:omega.toArray(),omegaRadps:omega.length(),axialOmegaRadps:omega.dot(axis),tip:tip.toArray(),tipVelocity:tipVelocity.toArray(),tipSpeedMps:tipVelocity.length(),
      intentProjectedTipSpeedMps:intent ? tipVelocity.dot(new THREE.Vector3(...intent)) : null},
    swordAxisForearmDot:axis.dot(new THREE.Vector3(1,0,0).applyQuaternion(Q(f.bodies.farmS.rotation()))),
    bodies:Object.fromEntries(['pelvis','chest','uarmS','farmS'].map(n => {const b=f.bodies[n];return [n,{position:V(b.translation()).toArray(),quaternion:Q(b.rotation()).toArray(),velocity:V(b.linvel()).toArray(),omega:V(b.angvel()).toArray()}];})),
    jointGapM:gaps,tiltDeg:f.tiltDeg(),support:Object.fromEntries(Object.entries(f.gait.legs).map(([k,l]) => [k,{stance:l.stance,N:l.N,soleY:l.soleY}])),
  };
}
function accounting(f, applied, before) {
  const clamped=new THREE.Vector2(...applied.pad);if(clamped.length()>CONFIG.WEAPON.reach)clamped.setLength(CONFIG.WEAPON.reach);
  const k=-Math.expm1(-DT*25),expected=clamped.toArray().map((v,i) => before.input.velocity[i]+((v-before.input.previousPad[i])/DT-before.input.velocity[i])*k);
  const state=f.swordsmanshipState ?? f.swordAssistState,generated=[state?.generatedDX ?? 0,state?.generatedDY ?? 0],step=Math.hypot(...generated);
  return {runtimeClampedUserPad:clamped.toArray(),generatedDelta:generated,generatedStepM:step,
    inputVelocityExpectedMps:expected,inputVelocityErrorMps:Math.hypot(...expected.map((v,i) => v-f.skill.vel.getComponent(i))),
    padAccountingErrorM:Math.hypot(...f.handOffset.toArray().map((v,i) => v-clamped.getComponent(i)-generated[i])),
    generatedWhileHeldOrActive:step>1e-12&&(applied.held||applied.active),
    generatedAndNewSwing:step>1e-12&&f.skill.swings>before.input.swings,
    generatedAndNewLunge:step>1e-12&&f.skill.lunge>before.input.lunge+1e-12,
  };
}

// Same nominal deltas in every paired row. The live pad may differ after a
// generated return; resetting it to the nominal would erase that behavior.
const schedule=[];let nominal=[.15,.10];
function phase(name, seconds, target, held=true, tap=false, move=0) {
  const start=nominal.slice(),ticks=Math.round(seconds/DT);
  for(let i=0;i<ticks;i++) {
    const next=start.map((v,k) => v+(target[k]-v)*(i+1)/ticks),delta=next.map((v,k) => v-nominal[k]);
    schedule.push({tick:schedule.length,id:schedule.length,timeS:schedule.length*DT,phase:name,nominal:next,delta,held,active:Math.hypot(...delta)>1e-5,tap:tap&&i===0,move});nominal=next;
  }
}
phase('ready',.5,[.15,.10]);
phase('side',.5,[.46,.08]);phase('sideHold',.4,[.46,.08]);
phase('releaseSide',1.8,[.46,.08],false);phase('reholdNoMove',.3,[.46,.08]);
phase('redirectHigh',.5,[.05,.44]);phase('highHold',.4,[.05,.44]);
phase('cut',.25,[.05,-.4]);phase('stopHeld',.3,[.05,-.4]);phase('reverse',.25,[.05,.44]);
phase('tap',.7,[.05,.44],false,true);
if(scene !== 'smoke') {
  phase('releaseHigh',1.8,[.05,.44],false);phase('reholdReady',.3,[.05,.44]);
  phase('diagonalPrepare',.6,[-.35,.4]);phase('diagonalCut',.25,[.35,-.4]);phase('diagonalStop',.3,[.35,-.4]);
  phase('diagonalReverse',.25,[-.35,.4]);phase('releaseFinal',1.2,[-.35,.4],false);
}
if(scene === 'live') {
  phase('approach',1.4,[-.35,.4],false,false,.5);
  phase('combatCut',.25,[.35,-.4]);phase('combatStop',.3,[.35,-.4]);phase('combatReverse',.25,[-.35,.4]);
  phase('combatTap',.7,[-.35,.4],false,true);phase('combatRelease',2,[-.35,.4],false);
}
function observers(G, box) {
  const undo=[],jointMeta=new Map(),sets=new Set(),counts={worldStepCalls:0,motorCalls:0,restored:false};
  for(const f of [G.player,G.enemy]) for(const j of [...f.joints.map(x => ({joint:x.joint,name:x.name})),{joint:f.uprightJoint,name:'upright'},{joint:f.gripJoint,name:'mainGrip'},{joint:f.offGripJoint,name:'offGrip'}]) {
    if(j.joint?.isValid()) {jointMeta.set(j.joint.handle,{owner:f.index,name:j.name});sets.add(j.joint.rawSet);}
  }
  const wrap=(object,name,make) => {
    if(typeof object?.[name]!=='function') return;
    const descriptor=Object.getOwnPropertyDescriptor(object,name),original=object[name],replacement=make(original);object[name]=replacement;assert.equal(object[name],replacement);
    undo.push(() => {assert.equal(object[name],replacement);if(descriptor)Object.defineProperty(object,name,descriptor);else delete object[name];});
  };
  for(const set of sets) for(const name of ['jointConfigureMotor','jointConfigureMotorPosition','jointConfigureMotorVelocity','jointConfigureMotorModel','jointSetMotorMaxForce']) wrap(set,name,original => function(...args) {
    const meta=jointMeta.get(args[0]);if(meta?.owner===0)box.motors.push({method:name,joint:meta.name,args:plain(args.slice(1))});counts.motorCalls++;return original.apply(this,args);
  });
  wrap(G.world,'step',original => function(...args) {counts.worldStepCalls++;return original.apply(this,args);});
  return {counts,restore(){for(const undoOne of undo.reverse())undoOne();counts.restored=true;}};
}
function ledgerReadout(frame) {
  if(!frame)return null;
  return {
    signedWorkApproxJ:frame.balance.forceWorkApproxJ,
    massPropertyChanges:frame.balance.massPropertyChanges,
    bodyOverrides:frame.operations.filter(x => x.owner===0&&['stateOverride','massOrGravityPropertyRequest','explicitImpulse'].includes(x.kind)).map(x => plain(x)),
    explicitTorqueCalls:frame.operations.filter(x => x.owner===0&&x.method==='addTorque'&&(x.path.includes('.manualMuscle')||x.path.includes('.driveSword')))
      .map(x => ({path:x.path,body:x.label,torque:[x.input.x,x.input.y,x.input.z],atCallPowerW:x.instantPowerAtCallW})),
    contacts:frame.physics.flatMap(s => s.contactsRaw),
    bodyProperties:frame.physics.at(-1)?.post.bodies.map(b => ({label:b.label,mass:b.mass,localCOM:b.localCom,principalI:b.inertia.principal,gravityScale:b.gravityScale})),
    forceBookMismatch:frame.physics.flatMap(s => s.forceBook.map(b => ({body:b.label,force:b.mismatchF,torque:b.mismatchT}))),
  };
}
const rows=[],comparisons=[],startedUTC=new Date().toISOString(),started=performance.now(),originalRandom=Math.random;
let error=null,fixturePass=false;
try {
  for(const weapon of weapons) for(const model of models) {
    let G,ledger,observer,row;
    try {
      const character=CHARACTERS_BY_ID.heinrich;
      G=newRound({seed:7,weapon,weapon2:'longsword',skill:weapon==='qinggang'?0:.7,
        gap:scene==='live'?undefined:14,walls:scene==='live'?undefined:false,
        look2:character.look,difficulty:character.ai.level,persona:{...character.ai.persona,school:'longsword'},
        onFighter:f => {
          if(f.index!==0)return;
          if(model==='candidate'&&!f.weapon.gun)f.onehandArmModel='manual';
          if(weapon!=='qinggang')return;
          f.onehandArmModel='manual';
          assert(applyMotionAssist({active:true,motionAssist:'weak'},f));
          assert(applyMotionTiming({active:true,comparison:'sword',motionTiming:'sequenced'},f));
          if(model==='reference')assert(applySwordAssistV2({active:true,comparison:'sword',swordAssist:'v2'},f));
        }});
      const f=G.player;
      f.skill.autoGuard=weapon!=='qinggang';
      if(weapon==='qinggang') {
        f.thrustEdgeModel='transported';assert(applyBladeShapeTrial({active:true,model:'profile'},f,RAPIER));
        G.combat.finishRuleModel='armorCausal';G.combat.finishRuleFighter=f;
      }
      // Main's first-ready setup has already run in newRound. This install is
      // still before any game or physics step and does not reset a native body.
      const installed=model==='candidate'?applySwordsmanship(f):null;
      if(model==='candidate')assert.equal(installed,weapon!=='pistol','Melee installs; pistol remains the legacy command path.');
      const creationNativeSHA256=sha(G.world.takeSnapshot()),creationControl=control(f);
      const inputHash=createHash('sha256'),appliedHash=createHash('sha256'),nativeHash=createHash('sha256');
      const box={motors:[]};
      if(ledgerEnabled)ledger=installForceLedger(G,{fighters:[f],maxSamples:0});
      if(extraObservers)observer=observers(G,box);
      let before=null,enemyInput=null,intent=null;
      G.before=() => {before=control(f);enemyInput={pad:G.enemy.handOffset.toArray(),aim:G.enemy.skill.aim.toArray(),move:G.enemy.move.toArray(),mode:G.ai.mode,phase:G.ai.phase};};
      row={weapon,model,scene,installed,creationNativeSHA256,creationControl,profile:plain(f.swordsmanshipState?.profile ?? null),frames:[],taps:[],wounds:[],
        fixtureChecks:{finite:true,completeSchedule:false,inputEventContract:true,oneWorldStepPerGameStep:true,...(scene==='screen'?{healthy:true,noOpponentContact:true}:{})},
        observations:{firstContactTimeS:null,firstUnhealthyTimeS:null,firstDeathTimeS:null}};
      rows.push(row);
      for(const request of schedule) {
        inputHash.update(JSON.stringify(request));box.motors=[];
        const acceptHand=f.alive&&!f.weapon.gun;
        if(acceptHand){f.handOffset.x+=request.delta[0];f.handOffset.y+=request.delta[1];}
        f.handHeld=request.held;f.inputActive=request.active;f.move.set(0,f.alive?request.move:0);f.stickX=0;f.stickY=f.alive?request.move:0;
        const event={id:request.id,timeS:request.timeS,dx:acceptHand?request.delta[0]:0,dy:acceptHand?request.delta[1]:0,held:request.held,active:request.active};
        const eventAccepted=model==='candidate'&&installed?recordSwordsmanshipInput(f,event):weapon==='qinggang'?recordMotionTimingInput(f,event):null;
        if((model==='candidate'&&installed)||weapon==='qinggang')row.fixtureChecks.inputEventContract&&=eventAccepted===true;
        const inputApplied={pad:f.handOffset.toArray(),held:f.handHeld,active:f.inputActive,move:f.move.toArray()};appliedHash.update(JSON.stringify(inputApplied));
        if(request.active&&acceptHand)intent=new THREE.Vector3(0,event.dy,event.dx).applyQuaternion(f.yaw).normalize().toArray();
        if(request.tap)row.taps.push({tick:request.tick,accepted:f.alive?f.skill.thrust():false,captured:plain(f.skill.tap)});
        const previousWorldSteps=observer?.counts.worldStepCalls ?? null;
        G.step();
        const nativeSHA256=sha(G.world.takeSnapshot());nativeHash.update(nativeSHA256+'\n');
        const finite=G.world.bodies.getAll().every(b => [b.translation(),b.rotation(),b.linvel(),b.angvel()].every(v => Object.values(v).every(Number.isFinite)));
        const h=health(f),healthy=h.alive&&h.armed&&h.gripValid&&h.state==='stand'&&h.wounds.length===0&&h.pain<=1e-12&&h.consciousness>=1-1e-12&&Object.values(h.limbs).every(v => v>=1-1e-12);
        const measured=ledgerReadout(ledger?.latest);
        const opponentContact=measured?measured.contacts.some(c => ((c.labelA?.startsWith('0:')&&c.labelB?.startsWith('1:'))||(c.labelA?.startsWith('1:')&&c.labelB?.startsWith('0:')))&&(c.solverPoints.length||c.impulses.length)):null;
        row.fixtureChecks.finite&&=finite;
        if(scene==='screen'){row.fixtureChecks.healthy&&=healthy;row.fixtureChecks.noOpponentContact&&=opponentContact===false;}
        if(ledger)row.fixtureChecks.oneWorldStepPerGameStep&&=ledger.latest.physics.length===1;
        if(observer)row.fixtureChecks.oneWorldStepPerGameStep&&=observer.counts.worldStepCalls===previousWorldSteps+1;
        if(opponentContact&&row.observations.firstContactTimeS===null)row.observations.firstContactTimeS=G.t;
        if(!healthy&&row.observations.firstUnhealthyTimeS===null)row.observations.firstUnhealthyTimeS=G.t;
        if(!h.alive&&row.observations.firstDeathTimeS===null)row.observations.firstDeathTimeS=G.t;
        row.frames.push({tick:request.tick,timeS:G.t,phase:request.phase,request,inputApplied,inputEvent:event,eventAccepted,intent,enemyInput,nativeSHA256,finite,healthy,opponentContact,
          control:control(f),physical:physical(f,intent),health:h,enemyHealth:health(G.enemy),accounting:accounting(f,inputApplied,before),nativeMotorRequests:box.motors,ledger:measured});
        if(!finite)break;
      }
      row.fixtureChecks.completeSchedule=row.frames.length===schedule.length;
      row.suppliedInputSHA256=inputHash.digest('hex');row.appliedInputSHA256=appliedHash.digest('hex');row.nativeTraceSHA256=nativeHash.digest('hex');
      row.wounds=G.wounds.map(w => ({callbackTimeS:w.t,attacker:w.att.index,victim:w.vic.index,zone:w.zone,type:w.type,severity:w.severity,energyJ:w.energy}));
      row.clashes=G.clashes;row.ledgerSummary=ledger?.summary() ?? null;row.observerCounts=observer?.counts ?? null;
      row.observations.generatedReturnFrames=row.frames.filter(x => x.accounting.generatedStepM>1e-12).length;
      row.observations.generatedWhileHeldOrActiveFrames=row.frames.filter(x => x.accounting.generatedWhileHeldOrActive).length;
      row.observations.generatedAndNewSwingFrames=row.frames.filter(x => x.accounting.generatedAndNewSwing).length;
      row.observations.generatedAndNewLungeFrames=row.frames.filter(x => x.accounting.generatedAndNewLunge).length;
      row.observations.maxVelocityAccountingErrorMps=Math.max(...row.frames.map(x => x.accounting.inputVelocityErrorMps));
      row.observations.maxPadAccountingErrorM=Math.max(...row.frames.map(x => x.accounting.padAccountingErrorM));
      console.log(JSON.stringify({weapon,model,scene,steps:row.frames.length,fixtureChecks:row.fixtureChecks,observations:row.observations,wounds:row.wounds.length,clashes:row.clashes}));
    } finally {
      const errors=[];
      for(const cleanup of [() => observer?.restore(),() => ledger?.restore(),() => G?.eventQueue.free(),() => G?.world.free()])try{cleanup();}catch(e){errors.push(e);}
      if(errors.length)throw new AggregateError(errors,'Probe cleanup failed');
    }
  }
  for(const weapon of weapons) {
    const a=rows.find(r => r.weapon===weapon&&r.model==='reference'),b=rows.find(r => r.weapon===weapon&&r.model==='candidate');if(!a||!b)continue;
    comparisons.push({weapon,creationNativeExact:a.creationNativeSHA256===b.creationNativeSHA256,suppliedInputExact:a.suppliedInputSHA256===b.suppliedInputSHA256,
      appliedInputExactObserved:a.appliedInputSHA256===b.appliedInputSHA256,nativeTraceExactObserved:a.nativeTraceSHA256===b.nativeTraceSHA256,
      meaning:'Paired whole-controller comparison. References differ by weapon: Qinggang public v2/body B; other weapons general legacy 0.7. Goals and generated return can intentionally differ.'});
  }
  fixturePass=rows.length===weapons.length*models.length&&rows.every(r => Object.values(r.fixtureChecks).every(Boolean))&&comparisons.every(c => c.creationNativeExact&&c.suppliedInputExact);
} catch(e) {error={name:e.name,message:e.message,stack:e.stack};process.exitCode=1;}
finally {
  Math.random=originalRandom;
  const sourceAfter=manifest(),sourceStable=JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter),headStable=sourceCommit===git('rev-parse','HEAD');fixturePass&&=sourceStable&&headStable;
  fs.mkdirSync(path.dirname(out),{recursive:true});
  const report={schemaVersion:1,probe:'swordsmanship',fixturePass,effectAccepted:false,error,sourceCommit,sourceBefore,sourceAfter,sourceStable,headStable,dirtyBefore,
    command:process.argv,startedUTC,completedUTC:new Date().toISOString(),wallSeconds:(performance.now()-started)/1000,executionCount:rows.length,dt:DT,
    protocol:{weapons,models,scene,seed:7,ledgerEnabled,extraObservers,gap:scene==='live'?'ARENA default':14,walls:scene==='live'?'ARENA default':false,
      referenceQinggang:'Existing public v2 + manual onehand + coordinated/sequenced body B, blade profile, transported thrust and armorCausal finish.',
      referenceOther:'General legacy level 0.7 and autoGuard true with native current weapon settings.',
      candidate:'Actual unified entry uses manual onehand policy before its initial ready setup; applySwordsmanship then runs before first game/physics step. Qinggang retains profile/transported/armorCausal; pistol installer must no-op.',
      input:'Same differential scripted pad requests, held/active state and explicit taps; one fresh event per physics step. No human-input equivalence or multi-render/substep invariance claim.'},
    scope:'Real Fighter/Skill/Gait/Combat/npm Rapier from spawn and original reactive opponent. No park, forced pose/health/state/velocity, solver setting or strength mutation. All-weapon smoke is unpaired compatibility screening, not efficacy proof.',
    definitions:{fixturePass:'Complete finite schedule, input API acceptance, one original world step, source/head stability and paired native creation/input equality. Screen additionally healthy and no opponent contact. No inferred naturalness, injury prevention, observer noninterference or goal efficacy.',
      raw:'Compact selection of actual controls, solved bodies, existing force ledger and native motor requests. Full engine snapshot is hashed each step, not retained; full legacy force raw is not regenerated.',
      accounting:'User velocity checked against original 25/s filter after reach clamp; controller-generated pad delta separate. Legacy auto-return has no generated ledger field and can show expected pad-accounting residual; candidate residual must be reviewed.',
      strength:'Joint k/d/max/gain, selected native requests and body mass properties are recorded. Equal parameters do not imply equal actual forces or trajectories.',
      observer:'Read wrappers call originals exactly once and restore finally. New observer noninterference is not independently replay-verified in this run; explicit extraObservers=false is available if the director requests it.'},
    schedule,scheduleSHA256:sha(JSON.stringify(schedule)),rows,comparisons};
  fs.writeFileSync(out,JSON.stringify(report)+'\n',{flag:'wx'});
  const bytes=fs.readFileSync(out);
  fs.writeFileSync(out+'.receipt.json',JSON.stringify({rawPath:out,rawBytes:bytes.length,rawSHA256:sha(bytes),sourceCommit,sourceStable,headStable,fixturePass,executionCount:rows.length,command:process.argv},null,2)+'\n',{flag:'wx'});
  if(!fixturePass)process.exitCode=1;
}
