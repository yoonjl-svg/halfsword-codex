// Research-only actual two-AI combat with the verified restored native engine.
// No game/config changes, native joint replacement, force ledger, or synthetic wound.
import {readFile,writeFile,readdir,mkdir,mkdtemp,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {installNativeElbow} from './native_elbow_candidate.mjs';

const root=new URL('../../../',import.meta.url);
const sha=x=>createHash('sha256').update(x).digest('hex');
const digest=x=>sha(JSON.stringify(x));
const options=Object.fromEntries(process.argv.slice(2).map(s=>{
  const m=/^--(module|calibration|out|source-commit|source-dirty)=(.+)$/.exec(s);if(!m)throw Error('Use named module/calibration/out/source-commit/source-dirty options');return [m[1],m[2]];
}));
const modulePath=resolve(options.module??'/workspace/halfsword-research-import-20261003/engine/rapier.mjs');
const calibrationPath=resolve(options.calibration??'/workspace/halfsword-research-import-20261003/engine/native-motor-api-r1.json');
const output=resolve(options.out??'/workspace/halfsword-handoff/native-elbow-combat-20261004/combat.json');
for(const p of [output,output+'.summary.json']){
  try{await access(p);throw Error('Refusing to overwrite evidence: '+p);}catch(e){if(e.code!=='ENOENT')throw e;}
}
const moduleBytes=await readFile(modulePath),moduleHash=sha(moduleBytes);
const calibrationBytes=await readFile(calibrationPath),calibration=JSON.parse(calibrationBytes);
const calibrationSource=sha(await readFile(new URL('tools/sim/experiments/native_motor_api_probe.mjs',root)));
// Same exact source/module calibration guard as the established followthrough probe.
if(moduleHash!=='a3be9d8361b386b0b664ee7ba771f14ae60e93eda9a4ab825f1de1260dbb5623' ||
   sha(calibrationBytes)!=='90a7ef5a2e34c18ea601d61a04fff36e4b6a766e8a360a10a85196d5fa8a4089' ||
   !calibration.pass||!calibration.sourceStable||!calibration.moduleSourceStable||
   calibration.moduleSourceBefore!==moduleHash||calibration.moduleSourceAfter!==moduleHash||
   calibration.sourceBefore!==calibrationSource||calibration.sourceAfter!==calibrationSource)
  throw Error('Exact passed native API calibration/module/source guard failed');

async function manifest(){
  async function scan(dir){const paths=[];for(const e of await readdir(new URL(dir,root),{withFileTypes:true})){
    const p=dir+'/'+e.name;if(e.isDirectory())paths.push(...await scan(p));else if(e.name.endsWith('.js'))paths.push(p);
  }return paths;}
  const paths=[...await scan('src'),'package.json','package-lock.json','tools/sim/harness_m.mjs',
    'tools/sim/experiments/native_motor_api_probe.mjs','tools/sim/experiments/native_elbow_candidate.mjs',
    'tools/sim/experiments/elbow_actuator_candidate.mjs','tools/sim/experiments/native_elbow_combat_probe.mjs',
    'node_modules/three/build/three.module.js','node_modules/@dimforge/rapier3d-compat/rapier.mjs'];
  return Object.fromEntries(await Promise.all(paths.sort().map(async p=>[p,sha(await readFile(new URL(p,root)))])));
}
function ownState(object){
  const omitted=new Set(['f','fighter','me','foe','world','scene','R','rb','body','parent','child','joint',
    'rawSet','raw','__wbg_ptr','info','mesh','group','sword','grip','colliderSet']);
  const seen=new WeakSet();
  function copy(v,depth=0){
    if(v===null||typeof v==='string'||typeof v==='boolean')return v;
    if(typeof v==='number')return Number.isFinite(v)?v:{$number:String(v)};
    if(typeof v!=='object'||depth>8||v.isObject3D||typeof v.isValid==='function')return undefined;
    if(v.isVector2||v.isVector3||v.isQuaternion||v.isEuler)return v.toArray();
    if(seen.has(v))return {$shared:true};seen.add(v);
    if(Array.isArray(v))return v.map(x=>copy(x,depth+1));
    if(v instanceof Set)return [...v].map(x=>copy(x,depth+1));
    if(v instanceof Map)return [...v].map(([k,x])=>[copy(k,depth+1),copy(x,depth+1)]);
    return Object.fromEntries(Object.entries(v).filter(([k])=>!omitted.has(k)).map(([k,x])=>[k,copy(x,depth+1)]).filter(([,x])=>x!==undefined));
  }return copy(object);
}
function control(G){return {player:ownState(G.player),enemy:ownState(G.enemy),ai:ownState(G.ai),ai2:ownState(G.ai2),combat:ownState(G.combat)};}
function inputs(G){return [G.player,G.enemy].map(f=>({index:f.index,handOffset:f.handOffset.toArray(),handHeld:f.handHeld,
  inputActive:f.inputActive,move:f.move.toArray(),skill:ownState(f.skill)}));}
function events(G){return {clashes:G.clashes,wounds:G.wounds.map(w=>({timeS:w.t,attacker:w.att.index,victim:w.vic.index,
  zone:w.zone,type:w.type,energyJ:w.energy,severity:w.severity}))};}
function spec(j){const raw=j.joint.rawSet,h=j.joint.handle;return {handle:h,type:j.type,manual:j.manual,k:j.k,d:j.d,max:j.max,
  anchor1:{...j.joint.anchor1()},anchor2:{...j.joint.anchor2()},frame1:{...j.joint.frameX1()},frame2:{...j.joint.frameX2()},
  contacts:j.joint.contactsEnabled(),limits:{enabled:raw.jointLimitsEnabled(h,3),min:raw.jointLimitsMin(h,3),max:raw.jointLimitsMax(h,3)}};}
const before=await manifest(),start=performance.now(),startedUTC=new Date().toISOString();await mkdir(dirname(output),{recursive:true});
const directory=await mkdtemp(join(dirname(output),'absolute-harness-'));
const harnessURL=new URL('tools/sim/harness_m.mjs',root),source=await readFile(harnessURL,'utf8');
const marker='../../node_modules/@dimforge/rapier3d-compat/rapier.mjs';
if(source.split(marker).length!==2)throw Error('Expected exactly one actual harness engine import');
const rewritten=source.replace(/from (['"])([^'"]+)\1/g,(_,q,p)=>'from '+JSON.stringify(
  p===marker?pathToFileURL(modulePath).href:p.startsWith('.')?new URL(p,harnessURL).href:import.meta.resolve(p)));
const harnessPath=join(directory,'harness.mjs');await writeFile(harnessPath,rewritten,{flag:'wx'});
const {newRound,AI,CONFIG,DT,THREE,handPos}=await import(pathToFileURL(harnessPath).href);
const V=v=>new THREE.Vector3(v.x,v.y,v.z),Q=q=>new THREE.Quaternion(q.x,q.y,q.z,q.w);
function pose(G){const bodies=[];G.world.bodies.forEach(b=>bodies.push({handle:b.handle,p:{...b.translation()},q:{...b.rotation()},v:{...b.linvel()},w:{...b.angvel()}}));
  bodies.sort((a,b)=>a.handle-b.handle);return bodies;}
function allContacts(G){const rows=[],seen=new Set();G.world.colliders.forEach(c=>G.world.contactPairsWith(c,other=>{
  const lo=Math.min(c.handle,other.handle),hi=Math.max(c.handle,other.handle),key=lo+':'+hi;if(seen.has(key))return;seen.add(key);
  const a=G.world.getCollider(lo),b=G.world.getCollider(hi);
  G.world.contactPair(a,b,(m,flipped)=>{const contacts=[],points=[];
    for(let i=0;i<m.numContacts();i++)contacts.push({impulse:m.contactImpulse(i),distance:m.contactDist(i)});
    for(let i=0;i<m.numSolverContacts();i++)points.push({point:{...m.solverContactPoint(i)},distance:m.solverContactDist(i)});
    rows.push({a:lo,b:hi,flipped,normal:{...m.normal()},contacts,points});
  });
}));rows.sort((a,b)=>a.a-b.a||a.b-b.b);return rows;}
function metrics(f){
  let gap=0;const missing=[];
  for(const j of f.joints){if(!j.joint?.isValid()){missing.push(j.name);continue;}
    const a=V(j.joint.anchor1()).applyQuaternion(Q(j.parent.rotation())).add(V(j.parent.translation()));
    const b=V(j.joint.anchor2()).applyQuaternion(Q(j.child.rotation())).add(V(j.child.translation()));gap=Math.max(gap,a.distanceTo(b));}
  const axis=new THREE.Vector3(0,1,0).applyQuaternion(Q(f.sword.rotation())).normalize(),aim=f.debug.aim.clone().normalize();
  const tip=f.bladePoint(1,new THREE.Vector3());
  return {state:f.state,alive:f.alive,armed:f.armed,armS:f.limbs.armS,muscle:f.muscle,pain:f.pain,blood:f.blood,woundCount:f.wounds.length,
    handErrorM:handPos(f).distanceTo(f.handTarget),aimErrorRad:Math.acos(THREE.MathUtils.clamp(axis.dot(aim),-1,1)),
    maxJointAnchorGapM:gap,missingJoints:missing,tipSpeedMps:V(f.sword.velocityAtPoint(tip)).length(),pelvisHeightM:f.bodies.pelvis.translation().y};
}
function finite(value){if(typeof value==='number')return Number.isFinite(value);if(value&&typeof value==='object')return Object.values(value).every(finite);return true;}
function choices(f){return Object.fromEntries(['armTorqueModel','armRecoveryModel','onehandArmModel','gripPointModel','edgeIntentModel',
  'edgeTorqueModel','wristBrakingModel'].map(k=>[k,f[k]??null]));}
// Minimal observed-method adapter for the candidate's dispatch contract. It creates
// no body/force observers and calls the original receiver exactly once in observe.
function adapter(){return {replaceObservedMethod(f,name,replacement){
  const own=Object.hasOwn(f,name),previous=f[name];f[name]=replacement;
  return ()=>{if(f[name]!==replacement)throw Error('Observed dispatch restore ownership lost');if(own)f[name]=previous;else delete f[name];};
}};}
function run(weapon,mode){const row={weapon,opponent:'longsword',mode,frames:[],errors:[],counts:{driveJoints:0,driveSword:0,externalFFCalls:0},
  installNativeUnchanged:true,jointPreserved:true,finite:true,maxHandErrorM:0,maxAimErrorRad:0,maxJointAnchorGapM:0,peakTipSpeedMps:0};
  let G,native,prefixNativeSummary;const random=Math.random,undo=[];
  try{
    G=newRound({seed:7,weapon,weapon2:'longsword',AIClass:AI,AI2Class:AI,difficulty:'normal',difficulty2:'normal',skill:.7});
    row.bothActualAI=G.ai instanceof AI&&G.ai2 instanceof AI;row.skill=[G.player.skill.level,G.enemy.skill.level];
    row.choices=[choices(G.player),choices(G.enemy)];row.defaultConfig={grip:CONFIG.GRIP.reactionModel,body:ownState(CONFIG.BODY),gait:ownState(CONFIG.GAIT)};
    if(!row.bothActualAI||row.skill.some(x=>x!==.7)||CONFIG.GRIP.reactionModel!=='paired')throw Error('Actual two normal AI/default paired skill .7 prerequisite failed');
    const f=G.player,j=f.jointByName.farmS,initialSpec=JSON.stringify(spec(j)),dispatch=adapter();
    row.initialNativeSHA=sha(G.world.takeSnapshot());row.initialControlSHA=digest(control(G));
    for(const name of ['driveJoints','driveSword','elbowGravity']){const original=f[name];undo.push(dispatch.replaceObservedMethod(f,name,function(...args){
      row.counts[name==='elbowGravity'?'externalFFCalls':name]++;return original.apply(this,args);
    }));}
    if(mode!=='baseline')native=installNativeElbow({f,ledger:dispatch,mode:'observe',maxRecords:0});
    row.installNativeUnchanged&&=row.initialNativeSHA===sha(G.world.takeSnapshot());
    G.before=()=>{row.inputBeforeStep=inputs(G);};
    const checkpointTick=Math.round(3/DT),ticks=Math.round(10/DT);
    for(let tick=0;tick<ticks;tick++){
      if(tick===checkpointTick){row.checkpoint={timeS:G.t,nativeSHA:sha(G.world.takeSnapshot()),controlSHA:digest(control(G)),joint:spec(j)};
        if(mode==='nativeCap'){prefixNativeSummary={...native.summary};native.restore();const snapshot=sha(G.world.takeSnapshot());
          native=installNativeElbow({f,ledger:dispatch,mode:'capped',maxRecords:0});row.installNativeUnchanged&&=snapshot===sha(G.world.takeSnapshot());}
      }
      const preStates=[G.player.state,G.enemy.state];G.step();const motor=native?.afterStep()??null;
      row.jointPreserved&&=j.joint.isValid()&&JSON.stringify(spec(j))===initialSpec;
      const actualPose=pose(G),actorMetrics=[metrics(G.player),metrics(G.enemy)],contactRows=allContacts(G),ev=events(G);
      row.finite&&=finite(actualPose)&&finite(actorMetrics)&&finite(motor)&&finite(contactRows);
      for(const m of actorMetrics){row.maxJointAnchorGapM=Math.max(row.maxJointAnchorGapM,m.maxJointAnchorGapM);}
      row.maxHandErrorM=Math.max(row.maxHandErrorM,actorMetrics[0].handErrorM);row.maxAimErrorRad=Math.max(row.maxAimErrorRad,actorMetrics[0].aimErrorRad);
      row.peakTipSpeedMps=Math.max(row.peakTipSpeedMps,actorMetrics[0].tipSpeedMps);
      row.frames.push({tick,timeS:G.t,inputSHA:digest(row.inputBeforeStep),nativeSHA:sha(G.world.takeSnapshot()),poseSHA:digest(actualPose),
        controlSHA:digest(control(G)),eventsSHA:digest(ev),contactsSHA:digest(contactRows),statesBefore:preStates,actors:actorMetrics,motor,
        nativeReadback:{maxForce:j.joint.rawSet.jointMotorMaxForce(j.joint.handle,3),enabled:j.joint.rawSet.jointMotorEnabled(j.joint.handle,3),
          lastSubstepImpulseNms:j.joint.rawSet.jointMotorImpulse(j.joint.handle,3)},contactManifolds:contactRows.length,
        actualCombat:ev});
    }
    row.nativeSummary=native?{...native.summary}:null;row.prefixNativeSummary=prefixNativeSummary??null;
    row.events=events(G);row.final=[metrics(G.player),metrics(G.enemy)];
    row.executionPass=row.finite&&row.jointPreserved&&row.installNativeUnchanged&&row.frames.length===Math.round(10/DT)
      &&row.counts.driveJoints===Math.round(10/DT)&&row.counts.driveSword===Math.round(10/DT)
      &&(!row.nativeSummary||row.nativeSummary.measurements===row.nativeSummary.nativeCalls&&row.nativeSummary.nativeCalls>0)
      &&(mode!=='nativeCap'||row.nativeSummary.explicitGravityCalls===row.nativeSummary.nativeCalls&&row.nativeSummary.maxLastSubstepCapRatio<=1.0001);
  }catch(e){row.errors.push(e.stack??String(e));row.executionPass=false;row.nativeSummary=native?{...native.summary}:null;}
  finally{try{native?.restore();for(const restore of undo.reverse())restore();}catch(e){row.errors.push(String(e));row.executionPass=false;}
    G?.eventQueue.free();G?.world.free();Math.random=random;delete row.inputBeforeStep;}
  return row;
}
const rows=[],comparisons=[];
for(const weapon of ['sabre','zweihander']){
  const group=[];for(const mode of ['baseline','observe','nativeCap']){const row=run(weapon,mode);rows.push(row);group.push(row);
    console.log(JSON.stringify({weapon,mode,executionPass:row.executionPass,frames:row.frames.length,errors:row.errors,
      wounds:row.events?.wounds.length,clashes:row.events?.clashes,maxHandErrorM:row.maxHandErrorM,maxAimErrorRad:row.maxAimErrorRad,
      maxJointAnchorGapM:row.maxJointAnchorGapM,native:row.nativeSummary}));}
  const [base,observer,candidate]=group;
  const fields=['inputSHA','nativeSHA','poseSHA','controlSHA','eventsSHA','contactsSHA'];
  const same=(a,b,i)=>fields.every(k=>a.frames[i]?.[k]===b.frames[i]?.[k]);
  const first=(a,b,k)=>{const i=a.frames.findIndex((f,i)=>f[k]!==b.frames[i]?.[k]);return i<0?null:{tick:i,timeS:a.frames[i].timeS};};
  comparisons.push({weapon,baselineObserverFullTraceExact:base.frames.length===observer.frames.length&&base.frames.every((_,i)=>same(base,observer,i)),
    baselineObserverInitialNativeExact:base.initialNativeSHA===observer.initialNativeSHA,
    candidateThreeSecondPrefixExact:base.frames.slice(0,Math.round(3/DT)).every((_,i)=>same(base,candidate,i)),
    checkpointNativeExact:base.checkpoint?.nativeSHA===candidate.checkpoint?.nativeSHA,
    checkpointControlExact:base.checkpoint?.controlSHA===candidate.checkpoint?.controlSHA,
    sameDefaultChoices:group.every(r=>JSON.stringify(r.choices)===JSON.stringify(base.choices)&&JSON.stringify(r.defaultConfig)===JSON.stringify(base.defaultConfig)),
    firstDivergence:Object.fromEntries(fields.map(k=>[k,first(base,candidate,k)])),
    interpretation:'Actual AI feedback, contacts and wounds can diverge after intervention. Differing wounds/clashes are not matched efficacy comparisons.'});
}
const after=await manifest(),moduleAfter=sha(await readFile(modulePath));
const sourceStable=JSON.stringify(before)===JSON.stringify(after)&&moduleHash===moduleAfter;
const report={schemaVersion:1,startedUTC,endedUTC:new Date().toISOString(),createdUTC:new Date().toISOString(),command:`node tools/sim/experiments/native_elbow_combat_probe.mjs --module=${modulePath} --calibration=${calibrationPath} --out=${output}`,
  sourceCommit:options['source-commit']??null,sourceDirty:options['source-dirty']??null,
  sourceMetadataProvenance:'Optional caller-supplied commit/dirty metadata. Probe does not invoke Git or access .git; actual executed source bytes are covered by before/after SHA manifests.',
  sourceBefore:before,sourceAfter:after,sourceStable,engine:{modulePath,sha256:moduleHash,sha256After:moduleAfter,calibrationPath,calibrationSHA256:sha(calibrationBytes),calibrationSourceSHA256:calibrationSource},
  transformed:{harnessPath,harnessSHA256:sha(rewritten),toolSHA256:before['tools/sim/experiments/native_elbow_combat_probe.mjs']},
  wallSeconds:(performance.now()-start)/1000,protocol:{seed:7,seconds:10,prefixSeconds:3,timestepS:DT,AI:'Both original actual normal AI, skill .7',
    intervention:'Player only, original farmS hinge retained; existing gravity FF moved inside ForceBased native motor target bias. All other choice flags and paired grip remain defaults.',
    observation:'Baseline has counting wrappers and raw native getter reads but no installNativeElbow. Observe installs the actual native observer from tick0. NativeCap has the observer for the 3s prefix, then capped actual dispatch. Full baseline/observe parity tests noninterference of the native configure observer.',
    wounds:'Only real Combat.afterStep collision wounds; no synthetic injury or limb injection.',
    readout:'The impulse getter is the LAST solver substep only. Cap uses outer dt / calibrated numSolverIterations. No fullstep impulse, native work or physiological budget inferred.',
    contacts:'Actual full-world native contact manifolds hashed every tick; raw impulses and solver points not paired or weighted.',
    controller:'Plain own-state serialization excludes functions/native engine and render ownership and bounds nested depth at8; native snapshots cover the full native world.',
    acceptance:'Finite/joint/parity/cap gates establish measurement validity, not physical gameplay acceptance or human naturalness.'},rows,comparisons};
report.executionPass=sourceStable&&rows.length===6&&rows.every(r=>r.executionPass)&&comparisons.every(c=>
  c.baselineObserverFullTraceExact&&c.baselineObserverInitialNativeExact&&c.candidateThreeSecondPrefixExact&&c.checkpointNativeExact&&c.checkpointControlExact&&c.sameDefaultChoices);
await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const summary={...report,rows:rows.map(({frames,...r})=>({...r,frameCount:frames.length}))};
await writeFile(output+'.summary.json',JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,rawSHA256:sha(await readFile(output)),executionPass:report.executionPass,sourceStable,wallSeconds:report.wallSeconds,comparisons}));
if(!report.executionPass)process.exitCode=1;
