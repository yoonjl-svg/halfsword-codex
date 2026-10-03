/** Actual game screen: identical prepared strokes, then hold/release/reversal.
 * No controller replacement, native snapshot restore or player pose/velocity edit.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { newRound, CONFIG, DT, THREE, handPos } from '../harness_m.mjs';
import { setSwordDrag } from './sword_drag_candidate.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const opts = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = /^--(out)=(.+)$/.exec(a); if (!m) throw Error('Use --out=NEW_PATH'); return [m[1],m[2]];
}));
if (!opts.out || fs.existsSync(opts.out)) throw Error('Preserve evidence; use a new output path');
const sha = v => createHash('sha256').update(v).digest('hex');
const head = () => execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const V = v => new THREE.Vector3(v.x,v.y,v.z), Q = q => new THREE.Quaternion(q.x,q.y,q.z,q.w);
const angle = (a,b) => Math.acos(THREE.MathUtils.clamp(a.dot(b),-1,1));
function sourceFiles(d) {
  return fs.readdirSync(path.join(root,d),{withFileTypes:true}).flatMap(e => e.isDirectory() ? sourceFiles(d+'/'+e.name) : e.name.endsWith('.js') ? [d+'/'+e.name] : []);
}
const files = [...sourceFiles('src'),'tools/sim/harness_m.mjs','tools/sim/experiments/sword_drag_probe.mjs',
  'tools/sim/experiments/sword_drag_candidate.mjs','package-lock.json',
  'node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'].sort();
const manifest = () => Object.fromEntries(files.map(f => [f,sha(fs.readFileSync(path.join(root,f)))]));
function ownState(object) {
  const omit = new Set(['f','fighter','me','foe','world','scene','R','rb','body','parent','child','joint','rawSet','raw',
    '__wbg_ptr','info','mesh','group','sword','grip','colliderSet']);
  const seen = new WeakSet();
  function copy(x, depth=0) {
    if (x===null || typeof x==='string' || typeof x==='boolean') return x;
    if (typeof x==='number') return Number.isFinite(x) ? x : {$number:String(x)};
    if (typeof x!=='object' || depth>8 || x.isObject3D || typeof x.isValid==='function') return undefined;
    if (x.isVector2 || x.isVector3 || x.isQuaternion || x.isEuler) return x.toArray();
    if (seen.has(x)) return {$shared:true}; seen.add(x);
    if (Array.isArray(x)) return x.map(v=>copy(v,depth+1));
    if (x instanceof Set) return [...x].map(v=>copy(v,depth+1));
    if (x instanceof Map) return [...x].map(([k,v])=>[copy(k,depth+1),copy(v,depth+1)]);
    const y={}; for (const [k,v] of Object.entries(x)) if (!omit.has(k)) { const z=copy(v,depth+1); if (z!==undefined) y[k]=z; }
    return y;
  }
  return copy(object);
}
function control(G) {
  return {player:ownState(G.player),enemy:ownState(G.enemy),ai:ownState(G.ai),
    combat:{step:G.combat.stepNo,cutting:ownState(G.combat.cutting),touching:ownState(G.combat.touching),cut:G.combat.cutReactionModel}};
}
function body(b) {
  return {p:V(b.translation()).toArray(),q:Q(b.rotation()).toArray(),v:V(b.linvel()).toArray(),w:V(b.angvel()).toArray(),
    mass:b.mass(),I:V(b.principalInertia()).toArray(),IFrame:Q(b.principalInertiaLocalFrame()).toArray(),
    localCom:V(b.localCom()).toArray(),angularDamping:b.angularDamping()};
}
function bodyWithoutDrag(b) { const s=body(b);delete s.angularDamping;return s; }
function kinetic(b) {
  const w=V(b.angvel()).applyQuaternion(Q(b.rotation()).multiply(Q(b.principalInertiaLocalFrame())).invert());
  const I=b.principalInertia();return .5*b.mass()*V(b.linvel()).lengthSq()+.5*(I.x*w.x*w.x+I.y*w.y*w.y+I.z*w.z*w.z);
}
function gaps(f) {
  const p=(b,a)=>V(a).applyQuaternion(Q(b.rotation())).add(V(b.translation()));
  const rows=f.joints.filter(j=>j.joint?.isValid()).map(j=>({name:j.name,m:p(j.parent,j.joint.anchor1()).distanceTo(p(j.child,j.joint.anchor2()))}));
  if(f.gripJoint?.isValid()){const j=f.gripJoint;rows.push({name:'grip',m:p(j.body1(),j.anchor1()).distanceTo(p(j.body2(),j.anchor2()))});}
  return rows;
}
const high=[.02,.52],low=[.02,-.45],prepareSteps=Math.round(3/DT),strokeSteps=Math.round(.55/DT),afterSteps=Math.round(1.2/DT);
function schedule(ending) {
  return Array.from({length:strokeSteps+afterSteps},(_,i)=>{
    let target=null,phase='hold',held=ending!=='release',active=false;
    if(i<strokeSteps){const u=(i+1)/strokeSteps;target=high.map((v,k)=>v+(low[k]-v)*u);phase='down';held=true;active=true;}
    else if(ending==='reverse' && i<2*strokeSteps){const u=(i-strokeSteps+1)/strokeSteps;target=low.map((v,k)=>v+(high[k]-v)*u);phase='reverse';active=true;}
    else if(ending==='release')phase='release';
    return {i,phase,target,held,active};
  });
}
const sourceBefore=manifest(),sourceCommit=head(),started=performance.now();
const originalRandom=Math.random,originalConfig={grip:CONFIG.GRIP.reactionModel,support:CONFIG.BODY.supportModel,stance:CONFIG.GAIT.stanceMemory};
function run(weapon,ending,mode,observed=true) {
  const begin=performance.now(),requests=schedule(ending),frames=[],metrics=[],undo=[];
  const counts={driveSword:0,driveJoints:0,elbowGravity:0};let G,activePath=null,torques=[];
  try {
    CONFIG.GRIP.reactionModel='paired';CONFIG.BODY.supportModel='legacy';CONFIG.GAIT.stanceMemory='legacy';
    G=newRound({seed:7,walls:false,weapon,weapon2:'longsword',skill:0});G.park();
    const f=G.player;f.skill.autoGuard=false;f.handOffset.set(...high);
    for(const k of ['prev','aim','aimRaw','anchor'])f.skill[k].set(...high);
    f.skill.aimVel.set(0,0);f.skill.vel.set(0,0);f.skill.follow.set(0,0);f.handHeld=true;f.inputActive=false;
    const prefix=[];
    for(let i=0;i<prepareSteps;i++){G.step();prefix.push({native:sha(G.world.takeSnapshot()),control:sha(JSON.stringify(control(G)))});}
    const before={native:sha(G.world.takeSnapshot()),control:sha(JSON.stringify(control(G))),sword:body(f.sword)};
    const properties=bodyWithoutDrag(f.sword),selection=setSwordDrag(f,mode);
    if(JSON.stringify(properties)!==JSON.stringify(bodyWithoutDrag(f.sword)))throw Error('Drag setting changed pose/velocity/mass/inertia');
    for(const name of Object.keys(counts)){
      const original=f[name];f[name]=function(...args){const prior=activePath;activePath=name;counts[name]++;try{return original.apply(this,args);}finally{activePath=prior;}};
      undo.push(()=>{delete f[name];});
    }
    if(observed)for(const [part,b] of [...Object.entries(f.bodies),['sword',f.sword]]){
      const original=b.addTorque;b.addTorque=function(t,wake){
        if(activePath){const w=this.angvel();torques.push({path:activePath,part,T:[t.x,t.y,t.z],omega:[w.x,w.y,w.z],instantaneousPowerW:t.x*w.x+t.y*w.y+t.z*w.z});}
        return original.call(this,t,wake);
      };undo.push(()=>{delete b.addTorque;});
    }
    let previousAxis=new THREE.Vector3(0,1,0).applyQuaternion(Q(f.sword.rotation())),afterAxisTravelRad=0,reverseAxisTravelRad=0;
    const input=createHash('sha256'),native=createHash('sha256'),controllers=createHash('sha256');
    for(const request of requests){
      if(request.target)f.handOffset.set(...request.target);
      f.handHeld=request.held;f.inputActive=request.active;
      const applied={...request,appliedOffset:f.handOffset.toArray()};input.update(JSON.stringify(applied));torques=[];
      const beforeCalls={native:sha(G.world.takeSnapshot()),control:sha(JSON.stringify(control(G)))};
      G.step();
      if([...Object.values(f.bodies),f.sword].some(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].some(v=>Object.values(v).some(x=>!Number.isFinite(x)))))throw Error('Nonfinite actual game body');
      if(!f.alive||!f.armed||!f.gripJoint?.isValid()||G.wounds.length||G.clashes)throw Error('Isolated scene lifecycle/contact violated');
      const frame={i:request.i,timeS:G.t,phase:request.phase,before:beforeCalls,native:sha(G.world.takeSnapshot()),control:sha(JSON.stringify(control(G))),applied};
      native.update(frame.native);controllers.update(frame.control);frames.push(frame);
      if(observed){
        const axis=new THREE.Vector3(0,1,0).applyQuaternion(Q(f.sword.rotation())),travel=angle(previousAxis,axis);previousAxis=axis;
        if(request.i>=strokeSteps)afterAxisTravelRad+=travel;if(request.phase==='reverse')reverseAxisTravelRad+=travel;
        const bladeOmega=V(f.sword.angvel()),jointGaps=gaps(f),tip=f.bladePoint(1,new THREE.Vector3());
        const closure=Object.fromEntries(Object.keys(counts).map(name=>[name,torques.filter(t=>t.path===name).reduce((s,t)=>s.map((v,k)=>v+t.T[k]),[0,0,0])]));
        if(Object.values(closure).some(v=>Math.hypot(...v)>1e-8))throw Error('Explicit torque reaction closure failed');
        metrics.push({i:request.i,timeS:G.t,phase:request.phase,state:f.state,sword:body(f.sword),swordKJ:kinetic(f.sword),
          bladeAxis:axis.toArray(),targetAxis:f.debug.aim.toArray(),bladeAngleErrorRad:angle(axis,f.debug.aim.clone().normalize()),
          handErrorM:handPos(f).distanceTo(f.handTarget),tipSpeedMps:V(f.sword.velocityAtPoint(tip)).length(),
          bladeTwistRadps:bladeOmega.dot(axis),bodyAndSwordKJ:kinetic(f.sword)+Object.values(f.bodies).reduce((s,b)=>s+kinetic(b),0),
          pelvis:body(f.bodies.pelvis),chest:body(f.bodies.chest),upperArm:body(f.bodies.uarmS),forearm:body(f.bodies.farmS),
          jointGaps,maxGapM:Math.max(...jointGaps.map(g=>g.m)),wristCapNm:f.debug.wristCap,wristTorqueBeforeTwist:f.debug.wristTorque.toArray(),
          torques,reactionClosureNm:closure,afterAxisTravelRad,reverseAxisTravelRad});
      }
    }
    if(Object.values(counts).some(n=>n!==requests.length))throw Error('Original actuator dispatch count mismatch');
    return {weapon,ending,mode,observed,prefix,before,selection,counts,frames,metrics,
      nativeTraceSha256:native.digest('hex'),controllerTraceSha256:controllers.digest('hex'),inputSha256:input.digest('hex'),
      wallSeconds:(performance.now()-begin)/1000,finite:true};
  } finally {
    undo.reverse().forEach(fn=>fn());G?.eventQueue.free();G?.world.free();Math.random=originalRandom;
    CONFIG.GRIP.reactionModel=originalConfig.grip;CONFIG.BODY.supportModel=originalConfig.support;CONFIG.GAIT.stanceMemory=originalConfig.stance;
  }
}
const rows=[],checks=[];let error=null;
try {
  for(const weapon of ['sabre','zweihander'])for(const ending of ['hold','release','reverse'])for(const mode of ['original','free']){
    rows.push(run(weapon,ending,mode));console.log(JSON.stringify({weapon,ending,mode}));
  }
  for(const mode of ['original','free'])rows.push(run('zweihander','reverse',mode,false));
  for(const ending of ['hold','release','reverse'])for(const weapon of ['sabre','zweihander']){
    const pair=rows.filter(r=>r.weapon===weapon&&r.ending===ending&&r.observed);
    const [a,b]=pair;const prefixExact=JSON.stringify(a.prefix)===JSON.stringify(b.prefix),branchExact=JSON.stringify(a.before)===JSON.stringify(b.before);
    const requestExact=a.frames.every((f,i)=>JSON.stringify({...f.applied,appliedOffset:null})===JSON.stringify({...b.frames[i].applied,appliedOffset:null}));
    checks.push({weapon,ending,prefixExact,branchExact,requestExact,firstActualTorquesExact:JSON.stringify(a.metrics[0].torques)===JSON.stringify(b.metrics[0].torques)});
  }
  for(const r of rows.filter(r=>!r.observed)){
    const a=rows.find(x=>x.weapon===r.weapon&&x.ending===r.ending&&x.mode===r.mode&&x.observed);
    checks.push({weapon:r.weapon,ending:r.ending,mode:r.mode,observerNativeExact:a.nativeTraceSha256===r.nativeTraceSha256,
      observerControllerExact:a.controllerTraceSha256===r.controllerTraceSha256,observerInputExact:a.inputSha256===r.inputSha256});
  }
}catch(e){error=String(e?.stack??e);}
const sourceAfter=manifest(),sourceCommitAfter=head(),sourceStable=sourceCommit===sourceCommitAfter&&JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter);
const measurementValid=!error&&sourceStable&&rows.length===14&&checks.every(c=>Object.entries(c).every(([k,v])=>typeof v!=='boolean'||v));
const report={schemaVersion:1,sourceCommit,sourceCommitAfter,sourceBefore,sourceAfter,sourceStable,measurementValid,error,
  createdUTC:new Date().toISOString(),wallSeconds:(performance.now()-started)/1000,executionCount:rows.length,checks,rows,
  protocol:{prepareS:3,strokeS:.55,afterS:1.2,DT,skill:0,seed:7,grip:'paired',support:'legacy',
    scene:'Unopposed fixture uses existing G.park at setup; original Fighter/Combat/world step and native contacts remain active. Only hand command state is initialized at time0. No player pose/velocity/health changes or native restore.',
    treatment:'After identical original preparation, only player sword angularDamping0.3→0; mass, inertia, controllers and joint/body damping unchanged. This is not from-spawn efficacy or calibrated air resistance.',
    release:'Original handHeld=false behavior remains; automatic center return may change actual handOffset, so requested schedule and actual pad are separately recorded.',
    observations:'Actual final explicit torque and instantaneous pre-solver recipient power, not native integrated work. Torque reaction closure is not a muscle budget. Larger error/travel is not failure or realism acceptance.',
    status:'Research only; no production source/default/UI change or human acceptance.'}};
fs.mkdirSync(path.dirname(opts.out),{recursive:true});fs.writeFileSync(opts.out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({out:opts.out,measurementValid,executionCount:rows.length,wallSeconds:report.wallSeconds,error}));
if(!measurementValid)process.exitCode=1;
