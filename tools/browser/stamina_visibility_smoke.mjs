// 실제 게임 촬영 + 같은 렌더러용 색 합성의 픽셀/크기 검사. iOS 실기기 검사는 아니다.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.argv[2]||'http://127.0.0.1:4173';
const out=process.argv[3]||'/tmp/stamina-visibility';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||'/usr/bin/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--no-sandbox']});
const results=[],errors=[];
try {
 const page=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.clock.install({time:new Date('2026-10-15T12:00:00Z')});await page.clock.pauseAt(new Date('2026-10-15T12:00:01Z'));
 await page.goto(`${base}/?weapon=longsword&foe=default&stage=frozen_bay&emo=0&uniqueStage=0`,{waitUntil:'networkidle'});
 await page.evaluate(()=>{game.renderCap.tick=()=>false;game.config.ARENA.startGap=1.6;document.getElementById('btnStart').click();});
 for(let i=0;i<90&&!(await page.evaluate(()=>game.state==='fight'));i++)await page.clock.runFor(16);
 assert.equal(await page.evaluate(()=>game.state),'fight');
 await page.evaluate(()=>{game.ai.update=()=>{};});await page.clock.runFor(2600);
 const frame=async()=>{await page.evaluate(()=>{game.renderCap.tick=()=>true;});await page.clock.runFor(32);await page.evaluate(()=>{game.renderCap.tick=()=>false;});};
 const bars=()=>page.evaluate(()=>[...document.querySelectorAll('.stamina-bar')].map(el=>({hidden:el.hidden,opacity:getComputedStyle(el).opacity,shadow:getComputedStyle(el).boxShadow,fill:getComputedStyle(el.firstElementChild).backgroundColor,fillTransform:el.firstElementChild.style.transform,x:parseFloat(el.style.left),y:parseFloat(el.style.top),dpr:devicePixelRatio})));
 await page.evaluate(()=>{
  for(const f of [game.player,game.enemy]){f.stamina.value=100;f.stamina.rest=-100;}
  const a=game.player.bodies.chest.translation(),b=game.enemy.bodies.chest.translation(),x=(a.x+b.x)/2,z=(a.z+b.z)/2;
  game.freeCam=true;game.camera.position.set(x,1.7,z+3.5);game.camera.lookAt(x,1.05,z);
 });await frame();
 // 같은 물리 프레임에서 이전 CSS와 새 CSS를 비교한다. 이전 Safari 결함을 합성하지 않는다.
 const before=await page.addStyleTag({content:'.stamina-bar{box-shadow:0 0 0 .5px var(--c-text);transition:none}.stamina-bar[data-full="true"]{opacity:.15}'});
 await page.screenshot({path:`${out}/full-before.png`});results.push({check:'old CSS on same local frame',bars:await bars()});
 await before.evaluate(el=>el.remove());await page.screenshot({path:`${out}/full-after.png`,animations:'disabled'});
 let b=await bars();assert.ok(b.every(x=>!x.hidden&&x.opacity==='0.6'&&x.shadow.includes('0.25px')&&x.shadow.includes('0.5px')));results.push({check:'full sixty percent, white .25 + gold .25',bars:b});
 for(let i=0;i<8;i++){
  await page.evaluate(angle=>{for(const f of [game.player,game.enemy])f.stamina.value=60;const a=game.player.bodies.chest.translation(),b=game.enemy.bodies.chest.translation(),x=(a.x+b.x)/2,z=(a.z+b.z)/2;game.camera.position.set(x+3.5*Math.cos(angle),1.7,z+3.5*Math.sin(angle));game.camera.lookAt(x,1.05,z);},i*Math.PI/4);
  await frame();b=await bars();assert.ok(b.every(x=>!x.hidden&&x.fillTransform==='scaleX(0.6)'&&Number.isInteger(x.x*x.dpr)&&Number.isInteger(x.y*x.dpr)));results.push({check:`partial camera ${i*45}`,bars:b});
 }
 const tint=await page.evaluate(()=>{
  const r=new game.THREE.WebGLRenderer({preserveDrawingBuffer:true});r.setClearColor('#404040');r.setPixelRatio(1);
  const s=game.screenTint,rows=[];s.visible=true;
  const pixel=(x,y)=>{const a=new Uint8Array(4);r.getContext().readPixels(x,y,1,1,r.getContext().RGBA,r.getContext().UNSIGNED_BYTE,a);return [...a];};
  for(const size of [[1110,497],[1175,497],[390,844],[844,390]])for(const emotion of ['fear','anger','obsession']){
   const [w,h]=size;r.setSize(w,h,false);s.setBlood(.5);s.setEmotion(emotion,.75);s.update(10);r.clear();const plain=pixel(w-1,0);s.render(r);
   const a=pixel(0,0),b=pixel(w-1,0),middle=pixel(Math.floor(w/2),Math.floor(h/2));
   let jump=0;for(let x=Math.floor(w*.85);x<w-1;x++){const p=pixel(x,Math.floor(h*.1)),q=pixel(x+1,Math.floor(h*.1));jump=Math.max(jump,...p.slice(0,3).map((v,i)=>Math.abs(v-q[i])));}
   rows.push({size,emotion,left:a,right:b,plain,middle,maxAdjacentJump:jump,autoClear:r.autoClear,autoReset:r.info.autoReset});
  }
  s.setBlood(0);s.setEmotion(null,0);s.update(10);r.clear();const before=r.info.render.frame;s.render(r);const inactiveSkipped=r.info.render.frame===before;
  r.dispose();return{rows,inactiveSkipped,oldLayers:document.querySelectorAll('#hud,#emotion,#vignette').length};
 });
 for(const r of tint.rows){assert.deepEqual(r.left,r.right);assert.notDeepEqual(r.right,r.plain);assert.ok(r.maxAdjacentJump<=2,JSON.stringify(r));assert.ok(r.autoClear&&r.autoReset);}
 assert.ok(tint.inactiveSkipped);assert.equal(tint.oldLayers,0);results.push({check:'12 tint/size combinations: both edges covered without seam',...tint});
 // 실제 시작 경로로 무대를 골라 왼쪽 위 무대 이름까지 촬영 내용과 맞춘다.
 await page.goto(`${base}/?weapon=longsword&foe=default&stage=etna&emo=0&uniqueStage=0`,{waitUntil:'networkidle'});
 await page.evaluate(()=>{game.renderCap.tick=()=>false;game.config.ARENA.startGap=1.6;document.getElementById('btnStart').click();});
 for(let i=0;i<90&&!(await page.evaluate(()=>game.state==='fight'));i++)await page.clock.runFor(16);
 assert.equal(await page.evaluate(()=>game.state),'fight');
 await page.evaluate(()=>{game.ai.update=()=>{};});await page.clock.runFor(1800);
 // 효과가 보이는지 재현할 수 있도록 집착/출혈 강도만 고정한 촬영 상태.
 await page.evaluate(()=>{
  const s=game.screenTint,setBlood=s.setBlood.bind(s),setEmotion=s.setEmotion.bind(s);
  s.setBlood=()=>setBlood(.3);s.setEmotion=()=>setEmotion('obsession',.6);
  for(const f of [game.player,game.enemy]){f.stamina.value=65;f.stamina.rest=-100;}
 });
 for(const size of [{width:1110,height:497},{width:1175,height:497},{width:390,height:844},{width:1175,height:497}]){
  await page.setViewportSize(size);
  // 가상 rAF만 먼저 달리지 않도록 실제 브라우저의 회전/레이아웃도 한 번 완료한다.
  await page.screenshot({animations:'disabled'});await page.clock.runFor(240);await frame();
  const state=await page.evaluate(()=>{const c=document.getElementById('game');return{canvas:[c.width,c.height],css:[c.clientWidth,c.clientHeight],tint:game.screenTint.state};});
  results.push({check:'actual game resize',...size,...state});assert.deepEqual(state.canvas,[size.width*2,size.height*2]);
 }
 await page.screenshot({path:`${out}/etna-after.png`,animations:'disabled'});
 assert.deepEqual(errors,[]);
}finally{fs.writeFileSync(`${out}/results.json`,JSON.stringify({results,errors},null,2));await browser.close();}
console.log(`PASS ${results.length} visibility checks; errors ${errors.length}`);
