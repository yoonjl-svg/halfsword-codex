// Mobile runtime-option interaction check for the armTorqueModel × cutReactionModel matrix.
// This confirms URL option delivery and ordinary interaction only; it does not assess physics quality.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base=new URL(process.env.HALFSWORD_TEST_URL||process.argv[2]||'http://127.0.0.1:4201/');
if(!base.pathname.endsWith('/'))base.pathname+='/';
base.search='';base.hash='';
const tag=process.env.HALFSWORD_EVIDENCE_TAG||'q06-mobile-options';
if(!/^[a-zA-Z0-9_-]+$/.test(tag))throw Error('Use a plain evidence tag');
const evidence=process.env.HALFSWORD_EVIDENCE_DIR||'/workspace/halfsword-hybrid-evidence/q06-mobile-options';
await mkdir(evidence,{recursive:true});
const portrait={width:390,height:844},landscape={width:844,height:390};
const launch={executablePath:process.env.PW_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']};
if(base.protocol==='https:'){
  const proxy=process.env.HTTPS_PROXY||process.env.HTTP_PROXY;
  if(!proxy)throw Error('HTTPS verification requires the configured session proxy');
  const p=new URL(proxy);launch.proxy={server:`${p.protocol}//${p.host}`};
}
// Keep TLS verification enabled.
const browser=await chromium.launch(launch),rows=[],errors=[],httpFailures=[],requestFailures=[];
const observe=(page,id)=>{
  page.on('pageerror',e=>errors.push({id,type:'pageerror',message:String(e)}));
  page.on('console',m=>{if(m.type()==='error')errors.push({id,type:'console',message:m.text()})});
  page.on('response',r=>{if(r.status()>=400)httpFailures.push({id,url:r.url(),status:r.status()})});
  page.on('requestfailed',r=>requestFailures.push({id,url:r.url(),error:r.failure()?.errorText}));
};
const snapshot=page=>page.evaluate(()=>{
  const g=window.game,f=g.player;
  const armInfo=document.querySelector('#armTrialInfo'),cutInfo=document.querySelector('#cutTrialInfo');
  const info=n=>({present:!!n,text:n?.textContent||'',visible:!!n&&!!n.getClientRects().length&&getComputedStyle(n).display!=='none'});
  return {url:location.href,state:g.state,simTime:g.stats.simTime,
    armTorqueModel:f.armTorqueModel,enemyArmTorqueModel:g.enemy.armTorqueModel,cutReactionModel:g.combat.cutReactionModel,
    weapon:f.weapon.id,foeWeapon:g.enemy.weapon.id,probe:g.supportProbe,gripReaction:g.config.GRIP.reactionModel,
    supportModel:g.config.BODY.supportModel,held:f.handHeld,hand:{x:f.handOffset.x,y:f.handOffset.y},move:{x:f.move.x,y:f.move.y},
    armInfo:info(armInfo),cutInfo:info(cutInfo),
    finite:[...Object.values(f.bodies),f.sword,...Object.values(g.enemy.bodies),g.enemy.sword].every(b=>
      [b.translation(),b.rotation(),b.linvel(),b.angvel()].every(v=>Object.values(v).every(Number.isFinite)))};
});
const layout=page=>page.evaluate(()=>{
  const root=document.documentElement,card=document.querySelector('#menu .card'),rotate=document.querySelector('#rotate'),r=card?.getBoundingClientRect();
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
const expected=(s,arm,cut)=>{
  assert.equal(s.armTorqueModel,arm);assert.equal(s.enemyArmTorqueModel,arm);assert.equal(s.cutReactionModel,cut);
  assert.equal(s.weapon,'zweihander');assert.equal(s.foeWeapon,'longsword');
  assert.equal(s.gripReaction,'paired');assert.equal(s.supportModel,'legacy');
  assert.equal(s.probe.assist,.3);assert.equal(s.probe.catchMode,'on');assert.equal(s.probe.catchScale,1);assert.ok(s.finite);
};
const picture=async(page,name)=>{const path=join(evidence,`arm-cut-${tag}-${name}.png`);await page.screenshot({path});return path;};
const isolateInput=page=>page.evaluate(()=>{game.ai.update=()=>{}});
try{
  for(const initialOrientation of ['portrait','landscape'])for(const [arm,cut]of [['legacy','legacy'],['legacy','budgeted'],['sharedCap','legacy'],['sharedCap','budgeted']]){
    const id=`arm-${arm}__cut-${cut}`,ctx=await browser.newContext({viewport:initialOrientation==='portrait'?portrait:landscape,isMobile:true,hasTouch:true});
    const page=await ctx.newPage(),row={id,arm,cut,weapon:'zweihander',foeWeapon:'longsword',initialOrientation,aiDisabledOnlyForInput:true};observe(page,`${initialOrientation}-${id}`);
    try{
      await page.goto(new URL('feature-lab.html',base).href,{waitUntil:'networkidle'});
      row.landingLayout=await layout(page);assert.ok(!row.landingLayout.horizontalOverflow);
      const anchors=await page.evaluate(()=>Object.fromEntries(['playArmZweiLegacy','playArmZweiSharedCap','playCutLegacy','playCutBudgeted'].map(id=>{
        const a=document.getElementById(id);return[id,a?{href:a.href,text:a.textContent}:null];
      })));
      assert.ok(Object.values(anchors).every(Boolean));
      const armAnchor=new URL(anchors[arm==='sharedCap'?'playArmZweiSharedCap':'playArmZweiLegacy'].href);
      const cutAnchor=new URL(anchors[cut==='budgeted'?'playCutBudgeted':'playCutLegacy'].href);
      for(const u of [armAnchor,cutAnchor]){
        assert.equal(u.origin,base.origin);assert.equal(u.pathname,base.pathname);
        assert.equal(u.searchParams.get('weapon'),'zweihander');assert.equal(u.searchParams.get('foeWeapon'),'longsword');
        assert.equal(u.searchParams.get('foe'),'default');assert.equal(u.searchParams.get('supportProbe'),'1');
        assert.equal(u.searchParams.get('assist'),'0.3');assert.equal(u.searchParams.get('catch'),'on');assert.equal(u.searchParams.get('catchScale'),'1');
        assert.ok(!u.searchParams.has('physicsTrial'));assert.ok(!u.searchParams.has('limbTrial'));assert.ok(!u.searchParams.has('limbDemo'));
      }
      // Combine only values observed in the real feature-lab hrefs; navigate to that actual URL.
      const trialUrl=new URL(armAnchor.href);
      const armValue=armAnchor.searchParams.get('armTrial'),cutValue=cutAnchor.searchParams.get('cutTrial');
      if(armValue)trialUrl.searchParams.set('armTrial',armValue);else trialUrl.searchParams.delete('armTrial');
      if(cutValue)trialUrl.searchParams.set('cutTrial',cutValue);else trialUrl.searchParams.delete('cutTrial');
      const checked=new URL(trialUrl.href);checked.searchParams.delete('armTrial');checked.searchParams.delete('cutTrial');
      const cleanArm=new URL(armAnchor.href);cleanArm.searchParams.delete('armTrial');
      const cleanCut=new URL(cutAnchor.href);cleanCut.searchParams.delete('cutTrial');
      assert.equal(cleanArm.href,cleanCut.href,'Arm and cut source links must share fixed conditions');
      row.actualTrialURL=trialUrl.href;
      row.landingScreenshot=await picture(page,`${initialOrientation}-${id}-links`);
      await page.goto(trialUrl.href,{waitUntil:'networkidle'});
      await page.waitForFunction(()=>window.game?.player?.sword&&window.game?.combat);
      row.menu=await snapshot(page);expected(row.menu,arm,cut);
      assert.equal(new URL(row.menu.url).href,trialUrl.href);
      // Both legacy and candidate links explicitly opt into their labelled trial rows.
      assert.ok(row.menu.armInfo.present&&row.menu.armInfo.visible);
      assert.ok(row.menu.cutInfo.present&&row.menu.cutInfo.visible);
      assert.ok(row.menu.armInfo.text.includes(arm==='sharedCap'?'비교 B':'비교 A'));
      assert.ok(row.menu.cutInfo.text.includes(cut==='budgeted'?'비교 B':'비교 A'));
      row.initialMenuLayout=await layout(page);assert.ok(!row.initialMenuLayout.horizontalOverflow);
      row.menuScreenshot=await picture(page,`${initialOrientation}-${id}-menu`);
      if(initialOrientation==='portrait')await page.setViewportSize(landscape);
      await page.locator('#btnStart').tap();await page.waitForFunction(()=>game.state==='fight');
      await isolateInput(page);row.initialAdvance=await advance(page,.6);row.before=await snapshot(page);expected(row.before,arm,cut);
      row.landscapeLayout=await layout(page);assert.ok(!row.landscapeLayout.horizontalOverflow);assert.ok(!row.landscapeLayout.rotateVisible);
      if(initialOrientation==='portrait'){
        await page.setViewportSize(portrait);row.fightPortraitLayout=await layout(page);
        assert.ok(!row.fightPortraitLayout.horizontalOverflow);assert.ok(row.fightPortraitLayout.rotateVisible);
        row.rotateScreenshot=await picture(page,`${initialOrientation}-${id}-rotate`);await page.setViewportSize(landscape);
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
      for(const s of [row.press,row.drag,row.release,row.retouch]){expected(s,arm,cut);assert.equal(s.move.x,0);assert.equal(s.move.y,0);}
      await page.evaluate(()=>{window.__armCutOldCombat=game.combat;window.__armCutOldPlayer=game.player;window.__armCutOldEnemy=game.enemy});
      await page.locator('#btnPause').tap();await page.waitForFunction(()=>game.state==='paused');
      row.pausedLayout=await layout(page);assert.ok(!row.pausedLayout.horizontalOverflow);
      await page.locator('#btnStart').tap();await page.waitForFunction(()=>game.state==='fight');
      row.newCombatObject=await page.evaluate(()=>game.combat!==window.__armCutOldCombat);
      row.newFighterObjects=await page.evaluate(()=>game.player!==window.__armCutOldPlayer&&game.enemy!==window.__armCutOldEnemy);
      assert.ok(row.newCombatObject&&row.newFighterObjects);
      await isolateInput(page);row.restartAdvance=await advance(page);row.restart=await snapshot(page);expected(row.restart,arm,cut);
      row.storage=await page.evaluate(()=>({...localStorage}));
      assert.ok(!/armTrial|cutTrial|armTorqueModel|cutReactionModel/.test(JSON.stringify(row.storage)));
      // Same browser context preserves storage while an ordinary URL returns both options to legacy.
      await page.goto(base.href,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.game?.combat&&window.game?.player);
      row.normal=await snapshot(page);assert.equal(row.normal.armTorqueModel,'legacy');assert.equal(row.normal.enemyArmTorqueModel,'legacy');
      assert.equal(row.normal.cutReactionModel,'legacy');assert.equal(row.normal.gripReaction,'paired');
      assert.equal(row.normal.supportModel,'legacy');assert.ok(!row.normal.armInfo.present&&!row.normal.cutInfo.present&&row.normal.finite);
      row.pass=true;
    }catch(error){row.pass=false;row.failure=error.stack||String(error);row.failureScreenshot=await picture(page,`${initialOrientation}-${id}-failure`).catch(()=>null);}
    finally{rows.push(row);await ctx.close();}
  }
}finally{await browser.close();}
const result={schemaVersion:1,createdUTC:new Date().toISOString(),base:base.href,tag,
  method:'Real feature-lab arm/cut href parameters combined into an actual gameplay URL, fixed zweihander versus longsword. Checks both models, option labels, 390x844/844x390 overflow and rotate guidance, Start, CDP canvas touch drag/release/retouch, normal simulation frame advance, pause/restart with new Combat and both Fighter instances, same-context ordinary URL legacy fallback and localStorage persistence absence. AI update disabled only for input isolation. This is runtime-option delivery and UI interaction smoke coverage; it does not evaluate physical performance, naturalness, or device performance.',
  viewports:{portrait,landscape},requestedGesture:{press:[650,135],drag:Array.from({length:6},(_,i)=>[650+8*(i+1),135+7*(i+1)]),moveSpacingWallMs:45,release:true,retouch:[698,177],physicsReplayExact:false},rows,errors,httpFailures,requestFailures};
result.pass=rows.length===8&&rows.every(r=>r.pass)&&!errors.length&&!httpFailures.length&&!requestFailures.length;
const output=join(evidence,`arm-cut-interaction-${tag}.json`);await writeFile(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({output,pass:result.pass,rows:rows.map(r=>({id:r.id,orientation:r.initialOrientation,pass:r.pass,failure:r.failure})),errors,httpFailures,requestFailures}));
process.exitCode=result.pass?0:1;
