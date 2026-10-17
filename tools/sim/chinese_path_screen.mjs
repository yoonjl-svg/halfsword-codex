import {cases,runCase,save,summarize,previous,key} from './chinese_path_trials.mjs';
const base=previous('risk-paired').filter(r=>r.kind==='base');const bi=new Map(base.map(r=>[key(r),r]));
for(const kind of (process.env.KINDS??'blade-now,blade-hold,low-preview').split(',')){
 const rows=cases().map(c=>runCase(c,kind));save(`screen-${kind}${process.env.PATH_MOTOR?'-'+process.env.PATH_MOTOR:''}`,rows);
 console.log(JSON.stringify({kind,...summarize(rows),new:rows.filter(r=>r.injured&&!bi.get(key(r)).injured).map(key),saved:rows.filter(r=>!r.injured&&bi.get(key(r)).injured).map(key)}));
}
