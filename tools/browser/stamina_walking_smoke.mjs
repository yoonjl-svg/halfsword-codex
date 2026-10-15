// 실제 키 입력으로 0.62m 걷기 비용 5회를 확인한다. 막기 유지로 회복만 멈춘 촬영용 상태.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.argv[2]||'http://127.0.0.1:4173';
const out=process.argv[3]||'/tmp/stamina-walking';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||'/usr/bin/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--no-sandbox']});
const errors=[],results=[];
try {
 for(const [weapon,tradition,cost] of [['qinggang','chinese',.7],['longsword','german',1.4],['uchigatana','japanese',2.1]]) {
  const page=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:2,hasTouch:true,isMobile:true});
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.clock.install({time:new Date('2026-10-15T21:00:00+09:00')});await page.clock.pauseAt(new Date('2026-10-15T21:00:01+09:00'));
  await page.goto(`${base}/?weapon=${weapon}&foe=default&stage=castle&emo=0&uniqueStage=0&tempo=1`,{waitUntil:'networkidle'});
  await page.evaluate(()=>{game.renderCap.tick=()=>false;game.config.ARENA.startGap=6;document.getElementById('btnStart').click();});
  for(let i=0;i<90&&!(await page.evaluate(()=>game.state==='fight'));i++)await page.clock.runFor(16);
  assert.equal(await page.evaluate(()=>game.state),'fight');
  await page.evaluate(()=>{game.ai.update=()=>{};});await page.clock.runFor(2600);
  await page.keyboard.down('KeyF');await page.clock.runFor(32);
  await page.evaluate(()=>{game.player.stamina.value=70;});
  const snap=()=>page.evaluate(()=>({tradition:game.player.swordArt.tradition,value:game.player.stamina.value,time:game.player.stamina.time,distanceRemainder:game.player.stamina.distance,spent:{...game.player.stamina.spent},recovered:game.player.stamina.recovered,guard:game.playerGuard.held,state:game.player.state}));
  const before=await snap();assert.equal(before.tradition,tradition);assert.equal(before.spent.move,0);assert.equal(before.guard,true);
  await page.keyboard.down('KeyD');
  for(let i=0;i<160&&(await snap()).spent.move<5*cost-1e-6;i++)await page.clock.runFor(250);
  await page.keyboard.up('KeyD');
  // 화면 렌더링만 켜며 회복은 계속 막는다. 별도 숫자/게이지를 합성하지 않는다.
  await page.evaluate(()=>{game.renderCap.tick=()=>true;});await page.clock.runFor(16);
  const after=await snap();
  assert.ok(Math.abs(after.spent.move-5*cost)<1e-6,JSON.stringify({weapon,after}));
  assert.ok(Math.abs(after.value-(70-5*cost))<1e-6,JSON.stringify({weapon,after}));
  assert.equal(after.recovered,before.recovered);assert.equal(after.state,'stand');
  for(const kind of ['attack','block','secret','push','clinch'])assert.equal(after.spent[kind],before.spent[kind]);
  assert.equal(await page.locator('.stamina-bar').first().evaluate(el=>el.hidden),false);
  results.push({check:'five walking charges through actual input with recovery held',weapon,tradition,cost,chargedDistance:3.1,before,after});
  await page.screenshot({path:`${out}/${tradition}-five-steps.png`,animations:'disabled'});
  await page.close();
 }
 assert.deepEqual(errors,[]);
}finally{fs.writeFileSync(`${out}/results.json`,JSON.stringify({results,errors},null,2));await browser.close();}
console.log(`PASS ${results.length} walking browser checks; errors ${errors.length}`);
