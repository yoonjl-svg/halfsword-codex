// Appearance-only Maya and explicitly unarmored Artoria: compare real runtime state.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {CHARACTERS_BY_ID as C,CHARACTER_VARIANTS,aiAtProficiency} from '../../src/characters.js';
const base=process.argv[2]||'http://127.0.0.1:4194',out=process.argv[3]||'/tmp/royal-check.json';
const report={errors:[],characters:{},proficiencyPairs:0};
assert.equal(CHARACTER_VARIANTS.length,16);
for(const id of ['samira','artoria']){
 const a=C[id+'_mad'],b=C[id];assert.ok(a.mad&&a.retainBaseStats);
 for(const k of ['ai','weapon','body','strength','voice','physiology','revive'])assert.deepEqual(a[k],b[k],`${id}/${k}`);
 for(let p=1;p<=5;p++){assert.deepEqual(aiAtProficiency(a,p),aiAtProficiency(b,p));report.proficiencyPairs++}
 assert.equal(a.look.hair,b.look.hair);assert.notEqual(a.look,b.look);
}
assert.equal(C.artoria.look.armor,'plate');assert.equal(C.artoria_mad.look.armor,null);
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
try{
 for(const id of (process.argv.includes('--artoria-only')?['artoria','artoria_mad']:['samira','samira_mad','artoria','artoria_mad'])){
  const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true});
  page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
  await page.clock.install({time:new Date('2026-10-16T18:00:00Z')});await page.clock.pauseAt(new Date('2026-10-16T18:00:01Z'));
  const stage=id.startsWith('samira')?'courtyard':'corsair';
  await page.goto(`${base}/?stage=${stage}&foe=${id}&foeWeapon=${C[id].weapon}&weapon=longsword&emo=0`,{waitUntil:'networkidle'});
  await page.evaluate(()=>{game.renderCap.tick=()=>false;document.getElementById('btnStart').click()});
  for(let i=0;i<120&&await page.evaluate(()=>game.state!=='fight');i++)await page.clock.runFor(16);
  assert.equal(await page.evaluate(()=>game.state),'fight');
  report.characters[id]=await page.evaluate(()=>{
   const f=game.enemy;
   return {weapon:f.weapon.id,strength:f.strength,level:game.ai.level,proficiency:game.ai.persona.proficiency,
    masses:Object.fromEntries(Object.entries(f.bodies).map(([k,b])=>[k,b.mass()])),
    bodyMasses:Object.fromEntries(Object.entries(f.bodies).map(([k,b])=>[k,b.collider(0).mass()])),colliders:game.world.colliders.len(),
    plate:f.plate,plateGait:f.plateGait,helmet:f.helmetType,
    boxes:Object.fromEntries(Object.entries(f.plateBoxes).map(([k,boxes])=>[k,{partial:boxes.partial,boxes:boxes.list.map(b=>({min:b.box.min,max:b.box.max}))}])),
    props:{dispatch:!!f.groups.pelvis.getObjectByName('maya-open-dispatch-case'),crown:!!f.groups.head.getObjectByName('artoria-broken-circlet'),cape:!!f.groups.chest.getObjectByName('artoria-cape')},
    top:!!f.groups.chest.getObjectByName('artoria-ballroom-bodice'),bottom:!!f.groups.pelvis.getObjectByName('artoria-ballroom-skirt'),bow:!!f.groups.head.getObjectByName('artoria-ivory-bow'),courtCrown:!!f.groups.head.getObjectByName('artoria-lily-crown'),boots:['shinF','shinB'].every(k=>f.groups[k].getObjectByName('artoria-knee-boot'))};
  });
  // Actually advance combat, including aiming/swinging, with rendering sampled.
  for(let i=0;i<24;i++){
   await page.clock.runFor(500);
   const pose=await page.evaluate(()=>Object.values(game.enemy.bodies).every(b=>Object.values(b.translation()).every(Number.isFinite)));
   assert.ok(pose,`${id} finite at ${(i+1)*.5}s`);
  }
  await page.evaluate(()=>{game.renderCap.tick=()=>true});await page.clock.runFor(16);
  report.characters[id].live=await page.evaluate(()=>({state:game.state,enemyState:game.enemy.state,render:game.renderInfo(),finite:game.enemy.meshes.every(m=>m.group.matrixWorld.elements.every(Number.isFinite))}));
  assert.ok(report.characters[id].live.finite);await page.close();
 }
 for(const id of ['samira','artoria']){
  const a=report.characters[id+'_mad'],b=report.characters[id];if(!a)continue;
  // Gait adds 2 kg to each planted foot, so an arbitrary startup frame can
  // report 1.1 or 3.1 kg. Compare underlying colliders, not that transient.
  for(const k of ['weapon','strength','level','proficiency','bodyMasses','colliders','helmet'])assert.deepEqual(a[k],b[k],`${id}/${k}`);
 }
 const a=report.characters.artoria_mad,b=report.characters.artoria;
 assert.equal(Object.keys(b.plate).length,11);assert.deepEqual(a.plate,{});assert.deepEqual(a.boxes,{});assert.deepEqual(a.plateGait,[]);
 assert.equal(a.props.cape,false);assert.equal(a.props.crown,false);assert.ok(a.top&&a.bottom&&a.courtCrown&&a.boots);assert.equal(a.bow,false);
 const prior=JSON.parse(fs.readFileSync(new URL('../../docs/codex_team/royal_messenger_20261016_checks/combat.json',import.meta.url))).characters.artoria_mad;
 for(const k of ['weapon','strength','level','proficiency','colliders','plate','plateGait','helmet','boxes'])assert.deepEqual(a[k],prior[k],`prior unarmored Artoria / ${k}`);
 for(const [part,mass] of Object.entries(a.masses)){
  if(part.startsWith('foot')){
   assert.ok(Math.abs(a.bodyMasses[part]-1.1)<1e-6);
   for(const v of [mass,prior.masses[part]])assert.ok([1.1,3.1].some(expected=>Math.abs(v-expected)<1e-6));
  }else assert.equal(mass,prior.masses[part],`prior body mass / ${part}`);
 }
 report.footMassNote='Underlying foot collider 1.1 kg unchanged; gait transiently adds 2 kg while planted (gait.js footMass).';
 if(report.characters.samira){assert.equal(report.characters.samira.props.dispatch,false);assert.equal(report.characters.samira_mad.props.dispatch,true);
 for(const k of ['plate','plateGait','boxes'])assert.deepEqual(report.characters.samira_mad[k],report.characters.samira[k]);}
 assert.deepEqual(report.errors,[]);report.pass=true;
}finally{await browser.close();fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n')}
console.log(JSON.stringify({pass:report.pass,proficiencyPairs:report.proficiencyPairs,armorBefore:Object.keys(report.characters.artoria.plate).length,armorAfter:Object.keys(report.characters.artoria_mad.plate).length,errors:report.errors}));
