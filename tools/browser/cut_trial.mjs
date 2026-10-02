// Actual mobile UI/input smoke check. AI is disabled only while isolating input.
// This does not measure actual cutting, natural movement, or device performance.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const base=new URL(process.env.HALFSWORD_TEST_URL||process.argv[2]||'http://127.0.0.1:4175/');
if(!base.pathname.endsWith('/'))base.pathname+='/';
base.search='';base.hash='';
const tag=process.env.HALFSWORD_EVIDENCE_TAG||(base.protocol==='https:'?'public':'local');
if(!/^[a-zA-Z0-9_-]+$/.test(tag))throw Error('Use a plain evidence tag');
const evidence=process.env.HALFSWORD_EVIDENCE_DIR || '/tmp/halfsword-cut-evidence';
await mkdir(evidence,{recursive:true});
const portrait={width:390,height:844},landscape={width:844,height:390};
const launch={executablePath:process.env.PW_CHROMIUM || '/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']};
if(base.protocol==='https:'){
  const proxy=process.env.HTTPS_PROXY||process.env.HTTP_PROXY;
  if(!proxy)throw Error('HTTPS verification requires the configured session proxy');
  const p=new URL(proxy);launch.proxy={server:`${p.protocol}//${p.host}`};
}
// TLS verification remains enabled: no ignoreHTTPSErrors or certificate switches.
const browser=await chromium.launch(launch),rows=[],errors=[],httpFailures=[],requestFailures=[];
const observe=(page,id)=>{
  page.on('pageerror',e=>errors.push({id,type:'pageerror',message:String(e)}));
  page.on('console',m=>{if(m.type()==='error')errors.push({id,type:'console',message:m.text()})});
  page.on('response',r=>{if(r.status()>=400)httpFailures.push({id,url:r.url(),status:r.status()})});
  page.on('requestfailed',r=>requestFailures.push({id,url:r.url(),error:r.failure()?.errorText}));
};
const snapshot=page=>page.evaluate(()=>{
  const g=window.game,f=g.player;
  const node=document.querySelector('#cutTrialInfo');
  return {url:location.href,state:g.state,simTime:g.stats.simTime,cutReactionModel:g.combat.cutReactionModel,
    weapon:f.weapon.id,foeWeapon:g.enemy.weapon.id,probe:g.supportProbe,gripReaction:g.config.GRIP.reactionModel,
    supportModel:g.config.BODY.supportModel,physicalTrial:g.physicalTrial,
    held:f.handHeld,hand:{x:f.handOffset.x,y:f.handOffset.y},move:{x:f.move.x,y:f.move.y},
    info:{present:!!node,text:node?.textContent||'',visible:!!node&&!!node.getClientRects().length&&getComputedStyle(node).display!=='none'},
    finite:[...Object.values(f.bodies),f.sword,...Object.values(g.enemy.bodies),g.enemy.sword].every(b=>
      [b.translation(),b.rotation(),b.linvel(),b.angvel()].every(v=>Object.values(v).every(Number.isFinite)))};
});
const layout=page=>page.evaluate(()=>{
  const root=document.documentElement,card=document.querySelector('#menu .card'),rotate=document.querySelector('#rotate');
  const r=card?.getBoundingClientRect();
  return {width:innerWidth,height:innerHeight,scrollWidth:root.scrollWidth,bodyScrollWidth:document.body.scrollWidth,
    horizontalOverflow:Math.max(root.scrollWidth,document.body.scrollWidth)>innerWidth+1,
    card:r?{left:r.left,right:r.right,top:r.top,bottom:r.bottom,scrollHeight:card.scrollHeight,clientHeight:card.clientHeight}:null,
    rotateVisible:!!rotate&&getComputedStyle(rotate).display!=='none',rotateText:rotate?.textContent||''};
});
const advance=async(page,seconds=.35)=>{
  const start=await page.evaluate(()=>game.stats.simTime);
  await page.waitForFunction(({start,seconds})=>game.stats.simTime>=start+seconds,{start,seconds},{timeout:60000});
  return {start,end:await page.evaluate(()=>game.stats.simTime),requiredSeconds:seconds};
};
function assertTrial(s,model){
  assert.equal(s.cutReactionModel,model);
  assert.equal(s.weapon,'zweihander');assert.equal(s.foeWeapon,'longsword');
  assert.equal(s.gripReaction,'paired');assert.equal(s.supportModel,'legacy');
  assert.equal(s.probe.assist,.3);assert.equal(s.probe.catchMode,'on');assert.equal(s.probe.catchScale,1);
  assert.ok(s.finite);
}
async function picture(page,name){const path=join(evidence,`cut-trial-${tag}-${name}.png`);await page.screenshot({path});return path;}
async function isolateInput(page){await page.evaluate(()=>{game.ai.update=()=>{}});}

