import {chromium} from 'playwright';
import fs from 'node:fs';

const base=process.argv[2]||'http://127.0.0.1:4194';
const out=process.argv[3]||'/tmp/night-second-delivery.json';
const expected={
 'night-encounters-2.html':['clearing_night/bran','castle_night/isolde','cathedral_night/margarethe','temple_night/liao_mad'],
 'night-encounters.html':['frozen_bay_night/eira_mad','temple_night/liao_mad','poseidon_night/heinrich_mad'],
};
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const report={pages:[]};
try{
 for(const [file,duels] of Object.entries(expected)){
  for(const viewport of [{width:390,height:844},{width:844,height:390}]){
   const page=await browser.newPage({viewport}),errors=[];
   page.on('pageerror',error=>errors.push(String(error)));
   page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`)});
   await page.goto(`${base}/${file}`,{waitUntil:'networkidle'});
   const result=await page.evaluate(async()=>{
    for(const detail of document.querySelectorAll('details'))detail.open=true;
    for(const img of document.images)img.loading='eager';
    const images=await Promise.all([...document.images].map(async img=>{await img.decode();return img.naturalWidth>0}));
    for(const video of document.querySelectorAll('video')){video.muted=true;await video.play();video.pause()}
    return {
     images:images.length,decoded:images.every(Boolean),overflow:document.documentElement.scrollWidth>innerWidth,
     videos:[...document.querySelectorAll('video')].map(video=>({ready:video.readyState,duration:video.duration})),
     links:[...document.querySelectorAll('.duel')].map(link=>{
      const url=new URL(link.href);
      return {target:`${url.searchParams.get('stage')}/${url.searchParams.get('foe')}`,weapon:url.searchParams.get('weapon')};
     }),
    };
   });
   const pass=result.decoded&&!result.overflow&&!errors.length&&result.videos.every(video=>video.ready>=2&&video.duration===4)&&result.links.length===duels.length&&result.links.every(link=>link.weapon==='longsword'&&duels.includes(link.target));
   report.pages.push({file,viewport,...result,errors,pass});
   await page.close();
  }
 }
}finally{await browser.close()}
report.pass=report.pages.every(page=>page.pass);
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
if(!report.pass)process.exitCode=1;
