import {redesignedTrial} from './japanese_flow_redesign.mjs';
import {TECH} from '../../src/ai_techniques.js';
import {writeFileSync,mkdirSync} from 'node:fs';
const out=process.env.OUT??'/workspace/japanese-flow-redesign-20261017';mkdirSync(out,{recursive:true});
const rows=[];
for(const poses of (process.env.POSES??'none,mixed').split(','))for(const name of ['oberhau','zornhau','zornhauL','zwerch','zwerchL']){
 const r=redesignedTrial({enabled:true,poses,seed:755,atk:'longsword',policy:'hold',seconds:10,gap:1.75,onStart(G){const tech=TECH.find(t=>t.name===name);G.ai.pickTech=()=>tech;}});
 rows.push({name,...r});writeFileSync(`${out}/poses-${process.env.LABEL??'probe'}.json`,JSON.stringify(rows));
 console.log(JSON.stringify({poses,name,seconds:r.duration,contacts:r.clashes.length,flows:r.redesignedFlows.map(f=>({t:f.t,age:f.age,penalty:f.penalty})),alive:r.health.end.alive,limb:r.health.limbLost,concussion:r.health.concussion,blood:r.health.bloodLost}));
}
