import {trial,ATTACK_NAMES} from './parry_reading_trials.mjs';
import {ChineseResearchGuard} from './chinese_player_guard.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
const dir=process.env.OUT_DIR??'/workspace/chinese-parry-player-20261017';mkdirSync(dir,{recursive:true});
const kind=process.env.CN_READ??'base';
const names=(process.env.ATTACKS??'zornhau,zornhauL,unterhau,unterhauL,oberhau,stichPflug,위→다리,찌르기→베기').split(',');
const gaps=(process.env.GAPS??'1.2,1.6').split(',').map(Number);
const presses=(process.env.PRESSES??'0,.75,.90,1.05').split(',').map(Number);
const atks=(process.env.ATKS??'longsword').split(',');
const rows=[];
for(const atk of atks)for(const name of names)for(const gap of gaps)for(const press of presses) {
 const opts={cfg:process.env.CFG??'qinggang',atk,name,gap,playerModel:true,heldAt:t=>press>=0&&t+1e-9>=press,Guard:kind==='base'?undefined:ChineseResearchGuard,strokeSpeed:+(process.env.SPEED??11),prepPause:+(process.env.PAUSE??.15),startingStamina:+(process.env.STAMINA??100)};
 const {frames,touches,...r}=trial(opts);
 rows.push({...r,press,kind,cleanClash:!r.injured&&r.clashes.some(c=>c.fresh&&c.t>=Math.max(press,.6)),critical:r.wounds.some(w=>w.type!=='blunt'&&['head','neck','chest'].includes(w.zone))});
}
const summaries=presses.map(press=>{const a=rows.filter(r=>r.press===press);return{press,n:a.length,injured:a.filter(r=>r.injured).length,critical:a.filter(r=>r.critical).length,cleanClash:a.filter(r=>r.cleanClash).length,blockCost:a.reduce((s,r)=>s+r.stamina.spent.block,0),attackCost:a.reduce((s,r)=>s+r.stamina.spent.attack,0)};});
writeFileSync(`${dir}/${process.env.TAG??kind}.json`,JSON.stringify(rows));console.log(JSON.stringify({kind,summaries}));
