import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const base=process.argv[2]??'https://yoonjl-svg.github.io/halfsword-codex/encounters/attack-balance-20261101';
const out=process.argv[3]??'/tmp/attack-balance-20261101/public';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const results=[];
try{
 for(const viewport of [{width:390,height:844},{width:1000,height:800}]){
  const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  const response=await page.goto(base+'/report.html',{waitUntil:'networkidle'});
  const result=await page.evaluate(()=>({rows:document.querySelectorAll('tbody tr').length,noPageOverflow:document.documentElement.scrollWidth<=innerWidth,title:document.querySelector('h1').textContent,exerciseLink:document.querySelector('.button').href}));
  await page.screenshot({path:out+`/public-report-${viewport.width}.png`,fullPage:true});
  results.push({viewport,status:response.status(),...result,errors});
  if(response.status()!==200||result.rows!==19||!result.noPageOverflow||errors.length)throw new Error(JSON.stringify(results.at(-1)));
  await page.close();
 }
 await fs.writeFile(out+'/report-verification.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results));
}finally{await browser.close();}
