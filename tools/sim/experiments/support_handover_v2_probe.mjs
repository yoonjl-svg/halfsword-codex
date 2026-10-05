/** Whole-body ground-support handover observation; reuses exact speed-probe inputs. Actual game, same deliberate inputs.
 * Injured rows replay the known natural injury, then park the opponent before
 * reentry to isolate movement from different future hits. Not a combat gate.
 * Gravity-only row changes PHYSICS.gravity in memory, never repository defaults.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {newRound,AI,THREE,DT,CONFIG} from '../harness_m.mjs';
import {collectSupportContacts} from '../../../src/support_contacts.js';
import {applySwordsmanship,recordSwordsmanshipInput} from '../../../src/swordsmanship.js';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const args=Object.fromEntries(process.argv.slice(2).map(x=>{const m=/^--(out|reference|speed-reference)=(.+)$/.exec(x);assert(m);return [m[1],m[2]];}));
assert(args.out&&path.isAbsolute(args.out)&&!fs.existsSync(args.out));assert(args.reference&&args['speed-reference']);
const sha=x=>createHash('sha256').update(x).digest('hex'),V=v=>({x:v.x,y:v.y,z:v.z}),norm=v=>Math.hypot(v.x,v.y,v.z);
const refBytes=fs.readFileSync(args.reference),ref=JSON.parse(refBytes),baseline=ref.rows[2];
assert(ref.measurementValid&&baseline.mode==='legacy'&&baseline.weapons[0]==='zweihander');
const speedBytes=fs.readFileSync(args['speed-reference']),speedRef=JSON.parse(speedBytes);assert(speedRef.measurementValid);
const scan=d=>fs.readdirSync(path.join(root,d),{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(d+'/'+e.name):e.name.endsWith('.js')?[d+'/'+e.name]:[]);
const names=[...scan('src'),'tools/sim/harness_m.mjs','tools/sim/experiments/support_handover_v2_probe.mjs','package-lock.json','node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'].sort();
const manifest=()=>Object.fromEntries(names.map(n=>[n,sha(fs.readFileSync(path.join(root,n)))]));
const before=manifest(),head=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
fs.mkdirSync(args.out,{recursive:true});
for(const n of names){const dest=path.join(args.out,'frozen',n);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,n),dest);}
const rows=[],startedUTC=new Date().toISOString(),started=performance.now(),random=Math.random;
let error=null;
const jerk=x=>{x=Math.max(0,Math.min(1,x));return x*x*x*(10+x*(-15+6*x));};
function commands(t,injured){
 let x=0,y=0,cut=false,held=false,phase='idle';
 if(injured){
  if(t>=144&&t<288){x=1;phase='side';}else if(t>=288&&t<384){x=-1;phase='reverse';}
  cut=t>=420&&t<450;held=t>=420&&t<486;
 }else{
  if(t>=240&&t<420){y=1;phase='forward';}else if(t>=420&&t<540){x=1;phase='side';}else if(t>=540&&t<660){x=-1;phase='reverse';}
  cut=t>=780&&t<810;held=t>=780&&t<846;
 }
 if(held)phase=cut?'cut':'hold';
 return {x,y,dx:cut?.4/30:0,dy:cut?-.7/30:0,held,active:cut,phase};
}
function support(G){
 const f=G.player,confirmed=collectSupportContacts(f,{detail:false}),parts={};
 for(const [name,b] of Object.entries({...f.bodies,sword:f.sword})){
  if(!b?.isValid())continue;let rawNormalNs=0,verticalNormalMagnitudeNs=0,solverPoints=0,withinSlopPoints=0,maxSlip=0;
  for(let ci=0;ci<b.numColliders();ci++)G.world.contactPairsWith(b.collider(ci),other=>{
   if(!other.parent()?.isFixed()||other.isSensor())return;
   G.world.contactPair(b.collider(ci),other,(m)=>{let imp=0;for(let i=0;i<m.numContacts();i++)imp+=m.contactImpulse(i);rawNormalNs+=imp;verticalNormalMagnitudeNs+=imp*Math.abs(m.normal().y);
    for(let i=0;i<m.numSolverContacts();i++){solverPoints++;if(m.solverContactDist(i)<=1e-4){withinSlopPoints++;const v=b.velocityAtPoint(m.solverContactPoint(i));maxSlip=Math.max(maxSlip,Math.hypot(v.x,v.z));}}
   });
  });
  parts[name]={rawNormalNs,verticalNormalMagnitudeNs,rawVerticalN:verticalNormalMagnitudeNs/DT,solverPoints,withinSlopPoints,maxSlipMps:withinSlopPoints?maxSlip:null};
 }
 const bs=[...new Map([...Object.values(f.bodies),f.sword].filter(b=>b?.isValid()&&b.isDynamic()).map(b=>[b.handle,b])).values()];
 const mass=bs.reduce((a,b)=>a+b.mass(),0),COM={x:0,y:0,z:0},P={x:0,y:0,z:0};
 for(const b of bs){const c=b.worldCom(),v=b.linvel(),m=b.mass();for(const k of ['x','y','z']){COM[k]+=m*c[k]/mass;P[k]+=m*v[k];}}
 return {parts,actualMassKg:mass,COM,momentum:P,confirmedSelectedGroups:Object.fromEntries(Object.entries(confirmed.groups).map(([k,g])=>[k,{hasSupport:g.hasSupport,touchingEnvironment:g.touchingEnvironment,rawNormalImpulseNs:g.rawNormalImpulseNs}])),limits:'Raw manifold impulses / timestep, not calibrated force balance; withinSlop solver points can be predictive/stale. Confirmed geometry limited to foot/shin/farmO groups. farmO is forearm proxy, not hand.'};
}
async function run(mode,injured,gravity=-9.81){
 CONFIG.PHYSICS.gravity=gravity;
 const entryTick=1477,end=injured?entryTick+576:960,row={mode,injured,gravity,frames:[],samples:[],steps:[],entries:[],inputs:[],prefixExact:true,wounds:[],scope:injured?'Actual natural injury prefix, then isolated opponent parking with original facing point; no injury/health edits.':'No opponent contact; parked target. Walking, side/reverse, cut/hold/release.'};rows.push(row);
 let G,tick=0,previousPad,currentInput,observedWant=null;
 const activeSteps=new Map();
 G=newRound({seed:7,weapon:'zweihander',weapon2:'longsword',walls:false,AIClass:AI,...(injured?{AI2Class:AI}:{}),onFighter:f=>{
  if(f.index!==0)return;f.onehandArmModel='manual';f.stanceMemoryModel=mode;f.balanceProbe={};
  const g=f.gait,enter=g.enter,begin=g.begin,td=g.touchdown,update=g.update;
  g.enter=function(...a){const restarted=!!this.started,old=Object.fromEntries(Object.entries(this.legs).map(([k,l])=>[k,l.Nf??null]));const z=enter.apply(this,a);row.entries.push({tick,restarted,old,new:Object.fromEntries(Object.entries(this.legs).map(([k,l])=>[k,l.Nf??null]))});return z;};
  g.begin=function(l,kind,T){const z=begin.call(this,l,kind,T),s={startTick:tick,foot:l.k,kind,requestedS:T,tilt:f.tiltDeg(),offBalance:f.offBalance,lev:this.lev,position:V(l.ankle)};row.steps.push(s);activeSteps.set(l.k,s);return z;};
  g.touchdown=function(l,speed){const s=activeSteps.get(l.k);if(s){Object.assign(s,{endTick:tick,elapsedS:(tick-s.startTick)*DT,endSoleY:l.soleY,endN:l.N??0,endPosition:V(l.ankle)});activeSteps.delete(l.k);}return td.call(this,l,speed);};
  g.update=function(dt,want,...a){const old=V(want),z=update.call(this,dt,want,...a);observedWant={before:old,after:V(want)};return z;};
 }});
 assert(applySwordsmanship(G.player));G.combat.cutReactionModel='legacy';G.combat.cutReactionFighter=null;
 if(injured){assert.equal(sha(G.world.takeSnapshot()),baseline.creationNativeSHA256);}else G.park();
 previousPad=G.player.handOffset.clone();
 G.before=()=>{
  const f=G.player;
  if(!injured||tick>=entryTick){const c=commands(injured?tick-entryTick:tick,injured);f.move.set(c.x,c.y);f.stickX=c.x;f.stickY=c.y;f.handOffset.x+=c.dx;f.handOffset.y+=c.dy;f.handHeld=c.held;f.inputActive=c.active;currentInput={id:tick,timeS:G.t,dx:c.dx,dy:c.dy,held:c.held,active:c.active};row.inputs.push({tick,...c});}
  else{const d=f.handOffset.clone().sub(previousPad);currentInput={id:tick,timeS:G.t,dx:d.x,dy:d.y,held:!!f.handHeld,active:!!f.inputActive};}
  assert(recordSwordsmanshipInput(f,currentInput));
 };
 try{
  for(tick=0;tick<end;tick++){
   if(tick%120===0)await new Promise(r=>setImmediate(r));
   if(injured&&tick===entryTick){const facing=V(G.enemy.bodies.pelvis.translation());G.ai2=null;G.park();G.faceP=facing;}
   observedWant=null;G.step();previousPad.copy(G.player.handOffset);
   const native=sha(G.world.takeSnapshot());row.frames.push(native);
   assert.equal(native,speedRef.rows[mode==='legacy'?2:3].frames[tick],`speed observer equivalence ${mode}:${tick}`);
   if(injured&&tick<entryTick){row.prefixExact&&=native===baseline.frames[tick][1];assert(row.prefixExact,`injury prefix differs at ${tick}`);}
   const f=G.player,g=f.gait;
   if(!injured||tick>=1000){
    const tip=f.bladePoint(1,new THREE.Vector3()),v=f.sword.velocityAtPoint(tip),p=f.bodies.pelvis;
    const sample={tick,timeS:G.t,phase:commands(injured?tick-entryTick:tick,injured).phase,pelvis:V(p.translation()),pelvisV:V(p.linvel()),tipSpeedMps:norm(v),swordOmega:norm(f.sword.angvel()),heading:f.heading,state:f.state,alive:f.alive,armed:f.armed,limbs:{...f.limbs},pain:f.pain,availability:f.swordsmanshipState?.availability,assistPhase:f.swordsmanshipState?.phase,legHealth:f.legHealth,tilt:f.tiltDeg(),offBalance:f.offBalance,lev:g.lev,levH:g.levH,levC:g.levC,slow:g.slow,slowFactor:1-CONFIG.GAIT.handoverSlow*jerk(g.slow||0),want:observedWant,balance:{...f.balanceProbe},groundSupport:support(G),legs:Object.fromEntries(Object.entries(g.legs).map(([k,l])=>[k,{stance:l.stance,kind:l.kind,t:l.t,T:l.T,N:l.N,Nf:l.Nf,soleY:l.soleY,ankle:V(l.ankle),target:V(l.des)}]))};
    assert([sample.tipSpeedMps,sample.pelvis.x,sample.pelvis.y,sample.pelvis.z,sample.tilt].every(Number.isFinite));row.samples.push(sample);
   }
  }
 }finally{row.wounds=G.wounds.map(w=>({timeS:w.t,victim:w.vic.index,attacker:w.att.index,zone:w.zone,type:w.type,energyJ:w.energy,severity:w.severity}));G.eventQueue.free();G.world.free();}
 row.complete=true;
 console.log(JSON.stringify({mode,injured,gravity,steps:row.frames.length,entries:row.entries,catchSteps:row.steps.filter(s=>s.kind==='catch').length}));
}
try{await run('legacy',true);await run('fresh',true);assert.deepEqual(rows[0].inputs,rows[1].inputs);}
catch(e){error={message:e.message,stack:e.stack};process.exitCode=1;}
finally{
 CONFIG.PHYSICS.gravity=-9.81;Math.random=random;
 const after=manifest(),stable=JSON.stringify(before)===JSON.stringify(after);
 const result={head,startedUTC,completedUTC:new Date().toISOString(),wallSeconds:(performance.now()-started)/1000,measurementValid:!error&&stable&&rows.length===2&&rows.every(r=>r.complete),sourceStable:stable,error,sourceBefore:before,sourceAfter:after,speedReference:{path:args['speed-reference'],bytes:speedBytes.length,sha256:sha(speedBytes)},reference:{path:args.reference,bytes:refBytes.length,sha256:sha(refBytes)},command:process.argv,protocol:{dt:DT,model:'ordinary v2-r2/manual player, legacy opponent/global support/cutting',injuryPrefixThrough:1476,isolatedBoundary:1477,observation:'Each of all2053 native snapshots must equal prior speed-probe row, zero new efficacy trajectories. All dynamic body parts and weapon ground raw impulses plus independent selected-group confirmed geometry.',limits:'120Hz step inputs, no browser frame/hitstop/emotion cadence equivalence. Parking excludes new opponent hits and is an isolation experiment, not actual post-injury combat.'},rows};
 fs.writeFileSync(path.join(args.out,'report.json'),JSON.stringify(result)+'\n');
 console.log(JSON.stringify({measurementValid:result.measurementValid,error,executions:rows.length,steps:rows.reduce((s,r)=>s+r.frames.length,0),wallSeconds:result.wallSeconds}));
 if(!result.measurementValid)process.exitCode=1;
}
