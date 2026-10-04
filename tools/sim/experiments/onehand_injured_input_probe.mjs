// One actual injury boundary, then explicit incremental hand input. No state injection.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {newRound, AI, DT, THREE} from '../harness_m.mjs';
import {mainArmMuscle} from '../../../src/arm_recovery_activation.js';

const opts = Object.fromEntries(process.argv.slice(2).map(s => {
  const m = /^--(out|reference)=(.+)$/.exec(s); assert(m, 'Named out/reference only'); return [m[1], m[2]];
}));
assert(opts.out && path.isAbsolute(opts.out) && !fs.existsSync(opts.out), 'Fresh absolute output');
assert(opts.reference && path.isAbsolute(opts.reference), 'Saved observed reference required');
const sha = b => createHash('sha256').update(b).digest('hex');
const refBytes = fs.readFileSync(opts.reference), reference = JSON.parse(refBytes);
const ref = reference.rows.find(r => r.weapon === 'qinggang' && r.model === 'legacy');
assert(ref && reference.sourceStable && reference.options.dt === DT);
const boundary = 1535;
const phases = [
  {name:'release', ticks:36, delta:[0,0], held:false},
  {name:'reverse', ticks:30, delta:[-.40/30,.74/30], held:true},
  {name:'reverseHold', ticks:30, delta:[0,0], held:true},
  {name:'reentryCut', ticks:30, delta:[.32/30,-.64/30], held:true},
  {name:'finalRelease', ticks:54, delta:[0,0], held:false},
];
const schedule = phases.flatMap(phase => Array.from({length:phase.ticks}, (_,i) => ({
  phase:phase.name, phaseTick:i, delta:phase.delta.slice(), held:phase.held,
  active:Math.abs(phase.delta[0])+Math.abs(phase.delta[1])>1e-5,
}))).map((request,i)=>({...request,tick:boundary+1+i}));
const end = boundary + schedule.length;
assert.equal(ref.frames[boundary].p.armHealth, .3665712838676919);
const scan = dir => fs.readdirSync(dir,{withFileTypes:true}).flatMap(e => e.isDirectory()?scan(path.join(dir,e.name)):e.name.endsWith('.js')?[path.join(dir,e.name)]:[]);
const files = [...scan('src'),'package.json','package-lock.json','tools/sim/harness_m.mjs',
  'tools/sim/experiments/onehand_injured_input_probe.mjs',
  'node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'];
const manifest = () => Object.fromEntries(files.sort().map(f=>[f,sha(fs.readFileSync(f))]));
const sourceBefore = manifest(), sourceCommit = execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
for(const [name,hash] of Object.entries(reference.sourceBefore).filter(([n])=>n.startsWith('src/')))
  assert.equal(sourceBefore[name],hash,'Recorded source '+name);
