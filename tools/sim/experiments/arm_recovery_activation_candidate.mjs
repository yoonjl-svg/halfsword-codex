// Research only: separate getup's postural activation ramp from the main arm.
// Wounds, vigor, targets, body/leg activation, gains and explicit reactions remain.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {transformArmTargetTerms} from './arm_target_terms_candidate.mjs';
const url=new URL('../../../src/fighter.js',import.meta.url),sha=s=>createHash('sha256').update(s).digest('hex');
export async function loadArmRecoveryActivation(){
  let source=await fs.readFile(url,'utf8');const originalSHA256=sha(source);
  source=transformArmTargetTerms(source);
  const replace=(a,b)=>{if(source.split(a).length!==2)throw Error('Expected unique activation marker: '+a);source=source.replace(a,b);};
  replace('    this.muscle += (targetMuscle - this.muscle) * Math.min(1, dt * (targetMuscle > this.muscle ? 4 : 12));',`    this.muscle += (targetMuscle - this.muscle) * Math.min(1, dt * (targetMuscle > this.muscle ? 4 : 12));
    const armActivation = recoveryArmOptions.get(this);
    if (armActivation) {
      armActivation.target = this.state === 'getup' ? this.vigor : targetMuscle;
      armActivation.value += (armActivation.target-armActivation.value)*Math.min(1,dt*(armActivation.target>armActivation.value?4:12));
    }`);
  replace('  driveSword() {\n    const sword = this.sword;\n    const chest = this.bodies.chest;\n    const mus = this.muscle;', '  driveSword() {\n    const sword = this.sword;\n    const chest = this.bodies.chest;\n    const mus = recoveryArmMuscle(this);');
  replace("      if (n === 'uarmS' || n === 'farmS') mus *= (0.3 + 0.7 * this.limbs.armS) * this.strength;", "      if (n === 'uarmS' || n === 'farmS') { mus = Math.max(0.1,recoveryArmMuscle(this)); mus *= (0.3 + 0.7 * this.limbs.armS) * this.strength; }");
  replace("    if (this.muscle < 0.12 || this.state === 'dead') return;", "    if (recoveryArmMuscle(this) < 0.12 || this.state === 'dead') return;");
  replace('Math.max(0.1, this.muscle) * (0.3 + 0.7 * this.limbs.armS)', 'Math.max(0.1, recoveryArmMuscle(this)) * (0.3 + 0.7 * this.limbs.armS)');
  // Plain records copied before application; no measured values feed the controller.
  replace('    sword.addTorque(vecArg(torque), true);',`    const armRecord=armTermRecords.get(this)||{};
    const aq = forearm.rotation(), faObs = new THREE.Vector3(1,0,0).applyQuaternion(new THREE.Quaternion(aq.x,aq.y,aq.z,aq.w));
    const wfo=new THREE.Vector3().copy(forearm.angvel()), wch=new THREE.Vector3().copy(chest.angvel());
    const ref=wfo.clone().addScaledVector(faObs,wch.clone().sub(wfo).dot(faObs));
    armRecord.wrist={finalNm:torque.toArray(),capNm:cap,relativePowerW:torque.dot(w.clone().sub(ref)),armActivation:mus};
    recoveryWristRecords.set(this,armRecord.wrist);
    sword.addTorque(vecArg(torque), true);`);
  source=`const recoveryArmOptions=new WeakMap(),recoveryWristRecords=new WeakMap();
export const enableRecoveryArm=f=>recoveryArmOptions.set(f,{value:f.muscle,target:f.muscle});
const recoveryArmMuscle=f=>recoveryArmOptions.get(f)?.value??f.muscle;
export const readRecoveryArm=f=>({enabled:recoveryArmOptions.has(f),value:recoveryArmMuscle(f),target:recoveryArmOptions.get(f)?.target??null,body:f.muscle,wrist:recoveryWristRecords.get(f)??null});
`+source;
  source=source.replace(/from (['"])([^'"]+)\1/g,(_,q,p)=>'from '+JSON.stringify(p.startsWith('.')?new URL(p,url).href:import.meta.resolve(p)));
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'arm-recovery-activation-'));
  try{const file=path.join(directory,'fighter.mjs');await fs.writeFile(file,source);return {module:await import(pathToFileURL(file).href),sourceSHA256:originalSHA256,generatedSHA256:sha(source),cleanup:()=>fs.rm(directory,{recursive:true,force:true})};}
  catch(e){await fs.rm(directory,{recursive:true,force:true});throw e;}
}
