/** Research only: farmS native hinge PD and elbow gravity FF share one torque cap.
 * Uses the free-pair implicit PD equation reviewed in bounded_joint_motor.mjs.
 * Native contacts/neighbor joints are absent from its mobility; it is not equivalent
 * to Rapier's coupled solver, and the unsuccessful bounded-leg work is not adopted.
 * Captured native tz/vz preserve position clipping/Hill and prevRV reset semantics.
 * The final PD+FF cap is j.max*mus; this is not a complete force-velocity correction.
 */
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {createHash} from 'node:crypto';

const V=v=>new THREE.Vector3(v.x,v.y,v.z),Q=q=>new THREE.Quaternion(q.x,q.y,q.z,q.w);
const plain=v=>({x:v.x,y:v.y,z:v.z});
const hash=x=>createHash('sha256').update(typeof x==='string'||ArrayBuffer.isView(x)?x:JSON.stringify(x)).digest('hex');
const axisZ=new THREE.Vector3(0,0,1);
// Match Fighter.toRotVec, including its small-angle and quaternion sign policy.
function rotationVector(q){const w=Math.min(1,Math.abs(q.w)),s=Math.sqrt(1-w*w);return s<1e-6?new THREE.Vector3():V(q).multiplyScalar((q.w<0?-1:1)*2*Math.acos(w)/s);}
function inverseMobility(body,n){const I=body.effectiveWorldInvInertia();return n.x*(I.m11*n.x+I.m12*n.y+I.m13*n.z)+n.y*(I.m21*n.x+I.m22*n.y+I.m23*n.z)+n.z*(I.m31*n.x+I.m32*n.y+I.m33*n.z);}
function physical(body){return {p:plain(body.translation()),q:{...body.rotation()},v:plain(body.linvel()),w:plain(body.angvel()),m:body.mass(),I:plain(body.principalInertia()),F:plain(body.userForce()),T:plain(body.userTorque()),sleeping:body.isSleeping()};}
function bodySignature(f){return Object.fromEntries([...Object.entries(f.bodies),['sword',f.sword]].map(([n,b])=>[n,physical(b)]));}
function inputSignature(f,j){return {target:{...j.target},prevRV:j.prevRV?plain(j.prevRV):null,k:j.k,d:j.d,max:j.max,gain:j.gain??null,muscle:f.muscle,strength:f.strength,limbs:{...f.limbs},state:f.state,lastDt:f.lastDt??null};}

/** lambdaPD=[k(tz-theta)+(d+dt*k)(vz-w)]/[1+a(dt*d+dt²k)].
 * Current gravity feedforward is added AFTER that denominator, retaining its
 * existing explicit definition; then the whole lambdaPD+FF is bounded once.
 */
export function boundedElbowTorque({parent,child,restInv=new THREE.Quaternion(),targetAngle,targetVelocity,k,d,maxTorque,dt,gravityFFNm=0}){
  if(![targetAngle,targetVelocity,k,d,maxTorque,dt,gravityFFNm].every(Number.isFinite)||k<0||d<0||maxTorque<0||dt<=0)throw new TypeError('Finite native inputs and nonnegative muscle parameters required');
  // Rapier rotations are Float32; renormalize the geometric hinge direction so
  // scalar Nm equals the actual paired torque-vector magnitude. Native tz/vz
  // and the inherited gravity FF calculation are preserved without alteration.
  const qp=Q(parent.rotation()),qc=Q(child.rotation()),axis=axisZ.clone().applyQuaternion(qp).normalize();
  const theta=rotationVector(Q(restInv).multiply(qp.clone().invert().multiply(qc))).z;
  const relativeOmega=V(child.angvel()).sub(V(parent.angvel())).dot(axis);
  const a=inverseMobility(parent,axis)+inverseMobility(child,axis);
  const denominator=1+a*(dt*d+dt*dt*k);
  const pdNm=(k*(targetAngle-theta)+(d+dt*k)*(targetVelocity-relativeOmega))/denominator;
  const requestedNm=pdNm+gravityFFNm,appliedSignedNm=THREE.MathUtils.clamp(requestedNm,-maxTorque,maxTorque);
  if(![theta,relativeOmega,a,denominator,pdNm,requestedNm,appliedSignedNm].every(Number.isFinite)||a<0)throw new Error('Invalid native elbow mobility/state');
  return {thetaRad:theta,relativeOmegaRadS:relativeOmega,mobility:a,denominator,pdNm,gravityFFNm,requestedSignedNm:requestedNm,
    appliedSignedNm,appliedNm:Math.abs(appliedSignedNm),capNm:maxTorque,limited:Math.abs(requestedNm)>maxTorque,
    torqueNm:plain(axis.clone().multiplyScalar(appliedSignedNm)),axisWorld:plain(axis)};
}

