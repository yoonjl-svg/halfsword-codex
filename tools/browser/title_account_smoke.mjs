// Real SDK and UI with intercepted Auth responses; never sends a real email.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const out=process.argv[3]||'/tmp/title-account',base=process.argv[2]||'http://127.0.0.1:4173';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const results=[],errors=[],key='stillness-account:v1:halfsword-codex:auth';
const user={id:'00000000-0000-4000-8000-000000000001',aud:'authenticated',role:'authenticated',email:'traveler.test@example.com',email_confirmed_at:'2026-10-15T00:00:00Z',is_anonymous:false,app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:'2026-10-15T00:00:00Z'};
const token=u=>[Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),Buffer.from(JSON.stringify({sub:u.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated',is_anonymous:!!u.is_anonymous})).toString('base64url'),'test-only-signature'].join('.');
const session=u=>({access_token:token(u),refresh_token:'test-only-refresh',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:u});
async function start(context){const p=await context.newPage();p.on('pageerror',e=>errors.push(String(e)));await p.goto(base+'/',{waitUntil:'networkidle'});await p.waitForFunction(()=>window.game?.player);if(await p.locator('#noticeDialog').evaluate(d=>d.open))await p.locator('#confirmNotices').click();await p.locator('#openAccount').waitFor({state:'visible'});return p;}
try{
 const c=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 const calls=[];let failVerify=true,active=user;
 await c.route('https://*.supabase.co/auth/v1/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname,body=req.postDataJSON();calls.push({path,method:req.method(),type:body?.type,create:body?.create_user});
  let data={},status=200;
  if(path.endsWith('/verify')){if(failVerify){status=403;data={error_code:'otp_expired',msg:'Token has expired or is invalid'};}else data=session(active);}
  else if(path.endsWith('/user'))data=active;
  else if(path.endsWith('/token'))data=session(active);
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 });
 let p=await start(c);assert.equal(await p.locator('#openAccount').textContent(),'계정 연결');assert.equal(await p.locator('#openSettings,#settingsDialog').count(),0);assert.equal(calls.length,0);
 await p.screenshot({path:`${out}/title-phone.png`});await p.locator('#openAccount').tap();await p.screenshot({path:`${out}/account-open.png`});
 await p.locator('#accountEmail').fill(user.email);await p.locator('#accountSend').tap();await p.locator('#accountCode').waitFor({state:'visible'});
 assert.equal(calls.filter(x=>x.path.endsWith('/otp')).length,1);assert.equal(calls.find(x=>x.path.endsWith('/otp')).create,true);assert.equal(await p.locator('#accountResend').isDisabled(),true);assert.equal(await p.locator('#openAccount').textContent(),'계정 연결');
 await p.locator('#accountCode').fill('111111');await p.locator('#accountVerify').tap();await p.waitForFunction(()=>document.querySelector('#gameEntrance').shadowRoot.getElementById('accountStatus').textContent.includes('인증번호를 확인'));
 assert.equal(await p.locator('#openAccount').textContent(),'계정 연결');failVerify=false;
 await p.locator('#accountCode').fill('123456');await p.locator('#accountVerify').tap();await p.waitForFunction(()=>document.querySelector('#gameEntrance').shadowRoot.getElementById('openAccount').textContent==='traveler.test');
 await p.locator('#closeAccount').tap();await p.screenshot({path:`${out}/account-linked-mock.png`});results.push('OTP request, cooldown, invalid code and successful verification via mocked Auth; only verified local-part shown');
 await p.reload({waitUntil:'networkidle'});await p.locator('#confirmNotices').click();assert.equal(await p.locator('#openAccount').textContent(),'traveler.test');await p.locator('#newJourney').tap();await p.locator('#lobbyBack').tap();await p.locator('#confirmNotices').click();assert.equal(await p.locator('#openAccount').textContent(),'traveler.test');
 await p.locator('#openAccount').tap();await p.locator('#accountLogout').tap();await p.waitForFunction(()=>document.querySelector('#gameEntrance').shadowRoot.getElementById('openAccount').textContent==='계정 연결');await p.locator('#closeAccount').tap();
 assert.ok(calls.some(x=>x.path.endsWith('/logout')));results.push('refresh/back navigation retain linked identity; local sign-out resets label');await c.close();
 for(const [name,width,height] of [['desktop',1440,900],['portrait',390,844],['small',320,568]]){
  const ctx=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),q=await start(ctx);await q.locator('#openAccount').click();
  const r=await q.locator('#accountDialog').boundingBox();assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=width&&r.y+r.height<=height);
  await q.keyboard.press('Escape');assert.equal(await q.locator('#accountDialog').evaluate(d=>d.open),false);await q.locator('#newJourney').click();await q.locator('#lobbyDepart').click();await q.waitForFunction(()=>game.state==='draw');results.push(`${name}: dialog fits, Escape closes, journey proceeds`);await ctx.close();
 }
 const legacy=await browser.newContext({viewport:{width:844,height:390},reducedMotion:'reduce'});
 await legacy.addInitScript(({s})=>localStorage.setItem('stillness-account:v1:halfsword-codex-growth-trial:auth',JSON.stringify(s)),{s:session(user)});
 await legacy.route('https://*.supabase.co/auth/v1/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(user)}));
 const l=await start(legacy);assert.equal(await l.locator('#openAccount').textContent(),'traveler.test');results.push('pre-refork growth account storage recognized');await legacy.close();
 const guest=await browser.newContext({viewport:{width:844,height:390},reducedMotion:'reduce'}),anonymous={...user,email:'',email_confirmed_at:null,is_anonymous:true};
 await guest.addInitScript(({key,s})=>localStorage.setItem(key,JSON.stringify(s)),{key,s:session(anonymous)});const gcalls=[];
 await guest.route('https://*.supabase.co/auth/v1/**',async route=>{const req=route.request(),path=new URL(req.url()).pathname;gcalls.push({path,method:req.method(),type:req.postDataJSON()?.type});await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(path.endsWith('/verify')?session(user):anonymous)});});
 const g=await start(guest);assert.equal(await g.locator('#openAccount').textContent(),'계정 연결');await g.locator('#openAccount').click();await g.locator('#accountEmail').fill(user.email);await g.locator('#accountSend').click();await g.locator('#accountCode').fill('123456');await g.locator('#accountVerify').click();await g.waitForFunction(()=>document.querySelector('#gameEntrance').shadowRoot.getElementById('openAccount').textContent==='traveler.test');assert.ok(gcalls.some(x=>x.method==='PUT'&&x.path.endsWith('/user')));assert.ok(gcalls.some(x=>x.type==='email_change'));results.push('existing anonymous account links through updateUser/email_change; verified UID retained');await guest.close();
 const existing=await browser.newContext({viewport:{width:844,height:390},reducedMotion:'reduce'});let createFlag;
 await existing.route('https://*.supabase.co/auth/v1/**',async route=>{const path=new URL(route.request().url()).pathname;if(path.endsWith('/otp'))createFlag=route.request().postDataJSON().create_user;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(path.endsWith('/verify')?session(user):{})});});
 const e=await start(existing);await e.locator('#openAccount').click();await e.locator('#accountMode').click();await e.locator('#accountEmail').fill(user.email);await e.locator('#accountSend').click();await e.locator('#accountCode').waitFor({state:'visible'});assert.equal(createFlag,false);await e.locator('#accountCode').fill('123456');await e.locator('#accountVerify').click();await e.waitForFunction(()=>document.querySelector('#gameEntrance').shadowRoot.getElementById('openAccount').textContent==='traveler.test');results.push('existing-account login disables new-user creation and verifies email OTP');await existing.close();
 const failed=await browser.newContext({viewport:{width:844,height:390},reducedMotion:'reduce'});
 await failed.route('https://*.supabase.co/auth/v1/**',route=>route.fulfill({status:429,contentType:'application/json',body:JSON.stringify({error_code:'over_email_send_rate_limit',msg:'Email rate limit exceeded'})}));
 const f=await start(failed);await f.locator('#openAccount').click();await f.locator('#accountEmail').fill(user.email);await f.locator('#accountSend').click();await f.waitForFunction(()=>document.querySelector('#gameEntrance').shadowRoot.getElementById('accountStatus').textContent.includes('요청이 많습니다'));assert.equal(await f.locator('#openAccount').textContent(),'계정 연결');assert.equal(await f.locator('#accountEmailForm').isVisible(),true);await f.locator('#closeAccount').click();await f.locator('#newJourney').click();await f.locator('#lobbyDepart').click();await f.waitForFunction(()=>game.state==='draw');results.push('mail rate-limit failure leaves account unlinked and game playable');await failed.close();
 assert.deepEqual(errors,[]);
}finally{fs.writeFileSync(`${out}/checks.json`,JSON.stringify({results,errors,auth:'mocked provider responses; no live email sent'},null,2));await browser.close();}
console.log(`PASS ${results.length} account/UI checks; errors ${errors.length}`);
