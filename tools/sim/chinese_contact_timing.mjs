import {single} from './chinese_contact_trials.mjs';
import {dangers} from './chinese_path_trials.mjs';
import {writeFileSync} from 'node:fs';
const rows=[];
for(const kind of ['base','path'])for(const x of dangers.filter(x=>x.atk==='qinggang'&&x.name==='zornhau'&&[1.1,1.5].includes(x.gap)))for(let ms=100;ms<=300;ms+=25){
 const press=Math.round((x.wounds.find(w=>w.type!=='blunt').t-ms/1000)*120)/120;
 const r=single({cfg:'qinggang',atk:x.atk,name:x.name,gap:x.gap,lead:ms/1000,press},kind);rows.push(r);
}
writeFileSync(`${process.env.CONTACT_OUT??'/workspace/chinese-parry-contact-20261017'}/timing.json`,JSON.stringify(rows));console.log(JSON.stringify({n:rows.length}));
