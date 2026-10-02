/** Actual runtime acceptance/ablation: player correction chosen before the first physical step. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {newRound,THREE,CONFIG,DT,handPos} from '../harness_m.mjs';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const rawPath=process.argv[2]??'/workspace/halfsword-hybrid-evidence/skill-from-start-round3.json';
if(fs.existsSync(rawPath))throw Error('Preserve evidence; choose a fresh output path');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const V=x=>new THREE.Vector3(x.x,x.y,x.z),Q=x=>new THREE.Quaternion(x.x,x.y,x.z,x.w);
const angle=(a,b)=>Math.acos(Math.max(-1,Math.min(1,a.dot(b))));
const modes={weak:{level:.4,autoGuard:true},off:{level:0,autoGuard:false}};
const motions={down:[[.02,.52],[.02,-.45]],up:[[.02,-.45],[.02,.52]],cross:[[-.42,.03],[.42,.03]]};
const original={grip:CONFIG.GRIP.reactionModel,random:Math.random};
function head(){const s=fs.readFileSync(root+'.git/HEAD','utf8').trim();if(!s.startsWith('ref: '))return s;const ref=s.slice(5),p=root+'.git/'+ref,v=fs.existsSync(p)?fs.readFileSync(p,'utf8').trim():fs.readFileSync(root+'.git/packed-refs','utf8').split('\n').find(x=>x.endsWith(' '+ref))?.split(' ')[0];if(!/^[a-f0-9]{40}$/.test(v??''))throw Error('Cannot read HEAD');return v;}
function scan(d){return fs.readdirSync(root+d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(d+'/'+e.name):e.name.endsWith('.js')?[d+'/'+e.name]:[]);}
const files=[...scan('src'),'tools/sim/harness_m.mjs','tools/sim/experiments/skill_from_start_probe.mjs','package-lock.json','node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'];
const manifest=()=>Object.fromEntries(files.sort().map(p=>[p,sha(fs.readFileSync(root+p))]));
const sourceBefore=manifest(),sourceCommit=head(),begin=performance.now();
function ownState(object){const omitted=new Set(['f','fighter','me','foe','world','scene','R','rb','body','parent','child','joint','rawSet','raw','__wbg_ptr','info','mesh','group','sword','grip','colliderSet']);const seen=new WeakSet();
  const encode=(x,depth=0)=>{if(x===null||typeof x==='string'||typeof x==='boolean')return x;if(typeof x==='number')return Number.isFinite(x)?x:{$number:String(x)};if(typeof x==='function'||depth>8||typeof x!=='object'||x.isObject3D||typeof x.isValid==='function')return undefined;
    if(x.isVector2||x.isVector3||x.isQuaternion||x.isEuler)return x.toArray();if(seen.has(x))return {$shared:true};seen.add(x);if(Array.isArray(x))return x.map(y=>encode(y,depth+1));if(x instanceof Set)return [...x].map(y=>encode(y,depth+1));if(x instanceof Map)return [...x].map(([k,v])=>[encode(k,depth+1),encode(v,depth+1)]);const o={};for(const [k,v]of Object.entries(x))if(!omitted.has(k)){const y=encode(v,depth+1);if(y!==undefined)o[k]=y;}return o;};return encode(object);}
function control(G){return {player:ownState(G.player),enemy:ownState(G.enemy),ai:ownState(G.ai),combat:{step:G.combat.stepNo,cuts:ownState(G.combat.cutting),touching:ownState(G.combat.touching),cutReactionModel:G.combat.cutReactionModel}};}
function nativeBodies(G){return G.world.bodies.getAll().map(b=>({handle:b.handle,p:b.translation(),q:b.rotation(),v:b.linvel(),w:b.angvel()}));}
function point(body,local){return V(local).applyQuaternion(Q(body.rotation())).add(V(body.translation()));}
function gaps(f){const result=f.joints.map(j=>({name:j.name,m:point(j.parent,j.joint.anchor1()).distanceTo(point(j.child,j.joint.anchor2()))}));if(f.gripJoint?.isValid()){const j=f.gripJoint;result.push({name:'grip',m:point(j.body1(),j.anchor1()).distanceTo(point(j.body2(),j.anchor2()))});}return result;}
function kinetic(body){const w=V(body.angvel()).applyQuaternion(Q(body.rotation()).multiply(Q(body.principalInertiaLocalFrame())).invert()),I=body.principalInertia();return .5*body.mass()*V(body.linvel()).lengthSq()+.5*(I.x*w.x*w.x+I.y*w.y*w.y+I.z*w.z*w.z);}
// Explicit reference is the existing raw guardDir formula, evaluated at the external request.
function rawDirection(x,y){const el=y<=.1?Math.max(-.6,(y-.1)*1.1):Math.min(1.75,((y-.1)/.5)*1.65),az=THREE.MathUtils.clamp((x-.05)*1.7,-1.1,1.3),c=Math.cos(el);return new THREE.Vector3(c*Math.cos(az),Math.sin(el),c*Math.sin(az));}
const interpolate=(a,b,u)=>[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u];
function request(t,from,to,ending){
  if(t<.55)return {offset:interpolate(from,to,Math.min(1,(t+DT)/.55)),write:true,held:true,active:true,phase:'stroke'};
  if(ending==='reinput'){
    if(t<.95)return {offset:[...to],write:false,held:true,active:false,phase:'pause'};
    if(t<1.30)return {offset:interpolate(to,from,Math.min(1,(t+.0+DT-.95)/.35)),write:true,held:true,active:true,phase:'reinput'};
    return {offset:[...from],write:false,held:true,active:false,phase:'after'};
  }
  return {offset:[...to],write:false,held:ending==='hold',active:false,phase:'after'};
}
function run(weapon,motion,ending,mode,observed){
  let G;const frames=[],baselineFrames=[],trace=crypto.createHash('sha256'),nativeTrace=crypto.createHash('sha256'),inputTrace=crypto.createHash('sha256'),prepareTrace=crypto.createHash('sha256');
  const summary={finite:true,maxCutContacts:0,maxJointGapM:0,maxShoulderGapM:0,maxElbowGapM:0,maxGripGapM:0,maxSwordOmegaRadps:0,maxSwordOmegaPhase:null,maxSwordOmegaTimeS:null,
    peakSwordKJ:0,peakBodyAndSwordKJ:0,afterAxisTravelRad:0,afterOwnGoalTravelRad:0,afterOriginalRawAimIntegralRads:0,afterOwnAimIntegralRads:0,afterDurationS:0,recoveringSteps:0,falls:0,reinputStarts:0};
  let previousAxis=null,previousGoal=null,previousState=null,yawAtStart=null;
  const sample=(timeS,phase,external)=>{const f=G.player,actual=new THREE.Vector3(0,1,0).applyQuaternion(Q(f.sword.rotation())),goal=f.debug.aim.clone().normalize(),rawLocal=rawDirection(...external),raw=rawLocal.clone().applyQuaternion(f.yaw),fixed=rawLocal.clone().applyQuaternion(yawAtStart??f.yaw);
    const omega=V(f.sword.angvel()),twist=Math.abs(omega.dot(actual)),swing=omega.clone().addScaledVector(actual,-omega.dot(actual)).length(),gap=gaps(f),swordK=kinetic(f.sword),totalK=swordK+Object.values(f.bodies).reduce((a,b)=>a+kinetic(b),0),hand=handPos(f);
    const finalGap=Object.fromEntries(gap.map(x=>[x.name,x.m])),ownError=angle(actual,goal),rawError=angle(actual,raw);
    const row={timeS,phase,requestedHandOffsetM:external,actualHandOffsetM:f.handOffset.toArray(),handHeld:f.handHeld,inputActive:f.inputActive,level:f.skill.level,autoGuard:f.skill.autoGuard,guardWeight:f.guardWeight(),followM:f.skill.follow.toArray(),recovering:f.skill.recovering,
      filteredAimM:f.skill.aim.toArray(),rawAimM:f.skill.aimRaw.toArray(),actualAxis:actual.toArray(),ownGoalAxis:goal.toArray(),originalRawAxis:raw.toArray(),fixedWorldOriginalRawAxis:fixed.toArray(),ownAimErrorRad:ownError,originalRawAimErrorRad:rawError,fixedWorldOriginalRawAimErrorRad:angle(actual,fixed),
      actualHandWorldM:hand.toArray(),handGoalWorldM:f.handTarget.toArray(),handGoalErrorM:hand.distanceTo(f.handTarget),bodyPose:{...f.bodyPose},swordOmegaRadps:omega.length(),swordTwistRadps:twist,swordSwingRadps:swing,swordKJ:swordK,bodyAndSwordKJ:totalK,nativeGapM:finalGap,state:f.state,cutContacts:G.combat.cutting.size};
    summary.maxJointGapM=Math.max(summary.maxJointGapM,...gap.map(x=>x.m));summary.maxShoulderGapM=Math.max(summary.maxShoulderGapM,finalGap.uarmS??0);summary.maxElbowGapM=Math.max(summary.maxElbowGapM,finalGap.farmS??0);summary.maxGripGapM=Math.max(summary.maxGripGapM,finalGap.grip??0);
    if(row.swordOmegaRadps>summary.maxSwordOmegaRadps){summary.maxSwordOmegaRadps=row.swordOmegaRadps;summary.maxSwordOmegaPhase=phase;summary.maxSwordOmegaTimeS=timeS;}
    summary.peakSwordKJ=Math.max(summary.peakSwordKJ,swordK);summary.peakBodyAndSwordKJ=Math.max(summary.peakBodyAndSwordKJ,totalK);summary.maxCutContacts=Math.max(summary.maxCutContacts,row.cutContacts);
    if(f.skill.recovering)summary.recoveringSteps++;
    if(previousState&&f.state==='down'&&previousState!=='down')summary.falls++;previousState=f.state;
    if(phase==='after'){summary.afterDurationS+=DT;summary.afterAxisTravelRad+=previousAxis?angle(previousAxis,actual):0;summary.afterOwnGoalTravelRad+=previousGoal?angle(previousGoal,goal):0;summary.afterOriginalRawAimIntegralRads+=rawError*DT;summary.afterOwnAimIntegralRads+=ownError*DT;}
    previousAxis=actual;previousGoal=goal;return row;};
  try{
    CONFIG.GRIP.reactionModel='paired';G=newRound({seed:7,walls:false,weapon,weapon2:'longsword',skill:modes[mode].level});G.park();const f=G.player,[from,to]=motions[motion];
    f.skill.autoGuard=modes[mode].autoGuard;f.armTorqueModel='sharedCap';G.combat.cutReactionModel='budgeted';
    f.handOffset.set(...from);for(const key of ['prev','aim','aimRaw','anchor'])f.skill[key].set(...from);f.skill.aimVel.set(0,0);f.skill.vel.set(0,0);f.skill.follow.set(0,0);f.handHeld=true;f.inputActive=false;
    const firstStepContract={level:f.skill.level,autoGuard:f.skill.autoGuard,arm:f.armTorqueModel,grip:CONFIG.GRIP.reactionModel,cut:G.combat.cutReactionModel,nativeBeforeFirstStep:sha(G.world.takeSnapshot())};
    for(let i=0;i<Math.round(3/DT);i++){G.step();const native=sha(G.world.takeSnapshot()),ctrl=control(G);prepareTrace.update(JSON.stringify({native,ctrl}));if(observed)sample(-(3-(i+1)*DT),'prepare',from);}
    yawAtStart=f.yaw.clone();const prepared={native:sha(G.world.takeSnapshot()),controller:sha(JSON.stringify(control(G))),trace:prepareTrace.digest('hex')};
    const initial=observed?sample(0,'start',from):null;previousAxis=null;previousGoal=null;summary.afterAxisTravelRad=0;summary.afterOwnGoalTravelRad=0;
    const steps=Math.ceil((ending==='reinput'?2.05:2.05)/DT);
    for(let i=0;i<steps;i++){
      const r=request(i*DT,from,to,ending);if(r.write)f.handOffset.set(...r.offset);f.handHeld=r.held;f.inputActive=r.active;if(r.phase==='reinput'&&(i===0||request((i-1)*DT,from,to,ending).phase!=='reinput'))summary.reinputStarts++;
      inputTrace.update(JSON.stringify({timeS:i*DT,...r}));G.step();const bodies=nativeBodies(G);for(const b of bodies)for(const key of ['p','q','v','w'])if(!Object.values(b[key]).every(Number.isFinite))throw Error('Nonfinite actual native body');
      const native=sha(G.world.takeSnapshot());nativeTrace.update(native);const ctrl=control(G);trace.update(JSON.stringify({native,ctrl}));
      if(observed)frames.push(sample((i+1)*DT,r.phase,r.offset));
      else baselineFrames.push({timeS:(i+1)*DT,phase:r.phase});
    }
    if(observed){summary.afterOriginalRawAimMeanErrorRad=summary.afterOriginalRawAimIntegralRads/summary.afterDurationS;summary.afterOwnAimMeanErrorRad=summary.afterOwnAimIntegralRads/summary.afterDurationS;summary.finalSwordKJ=frames.at(-1).swordKJ;summary.finalBodyAndSwordKJ=frames.at(-1).bodyAndSwordKJ;summary.finalOriginalRawAimErrorRad=frames.at(-1).originalRawAimErrorRad;summary.finalOwnAimErrorRad=frames.at(-1).ownAimErrorRad;summary.afterOriginalRawAimMaxErrorRad=Math.max(...frames.filter(x=>x.phase==='after').map(x=>x.originalRawAimErrorRad));}
    return {weapon,motion,ending,mode,observed,firstStepContract,prepared,inputSha256:inputTrace.digest('hex'),nativeTraceSha256:nativeTrace.digest('hex'),traceSha256:trace.digest('hex'),initial,summary:observed?summary:null,final:frames.at(-1)??null,frames};
  }finally{G?.eventQueue.free();G?.world.free();CONFIG.GRIP.reactionModel=original.grip;Math.random=original.random;}
}
const rows=[],observerChecks=[];
for(const weapon of ['sabre','zweihander'])for(const motion of ['down','up','cross'])for(const ending of ['hold','release','reinput'])for(const mode of ['weak','off']){
  const baseline=run(weapon,motion,ending,mode,false),observed=run(weapon,motion,ending,mode,true),check={weapon,motion,ending,mode,firstNativeExact:baseline.firstStepContract.nativeBeforeFirstStep===observed.firstStepContract.nativeBeforeFirstStep,preparedNativeExact:baseline.prepared.native===observed.prepared.native,preparedControllerExact:baseline.prepared.controller===observed.prepared.controller,prepareTraceExact:baseline.prepared.trace===observed.prepared.trace,inputExact:baseline.inputSha256===observed.inputSha256,nativeTraceExact:baseline.nativeTraceSha256===observed.nativeTraceSha256,controllerTraceExact:baseline.traceSha256===observed.traceSha256};
  observerChecks.push(check);rows.push(observed);
}
const pairedChecks=rows.filter(r=>r.mode==='weak').map(a=>{const b=rows.find(r=>r.mode==='off'&&r.weapon===a.weapon&&r.motion===a.motion&&r.ending===a.ending);return {weapon:a.weapon,motion:a.motion,ending:a.ending,firstNativeExact:a.firstStepContract.nativeBeforeFirstStep===b.firstStepContract.nativeBeforeFirstStep,preparedNativeSame:a.prepared.native===b.prepared.native,preparedControllerSame:a.prepared.controller===b.prepared.controller,inputExact:a.inputSha256===b.inputSha256};});
const sourceAfter=manifest(),sourceCommitAfter=head(),sourceStable=JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter)&&sourceCommit===sourceCommitAfter;
const result={schemaVersion:1,probe:'skill_from_start_probe',sourceCommit,sourceCommitAfter,sourceStable,sourceBefore,sourceAfter,probeSha256:sourceBefore['tools/sim/experiments/skill_from_start_probe.mjs'],createdUTC:new Date().toISOString(),command:process.argv,wallSeconds:(performance.now()-begin)/1000,
  protocol:{weapons:['sabre','zweihander'],motions,modes,seed:7,prepareS:3,dragS:.55,observationS:2.05,arm:'sharedCap',grip:'paired',cut:'budgeted',reinput:'first stroke .55s, held pause .4s, reverse external input .35s then held stop .75s',
    fromStart:'Mode supplied through actual newRound skill option; autoGuard/arm/cut set before any G.step. Configurations intentionally produce different prepared poses, so across-mode prepared equality is recorded but never required.',
    originalInputError:'Existing raw guardDir formula applied to external offset, held at original last endpoint after each drag. Current yaw and fixed initial-world yaw references stored. Explicit raw-mapping benchmark does not prove human intent.',
    limits:'Actual controllers/native solver, no contact/AI-duel/wound/browser/user-scene reproduction. Preparation K/gap peaks included and separately identifiable by phase; native full snapshot/controller trace exact across observer pairs. Axis travel excludes twist; omega includes twist. Global mass changes already present in game remain in K.'},
  globalOptionsRestored:CONFIG.GRIP.reactionModel===original.grip&&Math.random===original.random,observerChecks,pairedChecks,rows};
fs.writeFileSync(rawPath,JSON.stringify(result,null,2)+'\n');
const metrics={...result,raw:{path:rawPath,sha256:sha(fs.readFileSync(rawPath))},rows:rows.map(({frames,...r})=>({...r,frameCount:frames.length}))};
fs.writeFileSync(root+'docs/strike/skill_from_start_round3.json',JSON.stringify(metrics,null,2)+'\n');
console.log(JSON.stringify({rawPath,wallSeconds:result.wallSeconds,sourceStable,rows:rows.length,observerChecksPass:observerChecks.every(r=>Object.values(r).every(x=>x!==false)),pairedInputPass:pairedChecks.every(r=>r.inputExact),globalOptionsRestored:result.globalOptionsRestored,
  summary:rows.map(r=>({weapon:r.weapon,motion:r.motion,ending:r.ending,mode:r.mode,...r.summary}))}));
if(!sourceStable||!result.globalOptionsRestored||observerChecks.some(r=>Object.values(r).some(x=>x===false))||pairedChecks.some(r=>!r.inputExact))process.exitCode=1;
