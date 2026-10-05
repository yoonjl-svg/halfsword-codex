/** Existing contact + stance-memory candidates together, fixed gravity and input.
 * Actual game only; archived rows are references, not extra efficacy samples.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {newRound,AI,DT,CONFIG} from '../harness_m.mjs';
import {applySwordsmanship,recordSwordsmanshipInput} from '../../../src/swordsmanship.js';
import {observedCutStep,plain,controls,selectedState,pairAnalysis,snapshotWorld,V,norm} from './round4_integrated_observer.mjs';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const args=Object.fromEntries(process.argv.slice(2).map(s=>{const m=/^--(out|plan|reference|recovery|fresh)=(.+)$/.exec(s);assert(m);return[m[1],m[2]];}));
for(const key of ['out','plan','reference','recovery','fresh'])assert(args[key]&&path.isAbsolute(args[key]),key);
assert(!fs.existsSync(args.out));
const sha=x=>createHash('sha256').update(x).digest('hex');
const source=JSON.parse(fs.readFileSync(path.join(root,'SOURCE.json')));
const read=p=>{const b=fs.readFileSync(p);return{path:p,bytes:b.length,sha256:sha(b),data:JSON.parse(b)};};
const planRef=read(args.plan),p5=read(args.reference),recovery=read(args.recovery),fresh=read(args.fresh);
assert(p5.data.measurementValid&&recovery.data.measurementValid&&fresh.data.measurementValid);
const plan=planRef.data;
assert(Array.isArray(plan.rows)&&plan.rows.length>0&&plan.rows.length<=4);
for(const s of plan.rows){assert(['combat','touch'].includes(s.kind));assert(['legacy','centerline'].includes(s.mode));assert.equal(s.weapon,'zweihander');assert.equal(s.stance,'fresh');}
assert.equal(CONFIG.PHYSICS.gravity,-9.81);assert.equal(CONFIG.GAIT.stanceMemory,'legacy');assert.equal(CONFIG.BODY.supportModel,'legacy');
const scan=d=>fs.readdirSync(path.join(root,d),{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(d+'/'+e.name):e.name.endsWith('.js')?[d+'/'+e.name]:[]);
const files=[...scan('src'),'tools/sim/harness_m.mjs','tools/sim/force_ledger.mjs','tools/sim/experiments/round4_integrated_probe.mjs','tools/sim/experiments/round4_integrated_observer.mjs','package-lock.json','node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'].sort();
const manifest=()=>Object.fromEntries(files.map(p=>[p,sha(fs.readFileSync(path.join(root,p)))]));
const sourceBefore=manifest();
for(const[p,h]of Object.entries(source.files))assert.equal(sourceBefore[p],h,'Frozen source '+p);
const bridge=[];
for(const[p,h]of Object.entries(p5.data.sourceBefore).filter(([p])=>p.startsWith('src/')||p==='tools/sim/harness_m.mjs'||p==='tools/sim/force_ledger.mjs'||p.startsWith('node_modules/'))){
 if(sourceBefore[p]===h)continue;assert.equal(sourceBefore[p],source.allowedReferenceChanges[p],'Reviewed source bridge '+p);bridge.push({path:p,previous:h,current:sourceBefore[p]});
}
fs.mkdirSync(args.out,{recursive:true});
const observer=await observedCutStep();
const rows=[],startedUTC=new Date().toISOString(),started=performance.now(),savedRandom=Math.random;
let error=null,signal=null;
const interrupt=()=>{signal='SIGINT';},terminate=()=>{signal='SIGTERM';};process.on('SIGINT',interrupt);process.on('SIGTERM',terminate);
const gaitState=g=>({active:g.active,started:g.started,lev:g.lev,levH:g.levH,levC:g.levC,handU:g.handU,Nsum:g.Nsum,legs:Object.fromEntries(Object.entries(g.legs).map(([k,l])=>[k,Object.fromEntries(['stance','N','Nf','pinF','pinLim','soleY','toeY'].map(p=>[p,plain(l[p])]))]))});
const refInfo=x=>({path:x.path,bytes:x.bytes,sha256:x.sha256});

async function run(spec){
 const key=`${spec.kind}-${spec.mode}`,limit=spec.kind==='combat'?3600:1747;
 const old=p5.data.rows.find(r=>r.weapons[0]===spec.weapon&&r.mode===spec.mode);assert(old);
 const row={key,spec,steps:0,frames:[],metrics:[],entries:[],pinCalls:[],events:[],transitions:[],requests:[],firstFreshEntryTick:null,firstReferenceDifference:null,checks:{finite:true,gravityFixed:true,globalLegacy:true,onlyPlayer:true,inputAccepted:true,referencePrefixExact:true,productionFreshClear:true}};
 rows.push(row);let G,tick=0,lastReaction=null,activePin=null,currentInput=null,prevHealth=null;
 try{
  G=newRound({seed:7,weapon:spec.weapon,weapon2:'longsword',walls:false,AIClass:AI,AI2Class:AI,onFighter:f=>{
   if(f.index===0){f.onehandArmModel='manual';f.stanceMemoryModel='fresh';}
   const enter=f.gait.enter;f.gait.enter=function(...a){
    const before=gaitState(this),reentry=!!this.started,result=enter.apply(this,a),after=gaitState(this);
    const effective=f.index===0&&reentry&&Object.values(before.legs).some(l=>l.Nf>0);
    if(effective&&row.firstFreshEntryTick===null)row.firstFreshEntryTick=tick;
    if(f.index===0&&reentry)row.checks.productionFreshClear&&=Object.values(after.legs).every(l=>l.Nf===0);
    row.entries.push({tick,timeBeforeStepS:G?.t??0,fighter:f.index,state:f.state,limbs:{...f.limbs},armed:f.armed,reentry,effective,before,after});return result;
   };
   if(f.index!==0)return;
   const pin=f.gait.pinFeet;f.gait.pinFeet=function(...a){
    activePin={tick,before:gaitState(this),applied:[]};
    try{return pin.apply(this,a);}finally{activePin.after=gaitState(this);if(row.firstFreshEntryTick!==null&&tick<=row.firstFreshEntryTick+240)row.pinCalls.push(activePin);activePin=null;}
   };
   for(const leg of ['F','B']){const b=f.bodies['foot'+leg];for(const method of ['addForceAtPoint','addTorque']){const fn=b[method];b[method]=function(...a){if(activePin)activePin.applied.push({leg,method,vector:V(a[0]),point:method==='addForceAtPoint'?V(a[1]):null,magnitude:norm(a[0])});return fn.apply(this,a);};}}
  }});
  assert(applySwordsmanship(G.player));G.combat.cutReactionModel=spec.mode;G.combat.cutReactionFighter=spec.mode==='centerline'?G.player:null;
  G.combat.onCutReaction=r=>{lastReaction=r;};G.combat.afterStep=observer.afterStep;
  row.creationNativeSHA256=sha(G.world.takeSnapshot());assert.equal(row.creationNativeSHA256,old.creationNativeSHA256,'Creation native');
  let prev=G.player.handOffset.clone();
  G.before=()=>{
   const f=G.player;
   if(spec.kind==='touch'&&tick>=1477){
    const cutting=tick>=1621&&tick<=1650,held=tick>=1621&&tick<=1686,dx=cutting?.40/30:0,dy=cutting?-.70/30:0,active=Math.abs(dx)+Math.abs(dy)>1e-5;
    if(f.alive&&!f.weapon?.gun){f.handOffset.x+=dx;f.handOffset.y+=dy;}f.handHeld=held;f.inputActive=active;f.move.set(0,0);f.stickX=f.stickY=0;
    currentInput={id:tick,timeS:G.t,dx:f.alive&&!f.weapon?.gun?dx:0,dy:f.alive&&!f.weapon?.gun?dy:0,held,active};row.requests.push({...currentInput});
   }else{const delta=f.handOffset.clone().sub(prev);currentInput={id:tick,timeS:G.t,dx:delta.x,dy:delta.y,held:!!f.handHeld,active:!!f.inputActive};}
   row.checks.inputAccepted&&=recordSwordsmanshipInput(f,currentInput);
  };
  G.combat.p5ContactObserver=(stage,d)=>{
   if(stage==='before'){lastReaction=null;return{...d,tick,timeS:G.t,sw:undefined,vb:undefined,cut:undefined,bodies:[d.sw,d.vb],before:snapshotWorld(G.world,{bodies:[d.sw,d.vb]}),budgetAfter:d.cut.Eleft,stuckAfter:d.cut.stuckT,stuck:!!d.cut.stuck,regime:d.budgetBefore>0?'drag':'stuck',victimAlive:d.cut.pr.v.fighter.alive,attackerArmed:d.cut.pr.w.fighter.armed};}
   if(d.token){const t=d.token,event={...t,bodies:undefined,pointV:lastReaction?t.pointA:t.legacyPointV,reaction:lastReaction,after:snapshotWorld(G.world,{bodies:t.bodies})};event.analysis=pairAnalysis(event);row.events.push(event);if(lastReaction)assert.equal(event.attacker,0,'Candidate applied to opponent');}
  };
  for(tick=0;tick<limit;tick++){
   if(tick%120===0)await new Promise(r=>setImmediate(r));if(signal)throw Error('Interrupted; partial row preserved');
   if(spec.kind==='touch'&&tick===1477)G.ai2=null;
   G.step();prev.copy(G.player.handOffset);
   const frame=[tick,sha(G.world.takeSnapshot()),sha(JSON.stringify({fighters:[controls(G.player),controls(G.enemy)],ai:plain(G.ai),ai2:plain(G.ai2)})),sha(JSON.stringify({player:currentInput,enemy:{pad:G.enemy.handOffset.toArray(),active:G.enemy.inputActive,move:G.enemy.move.toArray(),tap:plain(G.enemy.skill.tap)}}))];row.frames.push(frame);row.steps=row.frames.length;
   const oldExact=JSON.stringify(frame)===JSON.stringify(old.frames[tick]);if(!oldExact&&row.firstReferenceDifference===null)row.firstReferenceDifference=tick;
   const beforeFresh=row.firstFreshEntryTick===null||tick<row.firstFreshEntryTick,beforeTouch=spec.kind!=='touch'||tick<1477;
   if(beforeFresh&&beforeTouch&&!oldExact){row.checks.referencePrefixExact=false;throw Error('Unexpected reference prefix difference '+key+' tick'+tick);}
   if(spec.mode==='legacy'){
    const reference=spec.kind==='touch'?recovery.data.row:fresh.data.row;
    if(tick<reference.frames.length)assert.deepEqual(frame,reference.frames[tick],'Existing recovery prefix '+key+' tick'+tick);
   }
   row.checks.gravityFixed&&=CONFIG.PHYSICS.gravity===-9.81&&G.world.gravity.y===-9.81;
   row.checks.globalLegacy&&=CONFIG.GAIT.stanceMemory==='legacy'&&CONFIG.BODY.supportModel==='legacy';
   row.checks.onlyPlayer&&=G.player.stanceMemoryModel==='fresh'&&G.enemy.stanceMemoryModel!=='fresh'&&G.combat.cutReactionModel===spec.mode&&(spec.mode!=='centerline'||G.combat.cutReactionFighter===G.player);
   row.checks.finite&&=G.world.bodies.getAll().every(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].every(v=>Object.values(v).every(Number.isFinite)));assert(row.checks.finite,'Nonfinite state');
   const state=selectedState(G),health=JSON.stringify(state.fighters.map(f=>[f.state,f.alive,f.armed,f.gripValid,f.limbs,f.control.assist.owner]));
   if(health!==prevHealth)row.transitions.push({tick,...state});prevHealth=health;
   row.metrics.push({tick,...state});
  }
 }finally{
  if(G){row.wounds=G.wounds.map(w=>({timeS:w.t,attacker:w.att.index,victim:w.vic.index,type:w.type,zone:w.zone,energyJ:w.energy,severity:w.severity}));row.finalStates=[controls(G.player),controls(G.enemy)];}
  G?.eventQueue.free();G?.world.free();
  const p=path.join(args.out,key+'.json');fs.writeFileSync(p,JSON.stringify(row)+'\n');row.artifact={path:p,bytes:fs.statSync(p).size,sha256:sha(fs.readFileSync(p))};console.log(JSON.stringify({key,steps:row.steps,firstFreshEntryTick:row.firstFreshEntryTick,events:row.events.length,checks:row.checks}));
 }
}
try{for(const s of plan.rows)await run(s);}catch(e){error={name:e.name,message:e.message,stack:e.stack};}
finally{
 Math.random=savedRandom;process.off('SIGINT',interrupt);process.off('SIGTERM',terminate);
 const sourceAfter=manifest(),sourceStable=JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter),measurementValid=!error&&sourceStable&&rows.length===plan.rows.length&&rows.every(r=>Object.values(r.checks).every(Boolean));
 const report={schemaVersion:1,head:source.head,source,sourceBefore,sourceAfter,sourceStable,bridge,measurementValid,error,startedUTC,completedUTC:new Date().toISOString(),wallSeconds:(performance.now()-started)/1000,executionCount:rows.length,steps:rows.reduce((s,r)=>s+r.steps,0),command:process.argv,observer:{originalSHA256:observer.originalSHA256,transformedSHA256:observer.transformedSHA256},references:{p5:refInfo(p5),recovery:refInfo(recovery),fresh:refInfo(fresh),plan:refInfo(planRef)},protocol:{gravity:-9.81,dt:DT,rows:plan.rows,scope:'Production flags from spawn; current v2 on player, opponent legacy. Fixed two-AI combat or predeclared scripted recut after1477. No source gains/health/body transform change. Fresh-stance and cutting exposures counted separately; absence of interaction does not pass that gate.'},rows:rows.map(r=>({key:r.key,spec:r.spec,steps:r.steps,artifact:r.artifact,checks:r.checks,firstFreshEntryTick:r.firstFreshEntryTick,firstReferenceDifference:r.firstReferenceDifference,events:r.events.length}))};
 const file=path.join(args.out,'report.json');fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');const b=fs.readFileSync(file);fs.writeFileSync(path.join(args.out,'receipt.json'),JSON.stringify({path:file,bytes:b.length,sha256:sha(b),measurementValid,error,executionCount:report.executionCount,steps:report.steps},null,2)+'\n');if(!measurementValid)process.exitCode=1;
}
