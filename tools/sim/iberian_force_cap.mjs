import {trial} from './iberian_contact_study.mjs';
import {controlObserver} from './control_strength_observer.mjs';
import {linkSweepRecovery} from './contact_control_recovery.mjs';
import {installForceCap} from './contact_force_cap.mjs';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
export const OUT='docs/research/iberian_force_cap_20261019';
export const MOTION=JSON.parse(readFileSync('docs/research/iberian_contact_20261018/candidate-outward.json'));
export const CONFIGS=[{id:'alone',floor:1,hold:.24},...[.50,.25].flatMap(floor=>[.24,.60].map(hold=>({id:`f${floor}-h${hold}`,floor,hold})))];
export function forceTrial(options,cfg){
 const ob=controlObserver(0);let control;let activeFrames=0;let minimum=1;
 const r=trial('live',MOTION,{...options,onStart(G,g){
  control=installForceCap(G.enemy,cfg);
  linkSweepRecovery(g,G.player.skill._contactSweep,G.player,control,ob,()=>G.t);
 },onFrame(G){ob.step(G);const s=control.scale();minimum=Math.min(minimum,s);if(s<1)activeFrames++;}});
 return {...r,forceConfig:{...cfg,recovery:.24},controlEvents:control.events,observation:ob.finish(),capAudit:{activeFrames,minimum}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 mkdirSync(`${OUT}/raw`,{recursive:true});
 const plan=JSON.parse(readFileSync(`${OUT}/plan.json`));
 const configs=process.env.ARM?CONFIGS.filter(c=>c.id===process.env.ARM):CONFIGS;
 for(const cfg of configs){const rows=[],start=Date.now();for(const [i,c] of plan.cases.entries()){
  const r=forceTrial(c,cfg);rows.push(r);
  writeFileSync(`${OUT}/raw/${cfg.id}.json.gz`,gzipSync(JSON.stringify(rows)));
  console.log(JSON.stringify({id:cfg.id,i,elapsed:(Date.now()-start)/1000,first:r.observation.first,effects:r.controlEvents.length,alive:r.health.end.alive}));
 }}
}
