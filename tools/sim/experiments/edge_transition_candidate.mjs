// Isolated driveSword instrumentation and same-prefix causal interventions.
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const sourceURL=new URL('../../../src/fighter.js',import.meta.url);
const sha=x=>createHash('sha256').update(x).digest('hex');
export async function loadEdgeTransition(){
  const original=await readFile(sourceURL,'utf8');let source=original;
  function replace(a,b){if(source.split(a).length!==2)throw Error('Expected unique marker: '+a);source=source.replace(a,b);}
  replace('  driveSword() {',`  driveSword() {
    const diag = transitionOptions.get(this);
    const active = diag && diag.now() + 1e-12 >= diag.startS;
    const usePoint = diag && (diag.base === 'pointIntent' || (active && diag.mode === 'pointIntent'));
    const beforePlane = this.intentEdgePlane?.clone();
    const beforeLocalAim = this.intentEdgePreviousAim?.clone();`);
  replace('    const aim = _v3.set(...guardDir(off.x, off.y));',`    const aim = _v3.set(...guardDir(off.x, off.y));
    if ((usePoint || (active && ['c1Aim','legacyC1'].includes(diag.mode))) && off.y > .05 && off.y < .15) {
      const t=(off.y-.05)/.1;
      const elevation=-.055+.11*t+.11*t*t;
      const azimuth=THREE.MathUtils.clamp((off.x-.05)*1.7,-1.1,1.3);
      aim.set(Math.cos(elevation)*Math.cos(azimuth),Math.sin(elevation),Math.cos(elevation)*Math.sin(azimuth));
    }`);
  replace("    if (this.edgeIntentModel === 'commandedPlane' || this.edgeIntentModel === 'commandedPlaneC1') updateIntentEdgePlane(this, aim, blade, flatTarget, flat);",`    const legacyFlat = flatTarget.clone();
    if (this.edgeIntentModel === 'commandedPlane' || this.edgeIntentModel === 'commandedPlaneC1') updateIntentEdgePlane(this, aim, blade, flatTarget, flat);
    const requestedPlane = this.intentEdgePlane?.clone();
    let pointCommandSpeed = null, pointCommandVelocity = null;
    let pointHandVelocity=null, pointAxisVelocity=null, pointRawNormal=null, pointSignedNormal=null;
    let pointBlend=null, memorySignFlipped=null, flatSignFlipped=null, pointProjectionLength=null;
    if (usePoint) {
      const inverseYaw=this.yaw.clone().invert();
      const localAim=aim.clone().applyQuaternion(inverseYaw).normalize();
      const commandPoint=handLocal.clone().addScaledVector(localAim,this.weaponCfg.hiltLength+.7*this.weaponCfg.bladeLength);
      if(this.intentEdgePreviousPoint){
        pointCommandVelocity=commandPoint.clone().sub(this.intentEdgePreviousPoint).multiplyScalar(1/this.lastDt);
        pointAxisVelocity=localAim.clone().sub(beforeLocalAim).multiplyScalar((this.weaponCfg.hiltLength+.7*this.weaponCfg.bladeLength)/this.lastDt);
        pointHandVelocity=pointCommandVelocity.clone().sub(pointAxisVelocity);
        const chosenVelocity=active&&diag.mode==='handOnly'?pointHandVelocity:active&&diag.mode==='axisOnly'?pointAxisVelocity:pointCommandVelocity;
        const normal=new THREE.Vector3().crossVectors(localAim,chosenVelocity);
        pointRawNormal=normal.clone();
        pointCommandSpeed=normal.length();
        this.intentEdgePlane.copy(beforePlane);
        const blend=THREE.MathUtils.smoothstep(pointCommandSpeed,.5,2.5);
        pointBlend=blend;
        if(blend>0){
          normal.normalize();
          const signReference=active&&diag.mode==='flatSign'?flat.clone().applyQuaternion(inverseYaw):this.intentEdgePlane;
          memorySignFlipped=normal.dot(signReference)<0;
          if(memorySignFlipped)normal.negate();
          pointSignedNormal=normal.clone();
          this.intentEdgePlane.lerp(normal,blend).normalize();
        }
        flatTarget.copy(this.intentEdgePlane).applyQuaternion(this.yaw);
        flatTarget.addScaledVector(blade,-flatTarget.dot(blade));
        pointProjectionLength=flatTarget.length();
        if(flatTarget.lengthSq()<1e-8)flatTarget.copy(flat);
        flatTarget.normalize();
        flatSignFlipped=flatTarget.dot(flat)<0;
        if(flatSignFlipped)flatTarget.negate();
      }
      (this.intentEdgePreviousPoint ||= new THREE.Vector3()).copy(commandPoint);
    }
    if (active && diag.mode === 'motionMemory') {
      this.intentEdgePlane.copy(beforePlane || legacyFlat.clone().applyQuaternion(this.yaw.clone().invert()));
      if (moving > 0) {
        const normal=new THREE.Vector3().crossVectors(blade,new THREE.Vector3(bv.x,bv.y,bv.z)).normalize().applyQuaternion(this.yaw.clone().invert());
        if(normal.dot(this.intentEdgePlane)<0)normal.negate();
        this.intentEdgePlane.lerp(normal,moving).normalize();
      }
      flatTarget.copy(this.intentEdgePlane).applyQuaternion(this.yaw);
      flatTarget.addScaledVector(blade,-flatTarget.dot(blade));
      if(flatTarget.lengthSq()<1e-8)flatTarget.copy(flat);
      flatTarget.normalize();
      if(flatTarget.dot(flat)<0)flatTarget.negate();
    }
    if (active && diag.mode === 'freezePlane') {
      diag.frozenPlane ||= beforePlane?.clone() || this.intentEdgePlane.clone();
      this.intentEdgePlane.copy(diag.frozenPlane);
      flatTarget.copy(diag.frozenPlane).applyQuaternion(this.yaw);
      flatTarget.addScaledVector(blade, -flatTarget.dot(blade));
      if (flatTarget.lengthSq() < 1e-8) flatTarget.copy(flat);
      flatTarget.normalize();
      if (flatTarget.dot(flat)<0) flatTarget.negate();
    }
    const flatError = Math.atan2(new THREE.Vector3().crossVectors(flat,flatTarget).dot(blade),flat.dot(flatTarget));`);
  replace('    twist.addScaledVector(wTwist, -0.12 * this.twistScale);',`    const positionTwist = twist.clone();
    const dampingReference = new THREE.Vector3();
    if(active && diag.mode === 'reactionDamping') {
      // Match the actual reaction split: transverse to forearm, axial to chest.
      const rq=forearm.rotation(),cw=chest.angvel();
      const fa=new THREE.Vector3(1,0,0).applyQuaternion(new THREE.Quaternion(rq.x,rq.y,rq.z,rq.w));
      dampingReference.set(fw.x,fw.y,fw.z).addScaledVector(fa,(cw.x-fw.x)*fa.x+(cw.y-fw.y)*fa.y+(cw.z-fw.z)*fa.z);
    }
    const dampingTwist = active && diag.mode === 'reactionDamping'
      ? blade.clone().multiplyScalar(-.12*this.twistScale*(w.dot(blade)-dampingReference.dot(blade)))
      : wTwist.clone().multiplyScalar(-0.12 * this.twistScale);
    if (active && diag.mode === 'noPosition') twist.set(0,0,0);
    if (active && diag.mode === 'planePotential') twist.multiplyScalar(flat.dot(flatTarget));
    if (active && diag.mode === 'halfPosition') twist.multiplyScalar(.5);
    if (active && diag.mode === 'planeMixture') {
      // Blend two unoriented plane potentials, not sign-selected normal vectors.
      const rest=RIGHT_LOCAL.clone().applyQuaternion(this.yaw);
      rest.addScaledVector(blade,-rest.dot(blade));
      if(rest.lengthSq()<1e-4)rest.copy(flat);
      rest.normalize();
      const motion=new THREE.Vector3().crossVectors(blade,new THREE.Vector3(bv.x,bv.y,bv.z));
      if(motion.lengthSq()>0)motion.normalize();
      twist.crossVectors(flat,rest).multiplyScalar((1-moving)*flat.dot(rest));
      if(moving>0)twist.add(new THREE.Vector3().crossVectors(flat,motion).multiplyScalar(moving*flat.dot(motion)));
      twist.projectOnVector(blade).multiplyScalar(4*this.twistScale);
    }
    const appliedPositionTwist = twist.clone();
    if(active && diag.mode === 'reactionDamping') twist.add(dampingTwist);
    else if (!(active && diag.mode === 'noDamping')) twist.addScaledVector(wTwist, -0.12 * this.twistScale);`);
  replace('    sword.addTorque(vecArg(torque), true);',`    if (diag) {
      const principal = sword.principalInertia();
      const frame = sword.principalInertiaLocalFrame();
      const principalWorld = new THREE.Quaternion().copy(_q1).multiply(new THREE.Quaternion(frame.x,frame.y,frame.z,frame.w));
      const principalAxis = blade.clone().applyQuaternion(principalWorld.invert()).normalize();
      const inverseI = principalAxis.x**2/principal.x + principalAxis.y**2/principal.y + principalAxis.z**2/principal.z;
      const omega = w.dot(blade), k=4*this.twistScale, d=.12*this.twistScale;
      const localAim=aim.clone().applyQuaternion(this.yaw.clone().invert()).normalize();
      const command = beforeLocalAim ? new THREE.Vector3().crossVectors(beforeLocalAim,localAim).multiplyScalar(1/this.lastDt) : new THREE.Vector3();
      const speed = command.length()*(this.weaponCfg.hiltLength+.7*this.weaponCfg.bladeLength);
      transitionRecords.set(this,{timeS:diag.now(),active,mode:diag.mode,filteredAimM:off.toArray(),yaw:this.yaw.toArray(),aim:aim.toArray(),blade:blade.toArray(),flat:flat.toArray(),flatTarget:flatTarget.toArray(),legacyFlatTarget:legacyFlat.toArray(),beforePlane:beforePlane?.toArray()??null,requestedPlane:requestedPlane?.toArray()??null,appliedPlane:this.intentEdgePlane?.toArray()??null,actualCutPointVelocityMps:[bv.x,bv.y,bv.z],actualSpeedMps:ev,actualBlend:moving,commandSpeedMps:speed,commandBlend:THREE.MathUtils.smoothstep(speed,.5,2.5),flatErrorRad:flatError,
        pointCommandSpeedMps:pointCommandSpeed,pointCommandVelocityLocalMps:pointCommandVelocity?.toArray()??null,
        pointHandVelocityLocalMps:pointHandVelocity?.toArray()??null,pointAxisVelocityLocalMps:pointAxisVelocity?.toArray()??null,
        pointRawNormal:pointRawNormal?.toArray()??null,pointSignedNormal:pointSignedNormal?.toArray()??null,pointBlend,memorySignFlipped,flatSignFlipped,pointProjectionLength,
        dampingReferenceOmega:dampingReference.toArray(),dampingReferenceAxisRadps:dampingReference.dot(blade),
        k,d,effectiveBladeInertia:1/inverseI,kDtSquaredOverI:k*this.lastDt**2*inverseI,dDtOverI:d*this.lastDt*inverseI,
        preStepOmegaAxisRadps:omega,relativeForearmOmegaAxisRadps:omega-new THREE.Vector3(fw.x,fw.y,fw.z).dot(blade),positionTwistNm:positionTwist.dot(blade),appliedPositionTwistNm:appliedPositionTwist.dot(blade),dampingTwistNm:dampingTwist.dot(blade),appliedTwistNm:twist.dot(blade),finalTorqueNm:torque.toArray(),finalTorqueAxisNm:torque.dot(blade),
        twistWorkApproxJ:twist.dot(w)*this.lastDt,twistDeltaOmegaFreeBodyRadps:twist.dot(blade)*inverseI*this.lastDt,dt:this.lastDt,capNm:cap});
    }
    sword.addTorque(vecArg(torque), true);`);
  source='const transitionOptions=new WeakMap(),transitionRecords=new WeakMap();\nexport const setTransition=(f,o)=>transitionOptions.set(f,o);\nexport const readTransition=f=>transitionRecords.get(f)??null;\n'+source;
  source=source.replace(/from (['"])([^'"]+)\1/g,(_,q,p)=>'from '+JSON.stringify(p.startsWith('.')?new URL(p,sourceURL).href:import.meta.resolve(p)));
  const directory=await mkdtemp(join(tmpdir(),'edge-transition-'));
  try{const p=join(directory,'fighter.mjs');await writeFile(p,source);const module=await import(pathToFileURL(p).href);return {module,sourceSHA256:sha(original),generatedSHA256:sha(source),cleanup:()=>rm(directory,{recursive:true,force:true})};}
  catch(e){await rm(directory,{recursive:true,force:true});throw e;}
}
