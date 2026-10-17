// Human-style repeating downward drags against the unmodified Japanese AI.
// Preparation is explicit and charged by the real stamina stroke detector.
import {trial} from './japanese_recovery.mjs';
import {DT} from './harness_m.mjs';
import {writeFileSync} from 'node:fs';
import {installFlowPractice} from './japanese_recovery_practice.mjs';
const out=process.env.OUT??'/workspace/japanese-recovery-20261017';
for(const duration of [0,.36]){
 const rows=[];
 for(const seed of (process.env.PRACTICE?[681,682]:[681,682,683,684,685,686]))for(const weapon of ['longsword','qinggang']){
  const commands=[];let prev=-1;
  const r=trial({duration,release:duration>0,seed,weapon,atk:'uchigatana',policy:'attacker',seconds:30,onStart(G,g){if(process.env.PRACTICE)installFlowPractice(G,'attacker');G.before=()=>{
   const f=G.player,t=G.t,d=f.foeDistance(),phase=(t%2.1),stage=phase<.65?0:phase<.88?1:2;
   g.held=false;g.broken=f.skill.swinging;g.step(DT);
   const active=stage<2&&d<2.3&&!f.stamina.exhausted&&f.alive;
   f.handHeld=active;f.inputActive=active;
   if(active){const x=stage===0?.12:-.38,y=stage===0?.78:-.85,speed=stage===0?2.3:6.2;f.handOffset.x+=Math.max(-speed*DT,Math.min(speed*DT,x-f.handOffset.x));f.handOffset.y+=Math.max(-speed*DT,Math.min(speed*DT,y-f.handOffset.y));}
   if(stage!==prev){commands.push({t,stage,active});prev=stage;}
   f.move.set(.1*Math.sin(t),d>(process.env.PRACTICE?1.35:1.75)?.4:d<(process.env.PRACTICE?1.05:1.3)?-.45:0);f.stickX=f.move.x;f.stickY=f.move.y;
  };}});
  r.attackCommands=commands;r.practice=!!process.env.PRACTICE;rows.push(r);writeFileSync(`${out}/attacker${process.env.PRACTICE?'-practice':''}-${duration}.json`,JSON.stringify(rows));console.log(JSON.stringify({duration,seed,weapon,t:r.duration,flows:r.flows.length,penalties:r.events.filter(e=>e.who===0).length,alive:r.health.end.alive,blood:r.health.bloodLost,limb:r.health.limbLost,concussion:r.health.concussion}));
 }
}
