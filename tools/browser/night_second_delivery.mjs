import {chromium} from 'playwright';
import fs from 'node:fs';

const base=process.argv[2]||'http://127.0.0.1:4194';
const out=process.argv[3]||'/tmp/night-second-delivery.json';
const expected={
 'maya-courtyard.html':['courtyard/samira'],
 'night-encounters-5.html':['etna_night/chanda_mad','qinglan_night/renji_mad'],
 'night-encounters-4.html':['clearing_night/bran_mad','sacred_grove_night/minami_mad','sluice_night/ratna_mad'],
 'night-encounters-3.html':['cathedral_night/margarethe_mad','castle_night/isolde_mad','loggia_night/tome_mad','corsair_night/omari_mad','sacred_grove_night/minami_mad','corsair/omari'],
 'night-encounters-2.html':['clearing_night/bran_mad','castle_night/isolde_mad','cathedral_night/margarethe_mad','temple_night/liao_mad'],
 'night-encounters.html':['frozen_bay_night/eira_mad','temple_night/liao_mad','poseidon_night/heinrich_mad'],
};
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const report={pages:[]};
try{
 for(const [file,duels] of Object.entries(expected).filter(([file])=>process.argv.includes('--maya-only')?file==='maya-courtyard.html':!process.argv.includes('--fifth-only')||file==='night-encounters-5.html')){
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
    for(const audio of document.querySelectorAll('audio')){audio.muted=true;await audio.play();audio.pause()}
    return {
     images:images.length,decoded:images.every(Boolean),overflow:document.documentElement.scrollWidth>innerWidth,
     videos:[...document.querySelectorAll('video')].map(video=>({ready:video.readyState,duration:video.duration,source:video.currentSrc})),
     audios:[...document.querySelectorAll('audio')].map(audio=>({ready:audio.readyState,duration:audio.duration,source:audio.currentSrc})),
     links:[...document.querySelectorAll('.duel')].map(link=>{
      const url=new URL(link.href);
      return {target:`${url.searchParams.get('stage')}/${url.searchParams.get('foe')}`,weapon:url.searchParams.get('weapon'),foeWeapon:url.searchParams.get('foeWeapon')};
     }),
    };
   });
   const audioOK=result.audios.length===(file==='night-encounters-4.html'?4:0)&&result.audios.every(audio=>{
    const name=audio.source.split('/').at(-1),seconds={'thunder-short.mp3':1.8,'thunder-rolling.mp3':3.8,'thunder-extended.mp3':6.2,'thunder-flow.mp3':80}[name];
    return audio.ready>=2&&audio.duration>=seconds&&audio.duration<seconds+.2;
   });
   const nativeOK=(file!=='maya-courtyard.html'||result.links.every(link=>link.foeWeapon==='pistol'))&&(file!=='night-encounters-5.html'||result.links.every(link=>link.foeWeapon===({'etna_night/chanda_mad':'moye','qinglan_night/renji_mad':'brothers_sword'}[link.target])));
   const pass=nativeOK&&audioOK&&result.decoded&&!result.overflow&&!errors.length&&result.videos.every(video=>video.ready>=2&&video.duration===(file==='maya-courtyard.html'?8:video.source.endsWith('/wetland-storm.mp4')?14:4))&&result.links.length===duels.length&&result.links.every(link=>link.weapon===(file==='maya-courtyard.html'?'brothers_sword':'longsword')&&duels.includes(link.target));
   report.pages.push({file,viewport,...result,errors,pass});
   await page.close();
  }
 }
}finally{await browser.close()}
report.pass=report.pages.every(page=>page.pass);
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
if(!report.pass)process.exitCode=1;
