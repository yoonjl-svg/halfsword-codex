import {Particles} from '../../src/effects.js';
import {Sound} from '../../src/sound.js';
import {installBody} from '../../src/italian_body_research.js';
import {PlayerParryGuard} from '../../src/parry_button.js';
import {ARENA,SKILL} from '../../src/config.js';
// Human trial only: count actual weapon contact without tip/chest direction, attack expiry, distance or recent-injury gates.
// Keep a real collision, held/active guard, one trigger per press/attack, and interruption safety.
SKILL.itOppositionVals={...SKILL.itOppositionVals,window:Infinity,relaxedContact:true,minVn:.2,maxGap:Infinity,injuryGrace:0};
const ids=['baseline','body'];
const q=new URLSearchParams(location.search),id=ids.includes(q.get('mode'))?q.get('mode'):'body';
const state=window.rapierLab={id,role:q.get('role')==='attacker'?'attacker':'defender',impulse:q.get('impulse')!=='0',windowSeconds:SKILL.itOppositionVals.window,relaxedContact:true,starts:0,beats:0,lastJ:0};
const memory=new Map();
for(const name of ['localStorage','sessionStorage'])Object.defineProperty(window,name,{configurable:true,value:{getItem:k=>memory.get(`${name}:${k}`)??null,setItem:(k,v)=>memory.set(`${name}:${k}`,String(v)),removeItem:k=>memory.delete(`${name}:${k}`),clear:()=>{for(const k of memory.keys())if(k.startsWith(name+':'))memory.delete(k);},key:i=>[...memory.keys()].filter(k=>k.startsWith(name+':'))[i]?.slice(name.length+1)??null,get length(){return [...memory.keys()].filter(k=>k.startsWith(name+':')).length;}}});
// Repeatable initial world; human timing and rendered effects can consume RNG later.
let seed=941;Math.random=()=>{seed=(seed+0x6d2b79f5)>>>0;let t=Math.imul(seed^seed>>>15,seed|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};
// Passive browser verification only; never injects a clash or an effect.
if(q.get('probe')==='1'){
 const probe=window.bodyCueProbe={sparks:[],sounds:[]};
 const update=Particles.prototype.update;
 Particles.prototype.update=function(dt){return update.call(this,probe.freezeParticles?0:dt);};
 const sparks=Particles.prototype.flowSparks;
 Particles.prototype.flowSparks=function(point,dir,...rest){
  const before=this.list.length;const result=sparks.call(this,point,dir,...rest);
  probe.sparks.push({point:point.toArray(),dir:dir?.toArray(),added:this.list.length-before});return result;
 };
 const flow=Sound.prototype.flow;
 Sound.prototype.flow=function(impact){probe.sounds.push({impact,enabled:this._on,state:this.ctx?.state});return flow.call(this,impact);};
}
ARENA.startGap=2.2;
await import('../../src/game_entry.js');

let fighter=null,mod=null,lastSend=0;
function setup(g){
 fighter=g.player;state.starts=state.beats=state.lastJ=0;
 if(state.role==='defender'){
  mod=installBody(g.player,g.enemy,g.playerGuard,'strongBind'+(state.impulse?'':'Off'),id==='body');
  const tech=g.ai.school.tech.find(t=>t.name==='zwerchL');
  if(tech){g.ai.pickTech=()=>tech;const update=g.ai.update.bind(g.ai);let next=.8;
   g.ai.update=dt=>{update(dt);const f=g.enemy,t=f.stamina.time;
    if(t>=next&&f.alive&&f.armed&&f.state==='stand'&&!f.stamina.exhausted&&g.ai.mode!=='attack'&&f.foeDistance()<2.3)
     if(g.ai.startAttack(tech,'research-practice',{noFeint:true,noPending:true}))next=t+2;
   };
  }
 }else{
  const f=g.enemy,foe=g.player,guard=new PlayerParryGuard(f,foe);f.stamina.controller=guard;
  mod=installBody(f,foe,guard,'strongBind'+(state.impulse?'':'Off'),id==='body');
  let quiet=1,holdTo=-1;
  g.ai.update=dt=>{
   const t=f.stamina.time,tip=foe.tipPrev,v=foe.tipVel,c=f.bodies.chest.translation();
   const incoming=tip&&v.length()>3.5&&(c.x-tip.x)*v.x+(c.y-tip.y)*v.y+(c.z-tip.z)*v.z>0;
   if(incoming&&f.foeDistance()<3.2){if(quiet>.25)holdTo=t+.40;quiet=0;}else quiet+=dt;
   guard.held=f.alive&&f.armed&&!f.stamina.exhausted&&(t<holdTo||!!mod.run);guard.step(dt);
   f.inputActive=guard.active;f.handHeld=false;
   Object.assign(g.ai,{mode:guard.mode,defLine:guard.defLine,defVoid:guard.defVoid,coverLine:null});
   const d=f.foeDistance();f.move.set(0,d>1.75?.3:d<1.1?-.25:0);f.stickX=0;f.stickY=f.move.y;
  };
 }
 const onClash=g.combat.hooks.onClash;
 g.combat.hooks.onClash=(point,speed,touch)=>{
  const cue=mod.takeCue();
  onClash?.(point,speed,cue?{...touch,opposition:cue}:touch);
 };
 state.config={...mod.cfg,bodyEnabled:mod.bodyEnabled};document.getElementById('btnTestPick')?.remove();
 window.rapierLabDebug={mod,events:()=>mod.events};
}
function poll(now){
 const g=window.game;if(g?.player&&fighter!==g.player)setup(g);
 if(mod){state.starts=mod.events.filter(e=>e.type==='start').length;const beats=mod.events.filter(e=>e.type==='beat');state.beats=beats.length;state.lastJ=beats.at(-1)?.J??0;state.active=!!mod.run;}
 if(now-lastSend>100){lastSend=now;parent.postMessage({type:'stillness-rapier-lab',...state,gameState:g?.state},location.origin);}
 requestAnimationFrame(poll);
}requestAnimationFrame(poll);
window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===parent&&e.data?.type==='lab-pause'&&window.game?.state==='fight')document.getElementById('btnPause')?.click();});
