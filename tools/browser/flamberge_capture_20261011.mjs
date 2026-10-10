import fs from 'node:fs/promises';
import {chromium} from '/workspace/cloud-onboarding/browser/node_modules/playwright/index.mjs';
const base=process.argv[2]||'http://127.0.0.1:4270/';const out=process.argv[3];if(!out)throw Error('Output directory required');await fs.mkdir(out,{recursive:true});
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:{width:900,height:1300}});p.on('pageerror',e=>console.error(e));await p.goto(base+'flamberge-viewer.html');await p.waitForFunction(()=>window.flambergeView);
await p.locator('#viewer').evaluate(e=>{e.style.height='1100px';e.style.maxHeight='none';});await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
for(const id of ['whole','hilt','blade','edge']){
 await p.setViewportSize({width:id==='whole'?420:900,height:1300});await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 await p.evaluate(id=>flambergeView.frame(id),id);
 const s=await p.evaluate(()=>document.querySelector('canvas').toDataURL('image/webp',.9));
 await fs.writeFile(out+'/flamberge-'+id+'.webp',Buffer.from(s.split(',')[1],'base64'));
}
const stats=await p.evaluate(()=>({render:flambergeView.renderer.info.render,memory:flambergeView.renderer.info.memory}));console.log(JSON.stringify(stats));await b.close();
