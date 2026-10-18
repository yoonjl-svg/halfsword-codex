// Isolated human trial only. No production auto-install, no persistent save.
import {installContactSweep,installAiContactSweep} from '../sim/iberian_contact_sweep.mjs';
import {PlayerParryGuard} from '../../src/parry_button.js';
import {ARENA} from '../../src/config.js';
import {CONTROL_MODES as BEAT_MODES} from './iberian_control_modes.js';
import {installControlRecovery,linkSweepRecovery} from '../sim/contact_control_recovery.mjs';
const q=new URLSearchParams(location.search),cfg=BEAT_MODES.find(c=>c.id===q.get('beat'))??BEAT_MODES[2];
const state=window.beatLab={id:cfg.id,label:cfg.label,role:q.get('role')==='attacker'?'attacker':'defender',practice:q.get('practice')==='1',procs:[0,0],eligible:[0,0],last:null};
const memory=new Map();
for(const name of ['localStorage','sessionStorage'])Object.defineProperty(window,name,{configurable:true,value:{getItem:k=>memory.get(`${name}:${k}`)??null,setItem:(k,v)=>memory.set(`${name}:${k}`,String(v)),removeItem:k=>memory.delete(`${name}:${k}`),clear:()=>{for(const k of memory.keys())if(k.startsWith(name+':'))memory.delete(k);},key:i=>[...memory.keys()].filter(k=>k.startsWith(name+':'))[i]?.slice(name.length+1)??null,get length(){return [...memory.keys()].filter(k=>k.startsWith(name+':')).length;}}});
// Repeatable initial world; human timing and rendered effects can consume RNG later.
let seed=941;Math.random=()=>{seed=(seed+0x6d2b79f5)>>>0;let t=Math.imul(seed^seed>>>15,seed|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};
ARENA.startGap=2.2;
await import('../../src/game_entry.js');
let fighter=null,study=[],seen=[0,0],lastSend=0,controls=[];
function attachControl(owner,sweep,defender,attacker){
 const recovery=installControlRecovery(attacker,{floor:cfg.floor,seconds:cfg.controlHold+.24,holdSeconds:cfg.controlHold===.12?null:cfg.controlHold});
 controls[attacker.index]=recovery;
 linkSweepRecovery(owner,sweep,defender,recovery,{trigger(){}},()=>defender.stamina.time);
}
window.controlLabDebug={snapshot:()=>controls.map(c=>({scale:c.scale(),events:c.events}))};
function setup(g){
 fighter=g.player;controls=[];seen=[0,0];state.procs=[0,0];state.eligible=[0,0];state.last=null;
 delete g.combat.iberianBeat;
 study=[installContactSweep(g.player,g.playerGuard,cfg),null];state.config={...cfg};
 attachControl(g.playerGuard,study[0],g.player,g.enemy);
 if(state.practice&&state.role==='defender'){
  const tech=g.ai.school.tech.find(t=>t.name==='zornhau');
  if(tech){
   g.ai.pickTech=()=>tech;
   const update=g.ai.update.bind(g.ai);let next=.8;
   g.ai.update=dt=>{update(dt);const f=g.enemy,t=f.stamina.time;
    // Ask the existing AI to begin its ordinary cut at a regular drill cadence.
    // Existing windup, attack path, stamina and reactions still execute normally.
    if(t>=next&&f.alive&&f.armed&&f.state==='stand'&&!f.stamina.exhausted&&g.ai.mode!=='attack'&&f.foeDistance()<2.3){
     if(g.ai.startAttack(tech,'research-practice',{noFeint:true,noPending:true}))next=t+2;
    }
   };
  }
 }else if(state.practice){
  // Hold the real player guard on the opponent for a reliable attacker-side drill.
  // Existing reading/poses/contact gates still decide success; never force a proc.
  const f=g.enemy,guard=new PlayerParryGuard(f,g.player);f.stamina.controller=guard;
  study[1]=installContactSweep(f,guard,cfg);
  attachControl(guard,study[1],f,g.player);
  g.ai.update=dt=>{
   guard.held=f.alive&&f.armed&&!f.stamina.exhausted;guard.step(dt);
   f.inputActive=guard.active;f.handHeld=false;
   Object.assign(g.ai,{mode:guard.mode,defLine:guard.defLine,defVoid:guard.defVoid,coverLine:null});
   const d=f.foeDistance();f.move.set(0,guard.active?(d>1.9?.25:d<1.25?-.35:0):0);f.stickX=0;f.stickY=f.move.y;
  };
 }
 if(!study[1]&&!(state.practice&&state.role==='attacker')){
  study[1]=installAiContactSweep(g.enemy,g.ai,cfg);
  const owner={step:g.ai.update.bind(g.ai)};
  attachControl(owner,study[1],g.enemy,g.player);
  g.ai.update=dt=>owner.step(dt);
 }
 document.getElementById('btnTestPick')?.remove();
 const note=document.getElementById('testRouteNote');if(note)note.textContent='바깥 밀어내기 · 유지시간 비교';
}
function poll(now){
 const g=window.game;
 if(g?.player&&fighter!==g.player)setup(g);
 for(let d=0;d<2;d++)if(study[d])for(;seen[d]<study[d].events.length;seen[d]++){
  const e=study[d].events[seen[d]];state.eligible[d]++;
  if(!cfg.normalGuide||e.guideGain>.01)state.procs[d]++;
  state.last={d,t:e.t,guideGain:e.guideGain};
 }
 state.controls=controls.map(c=>({scale:c.scale(),count:c.events.length,last:c.events.at(-1)??null}));
 if(now-lastSend>100){lastSend=now;parent.postMessage({type:'stillness-beat-lab',...state,gameState:g?.state},location.origin);}
 requestAnimationFrame(poll);
}
requestAnimationFrame(poll);
window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===parent&&e.data?.type==='lab-pause'&&window.game?.state==='fight')document.getElementById('btnPause')?.click();});
