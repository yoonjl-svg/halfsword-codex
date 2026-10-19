import {chromium} from '/workspace/cloud-onboarding-tools/node_modules/playwright/index.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
const out='/tmp/italian-four-20261020/browser';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const errors=[],rows=[];const p=await browser.newPage({viewport:{width:844,height:390},hasTouch:true});p.on('pageerror',e=>errors.push(String(e)));p.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
async function frame(id){const f=p.frames().find(x=>x.url().includes('/game/index.html'));await f.waitForFunction(id=>window.rapierLab?.id===id&&rapierLab.config&&game.player,id,{timeout:60000});return f;}
try{
 await p.goto('http://127.0.0.1:4390/');await p.evaluate(()=>localStorage.setItem('italian-sentinel','keep'));await p.screenshot({path:out+'/settings.png'});await p.locator('#start').click();
 for(const id of ['usefulNear','usefulRoll','strongBind','strongThrust']){
  await p.locator('#mode').selectOption(id);await p.frameLocator('#game').locator('#btnStart').waitFor({timeout:60000});const f=await frame(id);
  const row=await f.evaluate(()=>({id:rapierLab.id,config:rapierLab.config,weapon:game.player.weapon.id,foe:game.enemy.weapon.id,privateStorage:localStorage.getItem('italian-sentinel')===null,starts:rapierLab.starts,windowSeconds:rapierLab.windowSeconds,actualWindow:game.config.SKILL.itOppositionVals.window}));if(row.windowSeconds!==1||row.actualWindow!==1)throw Error('window not relaxed');if(!row.privateStorage||row.weapon!=='rapier'||row.foe!=='longsword'||!row.config.beat)throw Error('config');rows.push(row);
 }
 let f=await frame('strongThrust');await f.locator('#btnStart').click();await f.waitForFunction(()=>game.state==='fight');
 const box=await f.locator('#btnParry').boundingBox();const session=await p.context().newCDPSession(p);await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});await f.waitForFunction(()=>game.playerGuard.held);await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await f.waitForFunction(()=>!game.playerGuard.held);rows.push({touch:true});
 await p.screenshot({path:out+'/defender.png'});
 await p.locator('#settings').click();await f.waitForFunction(()=>game.state==='paused');await p.locator('#role').selectOption('attacker');await p.locator('#start').click();await p.frameLocator('#game').locator('#btnStart').waitFor();f=await frame('strongThrust');await f.locator('#btnStart').click();await f.waitForFunction(()=>game.state==='fight'&&game.stats.simTime>1);
 rows.push(await f.evaluate(()=>({role:rapierLab.role,weapon:game.player.weapon.id,foe:game.enemy.weapon.id,guard:!!game.enemy.parryGuard,config:rapierLab.config})));await p.screenshot({path:out+'/attacker.png'});
 await p.locator('#settings').click();await p.locator('#impulse').selectOption('0');await p.locator('#start').click();await p.frameLocator('#game').locator('#btnStart').waitFor();f=await frame('strongThrust');if(await f.evaluate(()=>rapierLab.config.beat)!==0)throw Error('impulse off');
 await p.locator('#restart').click();await p.frameLocator('#game').locator('#btnStart').waitFor();f=await frame('strongThrust');if(await f.evaluate(()=>rapierLab.starts)!==0)throw Error('reset');if(await p.evaluate(()=>localStorage.getItem('italian-sentinel'))!=='keep')throw Error('save pollution');if(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('overflow');rows.push({off:true,reset:true,storage:true,overflow:false});
}finally{await browser.close();writeFileSync(out+'/smoke.json',JSON.stringify({rows,errors},null,2));}
if(errors.length)throw Error(JSON.stringify(errors));console.log('PASS four configurations, roles, touch hold/release, pause/reset, isolated saves, impulse toggle.');
