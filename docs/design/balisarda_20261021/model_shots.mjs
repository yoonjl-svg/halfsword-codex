import {chromium} from 'playwright';
const base=process.argv[2]||'http://127.0.0.1:5191';
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:{width:960,height:740}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto(base+'/docs/design/balisarda_20261021/models.html');await p.waitForFunction(()=>window.modelsReady);
await p.screenshot({path:new URL('./models.png',import.meta.url).pathname,clip:{x:0,y:0,width:960,height:675}});
await p.locator('#details').screenshot({path:new URL('./reverse.png',import.meta.url).pathname});
await p.setViewportSize({width:1200,height:740});await p.locator('#japanese').screenshot({path:new URL('./current-japanese.png',import.meta.url).pathname});
await b.close();if(errors.length)throw Error(errors.join('\n'));