/** Exact current elbowGravity FF computation, without applying a second torque. */
export function elbowGravityFeedforward(f,j){
  if(f.detachedParts?.has('farmS')||f.muscle<.12||f.state==='dead')return {torqueNm:0,active:false,mus:0};
  const gravity=new THREE.Vector3();
  f.gravityTorque([j.child,f.armed?f.sword:null],j.parent,.15,gravity);
  const axis=axisZ.clone().applyQuaternion(Q(j.parent.rotation()));
  const mus=Math.min(1,Math.max(.1,f.muscle)*(.3+.7*f.limbs.armS)*f.strength);
  return {torqueNm:-gravity.dot(axis)*mus,active:true,mus};
}
function jointSpec(joint){const raw=joint.rawSet,axis=3;return {anchor1:{...joint.anchor1()},anchor2:{...joint.anchor2()},frame1:{...joint.frameX1()},frame2:{...joint.frameX2()},contacts:joint.contactsEnabled(),limits:{enabled:raw.jointLimitsEnabled(joint.handle,axis),min:raw.jointLimitsMin(joint.handle,axis),max:raw.jointLimitsMax(joint.handle,axis)}};}
function sameQuaternion(a,b){return Math.abs(a.x*b.x+a.y*b.y+a.z*b.z+a.w*b.w)>1-1e-6;}

/** Install while the ledger/game is idle. Observe never recreates or changes dispatch.
 * Recreate resets native solver history but forwards the original native motor/FF.
 * Bounded creates a genuinely never-configured motor and replaces elbowGravity's
 * observed dispatch. Restoring removes interception and restores future native force
 * motor configuration; the recreated joint and lost solver history remain.
 */
