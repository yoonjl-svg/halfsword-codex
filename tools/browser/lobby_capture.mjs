// 첫 화면·대기실 디자인 리뷰 사진 (우리 게임 실제 화면 — docs/import/lobby_port_2026-10-16.md §9)
//  폰 가로 844×390 · 작은 가로 폰 740×360 · 좁은 가로 폰 568×320(좁은 화면 — 아래로 흐름) · PC 1280×720 마다: 공지 · 첫 화면 · 대기실(아이템 · 상점 · 스킬북 · 이벤트) ·
//   나뭇가지 장착과 설명 카드 · 케틀 햇 설명 카드(같은 아이템 칸 — 10/18 04:1x 무기 · 방어구를 합침) · 무기 카드 · 첫 판 시작
//  폰은 계정 연결 창(이메일 · 번호 단계 — 인증 서버 응답은 가짜, 메일 안 보냄)도 · 깬 무대 37(인장 셋 — 사장님처럼 여정을 꽤 한 상태)로 찍는다. 폰은 터치 화면 흉내
//  (세로 터치 폰은 10/16 14:0x 부터 첫 화면 · 대기실도 '폰을 가로로 돌려 주십시오'가 덮어 누를 수 없다 — 크기 표에서 뺐다. 세로 크기를 넣으면 PC 창(터치 없음)으로)
//  npm run build && npx vite preview --port 5201 →  node tools/browser/lobby_capture.mjs http://127.0.0.1:5201 docs/handoff
import { chromium } from 'playwright';
import { titleToLobby } from './to_lobby.mjs'; // 10/17: 첫 화면 → 곧바로 여정 → 정지 → 대기실 (사장님 '첫화면에서 바로 전투로')
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base=process.argv[2]||'http://127.0.0.1:5201',out=process.argv[3]||'docs/handoff';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||'/opt/pw-browsers/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const IGNORED=/deprecated parameters for the initialization function/;
const errors=[],saved=[];
const user={id:'00000000-0000-4000-8000-000000000001',aud:'authenticated',role:'authenticated',email:'traveler.test@example.com',email_confirmed_at:'2026-10-15T00:00:00Z',is_anonymous:false,app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:'2026-10-15T00:00:00Z'};
const SIZES=[['phone-landscape',844,390,true],['phone-small',740,360,true],['phone-narrow',568,320,true],['desktop',1280,720,false]];
const inRoot=(p,body)=>p.evaluate(new Function(`const root=document.querySelector('#gameEntrance').shadowRoot;${body}`));
for(const [size,width,height,phone] of SIZES){
 const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:phone?2:1,isMobile:phone,hasTouch:phone});
 await ctx.route('https://*.supabase.co/**',async route=>{const path=new URL(route.request().url()).pathname;if(path.endsWith('/otp'))return route.fulfill({status:200,contentType:'application/json',body:'{}'});errors.push(`${size}: unexpected auth request ${path}`);return route.abort();});
 await ctx.addInitScript(()=>{if(!localStorage.getItem('stillness.journeyClears.v1'))localStorage.setItem('stillness.journeyClears.v1','37');});
 const p=await ctx.newPage();
 p.on('pageerror',e=>errors.push(`${size}: ${e}`));p.on('console',m=>{if(m.type()==='error'&&!IGNORED.test(m.text()))errors.push(`${size}: ${m.text()}`);});
 const shot=async name=>{const path=`${out}/lobby_${name}_${size}.png`;await p.screenshot({path});saved.push(path);};
 const tap=sel=>phone?p.locator(sel).tap():p.locator(sel).click();
 await p.goto(base+'/',{waitUntil:'networkidle'});await p.locator('#noticeDialog').waitFor({state:'attached',timeout:30000});await p.evaluate(()=>document.fonts.ready);
 await p.waitForTimeout(600);await shot('notices');
 await p.waitForFunction(()=>window.game?.player,null,{timeout:60000});
 await tap('#confirmNotices');await p.waitForFunction(()=>document.querySelector('#gameEntrance').shadowRoot.getElementById('entrance').dataset.phase==='ready',null,{timeout:20000});
 await p.waitForFunction(()=>!document.querySelector('#gameEntrance').shadowRoot.getElementById('openAccount').disabled,null,{timeout:20000});
 await p.waitForTimeout(400);await shot('title');
 if(phone){
  await tap('#openAccount');await p.locator('#accountEmail').fill('traveler.test@example.com');await p.waitForTimeout(200);await shot('account-email');
  await tap('#accountSend');await p.locator('#accountCode').waitFor({state:'visible'});await p.locator('#accountCode').fill('123456');await p.waitForTimeout(200);await shot('account-code');
  await tap('#closeAccount');
 }
 await titleToLobby(p,'#newJourney',phone?'tap':'click');await p.waitForTimeout(700);
 const flows=height>width||width<680; // 좁은 화면: 대기실이 아래로 흐른다 — 내려 찍은 사진을 하나 더
 await inRoot(p,`root.querySelector('.lobby').scrollTop=0;`);await shot('panels');
 if(flows){await inRoot(p,`const l=root.querySelector('.lobby');l.scrollTop=l.scrollHeight;`);await p.waitForTimeout(200);await shot('panels-scrolled');}
 await p.locator('[data-weapon=tree_branch]').scrollIntoViewIfNeeded();await tap('[data-weapon=tree_branch]');await tap('#equipItem');
 assert.equal(await p.locator('#itemName').textContent(),'나뭇가지');
 if(flows)await p.locator('#itemDetail').scrollIntoViewIfNeeded();
 await p.waitForTimeout(200);await shot('branch-card');
 await tap('#unequipItem'); // 다시 풀어 둔다 — 무기를 건 채 출발하면 카드 없이 곧장 싸움이라(10/16 03:5x) 아래 카드 사진이 안 나온다
 await tap('button[data-armor=kettle]');await p.locator('button[data-armor=kettle] img').evaluate(img=>img.decode()); // 같은 아이템 칸 (10/18 04:1x — 전 방어구 탭)
 assert.equal(await p.locator('#itemName').textContent(),'케틀 햇');if(flows)await p.locator('#itemDetail').scrollIntoViewIfNeeded();await p.waitForTimeout(200);await shot('armor-card');
 for(const [tab,name] of [['#tabShop','shop'],['#tabSkills','skills'],['#tabEvent','event']]){await p.locator(tab).scrollIntoViewIfNeeded();await tap(tab);await p.waitForTimeout(150);if(flows)await p.locator('.contents-panel').scrollIntoViewIfNeeded();await shot(name);}
 assert.equal(await p.locator('#saengsaEnter').textContent(),'생사전 입장'); // 10/29 이벤트 → 생사전 칸 (saengsa_panel.js)
 await p.locator('#tabItems').scrollIntoViewIfNeeded();await tap('#tabItems');
 await p.locator('#lobbyDepart').scrollIntoViewIfNeeded();await tap('#lobbyDepart');
 await p.waitForFunction(()=>game.state==='draw'&&game.draw.t>.6,null,{timeout:60000});await p.waitForTimeout(300);await shot('draw');
 // 세로 터치 화면은 '폰을 가로로 돌려 주십시오'(#rotate)가 카드를 덮는다(실제 모습) — 사진을 이으려고 카드 누름만 페이지 안에서 보낸다
 if(phone&&height>width)await p.evaluate(()=>document.querySelector('#draw .wcard[data-i="0"]').click());else await tap('#draw .wcard[data-i="0"]');
 await p.waitForFunction(()=>game.state==='fight',null,{timeout:60000});
 // 첫 판 시작: 무대 훑기 뒤 판 알림 '대면'과 상대 소개가 뜨는 때
 await p.waitForFunction(()=>{const t=document.getElementById('toast');return t.classList.contains('show')&&t.textContent==='대면';},null,{timeout:120000});
 await p.waitForTimeout(250);await shot('fight-start');
 if(phone&&height>width){ // 세로: 실제로는 '폰을 가로로 돌려 주십시오'가 덮는다(위 사진) — 그 뒤의 HUD 를 보려고 안내만 숨긴 사진 하나 더
  await p.addStyleTag({content:'#rotate.enabled{display:none!important}'});await p.waitForTimeout(150);await shot('fight-start-hud');
 }
 await ctx.close();
}
await browser.close();
console.log(saved.join('\n'));
if(errors.length){console.log('ERRORS',errors);process.exit(1);}
console.log(`saved ${saved.length} captures; errors 0`);
