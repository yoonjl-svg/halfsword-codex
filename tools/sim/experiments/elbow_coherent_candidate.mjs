// Isolated follow-up: both arm IK requests share the same desired sword pose; physical grip forces stay unchanged.
// No physics state, joint, gains, limits, strength, or sword-axis formula is replaced.
import { THREE } from '../harness_m.mjs';
const V=v=>new THREE.Vector3(v.x,v.y,v.z), Q=q=>new THREE.Quaternion(q.x,q.y,q.z,q.w);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const local=(b,p)=>V(p).sub(V(b.translation())).applyQuaternion(Q(b.rotation()).invert());
const point=(b,p)=>V(p).applyQuaternion(Q(b.rotation())).add(V(b.translation()));
const zAxis=new THREE.Vector3(0,0,1);
const angleZ=q=>{q=q.clone().normalize();if(q.w<0)q.set(-q.x,-q.y,-q.z,-q.w);return 2*Math.atan2(q.z,q.w);};

// Euclidean projection onto intersection of two closed reach balls.
// Inner elbow limits are checked separately after the native IK radius clamp.
export function projectTwoBalls(x,c1,r1,c2,r2){
  const eps=1e-10,inside=(p,c,r)=>p.distanceToSquared(c)<=(r+eps)**2;
  if(inside(x,c1,r1)&&inside(x,c2,r2))return x.clone();
  const clip=(p,c,r)=>{const d=p.clone().sub(c);return d.length()<=r?p.clone():d.setLength(r).add(c);};
  const p1=clip(x,c1,r1);if(inside(p1,c2,r2))return p1;
  const p2=clip(x,c2,r2);if(inside(p2,c1,r1))return p2;
  const line=c2.clone().sub(c1),d=line.length();
  if(d>r1+r2+eps||d<Math.abs(r1-r2)-eps||d<eps)throw Error('No intersecting reach circle for nontrivial projection');
  line.divideScalar(d);const along=(r1*r1-r2*r2+d*d)/(2*d),center=c1.clone().addScaledVector(line,along);
  const radius=Math.sqrt(Math.max(0,r1*r1-along*along));
  const dir=x.clone().sub(center).addScaledVector(line,-x.clone().sub(center).dot(line));
  if(dir.lengthSq()<1e-20){dir.crossVectors(line,Math.abs(line.y)<.9?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0));}
  return dir.normalize().multiplyScalar(radius).add(center);
}

