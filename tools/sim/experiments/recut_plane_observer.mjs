// One existing public B replay through first recut. No candidate or force change.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {applyBladeShapeTrial} from '../../../src/blade_shape_trial.js';
import {setRecutPlaneSink} from './recut_plane_capture.mjs';

const opts = Object.fromEntries(process.argv.slice(2).map(value => {
  const m = /^--(out|reference)=(.+)$/.exec(value); assert(m); return [m[1], m[2]];
}));
assert(opts.out && path.isAbsolute(opts.out) && !fs.existsSync(opts.out), 'Fresh output');
assert(opts.reference && path.isAbsolute(opts.reference));
const rootURL = new URL('../../../', import.meta.url), root = fileURLToPath(rootURL);
const sha = value => createHash('sha256').update(value).digest('hex');
const referenceBytes = fs.readFileSync(opts.reference), reference = JSON.parse(referenceBytes);
assert(reference.pass && reference.sourceStable && reference.headStable);
const ref = reference.rows.find(row => row.model === 'transported'); assert(ref);
const end = 1210, observeStart = 1188;
assert(ref.frames.length > end);
const sourceFiles = Object.keys(reference.sourceBefore).filter(name => name.startsWith('src/') || name.includes('rapier') || name === 'tools/sim/harness_m.mjs' || name === 'package-lock.json');
sourceFiles.push('tools/sim/experiments/recut_plane_observer.mjs', 'tools/sim/experiments/recut_plane_capture.mjs');
const manifest = () => Object.fromEntries(sourceFiles.map(name => [name, sha(fs.readFileSync(path.join(root, name)))]));
const sourceBefore = manifest();
for (const name of sourceFiles) if (reference.sourceBefore[name]) assert.equal(sourceBefore[name], reference.sourceBefore[name], 'Pinned source ' + name);

fs.mkdirSync(path.dirname(opts.out), {recursive: true});
const directory = fs.mkdtempSync(path.join(path.dirname(opts.out), 'recut_plane_runtime-'));
const fighterURL = new URL('src/fighter.js', rootURL), harnessURL = new URL('tools/sim/harness_m.mjs', rootURL);
const originalFighter = fs.readFileSync(fighterURL, 'utf8');
let fighter = originalFighter;
const markers = [];
function insert(marker, replacement) {
  assert.equal(fighter.split(marker).length, 2, 'Unique observer marker: ' + marker);
  fighter = fighter.replace(marker, replacement); markers.push(marker);
}
insert('    const ev = edgeDir.length();',
  "    recordRecutPlane(this, 'beforeMotion', {blade,flat,flatTarget,edgeDir,cachedVelocity:bv,yaw:this.yaw});\n    const ev = edgeDir.length();");
const transportMarker = "    if (manualOnehand && this.thrustEdgeModel === 'transported') applyTransportedThrustPlane(this, blade, flat, flatTarget);";
insert(transportMarker,
  "    recordRecutPlane(this, 'beforeTransport', {blade,flat,flatTarget,moving,ev,yaw:this.yaw});\n" + transportMarker +
  "\n    recordRecutPlane(this, 'afterTransport', {blade,flat,flatTarget,moving,ev,yaw:this.yaw});");
insert('    torque.add(twist);',
  "    recordRecutPlane(this, 'beforeTwist', {blade,flat,flatTarget,torque,twist,wTwist,wAim,cap,damp,yaw:this.yaw});\n    torque.add(twist);");
insert('    sword.addTorque(vecArg(torque), true);',
  "    recordRecutPlane(this, 'finalTorque', {blade,flat,flatTarget,torque,twist,cap,yaw:this.yaw});\n    sword.addTorque(vecArg(torque), true);");
