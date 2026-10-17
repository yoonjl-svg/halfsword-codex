import {trial,ATTACK_NAMES,CONFIGS} from './parry_reading_trials.mjs';
import {ExtendedGuard} from './parry_extended_guard.mjs';
import {writeFileSync} from 'node:fs';
const configs=(process.env.CONFIGS??CONFIGS.join(',')).split(',');
const atks=(process.env.ATKS??'longsword,rapier,zweihander').split(',');
const gaps=(process.env.GAPS??'1.2,1.4,1.6,1.8').split(',').map(Number);
const names=(process.env.ATTACKS??ATTACK_NAMES.join(',')).split(',');
const rows=[];
for(const cfg of configs){
 for(const atk of atks)for(const name of names)for(const gap of gaps){
  const r=trial({cfg,atk,name,gap,Guard:process.env.READ_KIND?ExtendedGuard:undefined,strokeSpeed:+(process.env.SPEED??11),prepPause:+(process.env.PAUSE??.15),seed:+(process.env.SEED??1)});
  const {touches,frames,...keep}=r;rows.push(keep);
 }
 const rr=rows.filter(r=>r.cfg===cfg);console.log(JSON.stringify({kind:process.env.READ_KIND??'baseline',cfg,n:rr.length,injured:rr.filter(r=>r.injured).length,switches:rr.reduce((s,x)=>s+x.switches,0)}));
}
if(process.env.OUT)writeFileSync(process.env.OUT,JSON.stringify(rows));
