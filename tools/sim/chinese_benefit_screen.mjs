import {trial} from './parry_reading_trials.mjs';
import {cases} from './chinese_path_trials.mjs';
import {guardClass,observeHealth} from './chinese_benefit_model.mjs';
import {DT} from './harness_m.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
export const dir=process.env.BENEFIT_OUT??'/workspace/chinese-parry-benefit-20261017';mkdirSync(dir,{recursive:true});
export function run(x,kind){
 let observer,clock=0,final;
 const Parent=guardClass(kind);
 class Guard extends Parent{constructor(d,a){super(d,a);observer=observeHealth(d,()=>clock);}}
 const r=trial({...x,playerModel:true,Guard,heldAt:t=>t+1e-9>=x.press,onFrame(G,g){clock=G.t;observer.step(DT,g);final=observer.finish();}});
 delete r.touches;
 return {...r,...x,kind,health:final};
}
export function summary(rows){const sum=f=>rows.reduce((s,r)=>s+f(r),0);return {n:rows.length,deaths:sum(r=>!r.health.end.alive),hits:sum(r=>r.health.hits),cutHits:sum(r=>r.health.cutHits),bloodLost:sum(r=>r.health.bloodLost),bleedAdded:sum(r=>r.health.bleedAdded),concussion:sum(r=>r.health.concussion),limbLost:sum(r=>r.health.limbLost),balanceLost:sum(r=>r.health.balanceLost),blockCost:sum(r=>r.health.stamina.spent.block),downTime:sum(r=>r.health.downTime)};}
if(process.argv[1]?.endsWith('/chinese_benefit_screen.mjs')){
 const kinds=(process.env.KINDS??'base,low-preview,compact,cross').split(',');
 for(const kind of kinds){const rows=cases().map(x=>run(x,kind));writeFileSync(`${dir}/screen-${kind}.json`,JSON.stringify(rows));console.log(JSON.stringify({kind,...summary(rows)}));}
}