const rewrite = (text, origin, special) => text.replace(/^(import[^\n]+?\sfrom\s)(['"])([^'"\n]+)\2/gm,
  (_, lead, quote, specifier) => lead + JSON.stringify(special?.(specifier) ?? (specifier.startsWith('.') ? new URL(specifier, origin).href : import.meta.resolve(specifier))));
fighter = 'import {recordRecutPlane} from ' + JSON.stringify(new URL('recut_plane_capture.mjs', import.meta.url).href) + ';\n' + rewrite(fighter, fighterURL);
const fighterPath = path.join(directory, 'fighter.mjs'); fs.writeFileSync(fighterPath, fighter, {flag:'wx'});
const originalHarness = fs.readFileSync(harnessURL, 'utf8');
assert.equal(originalHarness.split('../../src/fighter.js').length, 2);
const harness = rewrite(originalHarness, harnessURL, specifier => specifier === '../../src/fighter.js' ? pathToFileURL(fighterPath).href : null);
const harnessPath = path.join(directory, 'harness.mjs'); fs.writeFileSync(harnessPath, harness, {flag:'wx'});
const generation = {directory, originalFighterSHA256:sha(originalFighter), generatedFighterSHA256:sha(fighter), originalHarnessSHA256:sha(originalHarness), generatedHarnessSHA256:sha(harness), markers, importRewriteOnlyExceptReadOnlyMarkers:true};
const {newRound, DT, THREE, RAPIER, handPos, CONFIG} = await import(pathToFileURL(harnessPath).href);
assert.equal(DT, reference.dt);
const V = value => new THREE.Vector3(value.x, value.y, value.z), Q = value => new THREE.Quaternion(value.x, value.y, value.z, value.w);
const point = (body, local) => V(local).applyQuaternion(Q(body.rotation())).add(V(body.translation()));
const copy = value => value?.isVector3 || value?.isQuaternion ? value.toArray() : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, part]) => [key, copy(part)])) : value;
const body = b => ({p:V(b.translation()).toArray(),q:Q(b.rotation()).toArray(),v:V(b.linvel()).toArray(),w:V(b.angvel()).toArray(),F:V(b.userForce()).toArray(),T:V(b.userTorque()).toArray()});
function state(G, f) {
  const blade = new THREE.Vector3(0,1,0).applyQuaternion(Q(f.sword.rotation()));
  const w = V(f.sword.angvel()), hand = handPos(f);
  const gaps = f.joints.filter(j => j.joint?.isValid()).map(j => ({name:j.name,gapM:point(j.parent,j.joint.anchor1()).distanceTo(point(j.child,j.joint.anchor2()))}));
  const contacts = [];
  for (const collider of f.swordColliders) G.world.contactPairsWith(collider, other => G.world.contactPair(collider, other, (m, flipped) => {
    if (m.numContacts()) contacts.push({a:collider.handle,b:other.handle,flipped,normal:copy(m.normal()),points:Array.from({length:m.numContacts()},(_,i) => ({distance:m.contactDist(i),normalImpulse:m.contactImpulse(i)}))});
  }));
  const localTarget = f.handTarget.clone().sub(V(f.bodies.chest.translation())).applyQuaternion(Q(f.bodies.chest.rotation()).invert());
  const shoulder = new THREE.Vector3(CONFIG.ARM.shoulder[0],CONFIG.ARM.shoulder[1],f.side*CONFIG.ARM.shoulder[2]);
  const shoulderJoint=f.jointByName.uarmS;
  const actualShoulder=point(shoulderJoint.parent,shoulderJoint.joint.anchor1());
  return {bodies:Object.fromEntries(['sword','farmS','uarmS','chest','pelvis'].map(name => [name,body(name === 'sword' ? f.sword : f.bodies[name])])),
    blade:blade.toArray(),flat:new THREE.Vector3(0,0,1).applyQuaternion(Q(f.sword.rotation())).toArray(),axialRadS:w.dot(blade),relativeAxialRadS:w.clone().sub(V(f.bodies.farmS.angvel())).dot(blade),
    actualHand:hand.toArray(),handTarget:f.handTarget.toArray(),handErrorM:hand.distanceTo(f.handTarget),localTarget:localTarget.toArray(),shoulderToTargetM:localTarget.distanceTo(shoulder),ikReachLimitM:CONFIG.ARM.upper+CONFIG.ARM.fore-CONFIG.ARM.slack,actualShoulder:actualShoulder.toArray(),actualShoulderToTargetM:actualShoulder.distanceTo(f.handTarget),armFull:f.armFull,
    aim:f.debug.aim.toArray(),pad:f.handOffset.toArray(),filteredPad:f.skill.aim.toArray(),yaw:f.yaw.toArray(),tap:!!f.skill.tap,weight:f.skill.thrustPose.w,cap:f.debug.wristCap,wristPreTwist:f.debug.wristTorque.toArray(),
    state:f.state,alive:f.alive,armed:f.armed,armHealth:f.armHealth,muscle:f.muscle,gaps,contacts};
}
let G, tick=-1, stack=0, stages=[], torqueCalls=[], preNative=null, postNative=null;
let pass=false, error=null, validatedNativeSteps=0;
const frames=[], random=Math.random, startedUTC=new Date().toISOString(), started=performance.now(), undo=[];
try {
  G=newRound({seed:7,weapon:'qinggang',weapon2:'longsword',skill:0,difficulty:'normal',onFighter:f=>{f.onehandArmModel='manual';f.thrustEdgeModel='original';}});
  const f=G.player; f.skill.autoGuard=false;
  assert(applyBladeShapeTrial({active:true,model:'profile'},f,RAPIER)); f.thrustEdgeModel='transported';
  assert(!G.ai2 && !G.parkEnemy);
  const creationNative=sha(G.world.takeSnapshot()); assert.equal(creationNative, ref.creationNative);
  setRecutPlaneSink((actor, stage, values) => {
    if (actor !== f || tick < observeStart) return;
    stages.push({stage,values:copy(values),weight:f.skill.thrustPose.w,tap:!!f.skill.tap,
      nativeBladeMidVelocity:V(f.sword.velocityAtPoint(f.bladePoint(.7,new THREE.Vector3()))).toArray()});
  });
  const drive=f.driveSword;
  f.driveSword=function(...args) { stack++;try{return drive.apply(this,args);}finally{stack--;} };
  undo.push(()=>{delete f.driveSword;});
  for (const [name,b] of [['sword',f.sword],['farmS',f.bodies.farmS],['chest',f.bodies.chest]]) {
    const add=b.addTorque;
    b.addTorque=function(t,wake) {
      if (stack && tick >= observeStart) {
        const w=this.angvel();torqueCalls.push({body:name,torque:[t.x,t.y,t.z],omega:[w.x,w.y,w.z],powerW:t.x*w.x+t.y*w.y+t.z*w.z,wake});
      }
      return add.call(this,t,wake);
    };undo.push(()=>{delete b.addTorque;});
  }
  const step=G.world.step;
  G.world.step=function(...args) {
    if (tick >= observeStart) preNative=state(G,f);
    const result=step.apply(this,args);
    if (tick >= observeStart) postNative=state(G,f);
    return result;
  };undo.push(()=>{delete G.world.step;});
  for (tick=0;tick<=end;tick++) {
    const request=ref.frames[tick].inputRequest;
    if(f.alive) { f.handOffset.x+=request.delta[0];f.handOffset.y+=request.delta[1]; }
    f.handHeld=request.held;f.inputActive=request.active;f.move.set(0,0);f.stickX=f.stickY=0;
    const tapAccepted=request.tap&&f.alive?f.skill.thrust():null;
    assert.equal(tapAccepted,ref.frames[tick].tapAccepted,'Tap acceptance '+tick);
    stages=[];torqueCalls=[];preNative=postNative=null;
    G.step();
    const native=sha(G.world.takeSnapshot());assert.equal(native,ref.frames[tick].native,'Full native prefix '+tick);validatedNativeSteps++;
    assert.deepEqual({pad:f.handOffset.toArray(),aim:f.skill.aim.toArray(),held:!!f.handHeld,active:!!f.inputActive,move:f.move.toArray()},ref.frames[tick].p.input,'Applied player input '+tick);
    if(tick>=observeStart) {
      assert.deepEqual(torqueCalls.map(call=>call.body),['sword','farmS','chest'],'Actual final three torque calls');
      const postCombat=state(G,f);assert.equal(postCombat.axialRadS,ref.frames[tick].p.axialRadS);
      frames.push({tick,timeS:G.t,phase:request.phase,request,tapAccepted,native,stages,torqueCalls,preNative,postNative,postCombat,events:{clashes:G.clashes,wounds:G.wounds.map(w=>({timeS:w.t,attacker:w.att.index,victim:w.vic.index,zone:w.zone,type:w.type,energyJ:w.energy,severity:w.severity}))}});
    }
  }
  pass=true;
} catch (e) { error={name:e.name,message:e.message,stack:e.stack};throw e; }
finally {
  setRecutPlaneSink(null); for(const restore of undo.reverse()) restore();
  G?.eventQueue.free();G?.world.free();Math.random=random;
  const sourceAfter=manifest(),sourceStable=JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter);
  fs.writeFileSync(opts.out,JSON.stringify({pass,error,sourceStable,sourceBefore,sourceAfter,reference:{path:opts.reference,bytes:referenceBytes.length,sha256:sha(referenceBytes),sourceCommit:reference.sourceCommit},generation,command:process.argv,startedUTC,completedUTC:new Date().toISOString(),wallSeconds:(performance.now()-started)/1000,dt:DT,observeStart,end,validatedNativeSteps,expectedNativeSteps:end+1,
    scope:'One from-spawn existing public transported/manual/profile Qinggang replay. Original input/normal enemy/engine remain; no gain, body, pose, force, velocity, health, contact, or motor modification. Read-only observer calls in externally archived generated Fighter plus identical-forward native addTorque/world.step wrappers. Full native prefix and supplied/filtered player input must equal existing raw through1210. Explicit torque/power are pre-solver requests, not solved native motor impulse/work. No human naturalness, whole momentum closure, or efficacy claim.',frames},null,2)+'\n',{flag:'wx'});
  assert(sourceStable,'Source changed while replaying');
}
