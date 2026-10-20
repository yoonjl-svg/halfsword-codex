import {chromium} from '/workspace/cloud-onboarding-tools/node_modules/playwright/index.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
const out=process.env.OUT??'/tmp/italian-body-20261021/browser-cue';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const errors=[];const p=await browser.newPage({viewport:{width:1120,height:630},hasTouch:true});p.on('pageerror',e=>errors.push(String(e)));
try{
 await p.goto('http://127.0.0.1:4392/');await p.locator('#start').click();
 await p.frameLocator('#game').locator('#btnStart').waitFor({timeout:60000});
 let f=p.frames().find(x=>x.url().includes('/game/index.html'));await f.goto(f.url()+'&probe=1');
 await f.waitForFunction(()=>window.game?.player&&window.rapierLabDebug);
 await f.evaluate(()=>{game.config.PHYSICS.maxStepsPerFrame=0;const step=game.playerGuard.step.bind(game.playerGuard);window.captureState={};game.playerGuard.step=dt=>{step(dt);};});
 await f.locator('#btnStart').click();await f.waitForFunction(()=>game.state==='fight'&&rapierLabDebug.mod.f===game.player&&rapierLabDebug.mod===game.playerGuard.opposition);
 await f.evaluate(()=>{const m=rapierLabDebug.mod,update=m.update.bind(m);m.update=dt=>{update(dt);if(m.run&&m.run.t>=.025&&!captureState.captured){Object.assign(captureState,{captured:true,t:game.stats.simTime,runT:m.run.t,body:{...game.player.bodyPose},target:{...m.run.body},held:game.playerGuard.held,events:m.events});game.config.PHYSICS.maxStepsPerFrame=0;bodyCueProbe.freezeParticles=true;}};});
 const box=await f.locator('#btnParry').boundingBox();const cdp=await p.context().newCDPSession(p);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});await f.evaluate(()=>game.config.PHYSICS.maxStepsPerFrame=8);
 await f.waitForFunction(()=>captureState.captured||!game.player.alive||game.stats.simTime>18,null,{timeout:150000});
 const result=await f.evaluate(()=>({capture:captureState,probe:bodyCueProbe,events:rapierLabDebug.events(),held:game.playerGuard.held,alive:game.player.alive,t:game.stats.simTime}));
 await p.screenshot({path:out+'/actual-touch.png'});
 await f.evaluate(()=>{const a=game.player.bodies.chest.translation(),b=game.enemy.bodies.chest.translation();game.freeCam=true;game.camera.position.set((a.x+b.x)/2,1.9,(a.z+b.z)/2+3.2);game.camera.lookAt((a.x+b.x)/2,1.0,(a.z+b.z)/2);});
 await p.waitForTimeout(100);await p.screenshot({path:out+'/side-contact.png'});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await f.evaluate(()=>game.config.PHYSICS.maxStepsPerFrame=8);await f.waitForFunction(()=>!game.playerGuard.held&&!game.playerGuard.opposition.run);
 result.release=true;result.errors=errors;writeFileSync(out+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}
