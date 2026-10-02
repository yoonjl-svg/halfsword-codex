// Research: blade edge follows the commanded cutting plane and retains it at
// rest. Avoid deriving a new roll target from the weapon's feedback motion.
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
    if(this.intentEdgeEnabled){
      const commandPlane=wAim.clone();
      if(commandPlane.lengthSq()>1e-10){
        commandPlane.normalize();
        const ref=this.intentEdgePlane??flat;
        if(commandPlane.dot(ref)<0)commandPlane.negate();
        (this.intentEdgePlane??(this.intentEdgePlane=new THREE.Vector3())).copy(commandPlane);
      }
      if(this.intentEdgePlane){
        flatTarget.copy(this.intentEdgePlane).addScaledVector(blade,-this.intentEdgePlane.dot(blade));
        if(flatTarget.lengthSq()<1e-8)flatTarget.copy(flat);
        flatTarget.normalize();
        if(flatTarget.dot(flat)<0)flatTarget.negate();
      }
    }
    edgeRecords.set(this,{enabled:!!this.intentEdgeEnabled,commandOmega:wAim.toArray(),legacyFlatTarget:legacyFlatTarget.toArray(),flatTarget:flatTarget.toArray(),flat:flat.toArray(),blade:blade.toArray()});
`+marker);
  source='const edgeRecords=new WeakMap();\nexport const readEdge=f=>edgeRecords.get(f);\n'+source;
  source=source.replace(/from (['"])([^'"]+)\1/g,(_,q,p)=>'from '+JSON.stringify(p.startsWith('.')?new URL(p,sourceURL).href:import.meta.resolve(p)));
  try{const p=join(directory,'candidate.mjs');await writeFile(p,source);return {module:await import(pathToFileURL(p).href),generatedSHA256:sha(source),cleanup:()=>rm(directory,{recursive:true,force:true})};}
  catch(e){await rm(directory,{recursive:true,force:true});throw e;}
}
