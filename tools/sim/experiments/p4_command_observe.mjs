// Read final hand/aim commands on the preserved ordinary-r2 native replay.
// No controller branch, target, force, velocity or pose is changed.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import * as THREE from 'three';

const opts=Object.fromEntries(process.argv.slice(2).map(s=>{const m=/^--(reference|out)=(.+)$/.exec(s);assert(m);return[m[1],m[2]];}));
assert(opts.reference&&opts.out&&!fs.existsSync(opts.out));
const bytes=fs.readFileSync(opts.reference),reference=JSON.parse(bytes);
assert(reference.pass&&reference.sourceStable);
const ref=reference.rows.find(r=>r.weapon==='longsword'&&r.mode==='legacy');assert(ref);
const root=reference.directory,sha=b=>createHash('sha256').update(b).digest('hex');
const manifest=()=>Object.fromEntries(Object.keys(reference.frozenBefore).map(name=>[name,sha(fs.readFileSync(path.join(root,name)))]));
const before=manifest();assert.deepEqual(before,reference.frozenBefore);
const {newRound,DT}=await import(pathToFileURL(path.join(root,'tools/sim/harness_m.mjs')).href);
const {applySwordsmanship,recordSwordsmanshipInput}=await import(pathToFileURL(path.join(root,'src/swordsmanship.js')).href);
const {CHARACTERS_BY_ID}=await import(pathToFileURL(path.join(root,'src/characters.js')).href);
const V=v=>new THREE.Vector3(v.x,v.y,v.z),A=a=>new THREE.Vector3(...a);
const clamp=x=>Math.max(-1,Math.min(1,x)),deg=x=>x*180/Math.PI;
const signed=(a,b,axis)=>Math.atan2(new THREE.Vector3().crossVectors(a,b).dot(axis),a.dot(b));
const carry=(v,from,to)=>v.clone().applyQuaternion(new THREE.Quaternion().setFromUnitVectors(from,to));
function planeFor(velocity,blade,flat){
  const transverse=velocity.clone().addScaledVector(blade,-velocity.dot(blade)),speed=transverse.length();
  const normal=new THREE.Vector3().crossVectors(blade,transverse).normalize();
  const error=speed>1e-8?Math.asin(clamp(Math.abs(flat.dot(transverse.clone().normalize())))):null;
  return{velocity:velocity.toArray(),transverse:transverse.toArray(),speed,normal:normal.toArray(),flatErrorDeg:error===null?null:deg(error),dotFlat:normal.dot(flat)};
}
const frames=[],random=Math.random,started=performance.now(),startedUTC=new Date().toISOString();
let G,tick=0,validated=0,error=null,pass=false,plane=null,command=null,previous=null,previousPlanes=null;
try{
  const c=CHARACTERS_BY_ID.heinrich;
  G=newRound({seed:7,weapon:'longsword',weapon2:'longsword',skill:.7,gap:14,walls:false,look2:c.look,difficulty:c.ai.level,persona:{...c.ai.persona,school:'longsword'},onFighter:f=>{if(f.index===0)f.onehandArmModel='manual';}});
  const f=G.player;assert(applySwordsmanship(f));assert.equal(sha(G.world.takeSnapshot()),ref.creationNative);
  const drive=f.driveSword;
  f.driveSword=function(...args){
    const result=drive.apply(this,args);
    // The native primary grip anchor is sword-local (0,0,0). Therefore the
    // desired .7blade point is handTarget + aim*(hiltLength+.7bladeLength).
    const hand=this.handTarget.clone(),aim=this.aimDirW.clone(),chest=V(this.bodies.chest.translation()),yaw=this.yaw.clone();
    const length=this.weaponCfg.hiltLength+.7*this.weaponCfg.bladeLength;
    const point=hand.clone().addScaledVector(aim,length),inv=yaw.clone().invert();
    const localPoint=point.clone().sub(chest).applyQuaternion(inv);
    if(tick>=314){
      assert(previous&&plane);
      const blade=A(plane.blade),flat=A(plane.flat);
      const handVelocity=hand.clone().sub(previous.hand).divideScalar(DT),aimVelocity=aim.clone().sub(previous.aim).multiplyScalar(length/DT);
      const worldVelocity=point.clone().sub(previous.point).divideScalar(DT);
      const bodyVelocity=localPoint.clone().sub(previous.localPoint).divideScalar(DT).applyQuaternion(yaw);
      const planes={world:planeFor(worldVelocity,blade,flat),bodyRelative:planeFor(bodyVelocity,blade,flat),physical:planeFor(A(plane.edgeVelocity),blade,flat)};
      for(const [key,p] of Object.entries(planes)){
        const old=previousPlanes?.[key];
        p.normalSlewDeg=old?deg(signed(carry(A(old.normal),previousPlanes.blade,blade),A(p.normal),blade)):null;
        p.unsignedNormalSlewDeg=p.normalSlewDeg===null?null:Math.min(Math.abs(p.normalSlewDeg),180-Math.abs(p.normalSlewDeg));
        p.dotPhysical=p.speed>1e-8&&planes.physical.speed>1e-8?A(p.transverse).normalize().dot(A(planes.physical.transverse).normalize()):null;
      }
      command={hand:hand.toArray(),aim:aim.toArray(),chest:chest.toArray(),yaw:yaw.toArray(),length,point:point.toArray(),localPoint:localPoint.toArray(),
        handVelocity:handVelocity.toArray(),aimVelocity:aimVelocity.toArray(),commandDecompositionError:worldVelocity.distanceTo(handVelocity.add(aimVelocity)),
        currentHandErrorM:hand.distanceTo(V(this.sword.translation())),swinging:!!this.skill.swinging,planes};
      previousPlanes={...planes,blade};
    }
    previous={hand,aim,chest,yaw,point,localPoint};return result;
  };
  f.p4Read=(stage,values)=>{if(stage==='plane')plane=Object.fromEntries(Object.entries(values).map(([k,v])=>[k,v?.isVector3?v.toArray():v]));};
  for(tick=0;tick<=332;tick++){
    const request=ref.frames[tick].request;plane=command=null;
    f.handOffset.x+=request.delta[0];f.handOffset.y+=request.delta[1];f.handHeld=request.held;f.inputActive=request.active;f.move.set(0,0);f.stickX=f.stickY=0;
    assert(recordSwordsmanshipInput(f,{id:tick,timeS:tick*DT,dx:request.delta[0],dy:request.delta[1],held:request.held,active:request.active}));
    if(request.tap)assert(f.skill.thrust());
    G.step();assert.equal(sha(G.world.takeSnapshot()),ref.frames[tick].native,'Original native frame '+tick);validated++;
    assert.deepEqual(f.handOffset.toArray(),ref.frames[tick].actual.pad,'Applied pad '+tick);
    if(tick>=314){assert(command&&plane);frames.push({tick,request,thrustWeight:f.skill.thrustPose.w,plane,command});}
  }
  pass=true;
}catch(e){error={name:e.name,message:e.message,stack:e.stack};}
finally{
  G?.eventQueue.free();G?.world.free();Math.random=random;
  const after=manifest(),sourceStable=JSON.stringify(before)===JSON.stringify(after);
  const summary=Object.fromEntries(['world','bodyRelative','physical'].map(key=>[key,{
    minTransverseSpeedMps:Math.min(...frames.map(f=>f.command.planes[key].speed)),maxUnsignedNormalSlewDeg:Math.max(...frames.map(f=>f.command.planes[key].unsignedNormalSlewDeg??0)),
    boundary:frames.filter(f=>f.tick>=322&&f.tick<=327).map(f=>({tick:f.tick,swinging:f.command.swinging,...f.command.planes[key]}))
  }]));
  const result={schemaVersion:1,pass:pass&&sourceStable,effectAccepted:false,error,sourceStable,sourceBefore:before,sourceAfter:after,
    reference:{path:opts.reference,bytes:bytes.length,sha256:sha(bytes)},sourceCommit:reference.sourceCommit,frozenRuntimeArtifact:root,
    producerSHA256:sha(fs.readFileSync(new URL(import.meta.url))),command:process.argv,dt:DT,newPhysicsExecutions:1,physicsSteps:validated,
    expectedNativeSteps:333,nativeAndAppliedInputExact:pass,observeStart:314,observeEnd:332,frames,summary,
    contract:'Read final resolved world handTarget and aimDirW after driveSword, before native integration. The same sword-local .7blade material point is formed from the primary grip at0. No command-plane controller is enabled. Original full native snapshots and pads match all333steps.',
    limits:['Command-point motion is a requested trajectory, not guaranteed reachable or actual motion.','World command includes moving chest/yaw; bodyRelative is a diagnostic decomposition, not a second candidate.','Plane geometry does not select a unique natural turn at90deg or when projected motion vanishes.','No new contact, human-naturalness or candidate efficacy claim.'],
    startedUTC,completedUTC:new Date().toISOString(),wallSeconds:(performance.now()-started)/1000};
  fs.mkdirSync(path.dirname(opts.out),{recursive:true});fs.writeFileSync(opts.out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({pass:result.pass,sourceStable,physicsSteps:validated,wallSeconds:result.wallSeconds,error,summary}));
  if(!result.pass)process.exitCode=1;
}
