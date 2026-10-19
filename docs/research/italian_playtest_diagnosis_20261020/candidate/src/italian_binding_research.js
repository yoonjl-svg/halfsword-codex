// Research only: explicit geometric feedback through existing hand/wrist servo. No impulses, locks, force or damage buffs.
import * as THREE from 'three';
import {ItalianOpposition} from './italian_opposition.js';
import {SKILL} from './config.js';
const V=()=>new THREE.Vector3(),clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
export const PRESETS={
 axis26:{aim:0,extend:.26,bind:.12,turn:.15},gentle26:{aim:0,extend:.26,bind:.06,turn:.15},
 current:{original:true},fast24:{aim:0,extend:.24,bind:0},
 bindslow:{aim:.12,extend:.32,bind:.12},bind22:{aim:0,extend:.22,bind:.12},
 bind24:{aim:0,extend:.24,bind:.12},bind26:{aim:0,extend:.26,bind:.12},
 near24:{aim:0,extend:.24,bind:.12,near:true},forte24:{aim:0,extend:.24,bind:.12,forte:true},
 near26:{aim:0,extend:.26,bind:.12,near:true},forte26:{aim:0,extend:.26,bind:.12,forte:true},currentforte:{original:true,forte:true},
 release26:{aim:0,extend:.26,bind:0,track:true},bind26full:{aim:0,extend:.26,bind:.12,abort:false},
};
export function contactAt(f,point){const a=f.bladePoint(0,V()),b=f.bladePoint(1,V()).sub(a),len=b.length();return {at:V().copy(point).sub(a).dot(b)/(len*len),a,dir:b.normalize(),len};}
export class BindingOpposition extends ItalianOpposition{
 constructor(f,foe,g,variant){super(f,foe,g);this.cfg={aim:.12,extend:.32,hold:.08,recover:.20,reach:.28,turn:.65,side:.04,...PRESETS[variant]};this.variant=variant;this.events=[];this.samples=[];this.lastContact=-Infinity;this.geometry=null;this.serial=0;}
 onClash(attacker,hit){
  const point=this.f.feel.point.clone(),own=contactAt(this.f,point),other=contactAt(this.foe,point);
  this.lastContact=this.guard.clock;this.geometry={own:own.at,other:other.at,point:point.toArray()};
  if(this.cfg.forte&&(own.at<-.08||own.at>.5))return;
  const n=this.starts;super.onClash(attacker,hit);if(this.starts===n)return;
  const r=this.run;if(!r)return;
  const cfg=this.cfg,f=this.f,foe=this.foe,inv=f.yaw.clone().invert(),c=V().copy(f.bodies.chest.translation());
  r.targetKind='chest';
  if(cfg.near){
   const local=V().copy(foe.bodies.farmS.translation()).sub(c).applyQuaternion(inv).sub(r.hand),chest=V().copy(foe.bodies.chest.translation()).sub(c).applyQuaternion(inv).sub(r.hand);
   const reach=f.weaponCfg.hiltLength+f.weaponCfg.bladeLength+cfg.reach;
   if(chest.length()>reach&&local.length()<chest.length()-.1&&local.clone().normalize().dot(chest.clone().normalize())>.7071){r.target=local.normalize();r.targetKind='forearm';}
  }
  const pOwn=own.a.clone().addScaledVector(own.dir,own.at*own.len),pOther=other.a.clone().addScaledVector(other.dir,other.at*other.len);
  r.normal=pOwn.sub(pOther);if(r.normal.lengthSq()<1e-6)r.normal.set(0,0,Math.sign(r.hand.z)||1).applyQuaternion(f.yaw);r.normal.normalize();
  r.ownAt=clamp(own.at,.05,.5);r.otherAt=clamp(other.at,0,1);r.contactT=0;r.forteT=0;r.activeT=0;r.maxCorrection=0;r.lostT=0;
  r.serial=++this.serial;
  this.events.push({type:'start',...this.lastStart,serial:r.serial,target:r.targetKind,ownAt:own.at,otherAt:other.at,hand:r.hand.toArray(),dir:r.dir.toArray(),targetDir:r.target.toArray()});
 }
 cancel(reason){const r=this.run;if(r)this.events.push({type:'end',t:this.guard.clock,serial:r.serial,reason,contactT:r.contactT,forteT:r.forteT,activeT:r.activeT,maxCorrection:r.maxCorrection});super.cancel(reason);}
 update(dt){
  const r=this.run;if(!r)return;
  const cfg=this.cfg,f=this.f,sk=f.skill;
  const touching=this.guard.clock-this.lastContact<dt*1.5;
  r.activeT+=dt;if(touching){r.contactT+=dt;if(this.geometry?.own<=.5&&this.geometry?.own>=-.08)r.forteT+=dt;}
  if(cfg.original){this.samples.push({t:this.guard.clock,serial:r.serial,elapsed:r.t,touch:touching,ownAt:this.geometry?.own,otherAt:this.geometry?.other,hand:sk.thrustPose.hand.slice(),dir:sk.thrustPose.dir.slice()});super.update(dt);return;}
  if(!this.eligible()){this.cancel('interrupt');return;}
  r.t+=dt*f.stamina.attackSpeed;
  const end=cfg.aim+cfg.extend+cfg.hold;if(r.t>=end+cfg.recover){this.cancel('complete');return;}
  const e=smooth((r.t-cfg.aim)/cfg.extend),a=smooth(r.t/(cfg.aim||cfg.extend));
  const w=r.t<.04?smooth(r.t/.04):r.t<end?1:1-smooth((r.t-end)/cfg.recover);
  const axis=r.dir.clone().lerp(r.target,cfg.turn*a).normalize();
  const h=r.hand.clone().addScaledVector(axis,cfg.reach*e);h.z+=r.side*cfg.side*a;
  let correction=0;
  if((cfg.bind||cfg.track)&&!r.bindReleased&&r.t<end){
   const c=V().copy(f.bodies.chest.translation()),hw=h.clone().applyQuaternion(f.yaw).add(c),dw=axis.clone().applyQuaternion(f.yaw);
   const op=this.foe.bladePoint(0,V()),od=this.foe.bladePoint(1,V()).sub(op),olen=od.length();od.normalize();
   // Slide the desired contact along the opponent's blade; bounded tracking avoids following a withdrawn sword indefinitely.
   const ownContact=hw.clone().addScaledVector(dw,f.weaponCfg.hiltLength+r.ownAt*f.weaponCfg.bladeLength);
   const s=clamp(ownContact.clone().sub(op).dot(od)/olen,Math.max(0,r.otherAt-.25),Math.min(1,r.otherAt+.25));
   const q=op.addScaledVector(od,s*olen).addScaledVector(r.normal,.012);
   const delta=q.sub(ownContact);delta.addScaledVector(dw,-delta.dot(dw));
   correction=delta.length();r.maxCorrection=Math.max(r.maxCorrection,correction);
   delta.clampLength(0,cfg.bind).multiplyScalar(smooth(r.t/.06));h.add(delta.applyQuaternion(f.yaw.clone().invert()));
   if(correction>.22&&!touching)r.lostT+=dt;else r.lostT=0;
   if(cfg.abort!==false&&r.lostT>.08){if(SKILL.itOppositionVals.finishOnSeparation){r.bindReleased=true;this.events.push({type:'release-binding',t:this.guard.clock,serial:r.serial});}else{r.t=end;this.events.push({type:'withdraw',t:this.guard.clock,serial:r.serial});}}
  }
  Object.assign(sk.thrustPose,{w,hand:h.toArray(),dir:axis.toArray(),...r.body});
  sk.thrustPush=r.t>=cfg.aim&&r.t<end;sk.activity=Math.max(sk.activity,w);
  if(this.samples.length<20000)this.samples.push({t:this.guard.clock,serial:r.serial,elapsed:r.t,touch:touching,ownAt:this.geometry?.own,otherAt:this.geometry?.other,correction,hand:h.toArray(),dir:axis.toArray()});
 }
}
export function installBinding(f,foe,g,variant){const mod=new BindingOpposition(f,foe,g,variant);g.opposition=mod;return mod;}
