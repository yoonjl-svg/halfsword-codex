import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {newRound,RAPIER,DT,THREE} from './harness_m.mjs';
import {installForceLedger,snapshotWorld} from './force_ledger.mjs';
const tests=[],repo=fileURLToPath(new URL('../../',import.meta.url));
const hashes=()=>Object.fromEntries(['src/fighter.js','src/gait.js','src/config.js','src/combat.js','tools/sim/harness_m.mjs'].map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(repo+'/'+p)).digest('hex')]));
const sourceBefore=hashes();
function near(a,b,e=1e-5){assert.ok(Math.abs(a-b)<=e,`${a} != ${b} (tolerance ${e})`);}
function vecNear(a,b,e=1e-5){for(const k of ['x','y','z'])near(a[k],b[k],e);}
async function test(name,fn){try{const details=await fn();tests.push({name,pass:true,details});console.log('PASS',name);}catch(e){tests.push({name,pass:false,error:e.stack});console.error('FAIL',name,e.stack);}}
function simple(gravity={x:0,y:0,z:0}){const world=new RAPIER.World(gravity);world.timestep=DT;const G={world,t:0};G.step=()=>{G.before?.();world.step();G.after?.();G.t+=DT;};return G;}
function ball(G,m=2,x=0){const b=G.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x,3,0).setLinearDamping(0).setAngularDamping(0));G.world.createCollider(RAPIER.ColliderDesc.ball(.3).setMass(m),b);return b;}
await test('isolated force, momentum, work and restore',()=>{
 const G=simple(),b=ball(G),beforeStep=G.step,beforeForce=b.addForce,ledger=installForceLedger(G,{maxSamples:2});
 G.before=()=>{b.resetForces(true);b.addForce({x:12,y:0,z:0},true);};
 for(let i=0;i<120;i++)G.step();const state=ledger.snapshot(),s=ledger.summary();
 // 1e-5 relative envelope covers Float32 accumulation, not a gameplay bound.
 near(state.bodies[0].velocity.x,6,6e-5);near(state.total.P.x,12,1.2e-4);near(state.total.K,36,3.6e-4);near(s.totals.forceWorkApproxJ,36,3.6e-4);near(s.totals.residualP.x,0,1.2e-4);near(s.totals.energyResidualApproxJ,0,3.6e-4);
 ledger.restore();assert.equal(G.step,beforeStep);assert.equal(b.addForce,beforeForce);ledger.restore();G.world.free();return {P:state.total.P,K:state.total.K,workApprox:s.totals.forceWorkApproxJ,residualP:s.totals.residualP};
});
await test('gravity and potential use actual COM',()=>{
 const G=simple({x:0,y:-9.81,z:0}),b=ball(G),ledger=installForceLedger(G,{maxSamples:1});for(let i=0;i<60;i++)G.step();const state=ledger.snapshot(),s=ledger.summary();near(state.bodies[0].velocity.y,-9.81*.5,2e-5);near(s.totals.gravityImpulse.y,-2*9.81*.5,2e-5);assert.ok(state.total.V>0);assert.ok(s.totals.energyResidualApproxJ<0);ledger.restore();G.world.free();return {vY:state.bodies[0].velocity.y,gravityImpulse:s.totals.gravityImpulse,semiImplicitEnergyResidualJ:s.totals.energyResidualApproxJ};
});
await test('world inertia and torque impulse include nonidentity principal frame',()=>{
 const G=simple(),q=new THREE.Quaternion().setFromEuler(new THREE.Euler(.2,.4,-.3)),frame=new THREE.Quaternion().setFromEuler(new THREE.Euler(-.3,.1,.7));
 const b=G.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setRotation(q).setAdditionalMassProperties(3,{x:.2,y:-.1,z:.3},{x:.4,y:.8,z:1.3},frame));G.world.step();
 const ledger=installForceLedger(G,{maxSamples:1});b.applyTorqueImpulse({x:.2,y:-.1,z:.3},true);G.step();const e=ledger.latest.operations.find(e=>e.method==='applyTorqueImpulse');vecNear(e.deltaL,{x:.2,y:-.1,z:.3},2e-6);assert.ok(e.deltaK>0);const s=ledger.summary();ledger.restore();G.world.free();return {impulseMeasuredDeltaL:e.deltaL,exactInstantDeltaK:e.deltaK,residualL:s.totals.residualL};
});
await test('off-center impulse, angular origin and exact kinetic increment',()=>{
 const G=simple(),b=ball(G),ledger=installForceLedger(G,{origin:{x:1,y:2,z:3},maxSamples:1});b.applyImpulseAtPoint({x:2,y:0,z:0},{x:0,y:3,z:1},true);G.step();const e=ledger.latest.operations.find(e=>e.method==='applyImpulseAtPoint');vecNear(e.deltaP,e.J,1e-6);vecNear(e.deltaL,e.angularImpulse,1e-6);near(ledger.latest.balance.impulseDeltaKJ,e.deltaK,1e-8);ledger.restore();G.world.free();return {J:e.J,angularImpulse:e.angularImpulse,deltaK:e.deltaK};
});
await test('reset force and torque books preserve independent native resets',()=>{
 const G=simple(),b=ball(G),ledger=installForceLedger(G,{maxSamples:1});G.before=()=>{b.addForceAtPoint({x:8,y:0,z:0},{x:0,y:3,z:1},true);b.resetForces(true);b.addForce({x:4,y:0,z:0},true);b.resetTorques(true);};G.step();const f=ledger.latest.physics[0].forceBook[0];vecNear(f.F,{x:4,y:0,z:0});vecNear(f.torqueCOM,{x:0,y:0,z:0});near(ledger.latest.postGame.total.P.x,4*DT,1e-6);ledger.restore();G.world.free();return f;
});
await test('paired common-point force cancels total impulse/moment while doing work',()=>{
 const G=simple(),a=ball(G,2,-1),b=ball(G,3,1),ledger=installForceLedger(G,{maxSamples:1});G.before=()=>{for(const x of [a,b]){x.resetForces(true);x.resetTorques(true);}a.addForceAtPoint({x:0,y:0,z:8},{x:0,y:3,z:0},true);b.addForceAtPoint({x:0,y:0,z:-8},{x:0,y:3,z:0},true);};for(let i=0;i<12;i++)G.step();const s=ledger.summary();vecNear(s.totals.explicitForceImpulse,{x:0,y:0,z:0},1e-8);vecNear(s.totals.explicitAngularImpulse,{x:0,y:0,z:0},1e-6);vecNear(s.final.P,{x:0,y:0,z:0},2e-5);assert.ok(s.totals.forceWorkApproxJ>0);ledger.restore();G.world.free();return {netJ:s.totals.explicitForceImpulse,netAngularImpulse:s.totals.explicitAngularImpulse,signedPairedWorkJ:s.totals.forceWorkApproxJ,residualL:s.totals.residualL};
});
await test('deferred additional mass is recorded without recomputation',()=>{
 const G=simple(),b=ball(G),ledger=installForceLedger(G,{maxSamples:1});const initial=b.mass();b.setAdditionalMass(1,true);const immediate=b.mass();G.step();const changes=[...ledger.latest.balance.massPropertyChanges,...ledger.latest.physics[0].balance.massPropertyChanges];assert.ok(changes.some(c=>c.kind==='massPropertiesChanged'));near(b.mass(),initial+1,1e-6);assert.ok(ledger.summary().totals.massChangingFrames===1);assert.ok(ledger.latest.operations.some(e=>e.method==='setAdditionalMass'));assert.ok(!ledger.latest.operations.some(e=>e.method==='recomputeMassPropertiesFromColliders'));const afterStep=b.mass();ledger.restore();G.world.free();return {initial,immediate,afterStep,changes};
});
await test('post-physics setAngvel override is distinct from force work',()=>{
 const G=simple(),b=ball(G),ledger=installForceLedger(G,{maxSamples:1});G.before=()=>b.addTorque({x:0,y:1,z:0},true);G.after=()=>b.setAngvel({x:0,y:0,z:0},true);G.step();const s=ledger.latest;assert.ok(s.physics[0].post.total.K>s.postGame.total.K);assert.ok(s.balance.stateOverride.deltaK<0);near(s.balance.stateOverride.calls,1,0);assert.ok(s.operations.some(e=>e.method==='setAngvel'&&e.phase==='postPhysics'));ledger.restore();G.world.free();return {physicsK:s.physics[0].post.total.K,gamePostK:s.postGame.total.K,override:s.balance.stateOverride};
});
await test('observed replacement executes inside the same wrapper and force path; undo restores dispatch',()=>{
 const G=simple(),b=ball(G),token={},failure=new Error('candidate sentinel'),force={x:6,y:0,z:0};
 class Actor{constructor(){this.index=0;this.bodies={body:b};this.originalCalls=0;}drive(force,result){this.originalCalls++;return result;}}
 const actor=G.player=new Actor(),original=actor.drive,ledger=installForceLedger(G,{maxSamples:1}),wrapper=actor.drive;
 let calls=0;
 try{
  const undo=ledger.replaceObservedMethod(actor,'drive',function(...args){
   assert.equal(this,actor);assert.equal(args[0],force);assert.equal(args[1],token);calls++;
   b.addForce(args[0],true);if(args[2])throw args[2];return args[1];
  });
  assert.equal(actor.drive,wrapper);
  G.before=()=>{
   b.resetForces(true);
   assert.equal(actor.drive(force,token),token);
   assert.throws(()=>actor.drive(force,token,failure),error=>error===failure);
   // A thrown candidate must pop the path stack, including when its caller catches it.
   b.addForce({x:0,y:1,z:0},true);
  };
  G.step();assert.equal(calls,2);assert.equal(actor.originalCalls,0);
  const events=ledger.latest.operations.filter(e=>e.method==='addForce');
  assert.deepEqual(events.map(e=>e.path),['fighter[0].drive','fighter[0].drive','external/unlabelled']);
  const path=ledger.latest.physics[0].balance.byPath['fighter[0].drive'];
  assert.ok(path);near(path.forceImpulse.x,12*DT,1e-8);
  undo();assert.equal(actor.drive,wrapper);assert.equal(actor.drive(force,token),token);
  assert.equal(actor.originalCalls,1);assert.equal(calls,2);
  ledger.restore();assert.equal(actor.drive,original);
  return {candidateCalls:calls,originalCalls:actor.originalCalls,wrapperPreserved:true,forcePath:'fighter[0].drive',forceImpulse:path.forceImpulse,exceptionIdentityPreserved:true};
 }finally{ledger.restore();G.world.free();}
});
await test('observed replacement rejects unsafe phase, unknown/overwritten wrappers and invalid undo lifetime',()=>{
 const G=simple(),b=ball(G);
 class Actor{constructor(){this.index=0;this.bodies={body:b};}drive(){return 'original';}}
 const actor=G.player=new Actor(),ledger=installForceLedger(G,{maxSamples:1}),wrapper=actor.drive;
 try{
  assert.throws(()=>ledger.replaceObservedMethod(actor,'missing',()=>{}),/Unknown observed/);
  assert.throws(()=>ledger.replaceObservedMethod(actor,'drive',wrapper),/observer wrapper/);
  G.before=()=>assert.throws(()=>ledger.replaceObservedMethod(actor,'drive',()=>{}),/idle/);
  G.step();assert.equal(actor.drive(),'original');
  actor.drive=()=>{};
  assert.throws(()=>ledger.replaceObservedMethod(actor,'drive',()=>{}),/no longer current/);
  actor.drive=wrapper;
  const undoA=ledger.replaceObservedMethod(actor,'drive',()=> 'A');
  const undoB=ledger.replaceObservedMethod(actor,'drive',()=> 'B');
  assert.throws(undoA,/no longer current/);assert.equal(actor.drive(),'B');
  G.before=()=>assert.throws(undoB,/idle/);G.step();assert.equal(actor.drive(),'B');
  undoB();assert.equal(actor.drive(),'A');undoA();assert.equal(actor.drive(),'original');
  assert.throws(undoA,/no longer current/);
  const undo=ledger.replaceObservedMethod(actor,'drive',()=> 'pending');
  actor.drive=()=>{};assert.throws(undo,/no longer current/);actor.drive=wrapper;
  ledger.restore();assert.equal(actor.drive(),'original');
  assert.throws(undo,/restored/);
  assert.throws(()=>ledger.replaceObservedMethod(actor,'drive',()=>{}),/restored/);
  return {midFrameRejected:true,unknownRejected:true,overwrittenWrapperRejected:true,lifoUndo:true,duplicateUndoRejected:true,restoredLedgerRejected:true};
 }finally{ledger.restore();G.world.free();}
});
await test('actual game instrumentation preserves identical seeded body trace',()=>{
 class Passive{update(){}}
 function run(observed){const G=newRound({seed:7,walls:false,AIClass:Passive});G.park();G.before=t=>{G.player.move.set(.3*Math.sin(t*2),.1);G.player.handOffset.set(.18*Math.sin(t*3),.3*Math.cos(t*2));G.player.handHeld=true;};const ledger=observed?installForceLedger(G,{fighters:[G.player],maxSamples:2}):null,trace=[];for(let i=0;i<240;i++){G.step();trace.push(JSON.stringify({t:G.t,p:Object.entries(G.player.bodies).map(([n,b])=>[n,b.mass(),b.translation(),b.rotation(),b.linvel(),b.angvel()]),s:[G.player.sword.translation(),G.player.sword.rotation(),G.player.sword.linvel(),G.player.sword.angvel()],state:G.player.state,wounds:G.wounds.map(w=>[w.t,w.energy,w.severity])}));}const summary=ledger?.summary(),last=ledger?.latest;ledger?.restore();G.world.free();return {trace,summary,last};}
 const off=run(false),on=run(true);assert.deepEqual(on.trace,off.trace);assert.equal(on.summary.boundary.mode,'selectedFighters');assert.ok(on.summary.boundary.initialBodies.every(b=>b.owner===0));assert.ok(on.last.physics[0].contactsRaw.every(c=>c.calibrationApplied===false));assert.ok(Object.keys(on.summary.totals.byPath).some(p=>p.includes('driveSword')));return {frames:240,traceExact:true,playerBodyCount:on.summary.initial.bodyCount,summary:on.summary,examplePhysicsBalance:on.last.physics[0].balance,contactPairs:on.last.physics[0].contactsRaw.length};
});
const result={createdUTC:new Date().toISOString(),pass:tests.every(t=>t.pass),tests,sourceBefore,sourceAfter:hashes()};result.sourceStable=JSON.stringify(result.sourceBefore)===JSON.stringify(result.sourceAfter);result.pass&&=result.sourceStable;
const out=process.argv[2]||'/tmp/halfsword-force-ledger-tests.json';fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({pass:result.pass,tests:tests.length,failed:tests.filter(t=>!t.pass).map(t=>t.name),out,sourceStable:result.sourceStable}));process.exitCode=result.pass?0:1;
