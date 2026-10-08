/** Native geometry/mass and broken-head contract for the 2026-10-08 compact weapons.
 * node tools/sim/experiments/weapon_compact_gate.mjs /outside/fresh-report.json
 * Controlled component fixtures, not a natural swing or balance test.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {newRound,THREE,RAPIER} from '../harness_m.mjs';
import {MORGENSTERN_DESIGN as D} from '../../../src/morgenstern_design.js';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const out=process.argv[2];
assert(out&&path.isAbsolute(out)&&!fs.existsSync(out),'Fresh absolute output required');
const names=['src/weapons.js','src/weapon_looks.js','src/morgenstern_design.js','src/fighter.js','tools/sim/harness_m.mjs','tools/sim/experiments/weapon_compact_gate.mjs','package-lock.json','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'];
const hashes=()=>Object.fromEntries(names.map(n=>[n,createHash('sha256').update(fs.readFileSync(path.join(root,n))).digest('hex')]));
const before=hashes(),rows=[];
const near=(a,b,label,tol=2e-6)=>assert(Math.abs(a-b)<tol,`${label}: ${a} vs ${b}`);
function bounds(group,omitBreakFace=false){
 group.updateMatrixWorld(true);
 const inv=group.matrixWorld.clone().invert(),m=new THREE.Matrix4(),v=new THREE.Vector3();let lo=Infinity,hi=-Infinity;
 group.traverseVisible(o=>{const pos=o.geometry?.attributes?.position;if(!pos||(omitBreakFace&&o.name==='breakFace'))return;m.multiplyMatrices(inv,o.matrixWorld);for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i).applyMatrix4(m);lo=Math.min(lo,v.y);hi=Math.max(hi,v.y);}});
 return {lo,hi,length:hi-lo};
}
for(const weapon of ['tree_branch','frozen_tuna','morgenstern']){
 const g=newRound({seed:173,weapon,weapon2:'longsword',walls:false});
 try{
  const f=g.player,row={weapon,mass:f.sword.mass(),com:f.sword.localCom(),handInertia:f.swordIhand,mBlunt:f.weaponCfg.mBlunt,visual:bounds(f.swordGroup)};
  if(weapon==='tree_branch'){
   near(row.visual.length,1.1697342694552317*0.9,'branch visual length',1e-5);
   near(row.mass,.32,'branch mass');near(f.weaponCfg.hiltLength,.135,'branch origin-to-blade');near(f.weaponCfg.bladeLength,.72,'branch active length');
   near(f.swordColliders[2].translationWrtParent().y,.495,'branch collider center');
   f.breakWeapon();row.broken={mass:f.sword.mass(),tip:f.weaponCfg.hiltLength+f.weaponCfg.bladeLength,visual:bounds(f.swordGroup)};
   // Existing decorative teeth may rise 30mm * 1.3; retained original meshes stop at cutY.
   row.broken.retained= bounds(f.swordGroup,true);
   assert(row.broken.mass>0&&row.broken.mass<row.mass);assert(row.broken.visual.hi<row.broken.tip+.04);assert(row.broken.retained.hi<row.broken.tip+1e-6);
  }else if(weapon==='frozen_tuna'){
   near(row.mass,1.5,'tuna mass');near(row.mBlunt,2.6,'tuna blunt');
  }else{
   near(row.visual.length,.69,'mace visual length');near(row.mass,2.2,'mace mass');
   near(row.com.y,D.aggregate.comY,'native COM');near(row.handInertia,D.aggregate.handInertia,'native grip inertia');
   near(row.com.y/D.lengthOnly.aggregate.comY,.9,'COM/reference ratio');
   assert(f.weapon.trialOnly&&f.weaponCfg.spike&&!f.weaponCfg.ignoreArmor);
   const cutY=f.weaponCfg.hiltLength+f.weapon.breakAt*f.weaponCfg.bladeLength;
   g.world.gravity={x:0,y:0,z:0};g.world.forEachCollider(c=>c.setCollisionGroups(0));
   g.world.removeImpulseJoint(f.gripJoint,true);f.gripJoint=null;
   for(const i of [2,3])f.swordColliders[i].setCollisionGroups(0x00010001);
   f.sword.setLinearDamping(0);f.sword.setAngularDamping(0);
   const body=g.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setCanSleep(false).setLinearDamping(0).setAngularDamping(0));
   const probe=g.world.createCollider(RAPIER.ColliderDesc.ball(.045).setMass(1).setFriction(0).setRestitution(0).setCollisionGroups(0x00010001),body);
   function block(count){
    f.sword.setTranslation({x:0,y:0,z:0},true);f.sword.setRotation({x:0,y:0,z:0,w:1},true);f.sword.setLinvel({x:0,y:0,z:0},true);f.sword.setAngvel({x:0,y:0,z:0},true);
    body.setTranslation({x:.06,y:D.parts.head.y,z:0},true);body.setLinvel({x:-.1,y:0,z:0},true);body.setAngvel({x:0,y:0,z:0},true);
    const frames=[];
    for(let k=0;k<count;k++){
     const vx=body.linvel().x;g.world.step(g.eventQueue,{filterContactPair:()=>1,filterIntersectionPair:()=>true});let impulse=0,manifolds=0;
     for(const i of [2,3])g.world.contactPair(f.swordColliders[i],probe,m=>{manifolds++;for(let j=0;j<m.numContacts();j++)impulse+=m.contactImpulse(j);});
     frames.push({k,impulse,manifolds,deltaVx:body.linvel().x-vx});
    }
    return {steps:count,maxImpulse:Math.max(...frames.map(x=>x.impulse)),maxDeltaV:Math.max(...frames.map(x=>Math.abs(x.deltaVx))),manifolds:frames.reduce((s,x)=>s+x.manifolds,0),frames};
   }
   row.active=block(8);assert(row.active.maxImpulse>0&&row.active.maxDeltaV>0);
   f.breakWeapon();
   for(const i of [2,3]){assert(!f.swordColliders[i].isEnabled());assert.equal(f.swordColliders[i].collisionGroups(),0);}
   assert(f.swordColliders[4].isEnabled(),'handle sleeve stays');
   row.broken={mass:f.sword.mass(),handInertia:f.swordIhand,cutY,probe:block(48)};
   assert(row.broken.mass>0&&row.broken.mass<row.mass);assert.equal(row.broken.probe.maxImpulse,0);assert.equal(row.broken.probe.maxDeltaV,0);assert.equal(row.broken.probe.manifolds,0);
  }
  rows.push(row);
 }finally{g.eventQueue.free();g.world.free();}
}
const after=hashes();assert.deepEqual(before,after);
fs.writeFileSync(out,JSON.stringify({pass:true,head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),dirty:execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}),sourceBefore:before,sourceAfter:after,sourceStable:true,rows,limits:['Component/isolated native fixtures; no claim of natural break frequency, human feel, or win rate.']},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({pass:true,rows:rows.map(({weapon,mass,com,handInertia,visual,mBlunt})=>({weapon,mass,com,handInertia,visual,mBlunt}))},null,2));
