import { chromium } from 'playwright';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:720}});
let errorSeen=false;page.on('pageerror',e=>{if(!errorSeen)console.log('PAGEERROR',e.stack);errorSeen=true;});page.on('console',m=>{if(m.type()==='error')console.log('ERROR',m.text())});
await page.goto('http://localhost:5440/dragon.html?debug=1');
await page.waitForTimeout(2000);
console.log('BOOT',await page.locator('#fatal').textContent());
if(await page.locator('#start').isEnabled()){
 await page.locator('#start').click();await page.waitForTimeout(6000);
 console.log('STATE',JSON.stringify(await page.evaluate(()=>window.__dragon?.snapshot())));
 await page.screenshot({path:'docs/design/dragon_20261024/first-play.png'});
 await page.keyboard.down('KeyW');await page.waitForTimeout(1300);await page.keyboard.up('KeyW');
 await page.keyboard.down('KeyF');await page.waitForTimeout(5000);await page.keyboard.up('KeyF');
 console.log('GUARD',JSON.stringify(await page.evaluate(()=>window.__dragon?.snapshot())));
 await page.screenshot({path:'docs/design/dragon_20261024/first-close.png'});
}
await browser.close();
