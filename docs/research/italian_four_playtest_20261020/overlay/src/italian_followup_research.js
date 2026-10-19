import * as THREE from 'three';
import {STEEL} from './config.js';
import {gripMass} from './research_grip_mass.js';
import {BindingOpposition,PRESETS} from './italian_binding_research.js';
const V=()=>new THREE.Vector3(),smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
Object.assign(PRESETS,{
 fastNear:{...PRESETS.fast24,near:true},gentleNear:{...PRESETS.gentle26,near:true},
 gentleRoll20:{...PRESETS.gentle26,roll:20},gentleRoll40:{...PRESETS.gentle26,roll:40},
 gentleReturn:{...PRESETS.gentle26,returnGuard:true},fastReturn:{...PRESETS.fast24,returnGuard:true},
 gentleTier:{...PRESETS.gentle26,tier:true},fastTier:{...PRESETS.fast24,tier:true},
 gentleBeat:{...PRESETS.gentle26,beat:1.6/3},gentleBeatSmall:{...PRESETS.gentle26,beat:1.6/6},
 gentleCombo:{...PRESETS.gentle26,near:true,roll:40},
 gentleNearYield:{...PRESETS.gentle26,near:true,yieldBack:true},currentYield:{original:true,yieldBack:true},
 gentleNearSoftBack:{...PRESETS.gentle26,near:true,softBack:true},
 gentleForte:{...PRESETS.gentle26,forte:true},
});
export class FollowupOpposition extends BindingOpposition{
 constructor(f,foe,g,variant){super(f,foe,g,variant);this.baseCfg={...this.cfg};this.rollChecks=[];
  const drive=f.driveSword.bind(f);f.driveSword=(...args)=>{
   const r=this.run,cfg=this.cfg,old=f.skill._cover;
   if(!r||!cfg.roll||!r.flat)return drive(...args);
   const axis=f.bladePoint(1,V()).sub(f.bladePoint(0,V())).normalize();
   const wanted=axis.clone().cross(r.normal).normalize();
   const flat=r.flat.clone().addScaledVector(axis,-r.flat.dot(axis)).normalize();
   if(wanted.dot(flat)<0)wanted.negate();
   const angle=Math.acos(THREE.MathUtils.clamp(flat.dot(wanted),-1,1));
   const cap=cfg.roll*Math.PI/180,blend=angle>1e-6?Math.min(1,cap/angle)*smooth(r.t/.10):0;
   flat.lerp(wanted,blend).normalize();const local=flat.clone().applyQuaternion(f.yaw.clone().invert());
   f.skill._cover={...(old??{}),own:true,face:[local.x,local.y,local.z/f.side]};
   try{const ret=drive(...args);if(this.rollChecks.length<10000)this.rollChecks.push({t:g.clock,serial:r.serial,angle,blend,lag:f.edgeLag,world:flat.toArray()});return ret;}finally{f.skill._cover=old;}
  };
 }
 eligible(){return super.eligible()&&!(this.cfg?.yieldBack&&this.f.stickY<-.25);}
 onClash(...args){
  if(!this.run&&this.baseCfg.softBack)this.cfg={...this.baseCfg};
  if(!this.run&&this.baseCfg.tier)this.cfg=this.guard.clock-this.pressed<=.16?{...this.baseCfg}:{...this.baseCfg,original:true,roll:0,returnGuard:false};
  const before=this.serial;super.onClash(...args);if(this.serial===before||!this.run)return;
  const q=this.f.sword.rotation();this.run.flat=V().set(0,0,1).applyQuaternion(new THREE.Quaternion(q.x,q.y,q.z,q.w));
  if(this.cfg.beat){
   const point=this.f.feel.point,c=V().copy(this.f.bodies.chest.translation()),forward=V().copy(this.foe.bodies.chest.translation()).sub(c);forward.y=0;forward.normalize();
   const left=V().set(0,1,0).cross(forward),side=point.clone().sub(c).dot(left);left.multiplyScalar(Math.abs(side)>.03?Math.sign(side):this.run.side);
   const sw=this.foe.sword,q=sw.rotation(),axis=V().set(0,1,0).applyQuaternion(new THREE.Quaternion(q.x,q.y,q.z,q.w));left.addScaledVector(axis,-left.dot(axis));
   if(left.lengthSq()>1e-8){left.normalize();const pos=V().copy(sw.translation()),at=pos.clone().addScaledVector(axis,point.clone().sub(pos).dot(axis));
    const J=gripMass(this.foe.swordProps,{p:pos,com:V().copy(sw.worldCom()),q:new THREE.Quaternion(q.x,q.y,q.z,q.w)},at,left,STEEL.handMass)*this.cfg.beat*(args[1]?.vn??0);
    const impulse=left.clone().multiplyScalar(J);sw.applyImpulseAtPoint(impulse,at,true);
    this.f.bodies.chest.applyImpulse(impulse.clone().multiplyScalar(-.6),true);this.f.bodies.pelvis.applyImpulse(impulse.clone().multiplyScalar(-.4),true);
    this.events.push({type:'beat',t:this.guard.clock,serial:this.run.serial,J,k:this.cfg.beat,dir:left.toArray()});
   }
  }
  const e=this.events.findLast(e=>e.type==='start');if(e?.type==='start')e.path=this.cfg.original?'slow':'fast';
 }
 update(dt){
  const r=this.run;
  if(r&&this.cfg.softBack&&this.f.stickY<-.25){const end=this.cfg.aim+this.cfg.extend+this.cfg.hold;if(r.t<end){r.t=end;this.cfg.returnGuard=true;this.events.push({type:'softBack',t:this.guard.clock,serial:r.serial});}}
  super.update(dt);
 }
 endGuardStep(){
  const r=this.run,cfg=this.cfg;
  // During recovery let the existing guard move the actual input pad; the overlay blends down into that guard.
  if(r&&cfg.returnGuard&&r.t>=cfg.aim+cfg.extend+cfg.hold){this.f.skill.prev.copy(this.f.handOffset);return;}
  super.endGuardStep();
 }
}
export function installFollowup(f,foe,g,variant){const m=new FollowupOpposition(f,foe,g,variant);g.opposition=m;return m;}

Object.assign(PRESETS,{
 usefulNear:{...PRESETS.gentleNear,beat:1.6/3},
 usefulRoll:{...PRESETS.gentleRoll40,beat:1.6/3},
 strongBind:{...PRESETS.gentleCombo,extend:.24,bind:.10,beat:.8},
 strongThrust:{...PRESETS.gentleNear,extend:.22,reach:.34,roll:20,beat:.8},
});
for(const id of ['usefulNear','usefulRoll','strongBind','strongThrust'])PRESETS[id+'Off']={...PRESETS[id],beat:0};
