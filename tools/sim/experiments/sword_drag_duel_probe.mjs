/** From-creation real two-AI game screen, one player's sword drag only. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {newRound,AI,DT,CONFIG,THREE} from '../harness_m.mjs';
import {setInertiaCandidate} from './sword_drag_candidate.mjs';
import {mainArmMuscle} from '../../../src/arm_recovery_activation.js';
import {beforeWristResponse,afterWristResponse} from './derive_wrist_response.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const opts=Object.fromEntries(process.argv.slice(2).map(a=>{const m=/^--(out|trial|weapons|seeds|response)=(.+)$/.exec(a);if(!m)throw Error('Unknown duel argument');return [m[1],m[2]];}));
if(!opts.out||fs.existsSync(opts.out))throw Error('Preserve evidence; use --out=NEW_PATH');
const trial=opts.trial??'drag';if(!['drag','brake','available'].includes(trial))throw Error('Unknown trial');
const modes=['original',trial==='drag'?'free':'candidate'];
const weapons=(opts.weapons??'sabre,zweihander').split(','),seeds=(opts.seeds??'7,19').split(',').map(Number);
if(weapons.some(w=>!['sabre','zweihander'].includes(w))||new Set(weapons).size!==weapons.length||seeds.some(s=>![7,19].includes(s))||new Set(seeds).size!==seeds.length)throw Error('Use unique supported conditions');
if(opts.response&&!['on','off'].includes(opts.response))throw Error('Use response=on|off');
const responseMode=opts.response==='on',expectedRows=weapons.length*seeds.length*modes.length+2;
const out=opts.out,sha=x=>createHash('sha256').update(x).digest('hex');
const V=v=>new THREE.Vector3(v.x,v.y,v.z),Q=q=>new THREE.Quaternion(q.x,q.y,q.z,q.w);
const head=()=>execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
function scan(d){return fs.readdirSync(path.join(root,d),{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(d+'/'+e.name):e.name.endsWith('.js')?[d+'/'+e.name]:[]);}
const files=[...scan('src'),'tools/sim/harness_m.mjs','tools/sim/experiments/sword_drag_duel_probe.mjs','tools/sim/experiments/sword_drag_candidate.mjs',
  'tools/sim/experiments/derive_wrist_response.mjs','package-lock.json','node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'].sort();
const manifest=()=>Object.fromEntries(files.map(f=>[f,sha(fs.readFileSync(path.join(root,f)))]));
function control(G){
  return {fighters:[G.player,G.enemy].map(f=>({state:f.state,armHealth:f.armHealth,legHealth:f.legHealth,muscle:f.muscle,vigor:f.vigor,
    pain:f.pain,blood:f.blood,consciousness:f.consciousness,hand:f.handOffset.toArray(),aim:f.skill.aim.toArray(),aimRaw:f.skill.aimRaw.toArray(),
    aimVel:f.skill.aimVel.toArray(),follow:f.skill.follow.toArray(),held:f.handHeld,active:f.inputActive,move:f.move.toArray(),
    wristHill:f.wristHill??null,wristBrake:f.wristBrake??false,prevAim:f.prevAim?.toArray()??null,
    joints:f.joints.map(j=>({name:j.name,target:j.target.toArray(),prevTarget:j.prevTarget?.toArray(),prevRV:j.prevRV?.toArray()}))})),
    clashes:G.clashes,wounds:G.wounds.map(w=>({t:w.t,att:w.att.index,vic:w.vic.index,zone:w.zone,type:w.type,energy:w.energy,severity:w.severity})),
    cutting:[...G.combat.cutting].map(([key,c])=>({key,seen:c.seen,applied:c.applied,Eleft:c.Eleft,stuck:c.stuck,stuckT:c.stuckT}))};
}
function gaps(f){
  const p=(b,a)=>V(a).applyQuaternion(Q(b.rotation())).add(V(b.translation()));
  const rows=f.joints.filter(j=>j.joint?.isValid()).map(j=>p(j.parent,j.joint.anchor1()).distanceTo(p(j.child,j.joint.anchor2())));
  if(f.gripJoint?.isValid()){const j=f.gripJoint;rows.push(p(j.body1(),j.anchor1()).distanceTo(p(j.body2(),j.anchor2())));}
  return Math.max(0,...rows);
}
function kinetic(b){const w=V(b.angvel()).applyQuaternion(Q(b.rotation()).multiply(Q(b.principalInertiaLocalFrame())).invert()),I=b.principalInertia();return .5*b.mass()*V(b.linvel()).lengthSq()+.5*(I.x*w.x*w.x+I.y*w.y*w.y+I.z*w.z*w.z);}
const sourceBefore=manifest(),sourceCommit=head(),started=performance.now(),random=Math.random;
const config={grip:CONFIG.GRIP.reactionModel,support:CONFIG.BODY.supportModel,stance:CONFIG.GAIT.stanceMemory};
function run(weapon,seed,mode,observed=true){
  let G,selection,postCreateInvariant=true,method=null,ops=[],response=null;const undo=[],counts={driveSword:0,driveJoints:0,elbowGravity:0};
  const native=createHash('sha256'),controllers=createHash('sha256'),inputs=createHash('sha256'),frames=[],samples=[],responses=[];
  const begin=performance.now();
  try{
    CONFIG.GRIP.reactionModel='paired';CONFIG.BODY.supportModel='legacy';CONFIG.GAIT.stanceMemory='legacy';
    G=newRound({seed,walls:false,weapon,weapon2:'longsword',AIClass:AI,AI2Class:AI,skill:.7,onFighter:f=>{
      if(f.index!==0)return;
      const properties=()=>JSON.stringify({p:f.sword.translation(),q:f.sword.rotation(),v:f.sword.linvel(),w:f.sword.angvel(),m:f.sword.mass(),I:f.sword.principalInertia(),localCom:f.sword.localCom(),IFrame:f.sword.principalInertiaLocalFrame()});
      const before=properties();selection=setInertiaCandidate(f,mode,trial);postCreateInvariant=before===properties();
    }});
    if(!postCreateInvariant||G.t!==0||G.enemy.sword.angularDamping()===0)throw Error('Creation-only scope violated');
    const f=G.player,first={timeS:G.t,controllerSha256:sha(JSON.stringify(control(G))),
      playerDragPerS:f.sword.angularDamping(),enemyDragPerS:G.enemy.sword.angularDamping(),
      playerReleaseMargin:f.weaponCfg.releaseMargin,enemyReleaseMargin:G.enemy.weaponCfg.releaseMargin,
      armed:f.armed,alive:f.alive,grip:CONFIG.GRIP.reactionModel,support:CONFIG.BODY.supportModel};
    for(const name of Object.keys(counts)){
      const original=f[name];f[name]=function(...args){
        const prior=method;method=name;counts[name]++;
        const activation=mainArmMuscle(this);
        const before=responseMode&&observed&&name==='driveSword'&&this.armed&&activation>=.12?beforeWristResponse(this,null):null;
        try{return original.apply(this,args);}finally{try{if(before)response=afterWristResponse(this,before,activation);}finally{method=prior;}}
      };
      undo.push(()=>{delete f[name];});
    }
    if(observed)for(const [part,b]of [...Object.entries(f.bodies),['sword',f.sword]]){
      const original=b.addTorque;b.addTorque=function(t,wake){if(method){const w=this.angvel();ops.push({path:method,part,T:[t.x,t.y,t.z],omega:[w.x,w.y,w.z],instantaneousPowerW:t.x*w.x+t.y*w.y+t.z*w.z});}return original.call(this,t,wake);};undo.push(()=>{delete b.addTorque;});
    }
    let currentInput,previousHand,afterClashHandChangeSteps=0,firstClash=null,firstPlayerCallback=null,firstPositivePlayerWound=null,maxGap=0,maxPelvisHeight=0,maxPelvisUpwardSpeed=0,maxBodySpeed=0,maxSwordK=0,maxBladeTwist=0,maxReactionClosure=0;
    G.before=()=>{currentInput=[G.player,G.enemy].map(p=>({hand:p.handOffset.toArray(),held:p.handHeld,active:p.inputActive,move:p.move.toArray()}));};
    for(let i=0;i<Math.round(18/DT);i++){
      if(!G.player.alive||!G.enemy.alive)break;
      ops=[];response=null;G.step();
      if([...G.world.bodies.getAll()].some(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].some(v=>Object.values(v).some(x=>!Number.isFinite(x)))))throw Error('Nonfinite native state');
      const n=sha(G.world.takeSnapshot()),c=sha(JSON.stringify(control(G))),input=sha(JSON.stringify(currentInput));native.update(n);controllers.update(c);inputs.update(input);
      const events={clashes:G.clashes,wounds:G.wounds.map(w=>({t:w.t,att:w.att.index,vic:w.vic.index,zone:w.zone,type:w.type,energy:w.energy,severity:w.severity}))};
      frames.push({i,timeS:G.t,native:n,controller:c,input,eventSha256:sha(JSON.stringify(events)),state:f.state,alive:f.alive,armed:f.armed});
      if(responseMode&&observed)responses.push({i,timeS:G.t,response,actualWristTorque:ops.find(o=>o.path==='driveSword'&&o.part==='sword')??null});
      // AI writes handOffset directly; inputActive is a browser-only flag.
      // Count changed commands on steps strictly after the first clash.
      if(firstClash&&previousHand&&currentInput[0].hand.some((v,k)=>v!==previousHand[k]))afterClashHandChangeSteps++;
      previousHand=currentInput[0].hand.slice();
      if(!firstClash&&G.clashes)firstClash={timeS:G.t,i};
      if(!firstPlayerCallback){const w=G.wounds.find(w=>w.vic.index===0);if(w)firstPlayerCallback={timeS:w.t,zone:w.zone,severity:w.severity};}
      if(!firstPositivePlayerWound){const w=G.wounds.find(w=>w.vic.index===0&&w.severity>0);if(w)firstPositivePlayerWound={timeS:w.t,zone:w.zone,severity:w.severity};}
      if(observed){
        const gap=gaps(f),pelvis=f.bodies.pelvis,axis=new THREE.Vector3(0,1,0).applyQuaternion(Q(f.sword.rotation()));
        const reaction=Object.fromEntries(Object.keys(counts).map(p=>[p,ops.filter(t=>t.path===p).reduce((s,t)=>s.map((v,k)=>v+t.T[k]),[0,0,0])]));
        const closure=Math.max(...Object.values(reaction).map(v=>Math.hypot(...v)));maxReactionClosure=Math.max(maxReactionClosure,closure);if(closure>1e-8)throw Error('Selected explicit torque closure violated');
        maxGap=Math.max(maxGap,gap);maxPelvisHeight=Math.max(maxPelvisHeight,pelvis.translation().y);maxPelvisUpwardSpeed=Math.max(maxPelvisUpwardSpeed,pelvis.linvel().y);
        maxBodySpeed=Math.max(maxBodySpeed,...Object.values(f.bodies).map(b=>V(b.linvel()).length()));maxSwordK=Math.max(maxSwordK,kinetic(f.sword));maxBladeTwist=Math.max(maxBladeTwist,Math.abs(V(f.sword.angvel()).dot(axis)));
        if(i%12===0||i===0)samples.push({i,timeS:G.t,state:f.state,armed:f.armed,armHealth:f.armHealth,legHealth:f.legHealth,clashes:G.clashes,wounds:events.wounds,
          playerInput:currentInput[0],pelvisP:V(pelvis.translation()).toArray(),pelvisV:V(pelvis.linvel()).toArray(),swordKJ:kinetic(f.sword),
          swordOmega:V(f.sword.angvel()).toArray(),bladeTwistRadps:V(f.sword.angvel()).dot(axis),gapM:gap,ops,reaction});
      }
    }
    if(Object.values(counts).some(n=>n!==frames.length))throw Error('Original actuator dispatch mismatch');
    const finalEvents=G.wounds.map(w=>({t:w.t,att:w.att.index,vic:w.vic.index,zone:w.zone,type:w.type,energy:w.energy,severity:w.severity}));
    return {weapon,seed,mode,observed,selection,postCreateInvariant,first,frames,samples,responses,counts,finalEvents,nativeTraceSha256:native.digest('hex'),
      controllerTraceSha256:controllers.digest('hex'),inputSha256:inputs.digest('hex'),wallSeconds:(performance.now()-begin)/1000,
      summary:{steps:frames.length,durationS:G.t,firstClash,firstPlayerCallback,firstPositivePlayerWound,afterClashHandChangeSteps,clashes:G.clashes,wounds:G.wounds.length,
        playerAlive:f.alive,enemyAlive:G.enemy.alive,playerArmed:f.armed,finite:true,maxGapM:maxGap,maxPelvisHeightM:maxPelvisHeight,
        maxPelvisUpwardSpeedMps:maxPelvisUpwardSpeed,maxBodySpeedMps:maxBodySpeed,maxSwordKJ:maxSwordK,maxBladeTwistRadps:maxBladeTwist,maxSelectedReactionClosureNm:maxReactionClosure}};
  }finally{undo.reverse().forEach(fn=>fn());G?.eventQueue.free();G?.world.free();Math.random=random;
    CONFIG.GRIP.reactionModel=config.grip;CONFIG.BODY.supportModel=config.support;CONFIG.GAIT.stanceMemory=config.stance;}
}
const rows=[],checks=[];let error=null;
try{
  for(const weapon of weapons)for(const seed of seeds)for(const mode of modes){const r=run(weapon,seed,mode);rows.push(r);console.log(JSON.stringify({weapon,seed,mode,summary:r.summary}));}
  for(const mode of modes)rows.push(run(weapons.at(-1),seeds.at(-1),mode,false));
  for(const r of rows.filter(r=>!r.observed)){
    const a=rows.find(x=>x.observed&&x.weapon===r.weapon&&x.seed===r.seed&&x.mode===r.mode);
    checks.push({mode:r.mode,observerNativeExact:a.nativeTraceSha256===r.nativeTraceSha256,observerControllerExact:a.controllerTraceSha256===r.controllerTraceSha256,
      observerInputExact:a.inputSha256===r.inputSha256,eventExact:JSON.stringify(a.frames.map(f=>f.eventSha256))===JSON.stringify(r.frames.map(f=>f.eventSha256))});
  }
  for(const weapon of weapons)for(const seed of seeds){
    const a=rows.find(r=>r.weapon===weapon&&r.seed===seed&&r.mode==='original'&&r.observed),b=rows.find(r=>r.weapon===weapon&&r.seed===seed&&r.mode===modes[1]&&r.observed);
    checks.push({weapon,seed,creationControllerExact:a.first.controllerSha256===b.first.controllerSha256,firstActualInputExact:a.frames[0].input===b.frames[0].input,
      firstActualTorquesExact:JSON.stringify(a.samples[0].ops)===JSON.stringify(b.samples[0].ops),propertiesUntouched:a.postCreateInvariant&&b.postCreateInvariant});
  }
}catch(e){error=String(e?.stack??e);}
const sourceAfter=manifest(),sourceCommitAfter=head(),sourceStable=sourceCommit===sourceCommitAfter&&JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter);
const measurementValid=!error&&sourceStable&&rows.length===expectedRows&&checks.every(c=>Object.entries(c).every(([k,v])=>typeof v!=='boolean'||v));
const report={schemaVersion:1,sourceCommit,sourceCommitAfter,sourceBefore,sourceAfter,sourceStable,measurementValid,error,executionCount:rows.length,
  createdUTC:new Date().toISOString(),wallSeconds:(performance.now()-started)/1000,rows,checks,
  protocol:{trial,weapons,seeds,responseMode,treatment:trial==='drag'?'Only player sword angular drag0.3→0 immediately after Fighter construction before AI/firststep. Opponent and all other physical properties/controllers unchanged.':trial==='available'?'Only player wristBrakingModel=available immediately after Fighter construction before AI/firststep. Opponent nominal estimator; releaseMargin1.4, gains, masses, inertia, drag and actual force/cap/Hill paths unchanged.':'Only player releaseMargin1.4→1.0 immediately after Fighter construction before AI/firststep. Opponent margin1.4; all damping, masses, inertia, target paths and strength limits unchanged.',
    scene:'Original two reactive AIs/Combat/native contacts. No park, wound injection, pose/velocity edit, AI freeze or native restore. Horizon18s or first death.',
    meaning:'Same initial preparation/controller and first requested actuation. Drag trial changes native damping at t0; brake trial changes controller configuration only. Later AI/input/contacts react to treatment and are episode outcomes, not equal-input efficiency or same-wound direct contrasts.',
    observation:'Selected driveSword/driveJoints/elbowGravity actual torque closure and instantaneous pre-solver power only. Native motor/grip/offHand/contact/body drag work excluded. Controller digest is a stated subset.',
    status:'Research-only screen. Finite/gap/velocity checks do not establish human motion or felt realism.'}};
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({out,measurementValid,executionCount:rows.length,wallSeconds:report.wallSeconds,error}));if(!measurementValid)process.exitCode=1;
