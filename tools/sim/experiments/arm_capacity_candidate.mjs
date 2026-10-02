// Research-only transformations of the actual Fighter implementation.
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const fighterUrl=new URL('../../../src/fighter.js',import.meta.url);
const hash=s=>createHash('sha256').update(s).digest('hex');
export const armCapacityScope=Object.freeze({
  finalCap:'Share the existing swing cap with the entire explicit shoulder/wrist actuator, including its appended twist torque. This is a hypothesis about actuator allocation, not a physiological total-arm budget.',
  portHill:'Use the actual wrist reaction recipients: omegaEffective = omegaForearm + fa * dot(fa,omegaChest - omegaForearm), where fa is the same actual forearm local +X used by the original reaction split.',
  unchanged:'All targets, gains, strengths, gravity compensation requests, Hill formula/filter, original swing debug values, and reaction directions are retained. FinalCap scales a complete torque vector by one nonnegative scalar and derives reactions from that vector.',
  excluded:['native elbow motor and separate elbowGravity','offhand native motors and grip spring','spine/leg native motors','native motor/constraint work'],
  diagnostics:'Optional independent plain copies of final torque, existing cap, actual recipient velocities, torque closure and instantaneous explicit-actuator power. These are not native motor work or whole-body physiological muscle work.',
});
function once(source,marker,replacement){
  if(source.split(marker).length!==2)throw Error('Expected exactly one Fighter marker: '+marker.slice(0,100));
  return source.replace(marker,replacement);
}
const diagnosticHelpers=`
const armCapacityObservers=new WeakMap();
export function setArmCapacityDiagnostics(f,callback=null){
  if(callback!==null&&typeof callback!=='function')throw TypeError('Diagnostic callback must be a function or null');
  const previous=armCapacityObservers.get(f);
  if(callback===null)armCapacityObservers.delete(f);
  else armCapacityObservers.set(f,{callback,calls:0,errors:[]});
  return ()=>{if(previous)armCapacityObservers.set(f,previous);else armCapacityObservers.delete(f);};
}
export function armCapacityDiagnosticInfo(f){
  const o=armCapacityObservers.get(f);return o?{calls:o.calls,errors:[...o.errors]}:null;
}
const armCapacityV=v=>({x:v.x,y:v.y,z:v.z});
function armCapacityObserve(f,actuator,torque,cap,axis,child,parent,chest=null,details={}){
  const observer=armCapacityObservers.get(f);if(!observer)return;
  const T=torque.clone(),wc=new THREE.Vector3().copy(child.angvel()),wp=new THREE.Vector3().copy(parent.angvel());
  const parallel=chest?axis.clone().multiplyScalar(T.dot(axis)):new THREE.Vector3();
  const perpendicular=T.clone().sub(parallel);
  const wa=chest?new THREE.Vector3().copy(chest.angvel()):new THREE.Vector3();
  const parentReaction=chest?perpendicular.clone().negate():T.clone().negate();
  const chestReaction=parallel.clone().negate();
  const closure=T.clone().add(parentReaction).add(chestReaction);
  const effectiveParent=chest?wp.clone().add(axis.clone().multiplyScalar(wa.clone().sub(wp).dot(axis))):wp;
  const power=T.dot(wc)+parentReaction.dot(wp)+chestReaction.dot(wa);
  const pairPower=T.dot(wc.clone().sub(effectiveParent));
  const sample={actuator,fighterIndex:f.index,torque:armCapacityV(T),capNm:cap,explicitRecipientPowerW:power,
    capRatio:cap>0?T.length()/cap:(T.length()===0?0:null),
    finalTorque:armCapacityV(T),finalNorm:T.length(),existingCap:cap,axis:armCapacityV(axis),
    reactions:{child:armCapacityV(T),parent:armCapacityV(parentReaction),chest:armCapacityV(chestReaction)},
    velocities:{child:armCapacityV(wc),parent:armCapacityV(wp),chest:armCapacityV(wa),effectiveParent:armCapacityV(effectiveParent)},
    torqueClosure:armCapacityV(closure),recipientPowerW:power,effectivePairPowerW:pairPower,powerIdentityResidualW:power-pairPower,...details};
  // A diagnostic failure never interrupts the actuator or exposes mutable controller vectors.
  observer.calls++;
  try{observer.callback(structuredClone(sample));}catch(error){observer.errors.push(String(error));}
}
`;

