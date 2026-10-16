import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {CHARACTERS_BY_ID as chars,aiAtProficiency} from '../../src/characters.js';
const base=process.argv[2]||'http://127.0.0.1:4194',out=process.argv[3]||'/tmp/bron-ratna-check.json';
assert.equal(chars.bran.name,'브론 오소리');
assert.equal(chars.bran_mad.name,'광기의 브론 오소리');
for(const id of ['bran','ratna']){
 const a=chars[id],b=chars[id+'_mad'];assert.equal(b.appearanceOnly,true);assert.deepEqual(a.ai,b.ai);
 for(let p=1;p<=5;p++)assert.deepEqual(aiAtProficiency(a,p),aiAtProficiency(b,p));
}
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']}),errors=[],report={};
try{
 const p=await b.newPage();p.on('pageerror',e=>errors.push(String(e)));
 await p.clock.install({time:new Date('2026-10-16T18:00:00Z')});await p.clock.pauseAt(new Date('2026-10-16T18:00:01Z'));
 await p.goto(base+'/?stage=clearing_night&foe=bran_mad&weapon=longsword&emo=0',{waitUntil:'networkidle'});
 await p.evaluate(()=>document.getElementById('btnStart').click());
 for(let i=0;i<120&&await p.evaluate(()=>game.state!=='fight');i++)await p.clock.runFor(16);
 report.hat=await p.evaluate(()=>{
  const describe=h=>({position:h.position.toArray(),quaternion:h.quaternion.toArray(),scale:h.scale.toArray(),parts:h.children.map(m=>({geometry:m.geometry.parameters,position:m.position.toArray(),quaternion:m.quaternion.toArray(),scale:m.scale.toArray(),color:m.material.color.getHex(),metalness:m.material.metalness,roughness:m.material.roughness,side:m.material.side}))});
  return {player:describe(game.player.helmetGroup),bron:describe(game.enemy.groups.head.getObjectByName('alter-player-kettle-hat')),armor:game.enemy.hasHelmet,helmetType:game.enemy.helmetType};
 });
 assert.deepEqual(report.hat.bron,report.hat.player);assert.equal(report.hat.armor,false);assert.equal(report.hat.helmetType,null);
 await p.close();
 const q=await b.newPage();q.on('pageerror',e=>errors.push(String(e)));
 await q.goto('http://127.0.0.1:4193/night-encounters-4.html');
 report.eyes=await q.evaluate(async()=>{
  const T=await import('/node_modules/.vite/deps/three.js'),{attachMadEyes}=await import('/src/mad_eyes.js');
  return [false,true].map(sheltered=>{
   const head=new T.Group(),scene=new T.Scene();scene.add(head);const f={groups:{head},scene,state:'fight'},fx=attachMadEyes(f,true,{sheltered});
   fx.update(0);head.position.x=.03;fx.update(.016);
   const trails=scene.children.filter(x=>x.isSprite&&x.visible),origin=sheltered?1:0;
   const moving={count:trails.length,maxDistance:Math.max(...trails.map((s,i)=>s.position.distanceTo(head.children[(i<6?0:2)+origin].getWorldPosition(new T.Vector3())))),maxOpacity:Math.max(...trails.map(s=>s.material.opacity))};
   const depthTest=head.children.every(s=>s.material.depthTest)&&trails.every(s=>s.material.depthTest);
   fx.update(.032);const stopped=scene.children.filter(s=>s.isSprite&&s.visible).length;
   f.state='dead';fx.update(.05);fx.update(3);const faded=head.children.every(s=>s.material.opacity===0);
   fx.dispose();return {sheltered,moving,depthTest,stopped,faded,disposed:head.children.length===0&&scene.children.length===1};
  });
 });
 for(const r of report.eyes){assert.equal(r.moving.count,12);assert.ok(r.moving.maxDistance<=.22001);assert.equal(r.depthTest,true);assert.equal(r.stopped,0);assert.equal(r.faded,true);assert.equal(r.disposed,true)}
 assert.ok(report.eyes[1].moving.maxOpacity<report.eyes[0].moving.maxOpacity);
 assert.deepEqual(errors,[]);report.pass=true;report.errors=errors;report.aiPairs=2;report.proficiencyComparisons=10;
 fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:true,hatIdentical:true,armorAdded:false,eyes:report.eyes,aiPairs:2,errors}));
}finally{await b.close()}
