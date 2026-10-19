import {newRound,DT,THREE,CONFIG} from './harness_m.mjs';
import {PlayerParryGuard} from '../../src/parry_button.js';
import {installFollowup} from '../../src/italian_followup_research.js';
import {writeFileSync,mkdirSync} from 'node:fs';
CONFIG.SKILL.itOppositionVals={...CONFIG.SKILL.itOppositionVals,window:Infinity};
const rows=[];
for(const seed of [941,10305])for(const approach of [false,true]){
 const g=newRound({weapon:'rapier',weapon2:'sain',seed,gap:2.2}),p=g.player,a=g.enemy;
 p.skill.corr=CONFIG.SKILL.corr;p.skill.corrTip=CONFIG.SKILL.corrTip;p.skill.autoGuard=true;
 const guard=new PlayerParryGuard(p,a);p.stamina.controller=guard;const m=installFollowup(p,a,guard,'strongBind'),c=CONFIG.SKILL.itOppositionVals;
 const contacts=[],samples=[];const old=m.onClash.bind(m);m.onClash=(att,h)=>{const age=guard.clock-m.pressed,app=new THREE.Vector3().copy(p.bodies.chest.translation()).sub(a.bladePoint(1,new THREE.Vector3())).dot(a.tipVel);const st=a.cache.sword,v=st.w.clone().cross(p.feel.point.clone().sub(st.com)).add(st.v);const gates={eligible:!m.eligible(),inactive:!guard.active,running:!!m.run,used:m.used,age:age<0||age>c.window,attack:!a.stamina.attackId||a.stamina.time>a.stamina.attackUntil,duplicate:m.usedAttacks.get(a)===a.stamina.attackId,injured:guard.clock-m.lastInjury<c.injuryGrace,slow:h.vn<c.minVn,far:p.foeDistance()>c.maxGap,away:app<=0};const n=m.starts;old(att,h);contacts.push({t:g.t,normalApproach:v.dot(p.feel.normal),attackId:a.stamina.attackId,remain:a.stamina.attackUntil-a.stamina.time,phase:g.ai.phase,mode:g.ai.mode,gates,gap:p.foeDistance(),vn:h.vn,app,fired:m.starts>n});};
 g.before=()=>{p.move.set(0,approach&&p.foeDistance()>1.6?.35:0);p.stickY=p.move.y;guard.held=true;guard.step(DT);p.inputActive=guard.active;};
 for(let i=0;i<24/DT;i++){g.step();if(i%24===0)samples.push({t:g.t,stamina:p.stamina.value,gap:p.foeDistance(),line:guard.line,mode:guard.mode,cover:p.skill._cover?.w,pose:p.skill.thrustPose.w,state:p.state});if(!p.alive||!a.alive)break;}
 rows.push({seed,approach,t:g.t,alive:p.alive,cause:p.causeOfDeath,clashes:g.clashes,wounds:g.wounds.map(({att,vic,...h})=>({...h,victim:vic.index})),contacts,events:m.events,samples});g.world.free();
}
mkdirSync('/tmp/italian-sain-diagnosis',{recursive:true});writeFileSync('/tmp/italian-sain-diagnosis/sim-detail.json',JSON.stringify(rows));
console.log(JSON.stringify(rows.map(r=>({seed:r.seed,approach:r.approach,t:r.t,alive:r.alive,contacts:r.contacts.length,starts:r.events.filter(e=>e.type==='start').length,rejected:r.contacts.reduce((a,r)=>{for(const[k,v]of Object.entries(r.gates))if(v)a[k]=(a[k]||0)+1;return a;},{})})),null,2));
