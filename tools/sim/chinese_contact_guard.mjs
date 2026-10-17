// Research controller. Reads observed rigid-body motion, never AI intent or future simulation.
import * as THREE from 'three';
import {PathResearchGuard} from './chinese_path_guard.mjs';
import {PlayerParryGuard} from '../../src/parry_button.js';
import {ARM} from '../../src/config.js';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),clamp=THREE.MathUtils.clamp;
const PARTS=[['head',.13],['chest',.20],['uarmS',.10],['farmS',.10]];
function nearest(p,a,b){const d=b.clone().sub(a),u=clamp(p.clone().sub(a).dot(d)/Math.max(1e-9,d.lengthSq()),0,1);return {u,p:a.clone().addScaledVector(d,u)};}
export function observedUpperPath(me,s){
 const tip=V(s.tx,s.ty,s.tz),mid=V(s.mx,s.my,s.mz),vt=V(s.tvx,s.tvy,s.tvz),vm=V(s.mvx,s.mvy,s.mvz);
 const root=tip.clone().addScaledVector(mid.clone().sub(tip),1/.3),vr=vt.clone().addScaledVector(vm.clone().sub(vt),1/.3);
 const length=tip.distanceTo(root);if(length<.05||vt.length()<2.5)return {incoming:false,reason:'slow'};
 const dir=tip.clone().sub(root).normalize(),omega=dir.clone().cross(vt.clone().sub(vr)).divideScalar(length);
 const speed=omega.length(),axis=speed>1e-6?omega.clone().divideScalar(speed):V(0,1,0);
 const at=t=>{const a=root.clone().addScaledVector(vr,t),d=dir.clone().applyAxisAngle(axis,Math.min(speed*t,.85));return {a,b:a.clone().addScaledVector(d,length)};};
 const chest=me.bodies.chest.translation(),right=me.right(V());let best=null,minNow=Infinity;
 for(const [name,radius] of PARTS){
  const body=me.bodies[name],pos=V().copy(body.translation()),vel=V().copy(body.linvel());
  const initial=nearest(pos,root,tip),now=initial.p.distanceTo(pos)-radius;minNow=Math.min(minNow,now);
  for(let i=1;i<=6;i++){
   const t=i*.03,seg=at(t),future=pos.clone().addScaledVector(vel,t),n=nearest(future,seg.a,seg.b),gap=n.p.distanceTo(future)-radius;
   if(gap>.12||now-gap<.04||n.p.y<chest.y-.08)continue;
   const present=root.clone().lerp(tip,n.u),velocity=omega.clone().cross(present.clone().sub(root)).add(vr);
   if(velocity.y>-.5||Math.max(tip.y,mid.y)<chest.y+.25)continue;
   const score=t+Math.max(0,gap)*.2;
   if(!best||score<best.score){
    const intercept=at(Math.max(.015,t-.045)),point=intercept.a.clone().lerp(intercept.b,n.u);
    const lat=present.clone().sub(V(chest.x,chest.y,chest.z)).dot(right);
    best={incoming:true,line:lat<-.15?'highL':lat>.15?'highR':'highC',point,eta:t,gap,now,part:name,lat,score};
   }
  }
 }
 return best??{incoming:false,reason:'no-upper-intercept',distance:minNow};
}
export function contactGuard(kind){
 if(kind==='base')return PlayerParryGuard;
 return class extends PathResearchGuard{
  constructor(me,foe){super(me,foe);this.researchKind=kind;this.handShift=V();this.turn=V();this.contactStats={detected:0,locked:0,cleared:0,contacts:0,adjusted:0,maxHand:0,maxAngle:0};}
  eligible(){const m=this.me;return this.active&&this.held&&!this.broken&&m.alive&&m.armed&&!m.stamina.exhausted&&!m.skill.tap&&!m.skill.pom&&!m.skill.sec&&m.swordArt?.tradition==='chinese'&&m.schoolParry!==false;}
  step(dt){this.dt=dt;const a=process.env.PATH_KIND,b=process.env.PATH_LINE;process.env.PATH_KIND='';process.env.PATH_LINE='';
   try{const r=super.step(dt);if(!this.eligible()){this.lock=null;this.path=null;this.handShift.set(0,0,0);this.turn.set(0,0,0);}return r;}finally{process.env.PATH_KIND=a??'';process.env.PATH_LINE=b??'';}
  }
  selectResearchLine({s,c,d,foeReach,dt,th}){
   if(!this.eligible()||d>foeReach+.3||!this.foe.alive){this.lock=null;this.path=null;return null;}
   const p=observedUpperPath(this.me,s);this.path=p;const reads=kind!=='fit-only';
   if(p.incoming){
    this.contactStats.detected++;
    // Hysteresis: once a visible upper attack starts, keep its side through contact/passage.
    if(!this.lock){this.lock={line:p.line,age:0,clear:0,touched:false};this.contactStats.locked++;}
    this.lock.point=p.point;this.lock.clear=0;
   }
   if(this.lock){
    const l=this.lock;l.age+=dt;
    if(this.me.feel?.touching&&!l.touched){l.touched=true;this.contactStats.contacts++;}
    const escaped=!p.incoming&&!this.me.feel?.touching&&(p.distance??Infinity)>.38;
    l.clear=escaped?l.clear+dt:0;
    // A new lower threat must not be hidden by the upper lock.
    const lower=th&&['lowL','lowR'].includes(th.line)&&Math.max(s.ty,s.my)<c.y+.15;
    if(l.clear>.025||l.age>.75||lower){this.contactStats.cleared++;this.lock=null;this.handShift.set(0,0,0);this.turn.set(0,0,0);}
   }
   return reads&&this.lock?this.lock.line:null;
  }
  adjustHandTarget(target){
   if(!this.eligible()||kind==='path'||!this.lock?.point)return;
   const direction=this.me.aimDirW.clone().normalize(),point=this.lock.point;
   const hilt=this.me.weaponCfg.hiltLength,length=this.me.weaponCfg.bladeLength;
   const a=target.clone().addScaledVector(direction,hilt),b=a.clone().addScaledVector(direction,length);
   const delta=point.clone().sub(nearest(point,a,b).p).clampLength(0,.05);
   const change=delta.sub(this.handShift).clampLength(0,.5*this.dt);this.handShift.add(change);
   const shoulder=V(...ARM.shoulder).applyQuaternion(this.me.bodies.chest.rotation()).add(this.me.bodies.chest.translation());
   const maxReach=Math.max(ARM.upper+ARM.fore-.01,target.distanceTo(shoulder));
   const next=target.clone().add(this.handShift);if(next.distanceTo(shoulder)<=maxReach+1e-6)target.copy(next);
   this.contactStats.maxHand=Math.max(this.contactStats.maxHand,this.handShift.length());
  }
  adjustBladeAim(aim){
   if(!this.eligible()||kind==='path'||!this.lock?.point)return;
   const wanted=this.lock.point.clone().sub(this.me.handTarget);if(wanted.length()<.15)return;wanted.normalize();
   const axis=aim.clone().cross(wanted),sin=axis.length(),angle=Math.min(Math.atan2(sin,aim.dot(wanted)),15*Math.PI/180);
   const requested=sin>1e-8?axis.multiplyScalar(angle/sin):V();
   this.turn.add(requested.sub(this.turn).clampLength(0,2.1*this.dt));
   const turnAngle=Math.min(this.turn.length(),15*Math.PI/180);if(turnAngle>1e-8)aim.applyAxisAngle(this.turn.clone().normalize(),turnAngle).normalize();
   this.contactStats.adjusted++;this.contactStats.maxAngle=Math.max(this.contactStats.maxAngle,turnAngle);
  }
 };
}
