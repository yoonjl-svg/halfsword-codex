import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage(),errors=[],rows=[];page.on('pageerror',e=>errors.push(e.message));
for(const [slug,id,count]of [['returned-king-20261022','sebastian',6],['white-scale-20261022','white_scale',8]]){
 const base='http://127.0.0.1:5200/encounters/'+slug+'/';
 for(const width of [320,390,844,1200]){
  await page.setViewportSize({width,height:900});await page.goto(base);
  await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
  assert.equal(await page.locator('img').count(),count);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  rows.push({id,width,images:count,overflow:false});
 }
 const pair=page.locator(id==='white_scale'?'.comparison':'.pair').first();
 await pair.screenshot({path:new URL('./'+(id==='white_scale'?'white':'king')+'/comparison.png',import.meta.url).pathname});
 await page.locator('nav a').first().click();await page.waitForFunction(()=>window.game?.state==='menu');
 await page.locator('#btnStart').click();await page.waitForFunction(()=>game.state==='fight');
 const names=await page.evaluate(()=>{let list=[];for(const g of Object.values(game.enemy.groups))g.traverse(o=>{if(o.name)list.push(o.name)});return list;});
 if(id==='sebastian'){assert.equal(names.filter(n=>n==='royal-shoulder-lion').length,2);assert(!names.includes('royal-shoulder-upright-wing'));}
 else assert.equal(names.filter(n=>n==='white-scale-sode-mount').length,2);
 rows.push({id,nestedFinalGame:true});
}
assert.equal(errors.length,0);await browser.close();fs.writeFileSync(new URL('./public-checks.json',import.meta.url),JSON.stringify({rows,errors},null,2));console.log({rows,errors});
