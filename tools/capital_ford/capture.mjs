import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const url=process.argv[2]||'http://localhost:5292/ford.html';
const out=process.argv[3]||'docs/design/capital_ford_20261029/screens';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PW_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto(url,{waitUntil:'networkidle'});await page.waitForTimeout(2500);
console.log('state',await page.evaluate(()=>({ready:!!window.__ford,metrics:window.__ford?.metrics,stage:window.__ford?.arena.stats(),text:document.getElementById('app').shadowRoot.textContent.slice(-1000)})));console.log('errors',errors);
await page.screenshot({path:out+'/initial.png'});
if(await page.evaluate(()=>!!window.__ford)){
 await page.evaluate(()=>{document.getElementById('app').shadowRoot.querySelector('#battleModal').hidden=true;});
 await page.screenshot({path:out+'/overview.png'});
 await page.locator('#battleGo').click({force:true,timeout:1000}).catch(()=>{});
}
await browser.close();
