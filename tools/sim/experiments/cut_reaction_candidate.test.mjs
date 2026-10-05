/** Real Rapier impulse tests and isolated real Combat.afterStep contact fixtures.
 * Output defaults outside the repository. No freezes, gameplay bounds or src edits.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import RAPIER from '../../../node_modules/@dimforge/rapier3d-compat/rapier.mjs';
import * as THREE from 'three';
import {Combat as OriginalCombat} from '../../../src/combat.js';
import {STRIKE} from '../../../src/config.js';
import {snapshotWorld} from '../force_ledger.mjs';
import {applyPairedCutImpulse,pointDirectionalMobility,loadCutReactionCombat,transformCutReactionSource,transformBudgetedCutReactionSource} from './cut_reaction_candidate.mjs';
import {applyPairedCutImpulse as browserPairedCutImpulse,pointDirectionalMobility as browserPointMobility} from '../../../src/cut_reaction.js';

await RAPIER.init();
const repo=fileURLToPath(new URL('../../../',import.meta.url));
const sourcePath=new URL('../../../src/combat.js',import.meta.url);
const source=fs.readFileSync(sourcePath,'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const sourceBefore=sha(source), results=[];
const sharedHelperURL=new URL('../../../src/cut_reaction.js',import.meta.url);
const sharedHelperBefore=sha(fs.readFileSync(sharedHelperURL));
const legacy=await loadCutReactionCombat({mode:'legacy'});
const candidate=await loadCutReactionCombat();
const budgeted=await loadCutReactionCombat({mode:'budgeted'});
const zero={x:0,y:0,z:0};
const V=v=>new THREE.Vector3(v.x,v.y,v.z);
const vec=(x=0,y=0,z=0)=>({x,y,z});
const diff=(a,b)=>V(a).sub(V(b));
const dot=(a,b)=>V(a).dot(V(b));
// Float32 response and reconstructed tensors: absolute + scale-proportional tolerance.
// Translation uses up to 7m shifts, not large-coordinate cancellation stress.
const TOL={momentum:5e-5,angular:2e-4,energy:8e-5,speed:1e-4,covariance:2e-4,timer:5e-9};
function near(a,b,tol=TOL.energy){assert.ok(Math.abs(a-b)<=tol*(1+Math.abs(a)+Math.abs(b)),`${a} vs ${b}; Float32 abs+relative tolerance ${tol}`);}
function vnear(a,b,tol=TOL.momentum){for(const k of ['x','y','z'])near(a[k],b[k],tol);}
function snapshot(world){return snapshotWorld(world,{origin:zero});}
async function test(name,fn){try{const details=await fn();results.push({name,pass:true,details});console.log('PASS',name);}catch(error){results.push({name,pass:false,error:error.stack});console.error('FAIL',name,error.stack);}}
const identity=new THREE.Quaternion();
const rotated=new THREE.Quaternion().setFromEuler(new THREE.Euler(.53,-.72,.31));
function mapPoint(v,q,shift){return V(v).applyQuaternion(q).add(V(shift));}
function mapVector(v,q){return V(v).applyQuaternion(q);}
function addBody(world,{mass,position,inertia,frame=identity,q=identity,shape=null}){
  const b=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(...['x','y','z'].map(k=>position[k]))
    .setRotation(q).setLinearDamping(0).setAngularDamping(0)
    .setAdditionalMassProperties(mass,zero,inertia,frame));
  let col=null;
  if(shape) col=world.createCollider(shape.setDensity(0).setActiveHooks(RAPIER.ActiveHooks.FILTER_CONTACT_PAIRS),b);
  return {b,col};
}
function freePair({q=identity,shift=zero,masses=[1,8],inertias=[vec(.2,.0002,.2),vec(.03,.01,.02)]}={}){
  const world=new RAPIER.World(zero);world.timestep=1/120;
  const sw=addBody(world,{mass:masses[0],position:mapPoint(zero,q,shift),inertia:inertias[0],q}).b;
  const victim=addBody(world,{mass:masses[1],position:mapPoint(vec(.15,.7,.06),q,shift),inertia:inertias[1],q,
    frame:new THREE.Quaternion().setFromEuler(new THREE.Euler(.1,-.2,.3))}).b;
  world.step(); // Initializes native mass properties before any test impulse.
  sw.setLinvel(mapVector(vec(.2,-.1,6.3),q),true);
  victim.setLinvel(mapVector(vec(.2,-.1,0),q),true);
  sw.setAngvel(mapVector(vec(.1,2,-.1),q),true);
  victim.setAngvel(mapVector(vec(-.2,.1,.3),q),true);
  return {world,sw,victim,point:mapPoint(vec(.06,.8,.02),q,shift),n:mapVector(vec(0,0,1),q)};
}
function measurePair(options,requestedJ){
  const G=freePair(options);
  try{
    const pre=snapshot(G.world),d=applyPairedCutImpulse(G.sw,G.victim,G.point,G.n,requestedJ),post=snapshot(G.world);
    vnear(post.total.P,pre.total.P);vnear(post.total.L,pre.total.L,TOL.angular);
    near(post.total.K-pre.total.K,d.deltaKPredicted);
    near(d.sAfterMeasured,d.sAfterPredicted,TOL.speed);
    assert.ok(d.sAfterMeasured>=-TOL.speed*(1+Math.abs(d.s)));
    assert.ok(post.total.K<=pre.total.K+TOL.energy*(1+pre.total.K));
    return {pre,post,d};
  }finally{G.world.free();}
}

await test('source transform is exact-once guarded and original fallback preserved',()=>{
  assert.throws(()=>transformCutReactionSource(source.replace('dir.x * J * 0.8','dir.x * J * 0.7')),/found 0/);
  const changedScope=source.replace('centerlineCutEnabled(this, c.pr.w.fighter)',
    'centerlineCutEnabled(this, c.pr.v.fighter)');
  assert.notEqual(changedScope,source,'the reviewed opt-in wrapper is present');
  assert.throws(()=>transformCutReactionSource(changedScope),/found 0/);
  assert.throws(()=>transformBudgetedCutReactionSource(changedScope),/found 0/);
  assert.throws(()=>transformCutReactionSource(source+'\n'+source),/found 2/);
  assert.equal(legacy.metadata.sourceSHA256,sourceBefore);
  assert.equal(legacy.metadata.transformedSHA256,sourceBefore);
  assert.notEqual(candidate.metadata.transformedSHA256,sourceBefore);
  return {legacy:legacy.metadata,candidate:candidate.metadata};
});
for(const [label,options] of [
  ['baseline',{}],['world rotation',{q:rotated}],['rotation and translation',{q:rotated,shift:vec(4,-3,7)}],
  ['heavy sword light target',{masses:[8,.4],inertias:[vec(.5,.003,.4),vec(.002,.005,.01)]}],
  ['extremely low sword axial inertia',{inertias:[vec(.2,.000001,.2),vec(.3,.1,.2)]}],
  ['light sword heavy target',{masses:[.3,50],inertias:[vec(.03,.00008,.05),vec(3,1,2)]}],
]) for(const request of [.001,100]) await test(`paired free-body ${label}; request ${request}`,()=>measurePair(options,request));

await test('passive cap exposes uncapped common-point axial spin energy injection',()=>{
  const G=freePair({inertias:[vec(.2,.000001,.2),vec(.03,.01,.02)]});
  try{
    const pre=snapshot(G.world),J=1;
    G.sw.applyImpulseAtPoint(V(G.n).multiplyScalar(-J),G.point,true);
    G.victim.applyImpulseAtPoint(V(G.n).multiplyScalar(J),G.point,true);
    const post=snapshot(G.world);
    vnear(pre.total.P,post.total.P);vnear(pre.total.L,post.total.L,TOL.angular);
    assert.ok(post.total.K>pre.total.K+100);
    const fixed=measurePair({inertias:[vec(.2,.000001,.2),vec(.03,.01,.02)]},J);
    assert.ok(fixed.d.J<J);
    return {uncappedDeltaK:post.total.K-pre.total.K,uncappedSwordAxialOmega:G.sw.angvel().y,
      capped:fixed.d,cappedMeasuredDeltaK:fixed.post.total.K-fixed.pre.total.K};
  }finally{G.world.free();}
});
await test('cap and signed energy are covariant under rigid world transform',()=>{
  const A=measurePair({},100),B=measurePair({q:rotated,shift:vec(4,-3,7)},100);
  for(const k of ['J','a','s','deltaKPredicted'])near(A.d[k],B.d[k],TOL.covariance);
  vnear(V(A.d.impulseWeapon).applyQuaternion(rotated),B.d.impulseWeapon,TOL.covariance);
  return {A:A.d,B:B.d};
});
await test('separating, zero request and zero mobility perform no impulses',()=>{
  const G=freePair();
  try{
    const pre=snapshot(G.world),separating=applyPairedCutImpulse(G.sw,G.victim,G.point,V(G.n).negate(),10);
    assert.equal(separating.J,0);
    const noRequest=applyPairedCutImpulse(G.sw,G.victim,G.point,G.n,0);assert.equal(noRequest.J,0);
    assert.deepEqual(snapshot(G.world),pre);
    assert.throws(()=>applyPairedCutImpulse(G.sw,G.sw,G.point,G.n,1),/distinct/);
    assert.throws(()=>applyPairedCutImpulse(G.sw,G.victim,G.point,zero,1),/Nonzero/);
    assert.throws(()=>applyPairedCutImpulse(G.sw,G.victim,G.point,G.n,-1),/nonnegative/);
    // Two genuinely fixed bodies are separate from free momentum tests; no body is frozen.
    const a=G.world.createRigidBody(RAPIER.RigidBodyDesc.fixed()),b=G.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const fixed=applyPairedCutImpulse(a,b,zero,G.n,10);assert.equal(fixed.a,0);assert.equal(fixed.J,0);
    return {separating,noRequest,fixed};
  }finally{G.world.free();}
});

function cuttingFixture(CombatClass,regime,{q=identity,shift=zero,masses=[1,8],inertias=[vec(.2,.0002,.2),vec(.03,.01,.02)],continuingContact=true,cutEnergy=100,willStuck=false,steps=1,verifyLifecycle=false}={}){
  const world=new RAPIER.World(zero),queue=new RAPIER.EventQueue(true);world.timestep=1/120;
  const W=addBody(world,{mass:masses[0],position:mapPoint(zero,q,shift),q,inertia:inertias[0],
    shape:RAPIER.ColliderDesc.cuboid(.04,.65,.025).setTranslation(.02,.7,0)});
  const B=addBody(world,{mass:masses[1],position:mapPoint(vec(.08,.8,.03),q,shift),q,inertia:inertias[1],
    shape:RAPIER.ColliderDesc.cuboid(.18,.18,.18)});
  const att={index:0,armed:true,sword:W.b,weapon:{},swordColliders:[W.col]},vic={index:1,armed:true,weapon:{}};
  const wi={body:W.b,fighter:att,kind:'weapon',part:'blade'},vi={body:B.b,fighter:vic,kind:'arm',part:'farmS'};
  const info=new Map([[W.col.handle,wi],[B.col.handle,vi]]),combat=new CombatClass(info,{});
  // Real engine contact geometry, no native solver impulse. This isolates the explicit cut path.
  world.step(queue,{filterContactPair:()=>0,filterIntersectionPair:()=>true});
  queue.drainContactForceEvents(()=>{});queue.drainCollisionEvents(()=>{});
  let point=null,contacts=0;
  world.contactPair(W.col,B.col,(m,flipped)=>{for(let i=0;i<m.numContacts();i++){
    if(m.contactDist(i)<.004){contacts++;if(!point){const p=flipped?m.localContactPoint2(i):m.localContactPoint1(i);
      point=V(p).applyQuaternion(new THREE.Quaternion().copy(W.col.rotation())).add(V(W.col.translation()));}}
  }});
  assert.ok(point&&contacts>0,'real Rapier cutting manifold must exist');
  let contactsAtAfterStep=contacts;
  if(!continuingContact){
    assert.equal(regime,'stuck','lost contact continuation requires stuck timer');
    B.b.setTranslation(mapPoint(vec(.08,3.8,.03),q,shift),true);
    world.step(queue,{filterContactPair:()=>0,filterIntersectionPair:()=>true});
    queue.drainContactForceEvents(()=>{});queue.drainCollisionEvents(()=>{});
    contactsAtAfterStep=0;
    world.contactPair(W.col,B.col,m=>{for(let i=0;i<m.numContacts();i++)if(m.contactDist(i)<.004)contactsAtAfterStep++;});
    assert.equal(contactsAtAfterStep,0,'target really left native contact manifold');
  }
  W.b.setLinvel(mapVector(vec(.2,-.1,6.3),q),true);B.b.setLinvel(mapVector(vec(.2,-.1,0),q),true);
  W.b.setAngvel(mapVector(vec(.1,2,-.1),q),true);B.b.setAngvel(mapVector(vec(-.2,.1,.3),q),true);
  const key=`${W.col.handle}:${B.col.handle}`;
  const c={seen:0,applied:true,pr:{w:wi,v:vi,wc:W.col.handle,vc:B.col.handle},wc:W.col.handle,vc:B.col.handle,
    Eleft:regime==='drag'?cutEnergy:0,stuck:regime==='stuck'||willStuck,stuckT:regime==='stuck'?STRIKE.stuckTime:0,
    mFree:.3,localPt:point.clone().sub(V(W.b.translation())).applyQuaternion(q.clone().invert())};
  combat.cutting.set(key,c);let diagnostic=null,events=0;combat.onCutReaction=d=>diagnostic=d;
  const pre=snapshot(world),s=diff(W.b.velocityAtPoint(point),B.b.velocityAtPoint(point)).length();
  const requestedJ=regime==='drag'?Math.min(Math.min(c.Eleft,STRIKE.dragC*s*s*world.timestep)/s,STRIKE.dragCap*c.mFree*s)
    :Math.min(Math.min(STRIKE.stuckDamp*s,STRIKE.stuckForce)*world.timestep,.8*(c.mFree+STRIKE.armAssist)*s);
  // Empty actual queue; the wrapper counts unexpected events without manufacturing contacts.
  const originalDrain=queue.drainContactForceEvents.bind(queue);
  queue.drainContactForceEvents=fn=>originalDrain(e=>{events++;fn(e);});
  combat.afterStep(world,queue);
  const post=snapshot(world),cutAfter={Eleft:c.Eleft,stuckT:c.stuckT,seen:c.seen};
  const continuations=[];
  const firstDiagnostic=diagnostic;
  for(let i=1;i<steps;i++){
    world.step(queue,combat.physicsHooks);queue.drainContactForceEvents(()=>{});queue.drainCollisionEvents(()=>{});
    const stepPre=snapshot(world);diagnostic=null;combat.afterStep(world,queue);const stepPost=snapshot(world);
    continuations.push({step:i+1,diagnostic,deltaK:stepPost.total.K-stepPre.total.K,
      deltaP:diff(stepPost.total.P,stepPre.total.P),deltaL:diff(stepPost.total.L,stepPre.total.L),
      cutAfter:{Eleft:c.Eleft,stuckT:c.stuckT,cutBudgetDone:c.cutBudgetDone}});
  }
  diagnostic=firstDiagnostic;
  let lifecycle=null;
  if(verifyLifecycle){
    assert.equal(c.cutBudgetDone,true);
    assert.equal(combat.filterContactPair(W.col.handle,B.col.handle),0);
    assert.equal(combat.cutting.get(key),c);assert.equal(c.cutBudgetDone,true);
    const retainedSeen=c.seen;
    combat.cutting.delete(key);
    // Lifecycle predicate/wound result are controlled here; map creation and afterStep
    // initialization are real methods, with real body velocities and contact geometry.
    combat.predict=()=>({pass:true});
    assert.equal(combat.filterContactPair(W.col.handle,B.col.handle),0);
    const fresh=combat.cutting.get(key);assert.notEqual(fresh,c);
    assert.equal(fresh.applied,false);assert.equal(!!fresh.cutBudgetDone,false);
    let firstApplicationCalls=0;
    combat.strike=()=>{firstApplicationCalls++;return {energy:10*STRIKE.energyScale,absorb:10*STRIKE.energyScale,stuck:false,mFree:.3};};
    diagnostic=null;combat.afterStep(world,queue);
    assert.equal(firstApplicationCalls,1);assert.equal(fresh.applied,true);
    assert.ok(diagnostic);assert.equal(diagnostic.regime,'drag');assert.equal(diagnostic.budgetBeforeJ,10);
    assert.equal(diagnostic.budgetDone,false);assert.equal(!!fresh.cutBudgetDone,false);
    lifecycle={retainedExistingMarker:true,retainedSeen,freshObjectCreated:true,freshInitialMarker:false,
      firstApplicationCalls,firstApplicationDiagnostic:diagnostic,
      fixtureScope:'predict/pass and strike result controlled; real filterContactPair/map creation/afterStep initialization and Rapier contact/impulses'};
    diagnostic=firstDiagnostic;
  }
  queue.free();world.free();
  return {pre,post,diagnostic,continuations,lifecycle,regime,point:point.toArray(),contacts,contactsAtAfterStep,requestedJ,events,cutAfter,
    deltaP:diff(post.total.P,pre.total.P),deltaL:diff(post.total.L,pre.total.L),deltaK:post.total.K-pre.total.K};
}
for(const regime of ['drag','stuck']) await test(`actual Combat.afterStep ${regime}: original counterexample and guarded clone`,()=>{
  const original=cuttingFixture(OriginalCombat,regime),fallback=cuttingFixture(legacy.Combat,regime),paired=cuttingFixture(candidate.Combat,regime);
  assert.deepEqual(fallback,original,'source clone legacy must exactly reproduce original afterStep');
  assert.equal(original.events,0);assert.equal(paired.events,0);
  assert.ok(original.deltaP.length()>1e-3);assert.ok(original.deltaL.length()>1e-3);
  near(original.deltaP.length(),.2*original.requestedJ,TOL.momentum);
  assert.ok(paired.diagnostic);near(paired.diagnostic.requestedJ,original.requestedJ);
  assert.deepEqual(paired.cutAfter,original.cutAfter,'requested J/Eleft/stuck timer rules are preserved');
  vnear(paired.deltaP,zero);vnear(paired.deltaL,zero,TOL.angular);
  near(paired.deltaK,paired.diagnostic.deltaKPredicted);
  assert.ok(paired.deltaK<=TOL.energy*(1+paired.pre.total.K));
  assert.ok(paired.diagnostic.sAfterMeasured>=-TOL.speed*(1+paired.diagnostic.s));
  return {original,paired};
});
for(const regime of ['drag','stuck']) await test(`actual afterStep ${regime}: rotation/translation and mass/inertia variations`,()=>{
  const rows=[];
  for(const options of [{q:rotated,shift:vec(4,-3,7)},
    {q:rotated,masses:[8,.4],inertias:[vec(.5,.00001,.4),vec(.002,.005,.01)]}]){
    const r=cuttingFixture(candidate.Combat,regime,options);
    vnear(r.deltaP,zero);vnear(r.deltaL,zero,TOL.angular);
    near(r.deltaK,r.diagnostic.deltaKPredicted);
    assert.ok(r.deltaK<=TOL.energy*(1+r.pre.total.K));
    assert.ok(r.diagnostic.sAfterMeasured>=-TOL.speed*(1+Math.abs(r.diagnostic.s)));
    rows.push(r);
  }
  return rows;
});
await test('actual afterStep stuck continuation after contact disappears uses shared stored blade point passively',()=>{
  const original=cuttingFixture(OriginalCombat,'stuck',{continuingContact:false});
  const paired=cuttingFixture(candidate.Combat,'stuck',{continuingContact:false});
  assert.equal(paired.contactsAtAfterStep,0);assert.ok(paired.diagnostic);
  vnear(paired.deltaP,zero);vnear(paired.deltaL,zero,TOL.angular);
  near(paired.deltaK,paired.diagnostic.deltaKPredicted);
  assert.ok(paired.deltaK<=TOL.energy*(1+paired.pre.total.K));
  assert.ok(paired.diagnostic.sAfterMeasured>=-TOL.speed*(1+paired.diagnostic.s));
  near(paired.diagnostic.requestedJ,original.requestedJ);
  assert.deepEqual(paired.cutAfter,original.cutAfter);
  return {original,paired,pointDefinition:'stored previous real contact point carried with blade; shared application on both bodies'};
});
await test('budgeted transform has independent exact-once request/debit guards',()=>{
  assert.throws(()=>transformBudgetedCutReactionSource(source.replace('c.Eleft -= J * s','c.Eleft -= 0.8 * J * s')),/legacy debit/);
  assert.throws(()=>transformBudgetedCutReactionSource(source+'\n'+source),/found 2/);
  assert.equal(budgeted.metadata.sourceSHA256,legacy.metadata.sourceSHA256);
  assert.notEqual(budgeted.metadata.transformedSHA256,candidate.metadata.transformedSHA256);
  return budgeted.metadata;
});
for(const cutEnergy of [100,4,.01,.0015]) await test(`budgeted actual afterStep drag loss closes Eleft ${cutEnergy} and delays stuck until actual depletion`,()=>{
  const options={cutEnergy,willStuck:true};
  const A=cuttingFixture(OriginalCombat,'drag',options),B=cuttingFixture(candidate.Combat,'drag',options),C=cuttingFixture(budgeted.Combat,'drag',options);
  const d=C.diagnostic;
  near(d.requestedJ,A.requestedJ);near(d.requestedJ,B.diagnostic.requestedJ);
  near(d.J,B.diagnostic.J);near(C.deltaK,B.deltaK);
  near(d.budgetBeforeJ,cutEnergy);near(d.budgetBeforeJ-d.budgetAfterJ,-C.deltaK);
  near(d.budgetDebitJ,-d.deltaKPredicted,1e-10);
  assert.ok(d.budgetAfterJ>=0&&d.budgetDebitJ<=d.budgetBeforeJ+1e-10);
  assert.ok(d.budgetDebitJ<=d.requestedApproxJs+1e-10);
  assert.equal(C.cutAfter.stuckT,d.budgetAfterJ<=1e-3?STRIKE.stuckTime:0);
  assert.ok(d.sAfterMeasured>=-TOL.speed*(1+d.s));
  vnear(C.deltaP,zero);vnear(C.deltaL,zero,TOL.angular);
  return {legacy:A,candidate:B,budgeted:C};
});
await test('budgeted drag with early legacy depletion does not start stuck while paired budget remains',()=>{
  // This request exhausts the legacy budget; paired deceleration absorbs only part of it.
  const options={cutEnergy:.7,willStuck:true};
  const A=cuttingFixture(OriginalCombat,'drag',options),B=cuttingFixture(budgeted.Combat,'drag',options);
  assert.ok(A.cutAfter.Eleft<=1e-3);assert.equal(A.cutAfter.stuckT,STRIKE.stuckTime);
  assert.ok(B.cutAfter.Eleft>1e-3);assert.equal(B.cutAfter.stuckT,0);
  near(B.diagnostic.budgetBeforeJ-B.cutAfter.Eleft,-B.deltaK);
  return {legacy:A,budgeted:B};
});
for(const continuingContact of [true,false]) await test(`budgeted stuck preserves native timer policy; continuingContact=${continuingContact}`,()=>{
  const A=cuttingFixture(candidate.Combat,'stuck',{continuingContact}),B=cuttingFixture(budgeted.Combat,'stuck',{continuingContact});
  near(B.diagnostic.J,A.diagnostic.J);assert.deepEqual(B.post,A.post);assert.deepEqual(B.cutAfter,A.cutAfter);
  assert.equal(B.diagnostic.budgetDebitJ,0);assert.equal(B.diagnostic.budgetBeforeJ,0);assert.equal(B.diagnostic.budgetAfterJ,0);
  // world.timestep itself crosses Rapier Float32; the timer preserves that native dt.
  near(B.diagnostic.stuckTimerBefore-B.diagnostic.stuckTimerAfter,1/120,TOL.timer);
  return {candidate:A,budgeted:B};
});
await test('budgeted drag under rotation translation and asymmetric low axial inertia closes budget',()=>{
  const rows=[];
  for(const options of [{q:rotated,shift:vec(4,-3,7),cutEnergy:4},
    {q:rotated,masses:[8,.4],inertias:[vec(.5,.00001,.4),vec(.002,.005,.01)],cutEnergy:100}]){
    const r=cuttingFixture(budgeted.Combat,'drag',options),d=r.diagnostic;
    near(d.budgetBeforeJ-d.budgetAfterJ,-r.deltaK);
    assert.ok(d.budgetAfterJ>=0&&d.budgetDebitJ<=d.budgetBeforeJ+1e-10);
    assert.ok(d.sAfterMeasured>=-TOL.speed*(1+d.s));vnear(r.deltaP,zero);vnear(r.deltaL,zero,TOL.angular);
    rows.push(r);
  }
  return rows;
});
await test('budgeted actual native three-step drag-to-stuck transition preserves residual and does not reset timer',()=>{
  const r=cuttingFixture(budgeted.Combat,'drag',{cutEnergy:.0015,willStuck:true,steps:3});
  assert.equal(r.diagnostic.regime,'drag');assert.equal(r.diagnostic.budgetDone,true);
  assert.ok(r.diagnostic.budgetAfterJ>0&&r.diagnostic.budgetAfterJ<=1e-3);
  let timer=r.diagnostic.stuckTimerAfter;
  for(const step of r.continuations){
    const d=step.diagnostic;assert.ok(d);assert.equal(d.regime,'stuck');assert.equal(d.budgetDebitJ,0);
    assert.equal(d.budgetBeforeJ,r.diagnostic.budgetAfterJ);assert.equal(d.budgetAfterJ,r.diagnostic.budgetAfterJ);
    assert.ok(d.stuckTimerAfter<timer);near(timer-d.stuckTimerAfter,1/120,TOL.timer);timer=d.stuckTimerAfter;
    near(step.deltaK,d.deltaKPredicted);assert.ok(d.sAfterMeasured>=-TOL.speed*(1+d.s));
    vnear(step.deltaP,zero);vnear(step.deltaL,zero,TOL.angular);
  }
  return r;
});
await test('budgeted same-cut recontact retains completed phase; genuinely new cut resets phase before real first application',()=>{
  const r=cuttingFixture(budgeted.Combat,'drag',{cutEnergy:.0015,willStuck:true,verifyLifecycle:true});
  assert.ok(r.lifecycle);return r.lifecycle;
});
await test('browser helper identity and real runtime budgeted branch exactly match independent source transform at phase boundaries',()=>{
  assert.equal(applyPairedCutImpulse,browserPairedCutImpulse);
  assert.equal(pointDirectionalMobility,browserPointMobility);
  class RuntimeCombat extends OriginalCombat {
    constructor(...args){super(...args);assert.equal(this.cutReactionModel,'legacy');this.cutReactionModel='budgeted';}
  }
  const rows=[];
  for(const [regime,options] of [['drag',{}],['stuck',{}],['stuck',{continuingContact:false}],
    ['drag',{cutEnergy:.0015,willStuck:true,steps:3}],['drag',{cutEnergy:.0015,willStuck:true,verifyLifecycle:true}]]){
    const transformed=cuttingFixture(budgeted.Combat,regime,options),runtime=cuttingFixture(RuntimeCombat,regime,options);
    assert.deepEqual(runtime,transformed);rows.push({regime,options,exact:true,runtime});
  }
  return {sharedExportIdentity:true,rows};
});
const sourceAfter=sha(fs.readFileSync(sourcePath,'utf8'));
const sharedHelperAfter=sha(fs.readFileSync(sharedHelperURL));
const report={createdUTC:new Date().toISOString(),baselineCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),
  command:'node tools/sim/experiments/cut_reaction_candidate.test.mjs [outside-repo-output.json]',
  pass:results.every(r=>r.pass)&&sourceBefore===sourceAfter&&sharedHelperBefore===sharedHelperAfter,tolerances:TOL,Float32:'native Rapier Float32; assertions use stated abs+relative envelopes',
  scope:'instant explicit cutting impulses; actual afterStep on 2 free native bodies and real manifold; empty other event paths',
  limitations:['No whole-body native joint/contact response claim','Wound/analyze paths intentionally excluded by pre-applied cutting fixture',
    'Candidate preserves legacy Eleft J*s; budgeted debits instantaneous paired kinetic loss only',
    'No whole-body native energy budget claim','Runtime opt-in branch is present; default legacy retained; browser activation tested separately'],
  sourceBefore,sourceAfter,sharedHelperBefore,sharedHelperAfter,sourceStable:sourceBefore===sourceAfter&&sharedHelperBefore===sharedHelperAfter,
  sourceStabilityScope:['src/combat.js','src/cut_reaction.js'],tests:results};
const out=process.argv[2]||'/tmp/halfsword-cut-reaction-budgeted-tests.json';
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pass:report.pass,tests:results.length,failures:results.filter(r=>!r.pass).map(r=>r.name),sourceStable:report.sourceStable,out}));
process.exitCode=report.pass?0:1;
