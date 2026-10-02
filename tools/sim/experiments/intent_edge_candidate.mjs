// Research: blade edge follows the commanded cutting plane and retains it at
// rest. Use local command motion, existing .5–2.5m/s transition, and seed the current target to avoid a tiny-yaw first-step jump.
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const sourceURL=new URL('../../../src/fighter.js',import.meta.url),sha=x=>createHash('sha256').update(x).digest('hex');
export async function loadIntentEdge(){
  const original=await readFile(sourceURL,'utf8'),directory=await mkdtemp(join(tmpdir(),'intent-edge-'));
  const marker='    // 칼날 축(길쭉한 방향)으로 도는 회전은 관성이 아주 작아서, 큰 힘을 주면';
  if(original.split(marker).length!==2)throw Error('Source marker contract');
  let source=original.replace(marker,`    const legacyFlatTarget=flatTarget.clone();
    let commandSpeedMps=null,commandBlend=null;
    if(this.intentEdgeEnabled){
      const yawInv=this.yaw.clone().invert();
      const localAim=aim.clone().applyQuaternion(yawInv).normalize();
      if(!this.intentEdgePreviousAim){
        this.intentEdgePreviousAim=localAim.clone();
        this.intentEdgePlane=flatTarget.clone().applyQuaternion(yawInv).normalize();
      }else{
        const commandPlane=new THREE.Vector3().crossVectors(this.intentEdgePreviousAim,localAim).multiplyScalar(1/this.lastDt);
        commandSpeedMps=commandPlane.length()*(this.weaponCfg.hiltLength+.7*this.weaponCfg.bladeLength);
        commandBlend=THREE.MathUtils.smoothstep(commandSpeedMps,.5,2.5);
        if(commandBlend>0){
          commandPlane.normalize();
          if(commandPlane.dot(this.intentEdgePlane)<0)commandPlane.negate();
          this.intentEdgePlane.lerp(commandPlane,commandBlend).normalize();
        }
        this.intentEdgePreviousAim.copy(localAim);
        flatTarget.copy(this.intentEdgePlane).applyQuaternion(this.yaw);
        flatTarget.addScaledVector(blade,-flatTarget.dot(blade));
        if(flatTarget.lengthSq()<1e-8)flatTarget.copy(flat);
        flatTarget.normalize();
        if(flatTarget.dot(flat)<0)flatTarget.negate();
      }
    }
    edgeRecords.set(this,{enabled:!!this.intentEdgeEnabled,commandSpeedMps,commandBlend,commandOmega:wAim.toArray(),legacyFlatTarget:legacyFlatTarget.toArray(),flatTarget:flatTarget.toArray(),flat:flat.toArray(),blade:blade.toArray()});
`+marker);
  source='const edgeRecords=new WeakMap();\nexport const readEdge=f=>edgeRecords.get(f);\n'+source;
  source=source.replace(/from (['"])([^'"]+)\1/g,(_,q,p)=>'from '+JSON.stringify(p.startsWith('.')?new URL(p,sourceURL).href:import.meta.resolve(p)));
  try{const p=join(directory,'candidate.mjs');await writeFile(p,source);return {module:await import(pathToFileURL(p).href),generatedSHA256:sha(source),cleanup:()=>rm(directory,{recursive:true,force:true})};}
  catch(e){await rm(directory,{recursive:true,force:true});throw e;}
}
