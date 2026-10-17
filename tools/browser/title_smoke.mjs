// 첫 화면·공지 점검 — 게임 주소(/) 위에서 (샛별 저장소 start_screen_smoke.mjs 는 시안 쪽 따로 된 쪽(start-pixel.html)을 봤다 — 그 쪽은 들여오지 않아 같은 점검을 게임 첫 화면에 맞춤, docs/import/lobby_port_2026-10-16.md §6)
//  공지 다섯 · 글자 색 셋·크기 셋 · 화면에 들어온 공지만 읽음 · '지난 업데이트 숨김' 기억 · 깨진 저장 되살림 · 픽셀 제목·단추 크기 · 아래 줄 세 칸 · 화면 크기 · 움직임 줄이기 · 저장 막힘
//  10/16 14:0x (docs/import/ui_fix_2026-10-16.md §11): 공지 제목 = 본문과 같은 10 · 폰 세로 = '폰을 가로로 돌려 주세요'가 공지·첫 화면을 덮음(공지 창도 감춤) → 가로로 돌려 같은 점검 · PC 세로는 그대로
//  10/16 15:3x (docs/import/ui_unify_2026-10-16.md): Stage 1(전 처음부터) · 이어하기 · 확인 = 싸움 화면 단추(높이 · 색) · '지난 업데이트 숨김' = 미닫이(role=switch — check/uncheck 그대로) · 나타나기 움직임 줄이기
//   (싸움 화면과 계산값 맞대기 · 미닫이 꼴 · 누를 때 안 내려앉기 · 글자만 steps 는 tools/browser/ui_unify_smoke.mjs)
//  10/17 (docs/import/notice_size_2026-10-17.md): 공지 글자 자동 키움 끔(text-size-adjust 100%) · 아래 줄 '공지사항'으로 연 공지 = 처음 들어올 때 공지와 같은 글자 값
//  10/17 11:2x 사장님 '게임 이름은 이제 Stillness': 한글 제목 줄(적막) 없음 — 단추 위 제목은 픽셀 Stillness 하나 · '처음부터' → 'Stage 1'
//  npm run build && npx vite preview --port 5201 →  node tools/browser/title_smoke.mjs http://127.0.0.1:5201 /tmp/<빈 폴더>
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.argv[2]||'http://127.0.0.1:5201';
const out=process.argv[3]||'/tmp/title-smoke';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||'/opt/pw-browsers/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const key='stillness.title.notices.v1',results=[],errors=[],N=5;
const IGNORED=/deprecated parameters for the initialization function/;
const check=(name,data={})=>results.push({check:name,...data});
const watch=page=>{page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!IGNORED.test(m.text()))errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});};
const S='document.querySelector("#gameEntrance").shadowRoot';
const inRoot=(page,body,arg)=>page.evaluate(new Function('arg',`const root=${S};${body}`),arg);
const ready=page=>page.waitForFunction(()=>document.querySelector('#gameEntrance')?.shadowRoot.getElementById('entrance')?.dataset.phase==='ready',null,{timeout:20000});
const open=async(page)=>{await page.goto(`${base}/`,{waitUntil:'networkidle'});await page.locator('#noticeDialog').waitFor({state:'attached',timeout:30000});await page.evaluate(()=>document.fonts.ready);};
const shot=(page,name)=>page.screenshot({path:`${out}/${name}.png`});
// 공지 글자 값(창 제목 · 공지 제목 · 본문 · 날짜 줄 · 업데이트 수 · 숨김 글): 크기 · 줄 높이 · text-size-adjust — 두 길(처음 들어올 때 · 아래 줄 '공지사항')이 같아야 한다 (10/17)
const noticeType=page=>inRoot(page,`return ['#noticeHeading','.notice-entry h3','.notice-entry p','.notice-meta','.notice-count','.hide-read'].map(sel=>{const s=getComputedStyle(root.querySelector(sel));return [sel,s.fontSize,s.lineHeight,s.webkitTextSizeAdjust];});`);
// 돌려 달라는 안내(index.html #rotate): 보이나 · 화면 가운데를 누르면 안내가 받나 · 공지 창이 그려지나 (창은 showModal 맨 위 층이라 세로 폰에선 감춘다 — start_pixel.css)
const cover=page=>page.evaluate(()=>{const el=document.getElementById('rotate'),d=document.querySelector('#gameEntrance').shadowRoot.getElementById('noticeDialog');return {shown:getComputedStyle(el).display!=='none',top:el.contains(document.elementFromPoint(innerWidth/2,innerHeight/2)),dialog:d.open&&getComputedStyle(d).display!=='none'};});
async function newPage(opts){const ctx=await browser.newContext(opts);await ctx.route('https://*.supabase.co/**',r=>{errors.push('auth server called: '+r.request().url());r.abort();});const p=await ctx.newPage();watch(p);return p;}
async function readAll(page){
 for(let i=0;i<30;i++){
  const done=await page.locator('#noticeList').evaluate(el=>{el.scrollTop+=Math.max(30,el.clientHeight/2);return el.scrollTop+el.clientHeight>=el.scrollHeight-1;});
  await page.waitForTimeout(45);if(done)break;
 }
}
async function bounds(page){
 const b=await inRoot(page,`const d=root.getElementById('noticeDialog'),r=d.getBoundingClientRect(),c=root.getElementById('confirmNotices').getBoundingClientRect(),l=root.querySelector('.hide-read').getBoundingClientRect(),f=root.querySelector('.notice-footer').getBoundingClientRect(),list=root.getElementById('noticeList');
  return {dialog:[r.left,r.top,r.right,r.bottom],confirm:[c.left,c.top,c.right,c.bottom],hideRead:[l.left,l.top,l.right,l.bottom],footerHeight:f.height,viewport:[innerWidth,innerHeight],scroll:list.scrollHeight>list.clientHeight};`);
 const c=b.confirm,l=b.hideRead;
 assert.ok(Math.abs((c[1]+c[3])-(l[1]+l[3]))<2,'notice controls should share one row');
 assert.ok(l[2]+10<=c[0],'notice label and confirm must not overlap');
 assert.ok(c[2]-c[0]<=80&&c[3]-c[1]>=32,'compact confirm remains usable');
 assert.ok(b.footerHeight<=68,'notice footer should give space back to the list'); // 10/16 15:3x: 확인 = 싸움 주 단추 높이(42 · 낮은 화면 36 — 전 나무 단추 36) → 아래 칸 64 → 67
 return b;
}
async function titleLayout(page){
 await page.waitForFunction(()=>document.querySelector('#gameEntrance').shadowRoot.querySelector('.pixel-wordmark[data-painted="true"] canvas'),null,{timeout:20000});
 const layout=await inRoot(page,`
  const wordmark=selector=>{
   const el=root.querySelector(selector),canvas=el.querySelector('canvas'),rect=canvas.getBoundingClientRect();
   const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data,rows=[];
   for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]){rows.push(y);break;}
   return {text:el.textContent,inkHeight:(Math.max(...rows)-Math.min(...rows)+1)*rect.height/canvas.height,rendering:getComputedStyle(canvas).imageRendering,top:rect.top,bottom:rect.bottom};
  };
  const buttons=[...root.querySelectorAll('.start-actions button')].map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {text:el.textContent,label:el.getAttribute('aria-label'),width:r.width,height:r.height,left:r.left,right:r.right,top:r.top,bottom:r.bottom,background:s.backgroundColor,border:parseFloat(s.borderWidth),radius:s.borderRadius,shadow:s.boxShadow};});
  const footer=root.querySelector('.title-footer'),f=footer.getBoundingClientRect(),fb=[...footer.children].map(e=>{const r=e.getBoundingClientRect();return {text:e.textContent,right:r.right,bottom:r.bottom,width:r.width};});
  const group=[...root.querySelector('.title-group').children].filter(e=>!e.matches('.title-rule, .start-actions, #selectionStatus')).map(e=>e.textContent);
  return {english:wordmark('h1'),korean:root.querySelector('.title-korean')?.textContent??null,group,buttons,footer:{left:f.left,top:f.top,controls:fb},width:innerWidth,height:innerHeight};`);
 // 10/17 11:2x: 한글 제목 줄 없음 — 단추 위 제목은 픽셀 글자 Stillness 하나 (화면 안 · 단추 위)
 assert.equal(layout.korean,null);assert.deepEqual(layout.group,['Stillness']);
 assert.equal(layout.english.text,'Stillness');assert.match(layout.english.rendering,/pixelated|crisp-edges/);
 assert.ok(layout.english.inkHeight>24,JSON.stringify(layout));
 const compact=layout.width>layout.height&&layout.height<=500;
 const oldWidth=compact?250:layout.width<layout.height?Math.min(278,layout.width-72):278;
 assert.deepEqual(layout.buttons.map(b=>b.text),['Stage 1','이어하기']);assert.equal(layout.buttons[0].label,'Stage 1 — 첫 무대부터');
 // 10/16 15:3x 사장님 ② (docs/import/ui_unify_2026-10-16.md): 나무 판자 → 싸움 화면 단추 — Stage 1 = 주 단추(금색 · 테두리 없음) · 이어하기 = 부 단추(1 px 테두리 · 그림 위라 창 바탕) · 모서리 8 · 그림자 없음.
 //  높이 = 싸움 단추(주 42 · 부 40 / 낮은 화면 36 · 34 — ui_unify_smoke 가 싸움 화면과 맞대 봄) · 폭은 전 판자 폭 그대로(82 %)
 const [primary,secondary]=layout.buttons;
 assert.ok(layout.english.top>=0&&layout.english.bottom<=primary.top,JSON.stringify(layout));
 assert.deepEqual([primary.background,primary.border,secondary.background,secondary.border],['rgb(217, 164, 65)',0,'rgba(24, 18, 14, 0.88)',1]);
 assert.deepEqual([Math.round(primary.height),Math.round(secondary.height)],compact?[36,34]:[42,40],JSON.stringify(layout.buttons));
 for(const b of layout.buttons){
  assert.ok(Math.abs(b.width/oldWidth-.82)<.002,JSON.stringify(b));
  assert.equal(b.radius,'8px');assert.equal(b.shadow,'none');
  assert.ok(b.left>=0&&b.right<=layout.width&&b.top>0&&b.bottom<layout.height,JSON.stringify(b));
 }
 assert.deepEqual(layout.footer.controls.map(c=>c.text),['공지사항','설정','계정 연결']);
 assert.ok(layout.footer.controls.every(c=>c.right<=layout.width&&c.bottom<=layout.height),JSON.stringify(layout.footer));
 assert.ok(layout.footer.left<layout.width*.1&&layout.footer.top>layout.height*.8);
 return layout;
}
try{
 const page=await newPage({viewport:{width:1280,height:720}});
 await open(page);
 assert.equal(await page.locator('#noticeDialog').evaluate(d=>d.open),true);assert.equal(await page.locator('.notice-entry').count(),N);
 let b=await bounds(page);check(`first launch: ${N} notices in the dialog`,b);await shot(page,'notices-desktop');
 // 10/16 글자 정돈 (docs/import/lobby_fix_2026-10-16.md §1 — src/entrance_type.css): 싸움 화면 규칙 — 창 제목 17·700 · 이름 14·700 · 설명 12·400 보조 · 표지 12·600 강조 · 글꼴 줄 --font-ui(Cinzel 먼저)
 //  10/16 08:3x 사장님 '공지사항 안의 글씨 더 작게 해' (docs/import/ui_fix_2026-10-16.md §2): 공지 본문 · 날짜 줄만 한 단계 아래 10 (--fs-xs)
 //  10/16 14:0x '공지 제목도 글자 크기 내용과 같이 줄여. 색은 흰색으로 유지' (같은 문서 §11): 공지 제목도 10 · 흰색 · 700 그대로
 const typography=await inRoot(page,`return Object.fromEntries(['.notice-header h2','.notice-count','.notice-entry h3','.notice-entry p','.notice-meta','.unread','.hide-read','.confirm-button'].map(selector=>{const s=getComputedStyle(root.querySelector(selector));return [selector,{size:s.fontSize,color:s.color,weight:s.fontWeight,family:s.fontFamily.split(',')[0].replace(/['"]/g,'').trim(),wordBreak:s.wordBreak}];}));`);
 const pick=(t,...k)=>Object.fromEntries(k.map(x=>[x,t[x]]));
 assert.deepEqual(pick(typography['.notice-header h2'],'size','color','weight'),{size:'17px',color:'rgb(243, 233, 216)',weight:'700'});
 assert.deepEqual(pick(typography['.notice-entry h3'],'size','color','weight'),{size:'10px',color:'rgb(243, 233, 216)',weight:'700'});
 assert.deepEqual(pick(typography['.notice-entry p'],'size','color','weight'),{size:'10px',color:'rgb(184, 168, 142)',weight:'400'});
 assert.deepEqual(pick(typography['.notice-meta'],'size','color','weight'),{size:'10px',color:'rgb(184, 168, 142)',weight:'400'});
 assert.equal(typography['.notice-count'].size,'12px');assert.equal(typography['.hide-read'].size,'12px');
 assert.deepEqual(pick(typography['.unread'],'color','weight'),{color:'rgb(217, 164, 65)',weight:'600'});
 assert.equal(typography['.confirm-button'].weight,'700');
 assert.ok(Object.values(typography).every(t=>t.family==='Cinzel'&&t.wordBreak==='keep-all'),JSON.stringify(typography));
 assert.equal(new Set(Object.values(typography).map(s=>s.size)).size,4); // 17 · 14(확인 단추) · 12 + 공지 안 10(제목 · 본문 · 날짜)
 assert.equal(new Set(Object.values(typography).map(s=>s.color)).size,4); // 글자 색 셋(본문 · 보조 · 강조) + 확인 = 주 단추라 금색 위 글자(--c-on-accent — 10/16 15:3x)
 check('notices follow the battle HUD type rule (font stack Cinzel→Pretendard · sizes 12/14/17 + notice title/body/date one step down at 10 · title white 700 · weights 400/600/700 · three text colors · keep-all)',{typography});
 // 10/17: 아이폰 웹킷이 처음 들어올 때 공지의 제목·본문만 10 → 17 로 키우던 것 — 첫 화면 글자는 자동 키움을 끈다 (src/entrance_type.css :host)
 const firstType=await noticeType(page);assert.ok(firstType.every(t=>t[3]==='100%'),JSON.stringify(firstType));
 await page.evaluate(()=>localStorage.setItem('gladiator-settings','{"fpsCap":true,"prototype-sentinel":true}'));
 await page.locator('#hideRead').check();await page.locator('#confirmNotices').click();
 await page.waitForTimeout(850);await shot(page,'wind-transition-desktop');await ready(page);await shot(page,'title-desktop');
 const wm=await inRoot(page,`const el=root.querySelector('h1');return {fontReady:document.fonts.check('600 32px Cinzel','Stillness'),text:el.textContent,width:el.querySelector('canvas')?.width,rendering:getComputedStyle(el.querySelector('canvas')).imageRendering};`);
 assert.equal(wm.fontReady,true);assert.equal(wm.text,'Stillness');assert.ok(wm.width>100);assert.match(wm.rendering,/pixelated|crisp-edges/);
 const layout=await titleLayout(page);
 check('pixel Stillness wordmark only (no Korean title line), battle buttons (primary Stage 1 · secondary 이어하기 at the old plank width), bottom-left footer of three',{wm,layout});
 const state=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);assert.equal(state.hideRead,true);assert.ok(state.readIds.length>0&&state.readIds.length<=N);
 assert.equal(await page.evaluate(()=>localStorage.getItem('gladiator-settings')),'{"fpsCap":true,"prototype-sentinel":true}');check('notice reading preserves game settings');
 await page.reload({waitUntil:'networkidle'});
 const remaining=await page.locator('.notice-entry').evaluateAll(els=>els.map(el=>el.dataset.noticeId));
 if(state.readIds.length<N){assert.equal(remaining.length,N-state.readIds.length);assert.ok(remaining.every(id=>!state.readIds.includes(id)));await readAll(page);await page.locator('#confirmNotices').click();}
 await ready(page);check('hide-read preference persists; offscreen notices remain unread',{read:state.readIds,remaining});
 await page.reload({waitUntil:'networkidle'});await ready(page);assert.equal(await page.locator('#noticeDialog').evaluate(d=>d.open),false);check('all read: next launch goes straight to title');
 // 아래 줄에서 연 공지: 확인 = 창만 닫음 — 첫 화면 넘어감(phase notice → wind → ready)을 다시 틀지 않는다 (사장님 10/16 08:3x)
 await inRoot(page,`window.__phases=[];new MutationObserver(()=>window.__phases.push(root.getElementById('entrance').dataset.phase)).observe(root.getElementById('entrance'),{attributes:true,attributeFilter:['data-phase']});`);
 await page.locator('#openNotices').click();assert.equal(await page.locator('.notice-entry').count(),N);assert.deepEqual(await noticeType(page),firstType);check('footer notices use the same notice text values as the first-launch notices (size · line height · text-size-adjust 100%)');await page.locator('#hideRead').uncheck();await page.locator('#confirmNotices').click();await ready(page);
 await page.waitForTimeout(400);assert.equal(await page.locator('#noticeDialog').evaluate(d=>d.open),false);assert.deepEqual(await page.evaluate(()=>window.__phases),[]);
 assert.equal(await inRoot(page,`return root.getElementById('titleScreen').inert`),false);check('footer notices: 확인 only closes the dialog (no title intro replay — phase stays ready)');
