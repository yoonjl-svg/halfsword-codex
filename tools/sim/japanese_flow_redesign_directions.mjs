// Direction/contact exercise with the ordinary block button controller. These
// short rehearsals do not establish survival balance or human input tolerance.
import {redesignedTrial} from './japanese_flow_redesign.mjs';
import {TECH} from '../../src/ai_techniques.js';
import {writeFileSync,mkdirSync} from 'node:fs';
const out=process.env.OUT??'/workspace/japanese-flow-redesign-20261017';mkdirSync(out,{recursive:true});
const rows=[];
for(const name of ['oberhau','zornhau','zornhauL','zwerch','zwerchL','unterhau','stichPflug'])for(const enabled of [false,true]){
 const r=redesignedTrial({enabled,seed:755,atk:'longsword',policy:'hold',seconds:10,gap:1.75,onStart(G){const tech=TECH.find(t=>t.name===name);G.ai.pickTech=()=>tech;}});
 rows.push({name,...r});writeFileSync(`${out}/directions.json`,JSON.stringify(rows));
 console.log(JSON.stringify({name,enabled,seconds:r.duration,contacts:r.clashes.length,flows:r.redesignedFlows.map(f=>({t:f.t,age:f.age,penalty:f.penalty,entry:f.entry})),alive:r.health.end.alive}));
}
