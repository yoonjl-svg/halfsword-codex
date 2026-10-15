import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.argv[2]||'http://127.0.0.1:4173',out=process.argv[3]||'/tmp/lobby-records';
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const context=await browser.newContext({viewport:{width:844,height:390},reducedMotion:'reduce'});
const p=await context.newPage(),errors=[],checks=[];
p.on('pageerror',e=>errors.push(String(e)));
const record=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('stillness.fork.profile.v1')));
const open=async()=>{await p.goto(base+'/',{waitUntil:'networkidle'});await p.waitForFunction(()=>window.game?.player);await p.locator('#confirmNotices').click();};
try{
 await open();
 await p.evaluate(()=>{
  localStorage.setItem('stillness.fork.journey.v1',JSON.stringify({version:1,stage:'poseidon',foe:'heinrich',foeWeapon:'excalibur_replica',weapon:'longsword'}));
  localStorage.setItem('stillness.fork.profile.v1',JSON.stringify({version:1,name:'검객',wins:2,losses:1}));
 });
 await p.locator('#continueJourney').click();assert.equal(await p.locator('#duelRecord').textContent(),'2승리 1패배 (67%)');
 const rect=await p.locator('#lobbyDepart').boundingBox();assert.ok(rect.y>=0&&rect.y+rect.height<=390);
 await p.locator('#characterView').focus();await p.keyboard.press('ArrowRight');
 assert.equal(Number(await p.locator('#characterView').getAttribute('data-angle')),23);
 await p.keyboard.press('Home');assert.equal(Number(await p.locator('#characterView').getAttribute('data-angle')),0);
 await p.locator('#editName').click();await p.locator('#playerNameInput').fill('   ');await p.locator('#nameForm button[type=submit]').click();assert.match(await p.locator('#nameError').textContent(),/입력/);
 await p.locator('#playerNameInput').fill('<b>검객</b>');await p.locator('#nameForm button[type=submit]').click();
 assert.equal(await p.locator('#lobbyName').textContent(),'<b>검객</b>');assert.equal(await p.locator('#lobbyName b').count(),0);
 checks.push('rounding, departure visibility, keyboard rotation, empty-name rejection and literal name rendering');
 await p.locator('#lobbyDepart').click();await p.waitForFunction(()=>game.state==='fight');
 // 전적 저장 경계만 강제로 검사한다. 아래 사진은 전투 승패의 실측 자료가 아니다.
 await p.evaluate(()=>game.player.die('기절',true));await p.waitForFunction(()=>JSON.parse(localStorage.getItem('stillness.fork.profile.v1')).losses===2);
 const before=await record();await p.waitForTimeout(1000);assert.deepEqual(await record(),before);
 await open();await p.locator('#continueJourney').click();assert.equal(await p.locator('#duelRecord').textContent(),'2승리 2패배 (50%)');
 assert.deepEqual(await record(),before);checks.push('defeat recorded once, persists through reload and updates lobby percentage');
 await p.goto(base+'/?test=1&weapon=longsword&foe=heinrich&stage=castle',{waitUntil:'networkidle'});await p.waitForFunction(()=>window.game?.player);
 await p.locator('#btnStart').click();await p.waitForFunction(()=>game.state==='fight');await p.evaluate(()=>game.player.die('기절',true));
 await p.waitForTimeout(800);assert.deepEqual(await record(),before);checks.push('direct test defeat does not change normal-journey records');
 assert.deepEqual(errors,[]);
}finally{fs.writeFileSync(`${out}/records.json`,JSON.stringify({checks,errors},null,2));await browser.close();}
console.log(`PASS ${checks.length} profile/record boundary checks; errors ${errors.length}`);
