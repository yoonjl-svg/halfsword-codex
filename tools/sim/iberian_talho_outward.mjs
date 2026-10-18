import {trial} from './iberian_contact_study.mjs';
import {controlObserver} from './control_strength_observer.mjs';
import {linkSweepRecovery} from './contact_control_recovery.mjs';
import {installForceCap} from './contact_force_cap.mjs';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
export const OUT='docs/research/iberian_talho_outward_20261019';
export const MOTION=JSON.parse(readFileSync('docs/research/iberian_contact_20261018/candidate-outward.json'));
export function compareTrial(options,cfg){
 const ob=controlObserver(0);let cap;
 const twist={frames:0,limitedFrames:0,minScale:1,maxServoRatio:0,minActiveCap:null,maxInactiveCap:0};
 const r=trial('live',{...MOTION,observeOnly:cfg.motion==='native'}, {...options,onStart(G,g){
  cap=installForceCap(G.enemy,cfg);
  linkSweepRecovery(g,G.player.skill._contactSweep,G.player,cap,ob,()=>G.t);
  G.enemy._studyTwistAudit=({scale,cap,servo})=>{twist.frames++;twist.minScale=Math.min(twist.minScale,scale);if(scale<1){twist.limitedFrames++;twist.minActiveCap=Math.min(twist.minActiveCap??Infinity,cap);}else twist.maxInactiveCap=Math.max(twist.maxInactiveCap,cap);twist.maxServoRatio=Math.max(twist.maxServoRatio,Math.abs(servo)/cap);};
 },onFrame(G){ob.step(G);}});
 return {...r,studyConfig:cfg,controlEvents:cap.events,observation:ob.finish(),twistAudit:twist};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const plan=JSON.parse(readFileSync(`${OUT}/plan.json`));const cfg=plan.configs.find(c=>c.id===process.env.ARM);if(!cfg)throw Error('ARM required');
 const rows=[],start=Date.now();for(const [i,c] of plan.cases.entries()){
  const r=compareTrial(c,cfg);rows.push(r);writeFileSync(`${OUT}/raw/${cfg.id}.json.gz`,gzipSync(JSON.stringify(rows)));
  console.log(JSON.stringify({arm:cfg.id,i,elapsed:(Date.now()-start)/1000,first:r.observation.first,effects:r.controlEvents.length,twistFrames:r.twistAudit.limitedFrames,alive:r.health.end.alive}));
 }
 writeFileSync(`${OUT}/raw/${cfg.id}-time.json`,JSON.stringify({started:new Date(start).toISOString(),ended:new Date().toISOString(),seconds:(Date.now()-start)/1000,runs:rows.length}));
}
