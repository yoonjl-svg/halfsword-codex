// Research: keep the physical contact, then move our own hand/blade through it.
// Uses existing motors. No attacker state correction or extra impulse.
import * as THREE from 'three';
import {PlayerParryGuard} from '../../src/parry_button.js';
const R=Math.PI/180,clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
export const SWEEPS=[
 {id:'base'},
 {id:'hold',duration:.20,hold:.08,recover:.16,hand:[0,0,0],angle:[0,0]},
 {id:'side',duration:.20,hold:.08,recover:.16,hand:[0,0,.18],angle:[0,28]},
 {id:'up',duration:.20,hold:.08,recover:.16,hand:[0,.10,.12],angle:[20,20]},
 {id:'down',duration:.20,hold:.08,recover:.16,hand:[0,-.08,.14],angle:[-16,24]},
 {id:'draw',duration:.20,hold:.08,recover:.16,hand:[-.08,.04,.14],angle:[10,32]},
];
// Sample the actual moving blade segments. No AI intention/attack identifiers.
function approaching(f){
 const foe=f.foe;if(!foe?.armed)return null;
 let best=null;
 for(const u of [.25,.5,.75,1])for(const v of [.25,.5,.75,1]){
  const a=f.bladePoint(u),b=foe.bladePoint(v),delta=a.clone().sub(b),d=delta.length();if(d<.015)continue;
  const va=f.sword.velocityAtPoint(a),vb=foe.sword.velocityAtPoint(b);
  const closing=new THREE.Vector3(vb.x-va.x,vb.y-va.y,vb.z-va.z).dot(delta.multiplyScalar(1/d));
  const eta=(d-.035)/closing;
  if(closing>.8&&d<.65&&eta>0&&eta<.22&&(!best||eta<best.eta))best={point:a.clone().add(b).multiplyScalar(.5),d,eta};
 }
 return best;
}
export function installContactSweep(f,owner,cfg){
 if(!cfg.hand||f.swordArt?.tradition!=='iberian'||f.schoolParry===false||!f.skill?._cover)return null;
 const sk=f.skill,state={run:null,events:[],last:-Infinity,phase:'idle',speed:0,pressed:-Infinity,wasHeld:false};sk._contactSweep=state;
 const valid=()=>owner.held&&owner.active&&!owner.broken&&f.alive&&f.armed&&!f.stamina.exhausted&&!sk.tap&&!sk.pom&&!sk.sec;
 const step=owner.step.bind(owner);
 owner.step=dt=>{
  const out=step(dt),clock=owner.clock;
  if(owner.held&&!state.wasHeld)state.pressed=clock;
  state.wasHeld=!!owner.held;
  if(!valid()){state.run=null;state.speed=0;state.phase='idle';return out;}
  const st=sk._cover,fe=f.feel;
  const near=cfg.trigger==='near'?approaching(f):null;
  const contact=fe?.touching&&fe.time<=dt*1.1&&fe.impact>.1;
  if(!state.run&&clock-state.last>.65&&(cfg.pressWindow==null||clock-state.pressed<=cfg.pressWindow)&&(near||contact)&&st.own&&st.w>.15&&['highL','highR'].includes(owner.defLine)){
   const chest=new THREE.Vector3().copy(f.bodies.chest.translation());
   const point=near?.point??fe.point;
   const side=cfg.side==='line'?(owner.defLine==='highL'?-1:1):Math.sign(point.clone().sub(chest).dot(f.right(new THREE.Vector3())))|| (owner.defLine==='highL'?-1:1);
   const along=g=>{const a=g.bladePoint(0),ab=g.bladePoint(1).sub(a);return point.clone().sub(a).dot(ab)/ab.lengthSq();};
   const atD=along(f),atO=along(f.foe);
   const lever=(f.foe.weaponCfg.hiltLength+Math.max(0,atO)*f.foe.weaponCfg.bladeLength)/(f.weaponCfg.hiltLength+Math.max(0,atD)*f.weaponCfg.bladeLength);
   const gain=cfg.leverage?clamp((lever-cfg.leverage[0])/(cfg.leverage[1]-cfg.leverage[0])):1;
   const push=fe.normal.clone().negate();
   const outward=point.clone().sub(chest).normalize().dot(push);
   const guideGain=cfg.normalGuide?clamp((outward-.1)/.4):1;
   // If this contact cannot carry the other blade away from the body, leave
   // the ordinary guard untouched; do not lock it for a zero-strength sweep.
   if(cfg.onlyOutward&&guideGain<.25)return out;
   state.run={t:0,line:owner.defLine,threat:owner.threatId,side,hand:null,prev:null,gain,push:push.applyQuaternion(f.yaw.clone().invert()),guideGain};state.last=clock;
   state.events.push({t:clock,line:owner.defLine,side,point:point.toArray(),J:near?0:fe.impact,trigger:near?'near':'contact',eta:near?.eta??0,atD,atO,lever,gain,outward,guideGain});
  }
  const run=state.run;
  if(run&&owner.threatId!==run.threat){state.run=null;state.phase='new-threat';state.speed=0;}
  if(state.run){owner.mode='defend';owner.defLine=state.run.line;owner.line=state.run.line;owner.timer=Math.max(owner.timer,dt*2);}
  sk.guardDrive=Math.max(sk.guardDrive,state.speed);
  return out;
 };
 const update=sk.update.bind(sk);
 sk.update=dt=>{
  const result=update(dt),run=state.run,p=sk.thrustPose;
  if(!run||!valid()||!sk._cover.own)return result;
  if(!run.hand){
   run.hand=[...p.hand];run.dir=[...p.dir];
   if(cfg.origin==='actual'){
    const inv=f.yaw.clone().invert();
    run.hand=new THREE.Vector3().copy(f.sword.translation()).sub(new THREE.Vector3().copy(f.bodies.chest.translation())).applyQuaternion(inv).toArray();
    run.dir=f.bladePoint(1).sub(f.bladePoint(0)).normalize().applyQuaternion(inv).toArray();
   }
   run.el=Math.asin(run.dir[1])/R;run.az=Math.atan2(run.dir[2],run.dir[0])/R;
  }
  run.t+=dt;
  const progress=smooth(run.t/cfg.duration),back=smooth((run.t-cfg.duration-cfg.hold)/cfg.recover),w=progress*(1-back);
  if(back>=1){state.run=null;state.speed=0;state.phase='idle';return result;}
  state.phase=back>0?'recover':run.t>cfg.duration?'carry':'sweep';
  const actual=cfg.origin==='actual', travel=(actual?progress:w)*run.gain;
  const el=(run.el+cfg.angle[0]*travel)*R,az=(run.az+run.side*cfg.angle[1]*travel)*R;
  const dir=[Math.cos(el)*Math.cos(az),Math.sin(el),Math.cos(el)*Math.sin(az)];
  for(let i=0;i<3;i++){
   const hand=run.hand[i]+cfg.hand[i]*travel*(i===2?run.side:1);
   p.hand[i]=actual?hand*(1-back)+p.hand[i]*back:hand;
   p.dir[i]=actual?dir[i]*(1-back)+p.dir[i]*back:dir[i];
  }
  if(actual){const norm=Math.hypot(...p.dir);for(let i=0;i<3;i++)p.dir[i]/=norm;}
  if(cfg.normalGuide){
   const push=run.push.toArray(),d=cfg.normalGuide*w*run.guideGain;
   for(let i=0;i<3;i++){p.hand[i]+=push[i]*d*.4;p.dir[i]+=push[i]*d;}
   const norm=Math.hypot(...p.dir);for(let i=0;i<3;i++)p.dir[i]/=norm;
  }
  if(cfg.body){p.pelvisYaw-=run.side*cfg.body*.5*w*run.gain*R;p.chestYaw-=run.side*cfg.body*w*run.gain*R;}
  // Body targets use the opposite yaw sign from the blade's lateral azimuth.
  if(cfg.bodyFollow){p.pelvisYaw+=run.side*cfg.bodyFollow*.5*w*run.gain*R;p.chestYaw+=run.side*cfg.bodyFollow*w*run.gain*R;}
  if(run.prev){const dh=Math.hypot(...p.hand.map((v,i)=>v-run.prev.hand[i]));const da=Math.acos(Math.max(-1,Math.min(1,p.dir.reduce((s,v,i)=>s+v*run.prev.dir[i],0))));state.speed=(dh+da*f.weaponCfg.bladeLength*.65)/dt;}
  run.prev={hand:[...p.hand],dir:[...p.dir]};
  return result;
 };
 return state;
}
export function contactGuard(cfg){return class extends PlayerParryGuard{constructor(me,foe){super(me,foe);installContactSweep(me,this,cfg);}};}

// Same motion for ordinary AI defense. AI keeps its decisions, reactions,
// techniques and footwork; only a defense already chosen by the AI is eligible.
export function installAiContactSweep(f,ai,cfg){
 const proxy={};
 for(const key of ['mode','defLine','line','timer','threatId'])Object.defineProperty(proxy,key,{get:()=>ai[key],set:v=>{ai[key]=v;}});
 Object.defineProperties(proxy,{clock:{get:()=>f.stamina.time},held:{get:()=>ai.mode==='defend'&&!ai.defVoid},active:{get:()=>ai.mode==='defend'&&!ai.defVoid},broken:{get:()=>ai.mode!=='defend'||!!ai.defVoid}});
 const update=ai.update.bind(ai);proxy.step=dt=>{f.skill.guardDrive=0;return update(dt);};
 const state=installContactSweep(f,proxy,cfg);
 if(state)ai.update=dt=>proxy.step(dt);
 return state;
}
