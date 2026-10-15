// Actual first contact in the attack phase, per user decision 2026-10-16.
// Passive fixed game-body colliders; no defending weapon. All attack code is real.
import {tempoTrial,TEMPO_WEAPONS} from './stamina_tempo_probe.mjs';
import {STAMINA} from '../../src/config.js';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
const [out='/tmp/tempo-contact',weapons='longsword,qinggang,uchigatana',actions='cut,thrust,pommel,secret',drivers='human,ai']=process.argv.slice(2);
mkdirSync(out,{recursive:true});const rows=[];
const fixtures=process.env.TEMPO_FIXTURES?JSON.parse(readFileSync(process.env.TEMPO_FIXTURES,'utf8')):null;
for(const weapon of weapons==='all'?TEMPO_WEAPONS:weapons.split(',')){
 for(const action of actions.split(','))for(const driver of drivers.split(','))for(const level of [0,1,2]){
  const fixture=fixtures?.find(r=>r.weapon===weapon&&r.action===action&&r.driver===driver);
  if(fixtures&&!fixture?.baseline){rows.push({weapon,action,driver,level,status:fixture?.status??'missing-fixture'});continue;}
  const row=tempoTrial({weapon,action,driver,level,contact:true,contactProbe:true,gap:fixture?.gap??(process.env.TEMPO_GAP?+process.env.TEMPO_GAP:null),prep:fixture?.prep,targetParts:fixture?.targetParts});rows.push(row);
 }
 writeFileSync(out+'/rows.json',JSON.stringify(rows,null,2)+'\n');console.error('measured',weapon);
}
for(const r of rows){
 if(r.status!=='measured')continue;
 const base=rows.find(b=>b.weapon===r.weapon&&b.action===r.action&&b.driver===r.driver&&b.level===0);
 r.target=[1,1/STAMINA.attackTired,1/STAMINA.attackSevere][r.level];r.timeRatio=base.firstContact?.time>0&&r.firstContact?r.firstContact.time/base.firstContact.time:null;
 r.error=r.timeRatio==null?null:Math.abs(r.timeRatio/r.target-1);
 r.contactPartChanged=!!r.firstContact&&!!base.firstContact&&r.firstContact.victimPart!==base.firstContact.victimPart;
 r.speedRatio=base.activePeak>0?r.activePeak/base.activePeak:null;
 r.energyRatio=base.firstContact?.energy>0&&r.firstContact?r.firstContact.energy/base.firstContact.energy:null;
 r.pass=r.error!=null&&r.error<=.07&&r.finite&&r.completed&&!r.stopped;
}
writeFileSync(out+'/rows.json',JSON.stringify(rows,null,2)+'\n');
const summary={rows:rows.length,hit:rows.filter(r=>r.firstContact).length,pass:rows.filter(r=>r.pass).length,nonfinite:rows.filter(r=>r.finite===false).length,invalidFixtures:rows.filter(r=>r.status==='invalid-fixture').length,unmeasuredRows:rows.filter(r=>r.status!=='measured'&&r.status!=='not-applicable').length,contactPartChanged:rows.filter(r=>r.contactPartChanged).length};
console.log(JSON.stringify(summary));writeFileSync(out+'/summary.json',JSON.stringify(summary,null,2)+'\n');
writeFileSync(out+'/config.json',JSON.stringify({stamina:{...STAMINA},fixtures:process.env.TEMPO_FIXTURES??null},null,2)+'\n');
