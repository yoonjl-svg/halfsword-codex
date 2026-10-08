// Same idle/release native fixture used for the compact-design comparison.
// Usage: node tools/sim/experiments/morgenstern_settle_probe.mjs /outside/fresh-directory
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {newRound,THREE,DT,handPos,V,Q} from '../harness_m.mjs';
import {LOOKS} from '../../../src/looks.js';
import {applySwordsmanship,recordSwordsmanshipInput} from '../../../src/swordsmanship.js';
import {prepareMorgensternTrial} from '../../../src/morgenstern_trial.js';
const root=fileURLToPath(new URL('../../../',import.meta.url)),out=process.argv[2];
assert(out&&path.isAbsolute(out),'Fresh absolute output directory required');
const scan=d=>fs.readdirSync(root+'/'+d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(d+'/'+e.name):e.name.endsWith('.js')?[d+'/'+e.name]:[]);
const sha=x=>createHash('sha256').update(x).digest('hex');
const hash=()=>Object.fromEntries([...scan('src'),'tools/sim/harness_m.mjs'].sort().map(n=>[n,sha(fs.readFileSync(root+'/'+n))]));
assert(!fs.existsSync(out),'Candidate fixture output already exists; do not duplicate runs');
fs.mkdirSync(out,{recursive:true});
const before=hash();
const rows=[];
const range=xs=>Math.max(...xs)-Math.min(...xs);
const vectorRange=(fs,key)=>[0,1,2].map(i=>range(fs.map(f=>f[key][i])));
const summarize=frames=>({n:frames.length,handChestP2PM:vectorRange(frames,'handChest'),forearmChestP2PM:vectorRange(frames,'forearmChest'),goalChestP2PM:vectorRange(frames,'goalChest'),goalYawP2PM:vectorRange(frames,'goalYaw'),weaponErrorDeg:{min:Math.min(...frames.map(f=>f.errorDeg)),max:Math.max(...frames.map(f=>f.errorDeg)),last:frames.at(-1).errorDeg},handErrorM:{max:Math.max(...frames.map(f=>f.handErrorM)),last:frames.at(-1).handErrorM},wristNearCap:frames.filter(f=>f.torque>=.95*f.cap).length,phases:[...new Set(frames.map(f=>f.controllerPhase))],handStepMaxM:Math.max(0,...frames.slice(1).map((f,i)=>Math.hypot(...f.handChest.map((v,k)=>v-frames[i].handChest[k]))))});
for(const condition of ['idle','diagonal-release']){
 const G=newRound({seed:7,weapon:'morgenstern',weapon2:'longsword',gap:40,walls:false,look:LOOKS.enemy,look2:LOOKS.enemy,onFighter:f=>{if(f.index===0) assert(prepareMorgensternTrial(f));}});
 // Supported harness flag suppresses enemy AI while retaining native bodies/physics.
 G.parkEnemy=true;
 const f=G.player;assert(applySwordsmanship(f));f.canShove=true;
 const frames=[];let last=[.15,.1],id=0;const tape=[];
 if(condition==='diagonal-release'){
  for(const [phase,seconds,target] of [['ready',.5,last],['prepare',.6,[-.35,.4]],['hold',.4,[-.35,.4]],['attack',.25,[.35,-.4]]]){
   const start=last.slice(),n=Math.round(seconds/DT);
   for(let i=0;i<n;i++){const next=start.map((v,k)=>v+(target[k]-v)*(i+1)/n),delta=next.map((v,k)=>v-last[k]);tape.push({phase,delta,held:true,active:Math.hypot(...delta)>1e-5});last=next;}
  }
 }
 while(tape.length<Math.round(8/DT))tape.push({phase:condition==='idle'?'idle':'released',delta:[0,0],held:false,active:false});
 let finite=true, minDistance=Infinity, input=true;
 for(const req of tape){
  f.handOffset.x+=req.delta[0];f.handOffset.y+=req.delta[1];f.handHeld=req.held;f.inputActive=req.active;f.move.set(0,0);f.stickX=f.stickY=0;
  input&&=recordSwordsmanshipInput(f,{id:id++,timeS:G.t,dx:req.delta[0],dy:req.delta[1],held:req.held,active:req.active});
  G.step();
  finite&&=G.world.bodies.getAll().every(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].every(v=>Object.values(v).every(Number.isFinite)));
  const chest=V(f.bodies.chest.translation()),chestInv=Q(f.bodies.chest.rotation()).invert(),yawInv=f.yaw.clone().invert();
  const inChest=p=>p.clone().sub(chest).applyQuaternion(chestInv).toArray(),inYaw=p=>p.clone().sub(chest).applyQuaternion(yawInv).toArray();
  const h=handPos(f),axis=new THREE.Vector3(0,1,0).applyQuaternion(Q(f.sword.rotation())),aim=f.debug.aim.clone().normalize();
  minDistance=Math.min(minDistance,V(f.bodies.pelvis.translation()).distanceTo(V(G.enemy.bodies.pelvis.translation())));
  frames.push({tick:id-1,t:G.t,inputPhase:req.phase,held:req.held,controllerPhase:f.swordsmanshipState.phase,returning:f.swordsmanshipState.returning,handChest:inChest(h),forearmChest:inChest(V(f.bodies.farmS.translation())),goalChest:inChest(f.handTarget),goalYaw:inYaw(f.handTarget),handErrorM:h.distanceTo(f.handTarget),errorDeg:Math.acos(Math.max(-1,Math.min(1,axis.dot(aim))))*180/Math.PI,torque:f.debug.wristTorque.length(),cap:f.debug.wristCap,omega:V(f.sword.angvel()).length(),pad:f.handOffset.toArray(),state:f.state});
 }
 const row={condition,head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),simSeconds:8,steps:frames.length,models:{arm:f.onehandArmModel,swordsmanship:f.swordsmanshipModel,stance:f.stanceMemoryModel,roll:f.rollTargetModel},inputSHA256:sha(JSON.stringify(tape)),checks:{finite,input,noWounds:G.wounds.length===0,noClashes:G.clashes===0,minDistance,healthy:f.alive&&f.armed&&f.wounds.length===0&&Object.values(f.limbs).every(x=>x===1)},last2s:summarize(frames.filter(x=>x.t>6)),last1s:summarize(frames.filter(x=>x.t>7)),all:summarize(frames),lastPadMovementS:frames.filter((x,i)=>i&&Math.hypot(...x.pad.map((v,k)=>v-frames[i-1].pad[k]))>1e-8).at(-1)?.t??0,frames};
 fs.writeFileSync(out+'/'+condition+'.json',JSON.stringify(row)+'\n');rows.push({...row,frames:undefined});G.eventQueue.free();G.world.free();
}
assert.deepEqual(hash(),before);
fs.writeFileSync(out+'/probe-summary.json',JSON.stringify({sourceHashes:before,sourceUnchanged:true,toolSHA256:sha(fs.readFileSync(new URL(import.meta.url))),rows},null,2)+'\n');
console.log(JSON.stringify(rows,null,2));
