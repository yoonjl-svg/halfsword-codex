import {runCase,save,summarize} from './chinese_path_trials.mjs';
const names='zornhau,zornhauL,unterhau,unterhauL,oberhau,stichPflug,위→다리,찌르기→베기'.split(',');
const probes=[];const rows=[];const kind=process.env.KIND??'low-preview';
for(const atk of ['longsword','qinggang'])for(const name of names)for(const gap of [1.25,1.65])for(const strokeSpeed of [9,13]){
 const x={cfg:'qinggang',atk,name,gap,strokeSpeed};const u=runCase({...x,press:-1});probes.push(u);
 const inputs=u.injured?[.15,.25,.35].map(lead=>({lead,press:Math.round((u.wounds.find(w=>w.type!=='blunt').t-lead)*120)/120})):[{lead:null,press:.9}];
 for(const input of inputs)for(const k of ['base',kind])rows.push({...runCase({...x,...input},k),unguardedInjured:u.injured});
}
save('holdout-unguarded',probes);save(`holdout-${kind}`,rows);
for(const k of ['base',kind])console.log(JSON.stringify({kind:k,all:summarize(rows.filter(r=>r.kind===k)),danger:summarize(rows.filter(r=>r.kind===k&&r.unguardedInjured)),safe:summarize(rows.filter(r=>r.kind===k&&!r.unguardedInjured))}));
