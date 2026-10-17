// 대기실 전적·이름 경계 점검 (샛별 저장소 lobby_records_smoke.mjs 를 우리 열쇠에 맞춤 — docs/import/lobby_port_2026-10-16.md §6)
//  10/17 11:2x 흐름: 첫 화면 '이어하기' → 곧바로 싸움(저장된 무기) → 정지 → 대기실('Stage 입장') — tools/browser/to_lobby.mjs
//  npm run build && npx vite preview --port 5201 →  node tools/browser/lobby_records_smoke.mjs http://127.0.0.1:5201 /tmp/<빈 폴더>
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { titleToLobby } from './to_lobby.mjs';
const base=process.argv[2]||'http://127.0.0.1:5201',out=process.argv[3]||'/tmp/lobby-records';
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||'/opt/pw-browsers/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const errors=[],checks=[];
const context=await browser.newContext({viewport:{width:844,height:390},reducedMotion:'reduce'});
await context.route('https://*.supabase.co/**',r=>{errors.push('auth server called: '+r.request().url());r.abort();});
const p=await context.newPage();
p.on('pageerror',e=>errors.push(String(e)));
const PROFILE='stillness.lobby.profile.v1',JOURNEY='stillness.journey.checkpoint.v1';
const record=()=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)),PROFILE);
const open=async()=>{await p.goto(base+'/',{waitUntil:'networkidle'});await p.waitForFunction(()=>window.game?.player,null,{timeout:60000});await p.locator('#confirmNotices').click();};
try{
 await open();
 await p.evaluate(([j,pr])=>{
  localStorage.setItem(j,JSON.stringify({version:1,stage:'poseidon',foe:'heinrich',foeWeapon:'excalibur_replica',weapon:'longsword'}));
  localStorage.setItem(pr,JSON.stringify({version:1,name:'검객',wins:2,losses:1}));
 },[JOURNEY,PROFILE]);
 assert.equal(await titleToLobby(p,'#continueJourney'),'fight'); // 무기를 골라 둔 지점 → 카드 없이 곧장 싸움 (대기실을 거치지 않음)
 assert.equal(await p.evaluate(()=>[game.stage.id,game.player.weapon.id].join()),'poseidon,longsword');assert.equal(await p.locator('#duelRecord').textContent(),'2승리 1패배 (67%)');
 assert.equal(await p.locator('#lobbyDepart').textContent(),'Stage 입장');
 const rect=await p.locator('#lobbyDepart').boundingBox();assert.ok(rect.y>=0&&rect.y+rect.height<=390);
 const rest=()=>p.waitForFunction(()=>document.querySelector('#gameEntrance').shadowRoot.getElementById('characterView').dataset.turning==='false'); // 10/16 돌림판: 방향키도 부드럽게 돈다 — 선 뒤에 읽는다
 await p.locator('#characterView').focus();await p.keyboard.press('ArrowRight');await rest();
 assert.equal(Number(await p.locator('#characterView').getAttribute('data-angle')),23);
 await p.keyboard.press('Home');await rest();assert.equal(Number(await p.locator('#characterView').getAttribute('data-angle')),0);
 await p.locator('#editName').click();await p.locator('#playerNameInput').fill('   ');await p.locator('#nameForm button[type=submit]').click();assert.match(await p.locator('#nameError').textContent(),/입력/);
 await p.locator('#playerNameInput').fill('<b>검객</b>');await p.locator('#nameForm button[type=submit]').click();
 assert.equal(await p.locator('#lobbyName').textContent(),'<b>검객</b>');assert.equal(await p.locator('#lobbyName b').count(),0);
 checks.push('이어하기 on the title goes straight to the saved fight (poseidon · longsword); pause → 대기실; rounding, departure visibility, keyboard rotation, empty-name rejection and literal name rendering');
 await p.locator('#lobbyDepart').click();await p.waitForFunction(()=>game.state==='fight',null,{timeout:60000});
 // 전적 저장 경계만 강제로 검사한다 (전투 승패의 실측 자료가 아니다).
 await p.evaluate(()=>game.player.die('기절',true));await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).losses===2,PROFILE,{timeout:20000});
 const before=await record();await p.waitForTimeout(1000);assert.deepEqual(await record(),before);
 assert.equal(await p.evaluate(k=>JSON.parse(localStorage.getItem(k)).stage,JOURNEY),'poseidon'); // 진 판: 이어하기 지점은 같은 무대 그대로
 await open();await titleToLobby(p,'#continueJourney');assert.equal(await p.locator('#duelRecord').textContent(),'2승리 2패배 (50%)');
 assert.deepEqual(await record(),before);checks.push('defeat recorded once, journey stays on the same stage, persists through reload and updates lobby percentage');
 await p.goto(base+'/?test=1&weapon=longsword&foe=heinrich&stage=castle',{waitUntil:'networkidle'});await p.waitForFunction(()=>window.game?.player,null,{timeout:60000});
 await p.locator('#btnStart').click();await p.waitForFunction(()=>game.state==='fight',null,{timeout:60000});await p.evaluate(()=>game.player.die('기절',true));
 await p.waitForTimeout(800);assert.deepEqual(await record(),before);checks.push('direct test defeat does not change normal-journey records');
 // 주소 판(?stage= 고정)에서 이겨도 이어하기 지점·전적은 그대로
 const journeyBefore=await p.evaluate(k=>localStorage.getItem(k),JOURNEY);
 await p.goto(base+'/?stage=temple&weapon=longsword',{waitUntil:'networkidle'});await p.waitForFunction(()=>window.game?.player,null,{timeout:60000});
 await p.locator('#btnStart').click();await p.waitForFunction(()=>game.state==='fight',null,{timeout:60000});await p.evaluate(()=>game.enemy.die('기절',true));
 await p.waitForTimeout(800);assert.deepEqual(await record(),before);assert.equal(await p.evaluate(k=>localStorage.getItem(k),JOURNEY),journeyBefore);
 checks.push('pinned-stage win does not touch journey checkpoint or records');
 assert.deepEqual(errors,[]);
}finally{fs.writeFileSync(`${out}/records.json`,JSON.stringify({checks,errors},null,2));await browser.close();}
console.log(`PASS ${checks.length} profile/record boundary checks; errors ${errors.length}`);
