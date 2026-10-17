import {runCase,save} from './chinese_path_trials.mjs';
const rows=[];
for(const name of ['unterhau','oberhau','위→다리'])for(const gap of [1.2,1.6])for(const off of [[.95,1.1],[1.1,1.2]]){
 const r=runCase({cfg:'qinggang',atk:'longsword',name,gap,press:.75,releaseAt:off[0],repressAt:off[1]},'low-preview',true);
 const illegal=r.measures.filter(m=>m.t>off[0]+1/120&&m.t<off[1]&&(m.line!==null||m.path!==null));
 if(illegal.length)throw Error('Release retained a path/guard line');
 rows.push({...r,frames:undefined,measures:undefined,illegal:0,check:'release'});
}
for(const cfg of ['qinggang:basic','uchigatana'])for(const name of ['unterhau','oberhau']){
 const opts={cfg,atk:'longsword',name,gap:1.5,press:.85};const b=runCase(opts,'base'),r=runCase(opts,'low-preview',true);
 for(const field of ['wounds','clashes','transitions','stamina','blood','alive'])if(JSON.stringify(b[field])!==JSON.stringify(r[field]))throw Error(`Out-of-scope diff ${cfg} ${field}`);
 if(r.measures.some(m=>m.path?.line))throw Error('Out-of-scope activation');
 rows.push({...r,frames:undefined,measures:undefined,check:'scope',matches:true});
}
for(const name of ['unterhau','oberhau']){
 const r=runCase({cfg:'qinggang',atk:'longsword',name,gap:3.8,press:.75},'low-preview',true);
 if(r.measures.some(m=>m.path?.line))throw Error('Out-of-range activation');
 rows.push({...r,frames:undefined,measures:undefined,check:'range',activations:0});
}
save('edges',rows);console.log(JSON.stringify({n:rows.length,release:'PASS',scope:'4 pairs exact',range:'PASS'}));
