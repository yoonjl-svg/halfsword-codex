import { trial } from './parry_reading_trials.mjs';
import { ResearchGuard } from './parry_reading_guard.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
process.env.READ_SCOPE='center';
const cases=[
 ['uchigatana','longsword','위→다리',1.2],['uchigatana','longsword','위→다리',1.4],
 ['uchigatana','rapier','oberhau',1.6],['uchigatana','rapier','oberhau',1.8],
 ['qinggang','longsword','oberhau',1.6],['qinggang','longsword','oberhau',1.2],
 ['uchigatana','longsword','oberhau',1.5],['uchigatana','longsword','unterhau',1.6],
 ['uchigatana','longsword','zornhau',1.2],['rapier','longsword','zornhauL',1.2],
];
const out=[];
for(const [cfg,atk,name,gap] of cases) for(const candidate of [false,true]) {
 const r=trial({cfg,atk,name,gap,trace:true,held:true,Guard:candidate?ResearchGuard:undefined});
 r.candidate=candidate;out.push(r);
 console.log(JSON.stringify({cfg,atk,name,gap,candidate,why:r.why,wounds:r.wounds.filter(x=>x.type!=='blunt').map(({t,zone,energy})=>({t,zone,energy})),transitions:r.transitions.map(x=>[+x.t.toFixed(3),x.mode,x.line])}));
}
mkdirSync('/workspace/parry-extended-20261017',{recursive:true});
writeFileSync('/workspace/parry-extended-20261017/diagnostic.json',JSON.stringify(out));
