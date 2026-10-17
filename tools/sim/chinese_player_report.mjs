// Rebuild report.json from either original JSON or archived *.json.gz.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
const dir=process.argv[2]??'/workspace/chinese-parry-player-20261017';
const read=n=>JSON.parse(existsSync(`${dir}/${n}.json`)?readFileSync(`${dir}/${n}.json`):gunzipSync(readFileSync(`${dir}/raw/${n}.json.gz`)));
const key=r=>[r.atk,r.name,r.gap,r.press].join('|');
const critical=r=>r.wounds.some(w=>w.type!=='blunt'&&['head','neck','chest'].includes(w.zone));
const firstCut=r=>r.wounds.find(w=>w.type!=='blunt');
function summarize(a){const hurt=a.filter(r=>r.injured);return{n:a.length,injured:hurt.length,critical:a.filter(critical).length,dead:a.filter(r=>!r.alive).length,cleanClash:a.filter(r=>!r.injured&&r.clashes.some(c=>c.fresh&&c.t>=Math.max(r.press,.6))).length,blockCost:a.reduce((s,r)=>s+r.stamina.spent.block,0),attackCost:a.reduce((s,r)=>s+r.stamina.spent.attack,0),injuredAndPaidBlock:hurt.filter(r=>r.stamina.spent.block>0).length,blockCostOnInjured:hurt.reduce((s,r)=>s+r.stamina.spent.block,0),firstCutWhileDefending:hurt.filter(r=>firstCut(r).mode==='defend').length,firstCutWithCoverAtLeastHalf:hurt.filter(r=>firstCut(r).cover>=.5).length};}
function pair(a,b){const bi=new Map(b.map(r=>[key(r),r]));return{...summarize(a),saved:a.filter(r=>!r.injured&&bi.get(key(r)).injured).map(key),newInjuries:a.filter(r=>r.injured&&!bi.get(key(r)).injured).map(key)};}
const screenKinds=['base','ready','entry','dwell06','dwell12','ready-low','ready-high','ready-native','watch'];
const holdKinds=['base','ready','ready-low','watch'];
const screen=Object.fromEntries(screenKinds.map(k=>[k,read(k)]));const hold=Object.fromEntries(holdKinds.map(k=>[k,read('holdout-'+k)]));
const risk=[...read('risk-paired'),...read('risk-watch')],rb=risk.filter(r=>r.kind==='base');
const jitter=read('jitter');
const report={
 base:'0bd04a51fe07d6e8b3a7d493e7d493dc6eb8ce8b',instrumentation:3,scope:'Human input trajectories are primary; no human playtest or AI duel claim. Secret connection not implemented.',
 screen:Object.fromEntries(screenKinds.map(k=>[k,pair(screen[k],screen.base)])),
 holdout:Object.fromEntries(holdKinds.map(k=>[k,pair(hold[k],hold.base)])),
 unguarded:Object.fromEntries(['unguarded','holdout-unguarded','risk-unguarded'].map(k=>[k,summarize(read(k))])),
 risk:Object.fromEntries(holdKinds.map(k=>[k,{...pair(risk.filter(r=>r.kind===k),rb),byLead:Object.fromEntries([.3,.2,.1].map(lead=>[lead,summarize(risk.filter(r=>r.kind===k&&r.lead===lead))]))}])),
 jitter:Object.fromEntries(['unterhau','oberhau','위→다리'].map(name=>[name,jitter.filter(r=>r.name===name).map(r=>({press:r.press,kind:r.kind,injured:r.injured}))])),
 browser:read('browser-input').map(({kind,errors,checks})=>({kind,errors,checks})),visual:read('visual'),
 totalFormalTrials:Object.values(screen).reduce((s,a)=>s+a.length,0)+Object.values(hold).reduce((s,a)=>s+a.length,0)+risk.length+jitter.length+['unguarded','holdout-unguarded','risk-unguarded'].reduce((s,k)=>s+read(k).length,0)
};
writeFileSync(`${dir}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({formalTrials:report.totalFormalTrials,risk:report.risk,holdout:report.holdout},null,2));
