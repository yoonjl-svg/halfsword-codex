import {setup,DT} from './harness.mjs';
import {writeFileSync} from 'node:fs';
const reports=[];
for(const weapon of ['longsword','rapier']){
 const s=setup({weapon});let hits=0;
 for(let i=0;i<90/DT&&s.f.alive&&s.d.alive;i++){
  const d=s.d,f=s.f,t=i*DT,p=f.bodies.pelvis.translation(),dist=Math.hypot(p.x-d.model.pose.head.x,p.z-d.model.pose.head.z),danger=d.phase==='tell'||d.phase==='active';
  f.move.set(0,0);f.stickX=0;f.stickY=0;
  s.g.held=danger&&['nip','claw'].includes(d.attack);s.g.broken=false;
  if(danger&&!s.g.held){f.move.x=1;f.stickX=1;}
  else if(dist>2.0){f.move.y=1;f.stickY=1;}
  else if(dist<1.4){f.move.y=-1;f.stickY=-1;}
  if(!s.g.held&&!danger){f.handOffset.x=.48*Math.sin(t*5);f.handOffset.y=.10+.33*Math.cos(t*5);f.inputActive=true;if(weapon==='rapier'&&i%100===0)f.skill.thrust({step:false});}else f.inputActive=false;
  s.tick();
 }
 reports.push({weapon,seconds:s.d.time,alive:s.f.alive,blood:s.f.blood,health:s.d.health,stats:s.d.stats,stamina:s.f.stamina.value});console.log(reports.at(-1));s.dispose();
}
writeFileSync('docs/design/dragon_fixed_20261024/play_probe.json',JSON.stringify(reports,null,2));
