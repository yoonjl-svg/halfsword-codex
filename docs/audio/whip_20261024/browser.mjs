import {chromium} from 'playwright';
import fs from 'node:fs';import assert from 'node:assert/strict';
const base=process.argv[2]||'http://127.0.0.1:5425';const root=new URL('.',import.meta.url);
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage();const errors=[],rows=[];
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url())});
for(const width of [320,390,844,1280]){
 await page.setViewportSize({width,height:900});await page.goto(base+'/encounters/whip-sound-20261024/');await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth));
 const data=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,images:[...document.images].map(i=>({src:i.getAttribute('src'),width:i.naturalWidth})),audio:document.querySelectorAll('audio').length}));assert.equal(data.overflow,false);assert.equal(data.audio,8);
 rows.push({width,...data});if([390,1280].includes(width))await page.screenshot({path:new URL('review-'+width+'.png',root).pathname,fullPage:true});
}
const decoded=await page.evaluate(async()=>{const ctx=new AudioContext();const out=[];for(const el of document.querySelectorAll('audio')){const res=await fetch(el.src);const buf=await ctx.decodeAudioData(await res.arrayBuffer());let max=0;for(let c=0;c<buf.numberOfChannels;c++)for(const v of buf.getChannelData(c))max=Math.max(max,Math.abs(v));out.push({url:el.getAttribute('src'),duration:buf.duration,peak:max});}await ctx.close();return out;});assert(decoded.every(x=>x.duration>0.1&&x.peak>0&&x.peak<1));
const play=await page.evaluate(async()=>{const a=document.querySelector('audio[src="audio/A.mp3"]'),b=document.querySelector('audio[src="audio/B-three.mp3"]');await b.play();await a.play();await new Promise(resolve=>a.addEventListener('ended',resolve,{once:true}));return {ended:a.ended,otherPaused:b.paused};});assert(play.ended&&play.otherPaused);
await browser.close();assert.equal(errors.length,0);const report={rows,decoded,play,errors};fs.writeFileSync(new URL('browser.json',root),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({viewports:rows.length,decoded:decoded.length,play,errors}));
