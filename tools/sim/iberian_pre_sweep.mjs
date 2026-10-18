import {PlayerParryGuard} from '../../src/parry_button.js';
const R=Math.PI/180,clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
export const PRE_SWEEPS=[
 {id:'center50',kind:'pre',elevation:50,duration:.24,sweep:0},
 {id:'center70',kind:'pre',elevation:70,duration:.24,sweep:0},
 {id:'cross50',kind:'pre',elevation:50,duration:.24,sweep:1},
 {id:'cross70',kind:'pre',elevation:70,duration:.24,sweep:1},
 {id:'crossFast',kind:'pre',elevation:60,duration:.16,sweep:1},
 {id:'crossSlow',kind:'pre',elevation:60,duration:.32,sweep:1},
];
export function preGuard(cfg){return class extends PlayerParryGuard{
 constructor(f,foe){super(f,foe);if(f.swordArt?.tradition!=='iberian'||f.schoolParry===false)return;
  const sk=f.skill,st={events:[],run:null,phase:'idle',weight:0,own:false,keep:null,speed:0,seen:null,last:-Infinity};sk._preSweep=st;
  const step=this.step.bind(this);this.step=dt=>{const out=step(dt);sk.guardDrive=Math.max(sk.guardDrive,st.speed);return out;};
  const update=sk.update.bind(sk);sk.update=dt=>{
   const p=sk.thrustPose;
   if(st.own&&!sk.tap&&!sk.pom&&!sk.sec){p.w=0;if(st.keep)Object.assign(p,st.keep);st.own=false;}
   const result=update(dt);
   const valid=this.active&&this.held&&!this.broken&&f.alive&&f.armed&&!f.stamina.exhausted&&!sk.tap&&!sk.pom&&!sk.sec;
   const use=valid&&(this.mode==='idle'||['highL','highR','highC'].includes(this.defLine));
   if(!use){st.weight=0;st.run=null;st.phase='idle';st.speed=0;return result;}
   if(cfg.sweep&&this.mode==='defend'&&['highL','highR'].includes(this.defLine)&&this.threatId!==st.seen&&this.clock-st.last>.60){
    st.seen=this.threatId;st.last=this.clock;st.run={t:0,side:this.defLine==='highL'?-1:1};st.events.push({t:this.clock,line:this.defLine});
   }
   let u=0,side=1;
   if(st.run){st.run.t+=dt;side=st.run.side;u=smooth(st.run.t/cfg.duration)*(1-smooth((st.run.t-cfg.duration-.08)/.26));if(st.run.t>cfg.duration+.34)st.run=null;}
   st.phase=u>0?'sweep':'ready';
   st.keep={pelvisYaw:p.pelvisYaw,chestYaw:p.chestYaw,pitch:p.pitch,drop:p.drop};st.own=true;st.weight=Math.min(1,st.weight+dt/.08);
   const hand=[.38+.02*u,.20+.04*u,.03*(1-u)+side*.34*u];
   const el=(cfg.elevation+(32-cfg.elevation)*u)*R,az=side*38*u*R,dir=[Math.cos(el)*Math.cos(az),Math.sin(el),Math.cos(el)*Math.sin(az)];
   if(st.prev){st.speed=(Math.hypot(...hand.map((v,i)=>v-st.prev.hand[i]))+Math.acos(Math.max(-1,Math.min(1,dir.reduce((s,v,i)=>s+v*st.prev.dir[i],0))))*f.weaponCfg.bladeLength*.65)/dt;}
   st.prev={hand,dir};
   for(let i=0;i<3;i++){p.hand[i]=hand[i];p.dir[i]=dir[i];}
   p.w=Math.max(p.w,st.weight);p.pelvisYaw=-side*24*u*R;p.chestYaw=-side*35*u*R;p.pitch=R;p.drop=.02;
   return result;
  };
 }
};}
