// Actual harness stroke observations. No force/controller reimplementation or freezing.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { newRound, THREE, CONFIG, DT, handPos } from './harness_m.mjs';
import { isMain } from './is_main.mjs';

const V = v => new THREE.Vector3(v.x, v.y, v.z);
const Q = q => new THREE.Quaternion(q.x, q.y, q.z, q.w);
const xyz = v => ({ x: v.x, y: v.y, z: v.z });
const sha = text => createHash('sha256').update(text).digest('hex');
const HIGH = [0.02, 0.52], LOW = [0.02, -0.45];

function bodyState(b) {
  return { positionM: xyz(b.translation()), orientation: { ...b.rotation() }, velocityMps: xyz(b.linvel()), angularVelocityRadps: xyz(b.angvel()), massKg: b.mass() };
}
function energy(b) {
  const w = V(b.angvel()).applyQuaternion(Q(b.rotation()).multiply(Q(b.principalInertiaLocalFrame())).invert());
  const I = b.principalInertia();
  return { translationJ: 0.5 * b.mass() * V(b.linvel()).lengthSq(), rotationJ: 0.5 * (I.x * w.x ** 2 + I.y * w.y ** 2 + I.z * w.z ** 2), potentialJ: -CONFIG.PHYSICS.gravity * b.mass() * b.worldCom().y };
}
function physicalControlState(f) {
  return { bodies: Object.fromEntries([...Object.entries(f.bodies), ['sword', f.sword]].map(([n,b]) => [n,bodyState(b)])),
    state: f.state, stateTime: f.stateTime, handOffset: f.handOffset.toArray(), handHeld: f.handHeld,
    skill: { aim: f.skill.aim.toArray(), aimRaw: f.skill.aimRaw.toArray(), aimVel: f.skill.aimVel.toArray(), follow: f.skill.follow.toArray(), anchor: f.skill.anchor.toArray(), activity: f.skill.activity, recovering: f.skill.recovering },
    bodyPose: { ...f.bodyPose }, bodyPoseVel: { ...f.bodyPoseVel }, heading: f.heading,
    wristBrake: f.wristBrake ?? false, wristHill: f.wristHill ?? null, prevAim: f.prevAim?.toArray() ?? null,
    joints: f.joints.map(j => ({ name: j.name, target: j.target?.toArray(), prevTarget: j.prevTarget?.toArray(), prevRV: j.prevRV?.toArray(), gain: j.gain ?? 1 })),
    gait: { levH: f.gait.levH, levC: f.gait.levC, handU: f.gait.handU } };
}
function finite(f) {
  for (const b of [...Object.values(f.bodies), f.sword]) for (const v of [b.translation(), b.rotation(), b.linvel(), b.angvel()]) {
    if (!Object.values(v).every(Number.isFinite)) throw new Error('nonfinite actual body state');
  }
}
function finiteNumbers(value) {
  if(typeof value==='number'&&!Number.isFinite(value))throw new Error('nonfinite observed value');
  if(value&&typeof value==='object')for(const child of Object.values(value))finiteNumbers(child);
}
function angle(a,b) { return Math.acos(Math.max(-1,Math.min(1,a.dot(b)))); }
function ledgerObservations() {
  return {frames:0,offHandFrames:0,offHandForceMagnitudeSumN:0,offHandTorqueMagnitudeSumNm:0,offHandTorqueSquareSumNm2:0,offHandForceMaxN:0,offHandTorqueMaxNm:0,
    offHandSignedWorkApproxJ:0,torsoExplicitWorkApproxJ:0,torsoArmReactionWorkApproxJ:0,torsoBalanceWorkApproxJ:0};
}
function accumulateLedger(book,latest) {
  if(!latest)return;
  for(const frame of latest.physics??[]) {
    const dt=frame.dt??DT;book.frames++;
    let force=new THREE.Vector3(),torque=new THREE.Vector3(),found=false;
    for(const [path,p] of Object.entries(frame.balance?.byPath??{})) {
      if(path.includes('offHand')){found=true;force.add(V(p.forceImpulse).divideScalar(dt));torque.add(V(p.angularImpulse).divideScalar(dt));book.offHandSignedWorkApproxJ+=p.workApproxJ;}
      for(const [label,b] of Object.entries(p.bodies??{}))if(/^0:(pelvis|abdomen|chest)$/.test(label)) {
        book.torsoExplicitWorkApproxJ+=b.workApproxJ;
        if(path.includes('driveSword')||path.includes('manualMuscle'))book.torsoArmReactionWorkApproxJ+=b.workApproxJ;
        if(path.includes('driveBalance'))book.torsoBalanceWorkApproxJ+=b.workApproxJ;
      }
    }
    if(found){const fn=force.length(),tn=torque.length();book.offHandFrames++;book.offHandForceMagnitudeSumN+=fn;book.offHandTorqueMagnitudeSumNm+=tn;book.offHandTorqueSquareSumNm2+=tn*tn;book.offHandForceMaxN=Math.max(book.offHandForceMaxN,fn);book.offHandTorqueMaxNm=Math.max(book.offHandTorqueMaxNm,tn);}
  }
}
function finishLedger(book) {
  const n=book.offHandFrames;
  return {...book,offHandForceMeanMagnitudeN:n?book.offHandForceMagnitudeSumN/n:null,offHandTorqueMeanMagnitudeNm:n?book.offHandTorqueMagnitudeSumNm/n:null,
    offHandTorqueRmsNm:n?Math.sqrt(book.offHandTorqueSquareSumNm2/n):null,
    definition:'offHand net wrench from observed byPath impulse/dt about ledger fixed origin; signed work midpoint quadrature; torso work covers explicit forces/torques only, native trunk joint/motor work unmeasured'};
}
function sample(f,timeS,phase) {
  const sword = f.sword, axis = new THREE.Vector3(0,1,0).applyQuaternion(Q(sword.rotation()));
  const tip = f.bladePoint(1,new THREE.Vector3()), hand = handPos(f);
  const pommel = new THREE.Vector3(0,f.weaponCfg.gripAlong,0).applyQuaternion(Q(sword.rotation())).add(V(sword.translation()));
  const offHand = new THREE.Vector3(0,-0.135,0).applyQuaternion(Q(f.bodies.farmO.rotation())).add(V(f.bodies.farmO.translation()));
  const E = energy(sword), bodyE = Object.fromEntries(Object.entries(f.bodies).map(([n,b])=>[n,energy(b)]));
  return { timeS, phase, state: f.state, handHeld: f.handHeld, inputActive: f.inputActive,
    handOffsetM: f.handOffset.toArray(), filteredAimM: f.skill.aim.toArray(), rawAimM: f.skill.aimRaw.toArray(),
    bodyPose: { ...f.bodyPose }, pelvis: bodyState(f.bodies.pelvis), chest: bodyState(f.bodies.chest), sword: bodyState(sword),
    swordEnergy: E, bodyEnergy: bodyE, actualBodyMassKg: Object.values(f.bodies).reduce((a,b)=>a+b.mass(),0),
    tipWorldM: xyz(tip), tipVelocityMps: xyz(sword.velocityAtPoint(tip)), tipSpeedMps: V(sword.velocityAtPoint(tip)).length(),
    bladeAxisWorld: xyz(axis), desiredBladeAxisWorldFromPreStep: xyz(f.debug.aim), bladeAimErrorRad: angle(axis,f.debug.aim.clone().normalize()),
    actualHandWorldM: xyz(hand), desiredHandWorldMFromPreStep: xyz(f.handTarget), handTargetErrorM: hand.distanceTo(f.handTarget),
    offHandWorldM: xyz(offHand), actualPommelWorldM: xyz(pommel), offHandGapM: offHand.distanceTo(pommel),
    gripping: !!f.gripping, wristBrake: !!f.wristBrake, wristCapNm: f.debug.wristCap,
    wristSwingTorqueNmFromPreStep: xyz(f.debug.wristTorque),
    note: 'debug torque excludes later blade-axis twist; targets/control values precede world.step, rigid-body values follow it' };
}

