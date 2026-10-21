import fs from 'node:fs';import {newRound,DT,CONFIG,THREE} from '../../../tools/sim/harness_m.mjs';
CONFIG.ARENA.startHold=0;class Quiet{update(){}}
const rows=[];
for(const mode of ['before','free','free-bend'])for(const gesture of ['cross','down','diagonal']){
 const g=newRound({weapon:'druid_whip',weapon2:'tree_branch',seed:13,gap:1.3,AIClass:Quiet});g.park();const f=g.player,flex=f.flexWeapon;
 for(const s of flex.segments)s.col.setCollisionGroups(mode==='before'?s.col.collisionGroups()|256:s.col.collisionGroups()&~256);
 flex.step=dt=>{for(let i=0;i<8;i++){const child=flex.segments[i].body,parent=i?flex.segments[i-1].body:f.sword;const a=new THREE.Vector3(0,1,0).applyQuaternion(new THREE.Quaternion().copy(parent.rotation())),b=new THREE.Vector3(0,1,0).applyQuaternion(new THREE.Quaternion().copy(child.rotation()));const dot=a.dot(b),extra=mode==='free-bend'?(i<2?.08:.025)+Math.max(0,.5-dot)*.12:0;const t=b.cross(a).multiplyScalar(.035*(1-i/10)+extra);child.addTorque(t,true);parent.addTorque({x:-t.x,y:-t.y,z:-t.z},true);}};
 const strokes=Array.from({length:8},()=>({reach:0,torsoReach:0,span:0,bodyContactTime:0,foldTime:0,postSpan:[],maxSpeed:0}));
 g.before=t=>{const cycle=t%1.6;let from,to;if(gesture==='cross'){from=[-.6,.25];to=[.6,.25]}else if(gesture==='down'){from=[.1,.65];to=[.1,-.55]}else{from=[-.5,.65];to=[.5,-.5]}
 let p;if(cycle<.3){const u=cycle/.3;p=[to[0]+u*(from[0]-to[0]),to[1]+u*(from[1]-to[1])];}else if(cycle<.55){p=from}else{const u=Math.min(1,(cycle-.55)/.32);p=[from[0]+u*(to[0]-from[0]),from[1]+u*(to[1]-from[1])];}f.handOffset.set(...p);f.inputActive=cycle<.3||(cycle>=.55&&cycle<.87);};
 for(let i=0;i<12.8/DT;i++){g.step();const t=g.t-DT,j=Math.min(7,Math.floor(t/1.6)),phase=t%1.6,r=strokes[j],tip=f.bladePoint(1).clone(),hand=new THREE.Vector3().copy(f.sword.translation()),rel=tip.clone().sub(new THREE.Vector3().copy(f.bodies.chest.translation())).applyQuaternion(f.yaw.clone().invert()),span=tip.distanceTo(hand);let contact=false;
 for(const s of flex.segments)g.world.contactPairsWith(s.col,c=>{const info=f.colliderInfo.get(c.handle);if(info?.fighter===f&&info.kind!=='weapon')g.world.contactPair(s.col,c,m=>{if(m.numSolverContacts()>0)contact=true})});
 if(phase>=.55){r.span=Math.max(r.span,span);if(tip.y>.45)r.reach=Math.max(r.reach,rel.x);if(tip.y>.85&&tip.y<1.8)r.torsoReach=Math.max(r.torsoReach,rel.x);if(contact)r.bodyContactTime+=DT;if(span<.6)r.foldTime+=DT;r.maxSpeed=Math.max(r.maxSpeed,f.tipVel.length());}if(phase>1.2)r.postSpan.push(span);
 }
 const mean=k=>strokes.slice(1).reduce((a,r)=>a+(typeof r[k]==='number'?r[k]:r[k].reduce((a,b)=>a+b,0)/r[k].length),0)/7;
 rows.push({mode,gesture,strokes,repeatReach:mean('reach'),repeatTorso:mean('torsoReach'),contactTime:mean('bodyContactTime'),foldTime:mean('foldTime'),postSpan:mean('postSpan')});g.world.free();
}
fs.writeFileSync(new URL('./repeat.json',import.meta.url),JSON.stringify(rows,null,2));for(const{strokes,...r}of rows)console.log(JSON.stringify(r));
