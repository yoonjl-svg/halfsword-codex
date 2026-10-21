import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const out='/workspace/halfsword-codex/docs/design/iberian_legend_candidates_20261021';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const rows=[];
for(const width of [320,390,844,1200]){
 const page=await browser.newPage({viewport:{width,height:820},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:5193/encounters/iberian-legend-candidates-20261021/',{waitUntil:'networkidle'});
 await page.evaluate(()=>document.fonts.ready);
 const state=await page.evaluate(()=>({images:[...document.images].map(x=>({src:x.getAttribute('src'),loaded:x.complete&&x.naturalWidth>0,width:x.naturalWidth,height:x.naturalHeight,link:x.closest('a')?.getAttribute('href')})),overflow:document.documentElement.scrollWidth>innerWidth}));
 if(state.images.length!==3||state.images.some(x=>!x.loaded||x.src!==x.link)||state.overflow||errors.length)throw Error(JSON.stringify({width,state,errors}));
 if(width===1200)await page.locator('main').screenshot({path:out+'/comparison.png'});
 if(width===390)await page.screenshot({path:out+'/mobile.png',fullPage:true});
 rows.push({width,...state,errors});await page.close();
}
await browser.close();await fs.writeFile(out+'/browser-check.json',JSON.stringify(rows,null,2)+'\n');console.log(JSON.stringify(rows));

