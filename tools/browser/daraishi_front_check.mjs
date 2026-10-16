import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.argv[2]||'http://127.0.0.1:4194',out=process.argv[3]||'/tmp/daraishi-front-check.json';
const before=process.argv.includes('--before'),report={errors:[],characters:{}};
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
try{
 for(const id of ['silver_wanderer','silver_wanderer_mad']){
  const p=await browser.newPage({viewport:{width:960,height:540}});p.on('pageerror',e=>report.errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
  await p.clock.install({time:new Date('2026-10-16T18:00:00Z')});await p.clock.pauseAt(new Date('2026-10-16T18:00:01Z'));
  await p.goto(`${base}/?stage=dayr_night&foe=${id}&foeWeapon=monohoshizao&weapon=longsword&emo=0`,{waitUntil:'networkidle'});
  await p.evaluate(()=>{game.renderCap.tick=()=>false;document.getElementById('btnStart').click()});
  for(let i=0;i<120&&await p.evaluate(()=>game.state!=='fight');i++)await p.clock.runFor(16);
  assert.equal(await p.evaluate(()=>game.state),'fight');
  report.characters[id]=await p.evaluate(async()=>{
   async function hash(data){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(data))))].map(x=>x.toString(16).padStart(2,'0')).join('')}
   const groups={};let tris=0;const details=[];
   for(const [key,g] of Object.entries(game.enemy.groups)){
    const rows=[];g.traverse(o=>{
     if(o.userData.frontStudy)details.push({name:o.name,...o.userData});
     if(!o.geometry)return;const m=o.material;o.updateMatrix();
     const count=o.geometry.index?.count||o.geometry.attributes.position.count;tris+=count/3;
     rows.push({name:o.name,matrix:o.matrix.toArray(),visible:o.visible,attributes:Object.fromEntries(Object.entries(o.geometry.attributes).map(([k,v])=>[k,[...v.array]])),index:o.geometry.index?[...o.geometry.index.array]:null,material:{color:m.color?.getHex(),opacity:m.opacity,roughness:m.roughness,metalness:m.metalness,side:m.side}});
    });groups[key]=await hash(rows);
   }
   return {groups,triangles:tris,details,strength:game.enemy.strength,weapon:game.enemy.weapon.id,colliders:game.world.colliders.len(),masses:Object.fromEntries(Object.entries(game.enemy.bodies).map(([k,b])=>[k,b.mass()]))};
  });
  if(!before){
   await p.clock.runFor(7000);await p.evaluate(()=>{game.renderCap.tick=()=>true});await p.clock.runFor(16);
   const live=await p.evaluate(()=>({state:game.state,finite:Object.values(game.enemy.groups).every(g=>g.matrixWorld.elements.every(Number.isFinite)),pos:game.enemy.bodies.pelvis.translation()}));assert.ok(live.finite&&Object.values(live.pos).every(Number.isFinite));report.characters[id].live=live;
  }
  await p.close();
 }
 if(!before){
  const prior=JSON.parse(fs.readFileSync(process.env.BEFORE_GEOMETRY||'/tmp/daraishi-front-before-geometry.json'));
  const baseId='silver_wanderer',alterId='silver_wanderer_mad';
  assert.deepEqual(report.characters[alterId].groups,prior.characters[alterId].groups,'alter geometry/materials unchanged');
  for(const [part,hash] of Object.entries(prior.characters[baseId].groups))if(!['chest','abdomen','head'].includes(part))assert.equal(report.characters[baseId].groups[part],hash,part);
  for(const id of [baseId,alterId])for(const k of ['strength','weapon','colliders','masses'])assert.deepEqual(report.characters[id][k],prior.characters[id][k]);
  assert.equal(report.characters[alterId].details.length,0);
  assert.equal(report.characters[baseId].details.filter(x=>x.locks===1).length,1);assert.equal(report.characters[baseId].details.filter(x=>x.closures===3).length,1);
  report.preservation={alter:true,baseExceptHeadChestAbdomen:true,physical:true};
 }
 assert.deepEqual(report.errors,[]);report.pass=true;fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:true,before,triangles:Object.fromEntries(Object.entries(report.characters).map(([k,v])=>[k,v.triangles])),preservation:report.preservation}));
}finally{await browser.close()}
