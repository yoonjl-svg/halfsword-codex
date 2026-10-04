// Frozen-state target diagnostics only. Imports THREE, never Rapier/a game world.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {applyCoherentMovingPlane} from './recut_plane_coherent_rejected.mjs';
const opts=Object.fromEntries(process.argv.slice(2).map(s=>{const m=/^--(observed|out)=(.+)$/.exec(s);assert(m);return[m[1],m[2]];}));
assert(opts.observed&&opts.out&&!fs.existsSync(opts.out));
const bytes=fs.readFileSync(opts.observed),saved=JSON.parse(bytes);assert(saved.pass&&saved.sourceStable);
const sha=b=>createHash('sha256').update(b).digest('hex'),V=a=>new THREE.Vector3(...a);
const carry=(v,oldBlade,newBlade)=>v.clone().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(oldBlade,newBlade));
const signed=(a,b,blade)=>Math.atan2(new THREE.Vector3().crossVectors(a,b).dot(blade),a.dot(b))*180/Math.PI;
const candidates=['legacy','restHemisphereRejected','temporalPreviousOutput','temporalBeforeFinalSign'];
const rows=candidates.map(model=>{
  let previous=null;const frames=[];
  for(const savedFrame of saved.frames) {
    const s=Object.fromEntries(savedFrame.stages.map(x=>[x.stage,x.values]));
    const blade=V(s.beforeMotion.blade),flat=V(s.beforeMotion.flat),rest=V(s.beforeMotion.flatTarget),edge=V(s.beforeMotion.edgeDir),moving=s.beforeTransport.moving;
    let target=rest.clone(),reference=null;
    if(model==='legacy') target=V(s.beforeTransport.flatTarget);
    else if(model==='restHemisphereRejected') applyCoherentMovingPlane(target,flat,blade,edge,moving);
    else {
      reference=previous?carry(previous.reference,previous.blade,blade):V(s.beforeTransport.flatTarget);
      if(target.dot(reference)<0) target.negate();
      const mf=edge.crossVectors(blade,edge).normalize();
      if(mf.dot(reference)<0) mf.negate();
      target.lerp(mf,moving);if(target.lengthSq()<1e-4)target.copy(mf);target.normalize();
    }
    const beforeFinalSign=target.clone(),finalSignFlipped=model!=='legacy'&&target.dot(flat)<0;
    if(finalSignFlipped)target.negate();
    frames.push({tick:savedFrame.tick,weight:savedFrame.stages.find(x=>x.stage==='afterTransport').weight,moving,
      target:target.toArray(),targetSignedErrorDeg:signed(flat,target,blade),targetSlewDeg:previous?signed(carry(previous.target,previous.blade,blade),target,blade):null,
      beforeFinalSignTargetSlewDeg:previous?signed(carry(previous.beforeFinalSign,previous.blade,blade),beforeFinalSign,blade):null,
      finalSignFlipped,reference:reference?.toArray()??null});
    previous={target:target.clone(),beforeFinalSign,reference:model==='temporalBeforeFinalSign'?beforeFinalSign.clone():target.clone(),blade:blade.clone()};
  }
  return {model,frames,maxTargetSlewDeg:Math.max(...frames.map(f=>Math.abs(f.targetSlewDeg??0))),maxTargetErrorDeg:Math.max(...frames.map(f=>Math.abs(f.targetSignedErrorDeg))),finalSignFlipTicks:frames.filter(f=>f.finalSignFlipped).map(f=>f.tick)};
});
// A continuous raw normal can cross the retained final actual-flat nearest seam.
const boundaryRows=[89,89.999,90,90.001,91].map(deg=>{
  const theta=deg*Math.PI/180,flat=new THREE.Vector3(1,0,0),blade=new THREE.Vector3(0,0,1),raw=new THREE.Vector3(Math.cos(theta),Math.sin(theta),0),out=raw.clone();if(out.dot(flat)<0)out.negate();
  return {rawAngleDeg:deg,chosenSignedErrorDeg:signed(flat,out,blade),positionTorqueNormalized:new THREE.Vector3().crossVectors(flat,out).dot(blade)};
});
fs.writeFileSync(opts.out,JSON.stringify({schemaVersion:1,pureDerivation:true,newPhysicsSteps:0,
  observed:{path:opts.observed,bytes:bytes.length,sha256:sha(bytes)},producerSHA256:sha(fs.readFileSync(new URL(import.meta.url))),rejectedHelperSHA256:sha(fs.readFileSync(new URL('recut_plane_coherent_rejected.mjs',import.meta.url))),
  contract:'Use the 23 recorded baseline body/q/yaw/velocity states; no updated body feedback. Temporal seed is the recorded beforeTransport ordinary target at1188. Parallel-transport previous reference by minimum actual blade rotation. Sign-select both current rest/movement raw normals against that reference, lerp by existing moving weight, normalize, then retain actual-flat nearest final sign. Two rows distinguish storing the previous chosen output vs its pre-final-sign normal. No new dt, gain, threshold, or physics.',
  limits:'These are pre-thrust-transport ordinary targets. Weight>0 rows do not replay the transported WeakMap/blend with changed inputs. Weight0 rows are frozen-state targets, not new trajectories or inertia/feel acceptance. Startup history before1188 is not reconstructed. Final sign at90 degrees can still reverse the existing position torque.',
  rows,finalActualFlatNinetyDegreeCounterexample:boundaryRows},null,2)+'\n',{flag:'wx'});
