// 게임 들머리 통합 점검 (샛별 저장소 game_entry_smoke.mjs 를 우리 판에 맞춤 — docs/import/lobby_port_2026-10-16.md §6)
//  공지 → 첫 화면 → 곧바로 여정(Stage 1) → 정지 → 대기실(Stage 입장) · 이어하기(카드 · 고른 무기 · 이긴 뒤 다음 무대) · 해금·설정 그대로 · 주소 시험 판 건너뛰기 · 화면 크기 · 저장 막힘 · PWA 같은 판 새로 고침 없음
//  10/17 11:2x 사장님 '첫화면에서 바로 전투로': 첫 화면 단추 'Stage 1' · 한글 제목 줄 없음 · 대기실은 싸움의 정지 '대기실'에서 (도우미 tools/browser/to_lobby.mjs)
//  npm run build && npx vite preview --port 5201 →  node tools/browser/game_entry_smoke.mjs http://127.0.0.1:5201 /tmp/<빈 폴더>
//  계정 연결 인증 서버(*.supabase.co)는 부르지 않는다 — 부르면 실패로 센다 (이 점검은 연결 단추를 열고 닫기만)
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { departTitle, lobbyFromBattle, titleToLobby } from './to_lobby.mjs';
const base=process.argv[2]||'http://127.0.0.1:5201',out=process.argv[3]||'/tmp/game-entry';
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||'/opt/pw-browsers/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const results=[],errors=[],key='stillness.journey.checkpoint.v1',profileKey='stillness.lobby.profile.v1';
const check=(name,data={})=>results.push({check:name,...data});
const IGNORED=/deprecated parameters for the initialization function/; // 라파이어 초기화 경고 (본판 그대로 — 관문 명령도 거른다)
const watch=p=>{p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error'&&!IGNORED.test(m.text()))errors.push(m.text());});p.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});};
const noAuth=async c=>c.route('https://*.supabase.co/**',r=>{errors.push('auth server called: '+r.request().url());r.abort();});
const phase=async(p,state)=>p.waitForFunction(s=>game.state===s,state,{timeout:60000});
const checkpoint=p=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
async function title(p){
 await p.waitForFunction(()=>window.game?.player,null,{timeout:60000});
 if(await p.locator('#noticeDialog').evaluate(d=>d.open))await p.locator('#confirmNotices').click();
 await p.waitForFunction(()=>document.querySelector('#gameEntrance')?.shadowRoot.getElementById('entrance')?.dataset.phase==='ready',null,{timeout:20000});
}
async function screenshot(p,name){await p.screenshot({path:`${out}/${name}.png`});}
try{
 const context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'allow'});await noAuth(context);
 const p=await context.newPage();watch(p);
 await p.addInitScript(()=>{if(!localStorage.getItem('gladiator-settings')){localStorage.setItem('gladiator-settings','{"fpsCap":true}');localStorage.setItem('stillness.journeyClears.v1','37');localStorage.setItem('stillness.lobby.neck.v1','{"version":1,"neck":null}');}}); // 용사의 눈물은 벗고 (10/17 기본 장착 — 걸면 기력이 안 깎여 아래 공격 확인이 안 됨 · 건 쪽은 hero_tear_smoke)
 // ?title=1: 카드 두 장을 고정(?cards=)하면서도 첫 화면으로 — 게임 인자가 있으면 원래 첫 화면을 건너뛴다
 await p.goto(base+'/?title=1&cards=longsword,rapier',{waitUntil:'networkidle'});await p.waitForFunction(()=>window.game?.player,null,{timeout:60000});
 assert.equal(await p.locator('#noticeDialog').evaluate(d=>d.open),true);
 const header=await p.locator('#noticeHeading').evaluate(el=>({color:getComputedStyle(el).color,size:getComputedStyle(el).fontSize}));
 assert.deepEqual(header,{color:'rgb(243, 233, 216)',size:'17px'});
 assert.equal(await p.locator('.notice-entry').count(),5);
 await screenshot(p,'notices-in-game');
 for(let i=0;i<20;i++){const done=await p.locator('#noticeList').evaluate(el=>{el.scrollTop+=el.clientHeight/2;return el.scrollTop+el.clientHeight>=el.scrollHeight-1;});await p.waitForTimeout(60);if(done)break;}
 await p.locator('#hideRead').check();await title(p);
 const buttons=await p.locator('.start-actions button').evaluateAll(els=>els.map(el=>({text:el.textContent,label:el.getAttribute('aria-label'),width:el.getBoundingClientRect().width,background:getComputedStyle(el).backgroundColor})));
 assert.deepEqual(buttons.map(b=>b.text),['Stage 1','이어하기']);assert.equal(buttons[0].label,'Stage 1 — 첫 무대부터'); // 10/17 11:2x: '처음부터' → 'Stage 1'
 assert.ok(buttons.every(b=>Math.abs(b.width-205)<.1),JSON.stringify(buttons));
 assert.deepEqual(buttons.map(b=>b.background),['rgb(217, 164, 65)','rgba(24, 18, 14, 0.88)']); // 10/16 15:3x: Stage 1 = 싸움 주 단추(금색) · 이어하기 = 부 단추(그림 위라 창 바탕 --panel)
 // 한글 제목 줄 없음 (10/17 — 이름은 Stillness 하나): 단추 위 제목은 픽셀 글자 Stillness 뿐
 assert.equal(await p.locator('.title-korean').count(),0);
 assert.deepEqual(await p.locator('.title-group').evaluate(g=>[...g.children].filter(e=>!e.matches('.title-rule, .start-actions, #selectionStatus')).map(e=>e.textContent)),['Stillness']);
 assert.equal(await p.locator('.pixel-wordmark > span').evaluate(el=>getComputedStyle(el).position),'absolute');
 assert.deepEqual(await p.locator('.title-footer button').evaluateAll(els=>els.map(e=>e.textContent)),['공지사항','설정','계정 연결']);
 assert.equal(await p.evaluate(()=>game.stats.simTime),0);
 assert.equal(await p.evaluate(()=>getComputedStyle(document.getElementById('menu')).visibility),'hidden');
 await screenshot(p,'title-in-game');
 check('root opens pixel notices/title (5 notices · Stillness wordmark only, no Korean title line · Stage 1 / 이어하기 · footer 공지사항·설정·계정 연결); game behind stays stopped and hidden',{header,buttons});
 // 설정 창 = 게임 설정(화면 60 fps 제한)과 같은 값
 await p.locator('#openSettings').click();await p.waitForFunction(()=>!document.querySelector('#gameEntrance').shadowRoot.getElementById('titleFps').disabled);
 assert.equal(await p.locator('#titleFps').isChecked(),true);await p.locator('#titleFps').uncheck();
 assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('gladiator-settings')).fpsCap),false);assert.equal(await p.evaluate(()=>game.settings.fpsCap),false);
 assert.equal(await p.evaluate(()=>document.querySelector('[data-setting=fpsCap]').classList.contains('on')),false);
 await p.locator('#titleFps').check();await p.locator('#closeSettings').click();
 assert.equal(await p.evaluate(()=>game.settings.fpsCap),true);
 check('title settings dialog reads/writes the game fps setting (same gladiator-settings value and menu toggle)');
 await p.locator('#continueJourney').click();await p.waitForTimeout(150);
 assert.equal(await p.locator('#selectionStatus').textContent(),'이어갈 여정이 없습니다. Stage 1로 시작해 주세요.');assert.equal(await p.evaluate(()=>game.state),'menu');assert.equal(await p.locator('#gameEntrance').count(),1);
 check('이어하기 without a checkpoint stays on the title with the Stage 1 hint');
 // Stage 1 → 곧바로 카드 고르기 (대기실을 거치지 않음 — game_entry.js depart): 덮개 안에 대기실이 붙는지 · 첫 화면이 걷히는지(data-leaving) 지켜본다
 await p.evaluate(()=>{const root=document.querySelector('#gameEntrance').shadowRoot;window.__entry={lobby:false,leaving:false};new MutationObserver(()=>{if(root.querySelector('.lobby'))__entry.lobby=true;if(root.getElementById('entrance')?.hasAttribute('data-leaving'))__entry.leaving=true;}).observe(root,{childList:true,subtree:true,attributes:true});});
 assert.equal(await departTitle(p,'#newJourney','click'),'draw');
 assert.deepEqual(await p.evaluate(()=>window.__entry),{lobby:false,leaving:true});
 assert.equal(await p.locator('#gameEntrance').count(),0);assert.equal(await p.evaluate(()=>document.documentElement.hasAttribute('data-start-open')),false);
 await p.waitForFunction(()=>game.draw.t>.6,null,{timeout:20000});
 const drawn=await checkpoint(p);
 assert.equal(drawn.stage,'poseidon');assert.deepEqual(drawn.cards,['longsword','rapier']);assert.equal(drawn.foe,'heinrich');await screenshot(p,'cards-in-game');
 check('Stage 1 goes straight into the first-stage weapon draw (STAGE_ORDER[0]): no lobby on the way, title fades out and #gameEntrance is removed; cards stored as the checkpoint',{checkpoint:drawn});
 // 정지(카드 고르기 중에도) → '대기실': 대기실은 이어하기 지점으로 열린다(출발 단추 'Stage 입장' — 10/17 12:1x) · 뒤의 판은 멈춘 채(아직 싸우지 않아 게임 시간 0) · 이어하기 지점 그대로
 await lobbyFromBattle(p,'tap');
 assert.equal(await p.locator('#lobbyDepart').textContent(),'Stage 입장');
 assert.equal(await p.evaluate(()=>game.stats.simTime),0);
 assert.equal(await p.evaluate(()=>game.state),'menu');
 assert.equal(await p.evaluate(()=>document.documentElement.hasAttribute('data-start-open')),true);
 assert.deepEqual(await checkpoint(p),drawn);
 assert.equal(await p.locator('#lobbyLevel').textContent(),'Lv.1');assert.equal(await p.locator('#titleCurrent').textContent(),'여행자'); // 10/16 15:3x ⑥: 레벨 글 + 호칭 내림 상자
 // 대표 유파 칸은 뺐다 (사장님 10/16 15:3x ⑥) · 깬 수 37 = 옛 인장 3 → 금화 100 + 300 (한 번 — 인장 제도는 08:1x 에 없앰, 바꾸기만 남음) · 알림 한 줄
 assert.equal(await p.locator('#lobbySchool').count(),0);
 assert.equal(await p.locator('#lobbyCoins').textContent(),'400');assert.equal(await p.locator('#lobbyHeads').textContent(),'0');
 assert.equal(await p.locator('#lobbyStatus').textContent(),'인장 3개를 금화 300으로 바꿨습니다.');
 assert.equal(await p.locator('#duelRecord').textContent(),'0승리 0패배 (0%)');
 assert.equal(await p.locator('#panelInventory').isVisible(),true);
 const thumbs=await p.locator('.inventory-item img').evaluateAll(els=>els.map(e=>({loaded:e.complete&&e.naturalWidth>0,src:e.getAttribute('src')})));
 assert.deepEqual(thumbs.map(t=>t.src),['ui/weapons/tree_branch.webp']);assert.ok(thumbs.every(t=>t.loaded));
 await screenshot(p,'lobby-phone');
 check('pause → 대기실 during the card draw opens the lobby (depart button Stage 입장; game behind stopped, checkpoint kept); first visit shows the one-time seal → coins notice');
 const beforeBodies=await p.evaluate(()=>game.player.meshes.map(({rb})=>({p:rb.translation(),q:rb.rotation()})));
 const turn=await p.locator('#characterView').boundingBox(),touch=await context.newCDPSession(p);
 const tx=turn.x+turn.width*.15,ty=turn.y+turn.height*.5;
 await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:tx,y:ty}]});
 await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:tx+turn.width*.5,y:ty}]});
 await p.waitForTimeout(250); // 10/16 돌림판: 멈췄다 놓으면 관성 없이 그 자리 (튕기면 더 돈다 — ui_fix_smoke)
 await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await p.waitForFunction(()=>document.querySelector('#gameEntrance').shadowRoot.getElementById('characterView').dataset.turning==='false');
 assert.ok(Math.abs(Number(await p.locator('#characterView').getAttribute('data-angle'))-180)<3);
 await screenshot(p,'lobby-back');
 assert.deepEqual(await p.evaluate(()=>game.player.meshes.map(({rb})=>({p:rb.translation(),q:rb.rotation()}))),beforeBodies);
 await p.locator('#characterView').focus();await p.keyboard.press('Home');
 await p.locator('[data-weapon=tree_branch]').tap();assert.equal(await p.locator('#equipItem').isEnabled(),true);assert.equal(await p.locator('#unequipItem').isEnabled(),false);
 await p.locator('#editName').tap();await p.locator('#playerNameInput').fill('  바람  ');await p.locator('#nameForm button[type=submit]').click();
 assert.equal(await p.locator('#lobbyName').textContent(),'바람');
 await p.locator('#editName').tap();await p.locator('#playerNameInput').fill('취소할 이름');await p.locator('#cancelName').tap();
 assert.equal(await p.locator('#lobbyName').textContent(),'바람');
 await p.locator('#tabSkills').tap();assert.equal(await p.locator('.school-tabs [role=tab]').count(),5);assert.equal(await p.locator('.book-node').count(),5);assert.equal(await p.locator('.book-node[data-state=unowned]').count(),5);
 await screenshot(p,'lobby-skills');
 await p.locator('#lobbyBack').tap();await title(p);await p.waitForFunction(()=>!document.querySelector('#gameEntrance').shadowRoot.getElementById('openAccount').disabled,null,{timeout:20000});
 await p.locator('#openAccount').tap();assert.equal(await p.locator('#accountEmail').isVisible(),true);
 await p.locator('#closeAccount').tap();
 // 이어하기 = Stage 1 에서 펼친 그 카드 (첫 화면에서 출발하면 카드를 펼칠 때 지점이 저장된다) → 정지 → 대기실 다시 → Stage 입장 = 같은 지점
 assert.equal(await departTitle(p,'#continueJourney','tap'),'draw');
 assert.deepEqual(await p.evaluate(()=>game.draw.ids.slice(0,2)),drawn.cards);assert.deepEqual(await checkpoint(p),drawn);
 await lobbyFromBattle(p,'tap');
 assert.equal(await p.locator('#lobbyName').textContent(),'바람');assert.equal(await p.locator('#lobbyDepart').textContent(),'Stage 입장');
 assert.equal(await p.locator('#lobbyCoins').textContent(),'400');assert.equal(await p.locator('#lobbyStatus').textContent(),''); // 인장 → 금화는 한 번만 (대기실에 다시 와도)
 assert.equal(await departTitle(p,'#lobbyDepart','tap'),'draw'); // 대기실 출발도 같은 덮개 — 걷히고 카드 고르기가 될 때까지
 assert.deepEqual(await p.evaluate(()=>game.draw.ids.slice(0,2)),drawn.cards);assert.deepEqual(await checkpoint(p),drawn);
 check('lobby: real character touch rotation with physics untouched; tree branch only; editable name; tabs; account entry; safe back navigation (첫 화면 → 이어하기 = same cards → 대기실 again → Stage 입장 resumes the same checkpoint)',{thumbs});
 await p.reload({waitUntil:'networkidle'});await title(p);assert.equal(await departTitle(p,'#continueJourney'),'draw');
 const restored=await checkpoint(p);assert.deepEqual(restored,drawn);
 assert.deepEqual(await p.evaluate(()=>game.draw.ids.slice(0,2)),drawn.cards);
 check('reload/continue restores the same draw, opponent and opponent weapon');
 await p.waitForFunction(()=>game.draw.t>.6,null,{timeout:20000});await p.locator('#draw .wcard[data-i="0"]').tap();await phase(p,'fight');
 const armed=await checkpoint(p);assert.equal(armed.weapon,drawn.cards[0]);
 await p.waitForTimeout(1000);await screenshot(p,'fight-in-game');
 const before=await p.evaluate(()=>game.stats.simTime);await p.waitForFunction(t=>game.stats.simTime>t,before,{timeout:20000});
 assert.equal(await p.evaluate(()=>game.player.name),'바람');
 check('card choice enters live combat and stores chosen weapon; journey fighter uses the lobby name',{checkpoint:armed});
 // 실제 입력 회귀: 첫 사진 뒤에만 AI를 멈추고 판 시작 정지(무대 훑기 3.3 게임 초 — 소프트웨어 GPU 에선 실제 수십 초)를 풀어 이동·공격을 관측한다.
 await p.evaluate(()=>{game.ai.update=()=>{};game.config.ARENA.startHold=0;});await p.waitForFunction(()=>!game.player.feetHeld,null,{timeout:30000});
 const cdp=await context.newCDPSession(p),stick=await p.locator('#moveStick').boundingBox();
 const x=stick.x+stick.width/2,y=stick.y+stick.height/2;
 const position=()=>p.evaluate(()=>{const v=game.player.bodies.pelvis.translation();return [v.x,v.z];});
 const a=await position();
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+45,y}]});await p.waitForFunction(a=>{const v=game.player.bodies.pelvis.translation();return Math.hypot(v.x-a[0],v.z-a[1])>.04;},a,{timeout:20000});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const b=await position();assert.ok(Math.hypot(b[0]-a[0],b[1]-a[1])>.02);
 const attackBefore=await p.evaluate(()=>game.player.stamina.spent.attack);
 await p.touchscreen.tap(600,180);await p.waitForFunction(n=>game.player.stamina.spent.attack>n,attackBefore,{timeout:20000});
 check('actual touchscreen joystick movement and tap attack work after entry',{from:a,to:b});
 await p.locator('#btnPause').tap();await phase(p,'paused');assert.equal(await p.locator('#btnLobby').isVisible(),true);await p.locator('#btnResume').tap();await phase(p,'fight');
 check('pause and resume remain usable (the journey pause menu offers 대기실)');
 await p.reload({waitUntil:'networkidle'});await title(p);assert.equal(await departTitle(p,'#continueJourney'),'fight');
 assert.equal(await p.evaluate(()=>game.player.weapon.id),armed.weapon);
 assert.equal(await p.evaluate(()=>game.enemy.weapon.id),armed.foeWeapon);
 assert.equal(await p.evaluate(()=>game.stage.id),armed.stage);
 check('continue restores armed round at stage start');
 // 이어하기 경계만 보려고 상대 패배를 강제한다 (승패 실측이 아님). 실제 플레이 사진은 위에서 이미 찍었다.
 await p.evaluate(()=>game.enemy.die('기절',true));
 await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).stage==='clearing',key,{timeout:20000});
 assert.deepEqual(await p.evaluate(k=>JSON.parse(localStorage.getItem(k)),profileKey),{version:1,name:'바람',wins:1,losses:0});
 const wonCoins=await p.evaluate(()=>JSON.parse(localStorage.getItem('stillness.lobby.progress.v1')).coins);assert.ok(wonCoins>=405&&wonCoins<=415,`win +5~15: ${wonCoins}`); // 사장님 10/16 04:3x
 await p.waitForFunction(()=>game.state==='paused',null,{timeout:90000});
 assert.equal(await p.locator('#menuReward').textContent(),`금화 +${wonCoins-400}`);assert.equal(await p.locator('#menuReward').isVisible(),true);
 assert.equal(await p.locator('#btnLobby').isVisible(),true); // 결과 창에도 '대기실' (여정 판)
 check('journey win: coins +5..15 saved and shown on the result screen (with 대기실)',{coins:wonCoins});
 assert.equal(await p.evaluate(()=>localStorage.getItem('stillness.journeyClears.v1')),'38');
 await p.reload({waitUntil:'networkidle'});await title(p);assert.equal(await departTitle(p,'#continueJourney'),'draw');
 assert.equal(await p.evaluate(()=>game.stage.id),'clearing');assert.equal(await p.evaluate(()=>localStorage.getItem('stillness.journeyClears.v1')),'38');
 check('win saves next stage (nextStage of STAGE_ORDER) immediately; resume does not award a duplicate clear');
 await p.reload({waitUntil:'networkidle'});await title(p);assert.equal(await departTitle(p),'draw');
 assert.equal(await p.evaluate(()=>game.stage.id),'poseidon');assert.equal(await p.evaluate(()=>localStorage.getItem('stillness.journeyClears.v1')),'38');
 assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('gladiator-settings')).fpsCap),true);
 check('Stage 1 resets the stage while preserving the clear count (statistic) and settings');
 await p.locator('#btnPause').tap();await phase(p,'paused');await p.locator('#btnStart').tap();await phase(p,'draw');
 check('existing restart still returns to draw');
 const savedBefore=await checkpoint(p);
 await p.goto(base+'/?test=1&weapon=longsword&foe=heinrich&stage=castle',{waitUntil:'networkidle'});await p.waitForFunction(()=>window.game?.player,null,{timeout:60000});
 assert.equal(await p.locator('#gameEntrance').count(),0);await p.locator('#btnStart').tap();await phase(p,'fight');
 assert.equal(await p.evaluate(()=>game.stage.id),'castle');assert.deepEqual(await checkpoint(p),savedBefore);
 const coinsBefore=await p.evaluate(()=>localStorage.getItem('stillness.lobby.progress.v1'));await p.evaluate(()=>game.enemy.die('기절',true));await p.waitForFunction(()=>game.state==='paused',null,{timeout:90000});
 assert.equal(await p.evaluate(()=>localStorage.getItem('stillness.lobby.progress.v1')),coinsBefore);assert.equal(await p.locator('#menuReward').isVisible(),false); // 테스트 경로 판은 금화가 안 바뀐다
 assert.equal(await p.locator('#btnLobby').isVisible(),false); // 주소로 연 판에는 '대기실' 길이 없다
 check('existing direct test link bypasses title and cannot overwrite journey (no 대기실 on its result screen)');
 for(const q of ['?stamina=0','?foeWhiff=1','?stage=sluice','?look=heinrich:v0']){
  await p.goto(base+'/'+q,{waitUntil:'networkidle'});await p.waitForFunction(()=>window.game?.player,null,{timeout:60000});
  assert.equal(await p.locator('#gameEntrance').count(),0,q);assert.equal(await p.locator('#btnStart').isVisible(),true,q);
 }
 check('game arguments (?stamina=0 · ?foeWhiff=1 · ?stage= · ?look=) open the old menu directly as before');
 await context.close();
 for(const [name,width,height] of [['desktop',1280,720],['portrait',390,844],['small-portrait',320,568]]){
  const c=await browser.newContext({viewport:{width,height},serviceWorkers:'allow',reducedMotion:'reduce'});await noAuth(c);const q=await c.newPage();watch(q);
  await q.goto(base+'/',{waitUntil:'networkidle'});await q.waitForFunction(()=>window.game?.player,null,{timeout:60000});
  const rects=await q.locator('#noticeDialog').evaluate(d=>{const r=d.getBoundingClientRect(),root=d.getRootNode(),a=root.getElementById('confirmNotices').getBoundingClientRect(),b=root.querySelector('.hide-read').getBoundingClientRect();return {right:r.right,bottom:r.bottom,centerA:(a.top+a.bottom)/2,centerB:(b.top+b.bottom)/2};});
  assert.ok(rects.right<=width&&rects.bottom<=height&&Math.abs(rects.centerA-rects.centerB)<1);
  await title(q);assert.equal(await q.locator('.title-screen').evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
  const foot=await q.locator('.title-footer button').evaluateAll(els=>els.map(e=>e.getBoundingClientRect().right));assert.ok(foot.every(r=>r<=width),JSON.stringify(foot));
  check(`${name}: integrated title and compact notices fit`,rects);
  assert.equal(await titleToLobby(q),'draw'); // Stage 1 → 카드 고르기 → 정지 → 대기실
  assert.equal(await q.locator('#lobbySchool').count(),0); // 대표 유파 칸 없음 (10/16 15:3x ⑥)
  assert.equal(await q.locator('#lobbyDepart').textContent(),'Stage 입장');
  assert.ok(await q.locator('.lobby').evaluate(el=>el.scrollWidth<=el.clientWidth));
  await q.locator('#lobbyDepart').scrollIntoViewIfNeeded();assert.equal(await q.locator('#lobbyDepart').isVisible(),true);
  await q.locator('#tabWeapons').focus();await q.keyboard.press('End');assert.equal(await q.locator('#panelSkills').isVisible(),true);
  check(`${name}: Stage 1 → card draw → pause → 대기실: lobby fits, no overflow, keyboard tab selection works`);await c.close();
 }
 const denied=await browser.newContext({viewport:{width:844,height:390},serviceWorkers:'allow',reducedMotion:'reduce'});await noAuth(denied);await denied.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('denied');};Storage.prototype.setItem=()=>{throw Error('denied');};});
 const d=await denied.newPage();watch(d);await d.goto(base+'/',{waitUntil:'networkidle'});await title(d);assert.equal(await departTitle(d),'draw');check('storage denied still allows a new game (Stage 1 → card draw)');await denied.close();
 // PWA (배포판 + 서비스 워커): 같은 판이면 첫 화면으로 돌아와도 새로 고치지 않는다 — 게임 묶음을 나중에 받으며 붙는 modulepreload 링크를 새 판으로 읽지 않게 (src/pwa.js currentSig)
 if(process.env.SKIP_PWA!=='1'){
  const pc=await browser.newContext({viewport:{width:844,height:390},serviceWorkers:'allow',reducedMotion:'reduce'});await noAuth(pc);const pw=await pc.newPage();watch(pw);
  await pw.goto(base+'/',{waitUntil:'load'});await title(pw);
  const registered=await pw.evaluate(async()=>{for(let i=0;i<100;i++){if(document.documentElement.dataset.pwa==='on')return true;await new Promise(r=>setTimeout(r,100));}return false;});
  if(registered){
   const origin=await pw.evaluate(()=>performance.timeOrigin),links=await pw.evaluate(()=>document.querySelectorAll('link[rel=modulepreload]').length);
   await pw.waitForTimeout(31000);
   await pw.evaluate(()=>{const set=v=>{Object.defineProperty(document,'visibilityState',{value:v,configurable:true});Object.defineProperty(document,'hidden',{value:v==='hidden',configurable:true});document.dispatchEvent(new Event('visibilitychange'));};set('hidden');set('visible');});
   await pw.waitForTimeout(3000);
   assert.equal(await pw.evaluate(()=>performance.timeOrigin),origin);
   check('PWA: same build does not reload the title on return (modulepreload links injected at runtime are ignored)',{links});
  }else check('PWA: service worker not registered on this server (dev?) — reload check skipped');
  await pc.close();
 }
 assert.deepEqual(errors,[]);
}finally{fs.writeFileSync(`${out}/results.json`,JSON.stringify({results,errors},null,2));await browser.close();}
console.log(`PASS ${results.length} integrated entry checks; errors ${errors.length}`);
