import {chromium} from '/workspace/cloud-onboarding-tools/node_modules/playwright/index.mjs';
import {writeFileSync} from 'node:fs';
const out='docs/research/iberian_control_playtest_20261019';
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']}),report={errors:[]};
try{
 const p=await b.newPage({viewport:{width:844,height:390},hasTouch:true});p.on('pageerror',e=>report.errors.push(String(e)));
 const c=await p.context().newCDPSession(p);
 const touch=(type,x,y)=>c.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y,id:1,radiusX:2,radiusY:2,force:1}]});
 await p.goto('http://127.0.0.1:4341/?mode=long');await p.locator('#start').click();
 async function startFrame(){await p.frameLocator('#game').locator('#btnStart').waitFor({timeout:60000});const f=p.frames().find(x=>x.url().includes('/game/index.html'));await f.waitForFunction(()=>window.beatLab?.config&&game.player);await f.locator('#btnStart').click();await f.waitForFunction(()=>game.state==='fight'&&game.stats.simTime>.3);return f;}
 let f=await startFrame();const box=await f.locator('#btnParry').boundingBox();
 await touch('touchStart',box.x+box.width/2,box.y+box.height/2);await f.waitForFunction(()=>game.playerGuard.held);report.touchHeld=true;
 await touch('touchEnd');await f.waitForFunction(()=>!game.playerGuard.held);report.touchReleased=true;
 const before=await f.evaluate(()=>game.player.handOffset.toArray());
 await touch('touchStart',520,150);for(let i=1;i<=8;i++){await touch('touchMove',520+i*18,150+i*12);await p.waitForTimeout(25);}await touch('touchEnd');
 const after=await f.evaluate(()=>({hand:game.player.handOffset.toArray(),broken:game.playerGuard.broken,run:!!game.player.skill._contactSweep.run}));
 if(Math.hypot(...after.hand.map((v,i)=>v-before[i]))<.05)throw Error('Touch drag did not move hand');report.drag={before,after};
 await p.locator('#settings').click();await p.locator('#role').selectOption('attacker');await p.locator('#start').click();f=await startFrame();
 await f.locator('canvas').first().focus();await p.keyboard.down('w');
 await f.waitForFunction(()=>game.player.foeDistance()<1.65,null,{timeout:20000});await p.keyboard.up('w');
 for(let k=0;k<12;k++){
  const x0=k%2?720:410,x1=k%2?400:715;
  await p.mouse.move(x0,135);await p.mouse.down();await p.mouse.move(x1,260,{steps:12});await p.mouse.up();await p.waitForTimeout(450);
  if(await f.evaluate(()=>beatLab.procs[1]>0||!game.player.alive||!game.enemy.alive))break;
 }
 report.attacker=await f.evaluate(()=>({controls:controlLabDebug.snapshot(),time:game.stats.simTime,procs:beatLab.procs,contacts:game.enemy.skill._contactSweep.events,held:game.enemy.parryGuard.held,alive:[game.player.alive,game.enemy.alive]}));
 await p.screenshot({path:`${out}/attacker-input-mobile.png`});
 if(report.errors.length)throw Error(report.errors.join('\n'));
}finally{await b.close();writeFileSync(`${out}/touch-and-attacker.json`,JSON.stringify(report,null,2));}
console.log(report);
