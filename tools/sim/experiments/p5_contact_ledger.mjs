/** Read-only first legacy cutting-contact ledger on actual game/native bodies.
 * The observed Combat clone inserts callbacks immediately around the unchanged
 * two impulse calls. Original control, damage, impulse, budget and point policy
 * are preserved; original unobserved replay must have exact native/control/input.
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
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const m=/^--(out|seconds)=(.+)$/.exec(a);assert(m);return [m[1],m[2]];}));
const out=args.out,seconds=Number(args.seconds??20);assert(out&&path.isAbsolute(out)&&!fs.existsSync(out));assert(seconds>0&&seconds<=20);
const sha=x=>createHash('sha256').update(x).digest('hex');
const git=(...a)=>execFileSync('git',a,{cwd:root,encoding:'utf8'}).trim();
const scan=d=>fs.readdirSync(path.join(root,d),{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(d+'/'+e.name):e.name.endsWith('.js')?[d+'/'+e.name]:[]);
const files=[...scan('src'),'tools/sim/harness_m.mjs','tools/sim/force_ledger.mjs','tools/sim/experiments/p5_contact_ledger.mjs','package-lock.json','node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'].sort();
const manifest=()=>Object.fromEntries(files.map(p=>[p,sha(fs.readFileSync(path.join(root,p)))]));
const sourceBefore=manifest(),head=git('rev-parse','HEAD'),dirty=git('status','--porcelain'),startedUTC=new Date().toISOString();
fs.mkdirSync(out,{recursive:true});
for(const p of files){const dest=path.join(out,'frozen',p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,p),dest);}
fs.writeFileSync(path.join(out,'frozen/manifest.json'),JSON.stringify({head,files:sourceBefore},null,2)+'\n');
const combatURL=new URL('../../../src/combat.js',import.meta.url),original=fs.readFileSync(combatURL,'utf8');
let cloned=original;
function replaceExactly(a,b){assert.equal(cloned.split(a).length-1,1,'Exact unchanged legacy anchor');cloned=cloned.replace(a,b);}
replaceExactly('      let J = 0;\n      if (c.Eleft > 0) {','      const p5BudgetBefore = c.Eleft, p5StuckBefore = c.stuckT;\n      let J = 0;\n      if (c.Eleft > 0) {');
replaceExactly('        sw.applyImpulseAtPoint({ x: -dir.x * J, y: -dir.y * J, z: -dir.z * J }, vp(pA), true);',
`        const p5Token = this.p5ContactObserver?.('before', {sw,vb,point:vp(point),pointA:vp(pA),dir:vp(dir),J,key,cut:c,budgetBefore:p5BudgetBefore,stuckBefore:p5StuckBefore,attacker:c.pr.w.fighter.index,victim:c.pr.v.fighter.index,part:c.pr.v.part});
        sw.applyImpulseAtPoint({ x: -dir.x * J, y: -dir.y * J, z: -dir.z * J }, vp(pA), true);`);
replaceExactly('        vb.applyImpulseAtPoint({ x: dir.x * J * 0.8, y: dir.y * J * 0.8, z: dir.z * J * 0.8 }, vp(pv), true);',
`        vb.applyImpulseAtPoint({ x: dir.x * J * 0.8, y: dir.y * J * 0.8, z: dir.z * J * 0.8 }, vp(pv), true);
        this.p5ContactObserver?.('after', {token:p5Token,pointV:vp(pv)});`);
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
function selectedState(G){return {timeS:G.t,fighters:[G.player,G.enemy].map(f=>({index:f.index,state:f.state,alive:f.alive,armed:f.armed,hand:f.bodies.farmS.translation(),sword:{position:f.sword.translation(),velocity:f.sword.linvel(),omega:f.sword.angvel()},chest:{position:f.bodies.chest.translation(),rotation:f.bodies.chest.rotation(),omega:f.bodies.chest.angvel()}}))};}
function deltaK(body,point,J){const r=sub(point,body.com),tau=cross(r,J),I=new THREE.Matrix3().fromArray(body.inertia.world).invert(),v=new THREE.Vector3(tau.x,tau.y,tau.z).applyMatrix3(I);return dot(body.velocity,J)+dot(body.omega,tau)+.5*(dot(J,J)/body.mass+tau.x*v.x+tau.y*v.y+tau.z*v.z);}
function pairAnalysis(event){
 const [a,b]=event.before.bodies,[aa,bb]=event.after.bodies,Jw=scale(event.dir,-event.J),Jv=scale(event.dir,event.J*.8),predP=add(Jw,Jv),predL=add(cross(event.pointA,Jw),cross(event.pointV,Jv));
 const dP=sub(event.after.total.P,event.before.total.P),dL=sub(event.after.total.L,event.before.total.L),dK=event.after.total.K-event.before.total.K,predK=deltaK(a,event.pointA,Jw)+deltaK(b,event.pointV,Jv);
 const missing=scale(event.dir,event.J*.2),extraK=deltaK(bb,bb.com,missing);
 return {deltaP:dP,predictedDeltaP:predP,deltaPResidualNs:norm(sub(dP,predP)),deltaL:dL,predictedDeltaL:predL,deltaLResidualNms:norm(sub(dL,predL)),deltaKJ:dK,predictedDeltaKJ:predK,deltaKResidualJ:dK-predK,requestedBudgetDebitJ:event.budgetBefore-event.budgetAfter,pointSeparationM:norm(sub(event.pointA,event.pointV)),
  counterfactualLinearCompletion:{applied:false,description:'Read-only arithmetic: an additional +0.2J at victim COM would preserve the existing victim angular impulse but not close angular momentum or guarantee later posture/damage.',extraImpulseNs:missing,extraKJ:extraK,pairDeltaKJ:dK+extraK,remainingDeltaL:add(dL,cross(bb.com,missing)),remainingDeltaP:add(dP,missing)}};
}
const rows=[],comparisons=[],started=performance.now(),savedRandom=Math.random;let error=null;
async function run(weapons,observer,stopSteps){
 const row={weapons,observer,seed:7,frames:[],events:[],window:[],firstPlayerCutTick:null,checks:{finite:true,inputAccepted:true,legacyOnly:true}};let G;
 try{
  G=newRound({seed:7,weapon:weapons[0],weapon2:weapons[1],walls:false,AIClass:AI,AI2Class:AI,onFighter:f=>{if(f.index===0)f.onehandArmModel='manual';}});
  assert(applySwordsmanship(G.player));row.creationNativeSHA256=sha(G.world.takeSnapshot());let prev=G.player.handOffset.clone(),tick=0,currentInput=null,buffer=[];
  G.before=()=>{const f=G.player,delta=f.handOffset.clone().sub(prev);currentInput={id:tick,timeS:G.t,dx:delta.x,dy:delta.y,held:!!f.handHeld,active:!!f.inputActive};row.checks.inputAccepted&&=recordSwordsmanshipInput(f,currentInput);};
  if(observer){G.combat.afterStep=observed.Combat.prototype.afterStep;G.combat.p5ContactObserver=(stage,d)=>{
   if(stage==='before'){
    if(d.attacker!==0||row.events.length>=64)return null;
    if(row.firstPlayerCutTick==null){row.firstPlayerCutTick=tick;row.preContactWindow=buffer.slice();const snapshot=G.world.takeSnapshot();row.firstPairNativeSHA256=sha(snapshot);fs.writeFileSync(path.join(out,`${weapons.join('-')}-first-pair.native.bin`),snapshot);}
    return {...d,sw:undefined,vb:undefined,cut:undefined,budgetAfter:d.cut.Eleft,stuckAfter:d.cut.stuckT,tick,timeS:G.t,regime:d.budgetBefore>0?'drag':'stuck',before:snapshotWorld(G.world,{bodies:[d.sw,d.vb]}),bodies:[d.sw,d.vb],mFree:d.cut.mFree};
   }
   if(d.token){const t=d.token,event={...t,bodies:undefined,pointV:d.pointV,after:snapshotWorld(G.world,{bodies:t.bodies})};event.analysis=pairAnalysis(event);row.events.push(event);}
  };}
  const limit=stopSteps??Math.ceil(seconds/DT);
  for(tick=0;tick<limit;tick++){
   G.step();prev.copy(G.player.handOffset);row.checks.legacyOnly&&=G.combat.cutReactionModel==='legacy';
   const n=sha(G.world.takeSnapshot()),c=sha(JSON.stringify({fighters:[controls(G.player),controls(G.enemy)],ai:plain(G.ai),ai2:plain(G.ai2)})),input=sha(JSON.stringify({player:currentInput,enemy:{pad:G.enemy.handOffset.toArray(),active:G.enemy.inputActive,move:G.enemy.move.toArray(),tap:plain(G.enemy.skill.tap)}}));row.frames.push([tick,n,c,input]);
   row.checks.finite&&=G.world.bodies.getAll().every(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].every(x=>Object.values(x).every(Number.isFinite)));
   const state=selectedState(G);if(row.firstPlayerCutTick==null){buffer.push(state);if(buffer.length>3)buffer.shift();}else row.window.push(state);
   if(observer&&row.firstPlayerCutTick!=null&&tick>=row.firstPlayerCutTick+24)break;
   if(!row.checks.finite)break;
  }
  row.steps=row.frames.length;row.wounds=G.wounds.map(w=>({timeS:w.t,attacker:w.att.index,victim:w.vic.index,type:w.type,zone:w.zone,energyJ:w.energy,severity:w.severity}));row.finalStates=[controls(G.player),controls(G.enemy)];row.checks.contactObserved=!observer||row.events.length>0;
  return row;
 }finally{G?.eventQueue.free();G?.world.free();}
}
try{
 for(const weapons of [['longsword','zweihander'],['zweihander','longsword']]){
  const a=await run(weapons,true);rows.push(a);const b=await run(weapons,false,a.steps);rows.push(b);
  const eq=JSON.stringify(a.frames)===JSON.stringify(b.frames),sameCreation=a.creationNativeSHA256===b.creationNativeSHA256;
  comparisons.push({weapons,sameCreation,exactNativeControlInputTrace:eq,steps:a.steps,firstPlayerCutTick:a.firstPlayerCutTick,events:a.events.length});
  console.log(JSON.stringify({weapons,steps:a.steps,firstPlayerCutTick:a.firstPlayerCutTick,events:a.events.length,observerExact:eq,sameCreation,first:a.events[0]?.analysis,checks:[a.checks,b.checks]}));
 }
}catch(e){error={name:e.name,message:e.message,stack:e.stack};}
finally{
 Math.random=savedRandom;const sourceAfter=manifest(),sourceStable=JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter),headStable=head===git('rev-parse','HEAD');
 const pass=!error&&sourceStable&&headStable&&rows.length===4&&rows.every(r=>Object.values(r.checks).every(Boolean))&&comparisons.every(c=>c.sameCreation&&c.exactNativeControlInputTrace);
 const report={schemaVersion:1,experiment:'p5_contact_ledger',measurementValid:pass,effectAccepted:false,error,head,dirty,sourceBefore,sourceAfter,sourceStable,headStable,observedCombat:{originalSHA256:sha(original),transformedSHA256:sha(transformed),insertion:'Read-only callbacks immediately before and after original two legacy impulses; same original args/order.'},command:process.argv,startedUTC,completedUTC:new Date().toISOString(),wallSeconds:(performance.now()-started)/1000,dt:DT,protocol:{weapons:[['longsword','zweihander'],['zweihander','longsword']],seed:7,maximumSeconds:seconds,postFirstCutSteps:24,player:'Unified default assistance/manual arm from spawn. Original AI2 generates player input, explicitly recorded after AI update; not human touch equivalence.',opponent:'Original reactive AI; no park, state/health/force/solver injection.',scope:'Only existing legacy cutting observed; failed budgeted path never enabled. Counterfactual arithmetic is not applied.'},rows,comparisons};
 const file=path.join(out,'report.json');fs.writeFileSync(file,JSON.stringify(report)+'\n');const bytes=fs.readFileSync(file);fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify({rawPath:file,rawBytes:bytes.length,rawSHA256:sha(bytes),head,measurementValid:pass,executionCount:rows.length,steps:rows.reduce((s,r)=>s+r.steps,0),sourceStable,headStable,command:process.argv},null,2)+'\n');if(!pass)process.exitCode=1;
}
