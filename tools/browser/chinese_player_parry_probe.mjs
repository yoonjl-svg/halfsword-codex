// Real game page and real button events. Reading variants are prototype-only here.
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const base=process.env.BASE??'http://127.0.0.1:4197';
const dir=process.env.OUT_DIR??'/workspace/chinese-parry-player-20261017';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const rows=[];
for(const kind of (process.env.KINDS??'base,ready').split(',')) {
 const page=await browser.newPage({viewport:{width:1100,height:620},hasTouch:true});const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(`${base}/?weapon=qinggang&foeWeapon=longsword&uniqueStage=2&slowMo=0&openSweep=0`);
 await page.waitForFunction(()=>window.game?.player?.sword,null,{timeout:60000});
 await page.locator('#btnStart').click();
 await page.waitForFunction(()=>game.state==='fight'&&game.stats.simTime>2.6,null,{timeout:90000});
 await page.evaluate(async kind=>{
  const g=game,p=g.player,e=g.enemy;
  if(kind!=='base') {
   window.process={env:{CN_READ:kind}};
   const {ChineseResearchGuard}=await import('/tools/sim/chinese_player_guard.mjs');
   Object.setPrototypeOf(g.playerGuard,ChineseResearchGuard.prototype);
  }
  // Park the opponent for this input/recovery check; preserve the player's engine.
  const bodies=new Set(e.meshes.map(x=>x.rb));bodies.add(e.anchor);
  for(const rb of bodies){const t=rb.translation();rb.setTranslation({x:t.x+15,y:t.y,z:t.z},true);rb.setLinvel({x:0,y:0,z:0},true);}
  e.move.set(0,0);g.ai.update=()=>{e.move.set(0,0);e.handOffset.set(.35,-.55);};
  p.stamina.value=40;p.stamina.rest=1;p.stamina.stages();
 },kind);
 const snapshot=()=>page.evaluate(()=>({t:game.stats.simTime,held:game.playerGuard.held,active:game.playerGuard.active,broken:game.playerGuard.broken,line:game.playerGuard.line,mode:game.playerGuard.mode,stamina:game.player.stamina.value,recovered:game.player.stamina.recovered,attack:game.player.stamina.spent.attack,cover:game.player.skill._cover?.w??0,connection:game.player.stamina.controller===game.playerGuard,secret:!!game.player.skill.sec}));
 const waitSim=async n=>{const t=await page.evaluate(()=>game.stats.simTime);await page.waitForFunction(([t,n])=>game.stats.simTime>=t+n,[t,n],{timeout:30000});};
 const box=await page.locator('#btnParry').boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await waitSim(.08);
 const start=await snapshot();await waitSim(.25);const held=await snapshot();
 await page.screenshot({path:`${dir}/button-${kind}.png`});
 await page.mouse.up();await waitSim(.25);const released=await snapshot();
 await page.keyboard.down('f');await waitSim(.08);await page.touchscreen.tap(770,230);await waitSim(.025);const attack=await snapshot();await page.keyboard.up('f');
 const checks={controllerConnected:start.connection,buttonHolds:start.held&&held.active,recoveryPaused:Math.abs(held.recovered-start.recovered)<1e-7,noAttackChargeWhileGuarding:Math.abs(held.attack-start.attack)<1e-7,releaseWorks:!released.held&&!released.active,recoveryResumes:released.recovered>held.recovered,noSecret:!start.secret&&!held.secret&&!attack.secret,attackBreaksGuard:attack.broken&&!attack.active};
 rows.push({kind,errors,checks,start,held,released,attack});console.log(JSON.stringify({kind,errors,checks}));await page.close();
}
await browser.close();writeFileSync(`${dir}/browser-input.json`,JSON.stringify(rows,null,2));
if(rows.some(r=>r.errors.length||Object.values(r.checks).some(x=>!x)))process.exitCode=1;
