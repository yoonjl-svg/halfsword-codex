// Read-only derivation from saved same-prefix contact runs; no physics execution.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as T from 'three';
const options=Object.fromEntries(process.argv.slice(2).map(s=>{const m=/^--(root|reference|out)=(.+)$/.exec(s);assert(m);return[m[1],m[2]];}));
for(const k of ['root','reference','out'])assert(options[k]&&path.isAbsolute(options[k]));assert(!fs.existsSync(options.out));
const sha=b=>createHash('sha256').update(b).digest('hex'),Q=x=>new T.Quaternion(...x),V=x=>new T.Vector3(...x);
const records={};function read(file){const b=fs.readFileSync(file);records[file]={bytes:b.length,sha256:sha(b)};return JSON.parse(b);}
const original=read(options.root+'/replay-contact-run01.json'),native=read(options.root+'/native-grip-follow-run06.json'),reference=read(options.reference);
assert(original.pass&&original.sourceStable&&native.pass&&native.sourceStable&&reference.pass&&reference.sourceStable);
const ref=reference.rows.find(r=>r.weapon==='qinggang'&&r.mode==='steady'&&r.observed),row=native.rows[0],target=native.targetTick;
assert.equal(native.reference.sha256,records[options.reference].sha256);assert.equal(row.prefixSHA256,original.rows[0].prefixSHA256);
const twist=(a,b,axis)=>{const d=Q(b).multiply(Q(a).invert()).normalize();let angle=2*Math.atan2(new T.Vector3(d.x,d.y,d.z).dot(axis),d.w);if(angle>Math.PI)angle-=2*Math.PI;if(angle< -Math.PI)angle+=2*Math.PI;return angle;};
const relative=s=>Q(s.farmS.q).invert().multiply(Q(s.q));
const aim=s=>Math.acos(T.MathUtils.clamp(V(s.blade).normalize().dot(V(s.aim).normalize()),-1,1));
const normalize=s=>({q:s.sword.q,w:s.sword.w,blade:s.blade,axial:s.axialOmega,relativeAxial:V(s.sword.w).sub(V(s.bodies.farmS.w)).dot(V(s.blade)),aim:s.aim,handErrorM:s.handErrorM,farmS:{q:s.bodies.farmS.q,w:s.bodies.farmS.w}});
const first=[...original.rows,row].map(r=>{
 const f=r.frames.find(f=>f.tick===target),b=f.before,s=f.postPhysics,rb=relative(b),rs=relative(s);
 return {mode:r.mode,preNativeSHA256:f.preNativeSHA256,prefixFrames:r.prefixFrames,prefixSHA256:r.prefixSHA256,
  axialBefore:b.axial,axialAfterPhysics:s.axial,axialAfterCombat:f.afterCombat.axial,relativeAxialAfterPhysics:s.relativeAxial,
  worldTwistRad:twist(b.q,s.q,V(b.blade).normalize()),relativeTwistRad:twist(rb.toArray(),rs.toArray(),new T.Vector3(0,1,0).applyQuaternion(rb).normalize()),
  handErrorM:s.handErrorM,aimErrorRad:aim(s),manifolds:f.contactsAfterPhysics.length,normalImpulseNs:f.contactsAfterPhysics.reduce((n,m)=>n+m.contacts.reduce((n,c)=>n+c.normalImpulse,0),0),tangentScalarsAllZero:f.contactsAfterPhysics.every(m=>m.contacts.every(c=>c.tangentX===0&&c.tangentY===0))};
});assert(first.every(f=>f.preNativeSHA256===first[0].preNativeSHA256));
function summarize(frames){let path=0;for(const f of frames){const a=relative(f.before),b=relative(f.postPhysics);path+=Math.abs(twist(a.toArray(),b.toArray(),new T.Vector3(0,1,0).applyQuaternion(a).normalize()));}
 return {frames:frames.length,firstTick:frames[0].tick,lastTick:frames.at(-1).tick,relativeTwistPathRad:path,maxAbsWorldAxisRadS:Math.max(...frames.map(f=>Math.abs(f.postPhysics.axial))),maxAbsRelativeAxisRadS:Math.max(...frames.map(f=>Math.abs(f.postPhysics.relativeAxial))),meanAimErrorRad:frames.reduce((n,f)=>n+aim(f.postPhysics),0)/frames.length,maxHandErrorM:Math.max(...frames.map(f=>f.postPhysics.handErrorM)),endHandErrorM:frames.at(-1).postPhysics.handErrorM};
}
const candidates=row.frames.filter(f=>f.tick>=target),baseline=candidates.map(f=>({tick:f.tick,before:normalize(ref.frames[f.tick].prePhysics),postPhysics:normalize(ref.frames[f.tick].postPhysics)}));
const output={schema:1,first,nativeGripRecord:row.frames.find(f=>f.tick===target).nativeGrip,
 followingWindow:{baseline:summarize(baseline),nativeGrip:summarize(candidates),scope:'Same saved requested deltas; candidate receives one native motor step at tick965 then disables it. The 31-step window extends an existing candidate and is not a new independent efficacy sample; later native/controller/contact states may diverge.'},
 records,toolSHA256:sha(fs.readFileSync(new URL(import.meta.url))),scope:'Finite-step quaternion swing/twist about the previous blade axis. Relative sword/forearm kinematics are not anatomical wrist rotation, full angular-momentum closure, human naturalness, or a validated world vector motor budget.'};
fs.writeFileSync(options.out,JSON.stringify(output,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({first,followingWindow:output.followingWindow}));