const V = p => new THREE.Vector3(p.x,p.y,p.z), Q = p => new THREE.Quaternion(p.x,p.y,p.z,p.w);
const point = (body,p) => V(p).applyQuaternion(Q(body.rotation())).add(V(body.translation()));
function recordedState(f) {
  let gap=0; for(const j of f.joints) if(j.joint?.isValid()) gap=Math.max(gap,point(j.parent,j.joint.anchor1()).distanceTo(point(j.child,j.joint.anchor2())));
  const bodies=[...Object.values(f.bodies),f.sword], actualHand=point(f.bodies.farmS,{x:.13,y:0,z:0});
  const measurement={commandValid:f.lastDt>0,actualHand:actualHand.toArray(),handTarget:f.handTarget.toArray(),handErrorM:actualHand.distanceTo(f.handTarget),muscle:f.muscle,armMuscle:mainArmMuscle(f),strength:f.strength,vigor:f.vigor,jolt:f.jolt,wristCap:f.debug.wristCap??null,preTwistWrist:f.debug.wristTorque.toArray(),sword:{p:Object.values(f.sword.translation()),q:Object.values(f.sword.rotation()),v:Object.values(f.sword.linvel()),w:Object.values(f.sword.angvel()),F:Object.values(f.sword.userForce()),T:Object.values(f.sword.userTorque())}};
  return {measurement,state:f.state,alive:f.alive,armed:f.armed,armHealth:f.armHealth,legHealth:f.legHealth,pain:f.pain,limbs:{...f.limbs},finishOn:f.finish.on,finishWeight:f.finish.amt,hand:f.handOffset.toArray(),aim:f.skill.aim.toArray(),held:f.handHeld??false,inputActive:f.inputActive??false,handBase:f.handBase?[...f.handBase]:null,tapDown:!!f.skill.tap?.down,tapGo:!!f.skill.tap?.go,thrusts:f.skill.thrusts,gapM:gap,armOmegaRadps:Math.max(...['uarmS','farmS'].map(k=>V(f.bodies[k].angvel()).length())),finite:bodies.every(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].every(v=>Object.values(v).every(Number.isFinite))),wounds:f.wounds.map(w=>({part:w.part,type:w.type,severity:w.severity}))};
}
// Hash serializable controller state; native handles/world are covered by snapshot separately.
function own(object) {
  const omit=new Set(['f','fighter','me','foe','world','scene','R','rb','body','parent','child','joint','rawSet','raw','__wbg_ptr','info','mesh','group','sword','grip','colliderSet']);
  const seen=new WeakSet();
  const copy=(v,n=0)=>{
    if(v===null||['boolean','string'].includes(typeof v)) return v;
    if(typeof v==='number') return Number.isFinite(v)?v:{$number:String(v)};
    if(typeof v!=='object'||n>8||v.isObject3D||typeof v.isValid==='function') return undefined;
    if(v.isVector2||v.isVector3||v.isQuaternion||v.isEuler) return v.toArray();
    if(seen.has(v)) return {$shared:true}; seen.add(v);
    if(Array.isArray(v)) return v.map(x=>copy(x,n+1));
    if(v instanceof Set) return [...v].map(x=>copy(x,n+1));
    if(v instanceof Map) return [...v].map(([k,x])=>[copy(k,n+1),copy(x,n+1)]);
    return Object.fromEntries(Object.entries(v).filter(([k])=>!omit.has(k)).map(([k,x])=>[k,copy(x,n+1)]).filter(([,x])=>x!==undefined));
  }; return copy(object);
}
const events = G => ({clashes:G.clashes,wounds:G.wounds.map(w=>({timeS:w.t,attacker:w.att.index,victim:w.vic.index,zone:w.zone,type:w.type,energyJ:w.energy,severity:w.severity}))});
const controller = G => ({player:own(G.player),enemy:own(G.enemy),ai:own(G.ai),ai2:own(G.ai2),combat:own(G.combat)});
function extra(G,f) {
  const blade=new THREE.Vector3(0,1,0).applyQuaternion(Q(f.sword.rotation())), w=V(f.sword.angvel());
  const contacts=[];
  for(const c of f.swordColliders) G.world.contactPairsWith(c,o=>G.world.contactPair(c,o,(m,flipped)=>{
    if(m.numContacts()) contacts.push({a:c.handle,b:o.handle,otherFighter:G.combat.info.get(o.handle)?.fighter?.index??null,flipped,
      normal:{...m.normal()},points:Array.from({length:m.numContacts()},(_,i)=>({distance:m.contactDist(i),impulse:m.contactImpulse(i)}))});
  }));
  const hand=point(f.bodies.farmS,{x:.13,y:0,z:0});
  const gripGap=f.gripJoint?.isValid()?point(f.gripJoint.body1(),f.gripJoint.anchor1()).distanceTo(point(f.gripJoint.body2(),f.gripJoint.anchor2())):null;
  return {blade:blade.toArray(),aim:f.debug.aim.toArray(),aimErrorRad:blade.angleTo(f.debug.aim),axialOmegaRadS:w.dot(blade),swingOmegaRadS:w.clone().addScaledVector(blade,-w.dot(blade)).length(),tipVelocityMps:V(f.sword.velocityAtPoint(f.bladePoint(1,new THREE.Vector3()))).length(),actualHandVelocityMps:V(f.bodies.farmS.velocityAtPoint(hand)).length(),gripGapM:gripGap,missingJoints:f.joints.filter(j=>!j.joint?.isValid()).map(j=>j.name),contacts,
    input:{pad:f.handOffset.toArray(),held:!!f.handHeld,active:!!f.inputActive,move:f.move.toArray(),stick:[f.stickX??null,f.stickY??null]},
    skill:{level:f.skill.level,autoGuard:f.skill.autoGuard,swinging:f.skill.swinging,swings:f.skill.swings,cutPending:f.skill.cutPending,recovering:f.skill.recovering,idle:f.skill.idle,vel:f.skill.vel.toArray(),aimRaw:f.skill.aimRaw.toArray(),aimVel:f.skill.aimVel.toArray(),activity:f.skill.activity,lunge:f.skill.lunge,tap:own(f.skill.tap)},
    retained:{strength:f.strength,emoMods:own(f.emoMods),bound:own(f.bound),barge:own(f.barge),finish:own(f.finish),gait:own(f.gait)}};
}
const rows=[], originalRandom=Math.random, startedUTC=new Date().toISOString(), started=performance.now();
const savedObservationStepsValidated={originalAI:0,scriptedInput:0};
let freshPrefixStepsValidated=0;
let pass=false,error=null;
try {
  for(const mode of ['originalAI','scriptedInput']) {
    let G;
    try {
      G=newRound({seed:7,walls:false,weapon:'qinggang',weapon2:'longsword',skill:.7,difficulty:'normal',AI2Class:AI,onFighter:f=>{f.onehandArmModel='legacy';}});
      const f=G.player, firstNative=sha(G.world.takeSnapshot()); assert.equal(firstNative,ref.first.nativeSha256);
      const creation={native:firstNative,controller:sha(JSON.stringify(controller(G)))}, frames=[];
      if(rows.length) assert.deepEqual(creation,rows[0].creation,'Same fresh native/controller creation');
      for(let tick=0;tick<=end;tick++) {
        const request=mode==='scriptedInput'&&tick>boundary?schedule[tick-boundary-1]:null;
        const beforeStep={armHealth:f.armHealth,state:f.state,alive:f.alive,armed:f.armed,hand:f.handOffset.toArray(),move:f.move.toArray(),stick:[f.stickX??null,f.stickY??null],input:extra(G,f).input};
        if(request) {
          if(tick===boundary+1) {
            assert(f.alive&&f.armed&&f.state==='stand'&&f.armHealth===ref.frames[boundary].p.armHealth,'Actual injury before takeover');
            G.ai2=null; // Stop issuing new AI actions. Preserve every Fighter/Skill/body state.
          }
          if(f.alive) { f.handOffset.x+=request.delta[0]; f.handOffset.y+=request.delta[1]; }
          f.handHeld=request.held; f.inputActive=request.active; f.move.set(0,0); f.stickX=f.stickY=0;
        }
        const supplied=request?{...request,livePad:f.handOffset.toArray(),move:f.move.toArray(),stick:[f.stickX,f.stickY]}:null;
        G.step(); const p=recordedState(f),e=recordedState(G.enemy),event=events(G), observed=extra(G,f);
        assert(p.finite&&e.finite,'Finite native body state at '+tick);
        if(mode==='originalAI'||tick<=boundary) {
          assert.deepEqual(p,ref.frames[tick].p,'Saved player observation '+tick);
          assert.deepEqual(e,ref.frames[tick].e,'Saved enemy observation '+tick);
          savedObservationStepsValidated[mode]++;
        }
        const trace={native:sha(G.world.takeSnapshot()),controller:sha(JSON.stringify(controller(G))),events:sha(JSON.stringify(event)),input:sha(JSON.stringify(observed.input))};
        if(mode==='scriptedInput'&&tick<=boundary) {
          assert.deepEqual(trace,rows[0].frames[tick].trace,'Full fresh prefix trace '+tick);
          freshPrefixStepsValidated++;
        }
        frames.push({tick,timeS:G.t,phase:request?.phase??'AI',beforeStep,supplied,p,e,observed,trace,events:event});
      }
      rows.push({mode,creation,frames}); console.log(JSON.stringify({mode,frames:frames.length,injury:frames[boundary].p.armHealth,lastState:frames.at(-1).p.state,lastArm:frames.at(-1).p.armHealth}));
    } finally { G?.eventQueue.free(); G?.world.free(); }
  }
  assert.notDeepEqual(rows[0].frames[boundary+1].trace,rows[1].frames[boundary+1].trace,'First input difference has an actual path');
  pass=true;
} catch(e) {error={name:e.name,message:e.message,stack:e.stack};throw e;}
finally {
  Math.random=originalRandom; const sourceAfter=manifest(); fs.mkdirSync(path.dirname(opts.out),{recursive:true});
  fs.writeFileSync(opts.out,JSON.stringify({schemaVersion:1,pass,error,sourceCommit,dirty:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}),sourceBefore,sourceAfter,sourceStable:JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter),headStable:sourceCommit===execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),command:process.argv,startedUTC,completedUTC:new Date().toISOString(),wallSeconds:(performance.now()-started)/1000,
    reference:{path:opts.reference,bytes:refBytes.length,sha256:sha(refBytes),sourceCommit:reference.sourceCommit,scope:'Existing post-Combat observations and creation native hash. Historical per-step full native hashes unavailable.'},
    options:{weapon:'qinggang',model:'legacy',collider:'box',enemy:'longsword',seed:7,skillOption:.7,difficulty:'normal',walls:false,gapM:5.6,dt:DT,boundaryPostCombatTick:boundary,endPostCombatTick:end},schedule,scheduleSHA256:sha(JSON.stringify(schedule)),
    scope:'Fresh original two-AI actual injury prefix; no restored native snapshot, forced wound/health/pose/velocity/contact, park, candidate enable, gain or timestep change. Then stop player AI and supply nominal incremental hand deltas/held/active plus zero joystick each fixed step. Skill/guard/tap/gait/emotion/body/injury state is retained, not reset; player AI emotion/action planning ceases and enemy random draws diverge after takeover. Prepared AI-prefix with physics-time input is not browser wall-time, human control, naturalness or A/B efficacy acceptance. Post-Combat native/body/health; cap/target are last pre-native drive requests; cap is not solved motor impulse.',
    savedObservationStepsValidated,freshPrefixStepsValidated,
    prefixExactToSavedObservations:savedObservationStepsValidated.originalAI===end+1&&savedObservationStepsValidated.scriptedInput===boundary+1,
    freshPrefixNativeControllerInputEventsExact:freshPrefixStepsValidated===boundary+1,firstDifferentRequestTick:pass?boundary+1:null,rows},null,2)+'\n',{flag:'wx'});
}
