// Research only: physical opposition thrust; no additional impulses or damage modifiers.
import * as THREE from 'three';
import {STAMINA} from './config.js';
const V=()=>new THREE.Vector3(), smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
export const PRESETS={
 base:{off:true}, normal:{ordinary:true},
 hold:{aim:.10,extend:.20,reach:.20,turn:.35,side:.025},
 middle:{aim:.08,extend:.24,reach:.28,turn:.65,side:.04},
 direct:{aim:.06,extend:.24,reach:.34,turn:1,side:.04},
 slow:{aim:.12,extend:.32,reach:.28,turn:.65,side:.04},
};
export function installOpposition(f,foe,guard,options={}){
 const cfg={window:.30,hold:.08,recover:.20,maxGap:1.85,minVn:.6,...PRESETS[options.variant??'middle'],...options};
 const out={cfg,events:[],contacts:[],run:null,time:0,lastHeld:false,pressed:-100,used:false,serial:0};
 const gs=guard.step.bind(guard),su=f.skill.update.bind(f.skill),sk=f.skill;
 guard.step=dt=>{
  out.time+=dt;
  if(guard.held&&!out.lastHeld){out.pressed=out.time;out.used=false;out.serial++;}
  out.lastHeld=guard.held;
  const pad=f.handOffset.clone();gs(dt);
  if(out.run){f.handOffset.copy(pad);sk.prev.copy(pad);}
 };
 out.cancel=reason=>{if(out.run)out.events.push({type:'end',reason,t:out.time});out.run=null;sk.thrustPose.w=0;sk.thrustPush=false;};
 sk.update=dt=>{
  if(out.run){sk.thrustPose.w=0;sk.thrustPush=false;}
  su(dt);
  const r=out.run;if(!r)return;
  if(!guard.held||f.stamina.exhausted||!f.alive||!f.armed||!foe.alive||!['stand','kneel'].includes(f.state)||sk.tap||sk.sec||sk.pom){out.cancel('interrupt');return;}
  r.t+=dt*f.stamina.attackSpeed;
  const end=cfg.aim+cfg.extend+cfg.hold,total=end+cfg.recover;
  if(r.t>=total){out.cancel('complete');return;}
  const e=smooth((r.t-cfg.aim)/cfg.extend),a=smooth(r.t/cfg.aim),w=r.t<.04?smooth(r.t/.04):r.t<end?1:1-smooth((r.t-end)/cfg.recover);
  const axis=r.dir.clone().lerp(r.target,cfg.turn*a).normalize();
  const h=r.hand.clone().addScaledVector(axis,cfg.reach*e);
  h.z+=r.side*cfg.side*a; // hold the hilt outside the incoming blade; no large chamber.
  Object.assign(sk.thrustPose,{w,hand:h.toArray(),dir:axis.toArray(),pelvisYaw:r.body.pelvisYaw,chestYaw:r.body.chestYaw,pitch:r.body.pitch,drop:r.body.drop});
  sk.thrustPush=r.t>=cfg.aim&&r.t<end;sk.activity=Math.max(sk.activity,w);
 };
 out.clash=(point,sp,hit)=>{
  const age=out.time-out.pressed,active=guard.active&&guard.mode==='defend';
  const tip=foe.bladePoint(1,V()),ch=f.bodies.chest.translation(),vel=foe.tipVel;
  const approach=V().set(ch.x,ch.y,ch.z).sub(tip).dot(vel);
  const contact={t:out.time,age,vn:hit?.vn??0,fresh:!!hit?.fresh,active,approach,gap:f.foeDistance(),serial:out.serial,line:guard.line};
  out.contacts.push(contact);
  if(cfg.off||cfg.disabled||out.run||out.used||!guard.held||!active||age>cfg.window||age<0||!hit?.fresh||(hit.vn??0)<cfg.minVn||approach<=0||f.foeDistance()>cfg.maxGap||f.stamina.exhausted||!f.armed||!f.alive||sk.tap||sk.sec||sk.pom)return;
  out.used=true;
  const st=f.stamina,spent=st.spent.block,credit=st.blockedAttack?.get(foe)===foe.stamina.attackId?Math.min(STAMINA.blockCost*st.weight,spent):0;
  const inv=f.yaw.clone().invert(),c=V().set(ch.x,ch.y,ch.z);
  const hand=V().copy(f.sword.translation()).sub(c).applyQuaternion(inv);
  const dir=f.bladePoint(1,V()).sub(f.bladePoint(0,V())).applyQuaternion(inv).normalize();
  const target=V().copy(foe.bodies.chest.translation()).sub(c).applyQuaternion(inv).sub(hand).normalize();
  const before=st.value,oldSpend=st.spend;
  st.spend=function(kind,amount){return oldSpend.call(this,kind,kind==='attack'?Math.max(0,amount-credit):amount);};
  try{if(cfg.ordinary){sk.thrust();if(sk.tap)sk.tap.step=false;}else{st.attack('thrust');sk.thrusts++;}}finally{st.spend=oldSpend;}
  const event={type:'start',t:out.time,age,line:guard.line,serial:out.serial,attackId:st.attackId,foeAttackId:foe.stamina.attackId,credit,cost:before-st.value,hand:hand.toArray(),dir:dir.toArray(),target:target.toArray()};out.events.push(event);
  if(!cfg.ordinary){const b=f.guardPose??{};out.run={t:0,hand,dir,target,side:Math.sign(hand.z)||1,body:{pelvisYaw:b.pelvisYaw??0,chestYaw:b.chestYaw??0,pitch:b.pitch??0,drop:b.drop??0}};}
 };
 return out;
}
