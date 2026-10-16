// Compare small scabbard translations on the same actual animated garment poses.
// Five parallel probes approximate a 22 mm envelope; this is a sampled crossing
// check, not a proof against every triangle contact or every possible pose.
import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as T from 'three';
import {placeDaraishiScabbard} from '../../src/outfit_silver_wanderer.js';
import {getLook} from '../../src/looks.js';
const base=process.argv[2]||'http://127.0.0.1:4194',out=process.argv[3]||'/tmp/daraishi-scabbard-clearance.json';
const bake=(geo,pos,rot)=>{if(rot)geo.applyMatrix4(new T.Matrix4().makeRotationFromEuler(new T.Euler(...rot)));if(pos)geo.translate(...pos);return geo};
const candidates=[0,.004,.008,.08].map(inset=>{
 const probes=[];
 for(const [x,z] of [[0,0],[.022,0],[-.022,0],[0,.022],[0,-.022]]){
  const geo=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute([x,.33,z,x,-.61,z],3));
  placeDaraishiScabbard(T,bake,geo,{...getLook('silver_wanderer','v7-front2'),daraishiScabbardInset:inset});probes.push([...geo.attributes.position.array]);
 }
 return {inset,probes};
});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const report={method:'centerline and four parallel 22 mm probes through actual leg clothing; same poses for every candidate',errors:[],poses:[]};
try{
 const p=await browser.newPage({viewport:{width:960,height:540}});p.on('pageerror',e=>report.errors.push(String(e)));
 await p.clock.install({time:new Date('2026-10-16T18:00:00Z')});await p.clock.pauseAt(new Date('2026-10-16T18:00:01Z'));
 await p.goto(`${base}/?stage=dayr_night&foe=silver_wanderer&foeWeapon=monohoshizao&weapon=longsword&emo=0`,{waitUntil:'networkidle'});
 await p.evaluate(()=>{game.renderCap.tick=()=>false;document.getElementById('btnStart').click()});
 for(let i=0;i<120&&await p.evaluate(()=>game.state!=='fight');i++)await p.clock.runFor(16);
 assert.equal(await p.evaluate(()=>game.state),'fight');
 for(let i=0;i<60;i++){
  if(i)await p.clock.runFor(200);
  report.poses.push(await p.evaluate(candidates=>{
   const g=game,T=g.THREE;g.scene.updateMatrixWorld(true);const targets=[];
   for(const part of ['pelvis','thighF','shinF','thighB','shinB'])g.enemy.groups[part].traverse(o=>{
    if(!o.isMesh||!o.visible)return;
    if(part==='pelvis'&&o!==g.enemy.groups.pelvis.children[0]&&o.material?.color?.getHex()!==0x5a4c68)return;
    targets.push(o);
   });
   const matrix=g.enemy.groups.pelvis.children[0].matrixWorld;
   const tests=candidates.map(({inset,probes})=>({inset,hits:probes.map(v=>{
    const a=new T.Vector3(...v.slice(0,3)).applyMatrix4(matrix),b=new T.Vector3(...v.slice(3)).applyMatrix4(matrix),dir=b.clone().sub(a),len=dir.length();
    const ray=new T.Raycaster(a,dir.normalize(),0,len);return ray.intersectObjects(targets,false).length>0;
   })}));
   return {targets:targets.length,state:g.state,position:g.enemy.bodies.pelvis.translation(),tests};
  },candidates));
 }
 report.candidates=candidates.map(({inset},k)=>({inset,centerCrossings:report.poses.filter(p=>p.tests[k].hits[0]).length,envelopeCrossings:report.poses.filter(p=>p.tests[k].hits.some(Boolean)).length,newCenterCrossings:report.poses.filter(p=>p.tests[k].hits[0]&&!p.tests[0].hits[0]).length,newEnvelopeCrossings:report.poses.filter(p=>p.tests[k].hits.some(Boolean)&&!p.tests[0].hits.some(Boolean)).length}));
 assert.deepEqual(report.errors,[]);assert.ok(report.poses.every(p=>p.targets>0));report.controlDetected=report.candidates.at(-1).envelopeCrossings>0;assert.ok(report.controlDetected,'large inset control must detect crossings');report.selected=.008;report.noNewSampledCrossings=report.candidates[2].newCenterCrossings===0&&report.candidates[2].newEnvelopeCrossings===0;assert.ok(report.noNewSampledCrossings);report.samples=report.poses.length;fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({samples:report.samples,candidates:report.candidates,states:[...new Set(report.poses.map(p=>p.state))]}));
}finally{await browser.close()}
