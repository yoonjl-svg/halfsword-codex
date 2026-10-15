// Actual local game: fixed seed, no attack entry, passive opponent. 0/10/20/30 seconds of watch decisions.
import {chromium} from 'playwright';
import fs from 'node:fs';
const base=process.argv[2]||'http://127.0.0.1:4173',out=process.argv[3]||'/tmp/cn-watch-shots';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const results=[];
try{
 for(const [name,query,seconds,kind,level] of [['cn-before','&cnLightAi=1&cnAiTune=0',30,'cn',0],['cn-candidate','&cnLightAi=0&cnAiTune=1',30,'cn',0]]){
  const dir=out+'/'+name;fs.mkdirSync(dir,{recursive:true});
  const page=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:1,hasTouch:true,isMobile:true});
  await page.addInitScript(()=>{let n=71;Math.random=()=>{n=(1664525*n+1013904223)>>>0;return n/4294967296;};});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.clock.install({time:new Date('2026-10-16T01:00:00+09:00')});await page.clock.pauseAt(new Date('2026-10-16T01:00:01+09:00'));
  await page.goto(base+'/?weapon='+(kind==='cn'?'qinggang':'longsword')+'&foe=default&stage=castle&emo=0&tempo=1'+query,{waitUntil:'networkidle'});
  await page.evaluate(()=>{game.renderCap.tick=()=>false;document.getElementById('btnStart').click();});
  for(let i=0;i<120&&await page.evaluate(()=>game.state!=='fight');i++)await page.clock.runFor(16);
  await page.evaluate(()=>{game.ai.update=()=>{};});await page.clock.runFor(4000);
  await page.evaluate(({kind,level})=>{
   const f=game.player;window.captureElapsed=0;
   const step=f.step.bind(f);
   if(kind==='tempo'){
    const from=[.42,.42],to=[-.52,-.5];
    f.step=function(dt){const t=window.captureElapsed;
     if(t<1){this.handOffset.set(...from);this.handHeld=true;this.inputActive=true;}
     else {const u=Math.min(1,(t-1)/.18);this.handOffset.set(from[0]+(to[0]-from[0])*u,from[1]+(to[1]-from[1])*u);this.handHeld=true;this.inputActive=u<1;}
     this.move.set(0,0);this.stamina.value=t<1?100:[100,-10,-60][level];this.stamina.level=t<1?0:level;this.stamina.exhaustLeft=0;
     step(dt);window.captureElapsed+=dt;
    };
   }else{
    const a=new game.AI(f,game.enemy,'normal',{school:'qinggang'});const old=game.ai.constructor.prototype.update;
    a.startAttack=()=>false;a.secret=null;game.ai.update=()=>{};f.applyWound=()=>{};game.enemy.applyWound=()=>{};
    f.step=function(dt){a.update(dt);step(dt);window.captureElapsed+=dt;};
   }
   game.renderCap.tick=()=>true;
  },{kind,level});
  for(let n=0;n<4;n++){await page.evaluate(()=>game.renderCap.tick=()=>false);if(n)await page.clock.runFor(10000);await page.evaluate(()=>game.renderCap.tick=()=>true);await page.clock.runFor(16);await page.screenshot({path:dir+'/'+String(n*10).padStart(4,'0')+'.png'});}
  const state=await page.evaluate(()=>({state:game.state,seconds:window.captureElapsed,stamina:game.player.stamina.value,config:{cnLightAi:game.config.GAIT.cnLightAi,cnAiTune:game.config.GAIT.cnAiTune}}));
  results.push({name,kind,level,frameRate:null,frames:4,script:"Fixed seed 71; watch decisions enabled, attack entry disabled, passive opponent; samples at 0/10/20/30s",...state,errors});console.log(name,JSON.stringify(state));await page.close();
 }
}finally{fs.writeFileSync(out+'/manifest.json',JSON.stringify(results,null,2)+'\n');await browser.close();}
