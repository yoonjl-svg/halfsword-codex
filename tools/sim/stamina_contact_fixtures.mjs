// Baseline-only fixture discovery. No fatigued result may influence selection.
// Freeze this JSON before comparing tempo candidates.
import {tempoTrial,TEMPO_WEAPONS} from './stamina_tempo_probe.mjs';
import {WEAPONS} from '../../src/weapons.js';
import {resolveSwordArt} from '../../src/sword_art.js';
import {STAMINA} from '../../src/config.js';
import {writeFileSync,mkdirSync} from 'node:fs';
const [out='/tmp/contact-fixtures',arg='longsword,qinggang,uchigatana']=process.argv.slice(2);
STAMINA.attackTempo=false;
mkdirSync(out,{recursive:true});const rows=[],attempts=[];
for(const weapon of arg==='all'?TEMPO_WEAPONS:arg.split(',')){
 for(const action of ['cut','thrust','pommel','secret'])for(const driver of ['human','ai']){
  const M=resolveSwordArt(WEAPONS[weapon]).measure;
  const gaps=action==='pommel'?[.75,.65,.85,.55,.95]:[M.contact,M.contact+.1,M.contact-.1,M.contact+.2,M.contact-.2,M.contact+.3,M.contact-.3];
  const preps=action==='pommel'||action==='thrust'?[null,[0,.55],[-.5,.2],[.5,.2]]:[null];
  let chosen=null,na=null;
  outer:for(const prep of preps)for(const gap of gaps){
   const r=tempoTrial({weapon,action,driver,level:0,contact:true,contactProbe:true,gap,prep});
   attempts.push({weapon,action,driver,gap,prep,status:r.status,firstContact:r.firstContact,finite:r.finite,completed:r.completed,stopped:r.stopped});
   if(r.status==='not-applicable'){na=r;break outer;}
   if(r.firstContact?.time>1/60&&r.finite&&r.completed&&!r.stopped){chosen={weapon,action,driver,gap,prep,baseline:r};break outer;}
  }
  rows.push(chosen??{weapon,action,driver,status:na?.status??'no-valid-baseline'});
  writeFileSync(out+'/fixtures.json',JSON.stringify(rows,null,2)+'\n');
  writeFileSync(out+'/attempts.json',JSON.stringify(attempts,null,2)+'\n');
 }
 console.error('fixtures',weapon,rows.filter(r=>r.baseline).length,'/',rows.length);
}
