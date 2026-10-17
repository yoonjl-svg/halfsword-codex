import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
const dir=process.argv[2]??'/workspace/chinese-parry-path-20261017';
const read=n=>JSON.parse(existsSync(`${dir}/${n}.json`)?readFileSync(`${dir}/${n}.json`):gunzipSync(readFileSync(`${dir}/raw/${n}.json.gz`)));
const previous=n=>JSON.parse(gunzipSync(readFileSync(new URL(`../../docs/research/chinese_player_parry_20261017/raw/${n}.json.gz`,import.meta.url))));
const key=r=>[r.atk,r.name,r.gap,r.strokeSpeed??11,r.press].join('|');
const effect=w=>w.type!=='blunt'||w.severity>0||w.energy>10; // combat.js applyWound gate
const hit=r=>r.wounds.some(w=>w.t+1e-8>=r.press&&effect(w));
function sum(a){return{n:a.length,cut:a.filter(r=>r.injured).length,criticalCut:a.filter(r=>r.wounds.some(w=>w.type!=='blunt'&&['head','neck','chest'].includes(w.zone))).length,appliedHitAfterPress:a.filter(hit).length,noCutButAppliedHit:a.filter(r=>!r.injured&&hit(r)).length,blockCost:a.reduce((s,r)=>s+r.stamina.spent.block,0),attackCost:a.reduce((s,r)=>s+r.stamina.spent.attack,0),paidAndHit:a.filter(r=>hit(r)&&r.stamina.spent.block>0).length};}
function pair(a,b){const bm=new Map(b.map(r=>[key(r),r]));return{...sum(a),newCut:a.filter(r=>r.injured&&!bm.get(key(r)).injured).map(key),savedCut:a.filter(r=>!r.injured&&bm.get(key(r)).injured).map(key),newHit:a.filter(r=>hit(r)&&!hit(bm.get(key(r)))).map(key),savedHit:a.filter(r=>!hit(r)&&hit(bm.get(key(r)))).map(key)};}
const b=previous('risk-paired').filter(r=>r.kind==='base');
const kinds=['blade-now','blade-hold','low-preview','sweep-fit'];
const hold=read('holdout-low-preview'),window=read('window-low-preview');
function curves(rows){const names=[...new Set(rows.map(r=>[r.atk,r.name,r.gap].join('|')))];return Object.fromEntries(names.map(name=>[name,Object.fromEntries([...new Set(rows.map(r=>r.kind))].map(k=>{
 const a=rows.filter(r=>[r.atk,r.name,r.gap].join('|')===name&&r.kind===k).sort((x,y)=>x.lead-y.lead);let start=null,span=0;
 for(const r of a){if(!r.injured){start??=r.lead;span=Math.max(span,r.lead-start);}else start=null;}
 return[k,{...sum(a),longestNoCutSampleSpan:span,points:a.map(r=>({lead:r.lead,press:r.press,cut:r.injured,hit:hit(r)}))}];}))]));}
const formalNames=['oracle','baseline-traces','ceiling-early','screen-blade-now','screen-blade-hold','screen-low-preview','screen-sweep-fit','regression-low-preview','window-low-preview','holdout-unguarded','holdout-low-preview','fixed-window','arrival-traces','screen-low-preview-no-attack-lead','fixed-window-no-attack-lead','edges'];
const report={base:'204ef85738f873e59c83c13f1dbda1286023bc63',productionBase:'0bd04a51fe07d6e8b3a7d493e7d493dc6eb8ce8b',decision:'No release candidate. Blade reading alone did not produce a robust input window.',
 baseline:sum(b),screen:Object.fromEntries(kinds.map(k=>[k,pair(read('screen-'+k),b)])),regression:pair(read('regression-low-preview'),previous('base')),
 holdout:{baseline:sum(hold.filter(r=>r.kind==='base')),candidate:pair(hold.filter(r=>r.kind==='low-preview'),hold.filter(r=>r.kind==='base')),danger:{baseline:sum(hold.filter(r=>r.kind==='base'&&r.unguardedInjured)),candidate:sum(hold.filter(r=>r.kind==='low-preview'&&r.unguardedInjured))}},
 window:curves(window),fixedWindow:curves(read('fixed-window')),motorFixedWindow:curves(read('fixed-window-no-attack-lead')),motor:pair(read('screen-low-preview-no-attack-lead'),b),oracle:read('oracle-map'),
 arrival:read('arrival-traces').map(r=>{const first=1.2416666666666647,ms=r.measures.filter(m=>m.t>r.press+.08&&m.t<first);return{lead:r.lead,cut:r.injured,appliedHit:hit(r),frames:ms.length,outsidePhysicalArm:ms.filter(m=>m.targetReach>m.physicalArmLength).length,maxExcess:Math.max(...ms.map(m=>m.targetReach-m.physicalArmLength)),peakHandError:Math.max(...ms.map(m=>m.handError)),peakAngleError:Math.max(...ms.map(m=>m.angleError))};}),
 browser:read('browser-input').map(({kind,errors,checks})=>({kind,errors,checks})),visual:read('visual'),
 uniqueStoredTrialRows:formalNames.reduce((n,k)=>n+read(k).length,0),additionalScopeBaselineRuns:4,repeatedRestoreAndTraceRuns:60,notes:['Danger group means unguarded cut/stab, not all impact risk. The other group may already have effectful blunt hits. The new cut at longsword unterhau 1.65m speed9 worsened a blunt hit, not a complete miss.','Stored trials include diagnostic repeated conditions; not independent matches.','57 low-preview rows rerun after output filename collision and matched initial summary; 3 arrival traces rerun to add reach measurement.','Oracle force lines and no-attack-lead are diagnoses, not deployable candidates.','Effectful blunt hits use existing combat applyWound threshold, not a new balance threshold.']};
writeFileSync(`${dir}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({stored:report.uniqueStoredTrialRows,baseline:report.baseline,screen:report.screen,holdout:report.holdout},null,2));
