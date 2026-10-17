import {trial} from './parry_reading_trials.mjs';
import {ExtendedGuard} from './parry_extended_guard.mjs';
import {writeFileSync} from 'node:fs';
const rows=[];
for(const start of [null,.70,.85,1,1.15,1.30]) {
 process.env.READ_KIND='oracle-high';process.env.ORACLE_START=String(start);
 for(const atk of ['longsword','zweihander'])for(let i=0;i<13;i++) {
  const {touches,frames,...r}=trial({cfg:'uchigatana',atk,name:'oberhau',gap:1+i*.05,Guard:start===null?undefined:ExtendedGuard});
  rows.push({...r,start});
 }
 const a=rows.filter(r=>r.start===start);
 console.log(JSON.stringify({start,n:a.length,injured:a.filter(r=>r.injured).length,clash:a.filter(r=>r.firstStrokeClash).length,covered:a.filter(r=>r.firstStrokeClash?.mode==='defend'&&r.firstStrokeClash.cover>=.5).length,nag:a.filter(r=>r.nag).length}));
 writeFileSync('/workspace/parry-extended-20261017/oracle-high.json',JSON.stringify(rows));
}
