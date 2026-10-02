// Research only; requires the separately built Rapier native motor bindings.
// Keep the coupled native solver and existing hinge. Place the existing gravity
// feedforward inside that same native actuator so its final scalar impulse is capped.
import * as THREE from 'three';
import {elbowGravityFeedforward} from './elbow_actuator_candidate.mjs';

export function installNativeElbow({f,ledger,mode='capped',maxRecords=4096}) {
  if(!['observe','capped'].includes(mode))throw Error('Use observe or capped');
  if(!ledger?.replaceObservedMethod)throw Error('Actual observed dispatch is required');
  const j=f.jointByName.farmS,axis=3;
  if(!j?.joint?.isValid()||j.manual||j.type!=='hinge')throw Error('Expected attached native farmS hinge');
  const raw=j.joint.rawSet,handle=j.joint.handle;
  for(const name of ['jointSetMotorMaxForce','jointMotorMaxForce','jointMotorEnabled','jointMotorImpulse'])
    if(typeof raw[name]!=='function')throw Error('Research native binding unavailable: '+name);
  const originalConfigure=raw.jointConfigureMotor,originalCap=raw.jointMotorMaxForce(handle,axis);
  const records=[],summary={mode,jointRecreated:false,originalCap,nativeCalls:0,explicitGravityCalls:0,measurements:0,
    errors:[],maxLastSubstepCapRatio:0,maxLastSubstepImpulseNms:0,limitedAtLastSubstep:0,
    meaning:'Native farmS PD plus current elbow gravity FF share a scalar axis cap. Other muscles, passive joint limits, and force-velocity realism are separate.',
    readout:'Native getter is the LAST solver substep impulse. It is not total outer-step impulse or work. Substep cap uses outer dt / numSolverIterations for this calibrated engine; never sum by multiplying one readback.'};
  let pending=null,undoGravity,restored=false;
  const configure=function(h,a,target,velocity,k,d) {
    if(h!==handle)return originalConfigure.call(this,h,a,target,velocity,k,d);
    if(a!==axis)throw Error('Unexpected farmS motor axis');
    if(pending)throw Error('Previous native elbow step was not observed');
    const mus=k/(j.k*(j.gain||1)),cap=j.max*mus,ff=elbowGravityFeedforward(f,j);
    if(![target,velocity,k,d,mus,cap,ff.torqueNm,f.lastDt].every(Number.isFinite)||cap<0||f.lastDt<=0)
      throw Error('Invalid captured native elbow request');
    let actualTarget=target;
    if(mode==='capped') {
      if(ff.torqueNm!==0&&k<=0)throw Error('Nonzero FF cannot be represented by a zero-stiffness motor');
      // ForceBased spring k*(target-angle): add the desired FF as a target bias.
      // The native implicit solve, damping, contacts, and cap then apply together.
      actualTarget+=k>0?ff.torqueNm/k:0;
      raw.jointSetMotorMaxForce(h,a,cap);
    }
    const q=j.parent.rotation();
    const n=new THREE.Vector3(0,0,1).applyQuaternion(new THREE.Quaternion(q.x,q.y,q.z,q.w)).normalize();
    const solverIterations=f.world.integrationParameters.numSolverIterations;
    if(!Number.isInteger(solverIterations)||solverIterations<1)throw Error('Unknown solver substep count');
    pending={target,actualTarget,velocity,k,d,mus,cap,feedforwardNm:ff.torqueNm,feedforwardActive:ff.active,
      dt:f.lastDt,solverIterations,lastSubstepDt:f.lastDt/solverIterations,axisWorld:n.toArray(),nativeCap:raw.jointMotorMaxForce(h,a),explicitGravitySuppressed:false};
    summary.nativeCalls++;
    return originalConfigure.call(this,h,a,actualTarget,velocity,k,d);
  };
  raw.jointConfigureMotor=configure;
  if(mode==='capped')undoGravity=ledger.replaceObservedMethod(f,'elbowGravity',function() {
    summary.explicitGravityCalls++;
    if(pending)pending.explicitGravitySuppressed=true;
    // FF is already inside the one native actuator; never apply it a second time.
  });
  return {summary,records,afterStep() {
    if(!pending)return null;
    if(!j.joint.isValid()||j.joint.handle!==handle)throw Error('Elbow detached/replaced before native observation');
    const row={...pending,enabled:raw.jointMotorEnabled(handle,axis),lastSubstepImpulseNms:raw.jointMotorImpulse(handle,axis)};
    row.lastSubstepCapRatio=row.cap>0?Math.abs(row.lastSubstepImpulseNms)/(row.cap*row.lastSubstepDt):row.lastSubstepImpulseNms===0?0:null;
    if(!Number.isFinite(row.lastSubstepImpulseNms)||!row.enabled)throw Error('Missing actual enabled motor writeback');
    if(mode==='capped'&&(!row.explicitGravitySuppressed||Math.abs(row.lastSubstepImpulseNms)>row.cap*row.lastSubstepDt+2e-6))
      throw Error('Combined native motor cap/FF dispatch failed');
    summary.measurements++;summary.maxLastSubstepCapRatio=Math.max(summary.maxLastSubstepCapRatio,row.lastSubstepCapRatio??Infinity);
    summary.maxLastSubstepImpulseNms=Math.max(summary.maxLastSubstepImpulseNms,Math.abs(row.lastSubstepImpulseNms));
    if(row.lastSubstepCapRatio>=.9999)summary.limitedAtLastSubstep++;
    if(records.length<maxRecords)records.push(row);pending=null;return row;
  },restore() {
    if(restored||raw.jointConfigureMotor!==configure)throw Error('Native elbow restore requires current ownership');
    undoGravity?.();raw.jointConfigureMotor=originalConfigure;
    if(mode==='capped'&&j.joint.isValid())raw.jointSetMotorMaxForce(handle,axis,originalCap);
    restored=true;
  }};
}
