// The report contains actual game photos; capture their page layout for chat delivery.
import {chromium} from 'playwright';
import fs from 'node:fs';
const base=process.argv[2]||'http://127.0.0.1:4194';
const out=process.argv[3]||'public/encounters/alter-refine-20261016';
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const p=await browser.newPage({viewport:{width:1200,height:900},deviceScaleFactor:1});
 await p.goto(`${base}/night-encounters-3.html`,{waitUntil:'networkidle'});
 await p.evaluate(async()=>{for(const img of document.images)img.loading='eager';await Promise.all([...document.images].map(i=>i.decode()));await document.fonts.ready});
 for(const [id,file] of [['revision-fronts','alter-fronts'],['revision-details','alter-details'],['sand-comparison','sand-comparison']])await p.locator('#'+id).screenshot({path:`${out}/${file}.png`});
}finally{await browser.close()}
