// Research only: regularize requested trajectories, never physical body velocities.
import * as THREE from 'three';
import {collectSupportContacts} from '../../../src/support_contacts.js';

export const LEG_NAMES=['thighF','shinF','footF','thighB','shinB','footB'];
const up=new THREE.Vector3(0,1,0),ankleLocal=new THREE.Vector3(-.05,.035,0);
const Q=q=>new THREE.Quaternion(q.x,q.y,q.z,q.w),V=p=>new THREE.Vector3(p.x,p.y,p.z);
export function rotationVector(q){q=q.clone().normalize();if(q.w<0)q.set(-q.x,-q.y,-q.z,-q.w);const s=Math.hypot(q.x,q.y,q.z);return s<1e-12?new THREE.Vector3():new THREE.Vector3(q.x,q.y,q.z).multiplyScalar(2*Math.atan2(s,q.w)/s);}
function exp(v){const n=v.length();return n<1e-12?new THREE.Quaternion():new THREE.Quaternion().setFromAxisAngle(v.clone().multiplyScalar(1/n),n);}
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(10+t*(-15+6*t));};
// Called after the real applyPose. State is observer/controller target history only.
export function noteTargetHistory(f,dt){
  const prior=f.recoveryHandoffHistory,targets=Object.fromEntries(LEG_NAMES.map(n=>[n,f.jointByName[n].target.toArray()]));
  f.recoveryHandoffHistory={state:f.state,targets,rates:Object.fromEntries(LEG_NAMES.map(n=>[n,prior?rotationVector(new THREE.Quaternion().fromArray(targets[n]).multiply(new THREE.Quaternion().fromArray(prior.targets[n]).invert())).multiplyScalar(1/dt).toArray():[0,0,0]]))};
}
export function beginHandoff(g,options){
  g.recoveryHandoffProbe??={updateCalls:0,enterCalls:0,handoffs:0,targetApplications:0,pivotApplications:0,unsupportedPivotReleases:0};
  g.recoveryHandoffProbe.enterCalls++;
  const f=g.f,h=f.recoveryHandoffHistory;
  g.recoveryHandoffPlan=null;
  if(!g.started||f.state!=='stand'||h?.state!=='getup'||options.variant==='clone')return;
  const contacts=collectSupportContacts(f,{detail:true});
  const plan={variant:options.variant,duration:options.duration,targets:Object.fromEntries(LEG_NAMES.map(n=>[n,f.jointByName[n].target.clone()])),rates:h.rates,
    prevRV:Object.fromEntries(LEG_NAMES.map(n=>[n,f.jointByName[n].prevRV])),feet:{}};
  for(const k of ['F','B']){
    const name='foot'+k,body=f.bodies[name],q=Q(body.rotation()),center=V(body.translation());
    const points=contacts.groups[name].contacts.filter(c=>c.hasSupport).flatMap(c=>c.solverPoints.filter(p=>p.withinSlop).map(p=>p.point));
    if(!contacts.groups[name].hasSupport||!points.length)continue;
    // Observed support point, not an invented flat-ground point. Average patch points.
    const pivot=points.reduce((v,p)=>v.add(V(p)),new THREE.Vector3()).multiplyScalar(1/points.length);
    plan.feet[k]={pivot,pivotLocal:pivot.clone().sub(center).applyQuaternion(q.clone().invert()),q0:q};
  }
  g.recoveryHandoffPlan=plan;g.recoveryHandoffProbe.handoffs++;
  g.recoveryHandoffProbe.lastBegin={variant:plan.variant,duration:plan.duration,supportedFeet:Object.keys(plan.feet),incomingRates:h.rates};
}
export function finishHandoffEnter(g){
  const plan=g.recoveryHandoffPlan;if(!plan)return;
  if(plan.variant==='targetBlend'){
    // Original enter clears prevRV to suppress a jump. This candidate supplies a
    // continuous target, so retain the actual prior target for finite differences.
    for(const n of LEG_NAMES)g.f.jointByName[n].prevRV=plan.prevRV[n];
  }
  if(plan.variant==='contactPivot')for(const [k,p] of Object.entries(plan.feet)){
    const l=g.legs[k],flat=new THREE.Quaternion().setFromAxisAngle(up,l.yaw);
    l.plant.copy(p.pivot).add(ankleLocal.clone().sub(p.pivotLocal).applyQuaternion(flat));
  }
}
export function applyHandoffAnkle(g,l,out){
  const plan=g.recoveryHandoffPlan,p=plan?.feet[l.k];
  if(plan?.variant!=='contactPivot'||!p)return;
  if(!l.stance||!collectSupportContacts(g.f,{detail:false}).groups[l.foot].hasSupport){delete plan.feet[l.k];g.recoveryHandoffProbe.unsupportedPivotReleases++;return;}
  const u=g.sinceEnter/plan.duration;
  if(u>=1)return;
  const destination=new THREE.Quaternion().setFromAxisAngle(up,l.yaw).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),-l.heel));
  p.desiredWorld=p.q0.clone().slerp(destination,smooth(u));
  out.copy(p.pivot).add(ankleLocal.clone().sub(p.pivotLocal).applyQuaternion(p.desiredWorld));
  g.recoveryHandoffProbe.pivotApplications++;
}
export function finishHandoffTargets(g){
  const plan=g.recoveryHandoffPlan;if(!plan||g.f.state!=='stand')return;
  const u=g.sinceEnter/plan.duration;if(u>=1)return;
  if(plan.variant==='targetBlend'){
    const w=smooth(u),t=g.sinceEnter;
    for(const n of LEG_NAMES){const destination=g.f.jointByName[n].target.clone(),carry=exp(new THREE.Vector3().fromArray(plan.rates[n]).multiplyScalar(t)).multiply(plan.targets[n]);g.f.jointByName[n].target.copy(carry.slerp(destination,w));}
    g.recoveryHandoffProbe.targetApplications++;
  }
  if(plan.variant==='contactPivot')for(const [k,p] of Object.entries(plan.feet)){
    const l=g.legs[k];if(!l.stance||!p.desiredWorld)continue;
    const J=g.f.jointByName,shinWorld=Q(g.f.bodies.pelvis.rotation()).multiply(J[l.thigh].target).multiply(J[l.shin].target);
    J[l.foot].target.copy(shinWorld.invert().multiply(p.desiredWorld));
  }
}
export function transformRecoveryHandoffGait(source,{variant='clone',duration=.35}={}){
  if(!['clone','targetBlend','contactPivot'].includes(variant)||!(duration>0&&Number.isFinite(duration)))throw Error('Unknown handoff trajectory variant');
  const markers=[['  enter() {','  enter() {\n    beginHandoff(this, '+JSON.stringify({variant,duration})+');'],
    ['    this.resetRates();\n  }','    this.resetRates();\n    finishHandoffEnter(this);\n  }'],
    ['  update(dt, want, fwd, rgt) {','  update(dt, want, fwd, rgt) {\n    this.recoveryHandoffProbe ??= {updateCalls:0,enterCalls:0,handoffs:0,targetApplications:0,pivotApplications:0,unsupportedPivotReleases:0};\n    this.recoveryHandoffProbe.updateCalls++;'],
    ['        _a.copy(l.plant);','        _a.copy(l.plant);\n        applyHandoffAnkle(this, l, _a);'],
    ['\n  /** 내딛는 발목을 목표(a)로 당기는 힘','\n  /** 내딛는 발목을 목표(a)로 당기는 힘']];
  for(const [marker,replacement] of markers.slice(0,4)){if(source.split(marker).length!==2)throw Error('Expected unique source marker: '+marker);source=source.replace(marker,replacement);}
  const end='\n  /** 내딛는 발목을 목표(a)로 당기는 힘';
  if(source.split(end).length!==2)throw Error('Expected poseLegs boundary once');
  const index=source.indexOf(end),prefix=source.slice(0,index),tail=source.slice(index);
  if(!prefix.endsWith('  }\n'))throw Error('poseLegs method boundary changed');
  source=prefix.slice(0,-4)+'    finishHandoffTargets(this);\n  }\n'+tail;
  return 'import {beginHandoff,finishHandoffEnter,applyHandoffAnkle,finishHandoffTargets} from '+JSON.stringify(import.meta.url)+';\n'+source;
}
