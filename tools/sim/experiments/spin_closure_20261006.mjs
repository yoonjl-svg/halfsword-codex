// Narrow same-prefix paired-grip discretization screen in the real game.
// No inertia/gain/pose overrides; modes differ only in force vs F*dt impulse.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {newRound, DT, THREE, AI, CONFIG} from '../harness_m.mjs';
import {implicitPointImpulse, pointInverseMass} from './spin_closure_20261006_implicit.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(s => {
  const m = /^--(out|weapons|modes|seconds|from)=(.+)$/.exec(s);
  assert.ok(m, 'Use --out/weapons/modes/seconds/from');
  return [m[1], m[2]];
}));
assert.ok(args.out && !fs.existsSync(args.out), 'Fresh output required');
const weapons = (args.weapons || 'monohoshizao,lightsaber').split(',');
const modes = (args.modes || 'force,impulse').split(',');
assert.ok(weapons.every(w => ['monohoshizao','lightsaber','longsword','zweihander'].includes(w)));
assert.ok(modes.every(m => ['force','impulse','implicit'].includes(m)));
const sha = x => createHash('sha256').update(x).digest('hex');
const scan = d => fs.readdirSync(d, {withFileTypes:true}).flatMap(e => e.isDirectory() ? scan(`${d}/${e.name}`) : e.name.endsWith('.js') ? [`${d}/${e.name}`] : []);
const files = [...scan('src'), 'tools/sim/harness_m.mjs', 'tools/sim/experiments/spin_closure_20261006.mjs', 'tools/sim/experiments/spin_closure_20261006_implicit.mjs', 'package-lock.json', 'node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'];
const manifest = () => Object.fromEntries(files.map(p => [p, sha(fs.readFileSync(p))]));
const sourceBefore = manifest(), startedUTC = new Date().toISOString(), begin = performance.now(), random = Math.random, rows = [];
const V = a => new THREE.Vector3(a.x,a.y,a.z), Q = a => new THREE.Quaternion(a.x,a.y,a.z,a.w);
const point = (b,p) => V(p).applyQuaternion(Q(b.rotation())).add(V(b.translation()));
const axis = b => new THREE.Vector3(0,1,0).applyQuaternion(Q(b.rotation()));
function state(b) {
  const frame = Q(b.rotation()).multiply(Q(b.principalInertiaLocalFrame()));
  const wl = V(b.angvel()).applyQuaternion(frame.clone().invert()), I = V(b.principalInertia());
  const w = V(b.angvel()), a = axis(b), axial = w.dot(a), L = wl.clone().multiply(I).applyQuaternion(frame);
  const Kr = .5 * wl.dot(wl.clone().multiply(I)), Kl = .5 * b.mass() * V(b.linvel()).lengthSq();
  return {position:V(b.translation()).toArray(),rotation:Q(b.rotation()).toArray(),omega:w.toArray(),linear:V(b.linvel()).toArray(),axis:a.toArray(),axial,swing:w.addScaledVector(a,-axial).length(),angularMomentum:L.toArray(),rotationalKJ:Kr,linearKJ:Kl,KJ:Kr+Kl,force:V(b.userForce()).toArray(),torque:V(b.userTorque()).toArray()};
}
function impulseWork(b,J,p) {
  const arm=V(p).sub(V(b.worldCom())), T=arm.cross(J), frame=Q(b.rotation()).multiply(Q(b.principalInertiaLocalFrame())), Tl=T.clone().applyQuaternion(frame.clone().invert()), I=V(b.principalInertia());
  return {linearWorkJ:J.dot(V(b.velocityAtPoint(p))),quadraticJ:.5*(J.lengthSq()/b.mass()+Tl.x*Tl.x/I.x+Tl.y*Tl.y/I.y+Tl.z*Tl.z/I.z)};
}
function snapshot(f) { return [Object.values(f.bodies).map(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()]),f.sword.translation(),f.sword.rotation()]; }
function contacts(G,s) {
  const list=[],seen=new Set();
  for(let i=0;i<s.numColliders();i++) {const c=s.collider(i);G.world.contactPairsWith(c,o=>{
    const key=[String(c.handle),String(o.handle)].sort().join(':');if(seen.has(key))return;seen.add(key);
    G.world.contactPair(c,o,m=>{let normalImpulseNs=0;for(let j=0;j<m.numContacts();j++)normalImpulseNs+=m.contactImpulse(j);const info=G.combat.info.get(o.handle);list.push({other:info?{actor:info.fighter?.name,part:info.part,kind:info.kind}:{fixed:!!o.parent()?.isFixed()},contacts:m.numContacts(),solverContacts:m.numSolverContacts(),normalImpulseNs});});
  });}return list;
}
try {
  for(const weapon of weapons) for(const mode of modes) {
    const from = +(args.from ?? (weapon==='lightsaber'?6.09:4.45));
    const seconds = +(args.seconds ?? (weapon==='lightsaber'?6.3:4.65));
    assert.ok(from>=0&&seconds>from&&seconds<=12);
    let G;
    try {
      G=newRound({seed:7,weapon,weapon2:'longsword',skill:.7,walls:false,AI2Class:AI});
      const f=G.player,s=f.sword,fo=f.bodies.farmO;
      f.skill.autoGuard=true;f.gripPointModel='axial';
      const initialNativeSHA=sha(G.world.takeSnapshot()),prefix=createHash('sha256'),trace=createHash('sha256'),frames=[];
      let active=false,stages={};
      const drive=f.driveSword;f.driveSword=function(...a){const t=V(s.userTorque());const r=drive.apply(this,a);stages.wristTorque=V(s.userTorque()).sub(t).toArray();return r;};
      const off=f.offHand;f.offHand=function(...a){
        const calls=[],beforeSword=state(s),beforeForearm=state(fo),oldSword=s.addForceAtPoint,oldForearm=fo.addForceAtPoint;
        const capture=(body,original)=>(F,p,wake)=>{
          const j=V(F).multiplyScalar(this.lastDt),work=impulseWork(body,j,p),pre=state(body);
          if(active&&mode==='impulse') body.applyImpulseAtPoint(j,p,wake); else if(!(active&&mode==='implicit')) original.call(body,F,p,wake);
          const post=state(body);
          calls.push({body:body===s?'sword':'offForearm',F:V(F).toArray(),J:j.toArray(),point:V(p).toArray(),pre,post,...work,actualInstantDeltaKJ:post.KJ-pre.KJ});
        };
        s.addForceAtPoint=capture(s,oldSword);fo.addForceAtPoint=capture(fo,oldForearm);
        let r;try{r=off.apply(this,a);}finally{s.addForceAtPoint=oldSword;fo.addForceAtPoint=oldForearm;}
        let implicit=null;
        if(active&&mode==='implicit'&&calls.length){
          const p=new THREE.Vector3(...calls[0].point),F=new THREE.Vector3(...calls[0].F),h=this.lastDt;
          const realHand=point(fo,{x:0,y:-.135,z:0}),pommel=point(s,{x:0,y:this.weaponCfg.gripAlong,z:0}),e=pommel.sub(realHand),u=V(fo.velocityAtPoint(p)).sub(V(s.velocityAtPoint(p)));
          const grab=THREE.MathUtils.clamp((CONFIG.GRIP.reach-e.length())/(CONFIG.GRIP.reach*.5),0,1)*Math.min(1,this.muscle)*(.5+.5*this.limbs.armO);
          const raw=e.clone().multiplyScalar(CONFIG.GRIP.k).addScaledVector(u,-CONFIG.GRIP.d).multiplyScalar(grab),c=raw.length()>CONFIG.GRIP.maxForce?CONFIG.GRIP.maxForce/raw.length():1,beta=grab*CONFIG.GRIP.d*c;
          assert.ok(raw.clone().multiplyScalar(c).distanceTo(F)<1e-8,'Reconstructed existing grip law must match');
          const cols=[new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1)].map(j=>V(pointInverseMass(fo,p,j)).add(V(pointInverseMass(s,p,j))).toArray());
          const K=[0,1,2].map(i=>cols.map(col=>col[i])),solved=implicitPointImpulse(F.toArray(),h,beta,K),J=new THREE.Vector3(...solved.impulse),up=u.clone().add(new THREE.Vector3(...solved.pointVelocityChange)),spring=e.clone().multiplyScalar(grab*CONFIG.GRIP.k*c);
          implicit={...solved,K,dt:h,grab,capScale:c,beta,rawForce:F.toArray(),relativeVelocity:u.toArray(),relativeVelocityAfter:up.toArray(),springWorkJ:h*spring.dot(up),dampingWorkJ:-h*beta*up.lengthSq(),implicitNumericalDissipationJ:-.5*J.dot(new THREE.Vector3(...solved.pointVelocityChange))};
          for(let i=0;i<calls.length;i++){
            const call=calls[i],body=i===0?fo:s,j=i===0?J:J.clone().negate(),work=impulseWork(body,j,p);
            call.J=j.toArray();call.pre=state(body);body.applyImpulseAtPoint(j,p,true);call.post=state(body);Object.assign(call,work);call.actualInstantDeltaKJ=call.post.KJ-call.pre.KJ;
          }
          implicit.actualInstantDeltaKJ=calls.reduce((sum,call)=>sum+call.actualInstantDeltaKJ,0);
          implicit.workIdentityErrorJ=implicit.actualInstantDeltaKJ-implicit.springWorkJ-implicit.dampingWorkJ-implicit.implicitNumericalDissipationJ;
        }
        const hand=point(fo,{x:0,y:-.135,z:0}),pommel=point(s,{x:0,y:this.weaponCfg.gripAlong,z:0});
        stages.offHand={calls,implicit,beforeSword,beforeForearm,afterSword:state(s),afterForearm:state(fo),gripping:f.gripping,distanceM:hand.distanceTo(pommel)};
        if(calls.length){assert.equal(calls.length,2);assert.ok(V({x:calls[0].J[0]+calls[1].J[0],y:calls[0].J[1]+calls[1].J[1],z:calls[0].J[2]+calls[1].J[2]}).length()<1e-12);assert.deepEqual(calls[0].point,calls[1].point);}
        return r;
      };
      const worldStep=G.world.step.bind(G.world);G.world.step=function(...a){stages.preNative=state(s);stages.preNativeForearm=state(fo);const r=worldStep(...a);stages.postNative=state(s);stages.postNativeForearm=state(fo);return r;};
      while(G.t<seconds-1e-8){
        active=G.t>=Math.ceil(from/DT)*DT-1e-8;stages={};G.step();
        const native=JSON.stringify(snapshot(f));trace.update(native);if(!active)prefix.update(native);
        const blade=axis(s),wrist=point(f.bodies.farmS,{x:.13,y:0,z:0}),grip=point(s,{x:0,y:0,z:0});
        if(G.t>=from-.15)frames.push({timeS:G.t,active,...stages,postCombat:state(s),aimErrorRad:blade.angleTo(f.aimDirW),tipSpeed:f.tipVel.length(),handErrorM:f.handTarget.distanceTo(wrist),gripAnchorGapM:grip.distanceTo(wrist),contacts:contacts(G,s),state:f.state,wounds:f.wounds.length,clashes:G.clashes,alive:f.alive,armed:f.armed});
        assert.ok([...Object.values(s.rotation()),...Object.values(s.angvel())].every(Number.isFinite));
      }
      const window=frames.filter(x=>x.active),max=fn=>Math.max(...window.map(fn)),firstContact=window.find(x=>x.contacts.some(c=>c.solverContacts>0));
      const summary={weapon,mode,from,seconds,initialNativeSHA,prefixTraceSHA:prefix.digest('hex'),nativeTraceSHA:trace.digest('hex'),maxOmega:max(x=>Math.hypot(...x.postCombat.omega)),maxAxial:max(x=>Math.abs(x.postCombat.axial)),maxSwing:max(x=>x.postCombat.swing),maxRotKJ:max(x=>x.postCombat.rotationalKJ),maxAimErrorRad:max(x=>x.aimErrorRad),maxHandErrorM:max(x=>x.handErrorM),maxGripAnchorGapM:max(x=>x.gripAnchorGapM),maxOffHandDistanceM:max(x=>x.offHand.distanceM),maxTipSpeed:max(x=>x.tipSpeed),firstContactTimeS:firstContact?.timeS??null,final:{state:f.state,armed:f.armed,wounds:f.wounds.length},wounds:G.wounds.map(w=>({timeS:w.t,att:w.att.name,vic:w.vic.name,zone:w.zone,severity:w.severity}))};
      rows.push({...summary,frames});console.log(JSON.stringify(summary));
    } finally {G?.eventQueue.free();G?.world.free();}
  }
} finally {
  Math.random=random;const sourceAfter=manifest();
  fs.writeFileSync(args.out,JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceBefore,sourceAfter,sourceStable:JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter),startedUTC,completedUTC:new Date().toISOString(),wallSeconds:(performance.now()-begin)/1000,settings:{seed:7,dt:DT,skill:.7,bothAI:true,axialPlayerOnly:true},scope:'Real current game/native combat; paired force impulse F*dt substituted only at fixed boundary. Original grip law/limit/point/inertia remain. Implicit mode solves backward Euler damping with current spring force and the original norm cap scale, conserving the shared-point pair and bounding impulse by the original force budget. It records spring work, nonpositive damping work and numerical dissipation separately. Instantaneous impulse kinetic work includes its positive quadratic term and is recorded, not equated with total native energy closure. Immediate impulses precede driveJoints and may change its response. Contact/wound/AI divergence limits same-state inference. No artificial pose/velocity/wound.',rows},null,2)+'\n',{flag:'wx'});
}
