import assert from 'node:assert/strict';
import {writeFileSync,readFileSync} from 'node:fs';
import {newRound,THREE} from './harness_m.mjs';
import {installForceCap} from './contact_force_cap.mjs';
import {live} from './iberian_beat_live.mjs';
import {compareTrial,OUT} from './iberian_talho_outward.mjs';
const G=newRound({seed:1901,weapon:'zweihander',weapon2:'longsword'}),f=G.enemy,rows=[];
try{
 f.jointByName.uarmS.target.setFromAxisAngle(new THREE.Vector3(1,0,0),1.5);
 const before=JSON.stringify([f.joints.map(({name,k,d,max})=>({name,k,d,max})),f.weaponCfg]);
 f._studyTwistAudit=r=>rows.push(r);f.driveJoints();const original=rows.at(-1);
 const cap=installForceCap(f,{floor:.2,hold:.6,recovery:.4,shoulderTwist:true});assert(cap.begin(G.player));assert(!cap.begin(G.player));
 for(const [t,scale] of [[.3,.2],[.6,.2],[.8,.6],[1,1]]){
  f.stamina.time=t;f.driveJoints();const r=rows.at(-1);
  assert(Math.abs(r.scale-scale)<1e-10);assert(Math.abs(r.cap/original.cap-scale)<1e-10);
  assert(Math.abs(r.servo)<=r.cap+1e-10);assert.equal(r.gravity,original.gravity);
  assert.equal(f._studyShoulderTwistCapScale,undefined);assert.equal(JSON.stringify([f.joints.map(({name,k,d,max})=>({name,k,d,max})),f.weaponCfg]),before);
 }
}finally{G.eventQueue.free();G.world.free();}
const c={seed:1901,atk:'longsword',policy:'slash',reaction:.18,weapon:'zweihander',seconds:9};
const cfg={motion:'native',floor:1,hold:.6,recovery:.4,shoulderTwist:true};
const a=live(c),b=compareTrial(c,cfg);
for(const key of ['health','enemy','commands','duration'])assert.deepEqual(a[key],b[key],key);
const d=compareTrial(c,{...cfg,motion:'outward',floor:.2});assert.equal(b.observation.prefixHash,d.observation.prefixHash);assert.equal(b.observation.first,d.observation.first);
writeFileSync(`${OUT}/checks.json`,JSON.stringify({actualTwist:rows,nativeObserverNoPhysicsChange:true,firstPrefixIdentical:true,first:b.observation.first,case:c,scope:'native vs plain 9s; both arms shared first trigger; real motor caps, gains/gravity preserved; same-attack block'},null,2));
console.log('PASS real shoulder twist cap/timing, native observer identical to unmodified guard, common first trigger');