/** Exact markers guard every insertion; clone only receives optional observational hooks. */
export function transformArmCapacityFighter(source,{finalCap=false,portHill=false}={}){
  if(typeof source!=='string'||typeof finalCap!=='boolean'||typeof portHill!=='boolean')throw TypeError('Provide Fighter source and boolean options');
  if(/\barmCapacityObservers\b/.test(source))throw Error('Fighter source already transformed');
  const shoulderMarker='    j.child.addTorque(vecArg(_mT), true);';
  const shoulderCode='    const armCapacityShoulderPreFinal = _mT.clone();\n'+
    (finalCap?'    if (_mT.length() > cap) _mT.setLength(cap);\n':'')+
    "    armCapacityObserve(this,'shoulder',_mT,cap,boneAxis,j.child,j.parent,null,{swingRequestedNorm:tlen,preFinalTorque:armCapacityV(armCapacityShoulderPreFinal)});\n"+shoulderMarker;
  source=once(source,shoulderMarker,shoulderCode);
  if(portHill){
    const marker='    const vAlong = tl > 1e-6 ? ((w.x - fw.x) * torque.x + (w.y - fw.y) * torque.y + (w.z - fw.z) * torque.z) / tl : 0;';
    const replacement=`    const armPortQ = forearm.rotation();
    const armPortAxis = new THREE.Vector3(1,0,0).applyQuaternion(new THREE.Quaternion(armPortQ.x,armPortQ.y,armPortQ.z,armPortQ.w));
    const armPortChestW = chest.angvel();
    const armPortParentW = new THREE.Vector3(fw.x,fw.y,fw.z).addScaledVector(armPortAxis,
      (armPortChestW.x-fw.x)*armPortAxis.x+(armPortChestW.y-fw.y)*armPortAxis.y+(armPortChestW.z-fw.z)*armPortAxis.z);
    const vAlong = tl > 1e-6 ? ((w.x-armPortParentW.x)*torque.x+(w.y-armPortParentW.y)*torque.y+(w.z-armPortParentW.z)*torque.z)/tl : 0;`;
    source=once(source,marker,replacement);
  }
  source=once(source,'    const tl = torque.length();','    const tl = torque.length();\n    const armCapacityWristPrecap = torque.clone();');
  const wristMarker='    torque.add(twist);';
  source=once(source,wristMarker,wristMarker+'\n    const armCapacityWristPreFinal = torque.clone();'+(finalCap?'\n    if (torque.length() > cap) torque.setLength(cap);':''));
  const reactionMarker='    const along = torque.dot(fa);';
  source=once(source,reactionMarker,
    "    armCapacityObserve(this,'wrist',torque,cap,fa,sword,forearm,chest,{precapNorm:tl,precapTorque:armCapacityV(armCapacityWristPrecap),preFinalTorque:armCapacityV(armCapacityWristPreFinal),hillVelocity:vAlong,hill:h,filteredHill:this.wristHill});\n"+reactionMarker);
  return diagnosticHelpers+source;
}
function sharedImports(source){
  return source.replace(/from (['"])([^'"]+)\1/g,(_,q,s)=>'from '+JSON.stringify(s.startsWith('.')?new URL(s,fighterUrl).href:import.meta.resolve(s)));
}

export async function loadArmCapacityCandidates(){
  const source=await readFile(fighterUrl,'utf8');
  const directory=await mkdtemp(join(tmpdir(),'halfsword-arm-capacity-'));
  const options={clone:{},finalCap:{finalCap:true},portHill:{portHill:true},combined:{finalCap:true,portHill:true}};
  const variants={},sourceHashes={original:hash(source)},transformedSources={};
  try{
    for(const [name,option]of Object.entries(options)){
      const transformed=sharedImports(transformArmCapacityFighter(source,option));
      const path=join(directory,name+'.mjs');await writeFile(path,transformed);
      const module=await import(pathToFileURL(path).href);
      variants[name]={driveSword:module.Fighter.prototype.driveSword,manualMuscle:module.Fighter.prototype.manualMuscle,
        setDiagnostics:module.setArmCapacityDiagnostics,diagnosticInfo:module.armCapacityDiagnosticInfo};
      sourceHashes[name]=hash(transformed);transformedSources[name]=transformed;
    }
    return {variants,...variants,sourceHashes,scope:armCapacityScope,
      installer({f,ledger,variant='clone',diagnostics=null,onDiagnostic=diagnostics}){
        const selected=variants[variant];if(!selected)throw TypeError('Unknown arm capacity variant');
        if(!ledger?.replaceObservedMethod)throw TypeError('Provide the actual force ledger');
        const summary={variant,driveSwordCalls:0,manualMuscleCalls:0,diagnostics:null,errors:[]};
        const restorers=[];const restoreDiagnostic=selected.setDiagnostics(f,onDiagnostic);
        try{
          for(const method of ['driveSword','manualMuscle'])restorers.push(ledger.replaceObservedMethod(f,method,function(...args){
            summary[method+'Calls']++;
            try{return selected[method].apply(this,args);}
            finally{summary.diagnostics=selected.diagnosticInfo(this);summary.errors=[...(summary.diagnostics?.errors||[])];}
          }));
        }catch(error){for(const undo of restorers.reverse())undo();restoreDiagnostic();throw error;}
        return {summary,restore(){for(const undo of restorers.reverse())undo();restoreDiagnostic();}};
      },cleanup:()=>rm(directory,{recursive:true,force:true})};
  }catch(error){await rm(directory,{recursive:true,force:true});throw error;}
}
export const prepareArmCapacityCandidate=loadArmCapacityCandidates;
