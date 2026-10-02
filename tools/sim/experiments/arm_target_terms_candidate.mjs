// Research-only split of position feedback and target-velocity feedforward.
// Temporary modules preserve production source and existing force/reaction paths.
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const sourceURL=new URL('../../../src/fighter.js',import.meta.url);
const sha=x=>createHash('sha256').update(x).digest('hex');
function once(s,a,b){if(s.split(a).length!==2)throw Error('Expected one source marker: '+a);return s.replace(a,b);}
export function transformArmTargetTerms(source){
  let s=source;
  s=once(s,'  driveJoints() {','  driveJoints() {\n    armTermRecords.set(this, {});');
  s=once(s,'    // 휘두르는 방향(뼈에 수직)',`    const armTermObserve = {targetOmegaWorld:wT.toArray(), errorWorld:_mE.toArray(), relativeOmegaWorld:_mW.toArray(), boneAxis:boneAxis.toArray(), eTw, wTw, k, d, maxT};
    const armTermActive = this.armTermActive;
    if (armTermActive && this.armTermMode === 'noShoulderVelocity') wT.set(0,0,0);
    // 휘두르는 방향(뼈에 수직)`);
  s=once(s,'_mT.copy(_mE).addScaledVector(boneAxis, -eTw).multiplyScalar(k);',"_mT.copy(_mE).addScaledVector(boneAxis, -eTw).multiplyScalar(armTermActive && this.armTermMode === 'noShoulderPosition' ? 0 : k);");
  s=once(s,'eTw * 25 - wTw * 0.8',"(armTermActive && this.armTermMode === 'noShoulderPosition' ? 0 : eTw * 25) - wTw * 0.8");
  s=once(s,'    const tlen = _mT.length();','    armTermObserve.preCapSwingRequestNm = _mT.toArray();\n    const tlen = _mT.length();');
  s=once(s,'    j.child.addTorque(vecArg(_mT), true);',`    Object.assign(armTermObserve,{appliedNm:_mT.toArray(), capNm:cap, appliedTargetOmegaWorld:wT.toArray(), twistFFNm:twistFF});
    armTermRecords.get(this).shoulder = armTermObserve;
    j.child.addTorque(vecArg(_mT), true);`);
  s=once(s,'        const tz = _cur.z + THREE.MathUtils.clamp(_rv.z - _cur.z, -mErr, mErr);', '        let tz = _cur.z + THREE.MathUtils.clamp(_rv.z - _cur.z, -mErr, mErr);');
  s=once(s,'        const vz = THREE.MathUtils.clamp((_rv.z - prev.z) * inv, -15, 15);',`        let vz = THREE.MathUtils.clamp((_rv.z - prev.z) * inv, -15, 15);
        if (n === 'farmS') {
          const q = j.parent.rotation(), ax = new THREE.Vector3(0,0,1).applyQuaternion(new THREE.Quaternion(q.x,q.y,q.z,q.w));
          const wc = j.child.angvel(), wp = j.parent.angvel();
          const omega = (wc.x-wp.x)*ax.x+(wc.y-wp.y)*ax.y+(wc.z-wp.z)*ax.z;
          const data = {requestedPositionRad:_rv.z,currentPositionRad:_cur.z,previousPositionRad:prev.z,positionRad:tz,velocityRadps:vz,relativeVelocityRadps:omega,k,d,mErr};
          if (this.armTermActive && this.armTermMode === 'noElbowVelocity') vz = 0;
          if (this.armTermActive && this.armTermMode === 'noElbowPosition') tz = _cur.z;
          data.appliedPositionRad=tz;data.appliedVelocityRadps=vz;
          armTermRecords.get(this).elbow=data;
        }`);
  return 'const armTermRecords=new WeakMap();\nexport const readArmTerms=f=>armTermRecords.get(f);\n'+s;
}
export async function loadArmTargetTerms(){
  const original=await readFile(sourceURL,'utf8'),directory=await mkdtemp(join(tmpdir(),'arm-terms-'));
  const source=transformArmTargetTerms(original).replace(/from (['"])([^'"]+)\1/g,(_,q,p)=>'from '+JSON.stringify(p.startsWith('.')?new URL(p,sourceURL).href:import.meta.resolve(p)));
  try{const p=join(directory,'observed.mjs');await writeFile(p,source);return {module:await import(pathToFileURL(p).href),originalSHA256:sha(original),generatedSHA256:sha(source),cleanup:()=>rm(directory,{recursive:true,force:true})};}
  catch(e){await rm(directory,{recursive:true,force:true});throw e;}
}
