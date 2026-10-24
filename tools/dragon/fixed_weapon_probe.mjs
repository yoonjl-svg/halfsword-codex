import {setup,DT} from './harness.mjs';
for(const weapon of ['longsword','rapier','uchigatana','qinggang','zweihander','morgenstern','druid_whip']){
 const s=setup({weapon});s.d.heading=Math.PI;s.d.phase='recover';s.d.phaseU=.15;s.d.attack='bite';s.advance(2.2,{brain:false});s.moveTo(-1.3,0);
 for(let i=0;i<10/DT;i++){
  const t=i*DT;s.f.handOffset.x=.48*Math.sin(t*4.6);s.f.handOffset.y=.10+.33*Math.cos(t*4.6);
  if(weapon==='rapier'&&i%120===0)s.f.skill.thrust({step:false});
  s.tick({brain:false});
 }
 console.log(weapon,JSON.stringify({damage:s.d.stats.damageDealt,hits:s.d.stats.playerHits,head:s.d.model.pose.head.toArray(),pos:s.f.pelvisPos,events:s.events.filter(e=>e.type==='hit').map(e=>+e.damage.toFixed(2))}));s.dispose();
}
