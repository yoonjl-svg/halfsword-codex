import {trial} from './parry_reading_trials.mjs';
import {ExtendedGuard} from './parry_extended_guard.mjs';
import {writeFileSync} from 'node:fs';
const rows=[];
for(const cfg of ['uchigatana','longsword','qinggang']) {
 for(const strokeSpeed of [8,14])for(const prepPause of [.05,.30])for(const gap of [1.3,1.5,1.7,1.9])
 for(const name of ['unterhau','unterhauL','zornhau','zornhauL','위→다리','찌르기→베기']) {
  const pair={cfg,strokeSpeed,prepPause,gap,name,atk:'longsword'};
  for(const kind of ['baseline',process.env.CANDIDATE??'rise']) {
   process.env.READ_KIND=kind;
   const {touches,frames,...r}=trial({...pair,Guard:kind==='baseline'?undefined:ExtendedGuard});
   rows.push({...r,kind,strokeSpeed,prepPause});
  }
 }
 const a=rows.filter(r=>r.cfg===cfg),pairs=[];
 for(let i=0;i<a.length;i+=2)pairs.push([a[i],a[i+1]]);
 console.log(JSON.stringify({cfg,n:pairs.length,base:pairs.filter(p=>p[0].injured).length,candidate:pairs.filter(p=>p[1].injured).length,newHits:pairs.filter(p=>!p[0].injured&&p[1].injured).map(p=>({name:p[0].name,gap:p[0].gap,speed:p[0].strokeSpeed,pause:p[0].prepPause})),saved:pairs.filter(p=>p[0].injured&&!p[1].injured).length}));
 writeFileSync(process.env.OUT??'/workspace/parry-extended-20261017/holdout-rise.json',JSON.stringify(rows));
}
