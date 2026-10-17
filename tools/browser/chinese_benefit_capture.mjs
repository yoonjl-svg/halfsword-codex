import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
const dir=process.env.BENEFIT_OUT??'/workspace/chinese-parry-benefit-20261017';
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const p=await b.newPage({viewport:{width:1240,height:1020},deviceScaleFactor:1}),errors=[];p.on('pageerror',e=>errors.push(String(e)));
await p.goto(`${process.env.BASE??'http://127.0.0.1:4197'}/tools/sim/chinese_benefit_visual.html`);await p.waitForFunction(()=>window.ready,null,{timeout:120000});
await p.screenshot({path:`${dir}/comparison.png`,fullPage:true});
const result=await p.evaluate(()=>window.result);writeFileSync(`${dir}/visual.json`,JSON.stringify({errors,result}));console.log(JSON.stringify({errors,rows:result.length}));
await b.close();if(errors.length)process.exitCode=1;
