// Geometry observation and a single-collider shape diagnostic, never a trial.
import assert from 'node:assert/strict';
import * as T from 'three';
import {applyBladeShapeTrial} from '../../../src/blade_shape_trial.js';
const xyz=v=>({...v}),V=v=>new T.Vector3(v.x,v.y,v.z);
const properties=b=>({mass:b.mass(),localCom:xyz(b.localCom()),I:xyz(b.principalInertia()),IFrame:xyz(b.principalInertiaLocalFrame())});
export function inspectWeapon(f){
 const b=f.sword;
 return {actor:f.index,weapon:f.weapon.id,bodyHandle:b.handle,properties:properties(b),p:xyz(b.translation()),q:xyz(b.rotation()),v:xyz(b.linvel()),w:xyz(b.angvel()),F:xyz(b.userForce()),T:xyz(b.userTorque()),
  grip:{handle:f.gripJoint.handle,anchor1:xyz(f.gripJoint.anchor1()),anchor2:xyz(f.gripJoint.anchor2()),frame1:xyz(f.gripJoint.frameX1()),frame2:xyz(f.gripJoint.frameX2())},
  colliders:f.swordColliders.map((c,i)=>({index:i,handle:c.handle,blade:f.bladeColliders.includes(c),shapeType:c.shape.type,p:xyz(c.translation()),q:xyz(c.rotation()),localP:xyz(c.translationWrtParent()),localQ:xyz(c.rotationWrtParent()),friction:c.friction(),restitution:c.restitution(),mass:c.mass(),collisionGroups:c.collisionGroups(),solverGroups:c.solverGroups(),activeHooks:c.activeHooks(),activeEvents:c.activeEvents()}))};
}
export function useVisibleHull(f,R){
 assert.equal(f.weapon.id,'qinggang');assert.equal(f.bladeColliders.length,1);
 const c=f.bladeColliders[0],mesh=f.bladeMesh;
 assert(mesh.geometry?.attributes.position&&mesh.scale.distanceTo(new T.Vector3(1,1,1))===0);
 assert(mesh.quaternion.angleTo(new T.Quaternion())<1e-12);
 assert(mesh.position.distanceTo(V(c.translationWrtParent()))<1e-7,'Visible and collider part origins must agree');
 const attribute=mesh.geometry.attributes.position,vertices=new Float32Array(attribute.count*3);
 for(let i=0;i<attribute.count;i++){vertices[i*3]=attribute.getX(i);vertices[i*3+1]=attribute.getY(i);vertices[i*3+2]=attribute.getZ(i);}
 assert(vertices.every(Number.isFinite));const before=inspectWeapon(f);
 assert(applyBladeShapeTrial({active:true,model:'profile'},f,R));const after=inspectWeapon(f);
 assert.deepEqual(after.properties,before.properties,'Keep explicit component mass/COM/inertia');
 for(const key of ['bodyHandle','p','q','v','w','F','T','grip'])assert.deepEqual(after[key],before[key],key);
 const index=f.swordColliders.indexOf(c);
 for(let i=0;i<after.colliders.length;i++)for(const key of Object.keys(before.colliders[i]))if(key!=='shapeType'||i!==index)assert.deepEqual(after.colliders[i][key],before.colliders[i][key],key);
 return {diagnostic:true,collider:c.handle,vertices:attribute.count,oldShapeType:before.colliders[3].shapeType,newShapeType:c.shape.type,before,after,scope:'Existing visible Qinggang blade convex hull on same single collider, material/hooks/explicit mass/COM/inertia/grip/body state retained. Original box visual simplification was intentional; no bug or realistic-shape acceptance claimed.'};
}
