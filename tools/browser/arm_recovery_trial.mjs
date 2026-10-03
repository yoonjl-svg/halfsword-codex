// Real local mobile input and first-step contract; no body/AI/health injection.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=new URL(process.argv[2]||'http://127.0.0.1:4191/');
assert.ok(['localhost','127.0.0.1','[::1]'].includes(base.hostname));
const out=process.env.ARM_RECOVERY_OUT||'/tmp/arm-recovery-mobile.json';
const files=['src/main.js','src/fighter.js','src/arm_recovery_activation.js','src/arm_recovery_trial.js','src/edge_torque.js','src/edge_torque_trial.js','src/target_correction_trial.js','src/input.js','src/config.js','public/feature-lab.html'];
const hashes=async()=>Object.fromEntries(await Promise.all(files.map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])));
const before=await hashes(),begin=Date.now(),rows=[],errors=[];let pass=false;
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await ctx.newPage();
page.on('pageerror',e=>errors.push(String(e)));
page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
const layout=()=>page.evaluate(()=>({width:innerWidth,scroll:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)}));
const checkLayout=s=>assert.ok(s.scroll<=s.width+1);
const snap=()=>page.evaluate(()=>{
  const g=game,p=g.player;
  const finite=f=>[...Object.values(f.bodies),f.sword].every(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].every(v=>Object.values(v).every(Number.isFinite)));
  return {trial:g.armRecoveryTrial,model:p.armRecoveryModel??'legacy',modelOwn:Object.hasOwn(p,'armRecoveryModel'),enemyModel:g.enemy.armRecoveryModel??'legacy',enemyModelOwn:Object.hasOwn(g.enemy,'armRecoveryModel'),
    weapon:p.weapon.id,level:p.skill.level,autoGuard:p.skill.autoGuard,difficulty:g.ai.levelName,enemyLevel:g.enemy.skill.level,
    arm:g.armTrial.model,cut:g.combat.cutReactionModel,edge:p.edgeTorqueModel??'legacy',edgeIntent:p.edgeIntentModel??null,held:p.handHeld,handOffset:p.handOffset.toArray(),thrusts:p.skill.thrusts,simTime:g.stats.simTime,state:g.state,
    saved:JSON.parse(localStorage.getItem('gladiator-settings')),settings:{skill:g.settings.skill,difficulty:g.settings.difficulty},menuVisible:document.getElementById('menu').classList.contains('show'),
    finite:finite(p)&&finite(g.enemy),info:document.getElementById('armRecoveryTrialInfo')?.textContent??'',
    first:window.armRecoveryProbe??{controllers:[],worlds:[]}};
});
const install=()=>page.evaluate(()=>{
  const probe=window.armRecoveryProbe={controllers:[],worlds:[]},players=new WeakSet(),worlds=new WeakSet();
  const record=()=>({model:game.player.armRecoveryModel??'legacy',modelOwn:Object.hasOwn(game.player,'armRecoveryModel'),enemy:game.enemy.armRecoveryModel??'legacy',enemyOwn:Object.hasOwn(game.enemy,'armRecoveryModel'),level:game.player.skill.level,autoGuard:game.player.skill.autoGuard,simTime:game.stats.simTime});
  const fp=Object.getPrototypeOf(game.player),fstep=fp.step;
  fp.step=function(...args){if(this===game.player&&!players.has(this)){players.add(this);probe.controllers.push(record());}return fstep.apply(this,args);};
  const wp=Object.getPrototypeOf(game.world),wstep=wp.step;
  wp.step=function(...args){if(this===game.world&&!worlds.has(this)){worlds.add(this);probe.worlds.push(record());}return wstep.apply(this,args);};
});
function preferences(s){assert.equal(Object.hasOwn(s.saved,'armRecoveryModel'),false);assert.equal(Object.hasOwn(s.saved,'armRecoveryTrial'),false);assert.equal(s.saved.skill,'0.7');assert.equal(s.saved.difficulty,'hard');assert.deepEqual(s.settings,{skill:'0.7',difficulty:'hard'});}
function contract(s,weapon,model){
  preferences(s);assert.equal(s.trial.active,true);assert.equal(s.trial.model,model);assert.equal(s.model,model);assert.equal(s.modelOwn,true);
  assert.equal(s.enemyModel,'legacy');assert.equal(s.enemyModelOwn,false);assert.equal(s.edgeIntent,null);
  assert.equal(s.weapon,weapon);assert.equal(s.level,0);assert.equal(s.autoGuard,false);assert.equal(s.difficulty,'normal');assert.equal(s.enemyLevel,.7);
  assert.equal(s.arm,'legacy');assert.equal(s.cut,'legacy');assert.equal(s.edge,'legacy');assert.ok(s.finite&&s.info.includes('한손 회복 비교'));
  for(const first of [...s.first.controllers,...s.first.worlds]){assert.equal(first.model,model);assert.equal(first.modelOwn,true);assert.equal(first.enemy,'legacy');assert.equal(first.enemyOwn,false);assert.equal(first.level,0);assert.equal(first.autoGuard,false);}
}
async function start(){await page.locator('#btnStart').tap();await page.waitForFunction(()=>game.state==='fight'&&armRecoveryProbe.worlds.length>0);const t=await page.evaluate(()=>game.stats.simTime);await page.waitForFunction(t=>game.stats.simTime>t+.1,t,{timeout:60000});}
async function inputs(){
  const cdp=await ctx.newCDPSession(page),point=(x,y)=>[{x,y,id:1}];
  const send=(type,points,t)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points,timestamp:t});
  const pre=await snap(),t=Date.now()/1000;
  await send('touchStart',point(620,170),t);await send('touchEnd',[],t+.08);
  await page.waitForFunction(n=>game.player.skill.thrusts===n+1,pre.thrusts);const tap=await snap();
  await page.waitForFunction(()=>!game.player.skill.tap,null,{timeout:60000});
  const before=await snap(),t2=Date.now()/1000;
  await send('touchStart',point(620,170),t2);await page.waitForFunction(()=>game.player.handHeld);
  for(let n=1;n<=3;n++){await send('touchMove',point(620+8*n,170-6*n),t2+n*.06);await page.waitForTimeout(60);}
  const drag=await snap();await send('touchEnd',[],t2+.25);await page.waitForFunction(()=>!game.player.handHeld);const released=await snap();
  const t3=Date.now()/1000;await send('touchStart',point(644,152),t3);await page.waitForFunction(()=>game.player.handHeld);
  await send('touchMove',point(636,164),t3+.10);await page.waitForTimeout(120);const reinput=await snap();
  await send('touchEnd',[],t3+.25);await page.waitForFunction(()=>!game.player.handHeld);const final=await snap();
  assert.ok(drag.held&&reinput.held&&!released.held&&!final.held&&final.finite&&final.simTime>before.simTime);
  assert.equal(final.thrusts,before.thrusts);assert.ok(Math.hypot(...drag.handOffset.map((v,i)=>v-before.handOffset[i]))>1e-5);
  await cdp.detach();return {pre,tap,before,drag,released,reinput,final};
}
try{
  await page.goto(new URL('feature-lab.html',base).href,{waitUntil:'networkidle'});const landing=await layout();checkLayout(landing);
  assert.equal(await page.locator('#arm-recovery-comparison a[href*="armRecoveryTrial="]').count(),2);
  const links=await page.evaluate(()=>Object.fromEntries([...document.querySelectorAll('#arm-recovery-comparison a')].map(a=>[a.id,a.href])));
  const a=new URL(links.playArmRecoveryLegacy),b=new URL(links.playArmRecoveryIndependent);
  assert.equal(a.searchParams.get('armRecoveryTrial'),'legacy');assert.equal(b.searchParams.get('armRecoveryTrial'),'independent');
  for(const url of [a,b])for(const [key,value] of Object.entries({weapon:'sabre',foeWeapon:'longsword',foe:'default',armTrial:'legacy',cutTrial:'legacy',targetCorrection:'none',edgeTrial:'legacy',supportProbe:'1',assist:'0.3',catch:'on',catchScale:'1'}))assert.equal(url.searchParams.get(key),value);
  a.searchParams.delete('armRecoveryTrial');b.searchParams.delete('armRecoveryTrial');assert.equal(a.href,b.href);
  await page.evaluate(()=>localStorage.setItem('gladiator-settings',JSON.stringify({skill:'0.7',difficulty:'hard',moveMode:'stick',sound:false})));
  for(const choice of ['Legacy','Independent']){
    const weapon='sabre',model=choice.toLowerCase(),id='playArmRecovery'+choice,url=links[id];
    await page.setViewportSize({width:390,height:844});await page.goto(new URL('feature-lab.html#arm-recovery-comparison',base).href,{waitUntil:'networkidle'});
    await Promise.all([page.waitForURL(url,{waitUntil:'networkidle'}),page.locator('#'+id).tap()]);await page.waitForFunction(()=>window.game?.player?.sword);
    const row={weapon,model,url,landing,portrait:await layout(),menu:await snap()};rows.push(row);checkLayout(row.portrait);contract(row.menu,weapon,model);assert.equal(row.menu.menuVisible,true);
    await page.setViewportSize({width:844,height:390});checkLayout(await layout());
    await page.locator('[data-setting=trail]').tap();contract(await snap(),weapon,model);
    await install();await start();row.started=await snap();contract(row.started,weapon,model);assert.equal(row.started.first.controllers.length,1);assert.equal(row.started.first.worlds.length,1);
    row.native=await inputs();contract(row.native.final,weapon,model);
    await page.locator('#btnPause').tap();await page.waitForFunction(()=>game.state==='paused');row.paused=await snap();contract(row.paused,weapon,model);assert.equal(row.paused.menuVisible,true);await page.waitForTimeout(150);assert.equal((await snap()).simTime,row.paused.simTime);await start();await page.waitForFunction(()=>armRecoveryProbe.worlds.length===2);
    row.restarted=await snap();contract(row.restarted,weapon,model);assert.equal(row.restarted.first.controllers.length,2);
    await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>window.game?.player?.sword);await install();await start();row.reload=await snap();contract(row.reload,weapon,model);
    await page.locator('#btnPause').tap();await page.waitForFunction(()=>game.state==='paused');await page.locator('#armRecoveryTrialInfo a').tap();await page.waitForURL('**/feature-lab.html#arm-recovery-comparison');checkLayout(await layout());
  }
  for(const query of ['weapon=sabre&foe=default&armRecoveryTrial=unknown','weapon=sabre&foe=default']){
    const url=new URL(base);url.search=query;await page.goto(url.href,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.game?.player?.sword);
    const s=await snap();preferences(s);assert.equal(s.trial.active,false);assert.equal(s.modelOwn,false);assert.equal(s.model,'legacy');assert.equal(s.info,'');assert.equal(s.level,.7);assert.equal(s.autoGuard,true);assert.equal(s.difficulty,'hard');assert.equal(s.enemyModelOwn,false);assert.equal(s.menuVisible,true);checkLayout(await layout());
    await install();await start();const started=await snap();preferences(started);assert.equal(started.modelOwn,false);assert.equal(started.enemyModelOwn,false);assert.equal(started.level,.7);assert.equal(started.difficulty,'hard');assert.ok(started.finite);
    for(const first of [...started.first.controllers,...started.first.worlds]){assert.equal(first.modelOwn,false);assert.equal(first.enemyOwn,false);assert.equal(first.level,.7);assert.equal(first.autoGuard,true);}
    rows.push({type:query.includes('unknown')?'invalid':'ordinary',menu:s,started});
  }
  assert.deepEqual(await hashes(),before);assert.deepEqual(errors,[]);pass=true;console.log('Arm recovery mobile:2 real A/B links + native tap/drag/reinput + first-step/restart/reload + invalid/ordinary preference return PASS');
}finally{
  const after=await hashes();await writeFile(out,JSON.stringify({pass,sourceBefore:before,sourceAfter:after,sourceStable:JSON.stringify(before)===JSON.stringify(after),base:base.href,wallSeconds:(Date.now()-begin)/1000,rows,errors,scope:'Local built-game menu/link/round contract and real browser touch input, with no body/AI/health injection. Browser smoke does not establish injury recovery effectiveness, human feel, or long-combat acceptance; physical effects require separate actual-contact headless verification.'},null,2)+'\n');await browser.close();
}
