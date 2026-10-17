import {cases,runCase,save,dir} from './chinese_path_trials.mjs';
import {readFileSync} from 'node:fs';
const bad=JSON.parse(readFileSync(`${dir}/oracle-map.json`)).filter(r=>r.baseHurt&&!r.safe.length).map(r=>r.key.split('|').slice(0,3).join('|'));
const rows=[];
for(const c of cases([.3]).filter(r=>bad.includes([r.atk,r.name,r.gap].join('|'))))for(const line of ['highL','highR','highC','lowL','lowR','thrust'])rows.push(runCase(c,`force:${line}`));
save('ceiling-early',rows);
for(const k of bad)console.log(JSON.stringify({key:k,safe:rows.filter(r=>[r.atk,r.name,r.gap].join('|')===k&&!r.injured).map(r=>r.kind)}));
