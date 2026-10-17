// Diagnostic ceiling only: it deliberately knows which line to force.
import {cases,runCase,save,summarize,previous,key} from './chinese_path_trials.mjs';
const rows=[];const base=previous('risk-paired').filter(r=>r.kind==='base'&&r.lead===.2);
for(const line of ['highL','highR','highC','lowL','lowR','thrust']) {
 for(const c of cases([.2]))rows.push(runCase(c,`force:${line}`));
 console.log(JSON.stringify({line,...summarize(rows.filter(r=>r.kind===`force:${line}`))}));
}
save('oracle',rows);
const report=base.map(b=>({key:key(b),baseHurt:b.injured,baseLine:b.wounds.find(w=>w.type!=='blunt')?.line,safe:rows.filter(r=>key(r)===key(b)&&!r.injured).map(r=>r.kind.slice(6))}));save('oracle-map',report);console.log(JSON.stringify(report));
const traces=base.filter(r=>r.injured).map(b=>runCase({cfg:b.cfg,atk:b.atk,name:b.name,gap:b.gap,press:b.press},'base',true));save('baseline-traces',traces);
