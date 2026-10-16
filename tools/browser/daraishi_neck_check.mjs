// Sample the previously open collar during actual combat; remove the new
// cosmetic layer from the same rays as a control. No physics is repositioned.
import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base=process.argv[2]||'http://127.0.0.1:4194',out=process.argv[3]||'/tmp/daraishi-neck-check.json';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const report={errors:[],poses:[]};
try{
 const page=await browser.newPage({viewport:{width:720,height:960}});
 page.on('pageerror',e=>report.errors.push(String(e)));
 await page.clock.install({time:new Date('2026-10-16T18:00:00Z')});await page.clock.pauseAt(new Date('2026-10-16T18:00:01Z'));
 await page.goto(base+'/?stage=dayr_night&foe=silver_wanderer&weapon=longsword&foeWeapon=monohoshizao&emo=0',{waitUntil:'networkidle'});
 await page.evaluate(()=>{game.renderCap.tick=()=>false;document.getElementById('btnStart').click()});
 for(let i=0;i<120&&await page.evaluate(()=>game.state!=='fight');i++)await page.clock.runFor(16);
 for(let i=0;i<24;i++){
  await page.clock.runFor(200);
  report.poses.push(await page.evaluate(()=>{
   const T=game.THREE,g=game.enemy.groups.chest,layer=g.getObjectByName('silver-wanderer-neck'),meshes=[],closure=[];
   for(const group of Object.values(game.enemy.groups)){group.updateWorldMatrix(true,true);group.traverse(o=>{if(o.isMesh)meshes.push(o)})}
   layer.traverse(o=>{if(o.isMesh)closure.push(o)});
   const rows=[];
   for(const y of [.15,.18,.20])for(const z of [-.02,0,.02]){
    const from=g.localToWorld(new T.Vector3(.8,y,z)),to=g.localToWorld(new T.Vector3(0,y,z));
    const ray=new T.Raycaster(from,to.clone().sub(from).normalize(),0,1.2),hit=ray.intersectObjects(meshes,false)[0],without=ray.intersectObjects(meshes.filter(m=>!closure.includes(m)),false)[0];
    rows.push({y,z,closed:closure.includes(hit?.object),frontX:hit?g.worldToLocal(hit.point.clone()).x:null,controlExposed:!without||without.distance>(hit?.distance||0)+.025});
   }
   return {state:game.state,rows};
  }));
 }
 const samples=report.poses.flatMap(p=>p.rows);report.samples=samples.length;report.closed=samples.filter(p=>p.closed).length;report.controlExposed=samples.filter(p=>p.controlExposed).length;
 report.covered=samples.filter(p=>p.frontX!==null&&p.frontX>-.01).length;
 assert.equal(report.covered,report.samples,'all central collar rays hit the front surface, not rear hair; moving face/arms may also occlude neck');
 assert.ok(report.controlExposed>0,'same rays reveal old gap when added closure is excluded');
 assert.deepEqual(report.errors,[]);report.pass=true;
}finally{await browser.close();fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n')}
console.log(JSON.stringify({pass:report.pass,samples:report.samples,closed:report.closed,controlExposed:report.controlExposed}));
