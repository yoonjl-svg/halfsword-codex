// Exploratory strength-only comparison: 24 short AI-vs-stationary-dummy trials.
// Not win-rate evidence. Usage: node tools/sim/strength_variant_probe.mjs [output-dir]
import {newRound,DT} from './harness_m.mjs';
import {STAMINA} from '../../src/config.js';
import {EMO_ABILITY} from '../../src/emotions.js';
import {writeFileSync, mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
const output=resolve(process.argv[2]??'/tmp/strength-variant-probe');
mkdirSync(output,{recursive:true});
EMO_ABILITY.enabled=false;
const rows=[];
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
for(const weapon of ['longsword','estoc','zweihander'])for(const strength of [1.15,1.38]){
 for(const seed of [901,902,903,904]){
  const g=newRound({seed,weapon2:weapon,persona:{level:{strength}}});
  g.before=()=>{g.player.move.set(0,0);g.player.handOffset.set(.12,-.18);};
  let finite=true;
  for(let i=0;i<20/DT;i++){
   g.step();
   const p=g.enemy.bodies.pelvis.translation();
   if(![p.x,p.y,p.z,g.enemy.strength,g.enemy.stamina.value].every(Number.isFinite)){finite=false;break;}
   if(!g.player.alive||!g.enemy.alive)break;
  }
  const wounds=g.wounds.filter(w=>w.att===g.enemy);
  rows.push({weapon,strength,seed,seconds:g.t,targetDead:!g.player.alive,attackerDead:!g.enemy.alive,attacks:g.ai.stats.attacks,finite,wounds:wounds.map(w=>({t:w.t,energy:w.energy,severity:w.severity,type:w.type,zone:w.zone})),finalStrength:g.enemy.strength,stamina:g.enemy.stamina.value});
  g.eventQueue.free();g.world.free();
 }
 const rs=rows.filter(r=>r.weapon===weapon&&r.strength===strength), energies=rs.flatMap(r=>r.wounds.map(w=>w.energy)).sort((a,b)=>b-a);
 console.log(JSON.stringify({weapon,strength,trials:rs.length,contacts:energies.length,meanJ:mean(energies),topQuartileMeanJ:mean(energies.slice(0,Math.max(1,Math.ceil(energies.length/4)))),targetDeaths:rs.filter(r=>r.targetDead).length,attacks:rs.reduce((n,r)=>n+r.attacks,0),allFinite:rs.every(r=>r.finite)}));
 writeFileSync(output+'/strength-probe.json',JSON.stringify({referenceSource:'40fa2805422208113b69104a670466c3cb0c3917',setup:{seconds:20,seeds:[901,902,903,904],strength:[1.15,1.38],weapons:['longsword','estoc','zweihander'],ai:'normal; only strength overridden',target:'stationary armed dummy, default player outfit',emotionAbilities:false,stamina:STAMINA.on,scope:'exploratory; not player win rates or identical-contact comparison'},rows},null,2)+'\n');
}
