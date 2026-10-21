import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const base=process.argv[2]||'http://127.0.0.1:4524/game';
const out=process.argv[3]||'docs/design/courtyard_cover_damage_20261021/shots';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
  const context=await browser.newContext({viewport:{width:960,height:540},recordVideo:{dir:'/tmp/courtyard-leak-video',size:{width:960,height:540}}});
  const page=await context.newPage();
  await page.goto(base+'/?test=1&stage=courtyard_night&foe=samira_mad&weapon=longsword&foeWeapon=sabre',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.game?.player);await page.locator('#btnStart').click();await page.waitForFunction(()=>game.state==='fight');
  await page.evaluate(()=>{game.ai.update=()=>{};game.freeCam=true;game.camera.position.set(-2.65,1.1,.7);game.camera.lookAt(-.6,.65,.12);game.camera.fov=46;game.camera.updateProjectionMatrix();});
  await page.addStyleTag({content:'body > :not(#game){visibility:hidden!important}'});
  await page.waitForTimeout(9500);
  const video=page.video();await context.close();const raw=await video.path();
  execFileSync('ffmpeg',['-v','error','-y','-sseof','-8','-i',raw,'-an','-c:v','libvpx-vp9','-b:v','0','-crf','34',out+'/leak.webm']);
  console.log(out+'/leak.webm');
}finally{await browser.close();}
