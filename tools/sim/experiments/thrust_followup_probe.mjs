// Extend the existing production profile A/B replay; no forced injury or candidate changes.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {newRound, DT, THREE, RAPIER, handPos} from '../harness_m.mjs';
import {applyBladeShapeTrial} from '../../../src/blade_shape_trial.js';
const opts=Object.fromEntries(process.argv.slice(2).map(s=>{const m=/^--(out|reference)=(.+)$/.exec(s);assert(m);return[m[1],m[2]];}));
assert(opts.out&&path.isAbsolute(opts.out)&&!fs.existsSync(opts.out));assert(opts.reference&&path.isAbsolute(opts.reference));
const sha=b=>createHash('sha256').update(b).digest('hex'), bytes=fs.readFileSync(opts.reference), reference=JSON.parse(bytes);
assert(reference.pass&&reference.sourceStable&&reference.dt===DT);
const refs=reference.rows;assert.equal(refs.length,2);assert(refs.every(r=>r.frames.length===1080));
const schedule=refs[0].frames.map(f=>({...f.input.request,tap:f.input.tapAccepted===true}));
let nominal=schedule.at(-1).nominal.slice();
function phase(name,ticks,target,held,tap=false) {
  const start=nominal.slice();
  for(let i=0;i<ticks;i++) {
    const next=start.map((v,k)=>v+(target[k]-v)*(i+1)/ticks),delta=next.map((v,k)=>v-nominal[k]);
    schedule.push({phase:name,tick:schedule.length,nominal:next,delta,held,active:Math.abs(delta[0])+Math.abs(delta[1])>1e-5,tap:tap&&i===0});nominal=next;
  }
}
for(let cycle=1;cycle<=3;cycle++) {
  phase('release'+cycle,36,[.1,-.45],false);
  phase('reverse'+cycle,30,[.1,.4],true);
  phase('tapHold'+cycle,48,[.1,.4],true,true);
  phase('recut'+cycle,30,[.1,-.45],true);
  phase('afterRelease'+cycle,60,[.1,-.45],false);
}
phase('endRelease',2400-schedule.length,[.1,-.45],false);
const scan=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(d+'/'+e.name):e.name.endsWith('.js')?[d+'/'+e.name]:[]);
const files=[...scan('src'),'tools/sim/harness_m.mjs','tools/sim/experiments/thrust_followup_probe.mjs','package-lock.json','node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'];
const manifest=()=>Object.fromEntries(files.sort().map(f=>[f,sha(fs.readFileSync(f))]));
const sourceBefore=manifest(),sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
for(const [file,hash] of Object.entries(reference.sourceBefore).filter(([p])=>p.startsWith('src/')))assert.equal(sourceBefore[file],hash,file);
const V=v=>new THREE.Vector3(v.x,v.y,v.z),Q=q=>new THREE.Quaternion(q.x,q.y,q.z,q.w);
const point=(b,p)=>V(p).applyQuaternion(Q(b.rotation())).add(V(b.translation()));
const body=b=>({p:Object.values(b.translation()),q:Object.values(b.rotation()),v:Object.values(b.linvel()),w:Object.values(b.angvel())});
function state(G,f) {
  const blade=new THREE.Vector3(0,1,0).applyQuaternion(Q(f.sword.rotation())),w=V(f.sword.angvel()),contacts=[];
  for(const c of f.swordColliders)G.world.contactPairsWith(c,o=>G.world.contactPair(c,o,m=>{if(m.numContacts())contacts.push({a:c.handle,b:o.handle,other:{actor:G.combat.info.get(o.handle)?.fighter?.index??null,kind:G.combat.info.get(o.handle)?.kind??null,part:G.combat.info.get(o.handle)?.part??null},points:m.numContacts()});}));
  const gaps=f.joints.filter(j=>j.joint?.isValid()).map(j=>point(j.parent,j.joint.anchor1()).distanceTo(point(j.child,j.joint.anchor2())));
  const gripGap=f.gripJoint?.isValid()?point(f.gripJoint.body1(),f.gripJoint.anchor1()).distanceTo(point(f.gripJoint.body2(),f.gripJoint.anchor2())):null;
  return {health:{state:f.state,alive:f.alive,armed:f.armed,arm:f.armHealth,leg:f.legHealth,limbs:{...f.limbs},pain:f.pain,muscle:f.muscle,wounds:f.wounds.map(x=>({part:x.part,type:x.type,severity:x.severity}))},
    sword:body(f.sword),actualHand:handPos(f).toArray(),target:f.handTarget.toArray(),handErrorM:handPos(f).distanceTo(f.handTarget),blade:blade.toArray(),aim:f.debug.aim.toArray(),aimErrorRad:blade.angleTo(f.debug.aim),axialRadS:w.dot(blade),relativeAxialRadS:w.clone().sub(V(f.bodies.farmS.angvel())).dot(blade),tipMps:V(f.sword.velocityAtPoint(f.bladePoint(1,new THREE.Vector3()))).length(),maxJointGapM:Math.max(...gaps),gripGapM:gripGap,missingJoints:f.joints.filter(j=>!j.joint?.isValid()).map(j=>j.name),contacts,
    input:{pad:f.handOffset.toArray(),aim:f.skill.aim.toArray(),held:!!f.handHeld,active:!!f.inputActive,move:f.move.toArray()},
    skill:{tap:!!f.skill.tap,tapDown:!!f.skill.tap?.down,tapBound:!!f.skill.tap?.bound,tapAbort:!!f.skill.tap?.abort,weight:f.skill.thrustPose.w,thrusts:f.skill.thrusts,swinging:f.skill.swinging,swings:f.skill.swings,autoGuard:f.skill.autoGuard,level:f.skill.level}};
}
const rows=[],random=Math.random,startedUTC=new Date().toISOString(),start=performance.now();let pass=false,error=null;
try {
  for(const [i,model] of ['original','transported'].entries()) {
    let G;try {
      G=newRound({seed:7,weapon:'qinggang',weapon2:'longsword',skill:0,difficulty:'normal',onFighter:f=>{f.onehandArmModel='manual';f.thrustEdgeModel='original';}});
      const f=G.player;f.skill.autoGuard=false;
      assert(applyBladeShapeTrial({active:true,model:'profile'},f,RAPIER));
      if(model==='transported')f.thrustEdgeModel='transported';
      const creationNative=sha(G.world.takeSnapshot());assert.equal(creationNative,refs[i].activatedCreation.native);
      const frames=[],transitions=[],taps=[];let previous=[f.state,G.enemy.state],prefixNativeStepsValidated=0;
      for(const request of schedule) {
        if(f.alive){f.handOffset.x+=request.delta[0];f.handOffset.y+=request.delta[1];}
        f.handHeld=request.held;f.inputActive=request.active;f.move.set(0,0);f.stickX=f.stickY=0;
        const tapAccepted=request.tap&&f.alive?f.skill.thrust():null;if(request.tap)taps.push({tick:request.tick,timeBeforeStepS:G.t,accepted:tapAccepted,alive:f.alive,armed:f.armed,state:f.state});
        G.step();const native=sha(G.world.takeSnapshot()),p=state(G,f),e=state(G,G.enemy);
        assert(G.world.bodies.getAll().every(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].every(v=>Object.values(v).every(Number.isFinite))),'Finite native '+request.tick);
        if(request.tick<1080) {assert.equal(native,refs[i].frames[request.tick].trace.native,'Production native prefix '+model+' '+request.tick);prefixNativeStepsValidated++;}
        for(const [index,s] of [p,e].entries())if(s.health.state!==previous[index]){transitions.push({tick:request.tick,timeS:G.t,fighter:index,from:previous[index],to:s.health.state});previous[index]=s.health.state;}
        frames.push({tick:request.tick,timeS:G.t,phase:request.phase,inputRequest:request,tapAccepted,p,e,native});
      }
      const wounds=G.wounds.map(w=>({timeS:w.t,attacker:w.att.index,victim:w.vic.index,zone:w.zone,type:w.type,energyJ:w.energy,severity:w.severity}));
      rows.push({model,creationNative,prefixNativeStepsValidated,taps,transitions,wounds,frames});console.log(JSON.stringify({model,frames:frames.length,prefixNativeStepsValidated,taps,last:pSummary(frames.at(-1).p)}));
    }finally{G?.eventQueue.free();G?.world.free();}
  }
  pass=true;
}catch(e){error={name:e.name,message:e.message,stack:e.stack};throw e;}
finally {
  Math.random=random;const sourceAfter=manifest();fs.mkdirSync(path.dirname(opts.out),{recursive:true});
  fs.writeFileSync(opts.out,JSON.stringify({pass,error,sourceCommit,sourceBefore,sourceAfter,sourceStable:JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter),headStable:sourceCommit===execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),command:process.argv,startedUTC,completedUTC:new Date().toISOString(),wallSeconds:(performance.now()-start)/1000,dt:DT,reference:{path:opts.reference,bytes:bytes.length,sha256:sha(bytes)},schedule,scheduleSHA256:sha(JSON.stringify(schedule)),
    scope:'Current actual public npm game, manual Qinggang/profile player from spawn; only original/transported roll differs, normal original reactive enemy longsword, seed7/default walls and gap5.6, player skill0/autoGuardfalse. Existing9s native prefix must match production reference; new suffix has three tap/release/recut cycles then release to20s. Nominal deltas added to live pad, alive gate, held/active and zero joystick; Skill may generate lunge. No forced wound/health/pose/velocity/contact, park, gain, new motor or timestep. Reactive enemy paths after first difference are not matched-state efficacy; legacy injury handover scene is separate. Physics-time inputs are not human mobile/frame-time acceptance. Missing tap/down/getup/arm-loss states remain unvalidated. Existing prefix replay is validation, not new independent evidence.',rows},null,2)+'\n',{flag:'wx'});
}
function pSummary(p){return {state:p.health.state,alive:p.health.alive,armed:p.health.armed,arm:p.health.arm,leg:p.health.leg};}
