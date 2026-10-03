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
    const beforePlane = this.intentEdgePlane?.clone();
    const beforeLocalAim = this.intentEdgePreviousAim?.clone();`);
  replace('    const aim = _v3.set(...guardDir(off.x, off.y));',`    const aim = _v3.set(...guardDir(off.x, off.y));
    if (active && diag.mode === 'c1Aim' && off.y > .05 && off.y < .15) {
      const t=(off.y-.05)/.1;
      const elevation=-.055+.11*t+.11*t*t;
      const azimuth=THREE.MathUtils.clamp((off.x-.05)*1.7,-1.1,1.3);
      aim.set(Math.cos(elevation)*Math.cos(azimuth),Math.sin(elevation),Math.cos(elevation)*Math.sin(azimuth));
    }`);
  replace("    if (this.edgeIntentModel === 'commandedPlane') updateIntentEdgePlane(this, aim, blade, flatTarget, flat);",`    const legacyFlat = flatTarget.clone();
    if (this.edgeIntentModel === 'commandedPlane') updateIntentEdgePlane(this, aim, blade, flatTarget, flat);
    const requestedPlane = this.intentEdgePlane?.clone();
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
    const dampingTwist = wTwist.clone().multiplyScalar(-0.12 * this.twistScale);
    if (active && diag.mode === 'noPosition') twist.set(0,0,0);
    if (!(active && diag.mode === 'noDamping')) twist.addScaledVector(wTwist, -0.12 * this.twistScale);`);
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
      transitionRecords.set(this,{timeS:diag.now(),active,mode:diag.mode,filteredAimM:off.toArray(),yaw:this.yaw.toArray(),aim:aim.toArray(),blade:blade.toArray(),flat:flat.toArray(),flatTarget:flatTarget.toArray(),legacyFlatTarget:legacyFlat.toArray(),beforePlane:beforePlane?.toArray()??null,requestedPlane:requestedPlane?.toArray()??null,appliedPlane:this.intentEdgePlane?.toArray()??null,commandSpeedMps:speed,commandBlend:THREE.MathUtils.smoothstep(speed,.5,2.5),flatErrorRad:flatError,
        k,d,effectiveBladeInertia:1/inverseI,kDtSquaredOverI:k*this.lastDt**2*inverseI,dDtOverI:d*this.lastDt*inverseI,
        preStepOmegaAxisRadps:omega,relativeForearmOmegaAxisRadps:omega-new THREE.Vector3(fw.x,fw.y,fw.z).dot(blade),positionTwistNm:positionTwist.dot(blade),dampingTwistNm:dampingTwist.dot(blade),appliedTwistNm:twist.dot(blade),finalTorqueNm:torque.toArray(),finalTorqueAxisNm:torque.dot(blade),
        twistWorkApproxJ:twist.dot(w)*this.lastDt,twistDeltaOmegaFreeBodyRadps:twist.dot(blade)*inverseI*this.lastDt,dt:this.lastDt,capNm:cap});
    }
    sword.addTorque(vecArg(torque), true);`);
  source='const transitionOptions=new WeakMap(),transitionRecords=new WeakMap();\nexport const setTransition=(f,o)=>transitionOptions.set(f,o);\nexport const readTransition=f=>transitionRecords.get(f)??null;\n'+source;
  source=source.replace(/from (['"])([^'"]+)\1/g,(_,q,p)=>'from '+JSON.stringify(p.startsWith('.')?new URL(p,sourceURL).href:import.meta.resolve(p)));
  const directory=await mkdtemp(join(tmpdir(),'edge-transition-'));
  try{const p=join(directory,'fighter.mjs');await writeFile(p,source);const module=await import(pathToFileURL(p).href);return {module,sourceSHA256:sha(original),generatedSHA256:sha(source),cleanup:()=>rm(directory,{recursive:true,force:true})};}
  catch(e){await rm(directory,{recursive:true,force:true});throw e;}
}
