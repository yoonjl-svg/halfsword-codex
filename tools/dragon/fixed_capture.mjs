import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const report=[];
for(const [w,h]of[[1280,720],[844,390],[390,844],[320,640]]){
 const page=await browser.newPage({viewport:{width:w,height:h},isMobile:w<900,hasTouch:w<900,deviceScaleFactor:1});const errors=[],http=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('response',r=>{if(r.status()>=400)http.push([r.status(),r.url()])});
 await page.goto('http://localhost:5442/dragon.html?debug=1&manual=1');await page.waitForFunction(()=>window.__dragon);
 await page.screenshot({path:`docs/design/dragon_fixed_20261024/menu_${w}x${h}.png`});
 await page.locator('#start').click();
 await page.evaluate(()=>{const g=__dragon;g.dragon.cool=100;g.tick(260);g.position(-1.3,0);g.tick(25);g.draw();});
 await page.screenshot({path:`docs/design/dragon_fixed_20261024/play_${w}x${h}.png`});
 const first=await page.evaluate(()=>__dragon.snapshot());
 await page.evaluate(()=>{const g=__dragon;g.position(-1.3,0);g.setGuard(true);g.attack('nip');g.tick(130);g.draw();});
 await page.screenshot({path:`docs/design/dragon_fixed_20261024/block_${w}x${h}.png`});
 const block=await page.evaluate(()=>__dragon.snapshot());
 await page.locator('#pause').click();const paused=await page.locator('#pauseMenu').isVisible();await page.locator('#resume').click();
 await page.evaluate(()=>{const g=__dragon;g.position(-3.5,2);g.attack('fire');g.tick(245);g.draw();});
 await page.screenshot({path:`docs/design/dragon_fixed_20261024/fire_${w}x${h}.png`});
 const overflow=await page.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth}));
 await page.locator('#pause').click();await page.locator('#restartPause').click();const reset=await page.evaluate(()=>__dragon.snapshot());
 report.push({viewport:[w,h],errors,http,overflow,paused,initial:first,block,reset:{stamina:reset.player.stamina,health:reset.dragon.health,spent:reset.player.spent}});
 console.log(w,h,'errors',errors.length,'block',block.dragon.stats.blocked,'reset',reset.player.stamina);
 await page.close();
}
writeFileSync('docs/design/dragon_fixed_20261024/browser.json',JSON.stringify(report,null,2));await browser.close();
