import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
const dir=process.argv[2]??'/workspace/chinese-parry-gap-20261017';
const read=n=>{const p=`${dir}/${n}.json`;return JSON.parse(existsSync(p)?readFileSync(p):gunzipSync(readFileSync(`${dir}/raw/${n}.json.gz`)));};
const sum=(a,f)=>a.reduce((s,x)=>s+f(x),0);
function summarize(a){const n=a.length;return {n,deaths:sum(a,r=>!r.health.end.alive),disarmed:sum(a,r=>!r.health.end.armed),wins:sum(a,r=>r.enemy?!r.enemy.end.alive:0),observedSeconds:sum(a,r=>r.duration),bloodLoss:sum(a,r=>r.health.bloodLost)/n,limbLoss:sum(a,r=>r.health.limbLost)/n,concussion:sum(a,r=>r.health.concussion)/n,downTime:sum(a,r=>r.health.downTime)/n,blockCost:sum(a,r=>r.health.stamina.spent.block)/n,hits:sum(a,r=>r.health.hits),cuts:sum(a,r=>r.health.cutHits)};}
const phase=e=>['down','getup'].includes(e.state)?'down/getup':!e.armed?'disarmed':e.active?'guard-'+e.mode:e.tap||e.broken?'counter':'released';
const report={baseline:'0bd04a51fe07d6e8b3a7d493e7d493dc6eb8ce8b',parent:'64ffa8339148f2d69f2a5f5a15b789705431ba34',diagnosis:{},screen:{},explore:{},confirm:{},window:{}};
const original=[...read('diagnose-live'),...read('diagnose-confirm')],byPhase={},byLine={},swordArm={hits:0,loss:0,bounceHits:0,bounceLoss:0};let armLoss=0,bounceLoss=0,armHits=0,bounceHits=0;
for(const r of original)for(const e of r.events){const h=e.applied;for(const [obj,key] of [[byPhase,phase(e)],...(e.active?[[byLine,e.line]]:[])]){const v=obj[key]??={hits:0,bleed:0,concussion:0,pain:0,balance:0,limb:0};v.hits++;for(const [k,x] of Object.entries(h.delta))v[k]+=x;}
 if(e.active&&h.zone==='arm'&&h.delta.limb>0){armHits++;armLoss+=h.delta.limb;const bounce=['highL','highC','highR'].includes(e.line)&&e.recent.some(x=>x.active&&['point','lowL','lowR'].includes(x.line)&&x.tip[1]>.5&&x.t>=e.t-.25);if(bounce){bounceHits++;bounceLoss+=h.delta.limb;}if(['farmS','uarmS'].includes(h.part)){swordArm.hits++;swordArm.loss+=h.delta.limb;if(bounce){swordArm.bounceHits++;swordArm.bounceLoss+=h.delta.limb;}}}
}
report.diagnosis={...summarize(original),deathsWhileDisarmed:sum(original,r=>!r.health.end.alive&&!r.health.end.armed),byPhase,byLine,swordArm,armedGuardArmDamage:{armHits,armLoss,bounceHits,bounceLoss,definition:'Active guard arm wounds with actual limb loss; upper-line wound preceded within .25s by point/low line while tip >.5m above chest. Sampled history every .05s; association, not causal proof.'}};
for(const k of ['base','delay12','gate20','inside','inside-ready']){
 report.screen[k]=summarize(read(`screen-${k}`));
 const a=k==='base'?read('diagnose-live'):read(`explore-${k}`);
 report.explore[k]=Object.fromEntries(['all','reactive','exchange'].map(p=>[p,summarize(a.filter(r=>p==='all'||r.policy===p))]));
}
for(const k of ['base','inside']){const a=read(`confirm-${k}`);report.confirm[k]=Object.fromEntries(['all','reactive','exchange'].map(p=>[p,summarize(a.filter(r=>p==='all'||r.policy===p))]));}
const base=read('confirm-base'),candidate=read('confirm-inside');report.confirmPairs=base.map((b,i)=>{const a=candidate[i];return {seed:b.seed,atk:b.atk,policy:b.policy,baseAlive:b.health.end.alive,candidateAlive:a.health.end.alive,baseWin:!b.enemy.end.alive,candidateWin:!a.enemy.end.alive,bloodDelta:a.health.bloodLost-b.health.bloodLost,limbDelta:a.health.limbLost-b.health.limbLost};});
const w=read('window');for(const gap of [1.1,1.5])for(const kind of ['base','inside']){const a=w.filter(r=>r.gap===gap&&r.kind===kind);report.window[`${kind}|${gap}`]={...summarize(a),noCutInputs:a.filter(r=>!r.health.cutHits).map(r=>r.lead),poseFrames:sum(a,r=>r.metrics.frames),outsideReachFrames:sum(a,r=>r.metrics.outside),maxPoseReach:Math.max(...a.map(r=>r.metrics.maxReach))};}
report.verification=read('verification');report.browser=read('browser-input').map(({kind,errors,checks})=>({kind,errors,checks}));
report.counts={diagnosticReplays:40,singleAttacks:285,exploratoryNewEncounters:64,independentEncounters:48,inputWindow:36,scopeTrials:12,releaseTrials:4,visualNodePairs:4,browserButtonChecks:18};
report.limits=['Small fixed command-model sample, not human playtest or population frequencies. Some paired policies share an identical opening; 40 conditions are not 40 independent human games.','Blood/limb/concussion are separate applied effects, not a single HP score. Compare survival, defeat and exposure too.','The transition marker is an association. Forced pose changes alter physics and later opponent/player decisions.','No production source/public game/upstream change; all candidates remain research.','Initial screenshot run consumed physics RNG through Three object creation; excluded pilot preserved. Final render uses isolated visual RNG and Node/browser damage agrees exactly.'];
writeFileSync(`${dir}/report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({diagnosis:report.diagnosis.armedGuardArmDamage,confirm:report.confirm,counts:report.counts}));
