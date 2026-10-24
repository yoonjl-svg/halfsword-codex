import {setup,DT} from './harness.mjs';
for(const scale of [1,1.5]){
 const s=setup({scale,x:-20});s.d.position.set(20,0,0);s.advance(2.1,{brain:false});s.f.move.set(0,1);s.f.stickY=1;
 const p=s.f.bodies.pelvis.translation();s.advance(2.5,{brain:false});const q=s.f.bodies.pelvis.translation();
 console.log('MOVE',scale,Math.hypot(q.x-p.x,q.z-p.z),s.f.state,s.f.stamina.value);s.dispose();
}
for(const held of [false,true]){
 const s=setup();s.d.cool=100;s.advance(2.2);s.moveTo(s.d.position.x-3.15,0);s.g.held=held;s.d.begin('nip');s.advance(2.1);
 console.log('NIP',held,JSON.stringify({pos:s.f.pelvisPos,health:s.f.blood,spent:s.f.stamina.spent,stats:s.d.stats,events:s.events.slice(-8)}));s.dispose();
}
for(const weapon of ['longsword','rapier','uchigatana','qinggang','zweihander','morgenstern','druid_whip','pistol']){
 try{const s=setup({weapon});s.d.cool=100;s.advance(2.2);s.moveTo(s.d.position.x-3.3,0);s.f.skill.thrust();s.advance(1);console.log('WEAPON',weapon,JSON.stringify({state:s.f.state,hits:s.d.stats.playerHits,hp:s.d.health,spent:s.f.stamina.spent}));s.dispose();}catch(e){console.log('FAIL',weapon,e.stack);}
}