export function installElbowActuator({G,f,ledger,mode='bounded',maxRecords=4096}){
  if(!['observe','recreate','bounded'].includes(mode)||!Number.isInteger(maxRecords)||maxRecords<0)throw new TypeError('Invalid elbow mode/record budget');
  if(mode==='bounded'&&typeof ledger?.replaceObservedMethod!=='function')throw new Error('Bounded elbow requires an installed force ledger with observed dispatch');
  const j=f.jointByName.farmS;
  if(!j||j.manual||j.type!=='hinge'||!j.joint.isValid())throw new Error('Expected attached native farmS hinge');
  const bodyBefore=bodySignature(f),inputBefore=inputSignature(f,j),nativeBefore=hash(G.world.takeSnapshot());
  const oldJoint=j.joint,specBefore=jointSpec(oldJoint);
  if(mode!=='observe'){
    const data=RAPIER.JointData.revolute(specBefore.anchor1,specBefore.anchor2,{x:0,y:0,z:1});
    G.world.removeImpulseJoint(oldJoint,false);
    const fresh=G.world.createImpulseJoint(data,j.parent,j.child,false);fresh.setContactsEnabled(specBefore.contacts);
    if(specBefore.limits.enabled)fresh.rawSet.jointSetLimits(fresh.handle,3,specBefore.limits.min,specBefore.limits.max);
    if(!sameQuaternion(specBefore.frame1,fresh.frameX1())||!sameQuaternion(specBefore.frame2,fresh.frameX2()))throw new Error('farmS native local frames changed');
    if(mode==='recreate')fresh.rawSet.jointConfigureMotorModel(fresh.handle,3,1);
    j.joint=fresh;
  }
  const specAfter=jointSpec(j.joint),bodyAfter=bodySignature(f),inputAfter=inputSignature(f,j);
  if(JSON.stringify(bodyBefore)!==JSON.stringify(bodyAfter)||JSON.stringify(inputBefore)!==JSON.stringify(inputAfter))throw new Error('Elbow installation changed native body/control state');
  const records=[],summary={mode,bodyStatePreserved:true,controlStatePreserved:true,bodyBeforeSHA256:hash(bodyBefore),bodyAfterSHA256:hash(bodyAfter),
    previousInputSHA256:hash(inputBefore),inputAfterSHA256:hash(inputAfter),previousInput:inputBefore,nativeBeforeSHA256:nativeBefore,
    nativeAfterSHA256:hash(G.world.takeSnapshot()),specBefore,specAfter,jointRecreated:mode!=='observe',
    nativeCallsIntercepted:0,nativeCallsForwarded:0,nativeMotorModelConfigured:mode==='recreate',actuatorCalls:0,targetVelocityResets:0,
    limitedCalls:0,maxAppliedNm:0,maxCapRatio:0,maxRequestedNm:0,maxGravityFFNm:0,recordsDropped:0,
    definition:'Only total explicit farmS PD+current gravity FF torque is bounded by j.max*mus; inherited position Hill is in tz. Passive constraints, other actuators and full force-velocity realism are outside this bound.',
    previousNativeMotorParameters:'Rapier has no motor parameter readback here; actual configure inputs are intercepted; prior target/prevRV/control state is preserved.'};
  const raw=j.joint.rawSet,originalConfigure=raw.jointConfigureMotor;
  let pending=null,lastPrevRV=j.prevRV,undone=false,undoDispatch=null;
  const configure=function(handle,axis,targetAngle,targetVelocity,k,d){
    if(handle!==j.joint.handle)return originalConfigure.call(this,handle,axis,targetAngle,targetVelocity,k,d);
    if(axis!==3)throw new Error('Unexpected farmS native motor axis');
    const mus=k/(j.k*(j.gain||1)),reset=lastPrevRV!==j.prevRV;
    const request={targetAngle,targetVelocity,k,d,maxTorque:j.max*mus,dt:f.lastDt,mus,gain:j.gain||1,targetVelocityReset:reset,
      previousRV:j.prevRV?plain(j.prevRV):null,targetQuaternion:{...j.target},bodyAtNativeCallSHA256:hash([physical(j.parent),physical(j.child)])};
    summary.nativeCallsIntercepted++;summary.targetVelocityResets+=+reset;lastPrevRV=j.prevRV;
    if(mode==='bounded'){if(pending)throw new Error('Multiple unconsumed farmS native requests');pending=request;return;}
    summary.nativeCallsForwarded++;summary.lastNativeInput=request;
    if(records.length<maxRecords)records.push({nativeInput:request});else summary.recordsDropped++;
    return originalConfigure.call(this,handle,axis,targetAngle,targetVelocity,k,d);
  };
  raw.jointConfigureMotor=configure;
  if(mode==='bounded')undoDispatch=ledger.replaceObservedMethod(f,'elbowGravity',function(){
    if(this!==f)throw new Error('Elbow observed receiver changed');
    const request=pending;pending=null;
    if(!request)return; // Detached joint or no drive call: no new actuator work.
    const ff=elbowGravityFeedforward(f,j);
    const result=boundedElbowTorque({...request,parent:j.parent,child:j.child,restInv:j.restInv,gravityFFNm:ff.torqueNm});
    const t=result.torqueNm;
    j.child.addTorque(t,true);j.parent.addTorque({x:-t.x,y:-t.y,z:-t.z},true);
    const ratio=result.capNm>0?result.appliedNm/result.capNm:result.appliedNm===0?0:Infinity;
    if(ratio>1+1e-12)throw new Error('Combined elbow actuator exceeded existing cap');
    summary.actuatorCalls++;summary.limitedCalls+=+result.limited;summary.maxCapRatio=Math.max(summary.maxCapRatio,ratio);
    summary.maxAppliedNm=Math.max(summary.maxAppliedNm,result.appliedNm);summary.maxRequestedNm=Math.max(summary.maxRequestedNm,Math.abs(result.requestedSignedNm));summary.maxGravityFFNm=Math.max(summary.maxGravityFFNm,Math.abs(ff.torqueNm));
    const row={nativeInput:request,feedforward:ff,...result};summary.last=row;
    if(records.length<maxRecords)records.push(row);else summary.recordsDropped++;
    return result;
  });
  return {summary,records,restore(){
    if(undone||raw.jointConfigureMotor!==configure)throw new Error('Elbow intercept restoration requires current LIFO ownership');
    undoDispatch?.();raw.jointConfigureMotor=originalConfigure;
    if(mode==='bounded'&&j.joint.isValid())raw.jointConfigureMotorModel(j.joint.handle,3,1);
    undone=true;
  }};
}
