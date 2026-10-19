import {newRound,DT} from './harness_m.mjs';
import {PlayerParryGuard} from '../../src/parry_button.js';
import {installRapierCandidate} from '../../src/rapier_guard_research.js';
import {sample,RANGES} from './envelope_check.mjs';
import {writeFileSync} from 'node:fs';
const out=[];
for(const variant of ['base','shape'])for(const line of ['highR','highC']){
 const g=newRound({weapon:'rapier',weapon2:'longsword',gap:5,seed:1});const d=g.player,a=g.enemy;g.ai.update=()=>{};
 const guard=new PlayerParryGuard(d,a);guard.held=true;installRapierCandidate(d,a,guard,variant);
 guard.researchHook=()=>{guard.defLine=line;guard.timer=.5;};g.before=()=>{guard.step(DT);d.inputActive=guard.active;};
 const rows=[];for(let i=0;i<180;i++){g.step();if(g.t>.9)rows.push(sample(d));}
 const metrics={};for(const k of ['shElevS','shPlaneS','elbowS','wrist','forearmRoll','spineTwist','penMax'])metrics[k]={mean:rows.reduce((n,r)=>n+r[k],0)/rows.length,min:Math.min(...rows.map(r=>r[k])),max:Math.max(...rows.map(r=>r[k]))};
 out.push({variant,line,coverWeight:d.skill._cover?.w??0,metrics});g.world.free();
}
writeFileSync(process.env.OUT,JSON.stringify({ranges:RANGES,results:out},null,2));console.log(JSON.stringify(out));
