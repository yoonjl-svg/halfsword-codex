// Mechanism fixture on actual native bodies. Synthetic pose/omega, not a gameplay success test.
import assert from 'node:assert/strict';
import {readFile,writeFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {newRound,THREE,DT} from '../harness_m.mjs';
import {loadBodyInputTransfer,transformBodyInputTransfer} from './body_input_transfer_candidate.mjs';

const out=process.argv[2]??'/workspace/halfsword-hybrid-evidence/q04-body-input-fixtures.json';
try{await access(out);throw Error('Refuse fixture evidence overwrite');}catch(e){if(e.code!=='ENOENT')throw e;}
const fighterURL=new URL('../../../src/fighter.js',import.meta.url),before=await readFile(fighterURL,'utf8');
const sha=x=>createHash('sha256').update(x).digest('hex'),changed=transformBodyInputTransfer(before,{candidate:true});
assert.equal(changed.replace('eTw * 25 - (wTw - wT.dot(boneAxis)) * 0.8','eTw * 25 - wTw * 0.8'),before);
const modules=await loadBodyInputTransfer(),rows=[];
try{
 for(const targetTwist of [0,2,-2]){
  const G=newRound({seed:7,walls:false,weapon:'longsword'});G.park();const f=G.player,j=f.jointByName.uarmS;
  try{
   const qp=new THREE.Quaternion().copy(j.parent.rotation()),qc=new THREE.Quaternion().copy(j.child.rotation());
   const axis=new THREE.Vector3(1,0,0).applyQuaternion(qc),localAxis=axis.clone().applyQuaternion(qp.clone().invert());
   j.target.copy(qp).invert().multiply(qc);const goal=j.target.clone();
   const delta=new THREE.Quaternion().setFromAxisAngle(localAxis,targetTwist*DT);
   const previous=delta.clone().invert().multiply(goal);
   f.lastDt=DT;j.parent.setAngvel({x:0,y:1.1,z:.3},true);j.child.setAngvel({x:2*axis.x,y:1.1+2*axis.y,z:.3+2*axis.z},true);
   const results=[];
   for(const module of [modules.observe,modules.candidate]){
    j.target.copy(goal);j.prevTarget=previous.clone();j.parent.resetTorques(true);j.child.resetTorques(true);
    module.Fighter.prototype.manualMuscle.call(f,j,j.k,j.d,j.max);results.push(module.q04Read(f));
   }
   const difference=new THREE.Vector3().fromArray(results[1].appliedNm).sub(new THREE.Vector3().fromArray(results[0].appliedNm));
   const expected=axis.clone().multiplyScalar(.8*targetTwist),error=difference.distanceTo(expected);
   assert.ok(Math.abs(results[1].targetTwistRadps-targetTwist)<1e-10);assert.ok(error<1e-10);
   rows.push({targetTwistRadps:targetTwist,actualRelativeTwistRadps:results[1].relativeTwistRadps,expectedTorqueDeltaNm:expected.toArray(),actualTorqueDeltaNm:difference.toArray(),errorNm:error,baseline:results[0],candidate:results[1]});
  }finally{G.eventQueue.free();G.world.free();}
 }
}finally{await modules.cleanup();}
const after=await readFile(fighterURL,'utf8');assert.equal(before,after);
const result={pass:true,sourceStable:true,fighterSha256:sha(before),temporarySourceHashes:modules.sourceHashes,scope:'Synthetic native-body pose/velocity and commanded shoulder quaternion fixtures; no game-step or human-naturalness verdict. Candidate uninstrumented source differs in exactly one damping expression.',rows};
await writeFile(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({out,pass:true,fixtures:rows.length,maxErrorNm:Math.max(...rows.map(r=>r.errorNm))}));