/** ledgerFactory(G) must return {samples, summary(), restore()}; observer only. */
export function runStroke({ weapon='longsword', direction='down', reaction='legacy', ending='release', seed=7, durationS=0.55, prepareS=3, afterS=1.2, sampleHz=30, ledgerFactory=null }={}) {
  if (!['down','up'].includes(direction) || !['legacy','paired'].includes(reaction) || !['release','target_hold'].includes(ending)) throw new Error('unsupported controlled condition');
  if (reaction==='paired' && !Object.hasOwn(CONFIG.GRIP,'reactionModel')) throw new Error('paired model is unavailable in this loaded source');
  const originalReaction = CONFIG.GRIP.reactionModel;
  CONFIG.GRIP.reactionModel='legacy'; // All matched preparation remains the original controller.
  const G=newRound({seed,walls:false,weapon,weapon2:'longsword'});
  G.park();const f=G.player;const [from,to]=direction==='down'?[HIGH,LOW]:[LOW,HIGH];
  let ledger=null;
  try {
    f.handOffset.set(...from);
    for(const name of ['prev','aim','aimRaw','anchor']) f.skill[name].set(...from);
    f.skill.aimVel.set(0,0);f.skill.vel.set(0,0);f.skill.follow.set(0,0);
    f.handHeld=true;f.inputActive=false;f.skill.autoGuard=true;
    for(let i=0;i<Math.round(prepareS/DT);i++){G.step();finite(f);}
    const startState=physicalControlState(f), startSha256=sha(JSON.stringify(startState));
    const initial=sample(f,0,'start');
    CONFIG.GRIP.reactionModel=reaction;
    if(ledgerFactory) ledger=ledgerFactory(G);
    const samples=[],trace=createHash('sha256'),inputTrace=createHash('sha256'),ledgerBook=ledgerObservations();
    const steps=Math.ceil((durationS+afterS)/DT),stride=Math.max(1,Math.round(1/(sampleHz*DT)));
    let peak=null,strokePeak=null,endSample=null,lastAxis=V(initial.bladeAxisWorld),afterAxisTravelRad=0;
    let grippingSteps=0,brakingSteps=0,maxHandTargetErrorM=0,maxOffHandGapM=0;
    for(let i=0;i<steps;i++) {
      const t=i*DT,inStroke=t<durationS;
      if(inStroke){const u=Math.min(1,(t+DT)/durationS);f.handOffset.set(from[0]+(to[0]-from[0])*u,from[1]+(to[1]-from[1])*u);f.handHeld=true;f.inputActive=true;}
      else {f.handHeld=ending==='target_hold';f.inputActive=false;} // No externally generated drag after the stroke.
      inputTrace.update(JSON.stringify({timeS:t,strokeRequestedHandOffsetM:inStroke?f.handOffset.toArray():null}));
      G.step();finite(f);
      if(ledger)accumulateLedger(ledgerBook,ledger.latest);
      const s=sample(f,(i+1)*DT,inStroke?'stroke':'after_input');
      finiteNumbers(s);
      const axis=V(s.bladeAxisWorld);if(!inStroke)afterAxisTravelRad+=angle(lastAxis,axis);lastAxis=axis;
      if(!peak||s.tipSpeedMps>peak.tipSpeedMps)peak=s;
      if(inStroke&&(!strokePeak||s.tipSpeedMps>strokePeak.tipSpeedMps))strokePeak=s;
      if(inStroke)endSample=s;
      if(s.gripping)grippingSteps++;if(s.wristBrake)brakingSteps++;
      maxHandTargetErrorM=Math.max(maxHandTargetErrorM,s.handTargetErrorM);maxOffHandGapM=Math.max(maxOffHandGapM,s.offHandGapM);
      trace.update(JSON.stringify(physicalControlState(f)));
      if(i%stride===0||i===steps-1||Math.abs((i+1)*DT-durationS)<DT/2)samples.push(s);
    }
    return {weapon,direction,reaction,ending,seed,durationS,prepareS,afterS,timestepS:DT,
      startSha256,inputSha256:inputTrace.digest('hex'),traceSha256:trace.digest('hex'),initial,strokePeak,peak,endSample,final:samples.at(-1),
      summary:{grippingFraction:grippingSteps/steps,wristBrakingFraction:brakingSteps/steps,maxHandTargetErrorM,maxOffHandGapM,afterInputBladeAxisTravelRad:afterAxisTravelRad},
      ledger:ledger?{available:true,summary:ledger.summary(),observations:finishLedger(ledgerBook),samples:ledger.samples}:{available:false},samples,finite:true,
      controlMeaning:'release=handHeld false after identical drag; target_hold=handHeld true after identical drag. Both retain all original controllers. Auto recovery can change actual handOffset after release; this is recorded, not free-flight or a forced angular-velocity brake.'};
  } finally {ledger?.restore();G.eventQueue.free();G.world.free();if(originalReaction===undefined)delete CONFIG.GRIP.reactionModel;else CONFIG.GRIP.reactionModel=originalReaction;}
}

