// The report contains actual game photos; capture their page layout for chat delivery.
import {chromium} from 'playwright';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const p=await browser.newPage({viewport:{width:1200,height:900},deviceScaleFactor:1});
 await p.goto('http://127.0.0.1:4194/night-encounters-3.html',{waitUntil:'networkidle'});
 await p.evaluate(async()=>{for(const img of document.images)img.loading='eager';await Promise.all([...document.images].map(i=>i.decode()));await document.fonts.ready});
 for(const [id,file] of [['alter-lineup','alter-lineup'],['coral-compare','coral-comparison']])await p.locator('#'+id).screenshot({path:`public/encounters/night-third-20261016/${file}.png`});
}finally{await browser.close()}
