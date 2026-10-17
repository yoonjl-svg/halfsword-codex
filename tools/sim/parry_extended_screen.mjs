import {trial, CONFIGS} from './parry_reading_trials.mjs';
import {ExtendedGuard} from './parry_extended_guard.mjs';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
const key=r=>[r.cfg,r.atk,r.name,r.gap].join('|');
const bases=[];
for(const atk of ['longsword','rapier','zweihander']){
 const j=JSON.parse(gunzipSync(readFileSync(`docs/research/parry_reading_20261017/base-map-${atk}.json.gz`)));
 for(const [cfg,a]of Object.entries(j.configs))for(const [name,rows]of Object.entries(a))rows.forEach((r,i)=>bases.push({cfg,atk,name,gap:j.gaps[i],injured:['wind','cut','pushed'].includes(r.why)}));
}
const b=new Map(bases.map(r=>[key(r),r]));
const names='zornhau,zornhauL,unterhau,unterhauL,oberhau,stichPflug,위→다리,찌르기→베기'.split(',');
const cases=[];
for(const cfg of CONFIGS)for(const name of names)for(const gap of [1.2,1.6])cases.push({cfg,name,gap,atk:'longsword'});
cases.push({cfg:'uchigatana',name:'oberhau',gap:1.6,atk:'rapier'},{cfg:'uchigatana',name:'oberhau',gap:1.8,atk:'rapier'},{cfg:'uchigatana',name:'위→다리',gap:1.4,atk:'longsword'},{cfg:'qinggang',name:'oberhau',gap:1.4,atk:'longsword'});
mkdirSync('/workspace/parry-extended-20261017',{recursive:true});
for(const kind of (process.env.KINDS??'central,rise,hybrid,danger').split(',')){
 process.env.READ_KIND=kind;
 const rows=cases.map(c=>{const r=trial({...c,Guard:ExtendedGuard});return{...c,injured:r.injured,why:r.why,switches:r.switches,nag:r.nag,clash:r.firstStrokeClash,wounds:r.wounds,transitions:r.transitions};});
 const newHits=rows.filter(r=>r.injured&&!b.get(key(r)).injured).map(key),saved=rows.filter(r=>!r.injured&&b.get(key(r)).injured).map(key);
 writeFileSync(`/workspace/parry-extended-20261017/screen-${kind}.json`,JSON.stringify({kind,rows,newHits,saved},null,1));
 console.log(JSON.stringify({kind,n:rows.length,newHits,saved}));
}