async function main() {
  const opts=Object.fromEntries(process.argv.slice(2).map(s=>{const m=s.match(/^--([^=]+)=(.*)$/);if(!m)throw new Error('Use --name=value');return [m[1],m[2]];}));
  const weapons=(opts.weapons??'longsword,zweihander').split(','),directions=(opts.directions??'down,up').split(','),reactions=(opts.reactions??'legacy,paired').split(','),endings=(opts.endings??'release').split(',');
  const seed=Number(opts.seed??7),durationS=Number(opts.duration??0.55),prepareS=Number(opts.prepare??3),afterS=Number(opts.after??1.2),sampleHz=Number(opts['sample-hz']??30),useLedger=Number(opts.ledger??0);
  if(![seed,durationS,prepareS,afterS,sampleHz].every(Number.isFinite)||durationS<=0||prepareS<0||afterS<0||sampleHz<=0||sampleHz>1/DT||![0,1].includes(useLedger))throw new Error('Invalid finite CLI values');
  let ledgerFactory=null;if(useLedger){const {installForceLedger}=await import('./force_ledger.mjs');ledgerFactory=G=>installForceLedger(G,{fighters:[G.player],maxSamples:32,sampleEvery:8});}
  const sourceFiles=['src/fighter.js','src/gait.js','src/skill.js','src/config.js','src/weapons.js','src/combat.js','tools/sim/harness_m.mjs','tools/sim/whole_body_strike_probe.mjs'];if(useLedger)sourceFiles.push('tools/sim/force_ledger.mjs');
  const manifest=async()=>Object.fromEntries(await Promise.all(sourceFiles.map(async p=>[p,sha(await readFile(new URL('../../'+p,import.meta.url)))])));
  const sourceSha256=await manifest(),begin=performance.now(),rows=[];
  for(const weapon of weapons)for(const direction of directions)for(const ending of endings)for(const reaction of reactions)rows.push(runStroke({weapon,direction,reaction,ending,seed,durationS,prepareS,afterS,sampleHz,ledgerFactory}));
  const pairedStartChecks=[];
  for(const weapon of weapons)for(const direction of directions){const r=rows.filter(x=>x.weapon===weapon&&x.direction===direction);const ok=r.every(x=>x.startSha256===r[0].startSha256&&x.inputSha256===r[0].inputSha256);pairedStartChecks.push({weapon,direction,sameStartAndRequestedInput:ok});if(!ok)throw new Error('Matched preparation/input hash differs');}
  const sourceSha256After=await manifest();
  const result={schemaVersion:1,probe:'whole_body_strike_probe',sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',cwd:new URL('../..',import.meta.url)}).trim(),sourceSha256,sourceSha256After,sourceStableDuringRun:JSON.stringify(sourceSha256)===JSON.stringify(sourceSha256After),
    wallSeconds:(performance.now()-begin)/1000,simulatedSeconds:rows.reduce((a,r)=>a+r.prepareS+r.final.timeS,0),
    protocol:{input:'scripted handOffset high [.02,.52] to low [.02,-.45] or reverse; no AI player, enemy parked; game G.step unchanged',preparation:'always legacy; reaction option changed only after matched preparation',sampleHz,gravityMps2:CONFIG.PHYSICS.gravity,assist:CONFIG.GAIT.assist,catchMode:CONFIG.GAIT.catchMode,catchScale:CONFIG.GAIT.catchScale,
      limits:'No human naturalness or damage verdict. All-controller/native-motor work unavailable without a force ledger; body K is not hit damage. Energy snapshots include existing foot-mass changes.'},pairedStartChecks,rows};
  if(opts.out)await writeFile(opts.out,JSON.stringify(result,null,2)+'\n');else process.stdout.write(JSON.stringify(result,null,2)+'\n');
  if(!result.sourceStableDuringRun){console.error('Source files changed during run; retain output as non-comparable evidence');process.exitCode=1;}
  console.log(JSON.stringify({out:opts.out??null,rows:rows.length,wallSeconds:result.wallSeconds,sourceStableDuringRun:result.sourceStableDuringRun,matched:pairedStartChecks.every(x=>x.sameStartAndRequestedInput),summary:rows.map(r=>({weapon:r.weapon,direction:r.direction,reaction:r.reaction,ending:r.ending,peakTipSpeedMps:r.peak.tipSpeedMps,peakSwordKineticJ:r.peak.swordEnergy.translationJ+r.peak.swordEnergy.rotationJ,...r.summary}))}));
}
if(isMain(import.meta.url))main().catch(e=>{console.error(e.stack);process.exitCode=1;});
