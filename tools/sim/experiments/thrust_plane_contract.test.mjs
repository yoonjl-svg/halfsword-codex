// Pure target/state contract; these fixtures are not combat or anatomy evidence.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {applyTransportedThrustPlane, configureThrustPlaneTrial} from '../../../src/thrust_plane.js';
const V=(x,y,z)=>new THREE.Vector3(x,y,z), Q=()=>new THREE.Quaternion();
const fighter=()=>({yaw:Q(),skill:{tap:{},thrustPose:{w:1}}});
const near=(a,b)=>assert(a.distanceTo(b)<1e-12);
const checks=[];
for(const [name,params,expected] of [
 ['exact','weapon=qinggang&onehandArm=manual&bladeShape=profile&thrustPlane=transported',true],
 ['default','',false],['other weapon','weapon=sabre&onehandArm=manual&bladeShape=profile&thrustPlane=transported',false],
 ['legacy arm','weapon=qinggang&onehandArm=legacy&bladeShape=profile&thrustPlane=transported',false],
 ['box','weapon=qinggang&onehandArm=manual&bladeShape=box&thrustPlane=transported',false],
 ['old Qinggang steady','weapon=qinggang&onehandArm=manual&bladeShape=profile&thrustEdge=steady',false]]) {
 assert.equal(configureThrustPlaneTrial(new URLSearchParams(params)),expected);checks.push(name);
}
const f=fighter(),blade=V(0,1,0),flat=V(0,0,1);
let target=flat.clone();assert(applyTransportedThrustPlane(f,blade,flat,target));near(target,flat);
target=V(1,0,0);applyTransportedThrustPlane(f,blade,flat,target);near(target,flat);checks.push('seed is retained');
f.skill.tap.abort=true;f.skill.thrustPose.w=.25;target=V(1,0,0);
applyTransportedThrustPlane(f,blade,flat,target);near(target,V(.75,0,.25).normalize());checks.push('abort uses existing fade');
for(const flag of ['bound','down']) {
 f.skill.tap[flag]=true;target=V(1,0,0);assert.equal(applyTransportedThrustPlane(f,blade,flat,target),false);near(target,V(1,0,0));
 delete f.skill.tap[flag];f.skill.thrustPose.w=1;target=V(1,0,0);applyTransportedThrustPlane(f,blade,flat,target);near(target,V(1,0,0));checks.push(flag+' leaves target unchanged and clears seed');
}
f.skill.thrustPose.w=0;target=flat.clone();assert.equal(applyTransportedThrustPlane(f,blade,flat,target),false);
f.skill.thrustPose.w=1;target=flat.clone();applyTransportedThrustPlane(f,blade,flat,target);near(target,flat);checks.push('zero weight clears seed');
f.skill.tap={};target=V(1,0,0);applyTransportedThrustPlane(f,blade,flat,target);near(target,V(1,0,0));checks.push('new tap seeds current target');
const turn=new THREE.Quaternion().setFromAxisAngle(V(0,0,1),.6);f.yaw.copy(turn);
target=flat.clone();const movedBlade=blade.clone().applyQuaternion(turn),movedFlat=V(1,0,0).applyQuaternion(turn);
applyTransportedThrustPlane(f,movedBlade,movedFlat,target);near(target,movedFlat);assert(Math.abs(target.dot(movedBlade))<1e-12);checks.push('body yaw transports reference');
const fresh=fighter();target=flat.clone();applyTransportedThrustPlane(fresh,blade,flat,target);near(target,flat);checks.push('fresh fighter has no prior seed');
assert(!('sword' in f));checks.push('pure fixture has no body or solver access');
const result={pass:true,scope:'Pure query/target/state contract, not physics, combat or anatomy acceptance',checks,source:Object.fromEntries(['src/thrust_plane.js','tools/sim/experiments/thrust_plane_contract.test.mjs'].map(n=>[n,createHash('sha256').update(fs.readFileSync(n)).digest('hex')]))};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(result));
