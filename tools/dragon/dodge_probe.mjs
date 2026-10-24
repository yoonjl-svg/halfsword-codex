import {setup,DT} from './harness.mjs';
for(const move of[[1,0],[-1,0],[.707,-.707],[0,-1]]){
 const s=setup();s.d.cool=100;s.advance(2.2);s.moveTo(s.d.position.x-3.7,0);s.d.begin('bite');s.f.move.set(...move);s.f.stickX=move[0];s.f.stickY=move[1];
 for(let i=0;i<2.5/DT;i++){s.tick();if(i%48===0)console.log('PATH',move,i*DT,JSON.stringify({p:s.f.pelvisPos,m:s.d.model.pose.mouth.toArray(),phase:s.d.phase,u:s.d.phaseU,h:s.d.heading,hits:s.d.stats.hitsTaken}));}
 s.dispose();
}
