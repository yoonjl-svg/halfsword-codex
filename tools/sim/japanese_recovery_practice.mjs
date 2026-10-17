import {PlayerParryGuard} from '../../src/parry_button.js';
// Explicit drill, not ordinary AI balance: the defender holds the existing
// highC roof throughout. Contact geometry and all nagashi gates remain real.
export function installFlowPractice(G,role){
 if(role==='defender'){
  const tech=G.ai.school.tech.find(t=>t.name==='oberhau');
  if(tech)G.ai.pickTech=()=>tech;
  return;
 }
 const f=G.enemy,g=new PlayerParryGuard(f,G.player);f.stamina.controller=g;
 G.ai.update=dt=>{
  const active=f.alive&&f.armed&&f.state==='stand'&&!f.stamina.exhausted;
  Object.assign(g,{held:true,active,broken:false,mode:active?'defend':'idle',line:'highC',defLine:'highC',defVoid:false});
  Object.assign(G.ai,{mode:g.mode,defLine:'highC',defVoid:false,coverLine:null});
  f.inputActive=active;f.handHeld=false;
  if(active){const pad=g.padOf('highC'),dx=pad[0]-f.handOffset.x,dy=pad[1]-f.handOffset.y,d=Math.hypot(dx,dy),step=Math.min(1,g.L.parrySpeed*dt/(d||1));f.handOffset.x+=dx*step;f.handOffset.y+=dy*step;g.stats.heldT+=dt;}
  const d=f.foeDistance();f.move.set(0,active?(d>1.9?.25:d<1.25?-.35:0):0);f.stickX=0;f.stickY=f.move.y;
 };
 return g;
}
