// Compiled game, trusted Start/Pause/restart; close-up camera while paused only.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const opts=Object.fromEntries(process.argv.slice(2).map(x=>{const m=/^--(base|out|weapons)=(.+)$/.exec(x);assert.ok(m);return[m[1],m[2]];}));
const base=new URL(opts.base||'http://127.0.0.1:4281/');assert.ok(['127.0.0.1','localhost'].includes(base.hostname)||(base.origin==='https://yoonjl-svg.github.io'&&base.pathname==='/halfsword-codex/'));
const out=opts.out;assert.ok(out);await fs.mkdir(out,{recursive:false});const hash=b=>createHash('sha256').update(b).digest('hex');
const weapons=(opts.weapons||'qinggang,sabre,rapier,longsword,pistol').split(',');assert.ok(weapons.length&&weapons.every(w=>['qinggang','sabre','rapier','longsword','pistol'].includes(w)));
const files=['src/fighter.js','src/main.js','src/hand_visual.js','tools/browser/hand_detail_screen.mjs'];
const manifest=async()=>Object.fromEntries(await Promise.all(files.map(async f=>[f,hash(await fs.readFile(f))])));
const sourceBefore=await manifest();const launch={executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-background-networking','--use-gl=angle','--use-angle=swiftshader']};
if(base.protocol==='https:'){const p=new URL(process.env.HTTPS_PROXY||process.env.HTTP_PROXY);launch.proxy={server:`${p.protocol}//${p.host}`};}
const browser=await chromium.launch(launch),rows=[],startedAt=new Date().toISOString();let pass=false;
try{for(const weapon of weapons){
 const dir=path.join(out,weapon);await fs.mkdir(dir);const manual=['qinggang','sabre','rapier'].includes(weapon);
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await context.addInitScript(()=>localStorage.setItem('gladiator-settings',JSON.stringify({skill:'0.7',difficulty:'normal'})));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 try{
  const url=new URL(base);url.search=new URLSearchParams({weapon,foeWeapon:'longsword',foe:'default',...(manual?{onehandArm:'manual',targetCorrection:'none'}:{})}).toString();await page.goto(url.href);await page.waitForFunction(()=>window.game?.player?.sword,null,{timeout:60000});
  const portrait=await page.evaluate(()=>({width:innerWidth,scrollWidth:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)}));assert.ok(portrait.scrollWidth<=portrait.width+1);
  const asset=await page.locator('script[type="module"][src]').first().getAttribute('src'),response=await page.request.get(new URL(asset,page.url()).href);assert.equal(response.status(),200);const bytes=await response.body();
  await page.setViewportSize({width:844,height:390});await page.locator('#btnStart').tap();await page.waitForFunction(()=>game.state==='fight'&&game.stats.simTime>=1.5,null,{timeout:60000});
  await page.locator('#btnPause').tap();await page.waitForFunction(()=>game.state==='paused');
  const before=await page.evaluate(()=>{window.detailPlayer=game.player;return {timeS:game.stats.simTime,model:game.player.onehandArmModel,skill:game.player.skill.level,render:game.renderInfo()};});
  await page.evaluate(()=>{document.getElementById('menu').style.visibility='hidden';game.freeCam=true;const h=game.player.groups.farmS.children.find(c=>c.name.startsWith('mitten-'));game.player.groups.farmS.updateWorldMatrix(true,true);const p=h.getWorldPosition(h.position.clone());game.camera.position.set(p.x-.27,p.y+.20,p.z+.56);game.camera.lookAt(p);});
  await page.waitForTimeout(250);await page.screenshot({path:path.join(dir,'01-grip-close.png')});
  // Opposite camera sides and the other hand expose chirality, not just the
  // existence of a thumb. Physics remains paused throughout these views.
  for(const [part,side,label] of [['farmS',-1,'02-main-opposite'],['farmO',1,'03-off-outside'],['farmO',-1,'04-off-opposite']]){
   await page.evaluate(({part,side})=>{const g=game.player.groups[part],h=g.children.find(c=>c.name.startsWith('mitten-'));g.updateWorldMatrix(true,true);const p=h.getWorldPosition(h.position.clone());game.camera.position.set(p.x-.27,p.y+.20,p.z+side*.56);game.camera.lookAt(p);},{part,side});
   await page.waitForTimeout(150);await page.screenshot({path:path.join(dir,label+'.png')});
  }
  // Looking from the hand's palmar side exposes the thumb root, which can be
  // occluded by the grip in either fixed world-side camera.
  for(const [part,label] of [['farmS','05-main-palm'],['farmO','06-off-palm']]){
   await page.evaluate(({part})=>{const g=game.player.groups[part],h=g.children.find(c=>c.name.startsWith('mitten-')),pose=h.children.find(c=>c.isGroup);g.updateWorldMatrix(true,true);const p=h.getWorldPosition(h.position.clone()),q=pose.getWorldQuaternion(pose.quaternion.clone());const offset=p.clone().set(.40,.18,.12).applyQuaternion(q);game.camera.position.copy(p).add(offset);game.camera.lookAt(p);},{part});
   await page.waitForTimeout(150);await page.screenshot({path:path.join(dir,label+'.png')});
  }
  const pausedAfter=await page.evaluate(()=>game.stats.simTime);assert.equal(pausedAfter,before.timeS);
  await page.evaluate(()=>{document.getElementById('menu').style.visibility='';game.freeCam=false;});await page.locator('#btnStart').tap();await page.waitForFunction(()=>game.state==='fight'&&game.player!==detailPlayer&&game.stats.simTime>=.2,null,{timeout:60000});
  const restarted=await page.evaluate(()=>({newPlayer:game.player!==detailPlayer,model:game.player.onehandArmModel,skill:game.player.skill.level,pad:game.player.handOffset.toArray(),render:game.renderInfo(),saved:JSON.parse(localStorage.getItem('gladiator-settings')),handCount:[game.player,game.enemy].reduce((n,f)=>n+['farmS','farmO'].filter(p=>f.groups[p].children.some(c=>c.name.startsWith('mitten-'))).length,0)}));assert.equal(restarted.handCount,4);assert.equal(restarted.model,manual?'manual':'legacy');assert.equal(errors.length,0);
  const row={weapon,url:url.href,portrait,before,pausedAfter,restarted,errors,compiled:{url:new URL(asset,page.url()).href,bytes:bytes.length,sha256:hash(bytes)}};rows.push(row);await fs.writeFile(path.join(dir,'result.json'),JSON.stringify(row,null,2),{flag:'wx'});console.log(JSON.stringify(row));
 }finally{await context.close();}
}pass=true;}finally{await browser.close();const sourceAfter=await manifest();await fs.writeFile(path.join(out,'summary.json'),JSON.stringify({pass:pass&&JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter),sourceBefore,sourceAfter,sourceStable:JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter),startedAt,finishedAt:new Date().toISOString(),argv:process.argv.slice(2),rows,scope:'Actual compiled game mobile entry/Start/Pause/new Fighter restart. Paused close-ups from both sides of main/off hand, camera and menu visibility only; no input, native pose/force/health writes. Images require anatomical review; pass alone does not certify chirality. One restart per weapon is not GPU stress or device-performance proof.'},null,2),{flag:'wx'});}