try{
  for(const initialOrientation of ['portrait','landscape'])for(const [id,model]of [['playCutLegacy','legacy'],['playCutBudgeted','budgeted']]){
    const ctx=await browser.newContext({viewport:initialOrientation==='portrait'?portrait:landscape,isMobile:true,hasTouch:true});
    const page=await ctx.newPage(),row={id,model,initialOrientation,aiDisabledOnlyForInput:true};observe(page,`${initialOrientation}-${id}`);
    try{
      await page.goto(new URL('feature-lab.html',base).href,{waitUntil:'networkidle'});
      row.landingLayout=await layout(page);assert.ok(!row.landingLayout.horizontalOverflow);
      row.links=await page.evaluate(()=>Object.fromEntries(['playCutLegacy','playCutBudgeted'].map(id=>{
        const a=document.getElementById(id);return[id,a?{href:a.href,text:a.textContent}:null];
      })));
      assert.ok(row.links.playCutLegacy&&row.links.playCutBudgeted);
      const legacyUrl=new URL(row.links.playCutLegacy.href),budgetedUrl=new URL(row.links.playCutBudgeted.href);
      assert.equal(legacyUrl.origin,base.origin);assert.equal(budgetedUrl.origin,base.origin);
      assert.equal(budgetedUrl.searchParams.get('cutTrial'),'budgeted');
      assert.ok(!legacyUrl.searchParams.has('cutTrial')||legacyUrl.searchParams.get('cutTrial')==='legacy');
      for(const url of [legacyUrl,budgetedUrl]){
        assert.equal(url.searchParams.get('weapon'),'zweihander');assert.equal(url.searchParams.get('foeWeapon'),'longsword');
        assert.equal(url.searchParams.get('supportProbe'),'1');assert.equal(url.searchParams.get('assist'),'0.3');
        assert.equal(url.searchParams.get('catch'),'on');assert.equal(url.searchParams.get('catchScale'),'1');
        assert.ok(!url.searchParams.has('physicsTrial'));
      }
      legacyUrl.searchParams.delete('cutTrial');budgetedUrl.searchParams.delete('cutTrial');
      assert.equal(legacyUrl.href,budgetedUrl.href,'Comparison links must differ only in cutTrial');
      const link=page.locator(`#${id}`);await link.scrollIntoViewIfNeeded();
      row.landingScreenshot=await picture(page,`${initialOrientation}-${id}-link`);
      await Promise.all([page.waitForURL(row.links[id].href),link.tap()]);
      await page.waitForFunction(()=>window.game?.player?.sword&&window.game?.combat);
      row.menu=await snapshot(page);assertTrial(row.menu,model);
      if(model==='budgeted')assert.ok(row.menu.info.present&&row.menu.info.visible&&row.menu.info.text.trim());
      row.initialMenuLayout=await layout(page);assert.ok(!row.initialMenuLayout.horizontalOverflow);
      row.menuScreenshot=await picture(page,`${initialOrientation}-${id}-menu`);
      // Portrait gameplay is intentionally covered by the existing rotate guidance.
      // Verify that UI, then rotate to landscape for actual canvas touch input.
      if(initialOrientation==='portrait')await page.setViewportSize(landscape);
      await page.locator('#btnStart').tap();await page.waitForFunction(()=>game.state==='fight');
      await isolateInput(page);row.initialAdvance=await advance(page,.6);row.before=await snapshot(page);assertTrial(row.before,model);
      row.landscapeLayout=await layout(page);assert.ok(!row.landscapeLayout.horizontalOverflow);assert.ok(!row.landscapeLayout.rotateVisible);
      if(initialOrientation==='portrait'){
        await page.setViewportSize(portrait);row.fightPortraitLayout=await layout(page);
        assert.ok(!row.fightPortraitLayout.horizontalOverflow);assert.ok(row.fightPortraitLayout.rotateVisible);
        row.rotateScreenshot=await picture(page,`${initialOrientation}-${id}-rotate`);
        await page.setViewportSize(landscape);
      }
      const cdp=await ctx.newCDPSession(page),point=(x,y)=>({x,y,id:1});
      const touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
      await touch('touchStart',[point(650,135)]);await page.waitForFunction(()=>game.player.handHeld===true);row.press=await snapshot(page);
      for(let i=1;i<=6;i++){await touch('touchMove',[point(650+8*i,135+7*i)]);await page.waitForTimeout(45);}
      row.dragAdvance=await advance(page);row.drag=await snapshot(page);assert.ok(row.drag.held);
      assert.ok(Math.hypot(row.drag.hand.x-row.press.hand.x,row.drag.hand.y-row.press.hand.y)>.01);
      await touch('touchEnd',[]);await page.waitForFunction(()=>game.player.handHeld===false);
      row.releaseAdvance=await advance(page);row.release=await snapshot(page);assert.ok(!row.release.held);
      await touch('touchStart',[point(698,177)]);await page.waitForFunction(()=>game.player.handHeld===true);
      row.retouchAdvance=await advance(page);row.retouch=await snapshot(page);assert.ok(row.retouch.held);
      await touch('touchEnd',[]);await page.waitForFunction(()=>game.player.handHeld===false);
      row.fightScreenshot=await picture(page,`${initialOrientation}-${id}-input`);
      for(const s of [row.press,row.drag,row.release,row.retouch]){assertTrial(s,model);assert.equal(s.move.x,0);assert.equal(s.move.y,0);}
      await page.evaluate(()=>{window.__cutTrialPreviousCombat=game.combat});
      await page.locator('#btnPause').tap();await page.waitForFunction(()=>game.state==='paused');
      row.pausedLayout=await layout(page);assert.ok(!row.pausedLayout.horizontalOverflow);
      await page.locator('#btnStart').tap();await page.waitForFunction(()=>game.state==='fight');
      row.newCombatObject=await page.evaluate(()=>game.combat!==window.__cutTrialPreviousCombat);assert.ok(row.newCombatObject);
      await isolateInput(page);row.restartAdvance=await advance(page);row.restart=await snapshot(page);assertTrial(row.restart,model);
      row.storage=await page.evaluate(()=>({...localStorage}));
      assert.ok(!Object.keys(row.storage).some(key=>/cutTrial|cutReactionModel/.test(key)));
      // Same context retains localStorage: returning to ordinary URL must restore legacy.
      await page.goto(base.href,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.game?.combat&&window.game?.player);
      row.normal=await snapshot(page);assert.equal(row.normal.cutReactionModel,'legacy');assert.equal(row.normal.gripReaction,'paired');
      assert.equal(row.normal.supportModel,'legacy');assert.ok(row.normal.finite);
      const typo=new URL(base);typo.searchParams.set('cutTrial','bugeted');
      await page.goto(typo.href,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.game?.combat&&window.game?.player);
      row.typo=await snapshot(page);assert.equal(row.typo.cutReactionModel,'legacy');assert.ok(row.typo.finite);
      row.pass=true;
    }catch(error){row.pass=false;row.failure=error.stack||String(error);row.failureScreenshot=await picture(page,`${initialOrientation}-${id}-failure`).catch(()=>null);}
    finally{rows.push(row);await ctx.close();}
  }
}finally{await browser.close();}
const result={schemaVersion:1,createdUTC:new Date().toISOString(),base:base.href,tag,
  method:'Actual mobile feature-lab link tap, portrait/landscape overflow and rotate guidance, landscape Start, CDP canvas drag/release/retouch, restart with new Combat object, same-context ordinary and misspelled-option URL fallback. Normal RAF advances simulation; AI update disabled only for input isolation. No cutting/naturalness/performance claim. TLS verification enabled; HTTPS uses session proxy.',
  viewports:{portrait,landscape},rows,errors,httpFailures,requestFailures};
result.pass=rows.length===4&&rows.every(r=>r.pass)&&!errors.length&&!httpFailures.length&&!requestFailures.length;
const output=join(evidence,`cut-trial-browser-${tag}.json`);await writeFile(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({output,pass:result.pass,rows:rows.map(r=>({id:r.id,orientation:r.initialOrientation,pass:r.pass,failure:r.failure})),errors,httpFailures,requestFailures}));
process.exitCode=result.pass?0:1;
