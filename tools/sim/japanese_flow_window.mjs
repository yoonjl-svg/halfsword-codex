// First four flow-bearing independent cases in fixed recorded order. Paired
// on/off controls share the entire simulated history until the first flow.
import {live} from './japanese_flow_live.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
const dir=process.env.FLOW_OUT??'/workspace/japanese-flow-20261017';
const cases=JSON.parse(readFileSync(`${dir}/independent-base.json`)).filter(r=>r.policy!=='slash'&&r.flows.length).slice(0,4);
const rows=[];
for(const row of cases){
 const t0=row.flows[0].t,variants=[];
 for(const kind of ['base','off','free-cut']){
  const prefix=[],track=[];let start=null,front=null;
  const result=live({kind,seed:row.seed,atk:row.atk,policy:row.policy,seconds:t0+1.2,onFrame(G,g){
   const D=G.player,A=G.enemy,c=A.bodies.chest.translation(),dc=D.bodies.chest.translation(),tip=A.bladePoint(1,new THREE.Vector3()),f=new THREE.Vector3(dc.x-c.x,0,dc.z-c.z).normalize(),p=tip.clone().sub(c);
   if(G.t<=t0+1e-8)prefix.push([G.t,...tip.toArray(),D.stamina.value,A.stamina.value,D.blood,A.blood,g.line]);
   else {const inFront=p.dot(f)>.35&&Math.abs(-p.x*f.z+p.z*f.x)<.45&&p.y>-.6&&p.y<.7;
    if(inFront){start??=G.t;if(front==null&&G.t-start>=.1)front=start-t0;}else start=null;
    track.push({t:G.t,tip:tip.toArray(),inFront});}
  }});
  const damage=(which)=>{const h=result[which];return {death:h.death,hits:h.applied.filter(x=>x.t>=t0),end:h.end};};
  variants.push({kind,t0,prefix:createHash('sha256').update(JSON.stringify(prefix)).digest('hex'),front,track,commands:result.commands.filter(c=>c.t>=t0),health:damage('health'),enemy:damage('enemy')});
 }
 const paired=variants.every(v=>v.prefix===variants[0].prefix);rows.push({seed:row.seed,atk:row.atk,policy:row.policy,paired,variants});
 console.log(JSON.stringify({seed:row.seed,atk:row.atk,policy:row.policy,paired,front:variants.map(v=>({kind:v.kind,front:v.front,commands:v.commands,enemyHits:v.enemy.hits.length,playerHits:v.health.hits.length}))}));
}
writeFileSync(`${dir}/first-flow-window.json`,JSON.stringify(rows));
if(rows.some(r=>!r.paired))process.exitCode=1;
