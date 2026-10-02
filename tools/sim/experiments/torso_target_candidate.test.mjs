// Component checks only. The body rotation setter below belongs exclusively to a
// synthetic coordinate fixture; its motion is not whole-body strike measurement.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { newRound, THREE } from '../harness_m.mjs';
import { installForceLedger } from '../force_ledger.mjs';
import { loadTorsoTargetCandidates, transformTorsoTargetFighter } from './torso_target_candidate.mjs';

const root = new URL('../../../', import.meta.url);
const output = process.argv[2] || '/workspace/halfsword-hybrid-evidence/torso-target-candidate-tests.json';
const files = ['src/fighter.js','src/config.js','src/skill.js','src/guards.js',
  'tools/sim/harness_m.mjs','tools/sim/force_ledger.mjs',
  'tools/sim/experiments/torso_target_candidate.mjs','tools/sim/experiments/torso_target_candidate.test.mjs'];
const hash = value => createHash('sha256').update(value).digest('hex');
const manifest = async () => Object.fromEntries(await Promise.all(files.map(async p => [p,hash(await readFile(new URL(p,root)))])));
const sourceBefore = await manifest();
const modules = await loadTorsoTargetCandidates();
class Passive { update() {} }
const tests = [];
async function test(name, fn) {
  try { tests.push({name,pass:true,details:await fn()}); console.log('PASS',name); }
  catch (error) { tests.push({name,pass:false,error:error.stack}); console.error('FAIL',name,error.stack); }
}
function trace(f) {
  const bodies = [...Object.values(f.bodies),f.sword];
  const native = bodies.map(b => ({mass:b.mass(),p:b.translation(),q:b.rotation(),v:b.linvel(),w:b.angvel()}));
  for (const b of native) for (const field of ['p','q','v','w']) for (const value of Object.values(b[field])) assert.ok(Number.isFinite(value));
  return JSON.stringify({native,state:f.state,hand:f.handTarget.toArray(),aim:f.aimDirW.toArray()});
}
function actualRun(variant) {
  const G = newRound({seed:7,walls:false,AIClass:Passive}); G.park();
  const f = G.player;
  G.before = t => { f.handOffset.set(.18*Math.sin(t*3),.3*Math.cos(t*2)); f.handHeld=true; };
  const ledger = installForceLedger(G,{fighters:[f],maxSamples:1});
  const installed = variant ? modules.installer({f,ledger,variant}) : null;
  const frames = [];
  try {
    for (let i=0;i<100;i++) { G.step(); frames.push(trace(f)); }
    return {frames,summary:installed?.summary,ledgerPaths:Object.keys(ledger.summary().totals.byPath)};
  } finally { installed?.restore(); ledger.restore(); G.world.free(); }
}

