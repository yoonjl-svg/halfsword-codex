// Actual weather clock/render, held camera and fighters. Audio is rendered with
// the game's Web Audio classes at the captured visual-event times, then muxed.
import {chromium} from 'playwright';import fs from 'node:fs';
const base=process.argv[2]||'http://127.0.0.1:4194',out=process.argv[3]||'/tmp/wetland-clip';fs.mkdirSync(out+'/frames',{recursive:true});
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--autoplay-policy=no-user-gesture-required']}),errors=[];
try{
 const p=await b.newPage({viewport:{width:960,height:540},deviceScaleFactor:1});p.on('pageerror',e=>errors.push(String(e)));
 await p.clock.install({time:new Date('2026-10-16T18:00:00Z')});await p.clock.pauseAt(new Date('2026-10-16T18:00:01Z'));
 await p.goto(base+'/?stage=sluice_night&foe=ratna_mad&weapon=longsword&emo=0',{waitUntil:'networkidle'});
 await p.evaluate(()=>{game.renderCap.tick=()=>false;document.getElementById('btnStart').click()});
 for(let i=0;i<120&&await p.evaluate(()=>game.state!=='fight');i++)await p.clock.runFor(16);
 await p.evaluate(()=>{game.ai.update=()=>{}});await p.clock.runFor(2500);
 await p.evaluate(()=>{game.freeCam=true;game.world.step=()=>{};for(const f of [game.player,game.enemy])for(const m of f.meshes)m.group.visible=false;game.camera.position.set(6,4,6);game.camera.lookAt(17,3,-9);game.camera.fov=58;game.camera.updateProjectionMatrix()});
 await p.addStyleTag({content:'body > :not(#game){visibility:hidden!important}'});
 const t=await p.evaluate(()=>game.scene.getObjectByName('sluice_night-story').userData.weather.time);
 await p.clock.runFor(Math.ceil((60-t)*1000));
 const start=await p.evaluate(()=>{window.weatherEvents=[];const original=game.sound.stageEvent.bind(game.sound);game.sound.stageEvent=(name,data)=>{if(data?.kind==='wetlandThunder')weatherEvents.push({...data});return original(name,data)};return game.scene.getObjectByName('sluice_night-story').userData.weather.time});
 const frames=[];
 for(let i=0;i<256;i++){
  await p.evaluate(()=>game.renderCap.tick=()=>false);await p.clock.runFor(i%2?47:46);await p.evaluate(()=>game.renderCap.tick=()=>true);await p.clock.runFor(16);
  frames.push(await p.evaluate(()=>({...game.scene.getObjectByName('sluice_night-story').userData.weather})));
  await p.screenshot({path:`${out}/frames/${String(i).padStart(3,'0')}.png`});
 }
 const events=await p.evaluate(()=>weatherEvents);await p.close();
 const q=await b.newPage();await q.goto('http://127.0.0.1:4193/night-encounters-4.html');
 const data=await q.evaluate(async({events,start})=>{
  const {Sound,makeRng}=await import('/src/sound.js'),{StageDetailSound}=await import('/src/stage_detail_sound.js'),{SOUND}=await import('/src/config.js');
  const sr=22050,c=new OfflineAudioContext(2,sr*16,sr),s=new Sound();s.ctx=c;s.seed=161026;s.stage='sluice_night';s.master=c.createGain();s.master.gain.value=SOUND.volume;s.master.connect(c.destination);
  const detail=new StageDetailSound(s,makeRng);detail.ambience();const scheduled=events.filter(e=>e.time>start&&e.time-start<15.9).map(e=>({e,promise:c.suspend(e.time-start)}));
  const render=c.startRendering(),accepted=[];
  for(const {e,promise} of scheduled){await promise;accepted.push(detail.event(e));await c.resume()}
  const buffer=await render;return {sr,channels:[...Array(2)].map((_,i)=>Array.from(buffer.getChannelData(i))),accepted,stats:detail.stats};
 },{events,start});
 const n=data.channels[0].length,buf=Buffer.alloc(44+n*4);buf.write('RIFF',0);buf.writeUInt32LE(36+n*4,4);buf.write('WAVEfmt ',8);buf.writeUInt32LE(16,16);buf.writeUInt16LE(1,20);buf.writeUInt16LE(2,22);buf.writeUInt32LE(data.sr,24);buf.writeUInt32LE(data.sr*4,28);buf.writeUInt16LE(4,32);buf.writeUInt16LE(16,34);buf.write('data',36);buf.writeUInt32LE(n*4,40);
 let peak=0;for(let i=0;i<n;i++)for(let ch=0;ch<2;ch++){const v=data.channels[ch][i];peak=Math.max(peak,Math.abs(v));buf.writeInt16LE(Math.round(Math.max(-1,Math.min(1,v))*32767),44+(i*2+ch)*2)}fs.writeFileSync(out+'/weather.wav',buf);
 fs.writeFileSync(out+'/clip.json',JSON.stringify({start,seconds:16,fps:16,frames,events,audio:{accepted:data.accepted,stats:data.stats,peak},errors},null,2)+'\n');
 if(errors.length||data.accepted.some(x=>!x))process.exitCode=1;
}finally{await b.close()}
