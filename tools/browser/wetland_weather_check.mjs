import assert from 'node:assert/strict';import fs from 'node:fs';import {chromium} from 'playwright';
const base=process.argv[2]||'http://127.0.0.1:4194',out=process.argv[3]||'/tmp/wetland-check.json',report={},errors=[];
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--autoplay-policy=no-user-gesture-required']});
try{
 const p=await b.newPage();p.on('pageerror',e=>errors.push(String(e)));
 await p.clock.install({time:new Date('2026-10-16T18:00:00Z')});await p.clock.pauseAt(new Date('2026-10-16T18:00:01Z'));
 await p.goto(base+'/?stage=sluice_night&foe=ratna_mad&weapon=longsword&emo=0',{waitUntil:'networkidle'});
 await p.evaluate(()=>{game.renderCap.tick=()=>false;document.getElementById('btnStart').click()});
 for(let i=0;i<120&&await p.evaluate(()=>game.state!=='fight');i++)await p.clock.runFor(16);
 await p.evaluate(()=>{game.ai.update=()=>{}});await p.clock.runFor(1000);
 const snapshot=()=>p.evaluate(()=>({weather:{...game.scene.getObjectByName('sluice_night-story').userData.weather},scarf:!!game.enemy.groups.head.getObjectByName('alter-ratna-white-headscarf'),armor:game.enemy.hasHelmet,rain:game.scene.getObjectByName('wetland-mist-drizzle').geometry.attributes.position.count,shafts:!!game.scene.getObjectByName('sluice-light-shafts')?.visible,obstacle:game.arenaObstacle,surface:game.enemy.movementSurface}));
 report.night=await snapshot();assert.equal(report.night.scarf,true);assert.equal(report.night.armor,false);assert.equal(report.night.rain,850);assert.equal(report.night.shafts,false);
 const rainY=()=>p.evaluate(()=>({time:game.scene.getObjectByName('sluice_night-story').userData.weather.time,y:Array.from(game.scene.getObjectByName('wetland-mist-drizzle').geometry.attributes.position.array).filter((_,i)=>i%3===1)}));
 const rainBefore=await rainY();await p.clock.runFor(160);const rainAfter=await rainY();
 const speeds=rainBefore.y.map((y,i)=>((y-rainAfter.y[i]+14)%14)/(rainAfter.time-rainBefore.time));
 report.rainSpeed={min:Math.min(...speeds),max:Math.max(...speeds)};assert.ok(report.rainSpeed.min>=4.22&&report.rainSpeed.max<=6.18);
 await p.keyboard.press('p');await p.clock.runFor(32);const paused=await snapshot();assert.equal(await p.evaluate(()=>game.state),'paused');await p.clock.runFor(1500);assert.deepEqual((await snapshot()).weather,paused.weather);
 await p.keyboard.press('p');await p.clock.runFor(500);assert.ok((await snapshot()).weather.time>paused.weather.time);report.pause=true;
 await p.evaluate(()=>{window.thunderEvents=[];const original=game.sound.stageEvent.bind(game.sound);game.sound.stageEvent=(name,data)=>{if(data?.kind==='wetlandThunder')thunderEvents.push(data);return original(name,data)}});
 await p.clock.runFor(9000);report.thunderEvents=await p.evaluate(()=>thunderEvents);
 assert.ok(report.thunderEvents.length>0&&report.thunderEvents.every(e=>Number.isInteger(e.variant)&&e.variant>=0&&e.variant<3&&e.amp>=.55&&e.amp<=.95));
 await p.evaluate(()=>{game.setStage('sluice');game.renderCap.tick=()=>true});await p.clock.runFor(32);
 report.day=await p.evaluate(()=>({weather:!!game.scene.getObjectByName('wetland-overcast-sky'),rain:!!game.scene.getObjectByName('wetland-mist-drizzle'),shafts:game.scene.getObjectByName('sluice-light-shafts').visible,obstacle:game.arenaObstacle,surface:game.enemy.movementSurface,level:game.fighterLight.level,env:game.fighterLight.env}));
 assert.equal(report.day.weather,false);assert.equal(report.day.rain,false);assert.equal(report.day.shafts,true);assert.equal(report.day.level,.89);assert.ok(report.day.env>=.4);assert.deepEqual(report.day.obstacle,report.night.obstacle);assert.equal(report.day.surface,report.night.surface);
 await p.close();
 const q=await b.newPage();q.on('pageerror',e=>errors.push(String(e)));await q.goto((process.env.SOURCE_BASE||base)+'/night-encounters-4.html');
 report.audio=await q.evaluate(async()=>{
  const {Sound,makeRng}=await import('/src/sound.js'),{StageDetailSound}=await import('/src/stage_detail_sound.js');
  const c=new AudioContext();await c.resume();const s=new Sound();s.ctx=c;s.stage='sluice_night';s.master=c.createGain();s.master.gain.value=0;s.master.connect(c.destination);
  const d=new StageDetailSound(s,makeRng);s._stageDetails=d;const nightNodes=d.ambience().nodes.length;
  const drip=d.event({kind:'sluiceDrip',amp:.7,seed:0,time:4.7});
  const e={kind:'wetlandThunder',amp:.8,seed:0,time:6.4},accepted=d.event(e),beforePause=d.voices.size;
  d.setPaused(true);const pausedVoices=d.voices.size,rejectPaused=!d.event(e);d.setPaused(false);d.last.clear();d.lastAny=-Infinity;d.event(e);s.on=false;const mutedVoices=d.voices.size;
  s.on=true;d.setStage('sluice_night');const variants=[];
  for(let variant=0;variant<3;variant++){
   d.stopVoices();d.last.clear();d.lastAny=-Infinity;const ok=d.event({...e,seed:99,variant,amp:.55}),quietGain=d.stats.last.gain;
   d.stopVoices();d.last.clear();d.lastAny=-Infinity;const loud=d.event({...e,seed:99,variant,amp:.95}),loudGain=d.stats.last.gain;
   variants.push({variant,ok,loud,seconds:d.buffers.get('wetlandThunder:'+variant)?.duration,quietGain,loudGain});
  }
  const cached=d.buffers.size;
  d.setStage('sluice');const dayNodes=d.ambience().nodes.length,rejectDay=!d.event(e),buffers=d.buffers.size;
  d.setStage('loggia');const rejectOther=!d.event(e);d.stopAmbient();await c.close();return {nightNodes,dayNodes,drip,accepted,beforePause,pausedVoices,rejectPaused,mutedVoices,rejectDay,rejectOther,buffers,variants,cached};
 });
 const {variants,...lifecycle}=report.audio;
 assert.deepEqual(lifecycle,{nightNodes:8,dayNodes:4,drip:true,accepted:true,beforePause:2,pausedVoices:0,rejectPaused:true,mutedVoices:0,rejectDay:true,rejectOther:true,buffers:0,cached:3});
 variants.forEach((v,i)=>{assert.equal(v.ok&&v.loud,true);assert.equal(v.seconds,[1.8,3.8,6.2][i]);assert.ok(Math.abs(v.quietGain-.132)<1e-6&&Math.abs(v.loudGain-.228)<1e-6)});
 assert.deepEqual(errors,[]);report.pass=true;report.errors=errors;fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await b.close()}
