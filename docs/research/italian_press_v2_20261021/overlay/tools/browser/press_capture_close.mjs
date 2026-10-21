import {chromium} from '/workspace/cloud-onboarding-tools/node_modules/playwright/index.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
const out=process.env.OUT??'/tmp/italian-press-touch';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const errors=[];const p=await browser.newPage({viewport:{width:1120,height:630},hasTouch:true});p.on('pageerror',e=>errors.push(String(e)));
try{
 await p.goto('http://127.0.0.1:4395/');await p.locator('#start').click();
 await p.frameLocator('#game').locator('#btnStart').waitFor({timeout:60000});
 const f=p.frames().find(x=>x.url().includes('/game/index.html'));await f.goto(f.url()+'&probe=1');
 await f.waitForFunction(()=>window.game?.player&&window.rapierLabDebug);
 await f.evaluate(()=>{game.config.PHYSICS.maxStepsPerFrame=0;window.captureState={};window.pressHits=[];document.getElementById('btnParry').addEventListener('pointerdown',()=>captureState.inputAt=game.playerGuard.clock);});
 await f.locator('#btnStart').click();await f.waitForFunction(()=>game.state==='fight'&&rapierLabDebug.mod.f===game.player);
 await f.evaluate(()=>{const wound=game.combat.hooks.onWound;game.combat.hooks.onWound=(a,v,h,...args)=>{pressHits.push({t:game.stats.simTime,att:a.index,vic:v.index,type:h.type,part:h.part,severity:h.severity,trade:h.pressTrade});wound?.(a,v,h,...args);};const m=rapierLabDebug.mod,u=m.update.bind(m);m.update=dt=>{u(dt);if(m.run&&!game.playerGuard.held&&!captureState.released)captureState.released={held:false,t:game.playerGuard.clock,protection:m.protection()};if(m.run&&m.run.t>=.23&&!captureState.captured){Object.assign(captureState,{captured:true,t:game.stats.simTime,runT:m.run.t,held:game.playerGuard.held,protection:m.protection(),input:game.player.stickY,gap:game.player.foeDistance(),target:game.player.skill.thrustPose,tip:game.player.tipPrev,events:m.events});game.config.PHYSICS.maxStepsPerFrame=0;bodyCueProbe.freezeParticles=true;}};});
 await f.evaluate(()=>game.config.PHYSICS.maxStepsPerFrame=8);
 const stick=await f.locator('#moveStick').boundingBox();const moving=await p.context().newCDPSession(p);
 await moving.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:2,x:stick.x+stick.width/2,y:stick.y+stick.height/2-20}]});
 await f.waitForFunction(()=>game.stats.simTime>2.2&&game.player.foeDistance()<1.40||!game.player.alive,null,{timeout:90000});
 await moving.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const box=await f.locator('#btnParry').boundingBox();const cdp=await p.context().newCDPSession(p);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:box.x+box.width/2,y:box.y+box.height/2}]});
 await f.waitForFunction(()=>captureState.captured||!game.player.alive,null,{timeout:60000});
 const result=await f.evaluate(()=>({capture:captureState,events:rapierLabDebug.events(),probe:bodyCueProbe,hits:pressHits,held:game.playerGuard.held,alive:game.player.alive,t:game.stats.simTime}));
 await p.screenshot({path:out+'/actual-touch.png'});
 await f.evaluate(()=>{const a=game.player.bodies.chest.translation(),b=game.enemy.bodies.chest.translation();game.freeCam=true;game.camera.position.set((a.x+b.x)/2,1.9,(a.z+b.z)/2+3.2);game.camera.lookAt((a.x+b.x)/2,1.0,(a.z+b.z)/2);});
 await p.waitForTimeout(100);await p.screenshot({path:out+'/side-thrust.png'});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await f.evaluate(()=>game.config.PHYSICS.maxStepsPerFrame=8);
 await f.waitForFunction(()=>!game.playerGuard.held&&!game.playerGuard.opposition.run);
 result.release=await f.evaluate(()=>({held:game.playerGuard.held,active:!!rapierLabDebug.mod.run,protection:rapierLabDebug.mod.protection(),firstRelease:captureState.released,hits:pressHits,starts:rapierLabDebug.mod.starts,events:rapierLabDebug.mod.events}));result.errors=errors;writeFileSync(out+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(!result.capture.captured)throw Error('Actual touch did not start a thrust');
}finally{await browser.close();}
