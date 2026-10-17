import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
const out=process.env.OUT??'/workspace/japanese-recovery-20261017',base=process.env.BASE??'http://127.0.0.1:4198';
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const rows=[];
try{for(const role of ['defender','attacker']){
 const p=await b.newPage({viewport:{width:1100,height:620},hasTouch:true}),errors=[];
 p.on('pageerror',e=>errors.push(String(e)));p.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 await p.goto(`${base}/?role=${role}&duration=0.36&practice=1`);
 await p.evaluate(()=>localStorage.setItem('flow-lab-sentinel','keep'));
 await p.screenshot({path:`${out}/lab-settings-${role}.png`});
 await p.locator('#start').click();
 const frame=p.frameLocator('#game');await frame.locator('#btnStart').waitFor({timeout:60000});
 const f=p.frames().find(x=>x.url().includes('game/index.html'));
 await f.waitForFunction(()=>window.flowLab&&window.game?.player,{timeout:60000});
 const initial=await f.evaluate(()=>({role:flowLab.role,value:flowLab.value,mode:flowLab.mode,weapon:game.player.weapon.id,foe:game.enemy.weapon.id,school:game.player.schoolParry,privateStorage:localStorage.getItem('flow-lab-sentinel')===null,workerScripts:document.querySelectorAll('script[src*="pwa"]').length}));
 await frame.locator('#btnStart').click();await f.waitForFunction(()=>game.state==='fight'&&game.stats.simTime>.5,null,{timeout:60000});
 await p.screenshot({path:`${out}/lab-${role}.png`});
 // Synthetic penalty tests control continuity only; natural procs are covered by simulation.
 await f.evaluate(()=>{game.ai.update=()=>{};});
 await f.waitForFunction(()=>game.stats.simTime>2.8,null,{timeout:30000});
 await frame.locator('#btnParry').focus();
 await f.evaluate(()=>{game.player.flowRecovery={start:game.player.stamina.time,until:game.player.stamina.time+.36,duration:.36,floor:.25,attackId:999};});
 await p.keyboard.down('w');await p.keyboard.down('f');
 await f.waitForFunction(()=>game.player.flowArmScale<.7&&game.playerGuard.held&&game.player.move.length()>0,null,{timeout:3000});
 const active=await f.evaluate(()=>({move:game.player.move.toArray(),time:game.player.stamina.time,scale:game.player.flowArmScale,held:game.playerGuard.held,alive:game.player.alive}));
 await p.keyboard.up('w');await p.keyboard.up('f');
 await f.waitForFunction(()=>game.player.flowArmScale===1,null,{timeout:15000});
 await p.locator('#settings').click();
 await f.waitForFunction(()=>game.state==='paused',null,{timeout:10000});
 await p.locator('#duration').selectOption('base');await p.locator('#practice').selectOption('0');await p.locator('#start').click();
 const f2=p.frames().find(x=>x.url().includes('game/index.html'));
 await f2.waitForFunction(()=>window.flowLab?.value==='base'&&window.game?.player,null,{timeout:60000});
 const changed=await f2.evaluate(()=>({value:flowLab.value,mode:flowLab.mode,flow:game.player.flowRecovery??null}));
 const saved=await p.evaluate(()=>localStorage.getItem('flow-lab-sentinel'));
 rows.push({role,errors,initial,active,changed,checks:{roles:initial.role===role,weapon:initial.weapon===(role==='defender'?'uchigatana':'qinggang'),foe:initial.foe===(role==='defender'?'longsword':'uchigatana'),privateStorage:initial.privateStorage&&saved==='keep',noWorkerScript:initial.workerScripts===0,moveDuringRecovery:Math.hypot(...active.move)>0,guardDuringRecovery:active.held,penaltyActive:active.scale<.7,restart:changed.value==='base'&&changed.mode==='duel'&&changed.flow===null}});
 console.log(JSON.stringify(rows.at(-1)));await p.close();
}}finally{await b.close();writeFileSync(`${out}/browser-smoke.json`,JSON.stringify(rows,null,2));}
if(rows.length!==2||rows.some(r=>r.errors.length||Object.values(r.checks).some(v=>!v)))process.exitCode=1;
