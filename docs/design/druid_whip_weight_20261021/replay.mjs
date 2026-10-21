import fs from 'node:fs';import {newRound,DT,CONFIG,THREE} from '../../../tools/sim/harness_m.mjs';import {WEAPONS} from '../../../src/weapons.js';
CONFIG.ARENA.startHold=0;class Quiet{update(){}}
const data=JSON.parse(fs.readFileSync(new URL('./mass-only-touch.json',import.meta.url))),old=JSON.parse(fs.readFileSync(new URL('./old-parts.json',import.meta.url))),w=WEAPONS.druid_whip,finalParts=w.buildParts,rows=[];
for(const profile of [{name:'old',damp:1.3,bend:.035},...[1.3,.5,.15].flatMap(damp=>[.035,.10,.25].map(bend=>({name:`new-${damp}-${bend}`,damp,bend})))])for(const gesture of ['down','cross']){
 w.buildParts=profile.name==='old'?()=>structuredClone(old):finalParts;
 const g=newRound({weapon:'druid_whip',weapon2:'tree_branch',gap:1.3,seed:11,AIClass:Quiet});g.park();const f=g.player,samples=data.find(r=>r.variant==='before'&&r.gesture===gesture).samples;
 for(const s of f.flexWeapon.segments)s.body.setAngularDamping(profile.damp);
 const orig=f.flexWeapon.step;f.flexWeapon.step=dt=>{orig(dt);for(let i=0;i<8;i++){const child=f.flexWeapon.segments[i].body,parent=i?f.flexWeapon.segments[i-1].body:f.sword;const a=new THREE.Vector3(0,1,0).applyQuaternion(new THREE.Quaternion().copy(parent.rotation())),b=new THREE.Vector3(0,1,0).applyQuaternion(new THREE.Quaternion().copy(child.rotation()));const t=b.cross(a).multiplyScalar((profile.bend-.035)*(1-i/10));child.addTorque(t,true);parent.addTorque({x:-t.x,y:-t.y,z:-t.z},true)}};
 g.before=t=>{let x=.18,y=-.28;if(t>=.5&&t<.66){const u=(t-.5)/.16;x=.18-.06*u;y=-.28+.84*u;f.inputActive=true}else if(t>=.66&&t<1.06){const u=(t-.66)/.4;x=.12;y=.56+u*(samples[0].hand[1]-.56);f.inputActive=false}else if(t>=1.06){const u=Math.min(39,(t-1.06)/.032),i=Math.min(38,Math.floor(u)),k=u-i;x=samples[i].hand[0]*(1-k)+samples[i+1].hand[0]*k;y=samples[i].hand[1]*(1-k)+samples[i+1].hand[1]*k;f.inputActive=u<11;}f.handOffset.set(x,y)};
 let maxForward=0,bandTime=0,maxSpeed=0,torsoForward=0;
 for(let i=0;i<2.35/DT;i++){g.step();if(g.t<1.06)continue;const p=f.bladePoint(1).clone(),c=new THREE.Vector3().copy(f.bodies.chest.translation());const rel=p.clone().sub(c).applyQuaternion(f.yaw.clone().invert());maxSpeed=Math.max(maxSpeed,f.tipVel.length());if(p.y>.45)maxForward=Math.max(maxForward,rel.x);if(p.y>.85&&p.y<1.8){torsoForward=Math.max(torsoForward,rel.x);if(rel.x>.7)bandTime+=DT}}
 rows.push({...profile,gesture,maxForward,torsoForward,bandTime,maxSpeed});g.world.free();
}
w.buildParts=finalParts;fs.writeFileSync(new URL('./replay.json',import.meta.url),JSON.stringify(rows,null,2));for(const r of rows)console.log(r.name,r.gesture,r.maxForward.toFixed(2),r.torsoForward.toFixed(2),r.bandTime.toFixed(2),r.maxSpeed.toFixed(1));
