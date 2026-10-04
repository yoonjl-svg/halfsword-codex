// Actual compiled game, original enemy/physics, trusted touch. Observer and camera only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const options=Object.fromEntries(process.argv.slice(2).map(s=>{const m=/^--(base|out)=(.+)$/.exec(s);assert(m);return[m[1],m[2]];}));
const base=new URL(options.base??'https://yoonjl-svg.github.io/halfsword-codex/');
assert(!base.username&&!base.password&&(['127.0.0.1','localhost'].includes(base.hostname)||(base.origin==='https://yoonjl-svg.github.io'&&base.pathname==='/halfsword-codex/')));
const model='manual',shapes=['profile'],edges=['legacy','transported'],weapons=['qinggang'];
assert(options.out);await fs.mkdir(options.out,{recursive:false});
const hash=b=>createHash('sha256').update(b).digest('hex');
const names=['src/fighter.js','src/main.js','src/skill.js','src/hand_visual.js','src/weapons.js','package.json','package-lock.json','src/blade_shape_trial.js','src/thrust_plane.js','tools/browser/thrust_plane_screen.mjs'];
const manifest=async()=>Object.fromEntries(await Promise.all(names.map(async n=>[n,hash(await fs.readFile(n))])));
const sourceBefore=await manifest(),sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),startedUTC=new Date().toISOString();
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const launch={executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-background-networking','--use-gl=angle','--use-angle=swiftshader']};
if(base.protocol==='https:'){const proxy=new URL(process.env.HTTPS_PROXY||process.env.HTTP_PROXY);launch.proxy={server:`${proxy.protocol}//${proxy.host}`};}
const browser=await chromium.launch(launch),rows=[];let pass=false;
try{for(const weapon of weapons)for(const edge of edges)for(const shape of shapes){
 const effectiveEdge=edge;
 const dir=path.join(options.out,weapon+'-'+edge);await fs.mkdir(dir);
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,recordVideo:{dir,size:{width:844,height:390}}});
 await context.addInitScript(()=>localStorage.setItem('gladiator-settings',JSON.stringify({skill:'0',difficulty:'normal'})));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 try{
  const url=new URL(base);url.search=new URLSearchParams({weapon,foeWeapon:'longsword',foe:'default',targetCorrection:'none',onehandArm:model,bladeShape:shape,...(edge==='transported'?{thrustPlane:'transported'}:{})}).toString();url.hash='';
  await page.goto(url.href);await page.waitForFunction(()=>window.game?.player?.sword,null,{timeout:60000});
  const portrait=await page.evaluate(()=>({width:innerWidth,scrollWidth:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)}));assert(portrait.scrollWidth<=portrait.width+1);
  const assets=await page.locator('script[type="module"][src]').evaluateAll(a=>a.map(n=>n.src));assert(assets.length&&assets.every(u=>new URL(u).pathname.includes('/assets/')));
  const compiled=[];for(const u of assets){const r=await page.request.get(u);assert.equal(r.status(),200);const b=await r.body();compiled.push({url:u,bytes:b.length,sha256:hash(b)});}
  await page.setViewportSize({width:844,height:390});
  await page.evaluate(()=>{
   const T=game.THREE,V=o=>new T.Vector3(o.x,o.y,o.z),Q=o=>new T.Quaternion(o.x,o.y,o.z,o.w);
   window.thrustScreen={frames:[],touch:[],taps:[],calls:[],consumed:[],starts:[],phase:'ready',camera:'default',steps:0};
   const body=b=>({p:V(b.translation()).toArray(),q:Q(b.rotation()).toArray(),v:V(b.linvel()).toArray(),w:V(b.angvel()).toArray()});
   window.thrustRead=()=>{
    const f=game.player,b=f.sword,q=Q(b.rotation()),blade=new T.Vector3(0,1,0).applyQuaternion(q),w=V(b.angvel()),farm=f.bodies.farmS,fw=V(farm.angvel());
    const contactRows=[];for(const c of f.swordColliders)game.world.contactPairsWith(c,o=>game.world.contactPair(c,o,m=>{if(m.numContacts())contactRows.push({otherBody:o.parent()?.handle,count:m.numContacts()});}));
    return {timeS:game.stats.simTime,dt:game.world.timestep,phase:thrustScreen.phase,state:game.state,playerState:f.state,enemyState:game.enemy.state,alive:f.alive,armed:f.armed,weapon:f.weapon.id,model:f.onehandArmModel,edge:f.thrustEdgeModel??'legacy',enemyEdge:game.enemy.thrustEdgeModel??'legacy',thrustPlaneTrial:game.thrustPlaneTrial,bladeShape:game.bladeShapeTrial,shapeTypes:f.swordColliders.map(c=>c.shape.type),enemyShapes:game.enemy.swordColliders.map(c=>c.shape.type),properties:{mass:b.mass(),localCom:b.localCom(),I:b.principalInertia()},skill:f.skill.level,autoGuard:f.skill.autoGuard,thrusts:f.skill.thrusts,tapTime:f.skill.tap?.t??null,thrustWeight:f.skill.thrustPose.w,
     held:f.handHeld,inputActive:f.inputActive,hand:f.handOffset.toArray(),filtered:f.skill.aim.toArray(),handTarget:f.handTarget.toArray(),blade:blade.toArray(),flat:new T.Vector3(0,0,1).applyQuaternion(q).toArray(),aim:f.aimDirW.toArray(),wristTorque:f.debug.wristTorque.toArray(),wristCap:f.debug.wristCap,
     axialOmega:w.dot(blade),relativeAxialOmega:w.clone().sub(fw).dot(blade),relativeQuaternion:Q(farm.rotation()).invert().multiply(q).toArray(),sword:body(b),farm:body(farm),chest:body(f.bodies.chest),pelvis:body(f.bodies.pelvis),wounds:f.wounds.length,enemyWounds:game.enemy.wounds.length,swordContacts:contactRows,finite:[...Object.values(f.bodies),b].every(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].every(v=>Object.values(v).every(Number.isFinite)))};
   };
   const observedWorlds=new WeakSet();
   const attachWorld=()=>{const world=game.world;if(observedWorlds.has(world))return;observedWorlds.add(world);const step=world.step;world.step=function(...a){const result=step.apply(this,a);thrustScreen.steps++;thrustScreen.frames.push(thrustRead());if(thrustScreen.camera==='oblique'){
    const p=game.player.bodies.pelvis.translation();game.camera.position.set(p.x-1.5,1.8,p.z+2.6);game.camera.lookAt(p.x+.5,1.25,p.z);
   }return result;};};
   const fighterProto=Object.getPrototypeOf(game.player),fighterStep=fighterProto.step;
   fighterProto.step=function(...a){const result=fighterStep.apply(this,a);if(this===game.player)attachWorld();return result;};
   for(const name of ['consumeHandDelta','consumeTaps']){const old=game.input[name];game.input[name]=function(...a){const x=old.apply(this,a);if(name==='consumeTaps'?x>0:x.x||x.y)thrustScreen[name==='consumeTaps'?'taps':'consumed'].push({timeS:game.stats.simTime,phase:thrustScreen.phase,value:x});return x;};}
   const proto=Object.getPrototypeOf(game.player.skill),thrust=proto.thrust;proto.thrust=function(...a){const before={state:this.f.state,alive:this.f.alive,armed:this.f.armed,pending:!!this.tap};const accepted=thrust.apply(this,a);if(this.f===game.player)thrustScreen.calls.push({timeS:game.stats.simTime,phase:thrustScreen.phase,accepted,before});return accepted;};
   document.getElementById('btnStart').addEventListener('pointerdown',e=>thrustScreen.starts.push({trusted:e.isTrusted,type:e.pointerType}));
   for(const type of ['pointerdown','pointermove','pointerup'])document.addEventListener(type,e=>{if(e.target===game.input.canvas)thrustScreen.touch.push({type,timeS:game.stats.simTime,eventTime:e.timeStamp,trusted:e.isTrusted,kind:e.pointerType,x:e.clientX,y:e.clientY,phase:thrustScreen.phase});},true);
  });
  assert.equal(await page.evaluate(()=>game.player.onehandArmModel),model);assert.equal(await page.evaluate(()=>game.player.skill.level),0);assert.equal(await page.evaluate(()=>game.player.thrustEdgeModel??'legacy'),effectiveEdge);assert.equal(await page.evaluate(()=>game.enemy.thrustEdgeModel??'legacy'),'legacy');
  assert.equal(await page.evaluate(()=>game.thrustPlaneTrial),edge==='transported');
  const initialGeometry=await page.evaluate(()=>({trial:{...game.bladeShapeTrial},player:game.player.swordColliders.map(c=>c.shape.type),enemy:game.enemy.swordColliders.map(c=>c.shape.type)}));
  assert.deepEqual(initialGeometry.player,[1,0,1,shape==='profile'?9:1]);assert.deepEqual(initialGeometry.enemy,[1,0,1,1]);assert.equal(initialGeometry.trial.applied,shape==='profile');
  await page.locator('#btnStart').tap();await page.waitForFunction(()=>game.state==='fight'&&game.stats.simTime>=.8,null,{timeout:60000});
  const shots=[];async function shot(name){const state=await page.evaluate(()=>thrustRead());await page.screenshot({path:path.join(dir,name+'.png')});shots.push({name,state});}
  await shot('01-ready-default');await page.evaluate(()=>{game.freeCam=true;thrustScreen.camera='oblique';});
  const cdp=await context.newCDPSession(page),send=(type,x,y,timestamp)=>cdp.send('Input.dispatchTouchEvent',{type,...(timestamp===undefined?{}:{timestamp}),touchPoints:type==='touchEnd'?[]:[{x,y,id:1}]});
  await page.evaluate(()=>{thrustScreen.phase='raise';});await send('touchStart',620,230);
  for(let i=1;i<=6;i++){await send('touchMove',620,230-10*i);await page.waitForTimeout(50);}
  await page.waitForTimeout(180);await shot('02-raised');await page.evaluate(()=>{thrustScreen.phase='cut';});
  for(let i=1;i<=9;i++){await send('touchMove',620,170+15*i);await page.waitForTimeout(30);}
  await page.waitForTimeout(150);await send('touchEnd');await page.waitForTimeout(100);await shot('03-before-tap');
  const before=await page.evaluate(()=>({thrusts:game.player.skill.thrusts,calls:thrustScreen.calls.length,taps:thrustScreen.taps.length}));
  await page.evaluate(()=>{thrustScreen.phase='tap';});const stamp=Date.now()/1000;await send('touchStart',620,220,stamp);await page.waitForTimeout(80);await send('touchEnd',0,0,stamp+.08);
  await page.waitForFunction(n=>thrustScreen.calls.length>n,before.calls,{timeout:10000});
  const accepted=await page.evaluate(n=>thrustScreen.calls.slice(n),before.calls);assert(accepted.some(c=>c.accepted),'Healthy native state must accept tap in this selected screen');
  const tapAt=accepted.find(c=>c.accepted).timeS;for(const [seconds,name]of [[.12,'04-aim'],[.25,'05-push'],[.45,'06-return'],[.75,'07-recovered']]){await page.waitForFunction(t=>game.stats.simTime>=t,tapAt+seconds,{timeout:60000});await shot(name);}
  const beforeRestart=await page.evaluate(()=>{window.oldThrustPlayer=game.player;return thrustRead();});
  await page.locator('#btnPause').tap();await page.waitForFunction(()=>game.state==='paused');await page.locator('#btnStart').tap();await page.waitForFunction(()=>game.state==='fight'&&game.player!==oldThrustPlayer,null,{timeout:60000});
  const restarted=await page.evaluate(()=>({newPlayer:game.player!==oldThrustPlayer,model:game.player.onehandArmModel,edge:game.player.thrustEdgeModel??'legacy',skill:game.player.skill.level,thrustPlaneTrial:game.thrustPlaneTrial,enemyEdge:game.enemy.thrustEdgeModel??'legacy',shapeTypes:game.player.swordColliders.map(c=>c.shape.type),trial:{...game.bladeShapeTrial},saved:JSON.parse(localStorage.getItem('gladiator-settings'))}));assert(restarted.newPlayer&&restarted.model===model&&restarted.edge===effectiveEdge&&restarted.skill===0);
  assert.equal(restarted.thrustPlaneTrial,edge==='transported');assert.equal(restarted.enemyEdge,'legacy');assert.deepEqual(restarted.shapeTypes,initialGeometry.player);assert.equal(restarted.trial.applied,shape==='profile');
  const probe=await page.evaluate(()=>thrustScreen);assert(probe.frames.length&&probe.frames.every(x=>x.finite));assert(probe.touch.every(x=>x.trusted&&x.kind==='touch'));assert(probe.starts.length===2&&probe.starts.every(x=>x.trusted));assert.equal(probe.taps.slice(before.taps).reduce((s,x)=>s+x.value,0),1);assert.equal(errors.length,0);
  const selected=probe.frames.filter(f=>f.phase==='tap'&&f.timeS>=tapAt&&f.timeS<=tapAt+.75),peak=selected.reduce((a,b)=>Math.abs(a.relativeAxialOmega)>Math.abs(b.relativeAxialOmega)?a:b);
  const row={weapon,model,edge,shape,initialGeometry,url:url.href,portrait,compiled,before,accepted,tapAt,shots,beforeRestart,restarted,probe,peak,errors};await fs.writeFile(path.join(dir,'result.json'),JSON.stringify(row,null,2),{flag:'wx'});rows.push({weapon,model,edge,shape,initialGeometry,url:url.href,portrait,compiled,tapAt,peak,restarted,errors});console.log(JSON.stringify({weapon,model,edge,shape,tapAt,peakRelativeAxialOmega:peak.relativeAxialOmega,peakWorldAxialOmega:peak.axialOmega,peakTimeS:peak.timeS,peakWounds:peak.wounds,peakContacts:peak.swordContacts.length,errors}));
 }catch(e){await fs.writeFile(path.join(dir,'failure.json'),JSON.stringify({error:String(e),errors,state:await page.evaluate(()=>({read:window.thrustRead?.(),probe:window.thrustScreen})).catch(()=>null)},null,2),{flag:'wx'});throw e;}finally{await context.close();}
 }pass=true;
}finally{await browser.close();const sourceAfter=await manifest();await fs.writeFile(path.join(options.out,'summary.json'),JSON.stringify({pass:pass&&JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter),sourceCommit,sourceBefore,sourceAfter,startedUTC,completedUTC:new Date().toISOString(),argv:process.argv.slice(2),rows,scope:'Actual compiled Qinggang profile with legacy/transported normal thrust, portrait entry/landscape trusted touch, original normal enemy/physics; postPhysics observer/camera only. Browser input timing is recorded, not claimed exact to headless nominal strokes. CPU browser emulation is not physical-phone human acceptance.'},null,2),{flag:'wx'});}
