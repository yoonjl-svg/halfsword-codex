// Mobile URL-option and get-up re-entry smoke check for isolated stance Nf memory policy.
// No force, clamp, or source-code changes are made by this browser probe.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base=new URL(process.env.HALFSWORD_TEST_URL||process.argv[2]||'http://127.0.0.1:4201/');
if(!base.pathname.endsWith('/'))base.pathname+='/';
base.search='';base.hash='';
const tag=process.env.HALFSWORD_EVIDENCE_TAG||'q07-stance-memory';
if(!/^[a-zA-Z0-9_-]+$/.test(tag))throw Error('Use a plain evidence tag');
const evidence=process.env.HALFSWORD_EVIDENCE_DIR||'/workspace/halfsword-hybrid-evidence/q07-stance-memory-browser';
await mkdir(evidence,{recursive:true});
const portrait={width:390,height:844},landscape={width:844,height:390};
const launch={executablePath:process.env.PW_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']};
if(base.protocol==='https:'){
  const proxy=process.env.HTTPS_PROXY||process.env.HTTP_PROXY;
  if(!proxy)throw Error('HTTPS verification requires the configured session proxy');
  const p=new URL(proxy);launch.proxy={server:`${p.protocol}//${p.host}`};
}
// TLS certificate verification remains enabled.
const browser=await chromium.launch(launch),rows=[],errors=[],httpFailures=[],requestFailures=[];
const observe=(page,id)=>{
  page.on('pageerror',e=>errors.push({id,type:'pageerror',message:String(e)}));
  page.on('console',m=>{if(m.type()==='error')errors.push({id,type:'console',message:m.text()})});
  page.on('response',r=>{if(r.status()>=400)httpFailures.push({id,url:r.url(),status:r.status()})});
  page.on('requestfailed',r=>requestFailures.push({id,url:r.url(),error:r.failure()?.errorText}));
};
const snapshot=page=>page.evaluate(()=>{
  const g=window.game,p=g.player,e=g.enemy,info=document.querySelector('#stanceTrialInfo');
  const finite=f=>[...Object.values(f.bodies),f.sword].every(b=>
    [b.translation(),b.rotation(),b.linvel(),b.angvel()].every(v=>Object.values(v).every(Number.isFinite)));
  return {url:location.href,state:g.state,simTime:g.stats.simTime,stanceTrial:g.stanceTrial,
    stanceMemory:g.config.GAIT.stanceMemory,supportModel:g.config.BODY.supportModel,
    weapon:p.weapon.id,foeWeapon:e.weapon.id,probe:g.supportProbe,gripReaction:g.config.GRIP.reactionModel,
    playerState:p.state,enemyState:e.state,playerFinite:finite(p),enemyFinite:finite(e),
    info:{present:!!info,text:info?.textContent||'',visible:!!info&&!!info.getClientRects().length&&getComputedStyle(info).display!=='none'}};
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
const assertRuntime=(s,model)=>{
  assert.equal(s.stanceMemory,model);assert.equal(s.stanceTrial?.model,model);assert.equal(s.stanceTrial?.active,true);
  assert.equal(s.supportModel,'legacy');assert.equal(s.weapon,'longsword');assert.equal(s.foeWeapon,'longsword');
  assert.equal(s.gripReaction,'paired');assert.equal(s.probe.assist,.1);assert.equal(s.probe.catchMode,'on');assert.equal(s.probe.catchScale,1);
  assert.ok(s.playerFinite&&s.enemyFinite);
};
const picture=async(page,name)=>{const path=join(evidence,`stance-memory-${tag}-${name}.png`);await page.screenshot({path});return path;};
const finiteNf=gait=>Object.fromEntries(Object.entries(gait.legs).map(([k,l])=>[k,Number.isFinite(l.Nf)?l.Nf:0]));
const positiveNf=nf=>Object.values(nf).some(n=>n>1e-6);

try{
  for(const initialOrientation of ['portrait','landscape'])for(const [id,model]of [['playStanceLegacy','legacy'],['playStanceFresh','fresh']]){
    const caseId=`${initialOrientation}-${model}`,ctx=await browser.newContext({viewport:initialOrientation==='portrait'?portrait:landscape,isMobile:true,hasTouch:true});
    const page=await ctx.newPage(),row={id:model,model,weapon:'longsword',foeWeapon:'longsword',initialOrientation,aiDisabledAfterFirstStand:true,syntheticKnockdown:true};
    observe(page,caseId);
    let instrumentationInstalled=false;
    try{
      await page.goto(new URL('feature-lab.html',base).href,{waitUntil:'networkidle'});
      row.landingLayout=await layout(page);assert.ok(!row.landingLayout.horizontalOverflow);
      assert.ok(await page.locator('#stance-comparison').count());
      const links=await page.evaluate(ids=>Object.fromEntries(ids.map(key=>{const a=document.getElementById(key);return[key,a?{href:a.href,text:a.textContent}:null];})),['playStanceLegacy','playStanceFresh']);
      assert.ok(links.playStanceLegacy&&links.playStanceFresh);
      const href=new URL(links[id].href);
      assert.equal(href.origin,base.origin);assert.equal(href.pathname,base.pathname);
      assert.equal(href.searchParams.get('stanceTrial'),model);
      assert.equal(href.searchParams.get('weapon'),'longsword');assert.equal(href.searchParams.get('foeWeapon'),'longsword');
      assert.equal(href.searchParams.get('foe'),'default');assert.equal(href.searchParams.get('supportProbe'),'1');
      assert.equal(href.searchParams.get('assist'),'0.1');assert.equal(href.searchParams.get('catch'),'on');assert.equal(href.searchParams.get('catchScale'),'1');
      assert.ok(!['armTrial','cutTrial','physicsTrial','limbTrial','limbDemo'].some(k=>href.searchParams.has(k)));
      row.actualFeatureHref=href.href;
      await page.locator(`#${id}`).scrollIntoViewIfNeeded();row.linksScreenshot=await picture(page,`${caseId}-links`);
      await Promise.all([page.waitForURL(href.href),page.locator(`#${id}`).tap()]);
      await page.waitForFunction(()=>window.game?.player?.sword&&window.game?.combat);
      row.menu=await snapshot(page);assertRuntime(row.menu,model);
      assert.ok(row.menu.info.present&&row.menu.info.visible&&row.menu.info.text.trim());
      row.menuLayout=await layout(page);assert.ok(!row.menuLayout.horizontalOverflow);
      row.menuScreenshot=await picture(page,`${caseId}-menu`);
      if(initialOrientation==='portrait')await page.setViewportSize(landscape);
      await page.locator('#btnStart').tap();await page.waitForFunction(()=>game.state==='fight');
      row.startAdvance=await advance(page,.6);row.started=await snapshot(page);assertRuntime(row.started,model);
      await page.waitForFunction(()=>game.player.state==='stand'&&game.player.gait.active&&Object.values(game.player.gait.legs).some(l=>l.Nf>1e-6),null,{timeout:60000});
      row.firstStanding=await page.evaluate(()=>({simTime:game.stats.simTime,state:game.player.state,stance:game.player.gait.active,nf:Object.fromEntries(Object.entries(game.player.gait.legs).map(([k,l])=>[k,l.Nf??0]))}));
      row.aiInputIsolation=await page.evaluate(()=>{const p=game.player,ai=game.ai;game.__stanceOriginalAI=ai.update;ai.update=()=>{};p.handHeld=false;p.inputActive=false;p.move.set(0,0);return {aiPaused:true,inputHeld:p.handHeld,move:{x:p.move.x,y:p.move.y}};});
      row.landscapeLayout=await layout(page);assert.ok(!row.landscapeLayout.horizontalOverflow);assert.ok(!row.landscapeLayout.rotateVisible);
      if(initialOrientation==='portrait'){
        await page.setViewportSize(portrait);row.fightPortraitLayout=await layout(page);
        assert.ok(!row.fightPortraitLayout.horizontalOverflow);assert.ok(row.fightPortraitLayout.rotateVisible);
        row.rotateScreenshot=await picture(page,`${caseId}-rotate`);await page.setViewportSize(landscape);
      }
      // Actual canvas touch drag, release and retouch through Chrome's mobile touch dispatcher.
      const cdp=await ctx.newCDPSession(page),point=(x,y)=>({x,y,id:1}),touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
      await touch('touchStart',[point(650,135)]);await page.waitForFunction(()=>game.player.handHeld===true);row.touchDown=await snapshot(page);
      for(let i=1;i<=6;i++){await touch('touchMove',[point(650+8*i,135+7*i)]);await page.waitForTimeout(45);}
      row.dragAdvance=await advance(page);row.drag=await snapshot(page);assert.ok(row.drag.playerState==='stand');
      await touch('touchEnd',[]);await page.waitForFunction(()=>game.player.handHeld===false);
      row.releaseAdvance=await advance(page);row.released=await snapshot(page);assert.equal(await page.evaluate(()=>game.player.handHeld),false);
      await touch('touchStart',[point(698,177)]);await page.waitForFunction(()=>game.player.handHeld===true);
      row.retouchAdvance=await advance(page);row.retouch=await snapshot(page);assert.equal(await page.evaluate(()=>game.player.handHeld),true);
      await touch('touchEnd',[]);await page.waitForFunction(()=>game.player.handHeld===false);
      row.touchScreenshot=await picture(page,`${caseId}-touch`);
      for(const s of [row.touchDown,row.drag,row.released,row.retouch])assertRuntime(s,model);
      // Wait for first standing with solver-observed positive stance memory, then isolate AI/input.
      await page.waitForFunction(()=>game.player.state==='stand'&&game.player.gait.active&&Object.values(game.player.gait.legs).some(l=>l.Nf>1e-6),null,{timeout:60000});
      // Install read-only rendered-frame finite/gap samples and scoped enter/plant observers, then pause AI.
      row.instrumentation=await page.evaluate(()=>{
        const g=window.game,f=g.player,ai=g.ai,gait=f.gait,originalEnter=gait.enter,originalPlantAt=gait.plantAt,originalAI=g.__stanceOriginalAI||ai.update;
        const nf=()=>Object.fromEntries(Object.entries(gait.legs).map(([k,l])=>[k,Number.isFinite(l.Nf)?l.Nf:0]));
        const startTime=g.stats.simTime,startNf=nf(),oldPositiveNf={timeS:startTime,values:startNf,positive:Object.values(startNf).some(n=>n>1e-6)};
        const probe={active:true,startedAt:startTime,lastSimTime:startTime,finiteSamples:0,nonfiniteSamples:0,gapSamples:0,
          maxJointGapM:0,seenStates:new Set([f.state]),knockdownAt:null,enterCalls:0,plantCalls:[],firstReentry:null,
          originalEnter,originalPlantAt,originalAI,gait,ai};
        gait.plantAt=function(leg,...args){
          if(probe.knockdownAt!==null&&!probe.firstReentry&&this.started)probe.plantCalls.push({timeS:g.stats.simTime,leg:leg===this.legs.F?'F':'B',nfBefore:{...nf()}});
          return originalPlantAt.call(this,leg,...args);
        };
        gait.enter=function(...args){
          const eligible=probe.knockdownAt!==null&&!probe.firstReentry&&this.started;
          const record=eligible?{timeS:g.stats.simTime,state:f.state,startedBefore:!!this.started,nfBefore:{...nf()},legsBefore:Object.fromEntries(Object.entries(this.legs).map(([k,l])=>[k,{N:l.N??null,Nf:l.Nf??null,pinF:l.pinF??null,pinLim:l.pinLim??null,stance:l.stance}]))}:null;
          const value=originalEnter.apply(this,args);
          probe.enterCalls++;probe.seenStates.add(f.state);
          if(record){record.nfAfter={...nf()};record.legsAfter=Object.fromEntries(Object.entries(this.legs).map(([k,l])=>[k,{N:l.N??null,Nf:l.Nf??null,pinF:l.pinF??null,pinLim:l.pinLim??null,stance:l.stance}]));probe.firstReentry=record;}
          return value;
        };
        const jointGap=(f,j)=>{
          const T=g.THREE,b1=j.body1(),b2=j.body2(),a1=j.anchor1(),a2=j.anchor2();
          const p1=new T.Vector3(a1.x,a1.y,a1.z).applyQuaternion(new T.Quaternion(b1.rotation().x,b1.rotation().y,b1.rotation().z,b1.rotation().w)).add(new T.Vector3(b1.translation().x,b1.translation().y,b1.translation().z));
          const p2=new T.Vector3(a2.x,a2.y,a2.z).applyQuaternion(new T.Quaternion(b2.rotation().x,b2.rotation().y,b2.rotation().z,b2.rotation().w)).add(new T.Vector3(b2.translation().x,b2.translation().y,b2.translation().z));
          return p1.distanceTo(p2);
        };
        const sample=()=>{
          if(!probe.active)return;
          const t=g.stats.simTime;
          if(t>probe.lastSimTime+1e-9){
            probe.lastSimTime=t;probe.seenStates.add(f.state);
            const bodies=[...Object.values(g.player.bodies),g.player.sword,...Object.values(g.enemy.bodies),g.enemy.sword];
            const finite=bodies.every(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].every(v=>Object.values(v).every(Number.isFinite)));
            if(finite)probe.finiteSamples++;else probe.nonfiniteSamples++;
            for(const fighter of [g.player,g.enemy])for(const item of [...fighter.joints,fighter.gripJoint].filter(Boolean)){
              try{const value=jointGap(fighter,item.joint||item);if(Number.isFinite(value)){probe.gapSamples++;probe.maxJointGapM=Math.max(probe.maxJointGapM,value);}else probe.nonfiniteSamples++;}
              catch{probe.nonfiniteSamples++;}
            }
          }
          requestAnimationFrame(sample);
        };
        ai.update=()=>{};g.__stanceMemoryProbe=probe;requestAnimationFrame(sample);
        return {simTime:startTime,nf:startNf,oldPositiveNf,aiPaused:true};
      });
      row.oldPositiveNf=row.instrumentation.oldPositiveNf;
      instrumentationInstalled=true;
      assert.ok(row.instrumentation.aiPaused);assert.ok(row.oldPositiveNf.positive,'Need positive old Nf memory before synthetic knockdown');
      assert.equal(row.oldPositiveNf.timeS,row.instrumentation.simTime,'Baseline Nf and AI isolation share one synchronous browser observation');
      row.knockdown=await page.evaluate(()=>{
        const p=game.player,nf=Object.fromEntries(Object.entries(p.gait.legs).map(([k,l])=>[k,Number.isFinite(l.Nf)?l.Nf:0])),timeS=game.stats.simTime;
        game.__stanceMemoryProbe.knockdownAt=timeS;
        p.handHeld=false;p.inputActive=false;p.move.set(0,0);p.knockDown(true);
        return {timeS,state:p.state,downTime:p.downTime,nf};
      });
      assert.equal(row.knockdown.state,'down');
      await page.waitForFunction(()=>window.game.player.state==='stand'&&window.game.__stanceMemoryProbe.firstReentry&&window.game.stats.simTime>window.game.__stanceMemoryProbe.knockdownAt+0.25,null,{timeout:60000});
      row.firstReentry=await page.evaluate(()=>{
        const g=window.game,p=g.player,q=g.__stanceMemoryProbe;
        return {event:q.firstReentry,plantCalls:q.plantCalls,seenStates:[...q.seenStates],simTime:g.stats.simTime,
          finiteSamples:q.finiteSamples,nonfiniteSamples:q.nonfiniteSamples,gapSamples:q.gapSamples,maxJointGapM:q.maxJointGapM,
          currentNf:Object.fromEntries(Object.entries(p.gait.legs).map(([k,l])=>[k,Number.isFinite(l.Nf)?l.Nf:0])),currentPositive:Object.values(p.gait.legs).some(l=>Number.isFinite(l.Nf)&&l.Nf>1e-6)};
      });
      assert.ok(row.firstReentry.seenStates.includes('down')&&row.firstReentry.seenStates.includes('getup'));
      assert.ok(row.firstReentry.event&&row.firstReentry.finiteSamples>0&&row.firstReentry.gapSamples>0);
      assert.equal(row.firstReentry.nonfiniteSamples,0);assert.ok(Number.isFinite(row.firstReentry.maxJointGapM));
      assert.ok(row.firstReentry.event.nfBefore&&positiveNf(row.firstReentry.event.nfBefore));
      if(model==='legacy'){
        assert.ok(row.firstReentry.event.nfAfter&&positiveNf(row.firstReentry.event.nfAfter),'legacy entry must preserve old positive Nf');
        assert.ok(row.firstReentry.plantCalls.every(x=>positiveNf(x.nfBefore)),'legacy pinning must see the prior Nf memory');
      }else{
        assert.ok(row.firstReentry.event.nfAfter&&Object.values(row.firstReentry.event.nfAfter).every(n=>n===0),'fresh must clear Nf at actual Gait.enter');
        assert.ok(row.firstReentry.plantCalls.length>=2&&row.firstReentry.plantCalls.every(x=>Object.values(x.nfBefore).every(n=>n===0)),'fresh reset must precede both real pin placements');
        await page.waitForFunction(()=>game.player.state==='stand'&&Object.values(game.player.gait.legs).some(l=>l.Nf>1e-6),null,{timeout:10000});
        row.firstReentry.recomputedNf=await page.evaluate(()=>{const values=Object.fromEntries(Object.entries(game.player.gait.legs).map(([k,l])=>[k,Number.isFinite(l.Nf)?l.Nf:0]));return {timeS:game.stats.simTime,values,positive:Object.values(values).some(n=>n>1e-6)};});
        assert.ok(row.firstReentry.recomputedNf.positive,'Fresh Nf must be repopulated by subsequent real support steps');
      }
      assertRuntime(await snapshot(page),model);
      row.reentryScreenshot=await picture(page,`${caseId}-reentry`);
      // The original methods are restored even if assertions later fail; proceed with real pause/restart.
      row.restartOldObjects=await page.evaluate(()=>{window.__stanceOldCombat=game.combat;window.__stanceOldPlayer=game.player;window.__stanceOldEnemy=game.enemy;return true;});
      await page.locator('#btnPause').tap();await page.waitForFunction(()=>game.state==='paused');
      row.pausedLayout=await layout(page);assert.ok(!row.pausedLayout.horizontalOverflow);
      await page.locator('#btnStart').tap();await page.waitForFunction(()=>game.state==='fight');
      row.restart=await page.evaluate(()=>({newCombat:game.combat!==window.__stanceOldCombat,newPlayer:game.player!==window.__stanceOldPlayer,newEnemy:game.enemy!==window.__stanceOldEnemy,
        stanceMemory:game.config.GAIT.stanceMemory,playerMemory:game.player.stanceMemoryModel??null,enemyMemory:game.enemy.stanceMemoryModel??null}));
      assert.ok(row.restart.newCombat&&row.restart.newPlayer&&row.restart.newEnemy);assert.equal(row.restart.stanceMemory,model);
      row.restartAdvance=await advance(page,.35);assertRuntime(await snapshot(page),model);
      row.storage=await page.evaluate(()=>({...localStorage}));assert.ok(!/stanceTrial|stanceMemory/.test(JSON.stringify(row.storage)));
      // Return to an ordinary URL in the same context, then exercise the misspelled-option fallback.
      await page.goto(base.href,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.game?.combat&&window.game?.player);
      row.normal=await snapshot(page);assert.equal(row.normal.stanceMemory,'legacy');assert.equal(row.normal.stanceTrial?.model,'legacy');assert.equal(row.normal.stanceTrial?.active,false);
      assert.ok(!row.normal.info.present&&row.normal.supportModel==='legacy'&&row.normal.playerFinite&&row.normal.enemyFinite);
      const invalid=new URL(href);invalid.searchParams.set('stanceTrial','FRESH');row.invalidURL=invalid.href;
      await page.goto(invalid.href,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.game?.combat&&window.game?.player);
      row.invalid=await snapshot(page);assert.equal(row.invalid.stanceMemory,'legacy');assert.equal(row.invalid.stanceTrial?.model,'legacy');assert.equal(row.invalid.stanceTrial?.active,false);
      assert.ok(!row.invalid.info.present&&row.invalid.playerFinite&&row.invalid.enemyFinite);
      row.pass=true;
    }catch(error){row.pass=false;row.failure=error.stack||String(error);row.failureScreenshot=await picture(page,`${caseId}-failure`).catch(()=>null);}
    finally{
      if(instrumentationInstalled||row.aiInputIsolation)await page.evaluate(()=>{
        const g=window.game,q=g?.__stanceMemoryProbe;if(q){q.active=false;q.gait.enter=q.originalEnter;q.gait.plantAt=q.originalPlantAt;q.ai.update=q.originalAI;delete g.__stanceMemoryProbe;}
        if(g?.__stanceOriginalAI){g.ai.update=g.__stanceOriginalAI;delete g.__stanceOriginalAI;}
      }).catch(()=>{});
      rows.push(row);await ctx.close();
    }
  }
}finally{await browser.close();}
const result={schemaVersion:1,createdUTC:new Date().toISOString(),base:base.href,tag,
  method:'Actual stance feature href tap, fixed longsword versus longsword with supportProbe assist=0.1, paired grip and legacy support. Checks portrait/landscape overflow and rotate guidance, Start, canvas touch drag/release/retouch, first standing positive Nf, isolated AI and synthetic knockDown(true), real RAF get-up through stand, read-only Gait.enter/plantAt boundary capture of old/cleared/recomputed Nf, rendered-frame samples of finite bodies and actual joint gaps only when simulation time advances (not every physics step), pause/restart with new Combat/Fighters, same-context ordinary and invalid-option fallback, and no localStorage persistence. The synthetic fall and smoke counters do not establish human naturalness or physical performance.',
  viewports:{portrait,landscape},rows,errors,httpFailures,requestFailures};
result.pass=rows.length===4&&rows.every(r=>r.pass)&&!errors.length&&!httpFailures.length&&!requestFailures.length;
const output=join(evidence,`stance-memory-trial-${tag}.json`);await writeFile(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({output,pass:result.pass,rows:rows.map(r=>({id:r.id,orientation:r.initialOrientation,pass:r.pass,failure:r.failure})),errors,httpFailures,requestFailures}));
process.exitCode=result.pass?0:1;
