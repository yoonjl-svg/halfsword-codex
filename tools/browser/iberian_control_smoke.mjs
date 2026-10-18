const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
import {mkdirSync,writeFileSync} from 'node:fs';
import {CONTROL_MODES as BEAT_MODES} from './iberian_control_modes.js';
const out='docs/research/iberian_control_playtest_20261019';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const rows=[],errors=[];
try{
 const p=await browser.newPage({viewport:{width:844,height:390},hasTouch:true});
 p.on('pageerror',e=>errors.push(String(e)));p.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 await p.goto(process.env.BASE??'http://127.0.0.1:4341/');
 await p.evaluate(()=>localStorage.setItem('iberian-test-sentinel','keep'));
 await p.screenshot({path:`${out}/settings-mobile.png`});
 await p.locator('#start').click();
 async function gameFrame(id){await p.frameLocator('#game').locator('#btnStart').waitFor({timeout:60000});const f=p.frames().find(x=>x.url().includes('/game/index.html'));await f.waitForFunction(id=>window.beatLab?.id===id&&beatLab.config&&game.player,id,{timeout:60000});return f;}
 for(const cfg of BEAT_MODES){
  await p.locator('#mode').selectOption(cfg.id);const f=await gameFrame(cfg.id);
  const data=await f.evaluate(()=>({id:beatLab.id,cfg:beatLab.config,weapon:game.player.weapon.id,enemy:game.enemy.weapon.id,school:game.player.schoolParry!==false,privateStorage:localStorage.getItem('iberian-test-sentinel')===null,pwa:document.querySelectorAll('script[src*="pwa"]').length,practice:beatLab.practice}));
  for(const k of ['normalGuide','duration','hold','recover','onlyOutward','floor','controlHold'])if(cfg[k]!=null&&cfg[k]!==data.cfg[k])throw Error(`${cfg.id} wrong ${k}`);
  if(!data.privateStorage||data.pwa||data.weapon!=='zweihander'||data.enemy!=='longsword'||!data.school)throw Error('isolation or loadout');
  rows.push(data);
 }
 await p.locator('#mode').selectOption('long');let f=await gameFrame('long');
 await f.locator('#btnStart').click();await f.waitForFunction(()=>game.state==='fight'&&game.stats.simTime>.5,null,{timeout:60000});
 await f.locator('#btnParry').focus();await p.keyboard.down('f');
 await f.waitForFunction(()=>game.playerGuard.held,null,{timeout:10000});
 await f.waitForFunction(()=>beatLab.procs[0]>0||game.stats.simTime>18||!game.player.alive,null,{timeout:120000});
 await p.screenshot({path:`${out}/defender-mobile.png`});
 await f.waitForFunction(()=>controlLabDebug.snapshot()[1].events.length>0||!game.player.alive,null,{timeout:60000});
 await f.waitForFunction(()=>controlLabDebug.snapshot()[1].scale===1,null,{timeout:30000});
 const defense=await f.evaluate(()=>({controls:controlLabDebug.snapshot(),time:game.stats.simTime,held:game.playerGuard.held,procs:beatLab.procs,eligible:beatLab.eligible,alive:game.player.alive,attacks:game.ai.stats.attacks}));
 await p.keyboard.up('f');await p.locator('#settings').click();await f.waitForFunction(()=>game.state==='paused',null,{timeout:10000});
 await p.locator('#role').selectOption('attacker');await p.locator('#start').click();f=await gameFrame('long');
 await f.locator('#btnStart').click();await f.waitForFunction(()=>game.state==='fight'&&game.stats.simTime>1,null,{timeout:60000});
 const attack=await f.evaluate(()=>({role:beatLab.role,weapon:game.player.weapon.id,enemy:game.enemy.weapon.id,guard:!!game.enemy.parryGuard,held:game.enemy.parryGuard?.held}));
 if(attack.weapon!=='longsword'||attack.enemy!=='zweihander'||!attack.held)throw Error('attacker drill setup');
 await p.screenshot({path:`${out}/attacker-mobile.png`});
 await p.locator('#settings').click();await p.locator('#practice').selectOption('0');await p.locator('#start').click();f=await gameFrame('long');
 const duel=await f.evaluate(()=>({practice:beatLab.practice,guard:!!game.enemy.parryGuard,aiSweep:!!game.enemy.skill._contactSweep}));if(duel.practice||duel.guard||!duel.aiSweep)throw Error('duel did not reset');
 await p.locator('#restart').click();f=await gameFrame('long');
 const reset=await f.evaluate(()=>({state:game.state,procs:beatLab.procs,blood:game.player.blood}));
 if(reset.procs.some(x=>x)||reset.blood!==1)throw Error('reset');
 const storage=await p.evaluate(()=>localStorage.getItem('iberian-test-sentinel'));if(storage!=='keep')throw Error('storage changed');
 const overflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow)throw Error('mobile overflow');
 rows.push({defense,attack,duel,reset,storage,overflow});
}finally{await browser.close();writeFileSync(`${out}/browser-smoke.json`,JSON.stringify({rows,errors},null,2));}
if(errors.length)throw Error(JSON.stringify(errors));console.log('PASS 3 modes, both roles, guard input, pause, reset, duel, mobile layout and save isolation');
