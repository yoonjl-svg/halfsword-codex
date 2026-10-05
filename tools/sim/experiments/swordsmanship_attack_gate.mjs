/** Diagnostic matched-prefix replay, never a replacement runtime controller.
 * Current unified control versus its learned hand/aim/posture offset frozen
 * only during attack. Original raw mapping, B lead, Skill filter and physics
 * remain active. Run only when the director authorizes the source freeze.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {newRound,DT,RAPIER,THREE,handPos} from '../harness_m.mjs';
import {snapshotWorld} from '../force_ledger.mjs';
import {applySwordsmanship,recordSwordsmanshipInput} from '../../../src/swordsmanship.js';
import {applyBladeShapeTrial} from '../../../src/blade_shape_trial.js';
import {CHARACTERS_BY_ID} from '../../../src/characters.js';
import {WEAPONS} from '../../../src/weapons.js';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const opts=Object.fromEntries(process.argv.slice(2).map(x=>{const m=/^--(out|weapons|attacks|tailS|modes|qinggangSetup)=(.+)$/.exec(x);assert(m);return [m[1],m[2]];}));
const qinggangSetup=opts.qinggangSetup??'trial';assert(['trial','ordinary'].includes(qinggangSetup));
const out=opts.out;
assert(out&&path.isAbsolute(out)&&!fs.existsSync(out)&&!fs.existsSync(out+'.receipt.json'),'Fresh absolute --out required.');
const weapons=(opts.weapons??'qinggang,longsword').split(','),attacks=(opts.attacks??'vertical,diagonal,horizontal,tap').split(',');
assert(weapons.length>0&&weapons.every(x=>Object.hasOwn(WEAPONS,x)&&!WEAPONS[x].gun)&&new Set(weapons).size===weapons.length,'Canonical melee weapon ids only; no pistol or aliases.');
assert(attacks.every(x=>['vertical','diagonal','horizontal','tap'].includes(x))&&new Set(attacks).size===attacks.length);
const modes=(opts.modes??'current,freezeGoals').split(',');
assert(modes.every(x=>['current','freezeGoals'].includes(x))&&new Set(modes).size===modes.length);
const tailS=Number(opts.tailS??.35);assert(Number.isFinite(tailS)&&tailS>=.35&&tailS<=2);
const sha=x=>createHash('sha256').update(x).digest('hex');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const scan=d=>fs.readdirSync(path.join(root,d),{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(d+'/'+e.name):e.name.endsWith('.js')?[d+'/'+e.name]:[]);
const sourceFiles=[...scan('src'),'tools/sim/harness_m.mjs','tools/sim/force_ledger.mjs','tools/sim/experiments/swordsmanship_attack_gate.mjs','package-lock.json',
  'node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'].sort();
const manifest=()=>Object.fromEntries(sourceFiles.map(p=>[p,sha(fs.readFileSync(path.join(root,p)))]));
const sourceBefore=manifest(),sourceCommit=git('rev-parse','HEAD'),dirtyBefore=git('status','--porcelain');
const vector=v=>new THREE.Vector3(v.x,v.y,v.z),quaternion=q=>new THREE.Quaternion(q.x,q.y,q.z,q.w);
function plain(v,depth=0,seen=new WeakSet()) {
  if(v==null||['string','number','boolean'].includes(typeof v))return v;
  if(typeof v!=='object'||depth>7)return undefined;
  if(v.isVector2||v.isVector3||v.isQuaternion||v.isEuler)return v.toArray();
  if(seen.has(v))return {$shared:true};seen.add(v);
  if(Array.isArray(v))return v.map(x=>plain(x,depth+1,seen));
  return Object.fromEntries(Object.entries(v).filter(([k,x])=>!['me','f','fighter','foe','world','scene','R','raw','rawSet','profile','table'].includes(k)&&typeof x!=='function').map(([k,x])=>[k,plain(x,depth+1,seen)]).filter(([,x])=>x!==undefined));
}
function controls(f) {
  const s=f.swordsmanshipState;
  return {pad:f.handOffset.toArray(),handBase:f.handBase?.slice(),bodyPose:{...f.bodyPose},bodyPoseVelocity:{...f.bodyPoseVel},
    skill:plain(f.skill),gait:plain(f.gait),assist:plain(s),health:{state:f.state,alive:f.alive,armed:f.armed,limbs:{...f.limbs},pain:f.pain,armHealth:f.armHealth},
    joints:Object.fromEntries(f.joints.map(j=>[j.name,{target:j.target.toArray(),k:j.k,d:j.d,max:j.max,gain:j.gain??1}]))};
}
function scalarState(f) {
  const axis=new THREE.Vector3(0,1,0).applyQuaternion(quaternion(f.sword.rotation())),omega=vector(f.sword.angvel());
  const tip=f.bladePoint(1,new THREE.Vector3()),cut=f.bladePoint(.7,new THREE.Vector3());
  const sword=snapshotWorld(f.world,{bodies:[f.sword]}).bodies[0];
  const localOmega=omega.clone().applyQuaternion(quaternion(f.sword.rotation()).multiply(quaternion(f.sword.principalInertiaLocalFrame())).invert());
  const I=f.sword.principalInertia(),mass=f.sword.mass(),v=f.sword.linvel();
  const independentK=.5*mass*(v.x*v.x+v.y*v.y+v.z*v.z)+.5*(I.x*localOmega.x**2+I.y*localOmega.y**2+I.z*localOmega.z**2);
  const point=(b,p)=>vector(p).applyQuaternion(quaternion(b.rotation())).add(vector(b.translation()));
  const gaps=Object.fromEntries(f.joints.filter(j=>j.joint?.isValid()).map(j=>[j.name,point(j.parent,j.joint.anchor1()).distanceTo(point(j.child,j.joint.anchor2()))]));
  for(const [name,j] of [['mainGrip',f.gripJoint],['offGrip',f.offGripJoint]])if(j?.isValid())gaps[name]=point(j.body1(),j.anchor1()).distanceTo(point(j.body2(),j.anchor2()));
  return {tipWorld:tip.toArray(),point70World:cut.toArray(),tipVelocity:vector(f.sword.velocityAtPoint(tip)).toArray(),point70Velocity:vector(f.sword.velocityAtPoint(cut)).toArray(),
    axis:axis.toArray(),omega:omega.toArray(),axialOmegaRadps:omega.dot(axis),handWorld:handPos(f).toArray(),worldHandGoal:f.handTarget.toArray(),worldAimGoal:f.debug.aim.toArray(),
    sword:{mass:sword.mass,worldCOM:sword.com,localCOM:sword.localCom,position:sword.position,rotation:sword.rotation,velocity:sword.velocity,omega:sword.omega,inertia:sword.inertia,
      kineticTranslationJ:sword.Ktranslation,kineticRotationJ:sword.Krotation,kineticTotalJ:sword.K,independentKineticTotalJ:independentK,kineticCrosscheckErrorJ:Math.abs(sword.K-independentK)},
    wrist:{requestedTorque:f.debug.wristTorque.toArray(),capNm:f.debug.wristCap,requestedTorqueMagnitudeNm:f.debug.wristTorque.length()},gaps};
}
function enemyContact(G) {
  const enemy=new Set(G.enemy.meshes.map(m=>m.rb.handle));let contact=false;
  for(const {rb} of G.player.meshes)if(rb?.isValid())for(let i=0;i<rb.numColliders();i++)G.world.contactPairsWith(rb.collider(i),other=>{
    if(!enemy.has(other.parent()?.handle))return;
    G.world.contactPair(rb.collider(i),other,m=>{if(m.numContacts()||m.numSolverContacts())contact=true;});
  });
  return contact;
}
function makeSchedule(initial,attack) {
  const plan={vertical:{prepare:[.10,.42],end:[.10,-.42]},diagonal:{prepare:[-.35,.40],end:[.35,-.40]},horizontal:{prepare:[-.42,.03],end:[.42,.03]},tap:{prepare:[.15,.10],end:[.15,.10]}}[attack];
  const schedule=[];let last=initial.slice();
  const phase=(name,seconds,target,tap=false)=>{
    const start=last.slice(),n=Math.round(seconds/DT);
    for(let i=0;i<n;i++){const pad=start.map((v,k)=>v+(target[k]-v)*(i+1)/n),delta=pad.map((v,k)=>v-last[k]);schedule.push({tick:schedule.length,phase:name,pad,delta,held:true,active:Math.hypot(...delta)>1e-5,tap:tap&&i===0,attack:name==='attack'||name==='residual'});last=pad;}
  };
  phase('ready',.5,last);phase('prepare',.6,plan.prepare);phase('preparedHold',.4,plan.prepare);phase('attack',.25,plan.end,attack==='tap');phase('residual',tailS,plan.end);
  return schedule;
}
const magnitude=a=>Math.hypot(...a);
function summarize(frames) {
  const series={tipSpeedMps:frames.map(f=>magnitude(f.actual.tipVelocity)),point70SpeedMps:frames.map(f=>magnitude(f.actual.point70Velocity)),swordKineticJ:frames.map(f=>f.actual.sword.kineticTotalJ)};
  return {steps:frames.length,durationS:frames.length*DT,metrics:Object.fromEntries(Object.entries(series).map(([key,xs])=>{
    const maximum=Math.max(...xs),i=xs.indexOf(maximum),last=xs.length-1;
    return [key,{peak:maximum,peakTimeFromAttackS:frames[i].attackTimeS,mean:xs.reduce((a,b)=>a+b,0)/xs.length,
      last:xs[last],peakWithinLast50ms:i>=xs.length-6,lastAtLeast95PercentOfPeak:xs[last]>=.95*maximum,
      windowMayTruncatePeak:i>=xs.length-6||xs[last]>=.95*maximum}];
  })),tipPathApproxM:series.tipSpeedMps.reduce((a,b)=>a+b,0)*DT,point70PathApproxM:series.point70SpeedMps.reduce((a,b)=>a+b,0)*DT,
    wristAtLeast95PercentCapFrames:frames.filter(f=>f.actual.wrist.capNm>0&&f.actual.wrist.requestedTorqueMagnitudeNm>=.95*f.actual.wrist.capNm).length,
    swordExplicitTorqueWorkApproxJ:frames.reduce((s,f)=>s+f.swordTorqueCalls.reduce((v,c)=>v+c.atCallPowerW*DT,0),0),
    swordExplicitPositiveWorkApproxJ:frames.reduce((s,f)=>s+f.swordTorqueCalls.reduce((v,c)=>v+Math.max(0,c.atCallPowerW)*DT,0),0),
    swordExplicitNegativeWorkApproxJ:frames.reduce((s,f)=>s+f.swordTorqueCalls.reduce((v,c)=>v+Math.min(0,c.atCallPowerW)*DT,0),0),
    maximumJointGapM:Math.max(...frames.map(f=>Math.max(...Object.values(f.actual.gaps)))),
    maximumAbsAxialOmegaRadps:Math.max(...frames.map(f=>Math.abs(f.actual.axialOmegaRadps))),
    maximumKineticCrosscheckErrorJ:Math.max(...frames.map(f=>f.actual.sword.kineticCrosscheckErrorJ))};
}
const rows=[],comparisons=[],started=performance.now(),startedUTC=new Date().toISOString(),random=Math.random;
let error=null,pass=false;
try {
 for(const weapon of weapons)for(const attack of attacks)for(const mode of modes) {
  let G,restorePrepare,restoreTorque,row;
  try {
   const c=CHARACTERS_BY_ID.heinrich;
   G=newRound({seed:7,weapon,weapon2:'longsword',skill:.7,gap:14,walls:false,look2:c.look,difficulty:c.ai.level,persona:{...c.ai.persona,school:'longsword'},onFighter:f=>{if(f.index===0)f.onehandArmModel='manual';}});
   const f=G.player;f.skill.autoGuard=true;
   if(weapon==='qinggang'&&qinggangSetup==='trial'){f.thrustEdgeModel='transported';assert(applyBladeShapeTrial({active:true,model:'profile'},f,RAPIER));G.combat.finishRuleModel='armorCausal';G.combat.finishRuleFighter=f;}
   assert(applySwordsmanship(f));
   const schedule=makeSchedule(f.handOffset.toArray(),attack),prefixSteps=schedule.filter(x=>!x.attack).length;
   let attackActive=false,prepareCalls=0,freezeCalls=0,torqueCalls=[];
   const prepareOwn=Object.getOwnPropertyDescriptor(f,'prepareSwordsmanship'),prepare=f.prepareSwordsmanship;
   const prepareWrapper=function(dt){prepareCalls++;const s=this.swordsmanshipState,moving=s.moving;if(attackActive&&mode==='freezeGoals'){s.moving=false;freezeCalls++;}try{return prepare.call(this,dt);}finally{s.moving=moving;}};
   f.prepareSwordsmanship=prepareWrapper;restorePrepare=()=>{assert.equal(f.prepareSwordsmanship,prepareWrapper);if(prepareOwn)Object.defineProperty(f,'prepareSwordsmanship',prepareOwn);else delete f.prepareSwordsmanship;};
   const torqueOwn=Object.getOwnPropertyDescriptor(f.sword,'addTorque'),addTorque=f.sword.addTorque;
   const torqueWrapper=function(t,...args){const w=this.angvel();torqueCalls.push({torque:[t.x,t.y,t.z],omegaAtCall:[w.x,w.y,w.z],atCallPowerW:t.x*w.x+t.y*w.y+t.z*w.z});return addTorque.call(this,t,...args);};
   f.sword.addTorque=torqueWrapper;restoreTorque=()=>{assert.equal(f.sword.addTorque,torqueWrapper);if(torqueOwn)Object.defineProperty(f.sword,'addTorque',torqueOwn);else delete f.sword.addTorque;};
   const prefixNative=createHash('sha256'),prefixControl=createHash('sha256'),inputHash=createHash('sha256'),creationNativeSHA256=sha(G.world.takeSnapshot());
   row={weapon,weaponMetadata:{trialOnly:!!WEAPONS[weapon].trialOnly,previouslyUnstable:['monohoshizao','lightsaber'].includes(weapon)},attack,mode,creationNativeSHA256,prefixSteps,frames:[],checks:{finite:true,healthy:true,noOpponentContact:true,kineticCrosscheck:true,inputAccepted:true,onePreparePerStep:true},scheduleSHA256:sha(JSON.stringify(schedule))};rows.push(row);
   let previousActual=null,previousControl=null;
   for(const request of schedule) {
    attackActive=request.attack;torqueCalls=[];const callsBefore=prepareCalls;
    f.handOffset.set(...request.pad);f.handHeld=true;f.inputActive=request.active;f.move.set(0,0);f.stickX=f.stickY=0;
    const event={id:request.tick,timeS:request.tick*DT,dx:request.delta[0],dy:request.delta[1],held:true,active:request.active};
    row.checks.inputAccepted&&=recordSwordsmanshipInput(f,event);inputHash.update(JSON.stringify({pad:f.handOffset.toArray(),event}));
    if(request.tap)row.tapAccepted=f.skill.thrust();
    G.step();
    const native=sha(G.world.takeSnapshot()),control=controls(f);
    const finite=G.world.bodies.getAll().every(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].every(v=>Object.values(v).every(Number.isFinite)));
    row.checks.finite&&=finite;row.checks.onePreparePerStep&&=prepareCalls===callsBefore+1;
    row.checks.healthy&&=f.alive&&f.armed&&f.state==='stand'&&f.wounds.length===0&&f.pain<=1e-12&&Object.values(f.limbs).every(x=>x>=1-1e-12);
    row.checks.noOpponentContact&&=!enemyContact(G);
    if(!request.attack){prefixNative.update(native+'\n');prefixControl.update(JSON.stringify({player:control,enemy:controls(G.enemy),ai:plain(G.ai)})+'\n');}
    if(request.tick===prefixSteps-1){row.prefixBoundary={nativeSHA256:native,control,actual:scalarState(f)};previousActual=row.prefixBoundary.actual;previousControl=control;}
    if(request.attack) {
      const actual=scalarState(f);row.checks.kineticCrosscheck&&=actual.sword.kineticCrosscheckErrorJ<=1e-8*Math.max(1,actual.sword.kineticTotalJ);
      row.frames.push({tick:request.tick,timeS:G.t,attackTimeS:(request.tick-prefixSteps+1)*DT,phase:request.phase,request,event,nativeSHA256:native,control,actual,swordTorqueCalls:torqueCalls,
        actualHandDelta:previousActual?actual.handWorld.map((x,i)=>x-previousActual.handWorld[i]):null,
        rawHandDelta:previousControl?control.assist.rawHand.map((x,i)=>x-previousControl.assist.rawHand[i]):null,
        resolvedHandDelta:previousControl?control.assist.hand.map((x,i)=>x-previousControl.assist.hand[i]):null,
        actualTipDelta:previousActual?actual.tipWorld.map((x,i)=>x-previousActual.tipWorld[i]):null});previousActual=actual;previousControl=control;
    }
    if(!finite)break;
   }
   row.prefixNativeSHA256=prefixNative.digest('hex');row.prefixControlSHA256=prefixControl.digest('hex');row.inputSHA256=inputHash.digest('hex');row.prepareCalls=prepareCalls;row.freezeCalls=freezeCalls;
   row.checks.tapAccepted=attack!=='tap'||row.tapAccepted===true;
   row.checks.complete=row.frames.length===schedule.length-prefixSteps;row.checks.originalsCalledOnce=prepareCalls===schedule.length;
   row.summary={attack:summarize(row.frames.filter(f=>f.phase==='attack')),wholeWindow:summarize(row.frames)};
   row.wounds=G.wounds.map(w=>({timeS:w.t,attacker:w.att.index,victim:w.vic.index,type:w.type,energyJ:w.energy,severity:w.severity}));
   console.log(JSON.stringify({weapon,attack,mode,checks:row.checks,summary:row.summary.wholeWindow}));
  }finally{const es=[];for(const fn of [()=>restoreTorque?.(),()=>restorePrepare?.(),()=>G?.eventQueue.free(),()=>G?.world.free()])try{fn();}catch(e){es.push(e);}if(es.length)throw new AggregateError(es,'Diagnostic cleanup failed');}
 }
 if(modes.includes('current')&&modes.includes('freezeGoals'))for(const weapon of weapons)for(const attack of attacks) {
  const [a,b]=['current','freezeGoals'].map(mode=>rows.find(r=>r.weapon===weapon&&r.attack===attack&&r.mode===mode));
  const eq=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
  comparisons.push({weapon,attack,creationNativeExact:a.creationNativeSHA256===b.creationNativeSHA256,prefixNativeExact:a.prefixNativeSHA256===b.prefixNativeSHA256,prefixControlExact:a.prefixControlSHA256===b.prefixControlSHA256,
    prefixBoundaryActualExact:eq(a.prefixBoundary.actual,b.prefixBoundary.actual),prefixBoundaryControlExact:eq(a.prefixBoundary.control,b.prefixBoundary.control),suppliedAndAppliedInputExact:a.inputSHA256===b.inputSHA256,
    leadYawTraceExact:a.frames.every((f,i)=>f.control.assist.leadYaw===b.frames[i].control.assist.leadYaw),directChestYawTraceExact:a.frames.every((f,i)=>f.control.assist.body.directChestYaw===b.frames[i].control.assist.body.directChestYaw),
    goalFreezeConstant:b.frames.every(f=>eq(f.control.assist.handCorrection,b.prefixBoundary.control.assist.handCorrection)&&eq(f.control.assist.aimCorrection,b.prefixBoundary.control.assist.aimCorrection)&&eq(f.control.assist.postureBody,b.prefixBoundary.control.assist.postureBody)),
    tapAccepted:attack==='tap'?a.tapAccepted===true&&b.tapAccepted===true:null,
    tapNativeNoopExact:attack==='tap'?a.frames.every((f,i)=>f.nativeSHA256===b.frames[i].nativeSHA256):null,
    current:a.summary,freezeGoals:b.summary});
 }
 pass=rows.length===weapons.length*attacks.length*modes.length&&rows.every(r=>Object.values(r.checks).every(Boolean))&&comparisons.every(c=>c.creationNativeExact&&c.prefixNativeExact&&c.prefixControlExact&&c.prefixBoundaryActualExact&&c.prefixBoundaryControlExact&&c.suppliedAndAppliedInputExact&&c.goalFreezeConstant&&c.leadYawTraceExact&&c.directChestYawTraceExact&&(c.attack!=='tap'||(c.tapAccepted&&c.tapNativeNoopExact)));
}catch(e){error={name:e.name,message:e.message,stack:e.stack};process.exitCode=1;}
finally {
 Math.random=random;const sourceAfter=manifest(),sourceStable=JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter),headStable=sourceCommit===git('rev-parse','HEAD');pass&&=sourceStable&&headStable;
 const report={schemaVersion:2,probe:'swordsmanship_attack_gate',pass,executionValid:pass,pairedModes:modes.length===2,effectAccepted:false,error,sourceCommit,dirtyBefore,sourceBefore,sourceAfter,sourceStable,headStable,command:process.argv,startedUTC,completedUTC:new Date().toISOString(),wallSeconds:(performance.now()-started)/1000,dt:DT,
   protocol:{weapons,attacks,modes,qinggangSetup,seed:7,gapM:14,walls:false,prefixS:1.5,attackS:.25,tailS,input:'Absolute identical pad tape; held throughout, no generated return or joystick. Original reactive opponent remains active.',wrapper:'Only prepareSwordsmanship: set moving=false during diagnostic attack call, call original once, restore moving finally. Native bodies/time/forces/gains are never overridden by the diagnostic. Old live combat/power estimates are not reused as matched-state evidence.'},
   definitions:{kinetic:'Actual sword rigid-body translational plus rotational energy from native COM velocity and rotated principal inertia. Independently checked through local angular velocity. This is not impact energy, target energy transfer or damage.',
     work:'Sum of explicit sword addTorque dot at-call omega times DT, left-endpoint approximation. Excludes native motor, constraints, collision, linear forces and gravity work. This is not total actuator work.',
     cap:'debug.wristTorque/cap are requested explicit wrist torque and its runtime cap. Near-cap time does not reveal native elbow or whole-body force saturation.',
     pass:'Execution validity and, only when both modes run, matched-pair contracts. A current-only valid run has no comparative effect acceptance. The first run had renderer UUID contamination through AI.me; its raw pass=false is preserved separately.',
     prefixes:'Native world snapshot trace and selected player/enemy/controller/AI serialized trace must match before attack. Attack tapes and applied absolute pads are hashed equally; later state divergence is expected.',
     freeze:'Research ablation of additional hand/aim/posture guidance during attack, not a proposed runtime mode. Raw hand mapping and B lead are still evaluated; trace equality is measured. A favorable freeze metric alone is not a final gameplay or all-weapon acceptance.',
     truncation:'Peak within the last 50ms or final metric >=95% of peak marks possible truncation. It requests targeted longer observation before using that peak comparison; it does not automatically rerun.'},rows,comparisons};
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report)+'\n',{flag:'wx'});
 const bytes=fs.readFileSync(out);fs.writeFileSync(out+'.receipt.json',JSON.stringify({rawPath:out,rawBytes:bytes.length,rawSHA256:sha(bytes),sourceCommit,sourceStable,headStable,pass,executionCount:rows.length,command:process.argv},null,2)+'\n',{flag:'wx'});
 if(!pass)process.exitCode=1;
}
