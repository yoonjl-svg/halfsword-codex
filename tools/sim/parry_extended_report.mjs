// Recompute the report from raw data. Baseline half-A is reused from cycle 1.
import {readFileSync,writeFileSync,existsSync,readdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {resolve} from 'node:path';
const dir=resolve(process.argv[2]??'/workspace/parry-extended-20261017');
const baseDir=resolve(process.argv[3]??'docs/research/parry_reading_20261017');
const read=(name,where=dir)=>JSON.parse(existsSync(`${where}/${name}.json`)?readFileSync(`${where}/${name}.json`):gunzipSync(readFileSync(`${where}/${name}.json.gz`)));
const sum=(rows,key)=>rows.reduce((s,r)=>s+r[key],0);
const key=r=>[r.cfg,r.atk,r.name,r.gap].join('|');
const weights=read('report',baseDir).weights;
const base=new Map();
for(const atk of ['longsword','rapier','zweihander']){
 const j=read(`base-map-${atk}`,baseDir);
 for(const[cfg,attacks]of Object.entries(j.configs))for(const[name,rows]of Object.entries(attacks))rows.forEach((r,i)=>base.set(key({cfg,atk,name,gap:j.gaps[i]}),['wind','cut','pushed'].includes(r.why)));
}
const paired=rows=>[...new Set(rows.map(r=>r.cfg))].map(cfg=>{
 const a=rows.filter(r=>r.cfg===cfg);for(const r of a)if(!base.has(key(r)))throw Error(`Missing baseline: ${key(r)}`);
 const newHits=a.filter(r=>r.injured&&!base.get(key(r))).map(key),saved=a.filter(r=>!r.injured&&base.get(key(r))).map(key);
 return {cfg,n:a.length,base:a.filter(r=>base.get(key(r))).length,candidate:a.filter(r=>r.injured).length,newHits,saved,weightedDelta:100*a.reduce((s,r)=>s+weights[r.name]*(r.injured-base.get(key(r))),0)/a.reduce((s,r)=>s+weights[r.name],0),zornNew:newHits.filter(k=>/\|zornhauL?\|/.test(k)).length};
});
const liveSummary=rows=>({n:rows.length,seconds:sum(rows,'duration'),fresh:sum(rows,'fresh'),flows:sum(rows,'flows'),contactsPerFlow:sum(rows,'fresh')/sum(rows,'flows'),cuts:sum(rows,'cuts'),energy:sum(rows,'energy'),switches:sum(rows,'switches'),activations:sum(rows,'activations'),alive:rows.filter(r=>r.alive).length,earlyEnd:rows.filter(r=>r.duration<119.99).map(r=>({seed:r.seed,t:r.duration,alive:r.alive})),rows:rows.map(({wounds,changes,...r})=>r)});
const lives={};
for(const[title,b,c]of [['E_training','live-base','live-rise'],['E_holdout','live-holdout-base','live-holdout-rise'],['E_damage','damage-base','damage-rise'],['E2_holdout','final-live-base','final-live-candidate'],['E2_damage','final-damage-base','final-damage-candidate']])lives[title]={base:liveSummary(read(b)),candidate:liveSummary(read(c))};
lives.H={base:liveSummary(read('live-base').filter(r=>r.seed<=5)),candidate:liveSummary(read('live-reacquire'))};
const hold=read('holdout-rise');const holdout=[...new Set(hold.map(r=>r.cfg))].map(cfg=>{
 const a=hold.filter(r=>r.cfg===cfg),pairs=[];for(let i=0;i<a.length;i+=2)pairs.push([a[i],a[i+1]]);
 const compact=p=>({cfg:p[0].cfg,name:p[0].name,gap:p[0].gap,speed:p[0].strokeSpeed,pause:p[0].prepPause});
 return {cfg,n:pairs.length,base:pairs.filter(p=>p[0].injured).length,candidate:pairs.filter(p=>p[1].injured).length,newHits:pairs.filter(p=>!p[0].injured&&p[1].injured).map(compact),saved:pairs.filter(p=>p[0].injured&&!p[1].injured).map(compact)};
});
const os=read('oracle-high'),ob=new Map(os.filter(r=>r.start===null).map(r=>[key(r),r]));
const oracle=[...new Set(os.map(r=>r.start))].map(start=>{
 const a=os.filter(r=>r.start===start),covered=r=>r.firstStrokeClash?.mode==='defend'&&r.firstStrokeClash.cover>=.5;
 return {start,n:a.length,injured:a.filter(r=>r.injured).length,clashes:a.filter(r=>r.firstStrokeClash).length,covered:a.filter(covered).length,coveredOnOriginalContacts:a.filter(r=>ob.get(key(r)).firstStrokeClash&&covered(r)).length,nag:a.filter(r=>r.nag).length,newHits:a.filter(r=>r.injured&&!ob.get(key(r)).injured).map(key),saved:a.filter(r=>!r.injured&&ob.get(key(r)).injured).map(key)};
});
const screens=readdirSync(dir).filter(f=>/^screen-.*\.json(\.gz)?$/.test(f)).sort().map(f=>{const r=read(f.replace(/\.json(\.gz)?$/,''));return{kind:r.kind,n:r.rows.length,newHits:r.newHits,saved:r.saved};});
const edges=read('edges');const pairedEdges=[];
for(let i=0;i<edges.length;i+=2){const b=edges[i],c=edges[i+1];if(b.schedule==='out-of-scope')break;pairedEdges.push({schedule:b.schedule,key:key(b),base:b.injured,candidate:c.injured});}
const report={baseSha:'f21266d6bcb3c44c02e0bd365a68cda5416ad6d1',previousResult:'73158abeb2cb7a50afaa19ddad76d1eeac3ced7d',adopted:false,scope:'research tools only; 12 candidate variants; source/public game unchanged',weights,screens,E:paired(read('map-rise')),E2:paired(read('map-rise-jp-lowL')),holdout,lives,oracle,edges:{n:edges.length,releaseIllegal:sum(edges.filter(r=>r.illegal!==undefined),'illegal'),preparationOrOutOfScopeActivations:sum(edges.filter(r=>r.schedule==='prepare-only'||r.schedule==='out-of-scope'),'activations'),paired:pairedEdges},browser:read('browser'),definitions:{injured:'at least one non-blunt wound in one scripted trial',liveCuts:'non-blunt wound events; multiple zones per impact possible',liveDamage:'false disables defender wounds only; bouts stop when either fighter dies',earlyEnd:'120-second live bouts may end early when the attacker dies; paired durations are exposed',oracle:'uses trial wall time; diagnostic only, not an implementable reader',validation:'E2 was chosen after E results; seeds 1–15 are no longer independent for E2; E2 independent seeds16–20, only 4 activations in wound-disabled fights and zero with wounds enabled'}};
const finalContact=read('final-contact');
report.E2Contact={n:finalContact.length,injured:finalContact.filter(r=>r.injured).length,clashes:finalContact.filter(r=>r.firstStrokeClash).length,covered:finalContact.filter(r=>r.firstStrokeClash?.mode==='defend'&&r.firstStrokeClash.cover>=.5).length,nagBouts:finalContact.filter(r=>r.nag).length};
writeFileSync(`${dir}/report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({candidates:screens.length+1,E:report.E.map(({cfg,base,candidate,weightedDelta})=>({cfg,base,candidate,weightedDelta})),E2:report.E2,holdout,lives:Object.fromEntries(Object.entries(lives).map(([k,v])=>[k,Object.fromEntries(Object.entries(v).map(([k,{rows,...v}])=>[k,v]))])),oracle,edgeSummary:{...report.edges,paired:undefined}},null,2));
