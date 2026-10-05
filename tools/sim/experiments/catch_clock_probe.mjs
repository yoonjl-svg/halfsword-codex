/** Controlled lateral perturbation in actual game. A single 60 Ns pelvis push is
 * an imposed diagnostic, not a user/combat replay. Clock candidate affects only
 * catch target prediction; phase, lift, strength, gravity and other steps stay.
 */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {newRound,THREE,DT,CONFIG} from '../harness_m.mjs';
import {applySwordsmanship,recordSwordsmanshipInput} from '../../../src/swordsmanship.js';
const root=fileURLToPath(new URL('../../../',import.meta.url)),arg=process.argv.slice(2);
assert(arg.length===1&&arg[0].startsWith('--out='));const out=arg[0].slice(6);assert(path.isAbsolute(out)&&!fs.existsSync(out));
const sha=x=>createHash('sha256').update(x).digest('hex'),V=v=>({x:v.x,y:v.y,z:v.z}),N=v=>Math.hypot(v.x,v.y,v.z);
const scan=d=>fs.readdirSync(path.join(root,d),{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(d+'/'+e.name):e.name.endsWith('.js')?[d+'/'+e.name]:[]);
const names=[...scan('src'),'tools/sim/harness_m.mjs','tools/sim/experiments/catch_clock_probe.mjs','package-lock.json','node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'].sort();
const manifest=()=>Object.fromEntries(names.map(n=>[n,sha(fs.readFileSync(path.join(root,n)))]));const before=manifest(),head=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
fs.mkdirSync(out,{recursive:true});for(const n of names){const p=path.join(out,'frozen',n);fs.mkdirSync(path.dirname(p),{recursive:true});fs.copyFileSync(path.join(root,n),p);}
const rows=[],start=performance.now(),startedUTC=new Date().toISOString(),rand=Math.random;let error=null;
async function run(sign,mode){
 let tick=0,stepId=0;const row={sign,mode,frames:[],samples:[],targets:[],steps:[],inputs:[]};rows.push(row);const active=new Map();
 const G=newRound({seed:7,weapon:'zweihander',weapon2:'longsword',walls:false,onFighter:f=>{if(f.index!==0)return;f.onehandArmModel='manual';f.stanceMemoryModel='fresh';f.balanceProbe={};const g=f.gait,target=g.target,begin=g.begin,td=g.touchdown;
  g.begin=function(l,kind,T){const z=begin.call(this,l,kind,T),s={id:stepId++,foot:l.k,kind,startTick:tick,T,ankle:V(l.ankle),pelvis:V(f.bodies.pelvis.translation()),heading:f.heading,offBalance:f.offBalance,tilt:f.tiltDeg()};row.steps.push(s);active.set(l.k,s);return z;};
  g.target=function(l,w,fw,rt,remain){const rate=1+CONFIG.GAIT.catchHurry*THREE.MathUtils.clamp((f.offBalance-CONFIG.GAIT.hurryFrom)/.2,0,1),used=mode==='clock'&&l.kind==='catch'?remain/rate:remain;const z=target.call(this,l,w,fw,rt,used);if(tick>=360&&l.kind==='catch')row.targets.push({tick,foot:l.k,kind:l.kind,remain,used,rate,offBalance:f.offBalance,p1:V(l.p1),vf:V(this.vf)});return z;};
  g.touchdown=function(l,speed){const s=active.get(l.k);if(s){Object.assign(s,{controllerEndTick:tick,controllerSeconds:(tick-s.startTick)*DT,endAnkle:V(l.ankle),soleY:l.soleY,cachedN:l.N??0});active.delete(l.k);}return td.call(this,l,speed);};
 }});assert(applySwordsmanship(G.player));G.combat.cutReactionModel='legacy';G.combat.cutReactionFighter=null;G.park();
 G.before=()=>{const f=G.player;const active=tick>=720&&tick<750,held=tick>=720&&tick<786,dx=active?.4/30:0,dy=active?-.7/30:0;f.move.set(0,0);f.handOffset.x+=dx;f.handOffset.y+=dy;f.handHeld=held;f.inputActive=active;const input={id:tick,timeS:G.t,dx,dy,held,active};assert(recordSwordsmanshipInput(f,input));row.inputs.push(input);
 if(tick===360){const r=f.right(new THREE.Vector3()).multiplyScalar(sign*60);f.bodies.pelvis.applyImpulse(V(r),true);row.imposedImpulseNs=V(r);}
 };
 try{for(tick=0;tick<900;tick++){if(tick%120===0)await new Promise(r=>setImmediate(r));G.step();row.frames.push(sha(G.world.takeSnapshot()));const f=G.player,g=f.gait,p=f.bodies.pelvis,tip=f.bladePoint(1,new THREE.Vector3());
 const gaps=f.joints.map(j=>new THREE.Vector3().copy(j.joint.anchor1()).applyQuaternion(new THREE.Quaternion().copy(j.parent.rotation())).add(new THREE.Vector3().copy(j.parent.translation())).distanceTo(new THREE.Vector3().copy(j.joint.anchor2()).applyQuaternion(new THREE.Quaternion().copy(j.child.rotation())).add(new THREE.Vector3().copy(j.child.translation()))));
 const s={tick,state:f.state,alive:f.alive,armed:f.armed,pelvis:V(p.translation()),velocity:V(p.linvel()),heading:f.heading,tilt:f.tiltDeg(),offBalance:f.offBalance,levH:g.levH,levC:g.levC,lev:g.lev,tipSpeed:N(f.sword.velocityAtPoint(tip)),swordOmega:N(f.sword.angvel()),maxJointGap:Math.max(...gaps),balance:{...f.balanceProbe},legs:{}};
 for(const[k,l]of Object.entries(g.legs)){let rawImpulseNs=0,points=0,slipMax=0;const b=f.bodies['foot'+k];for(let i=0;i<b.numColliders();i++)G.world.contactPairsWith(b.collider(i),other=>{if(!other.parent()?.isFixed())return;G.world.contactPair(b.collider(i),other,m=>{for(let j=0;j<m.numContacts();j++)rawImpulseNs+=m.contactImpulse(j)*Math.abs(m.normal().y);for(let j=0;j<m.numSolverContacts();j++)if(m.solverContactDist(j)<=1e-4){points++;const v=b.velocityAtPoint(m.solverContactPoint(j));slipMax=Math.max(slipMax,Math.hypot(v.x,v.z));}});});s.legs[k]={stance:l.stance,kind:l.kind,t:l.t,T:l.T,N:l.N,Nf:l.Nf,soleY:l.soleY,ankle:V(l.ankle),target:V(l.des),rawImpulseNs,points,slipMax:points?slipMax:null};}
 assert([s.tilt,s.pelvis.x,s.pelvis.y,s.pelvis.z,s.tipSpeed,s.maxJointGap].every(Number.isFinite));row.samples.push(s);
 }}finally{row.wounds=G.wounds.map(w=>({timeS:w.t,victim:w.vic.index,zone:w.zone,type:w.type,severity:w.severity}));G.eventQueue.free();G.world.free();}
 row.complete=true;console.log(JSON.stringify({sign,mode,steps:row.frames.length,catches:row.targets.length,exposed:row.targets.filter(t=>t.rate>1).length}));
}
try{for(const sign of [-1,1]){await run(sign,'legacy');await run(sign,'clock');const a=rows.at(-2),b=rows.at(-1);assert.deepEqual(a.inputs,b.inputs);for(let i=0;i<360;i++)assert.equal(a.frames[i],b.frames[i],`prefix${sign}:${i}`);}}
catch(e){error={message:e.message,stack:e.stack};process.exitCode=1;}
finally{Math.random=rand;const after=manifest(),stable=JSON.stringify(before)===JSON.stringify(after),report={head,startedUTC,completedUTC:new Date().toISOString(),wallSeconds:(performance.now()-start)/1000,sourceBefore:before,sourceAfter:after,sourceStable:stable,command:process.argv,error,measurementValid:!error&&stable&&rows.length===4&&rows.every(r=>r.complete),protocol:{dt:DT,pushTick:360,pelvisImpulseMagnitudeNs:60,axes:'body right at impulse boundary, sign -1/+1',scope:'Controlled non-contact perturbation, not natural fight or exact user-sidefall reproduction',candidate:'Only catch target horizon divided by current catch phase clock rate. Does not change T, t increment, gravity, muscle, external lift, walk/req.',flags:'same default v2-r2, fresh reentry player, ordinary opponent/support/cutting',limits:'Current-rate frozen prediction, not true future contact time. Raw contact impulse/timestep not calibrated. Geometric solver points distinct from controller touchdown.'},rows};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report)+'\n');console.log(JSON.stringify({measurementValid:report.measurementValid,error,wallSeconds:report.wallSeconds}));if(!report.measurementValid)process.exitCode=1;}
