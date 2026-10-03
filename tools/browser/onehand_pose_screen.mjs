// Actual compiled game and trusted touch. Observations + presentation camera only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const args=Object.fromEntries(process.argv.slice(2).map(x=>{const m=/^--(base|out|weapons|poses|correction|model)=(.+)$/.exec(x);assert.ok(m,'Use named options');return[m[1],m[2]];}));
const base=new URL(args.base??'http://127.0.0.1:4279/'),out=args.out;assert.ok(out);await fs.mkdir(out,{recursive:false});
assert.ok(base.hostname==='127.0.0.1'||base.hostname==='localhost'||(base.origin==='https://yoonjl-svg.github.io'&&base.pathname==='/halfsword-codex/'));
const weapons=(args.weapons??'sabre,rapier').split(','),poses=(args.poses??'side,high').split(',');
assert.ok(poses.every(x=>['side','high'].includes(x)));const correction=args.correction??'none';assert.ok(['none','weak','normal'].includes(correction));
const model=args.model??'legacy';assert.ok(['legacy','manual'].includes(model));
const launch={executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-background-networking','--use-gl=angle','--use-angle=swiftshader']};
if(base.protocol==='https:'){const p=new URL(process.env.HTTPS_PROXY||process.env.HTTP_PROXY);launch.proxy={server:`${p.protocol}//${p.host}`};}
const browser=await chromium.launch(launch),rows=[],started=new Date();
try{for(const weapon of weapons)for(const pose of poses){
 const dir=path.join(out,weapon+'-'+pose);await fs.mkdir(dir);
 const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 try{
  const url=new URL(base);url.search=new URLSearchParams({weapon,foeWeapon:'longsword',foe:'default',targetCorrection:correction,mobileVerticalGain:'1.35',onehandArm:model}).toString();
  await page.goto(url.href);await page.waitForFunction(()=>window.game?.player?.sword,{timeout:60000});
  await page.evaluate(()=>{
   game.freeCam=true;window.poseProbe={samples:[],touch:[],consumed:[],first:[],steps:0};
   const P=Object.getPrototypeOf(game.player),step=P.step,consume=game.input.consumeHandDelta;const seen=new WeakSet();
   const record=f=>({timeS:game.stats.simTime,state:f.state,alive:f.alive,armed:f.armed,weapon:f.weapon.id,held:f.handHeld,inputActive:f.inputActive,hand:f.handOffset.toArray(),aim:f.skill.aim.toArray(),target:f.handTarget.toArray(),aimDir:f.aimDirW.toArray(),nearest:f.guardPose.nearest,thrustWeight:f.skill.thrustPose.w,finishWeight:f.finish.amt,armFull:f.armFull,onehandArmModel:f.onehandArmModel,skill:f.skill.level,autoGuard:f.skill.autoGuard,jointTargets:{shoulder:f.jointByName.uarmS.target.toArray(),elbow:f.jointByName.farmS.target.toArray()},bodies:Object.fromEntries(['chest','uarmS','farmS'].map(n=>[n,{p:f.bodies[n].translation(),q:f.bodies[n].rotation(),v:f.bodies[n].linvel(),w:f.bodies[n].angvel()}])),sword:{p:f.sword.translation(),q:f.sword.rotation(),v:f.sword.linvel(),w:f.sword.angvel()}});
   P.step=function(...a){const result=step.apply(this,a);if(this===game.player){poseProbe.steps++;if(!seen.has(this)){seen.add(this);poseProbe.first.push(record(this));}if(poseProbe.steps%12===0)poseProbe.samples.push(record(this));const p=this.bodies.pelvis.translation();game.camera.position.set(p.x-1.8,1.65,p.z+2.7);game.camera.lookAt(p.x+.3,1.25,p.z);}return result;};
   game.input.consumeHandDelta=function(...a){const d=consume.apply(this,a);if(d.x||d.y)poseProbe.consumed.push({timeS:game.stats.simTime,...d});return d;};
   for(const type of ['pointerdown','pointermove','pointerup'])document.addEventListener(type,e=>{if(e.target===document.getElementById('game'))poseProbe.touch.push({type,trusted:e.isTrusted,kind:e.pointerType,x:e.clientX,y:e.clientY});},true);
  });
  await page.locator('#btnStart').tap();await page.waitForFunction(()=>game.state==='fight'&&poseProbe.first.length===1);
  const cdp=await context.newCDPSession(page),send=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y,id:1}]});
  const from=await page.evaluate(()=>game.player.handOffset.toArray()),to=pose==='side'?[.52,.03]:[.42,.42],xy=[620,215];
  await send('touchStart',...xy);
  const dx=(to[0]-from[0])*390/2.6,dy=-(to[1]-from[1])*390/(2.6*1.35);
  for(let i=1;i<=10;i++){await send('touchMove',xy[0]+dx*i/10,xy[1]+dy*i/10);await page.waitForTimeout(50);}
  await page.waitForTimeout(850);await page.screenshot({path:path.join(dir,'01-held.png')});
  const atHeld=await page.evaluate(()=>({simTime:game.stats.simTime,hand:game.player.handOffset.toArray(),aim:game.player.skill.aim.toArray(),target:game.player.handTarget.toArray()}));
  const extra=pose==='side'?[.10,0]:[.05,.05];await send('touchMove',xy[0]+dx+extra[0]*390/2.6,xy[1]+dy-extra[1]*390/(2.6*1.35));
  await page.waitForTimeout(850);await page.screenshot({path:path.join(dir,'02-extended.png')});
  await send('touchEnd');await page.waitForTimeout(450);await page.screenshot({path:path.join(dir,'03-released.png')});
  const result=await page.evaluate(()=>({probe:poseProbe,simTime:game.stats.simTime,state:game.state,finite:[game.player,game.enemy].every(f=>[...Object.values(f.bodies),f.sword].every(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].every(x=>Object.values(x).every(Number.isFinite))))}));
  assert.ok(result.finite);assert.equal(errors.length,0);assert.ok(result.probe.touch.length>10&&result.probe.touch.every(e=>e.trusted&&e.kind==='touch'));assert.ok(result.probe.consumed.length>=10);
  const row={weapon,pose,correction,model,url:url.href,atHeld,...result,errors};await fs.writeFile(path.join(dir,'result.json'),JSON.stringify(row,null,2),{flag:'wx'});rows.push({weapon,pose,finite:row.finite,samples:row.probe.samples.length,simTime:row.simTime,atHeld,errors});
  console.log(JSON.stringify(rows.at(-1)));
 }finally{await context.close();}
}}finally{await browser.close();await fs.writeFile(path.join(out,'summary.json'),JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),scriptSHA256:createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex'),argv:process.argv.slice(2),startedAt:started.toISOString(),rows,scope:'Trusted touch, live enemy AI/native contacts; no force/pose/health writes. Camera presentation only. Browser scenes not matched injury/AI input comparisons.'},null,2),{flag:'wx'});}
