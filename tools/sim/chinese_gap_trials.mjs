import {gapGuard} from './chinese_gap_model.mjs';
import {trial} from './parry_reading_trials.mjs';
import {live} from './chinese_benefit_live.mjs';
import {observeHealth} from './chinese_benefit_model.mjs';
import {cases} from './chinese_path_trials.mjs';
import {DT} from './harness_m.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
export function single(x,kind){let observer,clock=0,health;const Parent=gapGuard(kind);class Guard extends Parent{constructor(d,a){super(d,a);observer=observeHealth(d,()=>clock);}}
 const r=trial({...x,playerModel:true,Guard,heldAt:t=>t+1e-9>=x.press,onFrame(G,g){clock=G.t;observer.step(DT,g);health=observer.finish();}});delete r.touches;return {...r,...x,kind,health};}
if(process.argv[1]?.endsWith('/chinese_gap_trials.mjs')){
 const out=process.env.GAP_OUT??'/workspace/chinese-parry-gap-20261017';mkdirSync(out,{recursive:true});
 for(const kind of (process.env.KINDS??'base,delay12,gate20').split(',')){
  const rows=[];const label=process.env.LABEL??'screen';
  if(label==='screen')rows.push(...cases().map(x=>single(x,kind)));
  else for(const seed of (process.env.SEEDS??'101,102,103,104').split(',').map(Number))for(const atk of (process.env.ATKS??'longsword,qinggang').split(','))for(const policy of ['reactive','exchange']){
   const r=live({kind,GuardOverride:gapGuard(kind),seed,atk,policy,gap:+(process.env.GAP??2.2)});rows.push(r);console.log(JSON.stringify({kind,seed,atk,policy,alive:r.health.end.alive,armed:r.health.end.armed,blood:r.health.bloodLost,limb:r.health.limbLost}));
  }
  writeFileSync(`${out}/${label}-${kind}.json`,JSON.stringify(rows));console.log(JSON.stringify({label,kind,n:rows.length,deaths:rows.filter(r=>!r.health.end.alive).length}));
 }
}
