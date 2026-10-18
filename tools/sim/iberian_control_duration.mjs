// Only hold duration and remaining control vary; motion, input policy and recovery stay fixed.
import {trial} from './iberian_contact_study.mjs';
import {controlObserver} from './control_strength_observer.mjs';
import {installControlRecovery,linkSweepRecovery} from './contact_control_recovery.mjs';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
export const CANDIDATE=JSON.parse(readFileSync('docs/research/iberian_contact_20261018/candidate-outward.json'));
export const GRID=[{id:'alone',floor:1,hold:.12},...[.25,.10].flatMap(floor=>[.06,.12,.24,.36,.48,.60].map(hold=>({id:`f${floor}-h${hold}`,floor,hold})))];
export function durationTrial(options,cfg){
 const ob=controlObserver(0);let control;
 const r=trial('live',CANDIDATE,{...options,onStart(G,g){
  control=installControlRecovery(G.enemy,{floor:cfg.floor,seconds:cfg.hold+.24,holdSeconds:cfg.hold===.12?null:cfg.hold});
  linkSweepRecovery(g,G.player.skill._contactSweep,G.player,control,ob,()=>G.t);
 },onFrame(G){ob.step(G);}});
 return {...r,controlConfig:{...cfg,recovery:.24},controlEvents:control.events,observation:ob.finish()};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const out='docs/research/iberian_control_duration_20261018';mkdirSync(`${out}/raw`,{recursive:true});
 const phase=process.env.PHASE??'screen';
 const prior=JSON.parse(readFileSync('docs/research/iberian_control_strength_20261018/live-cases.json'));
 const cases=phase==='screen'?prior.slice(0,12):prior.slice(0,12).map(c=>({...c,seed:c.seed+300}));
 const configs=process.env.CONFIGS?JSON.parse(process.env.CONFIGS):GRID;
 const plan={phase,cases,configs,recovery:.24,createdAt:new Date().toISOString(),selection:'First-event 0.5/1 second player damage and counter opportunity; full 30 second harm cross-check; separate outcomes, no invented HP score.'};
 if(process.env.APPEND==='1'){
  const previous=JSON.parse(readFileSync(`${out}/${phase}-plan.json`));
  if(JSON.stringify(previous.cases)!==JSON.stringify(cases)||configs.some(c=>previous.configs.some(p=>p.id===c.id)))throw Error('Invalid appended arm');
  plan.configs=[...previous.configs,...configs];plan.createdAt=previous.createdAt;plan.appendedAt=new Date().toISOString();plan.appendReason='10%/0.36s showed a better long-fight screening compromise than adjacent longer settings; add a long 10% comparison before seeing its confirmation results.';
 }
 writeFileSync(`${out}/${phase}-plan.json`,JSON.stringify(plan,null,2));
 for(const cfg of configs){const rows=[];const start=Date.now();for(const [i,c] of cases.entries()){
  const r=durationTrial(c,cfg);rows.push(r);
  writeFileSync(`${out}/raw/${phase}-${cfg.id}.json.gz`,gzipSync(JSON.stringify(rows)));
  console.log(JSON.stringify({phase,id:cfg.id,i,elapsedSeconds:(Date.now()-start)/1000,duration:r.duration,first:r.observation.first,effects:r.controlEvents.length,alive:r.health.end.alive}));
 }}
}
