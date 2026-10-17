// 대기실 장착·배치 점검 (샛별 저장소 lobby_equipment_smoke.mjs 를 우리 판에 맞춤 — docs/import/lobby_port_2026-10-16.md §6)
//  우리 손댐: 무기 칸 = 나뭇가지 하나(롱소드 뺌) · 나뭇가지 설명 카드(weapons.js 이름·등급·설명 그대로) · 방어구 이름 '케틀 햇' · 첫 화면 아래 줄 세 칸
//  10/17: 방어구 칸 = 케틀 햇 · 용사의 눈물 둘 (용사의 눈물 장착 · 싸움은 tools/browser/hero_tear_smoke.mjs — 여기서는 칸 수 · 차례만)
//  10/17 11:2x 흐름: 첫 화면 'Stage 1' → 곧바로 여정(카드, 장착한 무기가 있으면 싸움) → 정지 → 대기실('Stage 입장') — tools/browser/to_lobby.mjs
//  npm run build && npx vite preview --port 5201 →  node tools/browser/lobby_equipment_smoke.mjs http://127.0.0.1:5201 /tmp/<빈 폴더>
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getWeapon, TIER_LABEL } from '../../src/weapons.js';
import { titleToLobby } from './to_lobby.mjs';
const base=process.argv[2]||'http://127.0.0.1:5201',out=process.argv[3]||'/tmp/lobby-equipment';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||'/opt/pw-browsers/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const errors=[],checks=[];
const IGNORED=/deprecated parameters for the initialization function/;
const watch=p=>{p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error'&&!IGNORED.test(m.text()))errors.push(m.text());});p.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});};
const noAuth=async c=>c.route('https://*.supabase.co/**',r=>{errors.push('auth server called: '+r.request().url());r.abort();});
const title=async p=>{await p.waitForFunction(()=>window.game?.player,null,{timeout:60000});if(await p.locator('#noticeDialog').evaluate(d=>d.open))await p.locator('#confirmNotices').click();};
const state=async(p,equip,unequip,weapon)=>{assert.equal(await p.locator('#equipItem').isEnabled(),equip);assert.equal(await p.locator('#unequipItem').isEnabled(),unequip);assert.equal(await p.locator('#characterView').getAttribute('data-equipped'),weapon);};
const card=p=>p.locator('#itemDetail').evaluate(e=>{const r=e.getBoundingClientRect(),f=e.closest('.inventory-frame').getBoundingClientRect();return {hidden:e.hidden,name:e.querySelector('#itemName').textContent,rarity:e.querySelector('#itemRarity').textContent,description:e.querySelector('#itemDescription').textContent,inside:r.left>=f.left-.5&&r.right<=f.right+.5&&r.top>=f.top-.5&&r.bottom<=f.bottom+.5,overflow:e.scrollHeight>e.clientHeight+1};});
const shot=(p,name)=>p.screenshot({path:`${out}/${name}.png`});
const branch=getWeapon('tree_branch');
try{
 const c=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,reducedMotion:'reduce'});await noAuth(c);const p=await c.newPage();watch(p);
 await p.goto(base+'/',{waitUntil:'networkidle'});await title(p);
 const style=sel=>p.locator(sel).evaluate(e=>{const s=getComputedStyle(e);return [s.fontFamily,s.fontSize,s.fontWeight,s.borderTopColor,s.borderTopWidth,s.clipPath,s.backgroundImage];});
 const footer=await p.locator('.title-footer button').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return {label:e.textContent,width:r.width,height:r.height,x:r.x,y:r.y};}));
 assert.deepEqual(footer.map(f=>f.label),['공지사항','설정','계정 연결']);
 for(const f of footer){assert.equal(f.width,70);assert.ok(Math.abs(f.height-28)<1,JSON.stringify(f));assert.equal(f.y,footer[0].y);} // 10/16 15:3x: 작은 부 단추(글 12 · 패딩 6) — 70 px 세 칸 그대로
 assert.ok(footer[1].x>footer[0].x&&footer[2].x>footer[1].x);
 await p.waitForFunction(()=>!document.querySelector('#gameEntrance').shadowRoot.getElementById('openAccount').disabled,null,{timeout:20000});
 await p.locator('#openAccount').tap();assert.equal(await p.locator('#accountEmail').isVisible(),true);await shot(p,'title-account');await p.locator('#closeAccount').tap();
 const titleButton=await style('#newJourney');assert.equal(await p.locator('#newJourney').textContent(),'Stage 1');await shot(p,'title-reference');assert.equal(await titleToLobby(p,'#newJourney','tap'),'draw'); // 장착 없음 → 카드 → 정지 → 대기실
 // 글은 싸움 화면 규칙(10/16 entrance_type.css): 첫 화면 주 단추 14·700 · 고른 탭 12·600 · 안 고른 탭 12·400 · 글꼴 줄 Cinzel → 프리텐다드
 //  꼴(10/16 15:3x — 나무 판자 → 싸움 화면 꼴): 주 단추 = 테두리 없는 납작한 금색 · 탭 = 1 px 테두리(고른 것 금색) · 둘 다 잘라 낸 모서리 · 나뭇결 없음
 const lobbyButton=await style('#tabWeapons'),otherTab=await style('#tabArmor');assert.equal(lobbyButton[1],'12px');assert.equal(titleButton[1],'14px');assert.deepEqual([titleButton[2],lobbyButton[2],otherTab[2]],['700','600','400']);
 assert.ok(titleButton[0].startsWith('Cinzel, Pretendard'),titleButton[0]);assert.equal(lobbyButton[0],titleButton[0]);assert.equal(await p.locator('#lobbyBack').textContent(),'첫 화면');assert.equal(await p.locator('#lobbyDepart').textContent(),'Stage 입장');
 assert.deepEqual(titleButton.slice(4),['0px','none','none']);assert.deepEqual(lobbyButton.slice(3),['rgb(217, 164, 65)','1px','none','none']);assert.deepEqual(otherTab.slice(3),['rgba(243, 233, 216, 0.18)','1px','none','none']);
 await state(p,false,false,'');assert.equal(await p.locator('.inventory-item').count(),1);assert.equal(await p.locator('.inventory-slot').count(),19);
 assert.equal(await p.locator('[data-weapon=longsword]').count(),0);
 const layout=await p.locator('.inventory-grid').evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect(),item=e.firstElementChild.getBoundingClientRect(),root=e.getRootNode();return {columns:s.gridTemplateColumns.split(' ').length,rows:s.gridTemplateRows.split(' ').length,cell:[item.width,item.height],width:r.width,frame:root.querySelector('.portrait-card').getBoundingClientRect().toJSON(),panel:root.querySelector('.character-panel').getBoundingClientRect().toJSON(),depart:root.getElementById('lobbyDepart').getBoundingClientRect().toJSON()};});
 assert.equal(layout.columns,5);assert.equal(layout.rows,4);assert.ok(Math.abs(layout.cell[0]-layout.cell[1])<1);assert.ok(layout.cell[0]>43.3);
 // 10/16 15:3x ⑤: 캐릭터 카드 = 싸움 무기 카드 비(약 2 : 3) · 칸 위 = 카드 위 · 칸 아래 = 출발 단추 아래 (전: 칸의 80 % × 80 %)
 const ratio=layout.frame.width/layout.frame.height;assert.ok(ratio>.62&&ratio<.7,`card ratio ${ratio}`);
 assert.ok(Math.abs(layout.frame.top-layout.panel.top)<1&&Math.abs(layout.depart.bottom-layout.panel.bottom)<1&&layout.depart.y>=layout.frame.bottom&&layout.depart.bottom<=390,JSON.stringify(layout));
 assert.equal((await card(p)).hidden,true);
 await shot(p,'lobby-phone');checks.push({name:'battle-style buttons and tabs, lobby text smaller; character card about 2:3 from the column top to the departure button at the column bottom; 5×4 square grid; tree branch only (no longsword)',layout});
 assert.equal(await p.locator('#lobbyLevel').textContent(),'Lv.1');assert.equal(await p.locator('#titleCurrent').textContent(),'여행자');assert.equal(await p.locator('#lobbyCoins').textContent(),'100');
 assert.equal(await p.locator('.duel-record > span').textContent(),'대면 결과');
 const order=await p.locator('.profile-data dd').evaluateAll(els=>els.map(e=>e.id||e.className));assert.deepEqual(order,['lobbyRank','name-row']); // 대표 유파 칸은 뺐다 (10/16 15:3x ⑥)
 const menu=await p.locator('.lobby-tabs button').evaluateAll(els=>els.map(e=>({text:e.textContent,x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y})));
 assert.deepEqual(menu.map(m=>m.text),['무기','방어구','상점','스킬북']);assert.equal(menu[0].y,menu[1].y);assert.equal(menu[2].y,menu[3].y);assert.ok(menu[2].y>menu[0].y);
 await p.locator('#tabArmor').tap();assert.equal(await p.locator('.inventory-item').count(),2);assert.equal(await p.locator('.inventory-slot').count(),18); // 10/17 용사의 눈물이 둘째 칸 (hero_tear_smoke 가 자세히 본다)
 assert.deepEqual(await p.locator('.inventory-item').evaluateAll(els=>els.map(e=>e.dataset.armor)),['kettle','hero_tear']);
 await p.locator('[data-armor=kettle] img').evaluate(img=>img.decode());await p.locator('button[data-armor=kettle]').tap();
 let k=await card(p);assert.deepEqual([k.hidden,k.name,k.rarity,k.description],[false,'케틀 햇','레전드','여행자의 필수품. 뒤집으면 요리를 할 수 있다. (생존술: 기력 +30)']);assert.ok(k.inside&&!k.overflow,JSON.stringify(k));
 assert.deepEqual(await p.locator('#itemDetail').evaluate(e=>[getComputedStyle(e.querySelector('#itemRarity')).color,getComputedStyle(e.querySelector('#itemName')).color,getComputedStyle(e.querySelector('.item-ability')).color]),Array(3).fill('rgb(255, 210, 74)')); // 레전드 = --tier-legend (사장님 10/16 03:5x)
 assert.equal(await p.locator('[data-armor=kettle] img').getAttribute('alt'),'케틀 햇');
 assert.equal(await p.locator('#characterView').getAttribute('data-armor'),'kettle');await state(p,false,true,'');await shot(p,'armor-equipped');
 await p.locator('#unequipItem').tap();assert.equal(await p.locator('#characterView').getAttribute('data-armor'),'');await state(p,true,false,'');await shot(p,'armor-unequipped');
 assert.match(await p.locator('#equipmentStatus').textContent(),/장착 해제/);
 assert.equal(await p.evaluate(()=>game.player.helmetGroup.visible),true);
 await p.locator('#equipItem').tap();assert.match(await p.locator('#equipmentStatus').textContent(),/^케틀 햇 장착/);await p.locator('#tabWeapons').tap();await state(p,false,false,'');
 checks.push({name:'profile order, initial Lv1/traveler/100 coins, 2×2 menus, armor card 케틀 햇 · 커먼 · description, independent armor slot'});
 const bodies=await p.evaluate(()=>game.player.meshes.map(({rb})=>({position:rb.translation(),rotation:rb.rotation()})));
 await p.locator('[data-weapon=tree_branch]').tap();await state(p,true,false,'');
 k=await card(p);assert.deepEqual([k.hidden,k.name,k.rarity,k.description],[false,branch.nameKo,TIER_LABEL[branch.tier],branch.desc]);assert.ok(k.inside&&!k.overflow,JSON.stringify(k));
 assert.equal(k.rarity,'쓰레기');await shot(p,'branch-selected');
 await p.locator('#equipItem').tap();await state(p,false,true,'tree_branch');await shot(p,'branch-equipped');
 assert.equal(await p.locator('[data-weapon=tree_branch] .equipped-badge').isVisible(),true);
 assert.match(await p.locator('#characterView').getAttribute('aria-label'),/나뭇가지 장착/);
 await p.locator('#unequipItem').tap();await state(p,true,false,'');await shot(p,'unequipped');
 await p.locator('.inventory-slot').first().tap();await state(p,false,false,'');assert.equal((await card(p)).hidden,true);
 for(let i=0;i<8;i++){await p.locator('[data-weapon=tree_branch]').tap();await p.locator('#equipItem').tap();await p.locator('#unequipItem').tap();await p.locator('.inventory-slot').first().tap();}
 assert.deepEqual(await p.evaluate(()=>game.player.meshes.map(({rb})=>({position:rb.translation(),rotation:rb.rotation()}))),bodies);assert.equal(await p.evaluate(()=>game.stats.simTime),0);
 checks.push({name:'tree branch card = weapons.js nameKo · TIER_LABEL · desc; selection separate from equip; unequip/clear and repeated cycles; physics untouched'});
 await p.locator('[data-weapon=tree_branch]').tap();await p.locator('#equipItem').tap();
 const v=await p.locator('#characterView').boundingBox(),cdp=await c.newCDPSession(p),x=v.x+v.width*.1,y=v.y+v.height*.5;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+v.width*.25,y}]});await p.waitForTimeout(250);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); // 10/16 돌림판: 멈췄다 놓으면 관성 없음
 await p.waitForFunction(()=>document.querySelector('#gameEntrance').shadowRoot.getElementById('characterView').dataset.turning==='false');
 assert.ok(Math.abs(Number(await p.locator('#characterView').getAttribute('data-angle'))-90)<3);await shot(p,'equipped-rotation');
 await p.reload({waitUntil:'networkidle'});await title(p);assert.equal(await titleToLobby(p,'#newJourney','tap'),'fight');assert.equal(await p.evaluate(()=>game.player.weapon.id),'tree_branch'); // 장착한 나뭇가지 → 첫 화면에서도 카드 없이 곧장 싸움
 await state(p,false,false,'tree_branch');assert.equal(await p.locator('#characterView').getAttribute('data-armor'),'kettle');
 await p.locator('#editName').tap();await p.locator('#playerNameInput').fill('방랑 검객');await p.locator('#nameForm button[type=submit]').tap();
 await p.locator('#lobbyBack').tap();await title(p);await titleToLobby(p,'#newJourney','tap');await state(p,false,false,'tree_branch');assert.equal(await p.locator('#lobbyName').textContent(),'방랑 검객');
 assert.deepEqual(await p.evaluate(()=>[localStorage.getItem('stillness.lobby.weapon.v1'),localStorage.getItem('stillness.lobby.armor.v1')]),['{"version":1,"weapon":"tree_branch"}','{"version":1,"armor":"kettle"}']);
 checks.push({name:'equipped weapon rotates with model; persistence (stillness.lobby.*) through reload/name edit/back navigation; selection resets; Stage 1 with the branch equipped fights with it at once (no card draw)'});
 // 10/16 (사장님 03:5x '장착하면 실제 전투에 가져나가게 해'): 나뭇가지를 장착했으면 카드 없이 그 무기로 곧장 싸움
 await p.locator('#lobbyDepart').tap();await p.waitForFunction(()=>game.state==='fight',null,{timeout:60000});assert.equal(await p.evaluate(()=>game.player.weapon.id),'tree_branch');assert.equal(await p.evaluate(()=>document.getElementById('draw').classList.contains('show')),false);
 checks.push({name:'lobby departure (Stage 입장) with the branch equipped goes straight to the fight with the branch (no card draw)'});await c.close();
 for(const [name,width,height] of [['desktop',1280,720],['wide',1440,900],['portrait',390,844],['small-portrait',320,568],['small-landscape',568,320]]){
  const qc=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});await noAuth(qc);const q=await qc.newPage();watch(q);await q.goto(base+'/',{waitUntil:'networkidle'});await title(q);await titleToLobby(q);
  assert.ok(await q.locator('.lobby').evaluate(e=>e.scrollWidth<=e.clientWidth));await q.locator('.inventory-grid').scrollIntoViewIfNeeded();
  await q.locator('[data-weapon=tree_branch]').click();const kk=await card(q);assert.ok(kk.inside&&!kk.overflow,`${name} ${JSON.stringify(kk)}`); // 장착 · 해제는 설명 카드 안 (10/16 15:3x)
  await q.locator('#equipItem').click();await state(q,false,true,'tree_branch');
  await q.locator('#lobbyDepart').scrollIntoViewIfNeeded();await q.locator('#lobbyDepart').click();await q.waitForFunction(()=>game.state==='fight'&&game.player.weapon.id==='tree_branch',null,{timeout:60000});
  checks.push({name:`${name}: fits, item card inside the frame, equipment buttons and departure reachable`});await qc.close();
 }
 const denied=await browser.newContext({viewport:{width:844,height:390},reducedMotion:'reduce'});await noAuth(denied);
 await denied.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('denied');};Storage.prototype.setItem=()=>{throw Error('denied');};});
 const d=await denied.newPage();watch(d);await d.goto(base+'/',{waitUntil:'networkidle'});await title(d);assert.equal(await titleToLobby(d),'draw');await d.locator('[data-weapon=tree_branch]').click();await d.locator('#equipItem').click();await state(d,false,true,'tree_branch');
 await d.locator('#lobbyBack').click();await title(d);assert.equal(await titleToLobby(d),'fight');assert.equal(await d.evaluate(()=>game.player.weapon.id),'tree_branch');await state(d,false,false,'tree_branch');await denied.close(); // 저장이 막혀도 이번 실행 동안의 장착으로 싸운다
 checks.push({name:'storage denied: equip still works, survives lobby remount within session and is used by the next Stage 1 (fight with the branch)'});assert.deepEqual(errors,[]);
}finally{fs.writeFileSync(`${out}/equipment.json`,JSON.stringify({checks,errors},null,2));await browser.close();}
console.log(`PASS ${checks.length} equipment/layout checks; errors ${errors.length}`);
