const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
import {writeFileSync} from 'node:fs';
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const p=await b.newPage({viewport:{width:1200,height:760}}),errors=[];p.on('pageerror',e=>errors.push(String(e)));
await p.goto(`${process.env.BASE??'http://127.0.0.1:4338'}/tools/browser/iberian_replay.html`);await p.waitForFunction(()=>window.replayReady,{timeout:60000});
for(const t of [0,.1,.2,.3]){await p.evaluate(t=>showBeat(t),t);await p.screenshot({path:`docs/research/iberian_beat_20261018/replay/compare-${t}.png`});}
writeFileSync('docs/research/iberian_beat_20261018/checks/replay-browser.json',JSON.stringify({errors}));await b.close();
