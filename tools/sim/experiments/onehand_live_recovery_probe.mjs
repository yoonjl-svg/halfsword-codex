// Actual two-AI contact smoke. No injury/state/pose/velocity injection; not human input validation.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {newRound,AI,DT,THREE} from '../harness_m.mjs';
const out=process.argv[2];if(!out||fs.existsSync(out))throw Error('Use a fresh output file');
const args=Object.fromEntries(process.argv.slice(3).map(a=>{const m=/^--(weapons|seed|seconds)=(.+)$/.exec(a);if(!m)throw Error('Named weapons/seed/seconds only');return[m[1],m[2]];}));
const weapons=(args.weapons??'sabre,qinggang').split(','),seed=Number(args.seed??7),seconds=Number(args.seconds??20);
if(weapons.some(w=>!['sabre','qinggang','falchion','rapier'].includes(w))||new Set(weapons).size!==weapons.length||!Number.isSafeInteger(seed)||seed<0||!Number.isFinite(seconds)||seconds<1||seconds>30)throw Error('Invalid live probe options');
const sha=b=>createHash('sha256').update(b).digest('hex');
const scan=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(path.join(dir,e.name)):e.name.endsWith('.js')?[path.join(dir,e.name)]:[]);
const files=[...scan('src'),'tools/sim/harness_m.mjs','tools/sim/experiments/onehand_live_recovery_probe.mjs','package-lock.json','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'];
const manifest=()=>Object.fromEntries(files.sort().map(f=>[f,sha(fs.readFileSync(f))]));
const before=manifest(),head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty=execFileSync('git',['status','--porcelain'],{encoding:'utf8'}),started=performance.now(),random=Math.random,rows=[];
const worldPoint=(body,p)=>new THREE.Vector3(p.x,p.y,p.z).applyQuaternion(new THREE.Quaternion(...Object.values(body.rotation()))).add(new THREE.Vector3(...Object.values(body.translation())));
function state(f){
 let gap=0;for(const j of f.joints)if(j.joint?.isValid())gap=Math.max(gap,worldPoint(j.parent,j.joint.anchor1()).distanceTo(worldPoint(j.child,j.joint.anchor2())));
 const bodies=[...Object.values(f.bodies),f.sword];
 return {state:f.state,alive:f.alive,armed:f.armed,armHealth:f.armHealth,legHealth:f.legHealth,pain:f.pain,limbs:{...f.limbs},finishOn:f.finish.on,finishWeight:f.finish.amt,hand:f.handOffset.toArray(),aim:f.skill.aim.toArray(),held:f.handHeld??false,inputActive:f.inputActive??false,handBase:f.handBase?[...f.handBase]:null,tapDown:!!f.skill.tap?.down,tapGo:!!f.skill.tap?.go,thrusts:f.skill.thrusts,gapM:gap,armOmegaRadps:Math.max(...['uarmS','farmS'].map(k=>new THREE.Vector3(...Object.values(f.bodies[k].angvel())).length())),finite:bodies.every(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].every(v=>Object.values(v).every(Number.isFinite))),wounds:f.wounds.map(w=>({part:w.part,type:w.type,severity:w.severity}))};
}
try{for(const weapon of weapons)for(const model of ['legacy','manual']){
 let G;try{
  G=newRound({seed,walls:false,weapon,weapon2:'longsword',skill:.7,difficulty:'normal',AI2Class:AI,onFighter:f=>{f.onehandArmModel=model;}});
  const first={nativeSha256:sha(G.world.takeSnapshot()),player:state(G.player),enemy:state(G.enemy),playerSkill:G.player.skill.level,enemySkill:G.enemy.skill.level};
  const frames=[],transitions=[];let previous=[G.player.state,G.enemy.state],finite=true;
  for(let tick=0;tick<Math.round(seconds/DT);tick++){
   G.step();const p=state(G.player),e=state(G.enemy);frames.push({tick,timeS:G.t,p,e});finite&&=p.finite&&e.finite;
   for(const [i,f] of [p,e].entries())if(f.state!==previous[i]){transitions.push({timeS:G.t,fighter:i,from:previous[i],to:f.state});previous[i]=f.state;}
   if(!finite)break;
  }
  const hits=G.wounds.map(w=>({timeS:w.t,attacker:w.att.index,victim:w.vic.index,zone:w.zone,type:w.type,energyJ:w.energy,severity:w.severity}));
  const row={weapon,model,first,finite,transitions,hits,frames};rows.push(row);
  console.log(JSON.stringify({weapon,model,finite,frames:frames.length,finishFrames:frames.filter(x=>x.p.finishWeight>0).length,playerTransitions:transitions.filter(x=>x.fighter===0),enemyTransitions:transitions.filter(x=>x.fighter===1)}));
 }finally{G?.world.free();}
}}finally{Math.random=random;const after=manifest();fs.writeFileSync(out,JSON.stringify({scope:'Two original AIs, normal skill, native contact. Post-Combat samples only. Models before first step; no health/state/pose/velocity/contact/AI injection. AI commands differ after trajectories diverge; not matched human controls or naturalness acceptance.',options:{weapons,seed,seconds,dt:DT,gap:'ARENA.startGap',foeWeapon:'longsword'},sourceCommit:head,dirty,sourceBefore:before,sourceAfter:after,sourceStable:JSON.stringify(before)===JSON.stringify(after),headStable:head===execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),command:process.argv,wallSeconds:(performance.now()-started)/1000,rows},null,2)+'\n',{flag:'wx'});}
