import {chromium} from '/workspace/cloud-onboarding-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const results=[];
for(const mobile of [true]){
const host=await browser.newPage({viewport:{width:1280,height:720},hasTouch:mobile,isMobile:mobile});const errors=[];
host.on('pageerror',e=>errors.push(String(e)));host.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await host.goto('http://127.0.0.1:4390/?mode=strongBind');await host.locator('#start').click();await host.evaluate(()=>document.getElementById('game').src='game/index.html?test=1&weapon=rapier&foeWeapon=longsword&uniqueStage=2&stage=castle&slowMo=0&camOpen=old&mode=strongBind');await host.frameLocator('#game').locator('#btnStart').waitFor({timeout:60000});const page=host.frames().find(f=>f.url().includes('/game/index.html'));
await page.waitForFunction(()=>window.game?.player?.sword);
await page.evaluate(()=>{game.config.ARENA.startGap=1.65;});
await page.locator('#btnStart').click();await page.waitForFunction(()=>window.game.state==='fight');
await page.evaluate(async()=>{
 const g=game,a=g.enemy,p=g.player,tech=g.ai.school.tech.find(t=>t.name==='zwerchL');
 g.config.ARENA.startHold=0;p.fightT=a.fightT=4;p.skill.corr=g.config.SKILL.corr;p.skill.corrTip=g.config.SKILL.corrTip;
 const r=window.probe={t:0,ph:0,at:0,ready:false,go:false,captured:false,contacts:0,events:[]};
 const old=g.combat.hooks.onClash;g.combat.hooks.onClash=(...args)=>{old?.(...args);r.contacts++;r.events.push({t:r.t,age:g.playerGuard.clock-g.playerGuard.opposition.pressed,vn:args[2]?.vn,attack:a.stamina.attackId,injury:g.playerGuard.clock-g.playerGuard.opposition.lastInjury,approach:new g.THREE.Vector3().copy(p.bodies.chest.translation()).sub(a.bladePoint(1,new g.THREE.Vector3())).dot(a.tipVel)});};
 const pad=(x,y)=>{a.handOffset.set(x,y);a.skill.aimRaw.set(x,y);};
 const move=(v,sp,dt)=>{let o=a.handOffset,d=Math.hypot(v[0]-o.x,v[1]-o.y),step=sp*dt;if(d<=step){pad(...v);return true;}pad(o.x+(v[0]-o.x)*step/d,o.y+(v[1]-o.y)*step/d);};
 let pts;
 g.ai.update=dt=>{r.t+=dt;a.move.set(0,0);
 if(r.ph===0&&r.t>.6)r.ph=1;
 else if(r.ph===1&&move(tech.from,3,dt)){r.ph=2;r.at=r.t;}
 else if(r.ph===2&&r.go){r.ph=3;pts=tech.path.map(x=>[...x]);a.stamina.attack('cut');}
 else if(r.ph===3&&move(pts[0],11,dt)&&(pts.shift(),!pts.length)){r.ph=4;}
 if(r.ph===2&&r.t-r.at>.15)r.ready=true;
 const mod=g.playerGuard.opposition;if(mod.run&&mod.run.t>=.23){r.captured=true;g.config.PHYSICS.maxStepsPerFrame=0;}
 };
});
await page.waitForFunction(()=>probe.ready,{},{timeout:30000});
let cdp;
if(mobile){cdp=await host.context().newCDPSession(host);const b=await page.locator('#btnParry').boundingBox();if(!b)throw Error('no touch parry button');await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2}]});}
else await host.keyboard.down('f');
await page.waitForFunction(()=>game.playerGuard.held);
await page.evaluate(()=>{probe.go=true;});
try{await page.waitForFunction(()=>probe.captured,null,{timeout:25000});}catch(e){const fail=await page.evaluate(()=>({r:probe,start:game.playerGuard.opposition.lastStart,held:game.playerGuard.held,p:game.player.state,gap:game.player.foeDistance(),eligible:game.playerGuard.opposition.eligible(),broken:game.playerGuard.broken}));fs.writeFileSync('/tmp/italian-four-20261020/browser/fixture-failure.json',JSON.stringify(fail,null,2));throw e;}
await page.waitForTimeout(100);
await host.screenshot({path:'/tmp/italian-four-20261020/browser/activation-verified.png'});
const snap=await page.evaluate(()=>({input:game.playerGuard.held,starts:game.playerGuard.opposition.starts,start:game.playerGuard.opposition.lastStart,pose:game.player.skill.thrustPose,hud:document.getElementById('guardName')?.textContent,beats:rapierLabDebug.events().filter(e=>e.type==='beat'),probe,spent:game.player.stamina.spent}));
if(mobile)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await host.keyboard.up('f');
await page.evaluate(()=>game.config.PHYSICS.maxStepsPerFrame=8);
await page.waitForFunction(()=>!game.playerGuard.held&&!game.playerGuard.opposition.run);
results.push({mobile,...snap,errors,cancelledOnRelease:true});await host.close();
}
fs.writeFileSync('/tmp/italian-four-20261020/browser/physical.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));await browser.close();
