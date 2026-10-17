import {chromium} from 'playwright';
import {writeFileSync,mkdirSync} from 'node:fs';
const out=process.env.OUT??'/workspace/japanese-flow-redesign-20261017';mkdirSync(out,{recursive:true});
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const p=await b.newPage({viewport:{width:1240,height:1080},deviceScaleFactor:1}),errors=[];p.on('pageerror',e=>errors.push(String(e)));
await p.goto(`${process.env.BASE??'http://127.0.0.1:4197'}/tools/sim/${process.env.PAGE??'japanese_flow_redesign_visual.html'}`);await p.waitForFunction(()=>window.ready,null,{timeout:90000});
await p.screenshot({path:`${out}/${process.env.NAME??'contact-comparison'}.png`,fullPage:true});
const result=await p.evaluate(()=>window.result);writeFileSync(`${out}/${process.env.NAME??'visual'}.json`,JSON.stringify({errors,result}));console.log(JSON.stringify({errors,rows:result.length}));
await b.close();if(errors.length)process.exitCode=1;
