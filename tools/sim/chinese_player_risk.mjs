// Held-button timing relative to independently measured unguarded injury.
// Offline timing axis only: this does not predict future contact in the game.
import {readFileSync,writeFileSync} from 'node:fs';
import {trial} from './parry_reading_trials.mjs';
import {ChineseResearchGuard} from './chinese_player_guard.mjs';
const dir=process.env.OUT_DIR??'/workspace/chinese-parry-player-20261017';
const danger=JSON.parse(readFileSync(`${dir}/risk-unguarded.json`)).filter(r=>r.injured);
const rows=[];
const kinds=(process.env.KINDS??'base,ready,ready-low').split(',');
for(const x of danger)for(const lead of [.3,.2,.1]) {
 const hit=x.wounds.find(w=>w.type!=='blunt').t;
 const press=Math.round((hit-lead)*120)/120;
 for(const kind of kinds) {
  process.env.CN_READ=kind;
  const {frames,touches,...r}=trial({cfg:'qinggang',atk:x.atk,gap:x.gap,name:x.name,playerModel:true,heldAt:t=>t+1e-9>=press,Guard:kind==='base'?undefined:ChineseResearchGuard});
  rows.push({...r,kind,press,lead,unguardedHit:hit,cleanClash:!r.injured&&r.clashes.some(c=>c.fresh&&c.t>=press),critical:r.wounds.some(w=>w.type!=='blunt'&&['head','neck','chest'].includes(w.zone))});
 }
}
writeFileSync(`${dir}/${process.env.TAG??'risk-paired'}.json`,JSON.stringify(rows));
for(const kind of kinds)console.log(JSON.stringify({kind,byLead:[.3,.2,.1].map(lead=>{const a=rows.filter(r=>r.kind===kind&&r.lead===lead);return{lead,n:a.length,injured:a.filter(r=>r.injured).length,critical:a.filter(r=>r.critical).length,cleanClash:a.filter(r=>r.cleanClash).length,blockCost:a.reduce((s,r)=>s+r.stamina.spent.block,0)}})}));
