import {PlayerParryGuard} from '../../src/parry_button.js';
const R=Math.PI/180,clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
// Close-hand defensive cuts. Existing guard reading, muscles and collision laws.
export function closeGuard(cfg){return class extends PlayerParryGuard{
 constructor(f,foe){super(f,foe);if(f.swordArt?.tradition!=='iberian'||f.schoolParry===false||!f.skill._cover)return;
  const sk=f.skill,state=sk._closeSweep={run:null,events:[],seen:-1,last:-Infinity,speed:0,phase:'idle'};
  const step=this.step.bind(this);
  this.step=dt=>{
   const out=step(dt);
   const valid=this.held&&this.active&&!this.broken&&f.alive&&f.armed&&!f.stamina.exhausted&&!sk.tap&&!sk.pom&&!sk.sec;
   if(!valid){state.run=null;state.phase='idle';state.speed=0;return out;}
   if(this.mode==='defend'&&['highL','highR'].includes(this.defLine)&&this.threatId!==state.seen&&this.clock-state.last>.65){
    state.seen=this.threatId;state.last=this.clock;state.run={t:0,line:this.defLine,threat:this.threatId,side:this.defLine==='highL'?-1:1};state.events.push({t:this.clock,line:this.defLine});
   }
   if(state.run&&state.run.threat!==this.threatId)state.run=null;
   if(state.run){this.mode='defend';this.defLine=state.run.line;this.line=state.run.line;this.timer=Math.max(this.timer,dt*2);}
   sk.guardDrive=Math.max(sk.guardDrive,state.speed);return out;
  };
  const update=sk.update.bind(sk);
  sk.update=dt=>{
   const out=update(dt),run=state.run,p=sk.thrustPose;if(!run||!sk._cover.own)return out;
   run.t+=dt;const u=smooth(run.t/cfg.duration),back=smooth((run.t-cfg.duration-.12)/.18);
   if(back>=1){state.run=null;state.speed=0;state.phase='idle';return out;}
   state.phase=back?'recover':'sweep';
   const a=cfg.from,b=cfg.to;
   for(let i=0;i<3;i++){const v=(a.hand[i]+(b.hand[i]-a.hand[i])*u)*(i===2?run.side:1);p.hand[i]=v*(1-back)+p.hand[i]*back;}
   const el=(a.blade[0]+(b.blade[0]-a.blade[0])*u)*R,az=(a.blade[1]+(b.blade[1]-a.blade[1])*u)*run.side*R;
   const d=[Math.cos(el)*Math.cos(az),Math.sin(el),Math.cos(el)*Math.sin(az)];
   for(let i=0;i<3;i++)p.dir[i]=d[i]*(1-back)+p.dir[i]*back;
   const n=Math.hypot(...p.dir);for(let i=0;i<3;i++)p.dir[i]/=n;
   if(cfg.body){p.pelvisYaw+=run.side*cfg.body*.5*u*(1-back)*R;p.chestYaw+=run.side*cfg.body*u*(1-back)*R;}
   if(run.prev)state.speed=(Math.hypot(...p.hand.map((x,i)=>x-run.prev.hand[i]))+Math.acos(Math.max(-1,Math.min(1,p.dir.reduce((v,x,i)=>v+x*run.prev.dir[i],0))))*f.weaponCfg.bladeLength*.65)/dt;
   run.prev={hand:[...p.hand],dir:[...p.dir]};return out;
  };
 }
};}
