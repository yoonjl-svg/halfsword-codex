import {writeFileSync} from 'node:fs';
import {trial} from './parry_reading_trials.mjs';
import {ChineseResearchGuard} from './chinese_player_guard.mjs';
const dir=process.env.OUT_DIR??'/workspace/chinese-parry-player-20261017';
const rows=[];
for(const name of ['unterhau','oberhau','위→다리'])for(let i=-3;i<=3;i++)for(const kind of ['base','ready']) {
 const press=.9+i/120;process.env.CN_READ=kind;
 const {frames,touches,...r}=trial({cfg:'qinggang',atk:'longsword',gap:1.6,name,playerModel:true,heldAt:t=>t+1e-9>=press,Guard:kind==='base'?undefined:ChineseResearchGuard});
 rows.push({...r,kind,press});
}
writeFileSync(`${dir}/jitter.json`,JSON.stringify(rows));
