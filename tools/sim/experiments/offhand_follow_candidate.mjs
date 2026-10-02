// Isolated research: secondary IK follows the current physical pommel.
// Keeps the actual grip spring, paired forces, motor gains and primary/wrist targets.
import { THREE } from '../harness_m.mjs';
export function installOffhandFollowCandidate({f,ledger,observe=false}) {
  const records=[],original=f.constructor.prototype.offArmIK;
  const restore=ledger.replaceObservedMethod(f,'offArmIK',function(target){
    const p=this.sword.translation(),q=this.sword.rotation();
    const actual=new THREE.Vector3(0,this.weaponCfg.gripAlong,0)
      .applyQuaternion(new THREE.Quaternion(q.x,q.y,q.z,q.w)).add(new THREE.Vector3(p.x,p.y,p.z));
    const applied=observe?target:actual;
    records.push({requested:target.toArray(),applied:applied.toArray(),deltaM:target.distanceTo(applied)});
    return original.call(this,applied);
  });
  return {records,restore};
}
