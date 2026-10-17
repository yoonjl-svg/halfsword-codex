// Rebuild the paired report from stored, unrounded trial data.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
if (!process.argv[2]) throw Error('Usage: node tools/sim/parry_reading_report.mjs <artifact directory>');
const dir = resolve(process.argv[2]);
const read = n => JSON.parse(existsSync(`${dir}/${n}.json`) ? readFileSync(`${dir}/${n}.json`, 'utf8') : gunzipSync(readFileSync(`${dir}/${n}.json.gz`)).toString());
const weights = Object.fromEntries('zornhau,zornhauL,stichPflug,unterhau,zuoyi,unterhauL,oberhau,talhoReves,stichOchsL,stichOchs,zwerch,찌르기→베기,talhoRodeado,zwerchL,hirakiGiri,stichPflugL,tsubameGaeshi,inquartata,위→다리'.split(',').map((n,i)=>[n,[129,73,45,43,31,30,23,21,16,15,13,12,12,11,10,6,6,5,5][i]]));
const sum = a => a.reduce((s,x)=>s+x,0);
const key = r => [r.cfg,r.atk,r.name,r.gap].join('|');
const injured = r => ['wind','cut','pushed'].includes(r.why);
const base = [];
for (const atk of ['longsword','rapier','zweihander']) {
  const b = read(`base-map-${atk}`);
  for (const [cfg,attacks] of Object.entries(b.configs)) for (const [name,rows] of Object.entries(attacks)) rows.forEach((r,i)=>base.push({cfg,atk,name,gap:b.gaps[i],injured:injured(r),...r}));
}
const baseIndex = new Map(base.map(r=>[key(r),r]));
function paired(rows) {
  return [...new Set(rows.map(r=>r.cfg))].map(cfg=>{
    const rr=rows.filter(r=>r.cfg===cfg), newHits=[], saved=[];
    for(const r of rr){const b=baseIndex.get(key(r));if(!b)throw Error(`No baseline ${key(r)}`);if(r.injured&&!b.injured)newHits.push(key(r));if(!r.injured&&b.injured)saved.push(key(r));}
    const den=sum(rr.map(r=>weights[r.name]));
    const baseWeighted=100*sum(rr.map(r=>weights[r.name]*baseIndex.get(key(r)).injured))/den;
    const candidateWeighted=100*sum(rr.map(r=>weights[r.name]*r.injured))/den;
    return {cfg,n:rr.length,baseInjured:rr.filter(r=>baseIndex.get(key(r)).injured).length,candidateInjured:rr.filter(r=>r.injured).length,newHits,saved,net:newHits.length-saved.length,baseWeighted,candidateWeighted,weightedDelta:candidateWeighted-baseWeighted,zornNew:newHits.filter(k=>/\|zornhauL?\|/.test(k)).length};
  });
}
const bContact=read('base-contact');
const contact={baseline:Object.fromEntries(Object.entries(bContact).map(([cfg,rows])=>[cfg,{n:rows.length,clash:rows.filter(r=>r.mode).length,defend:rows.filter(r=>r.mode==='defend').length,covered:rows.filter(r=>r.mode==='defend'&&r.cw>=.5).length,injured:rows.filter(r=>['cut','wind'].includes(r.why)).length,nagBouts:rows.filter(r=>r.nag).length}]))};
for(const tag of ['h3a','h3c']){
  const rows=read(`${tag}-contact`);
  contact[tag]=Object.fromEntries(Object.keys(bContact).map(cfg=>{
    const rr=rows.filter(r=>r.cfg===cfg), old=new Set(bContact[cfg].filter(r=>r.mode).map(r=>`${r.atk}|${r.gap}`));
    const covered=r=>r.firstStrokeClash?.mode==='defend'&&r.firstStrokeClash.cover>=.5;
    return [cfg,{n:rr.length,clash:rr.filter(r=>r.firstStrokeClash).length,covered:rr.filter(covered).length,coveredOnOriginalContacts:rr.filter(r=>old.has(`${r.atk}|${r.gap}`)&&covered(r)).length,injured:rr.filter(r=>r.injured).length,nagBouts:rr.filter(r=>r.nag).length}];
  }));
}
const flow=Object.fromEntries(['base','h3b'].map(tag=>{const r=read(`${tag}-flow`),fresh=sum(r.map(x=>x.fresh)),flows=sum(r.map(x=>x.flows));return[tag,{seeds:r.length,secondsPerSeed:120,fresh,flows,contactsPerFlow:fresh/flows,rows:r}]}));
const screenBase=read('base-screen'), switching={base:sum(screenBase.map(x=>x.switches))};
for(const file of ['h3a-screen','h3b-map','h3c-screen']){const ix=new Map(read(file).map(r=>[key(r),r]));switching[file]=sum(screenBase.map(r=>ix.get(key(r)).switches));}
const instrumentationMismatches=screenBase.filter(r=>r.why!==baseIndex.get(key(r)).why).map(key);
const preparation=Object.fromEntries(['base','h3c'].map(tag=>[tag,read(`${tag}-prepare`).map(r=>({name:r.name,gap:r.gap,injured:r.injured,switches:r.switches,readFrames:r.frames.filter(x=>x.read).length,defendSeconds:r.frames.filter(x=>x.mode==='defend').length/120}))]));
const unguardedContact=read('unguarded-contact');
const bodyRiskB=Object.fromEntries(['longsword','zweihander'].map(atk=>{const rows=unguardedContact.filter(r=>r.atk===atk);return[atk,{n:rows.length,injured:rows.filter(r=>r.injured).length,injuredGaps:rows.filter(r=>r.injured).map(r=>r.gap),freshMovingBodyTouch:rows.filter(r=>r.touches.some(t=>t.fresh&&t.ph>=3&&Math.hypot(t.velocity.x,t.velocity.y,t.velocity.z)>=2.5)).length}]}));
const offlineV2=read('offline-v2').map(({details,...r})=>r);
const report={baseSha:'f21266d6bcb3c44c02e0bd365a68cda5416ad6d1',adopted:false,scope:'research only; no production files changed',definitions:{injured:'at least one non-blunt wound; not all damage',switches:'actual chronological line transitions after .6s, including idle guard lines',weights:'frequency weights from MSG-S-012; all trials including misses remain in denominator',contactV2:'actual strike() call; pair not observed for >2.5 ticks marks new episode; contact-point relative velocity from cached pre-step rigid bodies; 2.5 m/s filters moving contacts'},weights,halfA:paired(read('h3b-map')),screen:{h3a:paired(read('h3a-screen')),h3c:paired(read('h3c-screen'))},contact,bodyRiskB,offlineV2,flow,switching,instrumentationMismatches,preparation,gates:read('gates/on-gates')};
writeFileSync(`${dir}/report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({A:report.halfA.map(({cfg,baseInjured,candidateInjured,weightedDelta})=>({cfg,baseInjured,candidateInjured,weightedDelta})),flow,switching,instrumentationMismatches},null,2));
