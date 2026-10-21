import fs from 'node:fs';
import {newRound,DT,CONFIG,THREE} from '../../../tools/sim/harness_m.mjs';
import {WEAPONS} from '../../../src/weapons.js';
CONFIG.ARENA.startHold=0;class Quiet{update(){}}
const w=WEAPONS.druid_whip,original=w.buildParts,parts=original({});
// Preserve the old parts in the report: comparisons remain reproducible after tuning.
const oldParts=fs.existsSync(new URL('./old-parts.json',import.meta.url))?JSON.parse(fs.readFileSync(new URL('./old-parts.json',import.meta.url))):parts;
fs.writeFileSync(new URL('./old-parts.json',import.meta.url),JSON.stringify(oldParts,null,2));
w.fragile=false;const rows=[];
for(const extra of [0,.12,.24,.36])for(const gesture of ['horizontal','diagonal','vertical'])for(const duration of [.25,.5]){
 w.buildParts=()=>oldParts.map((p,i)=>{p=structuredClone(p);if(i>=8){const add=extra*(i===8?.25:.75),m=p[2][0];p[2][0]+=add;p[2][2]*=p[2][0]/m;p[2][3]*=p[2][0]/m;}return p});
 const g=newRound({weapon:'druid_whip',weapon2:'tree_branch',gap:1.3,seed:11,AIClass:Quiet});g.park();const f=g.player;
 const from=gesture==='horizontal'?[-.6,.25]:gesture==='diagonal'?[-.5,.65]:[.1,.65],to=gesture==='horizontal'?[.6,.25]:gesture==='diagonal'?[.5,-.55]:[.1,-.55];
 let maxForward=0,maxSpeed=0,maxSpan=0,aboveGroundFrames=0,maxGap=0;
 g.before=t=>{const u=Math.max(0,Math.min(1,(t-1)/duration));f.handOffset.set(from[0]+u*(to[0]-from[0]),from[1]+u*(to[1]-from[1]));f.inputActive=t>=1&&t<1+duration};
 for(let i=0;i<2.5/DT;i++){g.step();if(g.t<1)continue;const tip=f.bladePoint(1).clone(),root=new THREE.Vector3().copy(f.sword.translation()),chest=new THREE.Vector3().copy(f.bodies.chest.translation());
 const rel=tip.clone().sub(chest).applyQuaternion(f.yaw.clone().invert());if(tip.y>.45){maxForward=Math.max(maxForward,rel.x);aboveGroundFrames++}maxSpan=Math.max(maxSpan,Math.hypot(tip.x-root.x,tip.z-root.z));maxSpeed=Math.max(maxSpeed,f.tipVel.length());
 for(let j=0;j<8;j++){const rb=f.flexWeapon.segments[j].body,prev=j?f.flexWeapon.segments[j-1].body:f.sword;const a=new THREE.Vector3(0,-.09,0).applyQuaternion(new THREE.Quaternion().copy(rb.rotation())).add(new THREE.Vector3().copy(rb.translation()));const b=new THREE.Vector3(0,j?.09:.13,0).applyQuaternion(new THREE.Quaternion().copy(prev.rotation())).add(new THREE.Vector3().copy(prev.translation()));maxGap=Math.max(maxGap,a.distanceTo(b));}}
 rows.push({extra,gesture,duration,maxForward,maxSpan,maxSpeed,aboveGroundTime:aboveGroundFrames*DT,maxGap});g.world.free();
}
w.buildParts=original;
fs.writeFileSync(new URL('./compare.json',import.meta.url),JSON.stringify({scope:'24 scripted player hand sweeps; no AI; unbreakable in all groups. Forward reach counts tip above 45 cm, not hit chance.',rows},null,2));
for(const extra of [0,.12,.24,.36]){const a=rows.filter(r=>r.extra===extra),avg=k=>a.reduce((s,r)=>s+r[k],0)/a.length;console.log(JSON.stringify({extra,forward:avg('maxForward'),span:avg('maxSpan'),speed:avg('maxSpeed'),aboveGround:avg('aboveGroundTime'),maxGap:Math.max(...a.map(r=>r.maxGap))}));}
