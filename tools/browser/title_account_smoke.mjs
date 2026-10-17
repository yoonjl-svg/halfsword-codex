// 첫 화면 계정 연결 점검 (샛별 저장소 title_account_smoke.mjs 를 우리 판에 맞춤 — docs/import/lobby_port_2026-10-16.md §4 · §6)
//  실제 SDK·화면을 돌리되 인증 서버 응답은 모두 가짜(Playwright route) — 이 상자에서는 인증 서버에 닿지 않고, 메일도 보내지 않는다.
//  우리 판 규칙: 메일 6자리 번호만(redirect_to 없음 · 주소의 로그인 정보 안 읽음) · email_change(익명 잇기) 없음 · 저장 열쇠 stillness-account:v1:auth
//  npm run build && npx vite preview --port 5201 →  node tools/browser/title_account_smoke.mjs http://127.0.0.1:5201 /tmp/<빈 폴더>
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { departTitle, titleToLobby } from './to_lobby.mjs';
const base=process.argv[2]||'http://127.0.0.1:5201',out=process.argv[3]||'/tmp/title-account';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||'/opt/pw-browsers/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const results=[],errors=[],key='stillness-account:v1:auth';
const IGNORED=/deprecated parameters for the initialization function/;
const user={id:'00000000-0000-4000-8000-000000000001',aud:'authenticated',role:'authenticated',email:'traveler.test@example.com',email_confirmed_at:'2026-10-15T00:00:00Z',is_anonymous:false,app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:'2026-10-15T00:00:00Z'};
const token=u=>[Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),Buffer.from(JSON.stringify({sub:u.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated',is_anonymous:!!u.is_anonymous})).toString('base64url'),'test-only-signature'].join('.');
const session=u=>({access_token:token(u),refresh_token:'test-only-refresh',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:u});
const sr=(p,fn)=>p.evaluate(fn);
async function start(context,path='/'){
 // 가짜 인증 서버가 일부러 돌려준 403(틀린 번호)·429(메일 한도)는 브라우저가 'Failed to load resource' 로 적는다 — 그 자리(인증 주소)의 줄만 뺀다
 const p=await context.newPage();p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error'&&!IGNORED.test(m.text())&&!/\.supabase\.co\//.test(m.location()?.url||''))errors.push(m.text());});
 await p.goto(base+path,{waitUntil:'networkidle'});await p.waitForFunction(()=>window.game?.player,null,{timeout:60000});
 if(await p.locator('#noticeDialog').evaluate(d=>d.open))await p.locator('#confirmNotices').click();
 await p.waitForFunction(()=>!document.querySelector('#gameEntrance').shadowRoot.getElementById('openAccount').disabled,null,{timeout:20000});
 return p;
}
const label=p=>p.locator('#openAccount').textContent();
try{
 // 1. 새 계정: 번호 받기 → 틀린 번호 → 맞는 번호 → 연결 · 새로 열기 · 대기실 왕복(Stage 1 → 싸움 → 정지 → 대기실 → 첫 화면 — 10/17) · 로그아웃
 const c=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 const calls=[];let failVerify=true,active=user;
 await c.route('https://*.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname,body=req.postDataJSON();calls.push({path,method:req.method(),query:url.search,type:body?.type,create:body?.create_user,body});
  if(!path.startsWith('/auth/v1/')){errors.push('unexpected request '+req.url());return route.abort();}
  let data={},status=200;
  if(path.endsWith('/verify')){if(failVerify){status=403;data={error_code:'otp_expired',msg:'Token has expired or is invalid'};}else data=session(active);}
  else if(path.endsWith('/user'))data=active;
  else if(path.endsWith('/token'))data=session(active);
  await route.fulfill({status,contentType:'application/json',headers:{'x-supabase-api-version':'2024-01-01'},body:JSON.stringify(data)});
 });
 let p=await start(c);assert.equal(await label(p),'계정 연결');assert.equal(calls.length,0);
 assert.deepEqual(await p.locator('.title-footer button').evaluateAll(els=>els.map(e=>e.textContent)),['공지사항','설정','계정 연결']);
 await p.locator('#openAccount').tap();
 assert.match(await p.locator('#accountIntro').textContent(),/6자리 인증번호/);
 await p.locator('#accountEmail').fill(user.email);await p.locator('#accountSend').tap();await p.locator('#accountCode').waitFor({state:'visible'});
 const otp=calls.filter(x=>x.path.endsWith('/otp'));assert.equal(otp.length,1);assert.equal(otp[0].create,true);assert.equal(otp[0].method,'POST');
 assert.ok(!/redirect_to/.test(otp[0].query),'no email link redirect: '+otp[0].query);assert.equal(otp[0].body.email,user.email);
 assert.equal(await p.locator('#accountCodeHelp').textContent(),`${user.email}로 보낸 메일의 6자리 인증번호를 입력하세요.`);
 assert.equal(await p.locator('#accountStatus').textContent(),'메일을 확인해 주세요. 메일이 보이지 않으면 스팸함도 확인해 주세요.');
 assert.equal(await p.locator('#accountResend').isDisabled(),true);assert.equal(await label(p),'계정 연결');
 // 10/16 (docs/import/lobby_fix_2026-10-16.md §4): 폰 가로 번호 단계가 창 안에서 스크롤되지 않는다 — 안내 · 칸 · 단추 · 알림 · 맨 아래 '여정 기록…' 줄까지 한 화면, 초점 테두리가 칸 이름을 안 덮음
 await p.locator('#accountCode').focus();
 const fit=await p.locator('#accountDialog').evaluate(d=>{const c=d.querySelector('.account-content'),note=d.querySelector('.account-note').getBoundingClientRect(),dr=d.getBoundingClientRect(),cr=c.getBoundingClientRect(),input=d.querySelector('#accountCode'),s=getComputedStyle(input),lab=d.querySelector('label[for=accountCode]').getBoundingClientRect(),ir=input.getBoundingClientRect();return {dialog:[d.scrollHeight,d.clientHeight],content:[c.scrollHeight,c.clientHeight],noteInside:note.bottom<=cr.bottom+.5&&note.bottom<=dr.bottom,outlineGap:ir.top-(parseFloat(s.outlineOffset)+parseFloat(s.outlineWidth))-lab.bottom};});
 assert.ok(fit.dialog[0]<=fit.dialog[1]+1&&fit.content[0]<=fit.content[1]+1&&fit.noteInside,JSON.stringify(fit));assert.ok(fit.outlineGap>=0,JSON.stringify(fit));results.push('phone landscape code step fits without inner scroll (note line visible) and the focus outline clears the label');
 await p.locator('#accountCode').fill('111111');await p.locator('#accountVerify').tap();await p.waitForFunction(()=>document.querySelector('#gameEntrance').shadowRoot.getElementById('accountStatus').textContent.includes('인증번호를 확인'));
 assert.equal(await label(p),'계정 연결');failVerify=false;
 await p.locator('#accountCode').fill('123456');await p.locator('#accountVerify').tap();await p.waitForFunction(()=>document.querySelector('#gameEntrance').shadowRoot.getElementById('openAccount').textContent==='traveler.test');
 const verify=calls.filter(x=>x.path.endsWith('/verify'));assert.ok(verify.every(x=>x.type==='email'&&x.body.email===user.email),JSON.stringify(verify));
 assert.ok(!calls.some(x=>x.type==='email_change'||(x.method==='PUT'&&x.path.endsWith('/user'))),'no anonymous email_change branch');
 assert.match(await p.locator('#accountStatus').textContent(),/계정이 연결되었습니다/);
 await p.locator('#closeAccount').tap();
 const stored=await p.evaluate(()=>Object.keys(localStorage).filter(k=>k.includes('account')||k.startsWith('sb-')));assert.deepEqual(stored,[key]);
 results.push('OTP request without redirect link, 6-digit text with spam-folder hint, cooldown, invalid code and email verification via mocked Auth; only verified local-part shown; one storage key');
 await p.reload({waitUntil:'networkidle'});await p.locator('#confirmNotices').click();await p.waitForFunction(()=>document.querySelector('#gameEntrance').shadowRoot.getElementById('openAccount').textContent==='traveler.test',null,{timeout:20000});
 await titleToLobby(p,'#newJourney','tap');await p.locator('#lobbyBack').tap();await p.locator('#confirmNotices').click();await p.waitForFunction(()=>document.querySelector('#gameEntrance').shadowRoot.getElementById('openAccount').textContent==='traveler.test',null,{timeout:20000});
 await p.locator('#openAccount').tap();await p.locator('#accountLogout').tap();await p.waitForFunction(()=>document.querySelector('#gameEntrance').shadowRoot.getElementById('openAccount').textContent==='계정 연결');await p.locator('#closeAccount').tap();
 assert.ok(calls.some(x=>x.path.endsWith('/logout')));results.push('refresh and Stage 1 → battle → pause → 대기실 → 첫 화면 retain linked identity; local sign-out resets label');await c.close();
 // 2. 화면 크기: 창이 화면 안 · Esc 로 닫힘 · 여정 그대로
 for(const [name,width,height] of [['desktop',1280,720],['portrait',390,844],['small',320,568]]){
  const ctx=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});await ctx.route('https://*.supabase.co/**',r=>{errors.push('auth server called (no session): '+r.request().url());r.abort();});
  const q=await start(ctx);await q.locator('#openAccount').click();
  const r=await q.locator('#accountDialog').boundingBox();assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=width&&r.y+r.height<=height);
  const foot=await q.locator('.title-footer button').evaluateAll(els=>els.map(e=>e.getBoundingClientRect().right));assert.ok(foot.every(x=>x<=width));
  await q.keyboard.press('Escape');assert.equal(await q.locator('#accountDialog').evaluate(d=>d.open),false);assert.equal(await departTitle(q),'draw');results.push(`${name}: dialog fits, Escape closes, Stage 1 goes straight to the journey; no auth request without a saved login`);await ctx.close();
 }
 // 3. 기존 계정 로그인: 새 사용자 만들기 끔
 const existing=await browser.newContext({viewport:{width:844,height:390},reducedMotion:'reduce'});let createFlag,otpQuery;
 await existing.route('https://*.supabase.co/**',async route=>{const u=new URL(route.request().url());if(u.pathname.endsWith('/otp')){createFlag=route.request().postDataJSON().create_user;otpQuery=u.search;}await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(u.pathname.endsWith('/verify')?session(user):{})});});
 const e=await start(existing);await e.locator('#openAccount').click();await e.locator('#accountMode').click();
 assert.match(await e.locator('#accountIntro').textContent(),/기존 계정의 이메일로 6자리 인증번호를 받으세요/);
 await e.locator('#accountEmail').fill(user.email);await e.locator('#accountSend').click();await e.locator('#accountCode').waitFor({state:'visible'});assert.equal(createFlag,false);assert.ok(!/redirect_to/.test(otpQuery));
 await e.locator('#accountCode').fill('123456');await e.locator('#accountVerify').click();await e.waitForFunction(()=>document.querySelector('#gameEntrance').shadowRoot.getElementById('openAccount').textContent==='traveler.test');results.push('existing-account login disables new-user creation and verifies email OTP');await existing.close();
 // 4. 메일 한도 실패: 연결 안 됨 · 게임은 그대로
 const failed=await browser.newContext({viewport:{width:844,height:390},reducedMotion:'reduce'});
 await failed.route('https://*.supabase.co/**',route=>route.fulfill({status:429,contentType:'application/json',body:JSON.stringify({error_code:'over_email_send_rate_limit',msg:'Email rate limit exceeded'})}));
 const f=await start(failed);await f.locator('#openAccount').click();await f.locator('#accountEmail').fill(user.email);await f.locator('#accountSend').click();await f.waitForFunction(()=>document.querySelector('#gameEntrance').shadowRoot.getElementById('accountStatus').textContent.includes('요청이 많습니다'));assert.equal(await label(f),'계정 연결');assert.equal(await f.locator('#accountEmailForm').isVisible(),true);await f.locator('#closeAccount').click();assert.equal(await departTitle(f),'draw');results.push('mail rate-limit failure leaves account unlinked and game playable (Stage 1 → card draw)');await failed.close();
 // 5. 메일 링크 꼴(#access_token=…)로 들어와도 로그인하지 않는다 (detectSessionInUrl: false) · 다른 판의 저장 열쇠도 읽지 않는다
 const link=await browser.newContext({viewport:{width:844,height:390},reducedMotion:'reduce'});const lcalls=[];
 await link.addInitScript(({s})=>{localStorage.setItem('stillness-account:v1:other-build:auth',JSON.stringify(s));localStorage.setItem('sb-xrdxiyhhvdqiyklevgap-auth-token',JSON.stringify(s));},{s:session(user)});
 await link.route('https://*.supabase.co/**',async route=>{lcalls.push(new URL(route.request().url()).pathname);await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(user)});});
 const l=await start(link,`/#access_token=${token(user)}&expires_in=3600&refresh_token=x&token_type=bearer&type=magiclink`);
 await l.waitForTimeout(800);assert.equal(await label(l),'계정 연결');assert.deepEqual(lcalls,[]);
 assert.equal(await l.evaluate(k=>localStorage.getItem(k),key),null);
 results.push('email-link style URL hash and other-build storage keys are ignored: no login, no auth request');await link.close();
 assert.deepEqual(errors,[]);
}finally{fs.writeFileSync(`${out}/checks.json`,JSON.stringify({results,errors,auth:'mocked provider responses; no live email sent'},null,2));await browser.close();}
console.log(`PASS ${results.length} account/UI checks; errors ${errors.length}`);
