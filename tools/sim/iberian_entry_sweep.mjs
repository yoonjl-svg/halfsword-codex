// Research: travel into the existing guard along a continuous curved path.
// All forces remain the ordinary hand/wrist/body motors.
import * as THREE from 'three';
import {contactGuard} from './iberian_contact_sweep.mjs';
const clamp=x=>Math.max(0,Math.min(1,x)), smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
export function entryGuard(cfg){return class extends contactGuard(cfg){
 constructor(f,foe){super(f,foe);
  if(!f.skill._contactSweep)return;
  const sk=f.skill,state=sk._entrySweep={run:null,events:[],last:-Infinity,seen:-1,speed:0};
  const step=this.step.bind(this);
  this.step=dt=>{const result=step(dt);sk.guardDrive=Math.max(sk.guardDrive,state.speed);return result;};
  const update=sk.update.bind(sk);
  sk.update=dt=>{
   const out=update(dt),p=sk.thrustPose;
   const valid=this.held&&this.active&&!this.broken&&f.alive&&f.armed&&!f.stamina.exhausted&&!sk.tap&&!sk.pom&&!sk.sec;
   if(!valid){state.run=null;state.speed=0;return out;}
   if(this.mode==='defend'&&['highL','highR'].includes(this.defLine)&&this.threatId!==state.seen&&this.clock-state.last>.65&&sk._cover.own){
    state.seen=this.threatId;state.last=this.clock;
    const inv=f.yaw.clone().invert(),target=new THREE.Vector3(...p.hand);
    const hand=new THREE.Vector3().copy(f.sword.translation()).sub(new THREE.Vector3().copy(f.bodies.chest.translation())).applyQuaternion(inv);
    const delta=hand.sub(target);if(delta.length()>.35)delta.setLength(.35);hand.copy(target).add(delta);
    const dir=f.bladePoint(1).sub(f.bladePoint(0)).normalize().applyQuaternion(inv);
    state.run={t:0,hand,dir,line:this.defLine,threat:this.threatId,side:this.defLine==='highL'?-1:1};
    state.events.push({t:this.clock,line:this.defLine,hand:hand.toArray(),dir:dir.toArray()});
   }
   const run=state.run;if(!run)return out;
   if(run.threat!==this.threatId||run.line!==this.defLine||!sk._cover.own){state.run=null;state.speed=0;return out;}
   run.t+=dt;const u=smooth(run.t/cfg.entryT);
   if(u>=1){state.run=null;state.speed=0;return out;}
   const arc=Math.sin(Math.PI*u),nextHand=new THREE.Vector3(...p.hand).lerp(run.hand,1-u);
   nextHand.y+=cfg.arc*arc;nextHand.z-=run.side*cfg.arc*.5*arc;
   const q=new THREE.Quaternion().setFromUnitVectors(run.dir,new THREE.Vector3(...p.dir).normalize());
   q.slerp(new THREE.Quaternion(),1-u);
   const dir=run.dir.clone().applyQuaternion(q).normalize();
   const next={hand:nextHand.toArray(),dir:dir.toArray()};
   if(run.prev)state.speed=(nextHand.distanceTo(new THREE.Vector3(...run.prev.hand))+Math.acos(Math.max(-1,Math.min(1,dir.dot(new THREE.Vector3(...run.prev.dir)))))*f.weaponCfg.bladeLength*.65)/dt;
   run.prev=next;Object.assign(p,next);
   return out;
  };
 }
};}
