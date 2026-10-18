import {trial} from './iberian_contact_study.mjs';
import {controlObserver} from './control_strength_observer.mjs';
import {installControlRecovery,linkSweepRecovery} from './contact_control_recovery.mjs';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
export const CANDIDATE=JSON.parse(readFileSync('docs/research/iberian_contact_20261018/candidate-outward.json'));
export function strengthTrial(options={},floor=1,mode='live',observe=true){
 const ob=controlObserver(0,{capture:!!options.capture});let control;
 const r=trial(mode,CANDIDATE,{...options,onStart(G,g){
  control=installControlRecovery(G.enemy,{floor});
  linkSweepRecovery(g,G.player.skill._contactSweep,G.player,control,ob,()=>G.t);
  options.onStart?.(G,g);
 },onFrame(G,g){if(observe)ob.step(G);options.onFrame?.(G,g);}});
 return {...r,controlFloor:floor,controlEvents:control.events,observation:ob.finish()};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const out='docs/research/iberian_control_strength_20261018';mkdirSync(`${out}/raw`,{recursive:true});
 const phase=process.env.PHASE??'live';
 const prior=JSON.parse(readFileSync('docs/research/iberian_contact_20261018/fresh-cases.json'));
 const cases=phase==='probe'?['zornhau','zornhauL','zwerch','zwerchL'].map(attack=>({attack,atk:'longsword',gap:1.4,counter:true})):
 [...prior,...prior.map(c=>({...c,seed:c.seed+100}))];
 writeFileSync(`${out}/${phase}-cases.json`,JSON.stringify(cases,null,2));
 for(const floor of [1,.25,0]){const rows=[];for(const [i,c] of cases.entries()){
  const r=strengthTrial(c,floor,phase==='probe'?'probe':'live');rows.push(r);
  writeFileSync(`${out}/raw/${phase}-${floor}.json.gz`,gzipSync(JSON.stringify(rows)));
  console.log(JSON.stringify({phase,floor,i,seed:c.seed,atk:c.atk,duration:r.duration,motions:r.motions.length,effects:r.controlEvents.length,alive:r.health.end.alive,concussion:r.health.concussion,limb:r.health.limbLost}));
 }}
}
