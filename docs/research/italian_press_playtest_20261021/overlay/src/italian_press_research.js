// Research-only alternative: the guard button initiates a covered, weak thrust.
// Actual rigid-body blade contact still decides whether a wound exists.
import * as THREE from 'three';
const V=()=>new THREE.Vector3();
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
const rad=Math.PI/180;
export const PRESS_DEFAULTS=Object.freeze({extend:.28,hold:.12,recover:.24,reach:.42,damageKeep:.60,damageCut:.30,track:.10,bodyTarget:true,nearArm:true,trackUntil:.18});

export class PressOpposition {
 constructor(f,foe,guard,config={}) {
  this.f=f;this.foe=foe;this.guard=guard;this.cfg={...PRESS_DEFAULTS,...config};
  this.run=null;this.lastHeld=false;this.pendingPress=false;this.serial=0;this.starts=0;
  this.events=[];this.samples=[];this.cueAt=-Infinity;this.pendingCue=null;this.pad=new THREE.Vector2();
  const block=f.stamina.block.bind(f.stamina);
  f.stamina.block=att=>{if(!this.run)return block(att);}; // One normal thrust cost includes its receiving contact.
 }
 eligible(){const f=this.f,sk=f.skill;return f.weapon?.id==='rapier'&&f.swordArt?.tradition==='italian'&&f.schoolParry!==false
  &&f.alive&&this.foe.alive&&f.armed&&!f.stamina.exhausted&&['stand','kneel'].includes(f.state)
  &&!sk.tap&&!sk.pom&&!sk.sec&&!f.secretStiff&&!this.guard.broken;}
 beginGuardStep(){
  const held=this.guard.held;
  this.pendingPress=held&&!this.lastHeld&&!this.run&&this.eligible();
  this.lastHeld=held;this.pad.copy(this.f.handOffset);
  if(this.run&&!this.eligible())this.cancel('interrupt');
 }
 endGuardStep(){
  if(this.pendingPress&&this.guard.active&&this.eligible())this.start();
  this.pendingPress=false;
  if(this.run){this.f.handOffset.copy(this.pad);this.f.skill.prev.copy(this.pad);this.f.skill.guardDrive=0;}
 }
 start(){
  const f=this.f,c=V().copy(f.bodies.chest.translation()),inv=f.yaw.clone().invert(),cfg=this.cfg;
  const h0=V().copy(f.sword.translation()).sub(c).applyQuaternion(inv);
  const d0=f.bladePoint(1,V()).sub(f.bladePoint(0,V())).applyQuaternion(inv).normalize();
  const line=this.guard.line??'point',other=V().copy(this.foe.sword.translation()).sub(c).applyQuaternion(inv);
  const side=Math.abs(other.z)>.04?Math.sign(other.z):1;
  // Hilt stays on the selected receiving side; tip goes toward the opponent.
  // High incoming cuts use a higher receiving hilt, low cuts a lower one.
  const y=line.startsWith('high')?.14:line.startsWith('low')?-.10:.02;
  const cover=V().set(.36,y,side*.15);
  let target=V().copy(this.foe.bodies.chest.translation()),kind='chest';
  const arm=V().copy(this.foe.bodies.farmS.translation());
  const hw=cover.clone().applyQuaternion(f.yaw).add(c),reach=f.weaponCfg.hiltLength+f.weaponCfg.bladeLength+cfg.reach;
  if((cfg.nearArm||target.distanceTo(hw)>reach)&&arm.distanceTo(hw)<target.distanceTo(hw)-.12){target=arm;kind='forearm';}
  const before=f.stamina.value;f.stamina.attack('thrust');
  if(f.stamina.exhausted){this.events.push({type:'rejected',t:this.guard.clock,reason:'cost-exhaustion'});return;}
  const b=f.bodyPose??f.guardPose??{};
  this.run={serial:++this.serial,t:0,age:0,h0,d0,cover,target:target.clone(),target0:target.clone(),kind,side,line,
   body:{pelvisYaw:b.pelvisYaw??0,chestYaw:b.chestYaw??0,pitch:b.pitch??0,drop:b.drop??0},clashCue:false};
  this.starts++;f.skill.thrusts++;this.cueAt=this.guard.clock;
  this.events.push({type:'start',serial:this.serial,t:this.guard.clock,line,target:kind,cost:before-f.stamina.value,gap:f.foeDistance()});
 }
 cancel(reason){if(!this.run)return;this.events.push({type:'end',serial:this.run.serial,t:this.guard.clock,reason});this.run=null;this.f.skill.thrustPose.w=0;this.f.skill.thrustPush=false;this.pendingCue=null;}
 beforeSkill(){if(this.run&&!this.eligible())this.cancel('interrupt');if(this.run){this.f.skill.thrustPose.w=0;this.f.skill.thrustPush=false;this.f.skill.prev.copy(this.f.handOffset);}}
 onWound(){} // Being hit is part of the trade; only the usual incapacity interrupts it.
 onClash(attacker){if(attacker!==this.foe||!this.run||this.run.clashCue)return;this.run.clashCue=true;
  const dir=this.f.bladePoint(1,V()).sub(this.f.bladePoint(0,V())).normalize();this.pendingCue={dir,serial:this.run.serial};
  this.events.push({type:'clashCue',t:this.guard.clock,serial:this.run.serial});}
 takeCue(){const c=this.pendingCue;this.pendingCue=null;return c;}
 protection(){const r=this.run;return r&&this.eligible()&&r.t<this.cfg.extend+this.cfg.hold&&r.age<.70?this.cfg.damageCut:0;}
 outgoing(){return this.run&&this.eligible()?this.cfg.damageKeep:1;}
 update(dt){
  const r=this.run;if(!r)return;if(!this.eligible()){this.cancel('interrupt');return;}
  const f=this.f,cfg=this.cfg,sk=f.skill;r.t+=dt*f.stamina.attackSpeed;r.age+=dt;
  const end=cfg.extend+cfg.hold;if(r.t>=end+cfg.recover){this.cancel('complete');return;}
  const c=V().copy(f.bodies.chest.translation()),inv=f.yaw.clone().invert();
  if(r.t<cfg.trackUntil){const now=V().copy(this.foe.bodies[r.kind==='forearm'?'farmS':'chest'].translation());
   r.target.copy(r.target0).add(now.sub(r.target0).clampLength(0,cfg.track));}
  const target=r.target.clone().sub(c).applyQuaternion(inv);
  const axis=target.sub(r.cover).normalize();
  const e=smooth(r.t/cfg.extend),set=smooth(r.t/.12),recovery=r.t>end?smooth((r.t-end)/cfg.recover):0;
  const h=r.h0.clone().lerp(r.cover,set).addScaledVector(axis,cfg.reach*e*(1-recovery));
  const dir=r.d0.clone().lerp(axis,set).normalize(),w=smooth(r.t/.035)*(1-recovery);
  const b=r.body;
  Object.assign(sk.thrustPose,{w,hand:h.toArray(),dir:dir.toArray(),pelvisYaw:cfg.bodyTarget?b.pelvisYaw+(-20*rad-b.pelvisYaw)*set:b.pelvisYaw+8*rad*e,chestYaw:cfg.bodyTarget?b.chestYaw+(-20*rad-b.chestYaw)*set:b.chestYaw+10*rad*e,pitch:cfg.bodyTarget?b.pitch+(8*rad-b.pitch)*set:b.pitch+2*rad*e,drop:cfg.bodyTarget?b.drop+(.07-b.drop)*set:b.drop+.02*e});
  sk.thrustPush=r.t<end;sk.activity=Math.max(sk.activity,w);
  if(this.samples.length<16000)this.samples.push({t:this.guard.clock,serial:r.serial,elapsed:r.t,hand:h.toArray(),dir:dir.toArray(),protection:this.protection(),tip:f.bladePoint(1,V()).toArray()});
 }
}
export function installPress(f,foe,guard,config){const m=new PressOpposition(f,foe,guard,config);guard.opposition=m;return m;}

// Same damage-stage convention as the game's flow shield: wound severity for
// sharp hits, damage energy for blunt hits. No artificial collision/weapon impulse.
export function adjustPressHit(hit,attacker,victim){
 if(!hit)return hit;
 const a=attacker?.parryGuard?.opposition,v=victim?.parryGuard?.opposition;
 const dealt=a instanceof PressOpposition?a.outgoing():1,kept=v instanceof PressOpposition?1-v.protection():1;
 const k=dealt*kept;if(k===1)return hit;
 const r={...hit,pressTrade:{dealt,kept,rawSeverity:hit.severity,rawEnergy:hit.energy}};
 if(r.type==='blunt')r.energy*=k;else r.severity*=k;
 return r;
}
export function installPressDamage(combat){
 if(combat.pressDamageInstalled)return;combat.pressDamageInstalled=true;
 const analyze=combat.analyze.bind(combat);
 combat.analyze=(pr,...args)=>adjustPressHit(analyze(pr,...args),pr.w.fighter,pr.v.fighter);
}
