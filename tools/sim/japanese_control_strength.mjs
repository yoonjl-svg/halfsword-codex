import {trial} from './japanese_recovery.mjs';
import {FLOW_RECOVERY} from '../../src/nagashi_recovery.js';
import {controlObserver} from './control_strength_observer.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
export function strengthTrial(options={},floor=1,observe=true){
 const ob=controlObserver(0,{capture:!!options.capture});let last=null;
 FLOW_RECOVERY.floor=floor;
 try{
  const r=trial({...options,duration:floor===1?0:.36,release:true,onFrame(G,g){
   const flow=G.combat.lastNagashi;
   if(flow&&flow!==last){last=flow;if(flow.Jt>0)ob.trigger(G.t,{defender:flow.d,applied:!!flow.recovery});}
   if(observe)ob.step(G);options.onFrame?.(G,g);
  }});
  return {...r,controlFloor:floor,controlEvents:r.events,observation:ob.finish()};
 }finally{FLOW_RECOVERY.floor=.25;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const out='docs/research/japanese_control_strength_20261018';mkdirSync(`${out}/raw`,{recursive:true});
 const phase=process.env.PHASE??'live';
 const cases=phase==='probe'?[{seed:511,atk:'longsword',policy:'reactive',seconds:23.2},{seed:511,atk:'zweihander',policy:'riposte',seconds:20.9},{seed:512,atk:'qinggang',policy:'riposte',seconds:4.95},{seed:513,atk:'longsword',policy:'riposte',seconds:10.05},{seed:502,atk:'qinggang',policy:'slash',seconds:5.85},{seed:514,atk:'longsword',policy:'riposte',seconds:7.75}]:[611,612,613,614].flatMap(seed=>['longsword','qinggang','zweihander'].flatMap(atk=>['riposte','slash'].map(policy=>({seed,atk,policy,seconds:30}))));
 writeFileSync(`${out}/${phase}-cases.json`,JSON.stringify(cases,null,2));
 for(const floor of [1,.25,0]){const rows=[];for(const [i,c] of cases.entries()){
  const r=strengthTrial(c,floor);rows.push(r);writeFileSync(`${out}/raw/${phase}-${floor}.json.gz`,gzipSync(JSON.stringify(rows)));
  console.log(JSON.stringify({phase,floor,i,seed:c.seed,atk:c.atk,duration:r.duration,flows:r.flows.length,effects:r.controlEvents.length,alive:r.health.end.alive,concussion:r.health.concussion,limb:r.health.limbLost}));
 }}
}
