import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
const dir=process.argv[2]??'/workspace/chinese-parry-benefit-20261017';
const read=n=>{const p=`${dir}/${n}.json`;return JSON.parse(existsSync(p)?readFileSync(p):gunzipSync(readFileSync(`${dir}/raw/${n}.json.gz`)));};
const sum=(a,f)=>a.reduce((s,r)=>s+f(r),0);
function summary(a){const n=a.length;return {n,deaths:sum(a,r=>!r.health.end.alive),opponentDefeated:sum(a,r=>r.enemy?!r.enemy.end.alive:0),survivedTo30:sum(a,r=>r.duration>=30-1e-7&&r.health.end.alive),meanBloodLoss:sum(a,r=>r.health.bloodLost)/n,meanLimbLoss:sum(a,r=>r.health.limbLost)/n,meanConcussion:sum(a,r=>r.health.concussion)/n,meanDownTime:sum(a,r=>r.health.downTime)/n,meanBlockCost:sum(a,r=>r.health.stamina.spent.block)/n,meanAttackCost:sum(a,r=>r.health.stamina.spent.attack)/n,meanExhaustedTime:sum(a,r=>r.health.exhaustedTime)/n,meanNegativeStaminaTime:sum(a,r=>r.health.negativeStaminaTime)/n,observedSeconds:sum(a,r=>r.duration??0),hits:sum(a,r=>r.health.hits),cutHits:sum(a,r=>r.health.cutHits)};}
const screenKinds=['base','low-preview','compact','cross','hang','roof','upper-retain','upper-peak','speed20','compact-native'];
const liveKinds=screenKinds.filter(k=>!['cross','roof'].includes(k));
const report={sourceBase:'0bd04a51fe07d6e8b3a7d493e7d493dc6eb8ce8b',parent:'defab0bcc487f4b5f9f34046a5c75119ecc83ba0',screen:{},exploratory:{},confirmation:{},window:{}};
for(const k of screenKinds)report.screen[k]=summary(read(`screen-${k}`));
for(const [label,kinds,field] of [['live',liveKinds,'exploratory'],['confirm',['base','compact','compact-native'],'confirmation']])for(const kind of kinds){const a=read(`${label}-${kind}`);report[field][kind]=Object.fromEntries(['all','reactive','exchange'].map(p=>[p,summary(a.filter(r=>p==='all'||r.policy===p))]));}
report.confirmationPairs={};const bases=read('confirm-base');
for(const k of ['compact','compact-native']){
 const rows=read(`confirm-${k}`),pairs=[];
 for(const b of bases){const a=rows.find(r=>r.seed===b.seed&&r.atk===b.atk&&r.policy===b.policy);pairs.push({seed:b.seed,atk:b.atk,policy:b.policy,baseAlive:b.health.end.alive,candidateAlive:a.health.end.alive,baseWon:!b.enemy.end.alive,candidateWon:!a.enemy.end.alive,bloodDelta:a.health.bloodLost-b.health.bloodLost,limbDelta:a.health.limbLost-b.health.limbLost});}
 report.confirmationPairs[k]=pairs;
}
const w=read('window');for(const gap of [1.1,1.5])for(const kind of ['base','compact-native']){const a=w.filter(r=>r.kind===kind&&r.gap===gap);report.window[`${gap}|${kind}`]={...summary(a),cutConditions:a.filter(r=>r.injured).length,lowFrames:sum(a,r=>r.metrics.activeLowFrames),outsideReachFrames:sum(a,r=>r.metrics.outsideReach),maxReach:Math.max(...a.map(r=>r.metrics.maxReach))};}
report.browser=read('browser-input').map(({kind,errors,checks})=>({kind,errors,checks}));report.verification=read('verification');
report.storedRows={singleAttacks:screenKinds.length*57,exploratoryEncounters:liveKinds.length*16,independentEncounters:3*24,inputWindow:44};
report.notes=['Player commands are a surrogate, not actual human play. Opponent uses existing AI; player is not AI-controlled.','Encounters stop at either combatant defeat or 30 seconds. Blood/limb averages have differing exposure; use mortality and victory alongside them.','Exploratory and independent seeds/distances were separated. No candidate was tuned on the confirmation results.','Hit counts are secondary. A saved neck-fatal blow may become several lesser hits; independent encounters can still worsen.','No production source, upstream repo, secret connection, or public deployment changed.'];
writeFileSync(`${dir}/report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.confirmation));
