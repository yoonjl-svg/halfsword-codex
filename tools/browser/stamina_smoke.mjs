// 실제 입력/물리 스텝 검사. 중간 GPU 그리기만 생략하고 촬영할 때 실제 게임을 그린다.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.argv[2]||'http://127.0.0.1:5173';
const out=process.argv[3]||'/tmp/stamina-shots';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||'/usr/bin/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--no-sandbox']});
const errors=[],results=[];
try {
 const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true,serviceWorkers:'block'});
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('requestfailed',r=>errors.push(r.url()));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 await page.clock.install({time:new Date('2026-10-15T09:00:00Z')});await page.clock.pauseAt(new Date('2026-10-15T09:00:01Z'));
 await page.goto(`${base}/?weapon=longsword&foe=default&stage=castle&emo=0&uniqueStage=0`,{waitUntil:'networkidle'});
 await page.evaluate(()=>{game.renderCap.tick=()=>false;document.getElementById('btnStart').click();});
 const waitFight=async()=>{for(let i=0;i<60;i++){if(await page.evaluate(()=>game.state==='fight'))return;await page.clock.runFor(16);}throw Error('fight did not start');};
 await waitFight();await page.evaluate(()=>{game.ai.update=()=>{};});await page.clock.runFor(2300);
 const snap=()=>page.evaluate(()=>({state:game.state,sim:game.stats.simTime,value:game.player.stamina.value,level:game.player.stamina.level,left:game.player.stamina.exhaustLeft,pose:game.player.stamina.pose,move:game.player.move.toArray(),guard:game.playerGuard.active,spent:{...game.player.stamina.spent},counts:{...game.player.stamina.counts},messageColor:getComputedStyle(document.querySelector('#guardName small')).color,bars:[...document.querySelectorAll('.stamina-bar')].map(el=>({hidden:el.hidden,color:getComputedStyle(el.firstElementChild).backgroundColor,opacity:getComputedStyle(el).opacity,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,x:el.getBoundingClientRect().x,y:el.getBoundingClientRect().y,value:el.getAttribute('aria-valuenow'),text:el.getAttribute('aria-valuetext'),level:el.dataset.level,exhausted:el.dataset.exhausted}))}));
 const shot=async(name)=>{await page.evaluate(()=>{game.renderCap.tick=()=>true;});await page.clock.runFor(32);await page.screenshot({path:`${out}/${name}.png`});await page.evaluate(()=>{game.renderCap.tick=()=>false;});};
 const tap=async()=>page.evaluate(()=>{const canvas=document.getElementById('game');const o={pointerId:81,pointerType:'touch',clientX:620,clientY:160,bubbles:true,isPrimary:true,button:0};canvas.dispatchEvent(new PointerEvent('pointerdown',o));window.dispatchEvent(new PointerEvent('pointerup',o));});
 let s=await snap();assert.equal(s.bars.length,2);assert.ok(s.bars.every(b=>!b.hidden&&b.color===s.messageColor&&b.height===2&&b.width===56));results.push({check:'two thin muted beige meters',...s});await shot('full-landscape');
 await page.evaluate(()=>{game.player.stamina.value=40;game.player.stamina.rest=.6;});
 await page.keyboard.down('KeyD');await page.clock.runFor(1800);await page.keyboard.up('KeyD');s=await snap();assert.ok(s.spent.move>0&&s.value>40,JSON.stringify(s));results.push({check:'walking consumes distance cost and recovers',...s});
 const before=s.value,attack=s.spent.attack,block=s.spent.block;await page.keyboard.down('KeyF');await page.clock.runFor(800);s=await snap();assert.ok(Math.abs(s.value-before)<.3,JSON.stringify(s));assert.equal(s.spent.attack,attack);assert.equal(s.spent.block,block);results.push({check:'held guard stops recovery without idle cost',...s});
 await page.keyboard.up('KeyF');await page.clock.runFor(100);await tap();await page.clock.runFor(500);s=await snap();assert.ok(Math.abs(s.spent.attack-attack-7)<1e-5,JSON.stringify(s));results.push({check:'touch thrust at unlock stage zero costs seven once',...s});
 await page.clock.runFor(1000);await page.evaluate(()=>{game.player.stamina.value=-31;game.player.stamina.stages();});await page.keyboard.down('KeyF');await page.clock.runFor(200);s=await snap();assert.equal(s.level,2);assert.equal(s.bars[0].value,'0');results.push({check:'severe fatigue empty bar',...s});await shot('debt-landscape');
 await page.keyboard.up('KeyF');await page.evaluate(()=>{game.player.stamina.value=-49;game.player.stamina.rest=0;});await tap();await page.clock.runFor(32);
 await page.keyboard.down('KeyF');await page.keyboard.down('KeyW');await page.clock.runFor(650);s=await snap();assert.equal(s.level,3);assert.ok(s.left>1&&s.left<2.5);assert.deepEqual(s.move,[0,0]);assert.equal(s.guard,false);assert.match(s.bars[0].text,/탈진 회복/);results.push({check:'exhaustion rejects held movement and block',...s});await shot('exhausted-landscape');
 await page.keyboard.up('KeyW');await page.clock.runFor(1900);s=await snap();assert.equal(s.left,0);assert.equal(s.level,1);assert.ok(Math.abs(s.value)<.2,JSON.stringify(s));results.push({check:'forced recovery reaches zero despite held block',...s});
 await page.keyboard.up('KeyF');await page.clock.runFor(1200);s=await snap();assert.equal(s.level,0);assert.ok(s.value>=15);results.push({check:'normal speed returns at fifteen',...s});await shot('recovered-landscape');
 await page.locator('#btnPause').click();await page.clock.runFor(32);const paused=await snap();await page.clock.runFor(1200);s=await snap();assert.equal(s.value,paused.value);assert.ok(s.bars.every(b=>b.hidden));results.push({check:'pause freezes resource and hides bars',...s});
 await page.evaluate(()=>document.getElementById('btnStart').click());await waitFight();await page.evaluate(()=>{game.ai.update=()=>{};});await page.clock.runFor(32);s=await snap();assert.ok(s.value>99);assert.equal(s.level,0);assert.equal(s.bars.length,2);results.push({check:'restart resets resource without duplicate bars',...s});
 assert.deepEqual(errors,[]);
} finally {fs.writeFileSync(`${out}/results.json`,JSON.stringify({results,errors},null,2));await browser.close();}
console.log(`PASS ${results.length} browser checks; errors ${errors.length}`);
