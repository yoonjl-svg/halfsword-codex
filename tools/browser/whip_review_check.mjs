import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const base=process.argv[2]||'http://localhost:5452/encounters/whip-ghost-20261025/';
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
const result=[];
for(const[w,h]of[[320,700],[390,844],[844,390],[1280,720]]){
 const p=await b.newPage({viewport:{width:w,height:h},hasTouch:true}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(r.status()+':'+r.url())});
 await p.goto(base);await p.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth));
 const data=await p.evaluate(async()=>{const audio=[];for(const a of document.querySelectorAll('audio')){await a.play();await new Promise(r=>setTimeout(r,80));audio.push({id:a.id,played:!a.paused,duration:a.duration});a.pause()}return{overflow:document.documentElement.scrollWidth>innerWidth,audio}});
 assert.equal(data.overflow,false);assert.equal(errors.length,0);assert.ok(data.audio.every(a=>a.played&&a.duration>0));
 result.push({viewport:[w,h],...data,errors});
 if(w===844){await p.locator('#whip').click();await p.waitForFunction(()=>window.game?.enemy);await p.locator('#btnStart').tap();await p.waitForFunction(()=>game.state==='fight'&&game.sound.samples?.whipContact?.length===3);const gameCheck=await p.evaluate(()=>({body:game.enemy.physiology,proficiency:game.ai.persona.proficiency,weapon:game.player.weapon.id,mode:game.config.SOUND.whipHit}));assert.equal(gameCheck.body.blood,'white');assert.equal(gameCheck.proficiency.chinese,5);assert.equal(gameCheck.weapon,'druid_whip');assert.equal(gameCheck.mode,'contact');assert.equal(errors.length,0);result.at(-1).game=gameCheck;}
 await p.close();
}
await b.close();console.log(JSON.stringify({base,result}));if(process.argv[3])writeFileSync(process.argv[3],JSON.stringify({base,result},null,2));
