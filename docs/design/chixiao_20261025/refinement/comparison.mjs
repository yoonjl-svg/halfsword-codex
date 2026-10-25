import {chromium} from 'playwright';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const p=await browser.newPage({viewport:{width:864,height:550}});
await p.goto((process.argv[2]||'http://127.0.0.1:5266')+'/docs/design/chixiao_20261025/refinement/comparison.html');
await p.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth));await p.evaluate(()=>document.fonts.ready);
await p.screenshot({path:new URL('./before-after.png',import.meta.url).pathname});await browser.close();
