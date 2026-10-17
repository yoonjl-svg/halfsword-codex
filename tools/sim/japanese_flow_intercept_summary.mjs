import {readFileSync,writeFileSync} from 'node:fs';
const root=process.env.OUT??'/workspace/japanese-flow-intercept-20261017';
const read=name=>JSON.parse(readFileSync(`${root}/${name}.json`));
const rows=[];
for(const [seed,base,candidate] of [[755,read('common/trace'),read('horizontal')],[756,read('independent/trace'),read('independent/horizontal')]])for(const name of ['zwerch','zwerchL']){
 const metrics=r=>({duration:r.duration,flows:r.redesignedFlows.length,limb:r.health.limbLost,concussion:r.health.concussion,blood:r.health.bloodLost,block:r.health.stamina.spent.block,alive:r.health.end.alive,armed:r.health.end.armed});
 rows.push({seed,name,core:metrics(base.find(r=>r.name===name)),candidate:metrics(candidate.find(r=>r.name===name))});
}
const totals=Object.fromEntries(['core','candidate'].map(kind=>[kind,Object.fromEntries(['flows','limb','concussion','blood','block'].map(key=>[key,rows.reduce((v,r)=>v+r[kind][key],0)]))]));
const moments={};const trace=read('trace');
for(const [name,times] of [['zwerch',[9.2,9.4,9.5,9.9,10.0333,10.1,10.2]],['zwerchL',[8.8333]]]){
 const r=trace.find(r=>r.name===name);
 moments[name]=times.map(t=>r.trace.reduce((best,x)=>Math.abs(x.t-t)<Math.abs(best.t-t)?x:best,r.trace[0]));
}
const result={scope:'four 10.1-second held-guard command surrogates, not human win-rate',rows,totals,moments};writeFileSync(`${root}/summary.json`,JSON.stringify(result,null,2));console.log(JSON.stringify({rows,totals}));
