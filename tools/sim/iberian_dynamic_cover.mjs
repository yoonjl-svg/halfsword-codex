// RESEARCH ONLY: ordinary arm/wrist motors follow a moving defensive pose.
// No impulse, attacker correction, strength multiplier, or durability exception.
import {PlayerParryGuard} from '../../src/parry_button.js';
import * as THREE from 'three';
const RAD=Math.PI/180;
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
const lerp=(a,b,t)=>a+(b-a)*t;
export const PATHS={
 compact:{duration:.36,returnTime:.24,handStart:[.40,.39,.22],handEnd:[.42,.25,.52],bladeStart:[50,-14],bladeEnd:[29,24]},
 broad:{duration:.44,returnTime:.28,handStart:[.38,.43,-.02],handEnd:[.43,.20,.57],bladeStart:[58,-30],bladeEnd:[24,38]},
 carry:{duration:.28,returnTime:.30,handStart:[.41,.32,.40],handEnd:[.43,.27,.59],bladeStart:[38,6],bladeEnd:[32,34],approach:true,cooldown:.7},
 guided:{duration:.28,returnTime:.30,handStart:[.41,.32,.40],handEnd:[.43,.27,.59],bladeStart:[38,6],bladeEnd:[32,34],approach:true,cooldown:.7,follow:true},
 lateral:{duration:.30,returnTime:.30,handStart:[.41,.32,.40],handEnd:[.42,.36,.55],bladeStart:[38,6],bladeEnd:[43,30],approach:true,cooldown:.7,follow:true,bodyYaw:12,chestYaw:22},
};

export function installDynamicCover(fighter,owner,config){
 if(fighter.swordArt?.tradition!=='iberian'||fighter.schoolParry===false||!fighter.skill?._cover)return null;
 const sk=fighter.skill,original=sk.update.bind(sk),state={events:[],phase:'idle',lastThreat:null,lastStart:-Infinity,run:null};
 sk._dynamicBeat=state;
 sk.update=dt=>{
  const result=original(dt),st=sk._cover,p=sk.thrustPose;
  const allowed=owner.active&&owner.held&&!owner.broken&&fighter.alive&&fighter.armed&&!fighter.stamina.exhausted&&!sk.tap&&!sk.pom&&!sk.sec;
  if(!allowed){state.run=null;state.phase='idle';return result;}
  const line=owner.defLine;
  let entering=true;
  if(config.approach){
   const foe=fighter.foe,a=foe?.bladePoint(.65,new THREE.Vector3()),chest=fighter.bodies.chest.translation();
   if(!a)entering=false;
   else {const to=new THREE.Vector3().copy(chest).sub(a),distance=to.length();const closing=foe.hitPointVel.dot(to.normalize());entering=closing>.8&&distance<1.4&&(distance-.30)/closing<.38;}
  }
  if(owner.mode==='defend'&&['highL','highR'].includes(line)&&owner.threatId!==state.lastThreat&&owner.clock-state.lastStart>=(config.cooldown??0)&&entering){
   state.lastThreat=owner.threatId;
   state.lastStart=owner.clock;
   state.run={t:0,line,threatId:owner.threatId,side:line==='highL'?-1:1,baseHand:[...p.hand],baseDir:[...p.dir]};
   state.events.push({t:owner.clock,line,threatId:owner.threatId});
  }
  const run=state.run;
  // Follow mode lets the existing cover fade finish the sweep after contact;
  // a newly detected threat always takes priority, as does releasing/attacking.
  if(!run||(config.follow?owner.threatId!==run.threatId:line!==run.line)||!st.own){state.phase='idle';return result;}
  run.t+=dt;
  const u=smooth(run.t/config.duration),back=smooth((run.t-config.duration)/config.returnTime);
  if(back>=1){state.phase='settled';return result;}
  state.phase=back>0?'recover':'sweep';
  const baseHand=config.follow?run.baseHand:[...p.hand],baseDir=config.follow?run.baseDir:[...p.dir];
  for(let i=0;i<3;i++)p.hand[i]=lerp(lerp(config.handStart[i],config.handEnd[i],u)*(i===2?run.side:1),baseHand[i],back);
  const el=lerp(config.bladeStart[0],config.bladeEnd[0],u)*RAD;
  const az=lerp(config.bladeStart[1],config.bladeEnd[1],u)*run.side*RAD;
  const dir=[Math.cos(el)*Math.cos(az),Math.sin(el),Math.cos(el)*Math.sin(az)];
  for(let i=0;i<3;i++)p.dir[i]=lerp(dir[i],baseDir[i],back);
  const n=Math.hypot(...p.dir);for(let i=0;i<3;i++)p.dir[i]/=n;
  if(config.bodyYaw){p.pelvisYaw-=run.side*config.bodyYaw*RAD*u*(1-back);p.chestYaw-=run.side*config.chestYaw*RAD*u*(1-back);}
  // Motor force / footwork / cover weighting remain unchanged.
  return result;
 };
 return state;
}
export function dynamicGuard(config){return class extends PlayerParryGuard{
 constructor(me,foe){super(me,foe);installDynamicCover(me,this,config);}
};}
