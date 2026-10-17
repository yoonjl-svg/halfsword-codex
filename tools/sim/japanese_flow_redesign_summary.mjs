// Describe contact episodes, not every physics sample as an independent chance.
import {readFileSync,writeFileSync} from 'node:fs';
const root=process.env.OUT??'/workspace/japanese-flow-redesign-20261017';
const rows=JSON.parse(readFileSync(`${root}/diagnostic/poses-diagnostic.json`));
const result=rows.map(r=>{
 const samples=r.redesignedContacts.filter(c=>c.d===0&&Math.abs(c.check.time-(c.t+1/120))<1e-6);
 const episodes=new Map();for(const c of samples){const key=`${c.o}:${c.d}:${c.entry.attackId}:${c.entry.start}`;if(!episodes.has(key))episodes.set(key,[]);episodes.get(key).push(c);}
 const firstContacts=[...episodes.values()].map(v=>v[0]);const firstReasons={};for(const c of firstContacts)firstReasons[c.check.reason]=(firstReasons[c.check.reason]??0)+1;
 return {name:r.name,freshClashes:r.clashes.length,checkedSamples:samples.length,episodes:episodes.size,firstReasons,flows:r.redesignedFlows.length,firstContacts};
});
writeFileSync(`${root}/diagnostic-summary.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify(result.map(({firstContacts,...r})=>r)));
