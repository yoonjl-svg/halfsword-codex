// Redundant elbow swivel must not become an end-effector velocity command.
// Remove only target-velocity along the IK shoulder-to-hand axis; this angular
// component contributes zero to the requested hand endpoint's instantaneous v.
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const sourceURL=new URL('../../../src/fighter.js',import.meta.url);
const sha=x=>createHash('sha256').update(x).digest('hex');
function once(s,a,b){if(s.split(a).length!==2)throw Error('Expected one source marker: '+a);return s.replace(a,b);}
export async function loadShoulderTaskVelocity(){
  const original=await readFile(sourceURL,'utf8'),directory=await mkdtemp(join(tmpdir(),'shoulder-task-v-'));
  let source=once(original,'    // 휘두르는 방향(뼈에 수직)',`    const termBefore=wT.clone(), ej=this.jointByName.farmS.joint, sj=this.jointByName.uarmS.joint;
    const v3=v=>new THREE.Vector3(v.x,v.y,v.z);
    const a=v3(sj.anchor2()).distanceTo(v3(ej.anchor1()));
    const b=v3(ej.anchor2()).distanceTo(v3(this.gripJoint.anchor1()));
    const beta=2*Math.atan2(this.jointByName.farmS.target.z,this.jointByName.farmS.target.w);
    const reach=new THREE.Vector3(a+b*Math.cos(beta),b*Math.sin(beta),0).applyQuaternion(j.target.clone().normalize()).applyQuaternion(_qp.clone().normalize());
    const axis=reach.clone().normalize();
    if(this.shoulderTaskVelocity && this.guardWeight()===0 && this.skill.thrustPose.w===0) wT.addScaledVector(axis,-wT.dot(axis));
    const taskRecord={before:termBefore.toArray(),after:wT.toArray(),axis:axis.toArray(),
      removedRadps:termBefore.clone().sub(wT).length(),endpointVelocityDeltaMps:termBefore.clone().sub(wT).cross(reach).length()};
    taskVelocityRecords.set(this,taskRecord);
    // 휘두르는 방향(뼈에 수직)`);
  source=once(source,'    j.child.addTorque(vecArg(_mT), true);','    Object.assign(taskRecord,{appliedTorqueNm:_mT.toArray(),capNm:cap});\n    j.child.addTorque(vecArg(_mT), true);');
  source='const taskVelocityRecords=new WeakMap();\nexport const readTaskVelocity=f=>taskVelocityRecords.get(f);\n'+source;
  source=source.replace(/from (['"])([^'"]+)\1/g,(_,q,p)=>'from '+JSON.stringify(p.startsWith('.')?new URL(p,sourceURL).href:import.meta.resolve(p)));
  try{const p=join(directory,'observed.mjs');await writeFile(p,source);return {module:await import(pathToFileURL(p).href),originalSHA256:sha(original),generatedSHA256:sha(source),cleanup:()=>rm(directory,{recursive:true,force:true})};}
  catch(e){await rm(directory,{recursive:true,force:true});throw e;}
}
