// Research-only paired angular reception at the existing fresh-clash grip boundary.
// It never rewinds an already integrated pose. No new torque or speed constant.
import * as THREE from 'three';
const V=o=>new THREE.Vector3(o.x,o.y,o.z),Q=o=>new THREE.Quaternion(o.x,o.y,o.z,o.w);
function inverseAlong(b,a){const m=b.effectiveWorldInvInertia();return a.x*(m.m11*a.x+m.m12*a.y+m.m13*a.z)+a.y*(m.m21*a.x+m.m22*a.y+m.m23*a.z)+a.z*(m.m31*a.x+m.m32*a.y+m.m33*a.z);}
function momentum(b){const q=Q(b.rotation()).multiply(Q(b.principalInertiaLocalFrame())),w=V(b.angvel()).applyQuaternion(q.clone().invert()),I=V(b.principalInertia());return {L:w.clone().multiply(I).applyQuaternion(q).toArray(),K:.5*w.clone().multiply(w).dot(I)};}
export function receiveGripAngularImpulse(f){
 const sword=f.sword,farm=f.bodies.farmS,dt=f.lastDt,cap=f.debug.wristCap;
 const a=new THREE.Vector3(0,1,0).applyQuaternion(Q(sword.rotation()));
 const relative=V(sword.angvel()).sub(V(farm.angvel())).dot(a),k=inverseAlong(sword,a)+inverseAlong(farm,a);
 const applied=V(sword.userTorque()),spent=applied.clone().multiplyScalar(dt),radius=cap*dt;
 const baseWithinBudget=spent.lengthSq()<=radius*radius+1e-14;
 if(!f.armed||!farm.isValid()||!(dt>0)||!(cap>0)||!(k>0)||!baseWithinBudget)return {applied:false,reason:'No valid remaining existing vector budget',baseWithinBudget};
 // |T*dt + lambda*a| <= cap*dt; the available interval is part of
 // the original 3-D budget, not a new independent axial force allowance.
 const along=spent.dot(a),root=Math.sqrt(Math.max(0,along*along+radius*radius-spent.lengthSq()));
 const interval=[-along-root,-along+root],wanted=-relative/k;
 const lambda=THREE.MathUtils.clamp(wanted,...interval);
 if(lambda*relative>=0||Math.abs(lambda)>Math.abs(wanted)+1e-12)return {applied:false,reason:'No dissipative impulse inside existing budget',interval,wanted,lambda};
 const before={sword:momentum(sword),farm:momentum(farm)},impulse=a.clone().multiplyScalar(lambda);
 sword.applyTorqueImpulse(impulse,true);farm.applyTorqueImpulse(impulse.clone().negate(),true);
 const after={sword:momentum(sword),farm:momentum(farm)};
 const closure=new THREE.Vector3().fromArray(after.sword.L).sub(new THREE.Vector3().fromArray(before.sword.L)).add(new THREE.Vector3().fromArray(after.farm.L).sub(new THREE.Vector3().fromArray(before.farm.L)));
 return {applied:true,axis:a.toArray(),before,after,lambda,wanted,interval,relativeBefore:relative,relativeAfter:V(sword.angvel()).sub(V(farm.angvel())).dot(a),budgetCapNm:cap,originalTorqueNm:applied.toArray(),combinedTorqueNm:applied.clone().addScaledVector(a,lambda/dt).toArray(),combinedTorqueNorm:applied.clone().addScaledVector(a,lambda/dt).length(),angularMomentumClosure:closure.toArray(),pairKineticEnergyChangeJ:after.sword.K+after.farm.K-before.sword.K-before.farm.K,scope:'Instantaneous sword/forearm paired angular impulse; original frame vector torque budget. No claim about later native constraint work or whole-body energy.'};
}
