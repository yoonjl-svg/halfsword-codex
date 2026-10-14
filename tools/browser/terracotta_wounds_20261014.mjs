// Deterministic wound fixture in the real game, separate from trusted-touch delivery.
import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {chromium} from '/workspace/cloud-onboarding/browser/node_modules/playwright/index.mjs';
const out=process.argv[2];assert(out?.startsWith('/tmp/'));await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report={pass:false,method:'Real main.js character wiring and wound hook, direct deterministic wounds while UI paused, then native resume/frame for decap FX. Not natural attack-success evidence.'};
try{
 const page=await browser.newPage({viewport:{width:1200,height:720}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>localStorage.setItem('gladiator-settings',JSON.stringify({pixel:false,sound:false,blood:true,skill:'0.3',fpsCap:true})));
 await page.route('**/@vite/client',r=>r.fulfill({contentType:'application/javascript',body:'// fixed diagnostic session'}));
 await page.goto('http://127.0.0.1:4320/?weapon=longsword&foeWeapon=ganjiang&foe=terracotta&stage=dunhuang',{waitUntil:'networkidle'});
 await page.locator('#btnStart').click();await page.waitForFunction(()=>game.state==='fight'&&game.stats.simTime>=1.2,null,{timeout:90000});
 await page.locator('#btnPause').click();
 await page.evaluate(()=>{game.freeCam=true;game.camera.position.set(-14,9,-24);game.camera.lookAt(17,14,0);});
 await page.addStyleTag({content:'body > :not(canvas):not(script):not(style){visibility:hidden!important}'});
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 await page.locator('canvas').first().screenshot({path:out+'/tower-full.png'});
 await page.addStyleTag({content:'body > :not(canvas):not(script):not(style){visibility:visible!important}'});
 report.body=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const effectURL=performance.getEntriesByType('resource').find(r=>new URL(r.name).pathname==='/src/effects.js')?.name;
  if(!effectURL)throw new Error('Runtime effects module not observed');
  const {Particles}=await import(effectURL);
  const trace=window.clayTrace={blood:0,drip:0,chips:0,colors:[],sounds:[]};
  for(const [method,key] of [['blood','blood'],['drip','drip'],['clayChips','chips']]){const original=Particles.prototype[method];Particles.prototype[method]=function(...a){trace[key]++;return original.apply(this,a);};}
  const add=Particles.prototype.add;Particles.prototype.add=function(...a){trace.colors.push(a[2]);return add.apply(this,a);};
  for(const key of ['clay','cut','stab','blunt','bone']){const original=game.sound[key];game.sound[key]=function(...a){trace.sounds.push(key);return original.apply(this,a);};}
  window.injectWound=(vic,att,zone,type,sev,energy,finish=false)=>{
   const part=zone==='neck'?'head':zone,local=new THREE.Vector3(.06,0,0),dir=new THREE.Vector3(0,1,0);
   const r={part,zone,type,severity:sev,energy,finish,pass:true,passing:type==='cut',bleedPerSev:.2,local,dir,bladeAxis:new THREE.Vector3(0,1,0),t:.5,speed:6,helmet:false,plate:false};
   vic.applyWound(r);const p=vic.bodies[part].translation();game.combat.hooks.onWound(att,vic,r,new THREE.Vector3(p.x,p.y,p.z),{v:{part,body:vic.bodies[part]}});
  };
  window.injectWound(game.enemy,game.player,'chest','stab',1.1,180,true);
  const decals=[];for(const g of Object.values(game.enemy.groups))g.traverse(n=>{if(n.userData.kind)decals.push(n.userData.kind);});
  return {profile:game.enemy.physiology,alive:game.enemy.alive,bleed:game.enemy.bleed,blood:game.enemy.blood,bladeBlood:game.player.bladeBlood||0,decals,trace:JSON.parse(JSON.stringify(trace))};
 });
 assert.deepEqual(report.body.profile,{bleeds:false,deathRequiresHeadDetachment:true});assert(report.body.alive);assert.equal(report.body.bleed,0);assert.equal(report.body.bladeBlood,0);
 assert.equal(report.body.trace.blood,0);assert(report.body.trace.chips>0);assert.deepEqual(report.body.decals,['clay']);assert.deepEqual(report.body.trace.sounds,['clay']);
 report.human=await page.evaluate(()=>{
  window.injectWound(game.player,game.enemy,'chest','cut',.1,12);
  return {bleed:game.player.bleed,alive:game.player.alive,bloodCalls:clayTrace.blood,clayBladeBlood:game.enemy.bladeBlood};
 });
 assert(report.human.bleed>0&&report.human.alive&&report.human.bloodCalls>0&&report.human.clayBladeBlood>0);
 await page.evaluate(()=>{clayTrace.blood=0;clayTrace.drip=0;clayTrace.colors=[];window.injectWound(game.enemy,game.player,'neck','cut',.7,90);});
 await page.locator('#btnResume').click();
 await page.waitForFunction(()=>game.enemy.groups.chest.children.some(n=>n.name==='decapStump'),null,{timeout:90000});
 report.decap=await page.evaluate(()=>{
  const f=game.enemy,disc=f.groups.chest.children.find(n=>n.name==='decapStump');
  return {dead:!f.alive,decapitated:f.decapitated,jointGone:!f.jointByName.head.joint,bleed:f.bleed,capColors:disc.children.map(n=>n.material.color.getHex()),bloodCalls:clayTrace.blood,physicsSteps:game.combat.stepNo};
 });
 assert(report.decap.dead&&report.decap.decapitated&&report.decap.jointGone);assert.equal(report.decap.bleed,0);assert.deepEqual(report.decap.capColors,[0x8b887a,0xaaa697]);assert.equal(report.decap.bloodCalls,0);
 assert.deepEqual(errors,[]);report.errors=errors;report.pass=true;
}catch(e){report.error=e.stack;process.exitCode=1;}finally{await browser.close();await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({pass:report.pass,error:report.error,out}));
