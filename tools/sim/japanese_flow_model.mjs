// Research adapter only. Production Combat and configuration remain unchanged.
import * as THREE from 'three';
import {NAGASHI} from '../../src/config.js';
import {PlayerParryGuard} from '../../src/parry_button.js';
import {PathResearchGuard} from './chinese_path_guard.mjs';
import {observedUpperPath} from './chinese_contact_guard.mjs';
const vec=v=>new THREE.Vector3(v.x,v.y,v.z);
const velocity=(s,p)=>vec(p).sub(s.com).cross(s.w).negate().add(s.v);
export function flowGuard(kind){
 const Parent=kind==='roof-path'?PathResearchGuard:PlayerParryGuard;
 return class extends Parent {
  selectResearchLine({s,c,d,foeReach,dt,th}){
   if(kind!=='roof-path'||!this.active||!this.held||this.broken||this.me.swordArt?.tradition!=='japanese'||this.me.schoolParry===false||d>foeReach+.3)return null;
   const p=observedUpperPath(this.me,s);
   if(p.incoming&&p.line==='highC')this.roofLock??={age:0,clear:0};
   if(this.roofLock){
    const l=this.roofLock;l.age+=dt;
    l.clear=!p.incoming&&!this.me.feel?.touching&&(p.distance??Infinity)>.38?l.clear+dt:0;
    const low=th&&['lowL','lowR'].includes(th.line)&&Math.max(s.ty,s.my)<c.y+.15;
    if(l.clear>.025||l.age>.45||low)this.roofLock=null;
   }
   return this.roofLock?'highC':null;
  }
  step(dt){
   const result=super.step(dt);
   if(!result)this.roofLock=null;
   if(kind.includes('release')&&!this.active&&this.me.skill._cover){
    this.me.skill._cover.forceT=0;
   }
   if(kind==='free-cut'&&!this.active&&this.broken&&this.me.skill._cover?.forceT>0){
    this.me.skill._cover.forceT=0;
    this.me.skill._cover.w=0; // installCover releases its own pose in this same step.
   }
   return result;
  }
 };
}
export function installFlowStudy(G,kind='base',{both=false}={}){
 const combat=G.combat,original=combat.nagashi.bind(combat),events=[];
 combat.nagashi=(A,B,SA,SB,point,nrm,vn)=>{
  const details=[[A.fighter,B.fighter,SB,SA],[B.fighter,A.fighter,SA,SB]].map(([D,O,SO,SD])=>{
   const st=D.skill?._cover,vel=velocity(SO,point),chest=D.bodies.chest.translation();
   const axis=D.bladePoint(1,new THREE.Vector3()).sub(D.bladePoint(0,new THREE.Vector3()));
   const toward=vec(chest).sub(point);toward.y=0;toward.normalize();
   const tangent=axis.clone().addScaledVector(nrm,-axis.dot(nrm)).normalize();
   const along=vel.clone().sub(velocity(SD,point)).dot(tangent);
   const row={d:D.index,book:!!st?.nagashi&&D.schoolParry!==false,active:!!(D.parryGuard?D.parryGuard.active:st?.ai?.mode==='defend'&&!st.ai.defVoid),down:-vel.y,speed:vel.length(),toward:vel.dot(toward),height:point.y-chest.y,roof:axis.y,mode:D.parryGuard?.mode,line:D.parryGuard?.line,cover:st?.w??0};
   row.baseEligible=row.book&&row.active&&row.down>=NAGASHI.moveDown&&row.height>=NAGASHI.zoneHy&&row.roof<0;
   row.extraEligible=row.book&&row.active&&row.down>=1&&row.speed>=3.5&&row.toward>0&&row.height>=NAGASHI.zoneHy&&row.roof<0;
   row.along=along;
   row.glanceEligible=row.book&&row.active&&row.down>=.5&&row.speed>=2.5&&along>=1.5&&along>=.35*vn&&vn>.5&&row.height>=NAGASHI.zoneHy&&row.roof<0;
   row.target=both||D===G.player;
   return row;
  });
  const row={t:G.t,vn,point:{x:point.x,y:point.y,z:point.z},details,enemyMode:G.ai.mode,enemyPhase:G.ai.phase};
  const old={moveDown:NAGASHI.moveDown,slideK:NAGASHI.slideK};
  let answer;
  try{
   // All opponents in the main comparison are non-Japanese. For a mirrored
   // Japanese opponent, both=true is an explicitly separate diagnostic.
   const target=details.find(x=>x.target&&x.book&&x.active);
   if(target&&kind.includes('diagonal')&&target.extraEligible)NAGASHI.moveDown=1;
   if(target&&kind==='glance'&&target.glanceEligible)NAGASHI.moveDown=.5;
   if(target&&kind.includes('strong'))NAGASHI.slideK=1.2;
   answer=kind==='off'?null:original(A,B,SA,SB,point,nrm,vn);
  }finally{Object.assign(NAGASHI,old);}
  row.flow=answer?.index??null;row.impulse=answer?combat.lastNagashi.Jt:0;row.direction=answer?combat.lastNagashi.dir.toArray():null;
  events.push(row);return answer;
 };
 return {events};
}
