import {runCase,save,summarize,previous,dangers,key} from './chinese_path_trials.mjs';
const mode=process.env.SET??'regression';const rows=[];const kind=process.env.KIND??'low-preview';
if(mode==='regression'){
 const b=previous('base');for(const x of b)rows.push(runCase({cfg:x.cfg,atk:x.atk,name:x.name,gap:x.gap,press:x.press},kind));
 const bm=new Map(b.map(r=>[key(r),r]));console.log(JSON.stringify({kind,...summarize(rows),new:rows.filter(r=>r.injured&&!bm.get(key(r)).injured).map(key),saved:rows.filter(r=>!r.injured&&bm.get(key(r)).injured).map(key)}));
}
if(mode==='window'){
 const pick=['longsword|unterhau|1.1','longsword|unterhau|1.5','longsword|찌르기→베기|1.5','qinggang|zwerch|1.1','qinggang|talhoReves|1.1','qinggang|oberhau|1.1'];
 for(const x of dangers.filter(r=>pick.includes([r.atk,r.name,r.gap].join('|'))))for(let i=0;i<=10;i++)for(const k of ['base',kind]){
  const lead=.1+i*.025,hit=x.wounds.find(w=>w.type!=='blunt').t;
  rows.push(runCase({cfg:'qinggang',atk:x.atk,name:x.name,gap:x.gap,lead,press:Math.round((hit-lead)*120)/120},k));
 }
 for(const k of ['base',kind])console.log(JSON.stringify({kind:k,...summarize(rows.filter(r=>r.kind===k))}));
}
save(`${mode}-${kind}`,rows);
