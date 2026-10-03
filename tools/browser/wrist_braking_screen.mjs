// Compiled optional wrist-stopping comparison. Real touch; live AI and contacts.
// No experimental physics writes: production URL applies the model before creation.
// Optional side camera only changes presentation.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const out=process.argv[2]; assert.ok(out); await fs.mkdir(out,{recursive:false});
const engage=true;assert.ok(process.argv.length===3||process.argv.length===4);
const base=process.argv[3]??'http://127.0.0.1:4198/';
assert.ok(base==='http://127.0.0.1:4198/'||base==='https://yoonjl-svg.github.io/halfsword-codex/');
const launch={executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-background-networking','--use-gl=angle','--use-angle=swiftshader']};
if(base.startsWith('https:')){const p=new URL(process.env.HTTPS_PROXY||process.env.HTTP_PROXY);launch.proxy={server:`${p.protocol}//${p.host}`};}
const browser=await chromium.launch(launch);
const results=[];
try {
  for(const weapon of ['sabre','zweihander'])for(const mode of ['legacy','available']){
    const dir=path.join(out,weapon+'-'+mode);await fs.mkdir(dir);
    const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,recordVideo:{dir,size:{width:844,height:390}}});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
    try {
      await page.goto(`${base}?weapon=${weapon}&foeWeapon=longsword&foe=default&targetCorrection=none&mobileVerticalGain=1.35&wristBraking=${mode}`);
      await page.waitForFunction(()=>window.game?.player?.sword,{timeout:60000});
      await page.evaluate(({mode,engage})=>{
        const g=game,probe=window.dragVisual={mode,engage,first:[],samples:[],touch:[],consumed:[],steps:0,clashes:[],wounds:[]};
        window.wristRoundReference={player:g.player,enemy:g.enemy,world:g.world,combat:g.combat};
        probe.savedBefore=localStorage.getItem('gladiator-settings');
        if(engage)game.freeCam=true; // Existing presentation-only debug camera.
        const players=new WeakSet(),fp=Object.getPrototypeOf(g.player),original=fp.step;
        const props=f=>JSON.stringify({p:f.sword.translation(),q:f.sword.rotation(),v:f.sword.linvel(),w:f.sword.angvel(),m:f.sword.mass(),I:f.sword.principalInertia(),com:f.sword.localCom(),frame:f.sword.principalInertiaLocalFrame()});
        fp.step=function(...args){
          if(this===game.player){
            if(!players.has(this)){
              players.add(this);const before=props(this),old=this.sword.angularDamping(),oldMargin=this.weaponCfg.releaseMargin;
              probe.first.push({timeS:game.stats.simTime,model:this.wristBrakingModel,enemyModel:game.enemy.wristBrakingModel??null,old,new:this.sword.angularDamping(),oldMargin,newMargin:this.weaponCfg.releaseMargin,enemyMargin:game.enemy.weaponCfg.releaseMargin,propertiesRetained:before===props(this),skill:this.skill.level,enemyDrag:game.enemy.sword.angularDamping()});
              for(const name of ['onClash','onWound']){
                const originalHook=game.combat.hooks[name];game.combat.hooks[name]=function(...args){
                  if(name==='onClash')probe.clashes.push({timeS:game.stats.simTime,speed:args[1],fresh:args[2].fresh});
                  else probe.wounds.push({timeS:game.stats.simTime,victim:args[1].index,severity:args[2].severity});
                  return originalHook?.apply(this,args);
                };
              }
            }
            probe.steps++;if(this.debug.wristStopBudget)probe.budgetCount=(probe.budgetCount??0)+1;
          }
          const result=original.apply(this,args);
          if(engage&&this===game.player){const p=this.bodies.pelvis.translation();game.camera.position.set(p.x-1.3,1.5,p.z+2.6);game.camera.lookAt(p.x+.35,1.05,p.z);}
          if(this===game.player&&probe.steps%12===0){
            const record=b=>({p:b.translation(),q:b.rotation(),v:b.linvel(),w:b.angvel()});
            probe.samples.push({timeS:game.stats.simTime,state:game.state,alive:this.alive,armed:this.armed,hand:this.handOffset.toArray(),
              sword:record(this.sword),bodies:Object.fromEntries(Object.entries(this.bodies).map(([name,b])=>[name,record(b)]))});
          }
          return result;
        };
        const originalConsume=g.input.consumeHandDelta;
        g.input.consumeHandDelta=function(...args){const d=originalConsume.apply(this,args);if(d.x||d.y)probe.consumed.push({timeS:game.stats.simTime,...d});return d;};
        for(const type of ['pointerdown','pointermove','pointerup'])document.addEventListener(type,e=>{
          if(e.target===document.getElementById('game'))probe.touch.push({type,trusted:e.isTrusted,pointerType:e.pointerType,x:e.clientX,y:e.clientY});
        },true);
      },{mode,engage});
      await page.locator('#btnStart').tap();await page.waitForFunction(()=>game.state==='fight'&&dragVisual.first.length===1);
      const snap=async label=>{await page.screenshot({path:path.join(dir,label+'.png')});};
      await snap('01-start');
      const cdp=await context.newCDPSession(page),points=(x,y)=>[{x,y,id:1}];
      const send=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:points(x,y)});
      if(engage){
        await send('touchStart',75,315);await send('touchMove',75,275);
        const from=await page.evaluate(()=>game.stats.simTime);
        await page.waitForFunction(from=>game.player.foeDistance()<1.5||game.stats.simTime>from+9||!game.player.alive,from,{timeout:120000});
        await send('touchEnd');await snap('01b-approached');
      }
      await send('touchStart',620,240);await send('touchMove',620,220);
      for(const y of [190,160,130,100,70]){await send('touchMove',620,y);await page.waitForTimeout(80);}
      await page.waitForTimeout(450);await snap('02-raised');
      for(const y of [100,135,170,205,240,275,310]){await send('touchMove',620,y);await page.waitForTimeout(65);}
      await snap('03-downstroke');await page.waitForTimeout(350);await snap('04-hold');
      for(const y of [270,230,190,150,110,70]){await send('touchMove',620,y);await page.waitForTimeout(65);}
      await snap('05-reverse');await page.waitForTimeout(800);await snap('06-follow');
      await send('touchEnd');
      await page.waitForTimeout(1800);await snap('07-later');
      await send('touchStart',620,150);await send('touchMove',640,160);
      for(const [x,y]of [[650,200],[670,240],[690,280],[650,220],[610,160],[570,100]]){await send('touchMove',x,y);await page.waitForTimeout(85);}
      await send('touchEnd');await page.waitForTimeout(1500);await snap('08-reinput');
      if(engage){
        const from=await page.evaluate(()=>game.stats.simTime);
        await page.waitForFunction(from=>dragVisual.clashes.length>0||dragVisual.wounds.length>0||game.stats.simTime>from+6||!game.player.alive,from,{timeout:120000});
        await snap('09-combat');
      }
      await page.locator('#btnPause').tap();await page.waitForFunction(()=>game.state==='paused');
      await page.locator('#btnStart').tap();await page.waitForFunction(()=>game.state==='fight'&&dragVisual.first.length===2);
      const restart=await page.evaluate(()=>({newObjects:Object.fromEntries(['player','enemy','world','combat'].map(k=>[k,game[k]!==wristRoundReference[k]])),
        model:game.player.wristBrakingModel,enemyModel:game.enemy.wristBrakingModel??null,gain:game.input.mobileIntent.verticalGain,
        savedRetained:localStorage.getItem('gladiator-settings')===dragVisual.savedBefore}));
      assert.ok(Object.values(restart.newObjects).every(Boolean));assert.equal(restart.model,mode);assert.equal(restart.enemyModel,null);assert.equal(restart.gain,1.35);assert.ok(restart.savedRetained);
      await snap('10-restarted');
      const receipt=await page.evaluate(()=>({url:location.href,probe:dragVisual,state:game.state,simTime:game.stats.simTime,playerAlive:game.player.alive,enemyAlive:game.enemy.alive,
        finite:[game.player,game.enemy].every(f=>[...Object.values(f.bodies),f.sword].every(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].every(v=>Object.values(v).every(Number.isFinite))))}));
      assert.equal(receipt.probe.first.length,2);assert.ok(receipt.probe.first[0].propertiesRetained);assert.equal(receipt.probe.first[0].skill,0);
      assert.ok(receipt.probe.first[0].timeS<=1/120);assert.equal(receipt.probe.first[0].new,receipt.probe.first[0].old);assert.equal(receipt.probe.first[0].model,mode);assert.equal(receipt.probe.first[0].enemyModel,null);
      assert.equal(receipt.probe.first[0].newMargin,1.4);assert.equal(receipt.probe.first[0].enemyMargin,1.4);
      assert.ok(receipt.probe.first[0].enemyDrag>.29);assert.ok(receipt.probe.consumed.length>10);assert.ok(receipt.probe.touch.every(e=>e.trusted&&e.pointerType==='touch'));
      assert.ok(receipt.finite);assert.equal(errors.length,0);
      await fs.writeFile(path.join(dir,'receipt.json'),JSON.stringify({...receipt,restart,errors},null,2),{flag:'wx'});
      results.push({weapon,mode,simTime:receipt.simTime,steps:receipt.probe.steps,first:receipt.probe.first,touchCount:receipt.probe.touch.length,consumedCount:receipt.probe.consumed.length,finite:receipt.finite});
      console.log(JSON.stringify(results.at(-1)));
    } finally{await context.close();}
  }
} finally{await browser.close();await fs.writeFile(path.join(out,'summary.json'),JSON.stringify(results,null,2),{flag:'wx'});}
