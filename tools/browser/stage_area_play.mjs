// Actual keyboard retreat through the old boundary; scripted idle enemy for isolation.
import {chromium} from 'playwright';
import fs from 'node:fs';
const base=process.argv[2]||'http://127.0.0.1:4191',out=process.argv[3]||'/tmp/stage-area-play';
fs.mkdirSync(out,{recursive:true});
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
try {
 const page=await b.newPage({viewport:{width:844,height:390}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.clock.install({time:new Date('2026-10-16T12:00:00Z')});
 await page.clock.pauseAt(new Date('2026-10-16T12:00:01Z'));
 await page.goto(base+'/?weapon=longsword&foe=default&stage=castle&emo=0',{waitUntil:'networkidle'});
 await page.evaluate(()=>{game.renderCap.tick=()=>false;document.getElementById('btnStart').click()});
 for(let i=0;i<120 && await page.evaluate(()=>game.state!=='fight');i++) await page.clock.runFor(16);
 await page.evaluate(()=>{game.ai.update=()=>{}});
 await page.clock.runFor(4000);
 const before=await page.evaluate(()=>({...game.player.bodies.pelvis.translation()}));
 await page.keyboard.down('s'); await page.clock.runFor(10000); await page.keyboard.up('s');
 const after=await page.evaluate(()=>({...game.player.bodies.pelvis.translation()}));
 await page.evaluate(()=>{game.renderCap.tick=()=>true}); await page.clock.runFor(16);
 await page.screenshot({path:out+'/castle-play.png'});
 const result={before,after,radius:Math.hypot(after.x,after.z),errors,pass:Math.hypot(after.x,after.z)>7&&Math.hypot(after.x,after.z)<9.4&&errors.length===0};
 fs.writeFileSync(out+'/play.json',JSON.stringify(result,null,2));console.log(result);
 if(!result.pass)process.exitCode=1;
}finally{await b.close()}
