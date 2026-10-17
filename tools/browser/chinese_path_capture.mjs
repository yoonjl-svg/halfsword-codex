import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
const dir=process.env.OUT_DIR??'/workspace/chinese-parry-path-20261017';
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const p=await b.newPage({viewport:{width:1240,height:980},deviceScaleFactor:1});const errors=[];p.on('pageerror',e=>errors.push(String(e)));
await p.goto(`${process.env.BASE??'http://127.0.0.1:4197'}/tools/sim/chinese_path_visual.html`);
await p.waitForFunction(()=>window.ready,null,{timeout:120000});await p.screenshot({path:`${dir}/comparison.png`,fullPage:true});
const result=await p.evaluate(()=>window.result);writeFileSync(`${dir}/visual.json`,JSON.stringify({errors,result},null,2));console.log(JSON.stringify({errors,result}));
await b.close();if(errors.length)process.exitCode=1;
