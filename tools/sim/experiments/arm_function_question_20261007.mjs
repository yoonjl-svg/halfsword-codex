import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=process.argv[2],out=process.argv[3];assert(path.isAbsolute(root)&&path.isAbsolute(out)&&!fs.existsSync(out));
const {newRound,THREE,DT,CONFIG}=await import(path.join(root,'tools/sim/harness_m.mjs'));
const {configureCombatDefaults}=await import(path.join(root,'src/combat_defaults.js'));
const {configureSwordsmanshipDefault}=await import(path.join(root,'src/swordsmanship_default.js'));
const {applySwordsmanship,recordSwordsmanshipInput}=await import(path.join(root,'src/swordsmanship.js'));
const {mainArmMuscle}=await import(path.join(root,'src/arm_recovery_activation.js'));
const {WEAPON_LIST}=await import(path.join(root,'src/weapons.js'));
const {classifyWeapon}=await import(path.join(root,'src/weapon_class.js'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const names=fs.readdirSync(path.join(root,'src')).filter(n=>n.endsWith('.js')).map(n=>'src/'+n).concat('tools/sim/harness_m.mjs','package-lock.json');
const manifest=()=>Object.fromEntries(names.map(n=>[n,sha(fs.readFileSync(path.join(root,n)))]));
const sourceBefore=manifest();fs.mkdirSync(out,{recursive:true});
for(const n of names){const dest=path.join(out,'source',n);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,n),dest);}
CONFIG.COMBAT.limbSeverTrial=true;
const entry=configureSwordsmanshipDefault(new URLSearchParams());
const schedule=[['prefix',300,[0,0],true],['postConditionHold',60,[0,0],true],['raise',48,[-.28,.38],true],['raisedHold',24,[0,0],true],['firstCut',30,[.56,-.76],true],['followHold',36,[0,0],true],['reverse',36,[-.38,.66],true],['reverseHold',24,[0,0],true],['recut',30,[.40,-.70],true],['recutHold',36,[0,0],true],['release',120,[0,0],false]];
const tape=schedule.flatMap(([phase,n,d,held])=>Array.from({length:n},()=>({phase,dx:d[0]/n,dy:d[1]/n,held})));
const norm=v=>Math.hypot(v.x,v.y,v.z),V=v=>new THREE.Vector3(v.x,v.y,v.z),Q=q=>new THREE.Quaternion(q.x,q.y,q.z,q.w),mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
function kinetic(b){const w=V(b.angvel()).applyQuaternion(Q(b.rotation()).invert()).applyQuaternion(Q(b.principalInertiaLocalFrame()).invert()),I=b.principalInertia();return .5*b.mass()*norm(b.linvel())**2+.5*(I.x*w.x*w.x+I.y*w.y*w.y+I.z*w.z*w.z);}
class Idle {update(){}}
const rows=[],prefixes={},startedUTC=new Date().toISOString(),start=performance.now();
for(const weapon of ['longsword','zweihander'])for(const condition of ['healthy','off_arm_20pct','main_arm_20pct']){
 const G=newRound({seed:7,weapon,weapon2:'longsword',walls:false,gap:5.6,AIClass:Idle,onFighter:f=>{if(f.index===0){f.onehandArmModel='manual';const p=configureCombatDefaults(entry,f.weapon);f.stanceMemoryModel=p.stance;f.rollTargetModel=p.roll;}}});
 const f=G.player;assert(applySwordsmanship(f));f.canShove=true;const policy=configureCombatDefaults(entry,f.weapon);G.combat.cutReactionModel=policy.cut;G.combat.cutReactionFighter=f;
 let tick=0,offForce=0,insideOff=false;const origOff=f.offHand,origForce=f.sword.addForceAtPoint;
 f.offHand=function(...args){insideOff=true;try{return origOff.apply(this,args);}finally{insideOff=false;}};
 f.sword.addForceAtPoint=function(F,...args){if(insideOff)offForce+=norm(F);return origForce.call(this,F,...args);};
 const trace=[],prefix=createHash('sha256'),requests=createHash('sha256');let finite=true,accepted=true;
 G.before=()=>{const r=tape[tick];offForce=0;if(tick===300){if(condition==='off_arm_20pct')f.limbs.armO=.2;if(condition==='main_arm_20pct')f.limbs.armS=.2;}f.handOffset.x+=r.dx;f.handOffset.y+=r.dy;f.handHeld=r.held;f.inputActive=Math.abs(r.dx)+Math.abs(r.dy)>1e-5;f.move.set(0,0);f.stickX=f.stickY=0;const input={id:tick,timeS:G.t,dx:r.dx,dy:r.dy,held:r.held,active:f.inputActive};accepted&&=recordSwordsmanshipInput(f,input);requests.update(JSON.stringify(input));};
 for(tick=0;tick<tape.length;tick++){G.step();if(tick<300)prefix.update(G.world.takeSnapshot());finite&&=G.world.bodies.getAll().every(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].every(v=>Object.values(v).every(Number.isFinite)));trace.push({tick,phase:tape[tick].phase,tipSpeedMps:norm(f.sword.velocityAtPoint(f.bladePoint(1,new THREE.Vector3()))),swordKJ:kinetic(f.sword),offForceN:offForce,gripping:!!f.gripping,wristCapNm:f.debug.wristCap,baseWristCapNm:f.weaponCfg.maxAimTorque*f.strength*mainArmMuscle(f)*(.35+.65*f.armHealth),armS:f.limbs.armS,armO:f.limbs.armO,state:f.state,alive:f.alive,armed:f.armed,pain:f.pain,blood:f.blood});}
 const file=path.join(out,weapon+'-'+condition+'.jsonl');fs.writeFileSync(file,trace.map(x=>JSON.stringify(x)).join('\n')+'\n',{flag:'wx'});
 const row={weapon,condition,steps:trace.length,prefixSHA256:prefix.digest('hex'),inputSHA256:requests.digest('hex'),finite,accepted,wounds:G.wounds.length,allAliveArmed:trace.every(x=>x.alive&&x.armed),states:[...new Set(trace.map(x=>x.state))],phases:Object.fromEntries(schedule.filter(x=>x[0]!=='prefix').map(([p])=>{const t=trace.filter(x=>x.phase===p);return[p,{steps:t.length,tipMax:Math.max(...t.map(x=>x.tipSpeedMps)),tipMean:mean(t.map(x=>x.tipSpeedMps)),energyMean:mean(t.map(x=>x.swordKJ)),gripSteps:t.filter(x=>x.gripping).length,offForceMean:mean(t.map(x=>x.offForceN)),baseWristCapMean:mean(t.map(x=>x.baseWristCapNm))}];})),raw:{path:file,bytes:fs.statSync(file).size,sha256:sha(fs.readFileSync(file))}};
 if(condition==='healthy')prefixes[weapon]=row;else assert(row.prefixSHA256===prefixes[weapon].prefixSHA256&&row.inputSHA256===prefixes[weapon].inputSHA256);
 assert(finite&&accepted);rows.push(row);console.log(JSON.stringify(row));G.eventQueue.free();G.world.free();
}
const report={head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),startedUTC,finishedUTC:new Date().toISOString(),wallSeconds:(performance.now()-start)/1000,protocol:'Controlled limb-function sensitivity probe. At tick300 set only armO or armS function to0.2; no wound/pain/blood/body/velocity injection. Not natural injury or damage/contact balance measurement. Idle distant foe, no movement, ordinary v2/common defaults/limbON/gravity9.81; same authored hand tape.',schedule,command:process.argv,sourceBefore,sourceAfter:manifest(),sourceStable:JSON.stringify(sourceBefore)===JSON.stringify(manifest()),rows,weaponSpecs:WEAPON_LIST.filter(w=>['longsword','zweihander','sabre','rapier','qinggang','falchion'].includes(w.id)).map(w=>({id:w.id,grip:w.grip,maxAimTorque:w.controlOverrides.maxAimTorque,power:w.power,mCut:w.mCut,mThrust:w.mThrust,moveMul:w.moveMul??1,...classifyWeapon(w)}))};
assert(report.sourceStable);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
