// Second and final frozen-state screen for this batch; never runs game physics.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {continueCutPlane} from './p4_continued_plane_candidate.mjs';

const options=Object.fromEntries(process.argv.slice(2).map(s=>{const m=/^--(old|native|out)=(.+)$/.exec(s);assert(m);return[m[1],m[2]];}));
assert(options.old&&options.native&&options.out&&!fs.existsSync(options.out));
const sha=b=>createHash('sha256').update(b).digest('hex'),V=a=>new THREE.Vector3(...a);
const bytesOld=fs.readFileSync(options.old),bytesNative=fs.readFileSync(options.native);
const old=JSON.parse(bytesOld),native=JSON.parse(bytesNative);assert(old.pass&&native.pass&&native.sourceStable);
const signed=(a,b,axis)=>Math.atan2(new THREE.Vector3().crossVectors(a,b).dot(axis),a.dot(b));
const carry=(a,from,to)=>a.clone().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(from,to));
const deg=x=>x*180/Math.PI;

// Sign-invariant weighted plane tensor, followed by the ORIGINAL signed-normal
// positional torque. This is not the rejected sum of plane-potential torques:
// it uses that tensor's principal orientation as a target, preserving the old
// position torque law. Equal orthogonal planes remain an actual degeneracy.
function tensorGoal(flat,blade,rest,motion,moving){
  const c0=flat.dot(rest),s0=new THREE.Vector3().crossVectors(flat,rest).dot(blade);
  const c1=flat.dot(motion),s1=new THREE.Vector3().crossVectors(flat,motion).dot(blade);
  const x=(1-moving)*(c0*c0-s0*s0)+moving*(c1*c1-s1*s1);
  const y=2*((1-moving)*c0*s0+moving*c1*s1);
  const confidence=Math.hypot(x,y),angle=confidence<1e-12?0:.5*Math.atan2(y,x);
  return {target:flat.clone().applyAxisAngle(blade,angle).normalize(),confidence};
}
const fixtures=[{name:'archivedQinggangB',frames:old.frames.map(f=>{
  const s=Object.fromEntries(f.stages.map(x=>[x.stage,x]));const a=s.beforeMotion.values,b=s.beforeTransport.values;
  return {tick:f.tick,phase:f.phase,blade:a.blade,flat:a.flat,rest:a.flatTarget,edgeVelocity:a.edgeDir,legacyTarget:b.flatTarget,moving:b.moving,thrustWeight:s.afterTransport.weight};
})},...native.rows.filter(r=>r.mode==='legacy').map(r=>({name:'ordinaryR2-'+r.weapon,frames:r.frames.filter(f=>f.plane).map(f=>({...f.plane,tick:f.tick,phase:f.phase,thrustWeight:f.actual.thrustWeight}))}))];
const rows=fixtures.map(fixture=>{
  let previous=null;const frames=fixture.frames.map(frame=>{
    const flat=V(frame.flat),blade=V(frame.blade),rest=V(frame.rest),motion=new THREE.Vector3().crossVectors(blade,V(frame.edgeVelocity)).normalize();
    const {target,confidence}=tensorGoal(flat,blade,rest,motion,frame.moving),legacy=V(frame.legacyTarget);
    const torque=new THREE.Vector3().crossVectors(flat,target).dot(blade),legacyTorque=new THREE.Vector3().crossVectors(flat,legacy).dot(blade);
    const row={tick:frame.tick,phase:frame.phase,thrustWeight:frame.thrustWeight,moving:frame.moving,confidence,
      targetSlewDeg:previous?deg(signed(carry(previous.target,previous.blade,blade),target,blade)):0,
      legacySlewDeg:previous?deg(signed(carry(previous.legacy,previous.blade,blade),legacy,blade)):0,
      signedErrorDeg:deg(signed(flat,target,blade)),legacyErrorDeg:deg(signed(flat,legacy,blade)),
      normalizedTorque:torque,legacyNormalizedTorque:legacyTorque,
      torqueDelta:previous?torque-previous.torque:0,legacyTorqueDelta:previous?legacyTorque-previous.legacyTorque:0};
    previous={target,legacy,blade,torque,legacyTorque};return row;
  });
  const max=(key)=>Math.max(...frames.map(f=>Math.abs(f[key])));
  return {fixture:fixture.name,frames,maximumTargetSlewDeg:max('targetSlewDeg'),maximumLegacySlewDeg:max('legacySlewDeg'),
    maximumNormalizedTorqueDelta:max('torqueDelta'),maximumLegacyNormalizedTorqueDelta:max('legacyTorqueDelta'),
    firstLargeTorqueReversal:frames.find((f,i)=>i&&f.normalizedTorque*frames[i-1].normalizedTorque<0&&Math.abs(f.torqueDelta)>1)?.tick??null};
});
const X=new THREE.Vector3(1,0,0),Y=new THREE.Vector3(0,1,0),Z=new THREE.Vector3(0,0,1);
const unitFixtures=[];
for(const moving of [0,.5,1])for(const kind of ['ordinary','exactPerpendicular','zeroVelocity']){
  const rest=kind==='exactPerpendicular'?Y.clone():X.clone();
  const edge=kind==='zeroVelocity'?new THREE.Vector3():new THREE.Vector3(.6,-.8,0);
  const reference=X.clone(),baselineState=()=>({p4ContinuedPlane:{target:reference.clone(),blade:Z.clone()}});
  const result=continueCutPlane(baselineState(),X.clone(),rest.clone(),edge.clone(),Z,moving);
  const opposite=continueCutPlane(baselineState(),X.clone(),rest.clone().negate(),edge.clone().negate(),Z,moving);
  const motion=new THREE.Vector3().crossVectors(Z,edge).normalize();
  const a=tensorGoal(X,Z,rest,motion,moving),b=tensorGoal(X,Z,rest.clone().negate(),motion.clone().negate(),moving);
  unitFixtures.push({moving,kind,continuedLength:result.length(),continuedSignRepresentationDifference:result.distanceTo(opposite),
    tensorLength:a.target.length(),tensorSignRepresentationDifference:a.target.distanceTo(b.target),tensorConfidence:a.confidence,
    note:kind==='zeroVelocity'&&moving>0?'Outside live contract: zero speed makes moving=0. Diagnostic only.':null});
}
const intrinsicSeams=[];
for(const angle of [89.999,90,90.001]){
  const motion=X.clone().applyAxisAngle(Z,angle*Math.PI/180),result=tensorGoal(X,Z,X,motion,1);
  intrinsicSeams.push({kind:'actual-flat90',angleDeg:angle,targetErrorDeg:deg(signed(X,result.target,Z)),
    normalizedTorque:new THREE.Vector3().crossVectors(X,result.target).dot(Z),confidence:result.confidence});
}
for(const moving of [.499999,.5,.500001]){
  const result=tensorGoal(X,Z,X,Y,moving);
  intrinsicSeams.push({kind:'equalOrthogonalPlanes',moving,targetErrorDeg:deg(signed(X,result.target,Z)),
    normalizedTorque:new THREE.Vector3().crossVectors(X,result.target).dot(Z),confidence:result.confidence});
}
const result={schemaVersion:1,pureDerivation:true,physicsSteps:0,effectAccepted:false,
  mechanism:'Sign-invariant weighted plane tensor chooses goal; original cross(flat,target) positional torque remains. No memory, force scaling or delay.',
  sources:[{path:options.old,bytes:bytesOld.length,sha256:sha(bytesOld)},{path:options.native,bytes:bytesNative.length,sha256:sha(bytesNative)}],
  producerSHA256:sha(fs.readFileSync(new URL(import.meta.url))),candidateSHA256:sha(fs.readFileSync(new URL('p4_continued_plane_candidate.mjs',import.meta.url))),
  limits:'Frozen states only. Active thrust transport is not replayed. Unit fixtures distinguish exact sign representation and undefined zero-speed/moving>0 combinations from live reachable behavior.',
  rows,unitFixtures,intrinsicSeams,decision:'Do not run candidate physics when the retained actual-flat or equal-orthogonal boundary still introduces a positional torque jump.'};
fs.writeFileSync(options.out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({rows:rows.map(({frames,...summary})=>summary),unitFixtures,intrinsicSeams}));
