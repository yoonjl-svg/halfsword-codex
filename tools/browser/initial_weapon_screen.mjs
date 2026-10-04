// First poses in the compiled game: trusted Start, original AI/native physics.
// Only the inspection camera changes. No input, pose, health or force writes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {WEAPONS} from '../../src/weapons.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const opts=Object.fromEntries(process.argv.slice(2).map(x=>{const m=/^--(base|out|weapons)=(.+)$/.exec(x);assert.ok(m);return [m[1],m[2]];}));
const base=new URL(opts.base||'http://127.0.0.1:4281/');
assert.ok(['127.0.0.1','localhost'].includes(base.hostname)||(base.origin==='https://yoonjl-svg.github.io'&&base.pathname==='/halfsword-codex/'));
const out=opts.out;assert.ok(out);await fs.mkdir(out,{recursive:false});
const hash=b=>createHash('sha256').update(b).digest('hex');
const files=['src/fighter.js','src/main.js','src/skill.js','src/hand_visual.js','src/weapons.js','tools/browser/initial_weapon_screen.mjs'];
const manifest=async()=>Object.fromEntries(await Promise.all(files.map(async f=>[f,hash(await fs.readFile(f))])));
const sourceBefore=await manifest(),sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const launch={executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-background-networking','--use-gl=angle','--use-angle=swiftshader']};
if(base.protocol==='https:'){const p=new URL(process.env.HTTPS_PROXY||process.env.HTTP_PROXY);launch.proxy={server:`${p.protocol}//${p.host}`};}
const browser=await chromium.launch(launch),rows=[],startedAt=new Date().toISOString();let pass=false;
try{for(const weapon of (opts.weapons||Object.keys(WEAPONS).join(',')).split(',')){
 assert.ok(WEAPONS[weapon]);const dir=path.join(out,weapon);await fs.mkdir(dir);
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await context.addInitScript(()=>localStorage.setItem('gladiator-settings',JSON.stringify({skill:'0.7',difficulty:'normal'})));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 try{
  const manual=!!WEAPONS[weapon].oneHandStance&&!WEAPONS[weapon].gun;
  const url=new URL(base);url.search=new URLSearchParams({weapon,foeWeapon:'longsword',foe:'default',...(manual?{onehandArm:'manual',targetCorrection:'none'}:{})}).toString();
  await page.goto(url.href);await page.waitForFunction(()=>window.game?.player?.sword,null,{timeout:60000});
  const portrait=await page.evaluate(()=>({width:innerWidth,scrollWidth:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)}));assert.ok(portrait.scrollWidth<=portrait.width+1);
  const moduleURL=await page.locator('script[type="module"][src]').first().getAttribute('src');
  const response=await page.request.get(new URL(moduleURL,page.url()).href);assert.equal(response.status(),200);const bytes=await response.body();
  await page.setViewportSize({width:844,height:390});
  await page.evaluate(()=>{
   window.initialProbe={frames:[],starts:[],trusted:[]};
   document.getElementById('btnStart').addEventListener('pointerdown',e=>initialProbe.trusted.push({trusted:e.isTrusted,type:e.pointerType}));
   const P=Object.getPrototypeOf(game.player),step=P.step,seen=new WeakSet();
   const read=f=>{const q=f.sword.rotation(),y=1-2*(q.x*q.x+q.z*q.z);return {timeS:game.stats.simTime,model:f.onehandArmModel,skill:f.skill.level,pad:f.handOffset.toArray(),targetDeg:Math.asin(Math.max(-1,Math.min(1,f.aimDirW.y)))*180/Math.PI,actualDeg:Math.asin(Math.max(-1,Math.min(1,y)))*180/Math.PI,state:f.state,armed:f.armed,wounds:f.wounds.length,finite:[...Object.values(f.bodies),f.sword].every(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].every(v=>Object.values(v).every(Number.isFinite)))};};
   P.step=function(...a){const v=step.apply(this,a);if(this===game.player){const r=read(this);if(!seen.has(this)){seen.add(this);initialProbe.starts.push(r);}if(r.timeS<=2)initialProbe.frames.push(r);}return v;};
  });
  await page.locator('#btnStart').tap();await page.waitForFunction(()=>game.state==='fight'&&initialProbe.starts.length===1);
  await page.waitForFunction(()=>game.stats.simTime>=0.45,null,{timeout:60000});await page.screenshot({path:path.join(dir,'01-default.png')});
  // Side view exposes wrist/handle alignment without moving the fighters.
  await page.evaluate(()=>{game.freeCam=true;const p=game.player.bodies.pelvis.translation();game.camera.position.set(p.x-1.1,1.7,p.z+2.7);game.camera.lookAt(p.x+.25,1.27,p.z);});
  await page.waitForFunction(()=>game.stats.simTime>=1.85,null,{timeout:60000});await page.screenshot({path:path.join(dir,'02-oblique.png')});
  const result=await page.evaluate(()=>({probe:initialProbe,simTime:game.stats.simTime,render:game.renderInfo(),hands:[game.player,game.enemy].map(f=>Object.fromEntries(['farmS','farmO'].map(n=>{const g=f.groups[n],h=g.children.find(c=>c.name.startsWith('mitten-'));return [n,h?{name:h.name,position:h.position.toArray(),quaternion:h.quaternion.toArray(),visible:h.visible}:null];})))}));
  assert.equal(errors.length,0);assert.ok(result.probe.frames.every(f=>f.finite));assert.ok(result.probe.trusted.some(e=>e.trusted&&e.type==='touch'));assert.equal(result.probe.starts[0].model,manual?'manual':'legacy');
  assert.ok(result.hands.every(h=>h.farmS&&h.farmO),'Both fighters have thumbs');
  const row={weapon,url:url.href,manual,portrait,compiled:{url:new URL(moduleURL,page.url()).href,bytes:bytes.length,sha256:hash(bytes)},errors,...result};
  await fs.writeFile(path.join(dir,'result.json'),JSON.stringify(row,null,2),{flag:'wx'});rows.push(row);console.log(JSON.stringify({weapon,manual,frames:result.probe.frames.length,first:result.probe.starts[0],last:result.probe.frames.at(-1),errors}));
 }finally{await context.close();}
}pass=true;}finally{
 await browser.close();const sourceAfter=await manifest();await fs.writeFile(path.join(out,'summary.json'),JSON.stringify({pass:pass&&JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter),sourceBefore,sourceAfter,sourceStable:JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter),sourceCommit,startedAt,finishedAt:new Date().toISOString(),argv:process.argv.slice(2),rows,scope:'Compiled actual game, portrait entry and trusted Start, canonical weapons; manual/off for non-gun onehand, ordinary defaults otherwise. First2s read-only native tracking, original reactive enemy; camera-only oblique. Not matched A/B or human-naturalness proof.'},null,2),{flag:'wx'});
}
