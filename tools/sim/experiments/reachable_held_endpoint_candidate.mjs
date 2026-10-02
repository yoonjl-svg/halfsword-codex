// Q04 native-geometry IK candidate. No native body/joint/force mutation here.
import * as THREE from 'three';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {ARM} from '../../../src/config.js';
const fighterURL=new URL('../../../src/fighter.js',import.meta.url),sha=x=>createHash('sha256').update(x).digest('hex');
const V=v=>new THREE.Vector3(v.x,v.y,v.z),plain=v=>({x:v.x,y:v.y,z:v.z});
export function readNativeArmGeometry(f){
 const upper=f.jointByName.uarmS,elbow=f.jointByName.farmS,grip=f.gripJoint;
 const shoulder=V(upper.joint.anchor1()),upperVector=V(elbow.joint.anchor1()).sub(V(upper.joint.anchor2())),foreVector=V(grip.anchor1()).sub(V(elbow.joint.anchor2()));
 const a=upperVector.length(),b=foreVector.length(),raw=elbow.joint.rawSet,h=elbow.joint.handle;
 const limits={enabled:raw.jointLimitsEnabled(h,3),minRad:raw.jointLimitsMin(h,3),maxRad:raw.jointLimitsMax(h,3)};
 const radius=angle=>Math.sqrt(a*a+b*b+2*a*b*Math.cos(angle)),outer=radius(limits.minRad),inner=radius(limits.maxRad);
 if(!limits.enabled||limits.minRad<0||limits.maxRad>Math.PI||upperVector.distanceTo(new THREE.Vector3(a,0,0))>1e-7||foreVector.distanceTo(new THREE.Vector3(b,0,0))>1e-7)throw Error('Unsupported native hinge/bone geometry');
 const offUpper=f.jointByName.uarmO,offElbow=f.jointByName.farmO,offA=V(offElbow.joint.anchor1()).sub(V(offUpper.joint.anchor2())).length(),offB=new THREE.Vector3(0,-.135,0).sub(V(offElbow.joint.anchor2())).length();
 return {shoulderLocal:plain(shoulder),upperM:a,foreM:b,physicalOuterM:outer,physicalInnerM:inner,minRequestM:inner+ARM.slack,maxRequestM:outer-ARM.slack,existingSlackM:ARM.slack,hingeLimits:limits,
  nativeAnchors:{shoulderParent:{...upper.joint.anchor1()},shoulderChild:{...upper.joint.anchor2()},elbowParent:{...elbow.joint.anchor1()},elbowChild:{...elbow.joint.anchor2()},gripParent:{...grip.anchor1()},gripChild:{...grip.anchor2()}},
  offArm:{upperM:offA,foreM:offB,shoulderLocal:{...offUpper.joint.anchor1()},radialMaxM:offA+offB-ARM.slack,handLocal:{x:0,y:-.135,z:0},gripAlongM:f.weaponCfg.gripAlong},legacy:{upperM:ARM.upper,foreM:ARM.fore,shoulderLocal:ARM.shoulder.map((v,i)=>i===2?v*f.side:v),maxRequestM:ARM.upper+ARM.fore-ARM.slack}};
}
function once(s,a,b){if(s.split(a).length!==2)throw Error('Reachable held source marker mismatch:'+a);return s.replace(a,b);}
const helpers=`
const reachableHeldStates=new WeakMap();
export function setReachableHeldState(f,{active=false,mode='observe',geometry}={}){
 let s=reachableHeldStates.get(f);if(!s){s={calls:0,activeCalls:0,projectedCalls:0,last:null};reachableHeldStates.set(f,s);}s.active=active;s.mode=mode;s.geometry=geometry;
}
export function reachableHeldInfo(f){const s=reachableHeldStates.get(f);return s?structuredClone({calls:s.calls,activeCalls:s.activeCalls,projectedCalls:s.projectedCalls,last:s.last}):null;}
function reachableHeldConfig(f){const s=reachableHeldStates.get(f);if(!s)throw Error('Set held geometry state before armIK');s.calls++;if(s.active)s.activeCalls++;return s;}
function reachableHeldCapture(f,target,s,shoulder,direction,d,q,c,rawDistance){
 const applied=shoulder.clone().addScaledVector(direction,d).applyQuaternion(q).add(new THREE.Vector3(c.x,c.y,c.z));
 const raw=target.clone(),native=s.active&&['lengthOnly','nativeReach'].includes(s.mode);
 if(s.active&&['projectionOnly','nativeReach'].includes(s.mode)){target.copy(applied);s.projectedCalls++;}
 s.last={active:s.active,mode:s.mode,rawGoal:raw.toArray(),appliedGoal:applied.toArray(),reportedGoal:target.toArray(),rawRequestedDistanceM:rawDistance,appliedRequestedDistanceM:d,
  rawToAppliedM:raw.distanceTo(applied),nativeLengthsUsed:native,maxRequestM:native?s.geometry.maxRequestM:ARM.upper+ARM.fore-ARM.slack,minRequestM:native?s.geometry.minRequestM:.08};
}
`;
export function transformReachableHeldFighter(source){
 const start=source.indexOf('  armIK(target) {'),end=source.indexOf('\n  /**',start);if(start<0||end<0)throw Error('Cannot isolate armIK');let method=source.slice(start,end);
 method=once(method,'    const J = this.jointByName;','    const reachable = reachableHeldConfig(this);\n    const nativeReach = reachable.active && [\'lengthOnly\',\'nativeReach\'].includes(reachable.mode);\n    const J = this.jointByName;');
 method=once(method,'const S = _ik2.set(ARM.shoulder[0], ARM.shoulder[1], this.side * ARM.shoulder[2]);','const S = nativeReach ? _ik2.set(reachable.geometry.shoulderLocal.x,reachable.geometry.shoulderLocal.y,reachable.geometry.shoulderLocal.z) : _ik2.set(ARM.shoulder[0], ARM.shoulder[1], this.side * ARM.shoulder[2]);');
 method=once(method,'const a = ARM.upper;','const a = nativeReach ? reachable.geometry.upperM : ARM.upper;');
 method=once(method,'const b = ARM.fore;','const b = nativeReach ? reachable.geometry.foreM : ARM.fore;');
 method=once(method,'this.armFull = Dl >= a + b - ARM.slack;','this.armFull = Dl >= (nativeReach ? reachable.geometry.maxRequestM : a + b - ARM.slack);');
 method=once(method,'const d = THREE.MathUtils.clamp(Dl, 0.08, a + b - ARM.slack);','const d = THREE.MathUtils.clamp(Dl, nativeReach ? reachable.geometry.minRequestM : 0.08, nativeReach ? reachable.geometry.maxRequestM : a + b - ARM.slack);');
 method=once(method,'    const Dn = D.normalize();','    const Dn = D.normalize();\n    reachableHeldCapture(this,target,reachable,S,Dn,d,_q1,c,Dl);');
 return helpers+source.slice(0,start)+method+source.slice(end);
}
function imports(s){return s.replace(/from (['"])([^'"]+)\1/g,(_,q,p)=>'from '+JSON.stringify(p.startsWith('.')?new URL(p,fighterURL).href:import.meta.resolve(p)));}
export async function loadReachableHeld(){
 const original=await readFile(fighterURL,'utf8'),directory=await mkdtemp(join(tmpdir(),'q04-reachable-held-')),sources={clone:imports(original),observed:imports(transformReachableHeldFighter(original))},modules={};
 try{for(const [n,s] of Object.entries(sources)){const p=join(directory,n+'.mjs');await writeFile(p,s);modules[n]=await import(pathToFileURL(p).href);}return {...modules,sourceHashes:{original:sha(original),...Object.fromEntries(Object.entries(sources).map(([n,s])=>[n,sha(s)]))},cleanup:()=>rm(directory,{recursive:true,force:true})};}catch(e){await rm(directory,{recursive:true,force:true});throw e;}
}
/** Hypothetical endpoint from JS joint target quaternions and actual native anchors. Does not move a body. */
export function forwardNativeArmTarget(f){const chestQ=new THREE.Quaternion().copy(f.bodies.chest.rotation()),upper=f.jointByName.uarmS,elbow=f.jointByName.farmS;
 const upperQ=chestQ.clone().multiply(upper.target),foreQ=upperQ.clone().multiply(elbow.target),shoulder=V(upper.joint.anchor1()).applyQuaternion(chestQ).add(V(f.bodies.chest.translation()));
 return shoulder.add(V(elbow.joint.anchor1()).sub(V(upper.joint.anchor2())).applyQuaternion(upperQ)).add(V(f.gripJoint.anchor1()).sub(V(elbow.joint.anchor2())).applyQuaternion(foreQ));}
