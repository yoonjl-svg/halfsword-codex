import {chromium} from 'playwright';
import fs from 'node:fs';
const base=process.argv[2]||'http://127.0.0.1:4524';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const rows=[],errors=[];const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
try{
for(const [width,height]of [[320,740],[390,844],[844,390]]){
 await page.setViewportSize({width,height});await page.goto(base+'/',{waitUntil:'networkidle'});
 const row=await page.evaluate(async()=>{const imgs=[...document.images];await Promise.all(imgs.map(i=>{i.loading='eager';return i.decode()}));return {w:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,images:imgs.every(i=>i.naturalWidth>0),link:document.querySelector('.button').href};});rows.push(row);
 if(row.overflow||!row.images)throw Error('gallery layout/images');
}
await page.evaluate(()=>localStorage.setItem('courtyard-sentinel','keep'));
await page.locator('.button').tap();await page.waitForFunction(()=>window.game?.player,{timeout:90000});
const iso=await page.evaluate(()=>({isolated:localStorage.getItem('courtyard-sentinel')===null,sw:document.documentElement.dataset.pwa??null,stage:game.stage.id,weapon:game.enemy.weapon.id}));rows.push(iso);if(!iso.isolated||iso.sw||iso.stage!=='courtyard_night')throw Error('isolation/setup');
await page.locator('#btnStart').tap();await page.waitForFunction(()=>game.state==='fight');
await page.locator('#btnPause').tap();await page.locator('#btnResume').waitFor({state:'visible'});await page.locator('#btnResume').tap();await page.waitForFunction(()=>game.state==='fight');rows.push({pauseResume:true});
// Actual touchscreen input: hold the pad, then attack drag. AI temporarily paused so UI validation is independent of a fatal opening hit.
await page.evaluate(()=>{game.ai.update=()=>{}});
const cdp=await page.context().newCDPSession(page);
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:82,y:310,id:1}]});
await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:112,y:310,id:1}]});await page.waitForTimeout(200);
const move=await page.evaluate(()=>({x:game.player.move.x,y:game.player.move.y}));await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:520,y:170,id:2}]});
await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:590,y:130,id:2}]});await page.waitForTimeout(100);
const attack=await page.evaluate(()=>({active:game.player.inputActive,held:game.player.handHeld}));await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});rows.push({move,attack});
await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>window.game?.player);rows.push({reload:await page.evaluate(()=>game.state)});
await page.goto(base+'/');const kept=await page.evaluate(()=>localStorage.getItem('courtyard-sentinel')==='keep');rows.push({productionStoragePreserved:kept});if(!kept)throw Error('save pollution');
}finally{fs.writeFileSync(process.argv[3]||'docs/design/courtyard_ruins_20261021/verification/ui.json',JSON.stringify({rows,errors},null,2));console.log(JSON.stringify({rows,errors}));await browser.close();}
if(errors.length)process.exitCode=1;
