// 정식 본판 생사전 통합 검사: 시험 모드 없이 신청·입장 조건·2:2·이어받기·결과 저장·휴식.
// 고립된 새 브라우저 문맥에 자격/무기 저장과 시계를 주입한다. 승패 저장 검사는 상대 사망을 주입하므로 밸런스 측정이 아니다.
// node tools/browser/saengsa_production_flow.mjs <빌드/개발 서버 주소> <결과 폴더> (playwright 별도 설치)
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SAENGSA} from '../../src/config.js';
import {titleName} from '../../src/title_rules.js';
const base=(process.argv[2]||'http://127.0.0.1:5173').replace(/\/$/,'');
const out=process.argv[3]||'dist/saengsa-production-check';fs.mkdirSync(out,{recursive:true});
const fixture={entry:SAENGSA.entry,title:titleName(SAENGSA.entry.title),weapons:SAENGSA.testWeapons};
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const errors=[],checks=[];
async function make(qualified){
 const ctx=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,timezoneId:'Asia/Seoul'});
 const p=await ctx.newPage();p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await p.clock.install({time:new Date('2026-11-01T00:10:00+09:00')});
 if(qualified)await p.addInitScript(f=>{
  if(localStorage.getItem('stillness.lobby.progress.v1'))return;
  localStorage.setItem('stillness.lobby.progress.v1',JSON.stringify({version:1,coins:10000,heads:5,horns:2,acquisitions:f.weapons.map(id=>({receipt:'weapon:'+id,kind:'item'})),titles:[{event:f.entry.title,name:f.title,seen:true}],title:f.title}));
 },fixture);
 await p.goto(base+'/?nosw=1',{waitUntil:'domcontentloaded'});
 const until=async(fn,limit=600)=>{for(let i=0;i<limit;i++){if(await p.evaluate(fn))return;await p.clock.runFor(100);}throw new Error('condition timed out '+fn);};
 const tap=async sel=>{await p.locator(sel).first().tap();await p.clock.runFor(100);};
 await until(()=>!!document.querySelector('#gameEntrance')?.shadowRoot?.querySelector('#confirmNotices'));
 await tap('#confirmNotices');await tap('#enterLobby');
 await until(()=>!!document.querySelector('#gameEntrance')?.shadowRoot?.querySelector('#tabEvent'));
 for(const close of ['closeTree','closeTitle'])if(await p.locator('#'+close).isVisible())await tap('#'+close);
 await tap('#tabEvent');
 return {ctx,p,tap,until};
}
try{
 let x=await make(false);
 assert.ok(await x.p.locator('#saengsaEnter').isDisabled());
 await x.p.screenshot({path:out+'/entry-locked.png'});checks.push('unqualified entry remains locked');await x.ctx.close();
 x=await make(true);const {p,tap,until}=x;
 await tap('#tabShop');assert.equal(await p.locator('.shop-item').count(),3);checks.push('latest shop still shows three items');
 await tap('#tabEvent');await p.screenshot({path:out+'/lobby-saengsa.png'});
 for(const [slot,weapon] of [[0,'longsword'],[1,'rapier'],[2,'uchigatana']]){
  await tap(`.sg-slot[data-slot="${slot}"]`);if(slot)await tap('.sg-pick[data-id="nameless"]');
  await tap(`.sg-chip-btn[data-weapon="${weapon}"]`);await tap('#sgPickOk');
 }
 assert.ok(await p.locator('#saengsaEnter').isEnabled());
 const before=await p.evaluate(()=>JSON.parse(localStorage.getItem('stillness.lobby.progress.v1')).coins);
 await tap('#saengsaEnter');await until(()=>!!document.querySelector('#gameEntrance')?.shadowRoot?.querySelector('#sgBracket'));
 const after=await p.evaluate(()=>JSON.parse(localStorage.getItem('stillness.lobby.progress.v1')).coins);
 assert.equal(before-after,40);
 const t=await p.evaluate(()=>JSON.parse(localStorage.getItem('stillness.saengsa.v1')).current);
 assert.equal(t.teams.length,16);assert.equal(t.matches.length,15);assert.equal(await p.locator('.sg-m[data-state="ready"]').count(),0);
 await p.screenshot({path:out+'/bracket-waiting.png'});checks.push('signup charges two nameless hires and creates a 16-team tournament, matches wait for 10:00');
 await p.clock.fastForward(10*3600*1000);
 await until(()=>!!document.querySelector('#gameEntrance')?.shadowRoot?.querySelector('.sg-m[data-state="ready"]'));
 await p.screenshot({path:out+'/bracket-ready.png'});
 await tap('.sg-m[data-state="ready"]');await tap('button.sg-card[data-key="0-0"]');await tap('button.sg-card[data-key="0-1"]');
 await p.screenshot({path:out+'/entrants.png'});
 await p.evaluate(()=>{game.renderCap.tick=()=>false;});await tap('#sgFight');
 await until(()=>window.game?.state==='fight'&&!!window.game.teamRun);
 assert.equal(await p.evaluate(()=>game.fighters.length),4);assert.ok(await p.evaluate(()=>!!game.teamRun.human));
 const sim=await p.evaluate(()=>game.stats.simTime);await p.clock.runFor(2000);assert.ok(await p.evaluate(s=>game.stats.simTime>s,sim));
 await p.evaluate(()=>{game.renderCap.tick=()=>true;});await p.clock.runFor(80);await p.screenshot({path:out+'/fight-2v2.png'});await p.evaluate(()=>{game.renderCap.tick=()=>false;});
 await p.evaluate(()=>document.querySelector('#btnPause').click());assert.ok(await p.locator('#btnStart').isHidden());
 await p.evaluate(()=>document.querySelector('#btnLobby').click());await p.clock.runFor(200);
 const resumed=await p.evaluate(()=>JSON.parse(localStorage.getItem('stillness.saengsa.v1')).current.resume);
 assert.ok(resumed?.bodies);assert.equal(resumed.picks.length,2);assert.equal(Object.keys(resumed.bodies).length,4);
 assert.equal(await p.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('stillness.test.')).length),0);
 checks.push('production player + companion 2v2 runs, restart unavailable, four bodies and loadout saved on leaving, no test-mode save keys');
 await tap('#sgFight');await until(()=>window.game?.state==='fight'&&!!window.game.teamRun);
 const restored=await p.evaluate(()=>game.fighters.map(f=>({name:f.name,weapon:f.weapon.id,blood:f.blood})));
 assert.equal(restored.length,4);
 // Deterministic outcome injection checks result/save/cooldown wiring, not combat balance.
 await p.evaluate(()=>{const side=game.teamRun.human.team;for(const f of game.fighters)if(f.team!==side){f.canDie=true;f.setState('dead');}});
 await until(()=>{const root=document.querySelector('#gameEntrance')?.shadowRoot;return root?.querySelector('#sgDone')&&!root.querySelector('#sgDone').hidden;});
 const settled=await p.evaluate(()=>JSON.parse(localStorage.getItem('stillness.saengsa.v1')).current);
 assert.ok(settled.matches.some(m=>m.result));assert.equal(settled.resume,undefined);
 await tap('#sgDone');assert.equal(await p.locator('.sg-m[data-state="ready"]').count(),0);
 await p.screenshot({path:out+'/result-cooldown.png'});
 await p.reload({waitUntil:'domcontentloaded'});await until(()=>!!document.querySelector('#gameEntrance')?.shadowRoot?.querySelector('#enterLobby'));
 if(await p.locator('#confirmNotices').isVisible())await tap('#confirmNotices');await tap('#enterLobby');
 await until(()=>!!document.querySelector('#gameEntrance')?.shadowRoot?.querySelector('#tabEvent'));await tap('#tabEvent');await tap('#saengsaEnter');
 const persisted=await p.evaluate(()=>JSON.parse(localStorage.getItem('stillness.saengsa.v1')).current);
 assert.deepEqual(persisted.matches.filter(m=>m.result).map(m=>m.result),settled.matches.filter(m=>m.result).map(m=>m.result));
 checks.push('resume can re-enter, controlled outcome persists after reload, completed resume cleared, next round enforces two-hour rest');
 assert.deepEqual(errors,[]);
 fs.writeFileSync(out+'/result.json',JSON.stringify({passed:true,checks,errors,tournamentTeams:t.teams.length,hirePaid:before-after,resumeKeys:Object.keys(resumed.bodies)},null,2));
 console.log(JSON.stringify({passed:true,checks,errors}));
}catch(e){fs.writeFileSync(out+'/failure.json',JSON.stringify({error:String(e),checks,errors},null,2));throw e;}
finally{await browser.close();}
