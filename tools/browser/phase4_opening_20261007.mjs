// Character-selected ordinary card entry: original Bran opening, pause/resume and fresh restart.
// Preparation only until source freeze. No RNG, pose, AI state or damage injection.
// PLAYWRIGHT_MODULE=... PLAYWRIGHT_BROWSERS_PATH=... node tools/browser/phase4_opening_20261007.mjs --out=<fresh-dir> [--base=<own-base/>]
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const own='tools/browser/phase4_opening_20261007.mjs';
const args={};for(const value of process.argv.slice(2)){const m=/^--(out|base)=(.+)$/.exec(value);assert(m&&!Object.hasOwn(args,m[1]));args[m[1]]=m[2];}
const artifactRoot='/workspace/halfsword-handoff/phase4-pacing-20261007/browser';
assert(args.out);const out=path.resolve(args.out);assert(out.startsWith(artifactRoot+'/'));
await fs.mkdir(artifactRoot,{recursive:true});assert.equal(await fs.realpath(artifactRoot),artifactRoot);
assert.equal(path.dirname(out),artifactRoot,'Use one fresh direct child of the browser artifact root');await fs.mkdir(out);
const base=new URL(args.base||'https://yoonjl-svg.github.io/halfsword-codex/');
const local=['localhost','127.0.0.1','[::1]'].includes(base.hostname);
assert(!base.username&&!base.password&&!base.search&&!base.hash&&base.pathname.endsWith('/'));
assert(local&&['http:','https:'].includes(base.protocol)||base.href==='https://yoonjl-svg.github.io/halfsword-codex/');
const sha=x=>createHash('sha256').update(x).digest('hex');
async function scan(dir){const out=[];for(const e of(await fs.readdir(path.join(root,dir),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){assert(!e.isSymbolicLink());const n=dir+'/'+e.name;if(e.isDirectory())out.push(...await scan(n));else if(e.isFile())out.push(n);}return out;}
const files=[...(await scan('src')).filter(x=>x.endsWith('.js')),own,'index.html','public/feature-lab.html','package.json','package-lock.json',...await scan('dist')].sort();
async function manifest(){return Object.fromEntries(await Promise.all(files.map(async n=>{const b=await fs.readFile(path.join(root,n));return[n,{bytes:b.length,sha256:sha(b)}];})));}
const before=await manifest(),head=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const startedUTC=new Date().toISOString(), startedWall=performance.now(), wallDeadline=startedWall+150000;await fs.writeFile(path.join(out,'manifest-before.json'),JSON.stringify({head,files:before},null,2)+'\n',{flag:'wx'});
const seeds={difficulty:'normal',pixel:false,blood:true,sound:false,invertTilt:false,moveMode:'stick',skill:'0.7',guardNames:true,trail:false,fpsCap:false};
const settingsBytes=JSON.stringify(seeds),errors=[],requests=[],compiled=[],fileChecks=[],inputRequests=[],shots=[],responseTasks=[];
const launch={executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-background-networking','--use-gl=angle','--use-angle=swiftshader']};
const secrets=[];if(!local){const raw=process.env.HTTPS_PROXY||process.env.https_proxy||process.env.HTTP_PROXY||process.env.http_proxy;assert(raw);const p=new URL(raw);launch.proxy={server:p.protocol+'//'+p.host};if(p.username)launch.proxy.username=decodeURIComponent(p.username);if(p.password)launch.proxy.password=decodeURIComponent(p.password);secrets.push(raw,p.username,p.password,launch.proxy.username,launch.proxy.password);}
const clean=x=>{let s=String(x);for(const v of secrets.filter(Boolean))s=s.split(v).join('[redacted]');return s.replace(/https?:\/\/[^\s/@:]+:[^\s/@]+@/gi,'https://[redacted]@').slice(0,5000);};
const confined=value=>{try{const u=new URL(value);if(u.protocol==='data:')return true;if(u.protocol==='blob:')return new URL(u.pathname).origin===base.origin;const p=decodeURIComponent(u.pathname);return!u.username&&!u.password&&u.origin===base.origin&&u.pathname.startsWith(base.pathname)&&p.startsWith(decodeURIComponent(base.pathname))&&!p.includes('\\')&&!p.split('/').some(x=>x==='..'||x==='.');}catch{return false;}};
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/workspace/cloud-onboarding/browser/node_modules/playwright/index.mjs');
let browser,context,page,cdp,fatal=null,episode=null,pass=false;
const flow={entries:[]},checks={},clockLimits=[];const entryURL=new URL(base);entryURL.searchParams.set('foe','bran');
await fs.copyFile(path.join(root,own),path.join(out,'executed-tool.mjs'));
const remaining=()=>wallDeadline-performance.now();
async function waitFor(fn,arg,maximum=10000){
 const timeout=Math.max(100,Math.min(maximum,remaining()-1500));
 try{return await page.waitForFunction(fn,arg,{timeout});}catch(e){if(e.name==='TimeoutError')clockLimits.push({kind:'condition_timeout',wallMs:performance.now()-startedWall,maximum,remaining:remaining()});throw e;}
}
const snap=()=>page.evaluate(()=>openingProbe.read());
const clearInput=r=>{assert.equal(r.input.activeTouch,null);assert.equal(r.input.press,null);assert.deepEqual(r.input.pending,[0,0]);assert.deepEqual(r.input.stick,[0,0]);};
function policy(r){
 assert.equal(r.url,entryURL.href);assert(r.default.active&&r.default.reason==='ordinary_entry'&&r.default.blockedBy.length===0);
 assert.equal(r.saved,settingsBytes);assert.deepEqual(r.settings,seeds);assert.equal(r.enemy.name,'오소리 브란');assert.equal(r.ai.level,'easy');
 assert.equal(r.policies.startHold,2);assert.equal(r.policies.gravity,-9.81);assert.equal(r.policies.finish,'legacy');assert.equal(r.policies.limb,true);
 assert.equal(r.policies.stance,'fresh');assert.equal(r.policies.roll,r.player.gun?'legacy':'bounded');
 const expectedCut=!r.player.gun&&r.player.edged?'centerline':'legacy';assert.equal(r.policies.cut,expectedCut);assert.equal(r.policies.cutPlayer,expectedCut==='centerline');
 const expectedV2=!r.player.gun&&!['monohoshizao','lightsaber'].includes(r.player.weapon)&&!r.player.trialOnly;
 assert.equal(r.policies.v2,expectedV2?'unified':'legacy');if(expectedV2){assert.equal(r.policies.arm,'manual');assert.equal(r.policies.skill,0);assert.equal(r.policies.autoGuard,false);}
 assert.equal(r.policies.enemyController,'legacy');assert.equal(r.policies.enemyArm,'legacy');
}
try{
 browser=await chromium.launch(launch);context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,ignoreHTTPSErrors:false,serviceWorkers:'block'});context.setDefaultTimeout(10000);
 await context.addInitScript(bytes=>localStorage.setItem('gladiator-settings',bytes),settingsBytes);
 await context.route('**/*',async route=>{const url=route.request().url();if(!confined(url)){errors.push({kind:'blocked',url:clean(url)});await route.abort('blockedbyclient');return;}try{const r=await route.fetch({maxRedirects:0,maxRetries:2});if(r.status()>=300&&r.status()<400){errors.push({kind:'redirect',url:clean(url),status:r.status()});await route.abort('blockedbyclient');return;}await route.fulfill({response:r});}catch(e){errors.push({kind:'route',url:clean(url),message:clean(e.message)});await route.abort('failed');}});
 if(context.routeWebSocket)await context.routeWebSocket('**/*',s=>{errors.push({kind:'websocket',url:clean(s.url())});s.close();});
 page=await context.newPage();page.on('pageerror',e=>errors.push({kind:'pageerror',message:clean(e.message)}));page.on('console',m=>{if(m.type()==='error')errors.push({kind:'console',message:clean(m.text())});});page.on('requestfailed',r=>errors.push({kind:'requestfailed',url:clean(r.url()),message:clean(r.failure()?.errorText)}));
 page.on('response',r=>{if(r.status()>=400)errors.push({kind:'http',url:clean(r.url()),status:r.status()});const u=new URL(r.url());if(!confined(u.href))return;const relative=u.pathname.slice(base.pathname.length);if(relative&&!(relative.startsWith('assets/')&&relative.endsWith('.js')))return;responseTasks.push((async()=>{const b=await r.body(),name='dist/'+(relative||'index.html'),expected=before[name];compiled.push({name,bytes:b.length,sha256:sha(b),match:!!expected&&b.length===expected.bytes&&sha(b)===expected.sha256});})().catch(e=>errors.push({kind:'asset',message:clean(e.message)})));});
 await page.goto(entryURL.href,{waitUntil:'load',timeout:25000});await waitFor(()=>window.game?.ai&&game?.combat&&game?.swordsmanshipDefault);cdp=await context.newCDPSession(page);
 await page.evaluate(()=>{
  const p=window.openingProbe={round:0,steps:0,aiCalls:0,freeCalls:0,nonfinite:0,ids:new WeakMap(),nextId:1,firstSeen:new WeakSet(),last:new WeakMap(),sampleT:new WeakMap(),firstAI:[],samples:[],transitions:[],calls:[],progress:[],completedStrikes:[],native:[],damage:[],dropped:{samples:0,transitions:0,calls:0,progress:0,native:0,damage:0}};
  const id=o=>{if(!p.ids.has(o))p.ids.set(o,p.nextId++);return p.ids.get(o);};
  const vector=v=>[v.x,v.y];const push=(key,value,cap)=>{if(p[key].length<cap)p[key].push(value);else p.dropped[key]++;};
  const aiRead=a=>({id:id(a),round:p.round,simTime:game.stats.simTime,fightT:a.me.fightT,level:a.levelName,mode:a.mode,phase:a.phase,why:a.why??null,tech:a.tech?.name??null,patience:a.patience,emotion:a.emotion??null,anger:a.anger,feetHeld:a.me.feetHeld,state:a.me.state,alive:a.me.alive,armed:a.me.armed,attackT:a.attackT,timer:a.timer,pathLength:a.path.length,pathFirst:a.path[0]?.slice()??null,hand:vector(a.hand),offset:vector(a.me.handOffset),handSpeed:a.handSpeed,foeLat:a.foeLat??null,stepT:a.stepT,move:vector(a.me.move),gap:Math.hypot(a.me.pelvisPos.x-a.foe.pelvisPos.x,a.me.pelvisPos.z-a.foe.pelvisPos.z),stats:Object.fromEntries(Object.entries(a.stats).filter(([,v])=>v===null||['number','string','boolean'].includes(typeof v)))});
  const health=f=>({id:id(f),name:f.name,weapon:f.weapon.id,gun:!!f.weapon.gun,edged:!!f.weapon.edged,trialOnly:!!f.weapon.trialOnly,state:f.state,alive:f.alive,armed:f.armed,fightT:f.fightT,feetHeld:f.feetHeld,blood:f.blood,wounds:f.wounds.length,detached:f.detachedParts?.size??0,move:vector(f.move),position:[f.pelvisPos.x,f.pelvisPos.y,f.pelvisPos.z]});
  p.read=()=>({wallMs:performance.now(),round:p.round,url:location.href,state:game.state,simTime:game.stats.simTime,objects:{player:id(game.player),enemy:id(game.enemy),world:id(game.world),combat:id(game.combat),ai:id(game.ai)},ai:aiRead(game.ai),player:health(game.player),enemy:health(game.enemy),default:{...game.swordsmanshipDefault},policies:{v2:game.player.swordsmanshipModel??'legacy',arm:game.player.onehandArmModel,skill:game.player.skill.level,autoGuard:game.player.skill.autoGuard,stance:game.player.stanceMemoryModel,roll:game.player.rollTargetModel,cut:game.combat.cutReactionModel,cutPlayer:game.combat.cutReactionFighter===game.player,limb:game.config.COMBAT.limbSeverTrial,finish:game.combat.finishRuleModel,gravity:game.world.gravity.y,startHold:game.config.ARENA.startHold,enemyController:game.enemy.swordsmanshipModel??'legacy',enemyArm:game.enemy.onehandArmModel},input:{enabled:game.input.enabled,activeTouch:game.input.activeTouch,press:game.input.press?{id:game.input.press.id}:null,pending:[game.input.handDX,game.input.handDY],stick:vector(game.input.stickMove)},settings:{...game.settings},saved:localStorage.getItem('gladiator-settings'),cards:{stage:game.draw.stage,t:game.draw.t,ids:[...game.draw.ids],pick:game.draw.pick},stage:{...game.stage}});
  const ap=Object.getPrototypeOf(game.ai),update=ap.update;
  ap.update=function(...args){const before=aiRead(this),ret=update.apply(this,args);if(this!==game.ai)return ret;p.aiCalls++;if(this.me.alive&&!this.me.feetHeld)p.freeCalls++;const after=aiRead(this);
   if(!p.firstSeen.has(this)){p.firstSeen.add(this);p.firstAI.push({before,after});}
   const signature=x=>JSON.stringify([x.mode,x.phase,x.pathLength,x.feetHeld,x.state,x.alive,x.armed]);const last=p.last.get(this);
   if(!last||signature(last)!==signature(after))push('transitions',{before:last??before,after},192);
   if(before.mode==='attack'&&before.phase==='strike'&&after.mode==='attack'&&after.phase==='follow')p.completedStrikes.push({before,after});
   if(!p.sampleT.has(this)||this.me.fightT-p.sampleT.get(this)>=.2){push('samples',after,100);p.sampleT.set(this,this.me.fightT);}
   p.last.set(this,after);return ret;};
  for(const name of ['startAttack','startStrike','abortAttack','afterStrike']){const original=ap[name];ap[name]=function(...args){const before=aiRead(this),ret=original.apply(this,args);if(this===game.ai)push('calls',{method:name,accepted:name==='startAttack'?ret:null,before,after:aiRead(this)},80);return ret;};}
  const moveHand=ap.moveHand;ap.moveHand=function(...args){const before=aiRead(this),ret=moveHand.apply(this,args);if(this===game.ai&&this.path.length!==before.pathLength)push('progress',{dt:args[0],before,after:aiRead(this)},60);return ret;};
  const cp=Object.getPrototypeOf(game.combat),afterStep=cp.afterStep;cp.afterStep=function(...args){const ret=afterStep.apply(this,args);if(this===game.combat){p.steps++;if(p.steps%24===0)for(const f of [game.player,game.enemy])if(![...Object.values(f.bodies),f.sword].every(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].every(v=>Object.values(v).every(Number.isFinite))))p.nonfinite++;}return ret;};
  const fp=Object.getPrototypeOf(game.player),apply=fp.applyWound;fp.applyWound=function(h){const ret=apply.call(this,h);push('damage',{round:p.round,simTime:game.stats.simTime,victim:this===game.player?'player':'enemy',type:h.type,part:h.part,severity:h.severity,blood:this.blood,wounds:this.wounds.length},32);return ret;};
  for(const type of ['pointerdown','pointermove','pointerup','pointercancel'])document.addEventListener(type,e=>push('native',{type,trusted:e.isTrusted,kind:e.pointerType,target:e.target.closest?.('button')?.id||e.target.id,card:e.target.closest?.('.wcard')?.dataset.i??null,round:p.round,simTime:game.stats.simTime,x:e.clientX,y:e.clientY},160),true);
  p.export=()=>({steps:p.steps,aiCalls:p.aiCalls,freeCalls:p.freeCalls,nonfiniteSamples:p.nonfinite,firstAI:p.firstAI,samples:p.samples,transitions:p.transitions,calls:p.calls,progress:p.progress,completedStrikes:p.completedStrikes,native:p.native,damage:p.damage,dropped:p.dropped,final:p.read()});
 });
 flow.menu=await snap();policy(flow.menu);clearInput(flow.menu);
 async function send(type,points){inputRequests.push({type,points:points.map(x=>({...x}))});await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});}
 async function enter(round){
  const record={round,startWallMs:performance.now()-startedWall};flow.entries.push(record);await page.evaluate(n=>{openingProbe.round=n;},round);await page.locator('#btnStart').tap();
  await waitFor(()=>game.state==='draw'&&game.draw.stage==='choose'&&game.draw.t>=.5,null,45000);const offered=await snap();record.offered=offered.cards;
  await page.locator('#draw button[data-i="0"]').tap();await waitFor(()=>game.state==='fight'||game.draw.stage==='reveal'&&game.draw.t>=1||game.draw.stage==='fly',null,45000);
  const revealed=await snap();record.revealed={wallMs:performance.now()-startedWall,cards:revealed.cards,state:revealed.state};
  // Real skipReveal accepts t >= .95; tapping earlier is deliberately ignored by the game.
  if(revealed.state==='draw'&&revealed.cards.stage==='reveal')await page.locator('#draw button[data-i="0"]').tap();
  await waitFor(()=>game.state==='fight'&&game.player.fightT>0,null,45000);const started=await snap();policy(started);assert.equal(started.player.weapon,offered.cards.ids[0]);assert.equal(started.enemy.weapon,offered.cards.ids[2]);record.fightWallMs=performance.now()-startedWall;
  console.log(JSON.stringify({event:'round-start',round,weapon:started.player.weapon,foeWeapon:started.enemy.weapon,patience:started.ai.patience,held:started.enemy.feetHeld,simTime:started.simTime,wallMs:record.fightWallMs}));return{offered:offered.cards,started};
 }
 flow.first=await enter(1);
 const pad=await page.locator('#moveStick').boundingBox();assert(pad);const stick={x:pad.x+pad.width/2,y:pad.y+pad.height/2-30,id:1};await send('touchStart',[{...stick,y:stick.y+30}]);await send('touchMove',[stick]);let stickHeld=true;
 const observeDeadline=Math.min(wallDeadline-45000,performance.now()+60000);let stopReason='unknown';
 while(true){const status=await page.evaluate(()=>({state:game.state,fightT:game.player.fightT,simTime:game.stats.simTime,complete:openingProbe.completedStrikes[0]?.after.fightT??null,phase:game.ai.phase,attacks:game.ai.stats.attacks}));
  if(stickHeld&&status.fightT>=3.2){await send('touchEnd',[]);stickHeld=false;}
  if(status.state!=='fight'){stopReason='natural_terminal';break;}
  if(status.complete!==null&&status.fightT>=status.complete+.3){stopReason='strike_follow_exposed';break;}
  if(status.simTime>=10.8){stopReason='simulation_limit';break;}
  if(performance.now()>=observeDeadline){stopReason='wall_budget_reserves_lifecycle';clockLimits.push({kind:stopReason,simTime:status.simTime,wallMs:performance.now()-startedWall});break;}
  await page.waitForTimeout(150);
 }
 flow.observationEnd=await snap();flow.stopReason=stopReason;
 if(flow.observationEnd.state==='fight'){
  if(!stickHeld){await send('touchStart',[{...stick,y:stick.y+30}]);await send('touchMove',[stick]);stickHeld=true;}
  const pauseBox=await page.locator('#btnPause').boundingBox();assert(pauseBox);const touchPause={x:pauseBox.x+pauseBox.width/2,y:pauseBox.y+pauseBox.height/2,id:2};
  await send('touchStart',[stick,touchPause]);await send('touchEnd',[stick]);await waitFor(()=>game.state==='paused');flow.paused=await snap();clearInput(flow.paused);await send('touchEnd',[]);stickHeld=false;await page.waitForTimeout(120);flow.pauseLater=await snap();assert.equal(flow.pauseLater.simTime,flow.paused.simTime);assert.deepEqual(flow.pauseLater.objects,flow.paused.objects);
  await page.locator('#btnResume').tap();await waitFor(()=>game.state==='fight');flow.resumed=await snap();assert.deepEqual(flow.resumed.objects,flow.paused.objects);clearInput(flow.resumed);
  await send('touchStart',[{x:675,y:240,id:3}]);await send('touchMove',[{x:650,y:195,id:3}]);flow.newInputHeld=await snap();assert.notEqual(flow.newInputHeld.input.activeTouch,null,'Native post-resume touch did not enter the real hand input');assert.equal(flow.newInputHeld.input.enabled,true);await waitFor(t=>game.stats.simTime>t||game.state!=='fight',flow.resumed.simTime,3500);await send('touchEnd',[]);flow.newInput=await snap();
  if(flow.newInput.state==='fight'){await page.locator('#btnPause').tap();await waitFor(()=>game.state==='paused');checks.pauseResumeNewInput=true;}else checks.pauseResumeNewInput=false;
 }else{await send('touchEnd',[]);checks.pauseResumeNewInput=false;}
 flow.beforeRestart=await snap();flow.restart=await enter(2);for(const k of Object.keys(flow.restart.started.objects))assert.notEqual(flow.restart.started.objects[k],flow.beforeRestart.objects[k]);assert.equal(flow.restart.started.player.wounds,0);assert.equal(flow.restart.started.enemy.wounds,0);assert.equal(flow.restart.started.player.detached,0);assert.equal(flow.restart.started.enemy.detached,0);
 await page.locator('#btnPause').tap();await waitFor(()=>game.state==='paused');flow.final=await snap();policy(flow.final);clearInput(flow.final);
 await page.screenshot({path:path.join(out,'restart-paused.png')});shots.push('restart-paused.png');episode=await page.evaluate(()=>openingProbe.export());
 const first=episode.firstAI.filter(x=>[1,2].includes(x.before.round));checks.freshBranPatience=first.length===2&&first.every(x=>x.before.feetHeld&&Math.abs(x.before.patience-.2)<1e-12);
 const held=episode.samples.filter(x=>x.round===1&&x.feetHeld&&x.state==='stand');const free=episode.samples.filter(x=>x.round===1&&!x.feetHeld);
 checks.holdAndRelease=held.length>0&&free.length>0&&held.every(x=>Math.abs(x.patience-.2)<1e-12&&x.mode==='watch'&&x.stats.attacks===0);
 checks.approach=episode.transitions.some(x=>x.after.mode==='attack'&&x.after.phase==='approach');checks.firstAttack=episode.calls.some(x=>x.method==='startAttack'&&x.accepted);
 checks.strike=episode.calls.some(x=>x.method==='startStrike');checks.strikeToFollow=episode.completedStrikes.length>0;checks.pathProgress=episode.progress.some(x=>x.after.pathLength<x.before.pathLength);
 checks.nativeTouch=episode.native.length>0&&episode.native.every(x=>x.trusted&&x.kind==='touch');checks.restart=true;checks.simulationBudget=episode.final.simTime<=12;checks.wallBudget=performance.now()-startedWall<=150000;
 assert.equal(episode.nonfiniteSamples,0);assert(episode.freeCalls>0);assert(checks.nativeTouch);assert(checks.simulationBudget);await Promise.all(responseTasks);assert(compiled.some(x=>x.name==='dist/index.html')&&compiled.some(x=>x.name.startsWith('dist/assets/main-')));assert(compiled.every(x=>x.match));assert.deepEqual(errors,[]);
 checks.deliveryIntegrity=true;
 // The game is already paused and exported. Reuse this page for static phone-plan checks.
 await cdp.detach();cdp=null;const planResponse=await page.goto(new URL('development-plan.html',base).href,{waitUntil:'load',timeout:10000});assert.equal(planResponse.status(),200);const planBytes=await planResponse.body(),planExpected=before['dist/development-plan.html'];const planMatch=planBytes.length===planExpected.bytes&&sha(planBytes)===planExpected.sha256;assert(planMatch);flow.phonePlan={sha256:sha(planBytes),match:planMatch,views:[]};
 for(const viewport of [{width:390,height:844},{width:844,height:390}]){await page.setViewportSize(viewport);const layout=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,firstHeading:document.querySelector('main h2')?.textContent??null}));assert.equal(layout.scrollWidth,layout.width);assert.equal(layout.firstHeading,'4단계 · 상대 첫 공방 결함 수정 · 10/07');flow.phonePlan.views.push(layout);const name=`phone-plan-${viewport.width}x${viewport.height}.png`;await page.screenshot({path:path.join(out,name)});shots.push(name);}
 checks.phonePlan=true;await Promise.all(responseTasks);assert.deepEqual(errors,[]);pass=Object.values(checks).every(Boolean);
}catch(e){fatal={name:e.name,message:clean(e.message),stack:clean(e.stack)};process.exitCode=1;try{if(page&&!episode)episode=await page.evaluate(()=>window.openingProbe?.export()??null);}catch{}}
finally{
 if(cdp)await cdp.detach().catch(()=>{});await Promise.all(responseTasks);if(context)await context.close();if(browser)await browser.close();const after=await manifest(),headAfter=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();const sourceStable=JSON.stringify(before)===JSON.stringify(after)&&head===headAfter;checks.wallBudget=performance.now()-startedWall<=150000;if(!checks.wallBudget)clockLimits.push({kind:'total_wall_limit',wallMs:performance.now()-startedWall});pass=pass&&sourceStable&&checks.wallBudget&&errors.length===0;if(!pass)process.exitCode=1;
 const report={pass,passMeaning:'Full pass requires delivered/source integrity, natural hold/attack/strike-to-follow exposure, native pause/resume/new input and fresh restart. Clock-limited unexposed behavior does not pass.',sourceStable,head,headAfter,startedUTC,completedUTC:new Date().toISOString(),wallMs:performance.now()-startedWall,base:base.href,entryURL:entryURL.href,scenario:'Character-selected ordinary card entry (?foe=bran only), card0 without forcing offers, first hold/approach/attack/strike/follow then pause/resume and one minimal restart.',settings:seeds,checks,clockLimits,flow,episode,compiled,errors,fatal,inputRequests,shots,limits:['One local and one public are separate randomized real episodes, not a deterministic replay or AI win-rate measurement.','Original prototype methods are forwarded; observers store capped primitive state transitions and samples. No RNG, character state, pose, velocity, AI or damage injection.','Physics samples use real RAF/substeps; observation stops at 10.8 cumulative simulation seconds to reserve a total 12-second lifecycle budget, or the wall budget, or first strike-to-follow plus 0.3s.','150-second wall budget includes browser initialization. Card entry may wait up to 45 seconds for capped animation/software-render frames. Slow navigation/control timeouts remain failures or clock-limit evidence; no retry/seed search is automatic.','Bran may naturally receive the alternative weapon. The selected player card may be a gun or a withheld-v2 weapon; ordinary feature applicability is checked from actual weapon properties.','A stored AI path completion/phase transition is controller output; natural body/contact/damage is recorded separately and is not inferred from phase names.'],tlsVerification:true,proxyRetained:!local,redirectsFollowed:false};
 await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({pass,sourceStable,checks,stopReason:flow.stopReason,simTime:episode?.final?.simTime,wallMs:report.wallMs,fatal,out}));
}
