/** Q05: actual game runtime 2x2, with read-only contact/impulse observers.
 * No fixtures, imposed glances, wound injection, source transforms or engine edits.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {newRound,AI,DT,THREE,CONFIG} from '../harness_m.mjs';
import {installForceLedger,snapshotWorld} from '../force_ledger.mjs';
import {Combat} from '../../../src/combat.js';
import {getLook} from '../../../src/looks.js';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const opts=Object.fromEntries(process.argv.slice(2).map(a=>{const m=/^--(seconds|prepare|seeds|scenes|out)=(.+)$/.exec(a);if(!m)throw Error('Use --seconds/prepare/seeds/scenes/out=value');return [m[1],m[2]];}));
const seconds=Number(opts.seconds??30),prepare=Number(opts.prepare??1),seeds=(opts.seeds??'7').split(',').map(Number);
const scenes=(opts.scenes??'cloth,plate').split(',');
const out=opts.out??'/workspace/halfsword-hybrid-evidence/q05-arm-cut-round1.json';
if([out,out+'.runs.jsonl',out+'.start.json'].some(p=>fs.existsSync(p)))throw Error('Preserve prior evidence: choose a new --out');
if(!(seconds>0)||!(prepare>=0)||seeds.some(s=>!Number.isInteger(s))||scenes.some(s=>!['cloth','plate'].includes(s)))throw Error('Invalid options');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const vec=v=>({x:v.x,y:v.y,z:v.z}),V=v=>new THREE.Vector3(v.x,v.y,v.z),norm=v=>Math.hypot(v.x,v.y,v.z);
const add=(a,b)=>vec(V(a).add(V(b))),sub=(a,b)=>vec(V(a).sub(V(b)));
const near=(e,s,t)=>Math.abs(e)<=t*(1+s);
const tolerance={momentum:8e-5,angular:3e-4,energy:2e-4,speed:2e-4,torque:1e-8};
const modes=['unobserved','baseline','cut','arm','combined'];
const sourceFiles=(()=>{function scan(d){return fs.readdirSync(root+d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(d+'/'+e.name):e.name.endsWith('.js')?[d+'/'+e.name]:[]);}return [...scan('src'),'tools/sim/harness_m.mjs','tools/sim/force_ledger.mjs','package-lock.json','node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'].sort();})();
const manifest=()=>Object.fromEntries(sourceFiles.map(p=>[p,sha(fs.readFileSync(root+p))]));
const sourceBefore=manifest(),originalRandom=Math.random;
const gitHead=fs.readFileSync(root+'.git/HEAD','utf8').trim();
const baselineCommit=gitHead.startsWith('ref: ')?(()=>{const ref=gitHead.slice(5),path=root+'.git/'+ref;if(fs.existsSync(path))return fs.readFileSync(path,'utf8').trim();return fs.readFileSync(root+'.git/packed-refs','utf8').split('\n').find(l=>l.endsWith(' '+ref))?.split(' ')[0]??null;})():gitHead;
if(!/^[a-f0-9]{40}$/.test(baselineCommit??''))throw Error('Unable to read actual repository HEAD');
fs.writeFileSync(out+'.start.json',JSON.stringify({sourceBefore,baselineCommit,command:process.argv,createdUTC:new Date().toISOString(),probeSHA256:sha(fs.readFileSync(fileURLToPath(import.meta.url)))}));
function ownState(object){
  const omit=new Set(['f','fighter','me','foe','world','scene','R','rb','body','parent','child','joint','rawSet','raw','__wbg_ptr','info','mesh','group','sword','grip','colliderSet','armTorqueModel']);
  const seen=new WeakSet();
  function encode(x,depth=0){
    if(x==null||typeof x==='string'||typeof x==='boolean')return x;
    if(typeof x==='number')return Number.isFinite(x)?x:{$number:String(x)};
    if(typeof x==='function'||depth>8||typeof x!=='object'||x.isObject3D||typeof x.isValid==='function')return undefined;
    if(x.isVector2||x.isVector3||x.isQuaternion||x.isEuler)return x.toArray();
    if(seen.has(x))return {$shared:true};seen.add(x);
    if(Array.isArray(x))return x.map(y=>encode(y,depth+1));
    if(x instanceof Set)return [...x].map(y=>encode(y,depth+1));
    if(x instanceof Map)return [...x].map(([k,v])=>[encode(k,depth+1),encode(v,depth+1)]);
    const out={};for(const [k,v]of Object.entries(x))if(!omit.has(k)){const y=encode(v,depth+1);if(y!==undefined)out[k]=y;}return out;
  }
  return encode(object);
}
function control(G){return {fighters:[G.player,G.enemy].map(ownState),AI:[ownState(G.ai),ownState(G.ai2)],combat:{step:G.combat.stepNo,
  cuts:[...G.combat.cutting].map(([key,c])=>({key,seen:c.seen,applied:c.applied,Eleft:c.Eleft,stuck:c.stuck,stuckT:c.stuckT,mFree:c.mFree,done:c.cutBudgetDone})),
  touching:[...G.combat.touching],bladeContact:ownState(G.combat.bladeContact),steelArmed:G.combat.steelArmed},wounds:G.wounds.map(w=>({...w,att:w.att.index,vic:w.vic.index}))};}
function input(G){return [G.player,G.enemy].map(f=>({handOffset:f.handOffset.toArray(),handHeld:f.handHeld,inputActive:f.inputActive,move:f.move.toArray(),tap:ownState(f.skill.tap),thrustPush:f.skill.thrustPush}));}
function bodyTrace(G){return snapshotWorld(G.world).bodies.map(b=>({h:b.handle,m:b.mass,p:b.position,q:b.rotation,com:b.com,v:b.velocity,w:b.omega,I:b.inertia,userForce:b.userForce,userTorque:b.userTorque}));}
function cachedRelative(S,P,p){if(!S||!P)return null;const at=s=>V(s.w).cross(V(p).sub(s.com)).add(s.v);return vec(at(S).sub(at(P)));}
function contactNormal(G,pr,point){
  let best=null;const weaponCollider=G.world.getCollider(pr.wc);G.world.contactPair(weaponCollider,G.world.getCollider(pr.vc),(m,flipped)=>{
    const n=V(m.normal()).multiplyScalar(flipped?-1:1);
    for(let j=0;j<m.numSolverContacts();j++){const p=V(m.solverContactPoint(j)),distance=p.distanceTo(point);if(!best||distance<best.distanceM)best={normal:vec(n),distanceM:distance};}
    for(let j=0;j<m.numContacts();j++){const lp=flipped?m.localContactPoint2(j):m.localContactPoint1(j);if(!lp)continue;const p=V(lp).applyQuaternion(new THREE.Quaternion().copy(weaponCollider.rotation())).add(V(weaponCollider.translation())),distance=p.distanceTo(point);if(!best||distance<best.distanceM)best={normal:vec(n),distanceM:distance,source:'actual manifold contact point'};}
  });return best;
}
function run(mode,scene,seed){
  const begin=performance.now();let G,ledger;const undo=[];
  const observed=mode!=='unobserved',cutMode=['cut','combined'].includes(mode)?'budgeted':'legacy',armMode=['arm','combined'].includes(mode)?'sharedCap':'legacy';
  const events=[],pairs=[],eventFrames=[],frameHashes=[],inputHashes=[];let frame=-1,cutCallbacks=[],pendingEvents=[];
  const stats={finite:true,steps:0,falls:[0,0],wounds:0,appliedWounds:0,plateBlocks:0,glanceCandidates:0,strikes:0,nullStrikes:0,clashes:0,freshClashes:0,
    cutPairs:0,positiveCutCalls:0,cutBudgetDebitJ:0,cutActualDeltaKJ:0,cutEnergyIncreasePairs:0,maxCutDeltaP:0,maxCutDeltaL:0,maxCutPredictionErrorJ:0,maxBudgetErrorJ:0,
    cutClosurePass:true,cutPassivityPass:true,cutBudgetPass:true,maxBodySpeedMps:0,maxBodyAngularRadps:0,maxPelvisHeightM:[0,0],maxJointGapM:[0,0],maxGripGapM:[0,0],
    peakTotalKJ:0,maxWristCapRatio:[0,0],wristCapViolations:[0,0],maxExplicitTorqueClosureNm:0,explicitTorqueClosurePass:true,
    armPositiveInstantPowerDtJ:[0,0],armNegativeInstantPowerDtJ:[0,0],wrappersPreserved:true};
  try{
    G=newRound({seed,walls:false,weapon:scene==='plate'?'zweihander':'longsword',weapon2:scene==='plate'?'longsword':'zweihander',AIClass:AI,AI2Class:AI,
      look2:scene==='plate'?getLook('heinrich'):undefined});
    for(let i=0;i<Math.round(prepare/DT);i++)G.step();
    const checkpoint={timeS:G.t,native:sha(G.world.takeSnapshot()),control:sha(JSON.stringify(control(G))),input:sha(JSON.stringify(input(G)))};
    G.combat.cutReactionModel=cutMode;for(const f of [G.player,G.enemy])f.armTorqueModel=armMode;
    const runtime={cutReactionModel:G.combat.cutReactionModel,armTorqueModels:[G.player.armTorqueModel,G.enemy.armTorqueModel]};
    if(observed){
      ledger=installForceLedger(G,{maxSamples:0});
      const wrappers={afterStep:G.combat.afterStep,strike:G.combat.strike,rebound:G.combat.rebound,bladeClash:G.combat.bladeClash};
      undo.push(ledger.replaceObservedMethod(G.combat,'strike',function(pr,point,passing){
        const relative=cachedRelative(pr.w.fighter.cache?.sword,pr.v.fighter.cache?.parts[pr.v.part],point),liveRelative=sub(pr.w.body.velocityAtPoint(point),pr.v.body.velocityAtPoint(point));
        const contact=contactNormal(G,pr,point),woundCount=G.wounds.length;
        const predicted=Combat.prototype.analyze.call(this,pr,point,pr.w.fighter.cache.sword,pr.v.fighter.cache.parts[pr.v.part],true);
        const cooldown=pr.v.fighter.hitCooldowns.has(`${pr.w.fighter.index}:${pr.v.part}`);
        const r=Combat.prototype.strike.call(this,pr,point,passing);
        const speed=relative?norm(relative):0,normalSpeed=contact&&relative?V(relative).dot(V(contact.normal)):null;
        const tangent=normalSpeed==null?null:Math.sqrt(Math.max(0,speed*speed-normalSpeed*normalSpeed));
        const glance=normalSpeed!=null&&normalSpeed>0&&speed>=.5&&normalSpeed/speed<=.25;
        const plateBlocked=!!r?.plate&&!r.pass&&r.severity===0&&r.thr!=null&&r.eff<=r.thr;
        pendingEvents.push({kind:'strike',frame,timeS:G.t,key:`${pr.wc}:${pr.vc}`,attacker:pr.w.fighter.index,victim:pr.v.fighter.index,part:pr.v.part,
          passing,point:vec(point),relativeCached:relative,relativeLiveBeforeStrike:liveRelative,contactNormal:contact,speedCachedMps:speed,normalClosingMps:normalSpeed,
          tangentMps:tangent,glanceCandidate:glance,plateBlocked,cooldown,woundHookDelta:G.wounds.length-woundCount,
          predicted:predicted?ownState(predicted):null,result:r?ownState(r):null,plateRemaining:{...pr.v.fighter.plate}});
        stats.strikes++;if(!r)stats.nullStrikes++;if(plateBlocked)stats.plateBlocks++;if(glance)stats.glanceCandidates++;
        return r;
      }));
      const originalClash=G.combat.hooks.onClash;
      G.combat.hooks.onClash=(point,speed,info)=>{originalClash?.(point,speed,info);stats.clashes++;if(info.fresh)stats.freshClashes++;
        pendingEvents.push({kind:'clash',frame,timeS:G.t,point:vec(point),speedLiveAfterMps:speed,info:ownState(info),relativeCached:cachedRelative(G.player.cache.sword,G.enemy.cache.sword,point),
          relativeLive:sub(G.player.sword.velocityAtPoint(point),G.enemy.sword.velocityAtPoint(point))});};
      const originalWound=G.onWound;G.onWound=(a,v,r)=>{originalWound?.(a,v,r);pendingEvents.push({kind:'wound',frame,timeS:G.t,attacker:a.index,victim:v.index,result:ownState(r),state:v.state,limbs:{...v.limbs},blood:v.blood,consciousness:v.consciousness});};
      G.combat.onCutReaction=d=>cutCallbacks.push(d);
      stats.wrappersPreserved=Object.entries(wrappers).every(([n,w])=>G.combat[n]===w);
    }
    let states=[G.player.state,G.enemy.state];
    for(frame=0;frame<Math.round(seconds/DT);frame++){
      cutCallbacks=[];pendingEvents=[];G.step();stats.steps++;
      const nativeBodies=bodyTrace(G),ctrl=control(G);frameHashes.push(sha(JSON.stringify({bodies:nativeBodies,control:ctrl})));inputHashes.push(sha(JSON.stringify(input(G))));
      for(const b of nativeBodies){for(const field of ['p','q','v','w'])if(!Object.values(b[field]).every(Number.isFinite))stats.finite=false;stats.maxBodySpeedMps=Math.max(stats.maxBodySpeedMps,norm(b.v));stats.maxBodyAngularRadps=Math.max(stats.maxBodyAngularRadps,norm(b.w));}
      for(const f of [G.player,G.enemy]){
        if(f.state==='down'&&states[f.index]!=='down')stats.falls[f.index]++;states[f.index]=f.state;
        stats.maxPelvisHeightM[f.index]=Math.max(stats.maxPelvisHeightM[f.index],f.bodies.pelvis.translation().y);
        for(const j of [...f.joints.map(j=>j.joint),f.gripJoint])if(j?.isValid()){
          const a=V(j.anchor1()).applyQuaternion(new THREE.Quaternion().copy(j.body1().rotation())).add(V(j.body1().translation()));
          const b=V(j.anchor2()).applyQuaternion(new THREE.Quaternion().copy(j.body2().rotation())).add(V(j.body2().translation()));
          const gap=a.distanceTo(b);stats.maxJointGapM[f.index]=Math.max(stats.maxJointGapM[f.index],gap);if(j===f.gripJoint)stats.maxGripGapM[f.index]=Math.max(stats.maxGripGapM[f.index],gap);
        }
      }
      if(observed){
        const latest=ledger.latest;stats.peakTotalKJ=Math.max(stats.peakTotalKJ,latest.postGame.total.K);
        const ops=latest.operations.filter(e=>e.path==='combat.afterStep'&&e.method==='applyImpulseAtPoint');
        if(ops.length%2)throw Error('Odd cut operation count');
        const positive=cutCallbacks.filter(d=>d.J>0);if(cutMode==='budgeted'&&positive.length*2!==ops.length)throw Error('Runtime cut callback/operation mismatch');
        for(let k=0;k<ops.length;k+=2){
          const a=ops[k],b=ops[k+1],d=positive[k/2]??null,deltaP=add(a.deltaP,b.deltaP),deltaL=add(a.deltaL,b.deltaL),deltaK=a.deltaK+b.deltaK;
          const pScale=norm(a.deltaP)+norm(b.deltaP),lScale=norm(a.deltaL)+norm(b.deltaL),kScale=Math.abs(a.deltaK)+Math.abs(b.deltaK)+Math.abs(d?.deltaKPredicted??0);
          const closure=near(norm(deltaP),pScale,tolerance.momentum)&&near(norm(deltaL),lScale,tolerance.angular),prediction=d?near(deltaK-d.deltaKPredicted,kScale,tolerance.energy):null;
          const passive=d?deltaK<=tolerance.energy*(1+kScale)&&d.sAfterMeasured>=-tolerance.speed*(1+d.s):null;
          const budgetError=d?.regime==='drag'?d.budgetBeforeJ-d.budgetAfterJ+deltaK:null;
          const budget=budgetError==null?null:d.budgetAfterJ>=0&&d.budgetDebitJ<=d.budgetBeforeJ+1e-10&&near(budgetError,kScale,tolerance.energy);
          stats.cutPairs++;stats.cutActualDeltaKJ+=deltaK;stats.maxCutDeltaP=Math.max(stats.maxCutDeltaP,norm(deltaP));stats.maxCutDeltaL=Math.max(stats.maxCutDeltaL,norm(deltaL));
          if(deltaK>tolerance.energy*(1+kScale))stats.cutEnergyIncreasePairs++;
          if(d){stats.positiveCutCalls++;stats.cutBudgetDebitJ+=d.budgetDebitJ;stats.maxCutPredictionErrorJ=Math.max(stats.maxCutPredictionErrorJ,Math.abs(deltaK-d.deltaKPredicted));stats.cutClosurePass&&=closure;stats.cutPassivityPass&&=passive&&prediction;
            if(budget!=null){stats.cutBudgetPass&&=budget;stats.maxBudgetErrorJ=Math.max(stats.maxBudgetErrorJ,Math.abs(budgetError));}}
          pairs.push({frame,timeS:G.t,diagnostic:d,deltaP,deltaL,deltaK,closure,prediction,passive,budget,budgetError,operations:[a,b]});
        }
        for(const f of [G.player,G.enemy])for(const method of ['manualMuscle','driveSword']){
          const torques=latest.operations.filter(e=>e.owner===f.index&&e.method==='addTorque'&&e.path.endsWith('.'+method));
          const closure=torques.reduce((s,e)=>s.add(V(e.input)),new THREE.Vector3()).length();stats.maxExplicitTorqueClosureNm=Math.max(stats.maxExplicitTorqueClosureNm,closure);stats.explicitTorqueClosurePass&&=closure<tolerance.torque;
          const power=torques.reduce((s,e)=>s+e.instantPowerAtCallW,0);stats.armPositiveInstantPowerDtJ[f.index]+=Math.max(0,power)*DT;stats.armNegativeInstantPowerDtJ[f.index]+=Math.min(0,power)*DT;
          if(method==='driveSword'){const op=torques.find(e=>e.label===`${f.index}:sword`);if(op){const cap=f.debug.wristCap,ratio=cap>0?norm(op.input)/cap:0;stats.maxWristCapRatio[f.index]=Math.max(stats.maxWristCapRatio[f.index],ratio);if(norm(op.input)>cap+tolerance.torque*(1+cap))stats.wristCapViolations[f.index]++;}}
        }
        const relevantContacts=latest.physics.flatMap(p=>p.contactsRaw).filter(c=>{
          const A=G.combat.info.get(Number(c.colliderA)),B=G.combat.info.get(Number(c.colliderB));return A&&B&&A.fighter!==B.fighter&&(A.kind==='weapon'||B.kind==='weapon');});
        if(pendingEvents.length||ops.length){
          events.push(...pendingEvents);eventFrames.push({frame,timeS:G.t,events:pendingEvents,contacts:relevantContacts,
            postPhysicsBodies:latest.physics.at(-1).post.bodies.filter(b=>relevantContacts.some(c=>c.bodyA===b.handle||c.bodyB===b.handle)),
            prePhysicsBodies:latest.physics.at(-1).pre.bodies.filter(b=>relevantContacts.some(c=>c.bodyA===b.handle||c.bodyB===b.handle)),
            explicitCombatOperations:latest.operations.filter(e=>e.path.startsWith('combat.')&&e.kind==='explicitImpulse'),
            frameBalance:Object.fromEntries(Object.entries(latest.balance).filter(([k])=>k!=='byPath')),
            nativePhysicsBalance:Object.fromEntries(Object.entries(latest.physics.at(-1).balance).filter(([k])=>k!=='byPath'))});
        }
      }
      if(!stats.finite)break;
    }
    stats.wounds=G.wounds.length;stats.appliedWounds=[G.player,G.enemy].reduce((s,f)=>s+f.wounds.length,0);
    const damage={wounds:G.wounds.map(w=>({...w,att:w.att.index,vic:w.vic.index})),final:[G.player,G.enemy].map(f=>({state:f.state,alive:f.alive,blood:f.blood,consciousness:f.consciousness,limbs:{...f.limbs},plate:{...f.plate},causeOfDeath:f.causeOfDeath}))};
    return {mode,scene,seed,seconds:stats.steps*DT,wallSeconds:(performance.now()-begin)/1000,checkpoint,runtime,stats,damage,frameHashes,inputHashes,events,pairs,eventFrames};
  }finally{for(const u of undo.reverse())u();ledger?.restore();G?.eventQueue.free();G?.world.free();Math.random=originalRandom;}
}
const runs=[],comparisons=[];
for(const scene of scenes)for(const seed of seeds){
  const group=[];for(const mode of modes){const r=run(mode,scene,seed);group.push(r);runs.push(r);fs.appendFileSync(out+'.runs.jsonl',JSON.stringify(r)+'\n');console.log(JSON.stringify({mode,scene,seed,wallSeconds:r.wallSeconds,stats:r.stats}));}
  const [unobserved,baseline,...variants]=group;
  const first=(a,b)=>a.findIndex((h,i)=>h!==b[i]);
  comparisons.push({scene,seed,checkpointExact:group.every(r=>JSON.stringify(r.checkpoint)===JSON.stringify(baseline.checkpoint)),
    observationTraceExact:JSON.stringify(unobserved.frameHashes)===JSON.stringify(baseline.frameHashes),observationInputExact:JSON.stringify(unobserved.inputHashes)===JSON.stringify(baseline.inputHashes),
    branches:variants.map(r=>({mode:r.mode,firstTraceDifferenceFrame:first(baseline.frameHashes,r.frameHashes),firstReactiveInputDifferenceFrame:first(baseline.inputHashes,r.inputHashes)})),
    interpretation:'Same native/controller preparation and initial input. Options set after preparation; reactive AI can alter later inputs. Not a matched-input or matched-contact result after divergence.'});
}
const sourceAfter=manifest();
const report={createdUTC:new Date().toISOString(),baselineCommit,command:['node','tools/sim/experiments/arm_cut_interaction_probe.mjs',...process.argv.slice(2)].join(' '),
  configuration:{seconds,prepare,seeds,scenes,modes,DT,AI:'Both original AI classes, ordinary wounds/rebound/native collision/recovery',walls:false,
    scenesDescription:{cloth:'Player kettle/gambeson longsword; default unarmored enemy zweihander',plate:'Player kettle/gambeson zweihander; actual Heinrich v2 full plate enemy longsword'},
    grip:CONFIG.GRIP.reactionModel,weightMode:CONFIG.BODY.weightMode,support:{assist:CONFIG.GAIT.assist,catchMode:CONFIG.GAIT.catchMode,catchScale:CONFIG.GAIT.catchScale}},
  tolerance,sourceBefore,sourceAfter,sourceStable:JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter),toolSHA256:sha(fs.readFileSync(fileURLToPath(import.meta.url))),comparisons,runs,
  classification:{strike:'Actual Combat.strike dispatch at engine contact; result null retained separately; wound hooks and stored applied wounds differ.',
    parry:'Actual onClash callback with fresh flag and raw native normal impulses; weapon collision is a parry/contact surrogate, not AI intent.',
    glance:'Observed cached relative velocity at actual solver contact with positive normal closing, speed>=0.5m/s and normal/speed<=.25. Kinematic grazing candidate, not game damage type or successful deflection.',
    plateBlock:'Actual result.plate=true, pass=false, severity=0 and eff<=thr. Strike energy is game scaled wound energy, not measured physical loss.'},
  limitations:['Only instant explicit cut pairs close P/L/K and Eleft, not native collision/motor work or total body energy.',
    'Raw native impulse and solver point arrays have no guaranteed correspondence; tangential world basis/work unmeasured. Event-frame P/L/K changes include native joints, ground, motors and body helpers.',
    'Contact relative velocity in wound analysis is cached pre-physics; cut impulse diagnostic velocity is live at its actual application point. These are distinct times.',
    'Runtime wrist final cap directly observed; shoulder cap has no independent source readout here. Source and prior runtime parity reused. Explicit torque reaction closure measured for both.',
    'Explicit instantaneous torque power times dt is not integrated native motor work.',
    'AI input and contact sequences may diverge after branch, so wound totals do not measure direct damage efficacy or human naturalness.',
    'No mobile or human play acceptance and no promotion/deployment; source/runtime defaults unchanged.']};
report.pass=report.sourceStable&&comparisons.every(c=>c.checkpointExact&&c.observationTraceExact&&c.observationInputExact)&&runs.every(r=>r.stats.finite&&r.stats.wrappersPreserved&&r.stats.explicitTorqueClosurePass&&r.stats.cutClosurePass&&r.stats.cutPassivityPass&&r.stats.cutBudgetPass&&(!['arm','combined'].includes(r.mode)||r.stats.wristCapViolations.every(n=>n===0)));
// Serialize rows independently; every completed checkpoint remains in JSONL.
// This avoids V8's maximum string size without changing game/observer dispatch.
const {runs:serializedRuns,...header}=report;
fs.writeFileSync(out,JSON.stringify(header,null,2).trimEnd().slice(0,-1)+',\n"runs":[\n');
for(let i=0;i<serializedRuns.length;i++)fs.appendFileSync(out,(i?',\n':'')+JSON.stringify(serializedRuns[i]));
fs.appendFileSync(out,'\n]}\n');
console.log(JSON.stringify({pass:report.pass,out,sourceStable:report.sourceStable,comparisons}));process.exitCode=report.pass?0:1;
