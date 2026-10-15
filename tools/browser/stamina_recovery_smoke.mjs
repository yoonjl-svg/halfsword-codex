// 로컬 실제 게임: 같은20에서 같은2초 동안 사람21/s·AI15/s 비교·촬영.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.argv[2]||'http://127.0.0.1:4173';
const out=process.argv[3]||'/tmp/stamina-recovery';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||'/usr/bin/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--no-sandbox']});
const errors=[],results=[];
try {
 const page=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:2,hasTouch:true,isMobile:true});
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.clock.install({time:new Date('2026-10-15T22:00:00+09:00')});await page.clock.pauseAt(new Date('2026-10-15T22:00:01+09:00'));
 await page.goto(`${base}/?weapon=longsword&foe=default&stage=frozen_bay&emo=0&uniqueStage=0&tempo=1`,{waitUntil:'networkidle'});
 await page.evaluate(()=>{game.renderCap.tick=()=>false;game.config.ARENA.startGap=2;document.getElementById('btnStart').click();});
 for(let i=0;i<90&&!(await page.evaluate(()=>game.state==='fight'));i++)await page.clock.runFor(16);
 assert.equal(await page.evaluate(()=>game.state),'fight');
 await page.evaluate(()=>{game.ai.update=()=>{};});await page.clock.runFor(2600);
 await page.evaluate(()=>{
  const a=game.player.bodies.chest.translation(),b=game.enemy.bodies.chest.translation(),x=(a.x+b.x)/2,z=(a.z+b.z)/2;
  game.freeCam=true;game.camera.position.set(x,1.7,z+3.5);game.camera.lookAt(x,1.05,z);
  for(const f of [game.player,game.enemy]){f.stamina.value=20;f.stamina.rest=.6;}
  game.renderCap.tick=()=>true;
 });await page.clock.runFor(32);
 // 사진을 찍는 동안 가상 물리 시간은 멈춰 있다. 실제 휴대폰 FPS 검사는 아니다.
 const snap=()=>page.evaluate(()=>[game.player,game.enemy].map((f,i)=>({who:i?'AI':'player',ai:!!f.aiControlled,value:f.stamina.value,time:f.stamina.time,spent:{...f.stamina.spent},bar:document.querySelectorAll('.stamina-bar')[i].getAttribute('aria-valuenow')})));
 await page.evaluate(()=>{for(const f of [game.player,game.enemy])f.stamina.value=20;game.renderCap.tick=()=>false;});
 const before=await snap();await page.clock.runFor(1984);await page.evaluate(()=>{game.renderCap.tick=()=>true;});await page.clock.runFor(16);
 const after=await snap();await page.evaluate(()=>{game.renderCap.tick=()=>false;});
 for(let i=0;i<2;i++){
  const dt=after[i].time-before[i].time;assert.ok(Math.abs(dt-2)<.02,JSON.stringify({dt,before,after}));
  assert.ok(Math.abs(after[i].value-20-dt*(i?15:21))<1e-6,JSON.stringify(after));assert.deepEqual(after[i].spent,before[i].spent);
 }
 assert.equal(after[0].ai,false);assert.equal(after[1].ai,true);results.push({check:'same two seconds: human21/s and AI15/s',before,after});
 await page.screenshot({path:`${out}/after-two-seconds.png`,animations:'disabled'});
 assert.deepEqual(errors,[]);
}finally{fs.writeFileSync(`${out}/results.json`,JSON.stringify({results,errors},null,2));await browser.close();}
console.log(`PASS ${results.length} recovery browser check; errors ${errors.length}`);
