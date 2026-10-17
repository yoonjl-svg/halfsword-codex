// Compare the observed blade's short projected sweep against existing guard commands.
import * as THREE from 'three';
import {TRADITIONS} from '../../src/schools.js';
import {segDist} from '../../src/skill.js';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
export function interceptLine(me,s,c,prior){
 const speed=Math.max(Math.hypot(s.tvx,s.tvy,s.tvz),Math.hypot(s.mvx,s.mvy,s.mvz));
 if(speed<1)return {line:null,reason:'slow'};
 const body0=V(c.x,c.y-1.15,c.z),body1=V(c.x,c.y+.6,c.z);
 const sweep=[];let danger=false;
 for(let t=0;t<=.24001;t+=.02){
  const tip=V(s.tx+s.tvx*t,s.ty+s.tvy*t,s.tz+s.tvz*t);
  const mid=V(s.mx+s.mvx*t,s.my+s.mvy*t,s.mz+s.mvz*t);
  const root=tip.clone().addScaledVector(mid.clone().sub(tip),.8/.3);
  if(segDist(root,tip,body0,body1)<.45)danger=true;
  sweep.push({t,root,tip});
 }
 if(!danger)return {line:null,reason:'miss'};
 const tr=TRADITIONS.chinese,rows=[];
 for(const line of ['highL','highR','highC','lowL','lowR','thrust']){
  const h=V(0,0,0),d=V(0,0,0),cv=tr.parryCover[line];
  if(cv){h.fromArray(cv.hand);const el=cv.blade[0]*Math.PI/180,az=cv.blade[1]*Math.PI/180;d.set(Math.cos(el)*Math.cos(az),Math.sin(el),Math.cos(el)*Math.sin(az));}
  else me.strokeCommand(...me.swordArt.school.parry[line],h,d);
  h.applyQuaternion(me.yaw).add(V(c.x,c.y,c.z));d.applyQuaternion(me.yaw);
  const a=h.clone().addScaledVector(d,me.weaponCfg.hiltLength),b=a.clone().addScaledVector(d,me.weaponCfg.bladeLength);
  let distance=Infinity,time=0;
  for(const f of sweep){const dist=segDist(a,b,f.root,f.tip);if(dist<distance){distance=dist;time=f.t;}}
  const move=h.distanceTo(me.handTarget);
  const score=distance+.15*move-(line === prior ? .08 : 0);
  rows.push({line,distance,move,score,time});
 }
 rows.sort((a,b)=>a.score-b.score);
 return {line:rows[0].distance<.3?rows[0].line:null,reason:'sweep-fit',rows};
}
