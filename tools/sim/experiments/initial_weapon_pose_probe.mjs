// First1.9s of the actual game Fighter/Skill/native engine; no player input or injected poses.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {newRound,DT,THREE,CONFIG} from '../harness_m.mjs';
import {WEAPONS,WEAPON_LIST,TRIAL_WEAPON_LIST,WEAPON_ALIASES} from '../../../src/weapons.js';
const out=process.argv[2];if(!out||fs.existsSync(out))throw Error('Use a fresh output');
const hash=b=>createHash('sha256').update(b).digest('hex');
const scan=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(path.join(d,e.name)):e.name.endsWith('.js')?[path.join(d,e.name)]:[]);
const files=[...scan('src'),'tools/sim/harness_m.mjs','tools/sim/experiments/initial_weapon_pose_probe.mjs','package-lock.json','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'];
const manifest=()=>Object.fromEntries(files.sort().map(f=>[f,hash(fs.readFileSync(f))]));
const before=manifest(),head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty=execFileSync('git',['status','--porcelain'],{encoding:'utf8'}),started=performance.now(),random=Math.random,rows=[];
const v=o=>new THREE.Vector3(o.x,o.y,o.z),q=o=>new THREE.Quaternion(o.x,o.y,o.z,o.w),point=(b,p)=>v(p).applyQuaternion(q(b.rotation())).add(v(b.translation()));
const angle=d=>Math.asin(Math.max(-1,Math.min(1,d.y)))*180/Math.PI;
function read(f){
 const blade=new THREE.Vector3(0,1,0).applyQuaternion(q(f.sword.rotation())),base=v(f.sword.translation()),tip=base.clone().addScaledVector(blade,f.weaponCfg.hiltLength+f.weaponCfg.bladeLength);
 let gap=0;for(const j of f.joints)if(j.joint?.isValid())gap=Math.max(gap,point(j.parent,j.joint.anchor1()).distanceTo(point(j.child,j.joint.anchor2())));
 return {pad:f.handOffset.toArray(),aimPad:f.skill.aim.toArray(),targetElevationDeg:angle(f.aimDirW),actualElevationDeg:angle(blade),aimErrorRad:blade.angleTo(f.aimDirW),tipHeightM:tip.y,hiltHeightM:base.y,handBase:f.handBase??null,guard:f.guardPose.nearest,state:f.state,armed:f.armed,wounds:f.wounds.length,finite:[...Object.values(f.bodies),f.sword].every(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].every(x=>Object.values(x).every(Number.isFinite))),jointGapMaxM:gap};
}
const jobs=[...Object.keys(WEAPONS).map(weapon=>({weapon,model:'legacy',skill:.7})),...Object.values(WEAPONS).filter(w=>w.oneHandStance).map(w=>({weapon:w.id,model:'manual',skill:0})),...['qinggang','sabre','rapier'].map(weapon=>({weapon,model:'legacy',skill:0}))];
try{for(const job of jobs){let G;try{
 G=newRound({seed:7,weapon:job.weapon,weapon2:'longsword',skill:job.skill,difficulty:'normal',walls:false,onFighter:f=>{f.onehandArmModel=job.model;}});G.player.skill.autoGuard=true;
 const frames=[],trace=createHash('sha256'),initialNativeSHA=hash(G.world.takeSnapshot());
 for(let tick=0;tick<Math.round(1.9/DT);tick++){G.step();const r=read(G.player);frames.push({timeS:G.t,...r});trace.update(JSON.stringify([Object.values(G.player.bodies).map(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()]),G.player.sword.translation(),G.player.sword.rotation()]));}
 const row={...job,twoHand:G.player.weaponCfg.twoHand,oneHandStance:!!G.player.weaponCfg.oneHandStance,gun:!!G.player.weapon.gun,initialNativeSHA,nativeTraceSHA:trace.digest('hex'),frames};rows.push(row);
 console.log(JSON.stringify({...job,targetDeg:+frames.at(-1).targetElevationDeg.toFixed(2),actualDeg:+frames.at(-1).actualElevationDeg.toFixed(2),minTipM:+Math.min(...frames.map(f=>f.tipHeightM)).toFixed(3),finite:frames.every(f=>f.finite),wounds:frames.at(-1).wounds}));
 }finally{G?.world.free();}}}finally{Math.random=random;const after=manifest();fs.writeFileSync(out,JSON.stringify({sourceCommit:head,dirty,sourceBefore:before,sourceAfter:after,sourceStable:JSON.stringify(before)===JSON.stringify(after),command:process.argv,wallSeconds:(performance.now()-started)/1000,scope:'Actual player passive+original reactive enemy AI, first1.9s of start feet hold; Game startup initializer active for optional manual one-hand player; unchanged legacy/two-hand/gun native setup. No player AI/injury/force/pose/velocity injection. Not a historical fencing stance certificate.',settings:{dt:DT,seed:7,seconds:1.9,startHold:CONFIG.ARENA.startHold,gap:CONFIG.ARENA.startGap,autoGuard:true,foeWeapon:'longsword'},weapons:{general:WEAPON_LIST.map(w=>w.id),trial:TRIAL_WEAPON_LIST.map(w=>w.id),aliases:WEAPON_ALIASES},rows},null,2)+'\n',{flag:'wx'});}
