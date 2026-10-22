import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs';
const out=new URL('./',import.meta.url).pathname,base=process.env.PUBLIC_WANDER_BASE||'http://127.0.0.1:5213/encounters/wander-20261023/';
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const c=await b.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true}),p=await c.newPage(),errors=[],rows=[];p.on('pageerror',e=>errors.push(e.message));
await p.clock.install();await p.clock.pauseAt(new Date());
const tick=(ms=500)=>p.clock.runFor(ms);const click=async id=>{await p.locator('#'+id).evaluate(el=>el.click());await tick()};
await p.goto(base);await p.evaluate(()=>{localStorage.setItem('stillness.lobby.progress.v1',JSON.stringify({version:1,coins:987654,heads:77}));localStorage.setItem('stillness.journey.checkpoint.v1','ordinary-untouched');});
for(const width of[320,390,844,1200]){await p.setViewportSize({width,height:width<500?844:800});await tick();const ok=await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);assert(ok);rows.push({width,noOverflow:ok});}
await p.setViewportSize({width:844,height:390});
for(const [foe,name,bonus]of[['artoria','아르토리아',200],['sebastian','세바스티앙',200],['white_scale','백린의 전사',5]]){
 await p.goto(base+'game/?opponent='+foe);await p.waitForFunction(()=>window.game?.state);await p.waitForSelector('#lobbyWander');await tick();
 await p.evaluate(()=>{game.renderCap.tick=()=>false;Element.prototype.requestFullscreen=async()=>{}});
 assert(!await p.locator('#lobbyWander').isDisabled());await click('lobbyWander');assert.equal(await p.evaluate(()=>game.state),'draw');
 const getRun=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('stillness.lobby.progress.v1')).wander.run);
 const cards=(await getRun()).cards;assert.equal(cards.length,2);
 await p.locator('.wcard').first().evaluate(el=>el.click());await tick(3300);assert.equal(await p.evaluate(()=>game.state),'fight');
 assert.equal(await p.evaluate(()=>game.enemy.name),name);
 await p.evaluate(()=>game.ai.update=()=>{});
 const picked=(await getRun()).weapon;assert(picked);await click('btnPause');await click('btnLobby');await p.waitForSelector('#lobbyWander');await tick();
 await click('lobbyWander');assert.equal(await p.evaluate(()=>game.state),'fight');assert.equal((await getRun()).weapon,picked);
 const before=await p.evaluate(()=>JSON.parse(localStorage.getItem('stillness.lobby.progress.v1')));
 await p.evaluate(()=>{game.enemy.state='dead';game.enemy.causeOfDeath='출혈'});await tick(4000);
 const after=await p.evaluate(()=>JSON.parse(localStorage.getItem('stillness.lobby.progress.v1')));
 assert.equal(after.wander.run.status,'won');assert.equal(after.wander.run.reward.bonus[foe==='white_scale'?'heads':'coins'],bonus);
 if(foe==='white_scale'){assert.equal(after.heads-before.heads,5);await p.evaluate(()=>game.renderCap.tick=()=>true);await tick(16);await p.screenshot({path:out+'mongol-reward.png'});}
 rows.push({foe,cardResume:true,reward:after.wander.run.reward});
 await p.goto(base);
 assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('stillness.lobby.progress.v1')).coins),987654);
 assert.equal(await p.evaluate(()=>localStorage.getItem('stillness.journey.checkpoint.v1')),'ordinary-untouched');
}
assert.equal(errors.length,0);fs.writeFileSync(out+'public-browser-checks.json',JSON.stringify({rows,errors,previewIsolated:true},null,2));await b.close();console.log('PASS built review: 3 boss links, cards, resume, rewards, separate real saves, 4 page widths');
