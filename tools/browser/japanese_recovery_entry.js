// Loaded only by the isolated human-test build, before game entry.
import {FLOW_RECOVERY} from '../../src/nagashi_recovery.js';
import {installFlowPractice} from '../sim/japanese_recovery_practice.mjs';
const q=new URLSearchParams(location.search);
const raw=q.get('recovery')??'0.36';
const allowed=['base','0','0.18','0.24','0.30','0.36','0.45'];
const value=allowed.includes(raw)?raw:'0.36';
Object.assign(FLOW_RECOVERY,{seconds:value==='base'?0:+value,release:value!=='base'});
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
  if(state.mode==='practice')installFlowPractice(g,state.role);
  const nagashi=g.combat.nagashi.bind(g.combat);
  g.combat.nagashi=(...args)=>{const defender=nagashi(...args);if(defender){state.flows[defender.index]++;state.last={d:defender.index,t:g.stats.simTime};}return defender;};
 }

 if(g?.player)for(const [i,f] of [g.player,g.enemy].entries())if(f.flowRecovery&&last[i]!==f.flowRecovery){last[i]=f.flowRecovery;state.penalties[i]++;}
 parent.postMessage({type:'stillness-flow-lab',...state,gameState:g?.state},location.origin);
 requestAnimationFrame(poll);
}
poll();

window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===parent&&e.data?.type==='lab-pause'&&window.game?.state==='fight')document.getElementById('btnPause')?.click();});