export function installElbowCoherentCandidate({f,ledger,mode='candidate'}) {
  if(!['candidate','observe','defer','coupled','coherent'].includes(mode))throw Error('Invalid continuity mode');
  const original=f.constructor.prototype.armIK, records=[];
  const sj=f.jointByName.uarmS, ej=f.jointByName.farmS;
  const upper=V(sj.joint.anchor2()).distanceTo(V(ej.joint.anchor1()));
  const fore=V(ej.joint.anchor2()).distanceTo(V(f.gripJoint.anchor1()));
  const minFlex=ej.joint.limitsMin(),maxFlex=ej.joint.limitsMax();
  const radius=beta=>Math.sqrt(upper*upper+fore*fore+2*upper*fore*Math.cos(beta));
  const minRadius=radius(maxFlex),maxRadius=radius(minFlex);
  let reference=null;
  let pending=null;
  function processTarget(target){
    const chest=this.bodies.chest, up=this.bodies.uarmS, farm=this.bodies.farmS;
    const requested=V(target),chestQ=Q(chest.rotation());
    const shoulderLocal=V(sj.joint.anchor1()),shoulder=point(chest,sj.joint.anchor1());
    const active=(mode==='candidate'||mode==='coupled'||mode==='coherent')&&this.guardWeight()===0&&this.skill.thrustPose.w===0;
    const qActual=chestQ.clone().invert().multiply(Q(up.rotation()));
    const betaActual=angleZ(ej.restInv.clone().multiply(Q(up.rotation()).invert().multiply(Q(farm.rotation()))));
    const previousTarget=sj.target.clone(),previousBeta=angleZ(ej.target);
    let init=false,projected=false,appliedRadius=null,seedVelocity=null,relativeRequested=null,directionDot=null;
    if(active){
      if(!reference){
        // Use the legal articulated pose, not a possibly separated solver anchor.
        const beta=clamp(betaActual,minFlex,maxFlex);
        const upperAxis=new THREE.Vector3(1,0,0).applyQuaternion(qActual);
        const foreAxis=new THREE.Vector3(Math.cos(beta),Math.sin(beta),0).applyQuaternion(qActual);
        const handLocal=shoulderLocal.clone().addScaledVector(upperAxis,upper).addScaledVector(foreAxis,fore);
        const d=handLocal.clone().sub(shoulderLocal).normalize();
        let pole=upperAxis.clone().addScaledVector(d,-upperAxis.dot(d));
        if(pole.lengthSq()<1e-12)pole=new THREE.Vector3(0,-1,0).applyQuaternion(qActual).addScaledVector(d,0);
        pole.addScaledVector(d,-pole.dot(d)).normalize();
        reference={offsetChest:handLocal.clone().sub(local(chest,requested)),direction:d,pole};
        init=true;
        // Match initial target angular velocity to actual relative motion; existing
        // 20/15 rad/s controller clamps still apply and are reported, not enlarged.
        const w=V(up.angvel()).sub(V(chest.angvel())).applyQuaternion(chestQ.clone().invert());
        const dt=this.lastDt,wn=w.length();
        sj.prevTarget=qActual.clone();
        if(wn>1e-12)sj.prevTarget.premultiply(new THREE.Quaternion().setFromAxisAngle(w.clone().divideScalar(wn),-wn*dt));
        const hingeWorld=zAxis.clone().applyQuaternion(Q(up.rotation()));
        const rate=V(farm.angvel()).sub(V(up.angvel())).dot(hingeWorld);
        ej.prevRV=new THREE.Vector3(0,0,beta-rate*dt);
        seedVelocity={shoulderRadps:wn,elbowRadps:rate,withinExistingCaps:wn<=20&&Math.abs(rate)<=15};
      }
      let goalWorld=requested.clone().add(reference.offsetChest.clone().applyQuaternion(chestQ));
      relativeRequested=goalWorld.toArray();
      if((mode==='coupled'||mode==='coherent')&&this.weaponCfg.twoHand){
        const so=this.jointByName.uarmO.joint,eo=this.jointByName.farmO.joint;
        const aO=V(so.anchor2()).distanceTo(V(eo.anchor1())),bO=V(eo.anchor2()).distanceTo(new THREE.Vector3(0,-.135,0));
        const secondCenter=point(chest,so.anchor1()).addScaledVector(this.aimDirW,-this.weaponCfg.gripAlong);
        goalWorld=projectTwoBalls(goalWorld,shoulder,maxRadius,secondCenter,aO+bO);
      }
      const D=local(chest,goalWorld).sub(shoulderLocal),distance=D.length();
      const dn=distance>1e-12?D.clone().divideScalar(distance):reference.direction.clone();
      const d=clamp(distance,minRadius,maxRadius);
      directionDot=reference.direction.dot(dn);
      projected=Math.abs(d-distance)>1e-10;appliedRadius=d;
      // Parallel transport the previous bend plane, avoiding a fixed pole snap.
      const pole=reference.pole.clone().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(reference.direction,dn));
      pole.addScaledVector(dn,-pole.dot(dn)).normalize();
      const alpha=Math.acos(clamp((upper*upper+d*d-fore*fore)/(2*upper*d),-1,1));
      const flex=Math.acos(clamp((d*d-upper*upper-fore*fore)/(2*upper*fore),-1,1));
      const x=dn.clone().multiplyScalar(Math.cos(alpha)).addScaledVector(pole,Math.sin(alpha));
      const y=dn.clone().multiplyScalar(d).addScaledVector(x,-upper);
      y.addScaledVector(x,-y.dot(x));
      if(y.lengthSq()<1e-12)y.copy(pole).negate();
      y.normalize();const z=new THREE.Vector3().crossVectors(x,y).normalize();
      sj.target.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));
      ej.target.setFromAxisAngle(zAxis,flex);
      target.copy(dn).multiplyScalar(d).add(shoulderLocal).applyQuaternion(chestQ).add(V(chest.translation()));
      this.armFull=distance>=maxRadius;
      reference.direction.copy(dn);reference.pole.copy(pole);
    }else{original.call(this,target);reference=null;}
    const applied=V(target),grip=point(farm,this.gripJoint.anchor1());
    records.push({active,init,projected,requested:requested.toArray(),relativeRequested,applied:applied.toArray(),directionDot,
      requestedRadiusM:requested.distanceTo(shoulder),appliedRadiusM:appliedRadius??applied.distanceTo(shoulder),
      actualGripBefore:grip.toArray(),actualFlexBeforeRad:betaActual,targetFlexRad:angleZ(ej.target),
      priorTargetFlexRad:previousBeta,shoulderTargetStepRad:previousTarget.angleTo(sj.target),
      targetToActualShoulderRad:qActual.angleTo(sj.target),seedVelocity,
      inputActive:this.inputActive,handHeld:this.handHeld});
  }
  const deferred=mode==='defer'||mode==='coupled'||mode==='coherent';
  const restore=ledger.replaceObservedMethod(f,'armIK',function(target){
    if(deferred){pending=target;return;}
    return processTarget.call(this,target);
  });
  const drive=f.constructor.prototype.driveSword;
  const undoDrive=ledger.replaceObservedMethod(f,'driveSword',function(){
    const result=drive.call(this);
    if(pending){const t=pending;pending=null;processTarget.call(this,t);}
    const rec=records.at(-1);
    if(rec){
      rec.currentDesiredBladeAxis=this.aimDirW.toArray();
      if(this.weaponCfg.twoHand){
        const so=this.jointByName.uarmO.joint,eo=this.jointByName.farmO.joint;
        const oa=V(so.anchor2()).distanceTo(V(eo.anchor1()));
        const ob=V(eo.anchor2()).distanceTo(new THREE.Vector3(0,-.135,0));
        const omin=Math.sqrt(oa*oa+ob*ob+2*oa*ob*Math.cos(eo.limitsMax())),omax=oa+ob;
        const origin=point(this.bodies.chest,so.anchor1());
        const desired=this.handTarget.clone().addScaledVector(this.aimDirW,this.weaponCfg.gripAlong);
        const current=V(this.sword.translation()).addScaledVector(this.aimDirW,this.weaponCfg.gripAlong);
        rec.secondary={minRadiusM:omin,maxRadiusM:omax,desiredDistanceM:desired.distanceTo(origin),actualIKDistanceM:current.distanceTo(origin)};
      }
    }return result;
  });
  const off=f.constructor.prototype.offArmIK;
  const undoOff=ledger.replaceObservedMethod(f,'offArmIK',function(target){
    const before=V(target),applied=(mode==='coherent'&&this.guardWeight()===0&&this.skill.thrustPose.w===0)?this.handTarget.clone().addScaledVector(this.aimDirW,this.weaponCfg.gripAlong):before.clone();
    const rec=records.at(-1);if(rec)rec.offHandControl={requested:before.toArray(),applied:applied.toArray(),changed:applied.distanceTo(before)};
    return off.call(this,applied);
  });
  return {records,restore(){undoOff();undoDrive();restore();},geometry:{upperM:upper,foreM:fore,minFlexRad:minFlex,maxFlexRad:maxFlex,minRadiusM:minRadius,maxRadiusM:maxRadius}};
}
