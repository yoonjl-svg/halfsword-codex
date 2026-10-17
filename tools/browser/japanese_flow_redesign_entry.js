// Loaded only by the isolated human-test build, before game entry.
import {FLOW_RECOVERY} from '../../src/nagashi_recovery.js';
import {FLOW_REDESIGN} from '../../src/nagashi_redesign.js';
import {installAdaptiveFlowPoses} from '../sim/japanese_flow_redesign_poses.mjs';
import {installFlowPractice} from '../sim/japanese_recovery_practice.mjs';
const q=new URLSearchParams(location.search);
const raw=q.get('redesign')??'core';
const allowed=['base','core','horizontal'];
const value=allowed.includes(raw)?raw:'core';
Object.assign(FLOW_REDESIGN,{on:value!=='base',naturalExhaust:value!=='base'});
Object.assign(FLOW_RECOVERY,{seconds:0,release:value!=='base'});
// Test data is held in this tab, separate from the main game's save/account.
const memory=new Map();
for(const name of ['localStorage','sessionStorage'])Object.defineProperty(window,name,{configurable:true,value:{getItem:k=>memory.get(`${name}:${k}`)??null,setItem:(k,v)=>memory.set(`${name}:${k}`,String(v)),removeItem:k=>memory.delete(`${name}:${k}`),clear:()=>{for(const k of memory.keys())if(k.startsWith(name+':'))memory.delete(k);},key:i=>[...memory.keys()].filter(k=>k.startsWith(name+':'))[i]?.slice(name.length+1)??null,get length(){return [...memory.keys()].filter(k=>k.startsWith(name+':')).length;}}});
await import('../../src/game_entry.js');
const state=window.flowLab={value,role:q.get('role')??'defender',mode:q.get('practice')==='1'?'practice':'duel',flows:[0,0],penalties:[0,0],last:null};
let fighter=null,last=[null,null],seenStep=-1;
function poll(){
 const g=window.game;
 if(g?.player&&fighter!==g.player){
  fighter=g.player;state.flows=[0,0];state.penalties=[0,0];last=[null,null];seenStep=-1;
  if(state.mode==='practice'){
   installFlowPractice(g,state.role);
   if(state.role==='defender'){
    const name=q.get('direction')??'zwerch',tech=g.ai.school.tech.find(t=>t.name===name);
    if(tech)g.ai.pickTech=()=>tech;
   }
  }
  if(value==='horizontal')installAdaptiveFlowPoses(g);
  const nagashi=g.combat.nagashi.bind(g.combat);
  g.combat.nagashi=(...args)=>{const defender=nagashi(...args);if(defender){state.flows[defender.index]++;state.last={d:defender.index,t:g.stats.simTime};}return defender;};
 }

 if(g?.player)for(const [i,f] of [g.player,g.enemy].entries())if(f.lastFlowPenalty&&last[i]!==f.lastFlowPenalty){last[i]=f.lastFlowPenalty;if(f.lastFlowPenalty.charged)state.penalties[i]++;}
 parent.postMessage({type:'stillness-flow-redesign-lab',...state,gameState:g?.state},location.origin);
 requestAnimationFrame(poll);
}
poll();

window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===parent&&e.data?.type==='lab-pause'&&window.game?.state==='fight')document.getElementById('btnPause')?.click();});
