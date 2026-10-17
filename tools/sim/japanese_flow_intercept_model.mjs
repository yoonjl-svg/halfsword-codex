// Local follow-up only: forecast actual rigid blade segment against current body
// colliders. Constant instantaneous angular/linear velocity is an approximation,
// not a replay of future commands. No AI phase or attack timeout feeds detection.
import * as THREE from 'three';
import {FLOW_POSES} from './japanese_flow_redesign_poses.mjs';
const V=x=>new THREE.Vector3().copy(x),clamp=THREE.MathUtils.clamp;
const handPos=f=>new THREE.Vector3(.13,0,0).applyQuaternion(f.bodies.farmS.rotation()).add(f.bodies.farmS.translation());
const PARTS=['head','chest','uarmS','farmS'];
const closest=(p,a,b)=>{const ab=b.clone().sub(a),u=clamp(p.clone().sub(a).dot(ab)/Math.max(1e-9,ab.lengthSq()),0,1);return {u,p:a.clone().addScaledVector(ab,u)};};
export function forecastBlade(D,O,horizon=.36){
 const rb=O.sword,a=O.bladePoint(0,new THREE.Vector3()),b=O.bladePoint(1,new THREE.Vector3()),com=V(rb.worldCom()),vel=V(rb.linvel()),omega=V(rb.angvel()),w=omega.length(),axis=w>1e-7?omega.clone().divideScalar(w):new THREE.Vector3(0,1,0);
 const at=t=>({a:a.clone().sub(com).applyAxisAngle(axis,w*t).add(com).addScaledVector(vel,t),b:b.clone().sub(com).applyAxisAngle(axis,w*t).add(com).addScaledVector(vel,t)});
 const chest=V(D.bodies.chest.translation()),right=D.right(new THREE.Vector3()),current={};let best=null,minNow=Infinity;
 for(const name of PARTS){
  const body=D.bodies[name],col=body.collider(0),center=V(body.translation()),bv=V(body.linvel());
  const n=closest(center,a,b),near=col.projectPoint(n.p,true),now=near.isInside?0:n.p.distanceTo(near.point);minNow=Math.min(minNow,now);current[name]={gap:now,center:center.toArray()};
  for(let j=1;j<=Math.ceil(horizon/.03);j++){
   const t=Math.min(j*.03,horizon),seg=at(t),future=center.clone().addScaledVector(bv,t),q=closest(future,seg.a,seg.b),relative=q.p.clone().addScaledVector(bv,-t),surface=col.projectPoint(relative,true),gap=surface.isInside?0:relative.distanceTo(surface.point);
   if(gap>.055||now-gap<.025)continue;
   const present=a.clone().lerp(b,q.u),pv=omega.clone().cross(present.clone().sub(com)).add(vel).sub(bv),speed=pv.length(),along=b.clone().sub(a).normalize(),sweep=pv.clone().addScaledVector(along,-pv.dot(along)).length();
   const height=present.y-chest.y,lat=present.clone().sub(chest).dot(right);
   if(speed<2.5||sweep<1.5||sweep<speed*.4||height<-.20||height>.9)continue;
   const score=t+gap*.2;
   if(!best||score<best.score)best={incoming:true,part:name,eta:t,gap,now,speed,sweep,height,lat,u:q.u,point:q.p.toArray(),present:present.toArray(),velocity:pv.toArray(),line:lat<-.10?'highL':lat>.10?'highR':'highC',score};
  }
 }
 return {...(best??{incoming:false,distance:minNow}),current};
}
export function traceState(G,guard,horizon=.36){
 const D=G.player,O=G.enemy,s=O.stamina,p=forecastBlade(D,O,horizon),axis=D.bladePoint(1,new THREE.Vector3()).sub(D.bladePoint(0,new THREE.Vector3())).normalize(),aim=D.aimDirW;
 return {t:G.t,attackId:s.attackId,paidKind:s.flowAttackKind??null,paidAt:s.flowAttackStart??null,paidUntil:s.attackUntil,spentAttack:O.flowSpentAttack??null,phase:G.ai.phase,commandMode:G.ai.mode,guard:{line:guard.line,defLine:guard.defLine,mode:guard.mode,active:guard.active,handError:handPos(D).distanceTo(D.handTarget),angleError:Math.acos(clamp(axis.dot(aim),-1,1))*180/Math.PI,hand:handPos(D).toArray(),target:D.handTarget.toArray(),bladeRoot:D.bladePoint(0,new THREE.Vector3()).toArray(),bladeTip:D.bladePoint(1,new THREE.Vector3()).toArray(),aim:aim.toArray()},forecast:p,foe:{root:O.bladePoint(0,new THREE.Vector3()).toArray(),tip:O.bladePoint(1,new THREE.Vector3()).toArray(),com:V(O.sword.worldCom()).toArray(),v:V(O.sword.linvel()).toArray(),w:V(O.sword.angvel()).toArray()},pose:D.flowInterceptDebug??null};
}
export function installEarlyIntercept(G,horizon,{horizontalOnly=false,fighter=G.player}={}){
 const f=fighter,definitions=Object.fromEntries(Object.entries(FLOW_POSES.mixed).map(([line,p])=>{const el=p.blade[0]*Math.PI/180,az=p.blade[1]*Math.PI/180;return [line,{...p,dir:[Math.cos(el)*Math.cos(az),Math.sin(el),Math.cos(el)*Math.sin(az)]}];}));
 let lock=null,seenId=-1,overhead=false;
 f.flowPoseSelector=(want,dt)=>{
  const g=f.parryGuard??f.skill._cover?.ai;
  const guarding=f.parryGuard?g?.active&&g.held&&!g.broken:g?.mode==='defend'&&!g.defVoid;
  if(!guarding||f.stamina.exhausted||!f.alive||!f.armed||!f.foe?.alive||!f.foe.armed||f.skill.tap||f.skill.pom){lock=null;f.flowInterceptDebug=null;return want;}
  if(!f.foe.stamina.attackId||f.foe.stamina.flowAttackKind!=='cut'){lock=null;f.flowInterceptDebug=null;return want;}
  const id=f.foe.stamina.attackId;
  if(id!==seenId){seenId=id;overhead=false;}
  const root=f.foe.bladePoint(0,new THREE.Vector3()),tip=f.foe.bladePoint(1,new THREE.Vector3()),blade=tip.clone().sub(root).normalize();
  if(blade.y>.6&&tip.y-f.bodies.chest.translation().y>.75)overhead=true;
  const path=forecastBlade(f,f.foe,horizon);
  const v=path.velocity;
  const horizontal=!horizontalOnly||(!overhead&&Math.abs(blade.y)<.55&&v&&Math.abs(v[1])<.5*Math.hypot(v[0],v[2]));
  if(path.incoming&&path.line!=='highC'&&horizontal){
   if(!lock)lock={line:path.line,age:0,clear:0,start:f.stamina.time,attackId:f.foe.stamina.attackId,first:path};
   lock.clear=0;
  }
  if(lock){lock.age+=dt;if(!path.incoming||!horizontal)lock.clear+=dt;
   if(lock.age>.40||lock.clear>.10){lock=null;f.flowInterceptDebug=null;return want;}
   f.flowInterceptDebug={...lock,path,horizontalOnly,overhead,bladeY:blade.y};return definitions[lock.line];
  }
  f.flowInterceptDebug=null;return want;
 };
}
