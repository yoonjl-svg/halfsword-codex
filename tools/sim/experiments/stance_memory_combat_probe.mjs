/** Actual combat regression for isolated Gait.enter Nf lifecycle reset. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {fileURLToPath} from 'node:url';
import {newRound,AI,DT,THREE,handPos,CONFIG} from '../harness_m.mjs';
import {snapshotWorld} from '../force_ledger.mjs';
import {getLook} from '../../../src/looks.js';
import {clearStanceFrictionMemory} from './recovery_contact_memory_candidate.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const opts=Object.fromEntries(process.argv.slice(2).map(a=>{const m=/^--(seconds|seeds|scenes|scripted|out)=(.+)$/.exec(a);if(!m)throw Error('Invalid argument');return [m[1],m[2]];}));
const seconds=Number(opts.seconds??30),prepare=1,seeds=(opts.seeds??'7,17').split(',').map(Number),scenes=(opts.scenes??'cloth,plate').split(','),scripted=opts.scripted==='1';
const out=opts.out??'/workspace/halfsword-hybrid-evidence/stance-memory-combat-r1.json';
if([out,out+'.runs.jsonl',out+'.start.json'].some(p=>fs.existsSync(p)))throw Error('Choose unused --out');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex'),V=v=>new THREE.Vector3(v.x,v.y,v.z),norm=v=>Math.hypot(v.x,v.y,v.z);
function sortedState(x){if(Array.isArray(x))return x.map(sortedState);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().map(k=>[k,sortedState(x[k])]));return x;}
const canonicalText=x=>JSON.stringify(sortedState(x));
const sourceFiles=(()=>{function scan(d){return fs.readdirSync(root+d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(d+'/'+e.name):e.name.endsWith('.js')?[d+'/'+e.name]:[]);}return [...scan('src'),'tools/sim/harness_m.mjs','tools/sim/force_ledger.mjs','tools/sim/experiments/recovery_contact_memory_candidate.mjs','package-lock.json','node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'].sort();})();
const manifest=()=>Object.fromEntries(sourceFiles.map(p=>[p,sha(fs.readFileSync(root+p))]));
const sourceBefore=manifest(),gitHead=fs.readFileSync(root+'.git/HEAD','utf8').trim(),baselineCommit=gitHead.startsWith('ref: ')?fs.readFileSync(root+'.git/'+gitHead.slice(5),'utf8').trim():gitHead;
const historyPath='/workspace/halfsword-hybrid-evidence/q05-arm-cut-r3.bounded.json',history=JSON.parse(fs.readFileSync(historyPath,'utf8'));
const historicalSourceExact=Object.entries(history.sourceAfter).every(([p,h])=>sourceBefore[p]===h);
const originalRandom=Math.random;
fs.writeFileSync(out+'.start.json',JSON.stringify({sourceBefore,baselineCommit,command:process.argv,probeSHA256:sha(fs.readFileSync(fileURLToPath(import.meta.url)))}));
// Identical Q05 observation encoders, without importing its executable probe.
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
function traceBodies(snapshot){return snapshot.bodies.map(b=>({h:b.handle,m:b.mass,p:b.position,q:b.rotation,com:b.com,v:b.velocity,w:b.omega,I:b.inertia,userForce:b.userForce,userTorque:b.userTorque}));}
const withoutNf=g=>Object.fromEntries(Object.entries(ownState(g.legs)).map(([k,l])=>[k,Object.fromEntries(Object.entries(l).filter(([n])=>n!=='Nf'))]));
function run(mode,scene,seed,forced=false){
 const begin=performance.now();let G;const entries=[],transitions=[],woundRows=[],samples=[],frameHashes=[],semanticFrameHashes=[],physicalFrameHashes=[],inputHashes=[],targetHashes=[];
 const seenRecovery=[false,false],entryCounts=[0,0];let frame=-120,knocked=false,knockRecord=null;
 const stats={finite:true,steps:0,enterCalls:[0,0],postInitialEnterCalls:[0,0],recoveryEnterCalls:[0,0],nonzeroMemoryRecoveryClears:[0,0],helperCalls:[0,0],helperOnlyNf:true,
   falls:[0,0],getups:[0,0],deaths:[0,0],stateFrames:[{},{}],maxBodySpeedMps:0,maxBodyAngularRadps:0,angularPeak:null,peakWholeKJ:0,peakWholeRotationalKJ:0,wholeKPeak:null,
   maxJointGapM:[0,0],maxGripGapM:[0,0],maxHandTargetErrorM:[0,0],maxFootDesDistanceM:[0,0]};
 function context(f){return {fighter:f.index,state:f.state,alive:f.alive,armed:f.armed,blood:f.blood,consciousness:f.consciousness,limbs:{...f.limbs}};}
 try{
  G=newRound({seed,walls:false,weapon:scene==='plate'?'zweihander':'longsword',weapon2:scene==='plate'?'longsword':'zweihander',AIClass:AI,AI2Class:AI,look2:scene==='plate'?getLook('heinrich'):undefined,
    onFighter:f=>{
      f.armTorqueModel='legacy';
      const original=f.gait.enter;f.gait.enter=function(...args){
        const recovery=!!this.started&&seenRecovery[f.index],preNative=sha(f.world.takeSnapshot()),otherBefore=sha(JSON.stringify(withoutNf(this))),before=Object.fromEntries(Object.entries(this.legs).map(([k,l])=>[k,{Nf:l.Nf??null,N:l.N??null}]));
        const row={frame,timeS:G?.t??0,...context(f),call:++entryCounts[f.index],startedBefore:!!this.started,recovery,before,preNative,
          preTargets:sha(JSON.stringify(f.joints.map(j=>[j.name,j.target.toArray(),j.prevRV?.toArray()]))),preControl:sha(canonicalText(control(G))),preInput:sha(JSON.stringify(input(G)))};
        stats.enterCalls[f.index]++;if(this.started)stats.postInitialEnterCalls[f.index]++;if(recovery)stats.recoveryEnterCalls[f.index]++;
        if(mode==='reset'){
          clearStanceFrictionMemory(this);stats.helperCalls[f.index]++;
          const untouched=sha(JSON.stringify(withoutNf(this)))===otherBefore&&sha(f.world.takeSnapshot())===preNative;
          const zero=Object.values(this.legs).every(l=>l.Nf===0);stats.helperOnlyNf&&=untouched&&zero;
          row.helperOnlyNf=untouched&&zero;row.afterReset=Object.fromEntries(Object.entries(this.legs).map(([k,l])=>[k,{Nf:l.Nf,N:l.N??null}]));
          if(recovery&&Object.values(before).some(l=>l.Nf>0))stats.nonzeroMemoryRecoveryClears[f.index]++;
        }
        const result=original.apply(this,args);row.afterOriginal=Object.fromEntries(Object.entries(this.legs).map(([k,l])=>[k,{Nf:l.Nf??null,N:l.N??null}]));entries.push(row);return result;
      };
      const stateOriginal=f.setState;f.setState=function(state){const prev=this.state;const value=stateOriginal.call(this,state);if(state==='down'||state==='getup')seenRecovery[this.index]=true;
        if(state==='down'&&prev!=='down')stats.falls[this.index]++;if(state==='getup'&&prev!=='getup')stats.getups[this.index]++;if(state==='dead'&&prev!=='dead')stats.deaths[this.index]++;
        transitions.push({frame,timeS:G?.t??0,from:prev,to:state,...context(this)});return value;};
    }});
  G.combat.cutReactionModel='legacy';G.onWound=(a,v,r)=>woundRows.push({frame,timeS:G.t,attacker:a.index,victim:v.index,result:ownState(r),victimContext:context(v)});
  for(frame=-120;frame<0;frame++)G.step();
  const checkpoint={timeS:G.t,native:sha(G.world.takeSnapshot()),control:sha(canonicalText(control(G))),controlOrderSensitive:sha(JSON.stringify(control(G))),input:sha(JSON.stringify(input(G)))};
  if(forced)G.before=t=>{if(!knocked&&t>=prepare+3-DT/2){knocked=true;const f=G.player;knockRecord={frame,timeS:t,preNative:sha(G.world.takeSnapshot()),preControl:sha(canonicalText(control(G))),preInput:sha(JSON.stringify(input(G))),context:context(f),Nf:Object.fromEntries(Object.entries(f.gait.legs).map(([k,l])=>[k,l.Nf??null])),mechanism:'Synthetic player.knockDown(true); actual AI/combat/wounds stay active. No direct body velocity/position injection.'};f.knockDown(true);knockRecord.after={state:f.state,downTime:f.downTime};}};
  const labels=new Map();for(const f of [G.player,G.enemy]){for(const [part,b]of Object.entries(f.bodies))labels.set(String(b.handle),`${f.index}:${part}`);labels.set(String(f.sword.handle),`${f.index}:sword`);}
  for(frame=0;frame<Math.round(seconds/DT);frame++){
    G.step();stats.steps++;const snapshot=snapshotWorld(G.world),bodies=traceBodies(snapshot);
    const controls=control(G);frameHashes.push(sha(JSON.stringify({bodies,control:controls})));semanticFrameHashes.push(sha(canonicalText({bodies,control:controls})));physicalFrameHashes.push(sha(JSON.stringify(bodies)));inputHashes.push(sha(JSON.stringify(input(G))));
    targetHashes.push(sha(JSON.stringify([G.player,G.enemy].map(f=>({handTarget:f.handTarget.toArray(),joints:f.joints.map(j=>[j.name,j.target.toArray()]),feet:Object.entries(f.gait.legs).map(([k,l])=>[k,l.des.toArray(),l.desV.toArray()])})))));
    for(const b of snapshot.bodies){for(const field of ['position','rotation','velocity','omega'])if(!Object.values(b[field]).every(Number.isFinite))stats.finite=false;
      stats.maxBodySpeedMps=Math.max(stats.maxBodySpeedMps,norm(b.velocity));if(norm(b.omega)>stats.maxBodyAngularRadps){stats.maxBodyAngularRadps=norm(b.omega);stats.angularPeak={frame,timeS:G.t,label:labels.get(b.handle)??'loose/unmapped',handle:b.handle,mass:b.mass,omega:b.omega,Krotation:b.Krotation,contexts:[context(G.player),context(G.enemy)]};}}
    if(snapshot.total.K>stats.peakWholeKJ){stats.peakWholeKJ=snapshot.total.K;stats.wholeKPeak={frame,timeS:G.t,K:snapshot.total.K,Krotation:snapshot.total.Krotation,contexts:[context(G.player),context(G.enemy)]};}
    stats.peakWholeRotationalKJ=Math.max(stats.peakWholeRotationalKJ,snapshot.total.Krotation);
    for(const f of [G.player,G.enemy]){
      stats.stateFrames[f.index][f.state]=(stats.stateFrames[f.index][f.state]??0)+1;
      if(f.armed&&f.alive)stats.maxHandTargetErrorM[f.index]=Math.max(stats.maxHandTargetErrorM[f.index],handPos(f).distanceTo(f.handTarget));
      for(const [k,l]of Object.entries(f.gait.legs))stats.maxFootDesDistanceM[f.index]=Math.max(stats.maxFootDesDistanceM[f.index],V(f.bodies['foot'+k].translation()).distanceTo(l.des));
      for(const j of [...f.joints.map(j=>j.joint),f.gripJoint])if(j?.isValid()){
        const a=V(j.anchor1()).applyQuaternion(new THREE.Quaternion().copy(j.body1().rotation())).add(V(j.body1().translation())),b=V(j.anchor2()).applyQuaternion(new THREE.Quaternion().copy(j.body2().rotation())).add(V(j.body2().translation()));
        const gap=a.distanceTo(b);stats.maxJointGapM[f.index]=Math.max(stats.maxJointGapM[f.index],gap);if(j===f.gripJoint)stats.maxGripGapM[f.index]=Math.max(stats.maxGripGapM[f.index],gap);
      }
    }
    if(frame%120===0)samples.push({frame,timeS:G.t,K:snapshot.total.K,rotationK:snapshot.total.Krotation,contexts:[context(G.player),context(G.enemy)],feet:[G.player,G.enemy].map(f=>Object.fromEntries(Object.entries(f.gait.legs).map(([k,l])=>[k,{Nf:l.Nf??null,N:l.N??null,active:f.gait.active,stance:l.stance,pinF:l.pinF??null,pinLim:l.pinLim??null,des:l.des.toArray()}])))});
    if(!stats.finite)break;
  }
  return {mode,scene,seed,forced,seconds:stats.steps*DT,wallSeconds:(performance.now()-begin)/1000,checkpoint,stats,entries,transitions,woundRows,knockRecord,samples,frameHashes,semanticFrameHashes,physicalFrameHashes,inputHashes,targetHashes,
    wounds:G.wounds.map(w=>({...w,att:w.att.index,vic:w.vic.index})),final:[G.player,G.enemy].map(f=>({...context(f),causeOfDeath:f.causeOfDeath,woundRecords:f.wounds.length})),runtime:{cut:G.combat.cutReactionModel,arms:[G.player.armTorqueModel,G.enemy.armTorqueModel]}};
 }finally{G?.eventQueue.free();G?.world.free();Math.random=originalRandom;}
}
const runs=[],comparisons=[];
function compareCase(scene,seed,forced){
 const group=[];for(const mode of ['baseline','reset']){const r=run(mode,scene,seed,forced);runs.push(r);group.push(r);fs.appendFileSync(out+'.runs.jsonl',JSON.stringify(r)+'\n');console.log(JSON.stringify({mode,scene,seed,forced,stats:r.stats,wallSeconds:r.wallSeconds}));}
 const [a,b]=group,old=history.runs.find(r=>r.mode==='baseline'&&r.scene===scene&&r.seed===seed),first=(x,y)=>x.findIndex((h,i)=>h!==y[i]);
 const firstRecoveryA=a.entries.find(e=>e.recovery),firstRecoveryB=b.entries.find(e=>e.recovery);
 comparisons.push({scene,seed,forced,checkpointExact:['timeS','native','control','input'].every(k=>a.checkpoint[k]===b.checkpoint[k]),
   checkpointOrderSensitiveControlExact:a.checkpoint.controlOrderSensitive===b.checkpoint.controlOrderSensitive,
   baselineHistoricalFullTraceExact:forced?null:JSON.stringify(a.frameHashes)===JSON.stringify(old?.frameHashes),baselineHistoricalInputsExact:forced?null:JSON.stringify(a.inputHashes)===JSON.stringify(old?.inputHashes),
   baselineResetFullTraceExact:JSON.stringify(a.frameHashes)===JSON.stringify(b.frameHashes),baselineResetInputsExact:JSON.stringify(a.inputHashes)===JSON.stringify(b.inputHashes),baselineResetTargetsExact:JSON.stringify(a.targetHashes)===JSON.stringify(b.targetHashes),
   baselineResetSemanticTraceExact:JSON.stringify(a.semanticFrameHashes)===JSON.stringify(b.semanticFrameHashes),baselineResetPhysicalTraceExact:JSON.stringify(a.physicalFrameHashes)===JSON.stringify(b.physicalFrameHashes),
   firstOrderSensitiveTraceDifferenceFrame:first(a.frameHashes,b.frameHashes),firstTraceDifferenceFrame:first(a.semanticFrameHashes,b.semanticFrameHashes),firstPhysicalDifferenceFrame:first(a.physicalFrameHashes,b.physicalFrameHashes),firstInputDifferenceFrame:first(a.inputHashes,b.inputHashes),firstTargetDifferenceFrame:first(a.targetHashes,b.targetHashes),
   forcedKnockPrestateExact:forced?!!a.knockRecord&&!!b.knockRecord&&JSON.stringify(a.knockRecord)===JSON.stringify(b.knockRecord):null,
   firstRecoveryEntryPrestateExact:firstRecoveryA&&firstRecoveryB?firstRecoveryA.preNative===firstRecoveryB.preNative&&firstRecoveryA.preControl===firstRecoveryB.preControl&&firstRecoveryA.preInput===firstRecoveryB.preInput&&firstRecoveryA.preTargets===firstRecoveryB.preTargets&&JSON.stringify(firstRecoveryA.before)===JSON.stringify(firstRecoveryB.before):null,
   actualRecoveryEntries:group.map(r=>r.stats.recoveryEnterCalls),actualNonzeroResetEntries:b.stats.nonzeroMemoryRecoveryClears,
   note:'Exact baseline/history proves observer preservation when source/settings match. Real AI can diverge after a nonzero Nf reset; synthetic knockdown is labelled separately.'});
}
for(const scene of scenes)for(const seed of seeds)compareCase(scene,seed,false);
const normalRecoveryEntries=runs.reduce((s,r)=>s+r.stats.recoveryEnterCalls.reduce((a,b)=>a+b,0),0);
if(scripted&&normalRecoveryEntries===0)compareCase('cloth',7,true);
const sourceAfter=manifest();
const report={createdUTC:new Date().toISOString(),baselineCommit,command:['node','tools/sim/experiments/stance_memory_combat_probe.mjs',...process.argv.slice(2)].join(' '),
 configuration:{seconds,prepare,seeds,scenes,scriptedFallback:scripted,DT,AI:'Both original AI classes; ordinary combat/wound/death. Player knockDown(true) only in explicitly forced fallback.',cut:'legacy',arms:'legacy',grip:CONFIG.GRIP.reactionModel,support:{assist:CONFIG.GAIT.assist,catchMode:CONFIG.GAIT.catchMode,catchScale:CONFIG.GAIT.catchScale}},
 sourceBefore,sourceAfter,sourceStable:JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter),historicalSourceExact,history:{path:historyPath,sha256:sha(fs.readFileSync(historyPath)),sourceCommit:history.baselineCommit},
 toolSHA256:sha(fs.readFileSync(fileURLToPath(import.meta.url))),normalRecoveryEntries,runs,comparisons,
 limitations:['Standard real combat may never reenter stance; initial undefined Nf reset alone cannot show recovery efficacy.',
 'Forced fallback uses synthetic game knockDown(true), not a collision-caused fall, with AI/combat/wounds active.',
 'Only Nf is cleared before actual Gait.enter; N/Nsum/plant/targets/masses/gains/native parameters are not modified by the helper.',
 'Native work and naturalness/mobile acceptance unmeasured; differing AI inputs and wound totals do not show damage benefit.',
 'maxFootDesDistance includes recovery/death/inactive-gait periods; retained descriptor target distance, not a stance error verdict.']};
report.pass=report.sourceStable&&historicalSourceExact&&runs.every(r=>r.stats.finite&&r.stats.helperOnlyNf)&&comparisons.every(c=>c.checkpointExact&&(c.forced||c.baselineHistoricalFullTraceExact&&c.baselineHistoricalInputsExact)&&(!c.forced||c.forcedKnockPrestateExact)&&c.firstRecoveryEntryPrestateExact!==false);
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({out,pass:report.pass,normalRecoveryEntries,comparisons}));process.exitCode=report.pass?0:1;
