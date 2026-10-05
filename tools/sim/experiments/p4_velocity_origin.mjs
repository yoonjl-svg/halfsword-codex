// One read-only replay of the already frozen ordinary-r2 baseline through the
// first recut boundary. It adds observations, never changes the velocity input.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import * as THREE from 'three';
const options=Object.fromEntries(process.argv.slice(2).map(s=>{const m=/^--(reference|out)=(.+)$/.exec(s);assert(m);return[m[1],m[2]];}));
assert(options.reference&&options.out&&!fs.existsSync(options.out));
const bytes=fs.readFileSync(options.reference),reference=JSON.parse(bytes);
assert(reference.pass&&reference.sourceStable);
const ref=reference.rows.find(r=>r.weapon==='longsword'&&r.mode==='legacy');assert(ref);
const root=reference.directory,sha=b=>createHash('sha256').update(b).digest('hex');
const manifest=()=>Object.fromEntries(Object.keys(reference.frozenBefore).map(name=>[name,sha(fs.readFileSync(path.join(root,name)))]));
const before=manifest();assert.deepEqual(before,reference.frozenBefore,'Use the exact preserved artifact source and dependency versions');
const {newRound,DT}=await import(pathToFileURL(path.join(root,'tools/sim/harness_m.mjs')).href);
const {applySwordsmanship,recordSwordsmanshipInput}=await import(pathToFileURL(path.join(root,'src/swordsmanship.js')).href);
const {CHARACTERS_BY_ID}=await import(pathToFileURL(path.join(root,'src/characters.js')).href);
const V=v=>new THREE.Vector3(v.x,v.y,v.z),Q=q=>new THREE.Quaternion(q.x,q.y,q.z,q.w),A=a=>new THREE.Vector3(...a);
const clamp=x=>Math.max(-1,Math.min(1,x)),deg=x=>x*180/Math.PI;
const signed=(a,b,axis)=>Math.atan2(new THREE.Vector3().crossVectors(a,b).dot(axis),a.dot(b));
const carry=(a,from,to)=>a.clone().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(from,to));
function targetFor(velocity,plane){
  const blade=A(plane.blade),flat=A(plane.flat),target=A(plane.rest),edge=velocity.clone().addScaledVector(blade,-velocity.dot(blade));
  const moving=THREE.MathUtils.smoothstep(edge.length(),.5,2.5),raw=new THREE.Vector3().crossVectors(blade,edge).normalize();
  const chosen=raw.clone();if(chosen.dot(flat)<0)chosen.negate();
  if(moving>0){target.lerp(chosen,moving);if(target.lengthSq()<1e-4)target.copy(chosen);target.normalize();}
  return {velocity:velocity.toArray(),transverseSpeed:edge.length(),moving,rawMotionNormal:raw.toArray(),rawDotFlat:raw.dot(flat),chosenMotionNormal:chosen.toArray(),
    target:target.toArray(),signedErrorDeg:deg(signed(flat,target,blade)),normalizedPositionTorque:new THREE.Vector3().crossVectors(flat,target).dot(blade)};
}
let G,error=null,pass=false,tick=0,validated=0,pre=null,plane=null,postTrack=null,previousCurrentSecant=null;
const frames=[],random=Math.random,started=performance.now(),startedUTC=new Date().toISOString();
try{
  const c=CHARACTERS_BY_ID.heinrich;
  G=newRound({seed:7,weapon:'longsword',weapon2:'longsword',skill:.7,gap:14,walls:false,look2:c.look,difficulty:c.ai.level,persona:{...c.ai.persona,school:'longsword'},
    onFighter:f=>{if(f.index===0)f.onehandArmModel='manual';}});
  const f=G.player;assert(applySwordsmanship(f));assert.equal(sha(G.world.takeSnapshot()),ref.creationNative);
  const drive=f.driveSword,track=f.trackBlade;
  f.driveSword=function(...args){
    if(tick>=314){
      const point=this.bladePoint(.7,new THREE.Vector3()),com=V(this.sword.worldCom()),v=V(this.sword.linvel()),w=V(this.sword.angvel());
      const native=V(this.sword.velocityAtPoint(point)),independent=w.clone().cross(point.clone().sub(com)).add(v);
      const fresh=point.clone().sub(this.hitPointPrev).divideScalar(DT),cached=this.hitPointVel.clone();
      pre={point:point.toArray(),previousTrackedPoint:this.hitPointPrev.toArray(),com:com.toArray(),linvel:v.toArray(),omega:w.toArray(),
        cached:cached.toArray(),currentSecant:fresh.toArray(),native:native.toArray(),independentNative:independent.toArray(),
        nativeCheckErrorMps:native.distanceTo(independent),cachedVsPreviousCurrentSecantMps:previousCurrentSecant?cached.distanceTo(previousCurrentSecant):null,
        nativeVsPriorPostCombatMps:native.distanceTo(A(ref.frames[tick-1].actual.midVelocity))};
      previousCurrentSecant=fresh.clone();
    }
    return drive.apply(this,args);
  };
  f.trackBlade=function(...args){const result=track.apply(this,args);if(tick>=314)postTrack={cached:this.hitPointVel.toArray(),point:this.hitPointPrev.toArray()};return result;};
  f.p4Read=(stage,values)=>{if(tick>=314&&stage==='plane')plane=Object.fromEntries(Object.entries(values).map(([key,value])=>[key,value?.isVector3?value.toArray():value]));};
  for(tick=0;tick<=332;tick++){
    const request=ref.frames[tick].request;pre=plane=postTrack=null;
    f.handOffset.x+=request.delta[0];f.handOffset.y+=request.delta[1];f.handHeld=request.held;f.inputActive=request.active;f.move.set(0,0);f.stickX=f.stickY=0;
    assert(recordSwordsmanshipInput(f,{id:tick,timeS:tick*DT,dx:request.delta[0],dy:request.delta[1],held:request.held,active:request.active}));
    if(request.tap)assert(f.skill.thrust());
    G.step();assert.equal(sha(G.world.takeSnapshot()),ref.frames[tick].native,'Original native frame '+tick);validated++;
    assert.deepEqual(f.handOffset.toArray(),ref.frames[tick].actual.pad,'Applied input '+tick);
    if(tick>=314){
      assert(pre&&plane&&postTrack);assert.deepEqual(postTrack.cached,pre.currentSecant,'trackBlade updates only after driveSword '+tick);
      const velocityVariants=Object.fromEntries(['cached','currentSecant','native'].map(key=>[key,targetFor(A(pre[key]),plane)]));
      const cachedError=A(velocityVariants.cached.target).distanceTo(A(plane.legacyTarget));
      assert(cachedError<1e-12,'Reconstruct exact original goal');
      frames.push({tick,phase:request.phase,thrustWeight:f.skill.thrustPose.w,pre,plane,postTrack,cachedGoalReconstructionError:cachedError,velocityVariants});
    }
  }
  pass=true;
}catch(e){error={name:e.name,message:e.message,stack:e.stack};}
finally{
  G?.eventQueue.free();G?.world.free();Math.random=random;
  const after=manifest(),sourceStable=JSON.stringify(before)===JSON.stringify(after);
  const derived=['cached','currentSecant','native'].map(mode=>{
    let previous=null;const rows=frames.map(f=>{
      const v=f.velocityVariants[mode],blade=A(f.plane.blade),target=A(v.target),raw=A(v.rawMotionNormal),chosen=A(v.chosenMotionNormal);
      const r={tick:f.tick,phase:f.phase,moving:v.moving,rawDotFlat:v.rawDotFlat,signedErrorDeg:v.signedErrorDeg,normalizedPositionTorque:v.normalizedPositionTorque,
        targetSlewDeg:previous?deg(signed(carry(previous.target,previous.blade,blade),target,blade)):null,
        rawMotionSlewDeg:previous?deg(signed(carry(previous.raw,previous.blade,blade),raw,blade)):null,
        chosenMotionSlewDeg:previous?deg(signed(carry(previous.chosen,previous.blade,blade),chosen,blade)):null,
        torqueDelta:previous?v.normalizedPositionTorque-previous.torque:null};
      previous={target,blade,raw,chosen,torque:v.normalizedPositionTorque};return r;
    });
    return{mode,rows,maximumTargetSlewDeg:Math.max(...rows.map(r=>Math.abs(r.targetSlewDeg??0))),maximumNormalizedTorqueDelta:Math.max(...rows.map(r=>Math.abs(r.torqueDelta??0))),
      signChangeTicks:rows.filter((r,i)=>i&&Math.sign(r.rawDotFlat)!==Math.sign(rows[i-1].rawDotFlat)).map(r=>r.tick)};
  });
  const result={schemaVersion:1,pass:pass&&sourceStable,effectAccepted:false,error,sourceStable,sourceBefore:before,sourceAfter:after,
    sourceCommit:reference.sourceCommit,frozenRuntimeArtifact:root,reference:{path:options.reference,bytes:bytes.length,sha256:sha(bytes)},
    producerSHA256:sha(fs.readFileSync(new URL(import.meta.url))),command:process.argv,dt:DT,newPhysicsExecutions:1,physicsSteps:validated,
    expectedNativeSteps:333,nativeAndAppliedInputExact:pass,observeStart:314,observeEnd:332,frames,derived,
    contract:'Original ordinary-r2 longsword baseline, same frozen artifact and original requested input0-332. driveSword/trackBlade wrappers only read. Every full native snapshot and applied pad matches prior baseline. Three velocity choices are evaluated after the replay on the same physical states; only cached velocity was used by the live controller.',
    limits:['Current/native target traces are frozen-state alternatives, not candidate physics or improved gameplay.','Instantaneous world point velocity and a finite-difference interval are different quantities; shorter delay alone does not select a good feedback policy.',
      'No contact, health, force, target, native state or runtime flag is changed. This does not close solver motor work or prove a unique cause.'],
    startedUTC,completedUTC:new Date().toISOString(),wallSeconds:(performance.now()-started)/1000};
  fs.writeFileSync(options.out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({pass:result.pass,effectAccepted:false,physicsSteps:validated,wallSeconds:result.wallSeconds,error,
    sourceStable,derived:derived.map(({rows,...summary})=>({...summary,boundary:rows.filter(r=>r.tick>=319&&r.tick<=327)}))}));
  if(!result.pass)process.exitCode=1;
}