await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('.notice-entry').count(),N);check('reopen notices and turn hiding off');
 await page.evaluate(k=>localStorage.setItem(k,'{bad json'),key);await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('.notice-entry').count(),N);check('invalid saved preference recovers');
 for(const [name,W,H] of [['phone-landscape',844,390],['phone-portrait',390,844],['small-landscape',568,320],['small-portrait',320,568]]){
  const mobile=await newPage({viewport:{width:W,height:H},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await open(mobile);
  // 세로 폰: 공지(처음 들어온 사람)를 돌려 달라는 안내가 덮는다 — 창도 안 그린다. 가로로 돌리면(폭·높이 바꿈) 공지 그대로 → 아래 점검은 가로에서
  const portrait=H>W,[width,height]=portrait?[H,W]:[W,H];
  if(portrait){await mobile.waitForTimeout(300);assert.deepEqual(await cover(mobile),{shown:true,top:false,dialog:false});await mobile.setViewportSize({width,height});} // top: 창이 열린 동안엔 창 밖이 모두 inert 라 누름이 아무 데도 안 간다
  assert.deepEqual(await cover(mobile),{shown:false,top:false,dialog:true});
  b=await bounds(mobile);
  assert.ok(b.dialog[0]>=0&&b.dialog[1]>=0&&b.dialog[2]<=width&&b.dialog[3]<=height,JSON.stringify(b));assert.ok(b.confirm[3]<=height);assert.equal(b.scroll,true);
  await mobile.locator('#confirmNotices').click();await ready(mobile);
  const t=await mobile.locator('h1.pixel-wordmark').boundingBox();assert.ok(t.x>=0&&t.x+t.width<=width+1,JSON.stringify(t));
  assert.equal(await mobile.locator('#continueJourney').isVisible(),true);
  const l=await titleLayout(mobile);
  // 첫 화면도 세로면 안내가 덮고 누름을 받는다 (창 없음 — 가운데를 누르면 안내)
  if(portrait){await mobile.setViewportSize({width:W,height:H});assert.deepEqual(await cover(mobile),{shown:true,top:true,dialog:false});}
  check(`${name}: ${portrait?'rotate screen covers notices and title in portrait; turned to landscape — ':''}dialog, scrolling and title fit`,{width,height,...b,layout:l});await mobile.context().close();
 }
 // PC 는 그대로: 세로로 좁은 창(터치 없음)이어도 안내 없이 공지 · 첫 화면
 {const narrow=await newPage({viewport:{width:390,height:844}});await open(narrow);assert.deepEqual(await cover(narrow),{shown:false,top:false,dialog:true});await narrow.locator('#confirmNotices').click();await ready(narrow);check('desktop portrait-shaped window (no touch): no rotate screen');await narrow.context().close();}
 const reduced=await newPage({viewport:{width:844,height:390},reducedMotion:'reduce'});await open(reduced);await reduced.locator('#confirmNotices').click();await ready(reduced);
 // 10/16 15:3x: 나타나기는 첫 화면 칸이 아니라 제목 글자 · 단추 · 아래 줄 저마다 (글자 = steps(7) · 단추 = 매끈) — 움직임 줄이기면 모두 바로
 assert.deepEqual(await inRoot(reduced,`return ['#titleScreen','.pixel-wordmark','.title-rule','.start-actions','.title-footer'].map(s=>getComputedStyle(root.querySelector(s)).transitionDuration)`),Array(5).fill('0s'));check('reduced motion: immediate static title');
 const denied=await browser.newContext();await denied.route('https://*.supabase.co/**',r=>r.abort());const dp=await denied.newPage();watch(dp);await dp.addInitScript(()=>{Storage.prototype.getItem=()=>{throw new DOMException('denied','SecurityError');};Storage.prototype.setItem=()=>{throw new DOMException('denied','SecurityError');};});await open(dp);await dp.locator('#hideRead').check();await dp.locator('#confirmNotices').click();await ready(dp);check('storage denied: screen remains usable');
 assert.deepEqual(errors,[]);
}finally{fs.writeFileSync(`${out}/results.json`,JSON.stringify({results,errors},null,2));await browser.close();}
console.log(`PASS ${results.length} title-screen checks; errors ${errors.length}`);
