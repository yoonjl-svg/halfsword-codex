import {chromium} from 'playwright';
import {writeFileSync,mkdirSync} from 'node:fs';
const out=process.env.OUT??'/workspace/japanese-flow-redesign-20261017',base=process.env.BASE??'http://127.0.0.1:4211',variant=process.env.VARIANT??'core';mkdirSync(out,{recursive:true});
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']}),rows=[];
try{for(const role of ['defender','attacker']){
 const p=await b.newPage({viewport:{width:844,height:390},hasTouch:true}),errors=[];
 p.on('pageerror',e=>errors.push(String(e)));p.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 await p.goto(`${base}/?role=${role}&variant=${variant}&practice=1&direction=zwerch`);await p.evaluate(()=>localStorage.setItem('flow-redesign-sentinel','keep'));
 await p.screenshot({path:`${out}/settings-${role}.png`});await p.locator('#start').click();
 const frame=p.frameLocator('#game');await frame.locator('#btnStart').waitFor({timeout:60000});
 const f=p.frames().find(x=>x.url().includes('game/index.html'));await f.waitForFunction(()=>window.flowLab&&window.game?.player,null,{timeout:60000});
 const initial=await f.evaluate(()=>({role:flowLab.role,value:flowLab.value,weapon:game.player.weapon.id,foe:game.enemy.weapon.id,privateStorage:localStorage.getItem('flow-redesign-sentinel')===null,workers:document.querySelectorAll('script[src*="pwa"]').length,interceptHook:typeof (flowLab.role==='defender'?game.player:game.enemy).flowPoseSelector==='function'}));
 await frame.locator('#btnStart').click();await f.waitForFunction(()=>game.state==='fight'&&game.stats.simTime>.7,null,{timeout:60000});
 await p.screenshot({path:`${out}/mobile-${role}.png`});
 await f.evaluate(()=>{game.ai.update=()=>{};});await f.waitForFunction(()=>game.stats.simTime>2.8,null,{timeout:30000});
 await frame.locator('#btnParry').focus();await p.keyboard.down('f');
 await f.waitForFunction(()=>game.playerGuard.held,null,{timeout:10000});
 // Artificial low stamina only for the actual UI/input lock test; screenshots
 // of natural flow and natural attacker charges are separate recorded replays.
 const start=await f.evaluate(()=>{const s=game.player.stamina;s.value=-40;s.spend('flow',40);return {t:s.time,value:s.value,exhausted:s.exhausted,speed:s.speed,canThrust:game.player.skill.thrust()};});
 await f.waitForFunction(()=>!game.player.stamina.exhausted,null,{timeout:15000});
 const end=await f.evaluate(()=>({t:game.player.stamina.time,value:game.player.stamina.value,level:game.player.stamina.level,held:game.playerGuard.held,arm:game.player.flowArmScale,recovery:game.player.flowRecovery??null}));
 await p.keyboard.up('f');await p.locator('#settings').click();await p.locator('#variant').selectOption('horizontal');await p.locator('#start').click();
 const f2=p.frames().find(x=>x.url().includes('game/index.html'));await f2.waitForFunction(()=>window.flowLab?.value==='horizontal'&&window.game?.player,null,{timeout:60000});
 const hook=await f2.evaluate(()=>typeof (flowLab.role==='defender'?game.player:game.enemy).flowPoseSelector==='function');
 await p.locator('#settings').click();await p.locator('#variant').selectOption('base');await p.locator('#start').click();
 const f3=p.frames().find(x=>x.url().includes('game/index.html'));await f3.waitForFunction(()=>window.flowLab?.value==='base'&&window.game?.player,null,{timeout:60000});
 const clean=await f3.evaluate(()=>!game.player.flowPoseSelector&&!game.enemy.flowPoseSelector&&game.player.flowRecovery==null);
 const saved=await p.evaluate(()=>localStorage.getItem('flow-redesign-sentinel'));
 const checks={roles:initial.role===role,interceptHook:variant!=='intercept'||initial.interceptHook,value:initial.value===variant,weapon:initial.weapon===(role==='defender'?'uchigatana':'qinggang'),foe:initial.foe===(role==='defender'?'longsword':'uchigatana'),privateStorage:initial.privateStorage&&saved==='keep',noWorkerScript:initial.workers===0,exhaustLocks:start.exhausted&&start.speed===0&&!start.canThrust,naturalDuration:Math.abs(end.t-start.t-35/21)<.08,unlockAtMinus35:Math.abs(end.value+35)<.01&&end.level===2,guardStillHeld:end.held,noArmPenalty:end.arm===1&&end.recovery===null,horizontalHook:hook,baseClean:clean};
 rows.push({role,initial,start,end,errors,checks});console.log(JSON.stringify(rows.at(-1)));await p.close();
}}finally{await b.close();writeFileSync(`${out}/browser-smoke.json`,JSON.stringify(rows,null,2));}
if(rows.length!==2||rows.some(r=>r.errors.length||Object.values(r.checks).some(v=>!v)))process.exitCode=1;
