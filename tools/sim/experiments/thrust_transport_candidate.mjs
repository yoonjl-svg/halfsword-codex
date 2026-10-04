// Read-only actual driveSword target observer. Candidate is src/thrust_plane.js.
import * as T from 'three';
const records=new WeakMap();
export const readThrustTransport=f=>records.get(f);
export function thrustTransport(f,aim,blade,flat,target,moving,ev,enabled){
 const native=f.sword.velocityAtPoint(f.bladePoint(.7,new T.Vector3())),tap=f.skill.tap;
 records.set(f,{enabled,weight:f.skill.thrustPose.w,active:!!(enabled&&tap&&!tap.down&&!tap.bound&&f.skill.thrustPose.w>0),bound:!!tap?.bound,abort:!!tap?.abort,down:!!tap?.down,moving,ev,legacyTarget:target.toArray(),target:target.toArray(),flat:flat.toArray(),blade:blade.toArray(),aim:aim.toArray(),handTarget:f.handTarget.toArray(),cachedVelocity:f.hitPointVel.toArray(),nativeVelocity:[native.x,native.y,native.z],tapTime:tap?.t??null,localThrustDir:[...f.skill.thrustPose.dir],localThrustHand:[...f.skill.thrustPose.hand],yaw:f.yaw.toArray()});
}
export function finishTransport(f,target){const r=records.get(f);if(r)r.target=target.toArray();}