try {
  await test('guarded transform changes only the three frame applications and helper selection',async () => {
    const source = await readFile(new URL('src/fighter.js',root),'utf8');
    const transformed = transformTorsoTargetFighter(source);
    assert.throws(()=>transformTorsoTargetFighter(transformed),/already transformed/);
    assert.throws(()=>transformTorsoTargetFighter(source.replace('    aim.applyQuaternion(this.yaw);','')),/Expected one Fighter marker/);
    const restored = transformed.slice(transformed.indexOf(source.slice(0,100)))
      .replace('    const mus = this.muscle;\n    const torsoFrame = torsoTargetFrame(this);','    const mus = this.muscle;')
      .replace('this.handTarget.copy(handLocal).applyQuaternion(torsoFrame)','this.handTarget.copy(handLocal).applyQuaternion(this.yaw)')
      .replace('    aim.applyQuaternion(torsoFrame);','    aim.applyQuaternion(this.yaw);')
      .replace('RIGHT_LOCAL.clone().applyQuaternion(torsoFrame)','RIGHT_LOCAL.clone().applyQuaternion(this.yaw)');
    assert.equal(restored,source);
    return {fullSourceRecoveredAfterRemovingHelpersAndReversingFourMarkers:true,unchangedGravityStrengthAndReactionCode:true};
  });
  await test('unchanged clone preserves actual game native and target trace exactly',() => {
    const original = actualRun(null), clone = actualRun('clone');
    assert.deepEqual(clone.frames,original.frames);
    assert.equal(clone.summary.dispatchCalls,100);
    assert.ok(clone.ledgerPaths.some(p=>p.includes('driveSword')));
    return {frames:100,traceExact:true,traceSha256:hash(JSON.stringify(clone.frames)),dispatchCalls:clone.summary.dispatchCalls,ledgerPaths:clone.ledgerPaths};
  });
  await test('chest candidate executes through actual observed dispatch with finite states',() => {
    const chest = actualRun('chest');
    assert.equal(chest.summary.dispatchCalls,100);
    assert.equal(chest.summary.controller.calls,100);
    assert.equal(chest.summary.controller.transportedCalls,100);
    assert.ok(chest.summary.calibration.frameAgreementChord<1e-14);
    assert.ok(chest.ledgerPaths.some(p=>p.includes('driveSword')));
    return {classification:'Execution/finite component check; no performance or natural-motion acceptance.',frames:100,traceSha256:hash(JSON.stringify(chest.frames)),...chest.summary};
  });
  await test('bent checkpoint target continuity, synthetic chest transport and world-aim fallbacks',() => {
    const G = newRound({seed:7,walls:false,AIClass:Passive}); G.park(); const f = G.player;
    try {
      assert.throws(()=>modules.candidate.call(f),/Capture checkpoint/);
      for(let i=0;i<30;i++)G.step();
      const calibration = modules.captureCalibration(f);
      modules.clone.call(f); const baseHand=f.handTarget.clone(),baseAim=f.aimDirW.clone();
      modules.candidate.call(f);
      const checkpointHandErrorM=f.handTarget.distanceTo(baseHand),checkpointAimError=f.aimDirW.distanceTo(baseAim);
      assert.ok(checkpointHandErrorM<1e-14); assert.ok(checkpointAimError<1e-14);
      // Synthetic setter fixture only: rotate one actual native chest body by a known
      // world-space increment without stepping the physical world or evaluating a strike.
      const q=f.bodies.chest.rotation();
      const delta=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),.2);
      f.bodies.chest.setRotation(delta.clone().multiply(new THREE.Quaternion(q.x,q.y,q.z,q.w)),true);
      modules.candidate.call(f);
      const center=new THREE.Vector3().copy(f.bodies.chest.translation());
      const predicted=baseHand.clone().sub(center).applyQuaternion(delta).add(center);
      const transportedHandErrorM=f.handTarget.distanceTo(predicted);
      const transportedAimError=f.aimDirW.distanceTo(baseAim.clone().applyQuaternion(delta));
      // 1e-7 allows native Float32 quaternion storage, not a game-control tolerance.
      assert.ok(transportedHandErrorM<1e-7); assert.ok(transportedAimError<1e-7);
      const originalWeapon=f.weapon, fallbackChecks=[];
      for (const reason of ['tap','thrust','finish','gun']) {
        f.skill.tap=reason==='tap'?{}:null;
        f.skill.thrustPose.w=reason==='thrust'?.2:0;
        f.skill.thrustPose.hand=[.3,.1,.1]; f.skill.thrustPose.dir=[1,0,0];
        f.finish.amt=reason==='finish'?.2:0;
        f.weapon={...originalWeapon,gun:reason==='gun'};
        modules.clone.call(f);const hand=f.handTarget.toArray(),aim=f.aimDirW.toArray();
        modules.candidate.call(f);
        assert.deepEqual(f.handTarget.toArray(),hand);assert.deepEqual(f.aimDirW.toArray(),aim);
        fallbackChecks.push({reason,handExact:true,aimExact:true});
      }
      f.weapon=originalWeapon;
      const controller=modules.calibrationInfo(f);
      assert.equal(controller.fallbackCalls,4);
      return {classification:'Synthetic coordinate-transform fixture; body setter motion is not whole-body strike measurement.',
        checkpointPreparationFrames:30,calibration,checkpointHandErrorM,checkpointAimError,
        syntheticWorldYawIncrementRad:.2,transportedHandErrorM,transportedAimError,fallbackChecks,controller};
    } finally {modules.clearCalibration(f);G.world.free();}
  });
} finally { await modules.cleanup(); }

const sourceAfter=await manifest();
const sourceStable=JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter);
const result={schemaVersion:1,createdUTC:new Date().toISOString(),command:'node tools/sim/experiments/torso_target_candidate.test.mjs '+output,
  scope:modules.scope,sourceBefore,sourceAfter,sourceStable,sourceHashes:modules.sourceHashes,
  pass:sourceStable&&tests.every(t=>t.pass),tests};
await mkdir(dirname(output),{recursive:true});
await writeFile(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({output,pass:result.pass,sourceStable,tests:tests.length,failed:tests.filter(t=>!t.pass).map(t=>t.name)}));
process.exitCode=result.pass?0:1;
