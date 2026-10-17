import {redesignedTrial} from './japanese_flow_redesign.mjs';
import {TECH} from '../../src/ai_techniques.js';
import {traceState,installEarlyIntercept} from './japanese_flow_intercept_model.mjs';
import {writeFileSync,mkdirSync} from 'node:fs';
const out=process.env.OUT??'/workspace/japanese-flow-intercept-20261017';mkdirSync(out,{recursive:true});
const variants=(process.env.VARIANTS??'trace').split(','),rows=[];
for(const variant of variants)for(const name of (process.env.NAMES??'zwerch,zwerchL,zornhau,zornhauL').split(',')){
 const trace=[];
 const r=redesignedTrial({enabled:true,poses:'none',seed:+(process.env.SEED??755),atk:'longsword',policy:'hold',seconds:+(process.env.SECONDS??10.1),gap:1.75,onStart(G){G.ai.pickTech=()=>TECH.find(t=>t.name===name);if(variant!=='trace')installEarlyIntercept(G,variant==='near'?.24:.36,{horizontalOnly:variant==='horizontal'});},onFrame(G,g){trace.push(traceState(G,g));}});
 rows.push({variant,name,trace,...r});writeFileSync(`${out}/${variant}.json`,JSON.stringify(rows.filter(x=>x.variant===variant)));
 console.log(JSON.stringify({variant,name,flows:r.redesignedFlows.length,firsts:r.redesignedFlows.map(x=>({t:x.t,id:x.penalty?.attackId})),alive:r.health.end.alive,limb:r.health.limbLost,concussion:r.health.concussion,blood:r.health.bloodLost,poses:trace.filter(x=>x.pose?.age<=1/120+.000001).map(x=>({t:x.t,id:x.attackId,line:x.pose.line,eta:x.pose.first.eta,part:x.pose.first.part}))}));
}
