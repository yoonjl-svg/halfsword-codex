/** Centerline extension: fixed two scenes to 30 seconds; reuse prior validated prefixes.
 * Read-only callbacks bracket the selected pair; current legacy baseline must match
 * the previously validated observer-off prefix. Future reactive AI may diverge.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {newRound,AI,THREE,DT} from '../harness_m.mjs';
import {snapshotWorld} from '../force_ledger.mjs';
import {applySwordsmanship,recordSwordsmanshipInput} from '../../../src/swordsmanship.js';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const m=/^--(out|seconds|reference)=(.+)$/.exec(a);assert(m);return [m[1],m[2]];}));
const out=args.out,seconds=Number(args.seconds??30);assert(out&&path.isAbsolute(out)&&!fs.existsSync(out));assert(seconds>0&&seconds<=30);
const sha=x=>createHash('sha256').update(x).digest('hex');
const snapshotMeta=fs.existsSync(path.join(root,'SOURCE.json'))?JSON.parse(fs.readFileSync(path.join(root,'SOURCE.json'),'utf8')):null;
const git=(...a)=>snapshotMeta?(a[0]==='rev-parse'?snapshotMeta.head:snapshotMeta.dirty):execFileSync('git',a,{cwd:root,encoding:'utf8'}).trim();
assert(args.reference&&path.isAbsolute(args.reference));
const referenceBytes=fs.readFileSync(args.reference),reference=JSON.parse(referenceBytes);assert(reference.measurementValid);
const scan=d=>fs.readdirSync(path.join(root,d),{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(d+'/'+e.name):e.name.endsWith('.js')?[d+'/'+e.name]:[]);
const files=[...scan('src'),'tools/sim/harness_m.mjs','tools/sim/force_ledger.mjs','tools/sim/experiments/p5_extended_boundary.mjs','package-lock.json','node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'].sort();
const manifest=()=>Object.fromEntries(files.map(p=>[p,sha(fs.readFileSync(path.join(root,p)))]));
const sourceBefore=manifest(),head=git('rev-parse','HEAD'),dirty=git('status','--porcelain'),startedUTC=new Date().toISOString();
fs.mkdirSync(out,{recursive:true});
for(const p of files){const dest=path.join(out,'frozen',p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,p),dest);}
fs.writeFileSync(path.join(out,'frozen/manifest.json'),JSON.stringify({head,files:sourceBefore},null,2)+'\n');
const combatURL=new URL('../../../src/combat.js',import.meta.url),original=fs.readFileSync(combatURL,'utf8');
let cloned=original;
function replaceExactly(a,b){assert.equal(cloned.split(a).length-1,1,'Exact unchanged legacy anchor');cloned=cloned.replace(a,b);}
replaceExactly('      let J = 0;\n      if (c.Eleft > 0) {','      const p5BudgetBefore = c.Eleft, p5StuckBefore = c.stuckT;\n      let J = 0;\n      if (c.Eleft > 0) {');
replaceExactly('        if (centerlineCutEnabled(this, c.pr.w.fighter)) {',
`        const p5Token = this.p5ContactObserver?.('before', {sw,vb,point:vp(point),pointA:vp(pA),legacyPointV:vp(onBone(c.pr.v,point)),dir:vp(dir),s,J,key,cut:c,budgetBefore:p5BudgetBefore,stuckBefore:p5StuckBefore,attacker:c.pr.w.fighter.index,victim:c.pr.v.fighter.index,part:c.pr.v.part});
        if (centerlineCutEnabled(this, c.pr.w.fighter)) {`);
replaceExactly('          vb.applyImpulseAtPoint({ x: dir.x * J * 0.8, y: dir.y * J * 0.8, z: dir.z * J * 0.8 }, vp(pv), true);\n        }',
`          vb.applyImpulseAtPoint({ x: dir.x * J * 0.8, y: dir.y * J * 0.8, z: dir.z * J * 0.8 }, vp(pv), true);
        }
        this.p5ContactObserver?.('after', {token:p5Token});`);
const transformed=cloned.replace(/from (['"])([^'"]+)\1/g,(_,q,s)=>`from ${JSON.stringify(s.startsWith('.')?new URL(s,combatURL).href:import.meta.resolve(s))}`);
const observed=await import('data:text/javascript;base64,'+Buffer.from(transformed).toString('base64'));
const V=v=>({x:v.x,y:v.y,z:v.z}),add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z}),sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z}),scale=(a,k)=>({x:a.x*k,y:a.y*k,z:a.z*k}),dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z,cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x}),norm=v=>Math.hypot(v.x,v.y,v.z);
function plain(v,depth=0,seen=new WeakSet()){
 if(v==null||['string','number','boolean'].includes(typeof v))return v;
 if(typeof v!=='object'||depth>7)return undefined;
 if(v.isVector2||v.isVector3||v.isQuaternion||v.isEuler)return v.toArray();
 if(seen.has(v))return {$shared:true};seen.add(v);
 if(Array.isArray(v))return v.map(x=>plain(x,depth+1,seen));
 return Object.fromEntries(Object.entries(v).filter(([k,x])=>!['me','f','fighter','foe','world','scene','R','raw','rawSet','profile','table'].includes(k)&&typeof x!=='function').map(([k,x])=>[k,plain(x,depth+1,seen)]).filter(([,x])=>x!==undefined));
}
const controls=f=>({state:f.state,stateTime:f.stateTime,alive:f.alive,armed:f.armed,handOffset:f.handOffset.toArray(),handHeld:f.handHeld,inputActive:f.inputActive,move:f.move.toArray(),heading:f.heading,blood:f.blood,pain:f.pain,limbs:{...f.limbs},bodyPose:{...f.bodyPose},bodyPoseVel:{...f.bodyPoseVel},skill:plain(f.skill),gait:plain(f.gait),assist:plain(f.swordsmanshipState),joints:f.joints.map(j=>({name:j.name,target:j.target.toArray(),k:j.k,d:j.d,max:j.max,gain:j.gain??1}))});
function selectedState(G){return {timeS:G.t,fighters:[G.player,G.enemy].map(f=>{
 const q=new THREE.Quaternion().copy(f.bodies.chest.rotation()),up=new THREE.Vector3(0,1,0).applyQuaternion(q);
 const gaps=[...f.joints.map(j=>({name:j.name,joint:j.joint})),{name:'grip',joint:f.gripJoint}].filter(x=>x.joint?.isValid()).map(({name,joint:j})=>{
  const a=new THREE.Vector3().copy(j.anchor1()).applyQuaternion(new THREE.Quaternion().copy(j.body1().rotation())).add(new THREE.Vector3().copy(j.body1().translation()));
  const b=new THREE.Vector3().copy(j.anchor2()).applyQuaternion(new THREE.Quaternion().copy(j.body2().rotation())).add(new THREE.Vector3().copy(j.body2().translation()));return {name,gapM:a.distanceTo(b)};
 });
 const spin=Object.entries({...f.bodies,sword:f.sword}).filter(([,b])=>b?.isValid()).map(([part,b])=>{const axis=new THREE.Vector3(...(['uarmS','farmS'].includes(part)?[1,0,0]:[0,1,0])).applyQuaternion(new THREE.Quaternion().copy(b.rotation()));return {part,heightM:b.translation().y,detached:f.detachedParts?.has(part)??false,speedMps:norm(b.linvel()),omegaRadps:norm(b.angvel()),axialRadps:axis.dot(new THREE.Vector3().copy(b.angvel()))};});
 return {index:f.index,control:{armHealth:f.armHealth,pain:f.pain,handOffset:f.handOffset.toArray(),inputActive:!!f.inputActive,handHeld:!!f.handHeld,assist:{phase:f.swordsmanshipState?.phase,owner:f.swordsmanshipState?.owner,eligible:f.swordsmanshipState?.eligible,availability:f.swordsmanshipState?.availability},wristTorque:f.debug.wristTorque?.toArray(),wristCap:f.debug.wristCap},state:f.state,alive:f.alive,armed:f.armed,gripping:!!f.gripping,gripValid:!!f.gripJoint?.isValid(),blood:f.blood,consciousness:f.consciousness,limbs:{...f.limbs},chestTiltRad:Math.acos(Math.max(-1,Math.min(1,up.y))),pelvisHeightM:f.bodies.pelvis.translation().y,gaps,spin};
})};}
function deltaK(body,point,J){const r=sub(point,body.com),tau=cross(r,J),I=new THREE.Matrix3().fromArray(body.inertia.world).invert(),v=new THREE.Vector3(tau.x,tau.y,tau.z).applyMatrix3(I);return dot(body.velocity,J)+dot(body.omega,tau)+.5*(dot(J,J)/body.mass+tau.x*v.x+tau.y*v.y+tau.z*v.z);}
function pairAnalysis(event){
 const [a,b]=event.before.bodies,[aa,bb]=event.after.bodies,Jw=scale(event.reaction?.direction??event.dir,-(event.reaction?.J??event.J)),Jv=scale(event.reaction?.direction??event.dir,(event.reaction?.J??event.J)*(event.reaction?1:.8)),predP=add(Jw,Jv),predL=add(cross(event.pointA,Jw),cross(event.pointV,Jv));
 const dP=sub(event.after.total.P,event.before.total.P),dL=sub(event.after.total.L,event.before.total.L),dK=event.after.total.K-event.before.total.K,predK=deltaK(a,event.pointA,Jw)+deltaK(b,event.pointV,Jv);
 return {deltaP:dP,predictedDeltaP:predP,deltaPResidualNs:norm(sub(dP,predP)),deltaL:dL,predictedDeltaL:predL,deltaLResidualNms:norm(sub(dL,predL)),deltaKJ:dK,predictedDeltaKJ:predK,deltaKResidualJ:dK-predK,requestedBudgetDebitJ:event.budgetBefore-event.budgetAfter,pointSeparationM:norm(sub(event.pointA,event.pointV))};
}
const rows=[],comparisons=[],started=performance.now(),savedRandom=Math.random;let error=null;
async function run(weapons,mode){
 const observer=true;
 const row={weapons,mode,observer,activationTick:1926,seed:7,frames:[],events:[],window:[],metrics:[],transitions:[],supportWindows:[],firstPlayerCutTick:null,checks:{finite:true,inputAccepted:true,failedBudgetedInactive:true,onlyPlayerSelected:true}};let G;
 try{
  G=newRound({seed:7,weapon:weapons[0],weapon2:weapons[1],walls:false,AIClass:AI,AI2Class:AI,onFighter:f=>{if(f.index===0)f.onehandArmModel='manual';}});
  assert(applySwordsmanship(G.player));G.combat.cutReactionModel='legacy';G.combat.cutReactionFighter=null;let lastReaction=null,activated=false;G.combat.onCutReaction=r=>{lastReaction=r;};row.creationNativeSHA256=sha(G.world.takeSnapshot());let prev=G.player.handOffset.clone(),tick=0,currentInput=null,buffer=[],recentEventTick=-99,previousHealth=null,cutId=0;const cutIds=new WeakMap();let previousSupportKey=null,supportUntil=-1;const supportBuffer=[],savedSupportTicks=new Set();
  G.before=()=>{const f=G.player,delta=f.handOffset.clone().sub(prev);currentInput={id:tick,timeS:G.t,dx:delta.x,dy:delta.y,held:!!f.handHeld,active:!!f.inputActive};row.checks.inputAccepted&&=recordSwordsmanshipInput(f,currentInput);};
  if(observer){G.combat.afterStep=observed.Combat.prototype.afterStep;G.combat.p5ContactObserver=(stage,d)=>{
   if(stage==='before'){
    lastReaction=null;recentEventTick=tick;if(!cutIds.has(d.cut))cutIds.set(d.cut,++cutId);
    if(d.attacker===0&&row.firstPlayerCutTick==null){row.firstPlayerCutTick=tick;row.preContactWindow=buffer.slice();const snapshot=G.world.takeSnapshot();row.firstPairNativeSHA256=sha(snapshot);row.firstBoundary={control:sha(JSON.stringify({fighters:[controls(G.player),controls(G.enemy)],ai:plain(G.ai),ai2:plain(G.ai2)})),input:sha(JSON.stringify(currentInput)),wounds:plain(G.wounds.map(w=>({t:w.t,att:w.att.index,vic:w.vic.index,zone:w.zone,type:w.type,energy:w.energy,severity:w.severity}))),point:d.point,J:d.J,budgetBefore:d.budgetBefore,budgetAfter:d.cut.Eleft,stuckBefore:d.stuckBefore,stuckAfter:d.cut.stuckT};fs.writeFileSync(path.join(out,`${weapons.join('-')}-${mode}-first-pair.native.bin`),snapshot);}
    const token={...d,episodeId:cutIds.get(d.cut),stuck:!!d.cut.stuck,seen:d.cut.seen,sw:undefined,vb:undefined,cut:undefined,budgetAfter:d.cut.Eleft,stuckAfter:d.cut.stuckT,tick,timeS:G.t,regime:d.budgetBefore>0?'drag':'stuck',before:snapshotWorld(G.world,{bodies:[d.sw,d.vb]}),bodies:[d.sw,d.vb],mFree:d.cut.mFree};
    if(!activated&&tick===1926&&d.attacker===0&&d.part==='chest'&&token.regime==='stuck'){
      const ref=reference.rows.find(r=>r.mode==='legacy'&&r.weapons[0]==='longsword'),e=ref.events.find(e=>e.tick===1926&&e.attacker===0&&e.part==='chest');assert(e);
      const fields=['point','pointA','legacyPointV','dir','s','J','key','budgetBefore','stuckBefore','attacker','victim','part','episodeId','stuck','seen','budgetAfter','stuckAfter','tick','timeS','regime','mFree'];
      row.activationBoundary={tick,timeS:G.t,pairedBodiesExact:JSON.stringify(token.before)===JSON.stringify(e.before),requestPolicyExact:fields.every(k=>JSON.stringify(token[k])===JSON.stringify(e[k])),firstPairNativeSHA256:sha(G.world.takeSnapshot()),context:[G.player,G.enemy].map(f=>({index:f.index,state:f.state,alive:f.alive,armed:f.armed,gripValid:!!f.gripJoint?.isValid()}))};
      assert(row.activationBoundary.pairedBodiesExact&&row.activationBoundary.requestPolicyExact,'Natural boundary must be exact before activation');
      fs.writeFileSync(path.join(out,'activation-pair.native.bin'),G.world.takeSnapshot());G.combat.cutReactionModel='centerline';G.combat.cutReactionFighter=G.player;activated=true;
    }
    return token;
   }
   if(d.token){const t=d.token,event={...t,bodies:undefined,pointV:lastReaction?t.pointA:t.legacyPointV,reaction:lastReaction,after:snapshotWorld(G.world,{bodies:t.bodies})};event.analysis=pairAnalysis(event);row.events.push(event);}
  };}
  const limit=Math.ceil(seconds/DT);
  for(tick=0;tick<limit;tick++){
   G.step();prev.copy(G.player.handOffset);row.checks.failedBudgetedInactive&&=G.combat.cutReactionModel===(activated?'centerline':'legacy');row.checks.onlyPlayerSelected&&=(!activated||G.combat.cutReactionFighter===G.player);
   const n=sha(G.world.takeSnapshot()),c=sha(JSON.stringify({fighters:[controls(G.player),controls(G.enemy)],ai:plain(G.ai),ai2:plain(G.ai2)})),input=sha(JSON.stringify({player:currentInput,enemy:{pad:G.enemy.handOffset.toArray(),active:G.enemy.inputActive,move:G.enemy.move.toArray(),tap:plain(G.enemy.skill.tap)}}));row.frames.push([tick,n,c,input]);
   row.checks.finite&&=G.world.bodies.getAll().every(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].every(x=>Object.values(x).every(Number.isFinite)));
   const state=selectedState(G),health=JSON.stringify(state.fighters.map(f=>[f.state,f.alive,f.armed,f.gripValid,f.limbs,f.control.assist.owner]));
   const supportKey=JSON.stringify(state.fighters.map(f=>[f.state,f.alive,f.armed,f.limbs]));
   const supportSnapshot={tick,timeS:G.t,fighters:[G.player,G.enemy].map(f=>({index:f.index,state:f.state,stateTime:f.stateTime,alive:f.alive,armed:f.armed,limbs:{...f.limbs},gait:plain(f.gait)}))};
   const supportChange=previousSupportKey!==null&&supportKey!==previousSupportKey;previousSupportKey=supportKey;
   const saveSupport=x=>{if(!savedSupportTicks.has(x.tick)){row.supportWindows.push(x);savedSupportTicks.add(x.tick);}};
   if(supportChange){supportUntil=tick+3;for(const x of supportBuffer)saveSupport(x);}
   if(tick<=supportUntil)saveSupport(supportSnapshot);supportBuffer.push(supportSnapshot);if(supportBuffer.length>3)supportBuffer.shift();
   const transition=health!==previousHealth;if(transition)row.transitions.push({tick,timeS:G.t,fighters:state.fighters.map(f=>({index:f.index,state:f.state,alive:f.alive,armed:f.armed,gripValid:f.gripValid,blood:f.blood,consciousness:f.consciousness,limbs:f.limbs,control:f.control}))});previousHealth=health;
   row.metrics.push({tick,timeS:G.t,fighters:state.fighters.map(f=>{const peak=(xs,k)=>xs.reduce((a,b)=>!a||Math.abs(b[k])>Math.abs(a[k])?b:a,null);return {...f,gaps:undefined,spin:undefined,maxJoint:peak(f.gaps,'gapM'),gripGap:f.gaps.find(g=>g.name==='grip')??null,maxSpeed:peak(f.spin,'speedMps'),maxHeight:peak(f.spin,'heightM'),maxOmega:peak(f.spin,'omegaRadps'),maxLimbAxial:peak(f.spin.filter(s=>s.part.startsWith('uarm')||s.part.startsWith('farm')||s.part.startsWith('thigh')||s.part.startsWith('shin')),'axialRadps'),sword:f.spin.find(s=>s.part==='sword')};})});
   if(row.firstPlayerCutTick==null){buffer.push(state);if(buffer.length>3)buffer.shift();}
   if(tick%12===0||tick<=recentEventTick+3||transition)row.window.push({tick,...state});
   if(activated&&tick>=1926+120)break;
   if(!row.checks.finite)break;
  }
  row.steps=row.frames.length;const ref=reference.rows.find(r=>JSON.stringify(r.weapons)===JSON.stringify(weapons)&&r.mode==='legacy');assert(ref);row.priorPrefix={steps:1926,exactFrames:JSON.stringify(row.frames.slice(0,1926))===JSON.stringify(ref.frames.slice(0,1926)),creationExact:row.creationNativeSHA256===ref.creationNativeSHA256,firstBoundaryExact:JSON.stringify(row.firstBoundary)===JSON.stringify(ref.firstBoundary),firstNativeExact:row.firstPairNativeSHA256===ref.firstPairNativeSHA256};row.checks.activated=activated;row.checks.priorPrefixExact=Object.entries(row.priorPrefix).filter(([k])=>k!=='steps').every(([,v])=>v);row.wounds=G.wounds.map(w=>({timeS:w.t,attacker:w.att.index,victim:w.vic.index,type:w.type,zone:w.zone,energyJ:w.energy,severity:w.severity}));row.finalStates=[controls(G.player),controls(G.enemy)];row.checks.contactObserved=!observer||row.events.length>0;
  return row;
 }finally{G?.eventQueue.free();G?.world.free();}
}
try{
 const row=await run(['longsword','zweihander'],'lateCenterline');rows.push(row);console.log(JSON.stringify({steps:row.steps,priorPrefix:row.priorPrefix,activationBoundary:row.activationBoundary,checks:row.checks}));
}catch(e){error={name:e.name,message:e.message,stack:e.stack};}
finally{
 Math.random=savedRandom;const sourceAfter=manifest(),sourceStable=JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter),headStable=head===git('rev-parse','HEAD');
 const pass=!error&&sourceStable&&headStable&&rows.length===1&&rows.every(r=>Object.values(r.checks).every(Boolean))&&comparisons.every(c=>c.sameCreation&&c.exactPrefixNativeControlInput&&c.sameBoundary&&c.samePairNative&&c.firstTickSame);
 const report={schemaVersion:1,snapshotMeta,experiment:'p5_extended_boundary',measurementValid:pass,effectAccepted:false,error,head,dirty,sourceBefore,sourceAfter,sourceStable,headStable,observedCombat:{originalSHA256:sha(original),transformedSHA256:sha(transformed),insertion:'Read-only callbacks around the selected legacy or centerline impulse pair; all other runtime control preserved.'},command:process.argv,startedUTC,completedUTC:new Date().toISOString(),wallSeconds:(performance.now()-started)/1000,dt:DT,protocol:{weapons:[['longsword','zweihander']],seed:7,maximumSeconds:seconds,fixedDurationSeconds:null,activation:{tick:1926,part:'chest',attacker:0,regime:'stuck',postSteps:120},priorReference:{path:args.reference,sha256:sha(referenceBytes)},sampling:'All per-step compact metrics; full pose on 12-step cadence, actual cut +3 steps and control/health transitions. All cutting pairs for both attackers retained without a 64-event cap.',player:'Unified default assistance/manual arm from spawn. Original AI2 generates player input, explicitly recorded after AI update; not human touch equivalence.',opponent:'Original reactive AI; no park, state/health/force/solver injection.',scope:'Late-enabled boundary diagnostic: legacy until the known natural tick1926 player chest stuck pair, then centerline for player only. Not spawn-enabled B evidence. Legacy request/Eleft debit/stuck timer unchanged. Old budgeted path never enabled. Contact-after input may diverge through original reactive AI. Instant pair energy is separate from requested budget debit.'},rows,comparisons};
 const file=path.join(out,'report.json');fs.writeFileSync(file,JSON.stringify(report)+'\n');const bytes=fs.readFileSync(file);fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify({rawPath:file,rawBytes:bytes.length,rawSHA256:sha(bytes),head,measurementValid:pass,executionCount:rows.length,steps:rows.reduce((s,r)=>s+r.steps,0),sourceStable,headStable,command:process.argv},null,2)+'\n');if(!pass)process.exitCode=1;
}
