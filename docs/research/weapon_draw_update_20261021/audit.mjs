// Exact finite enumeration of the live two-card sampler; no Monte Carlo estimates.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const root=resolve(process.argv[2]);
const W=await import(pathToFileURL(resolve(root,'src/weapons.js')));
const S=await import(pathToFileURL(resolve(root,'src/schools.js')));
const main=readFileSync(resolve(root,'src/main.js'),'utf8');
assert.match(main,/const PLAYER_WEAPON_POOL = WEAPON_LIST\.map\(\(w\) => w\.id\)\.filter\(\(id\) => id !== 'excalibur_replica' && !RETIRED_WEAPONS\.has\(id\)\)/);
const pool=W.WEAPON_LIST.map(w=>w.id).filter(id=>id!=='excalibur_replica'&&!W.RETIRED_WEAPONS.has(id));
const group=id=>id==null?null:W.getWeapon(id).drawGroup||id;
const school=id=>S.traditionOf(W.getWeapon(id));
const active=pool.filter(id=>!W.getWeapon(id).characterOnly);
function choices(left){
  const tiers=new Map();
  for(const id of left){const t=W.getWeapon(id).tier;if(!tiers.has(t))tiers.set(t,new Map());const slots=tiers.get(t),g=group(id);if(!slots.has(g))slots.set(g,[]);slots.get(g).push(id);}
  const total=[...tiers.keys()].reduce((s,t)=>s+(W.TIER_DRAW[t]||0),0);
  const out=[];let previous=0;
  for(const [tier,slots] of tiers){
    const weight=W.TIER_DRAW[tier]||0;if(!weight)continue;
    const tierRnd=(previous+weight/2)/total;previous+=weight;let j=0;
    for(const [g,members] of slots){
      const slotRnd=(j+++.5)/slots.size;
      members.forEach((id,k)=>out.push({id,g,p:weight/total/slots.size/members.length,random:[tierRnd,slotRnd,...(members.length>1?[(k+.5)/members.length]:[])]}));
    }
  }
  return out;
}
function analyze(exclude=null){
  let left=active.filter(id=>group(id)!==group(exclude));
  if(new Set(left.map(group)).size<2)left=[...active];
  const first={},second={},any={},schools={},pairs=[];let sum=0;
  for(const a of choices(left)){
    first[a.id]=(first[a.id]||0)+a.p;
    for(const b of choices(left.filter(id=>group(id)!==a.g))){
      const p=a.p*b.p,random=[...a.random,...b.random];let n=0;
      assert.deepEqual(W.drawWeaponCards(pool,2,{exclude,rnd:()=>{assert(n<random.length);return random[n++];}}),[a.id,b.id]);
      assert.equal(n,random.length);
      sum+=p;second[b.id]=(second[b.id]||0)+p;
      for(const id of [a.id,b.id])any[id]=(any[id]||0)+p;
      for(const id of new Set([school(a.id),school(b.id)]))schools[id]=(schools[id]||0)+p;
      pairs.push({a:a.id,b:b.id,p});
    }
  }
  assert(Math.abs(sum-1)<1e-12);
  const bySchool=Object.keys(S.TRADITIONS).map(id=>({id,name:S.TRADITIONS[id].nameKo,count:active.filter(w=>school(w)===id).length,
    first:active.filter(w=>school(w)===id).reduce((n,w)=>n+(first[w]||0),0),any:schools[id]||0}));
  return {exclude,first,second,any,schools:bySchool,pairs,total:sum};
}
const weapons=W.WEAPON_LIST.map(w=>({id:w.id,name:w.nameKo,tier:w.tier,school:school(w.id),group:group(w.id),characterOnly:!!w.characterOnly,retired:W.RETIRED_WEAPONS.has(w.id),active:active.includes(w.id)}));
const scenarios=[null,...active].map(exclude=>analyze(exclude));
const result={source:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),tiers:W.TIER_DRAW,weapons,scenarios,verifiedOrderedPaths:scenarios.reduce((n,s)=>n+s.pairs.length,0)};
for (const s of result.scenarios) { s.verifiedOrderedPaths=s.pairs.length; delete s.pairs; }
writeFileSync(process.argv[3],JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({source:result.source,registered:weapons.length,active:active.length,schools:scenarios[0].schools,verifiedOrderedPaths:result.verifiedOrderedPaths}));
