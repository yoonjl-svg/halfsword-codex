const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
import {writeFileSync} from 'node:fs';
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const p=await b.newPage({viewport:{width:1200,height:1050}}),errors=[];p.on('pageerror',e=>errors.push(String(e)));
const isLive=process.argv.includes('--live');
await p.goto(`${process.env.BASE??'http://127.0.0.1:4338'}/tools/browser/iberian_compare.html${isLive?'?live':''}`);await p.waitForFunction(()=>window.replayReady,{timeout:60000});
for(const t of [.1,.3,.5]){await p.evaluate(t=>showBeat(t),t);await p.screenshot({path:`docs/research/iberian_compare_20261018/replay/${isLive?'live':'compare'}-${t}.png`,fullPage:true});}
writeFileSync('docs/research/iberian_compare_20261018/checks/replay-browser.json',JSON.stringify({errors,panels:await p.locator('canvas').count()}));await b.close();
if(errors.length)process.exitCode=1;
