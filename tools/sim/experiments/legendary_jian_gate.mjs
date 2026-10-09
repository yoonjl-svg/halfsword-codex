// New-weapon contracts + actual native input/contact smoke; not a balance study.
// node tools/sim/experiments/legendary_jian_gate.mjs /tmp/fresh-report.json
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { newRound, DT } from '../harness_m.mjs';
import { getWeapon, WEAPON_LIST, drawWeaponCards } from '../../../src/weapons.js';
import { weaponPhysics } from '../../../src/weapon_class.js';
import { attachAura } from '../../../src/aura.js';
import { applySwordsmanship, recordSwordsmanshipInput } from '../../../src/swordsmanship.js';
import { configureSwordsmanshipDefault, swordsmanshipDefaultSupportsWeapon } from '../../../src/swordsmanship_default.js';
import { schoolOf } from '../../../src/schools.js';

const out = process.argv[2];
assert(out && path.isAbsolute(out) && !fs.existsSync(out), 'Fresh absolute output required');
const hash = x => createHash('sha256').update(x).digest('hex');
const sources = ['src/weapons.js','src/weapon_draw.js','src/aura.js','src/schools.js',
  'src/fighter.js','src/swordsmanship.js','src/swordsmanship_default.js','tools/sim/harness_m.mjs',
  'tools/sim/experiments/legendary_jian_gate.mjs'];
const sourceHashes = () => Object.fromEntries(sources.map(p => [p, hash(fs.readFileSync(p))]));
const before = sourceHashes(), rows = [];
const near = (a,b) => assert(Math.abs(a-b)<1e-6, `${a} != ${b}`);
let seed = 321;
const rnd = () => ((seed = (Math.imul(seed,1664525)+1013904223)>>>0) / 2**32);
const pool = WEAPON_LIST.map(w => w.id).filter(id => id !== 'excalibur_replica');
const count = {};
for (let k=0;k<20000;k++) {
  const [id] = drawWeaponCards(pool,1,{rnd}); count[id]=(count[id]||0)+1;
}
const paired = (count.ganjiang||0)+(count.moye||0), legend = paired+(count.excalibur||0);
assert(Math.abs(legend/20000-.05)<.008, 'Legend tier odds changed');
assert(Math.abs(paired/legend-.5)<.08, 'Pair counted as two independent entries');
assert(Math.abs(count.ganjiang/paired-.5)<.08, 'Pair members not uniform');
for (let k=0;k<1000;k++) {
  const ids=drawWeaponCards(pool,2,{rnd});
  assert(!(ids.includes('ganjiang')&&ids.includes('moye')), 'Paired duplicate cards');
  for(const exclude of ['ganjiang','moye'])
    assert(drawWeaponCards(pool,2,{rnd,exclude}).every(id=>!['ganjiang','moye'].includes(id)), 'Pair exclusion failed');
}
const ordinary = configureSwordsmanshipDefault(new URLSearchParams());
for(const [id,length,mass,tone] of [['ganjiang',1,.95,'ink'],['moye',.96,1.12,'white']]) {
  const spec=getWeapon(id), phys=weaponPhysics(spec);
  assert(swordsmanshipDefaultSupportsWeapon(spec,ordinary));
  assert.equal(schoolOf(id).weapon,id);
  assert.equal(spec.grip,'one-hand'); assert.equal(spec.tier,'legend'); assert.equal(spec.ability,undefined);
  assert.equal(spec.ignoreArmor,false); assert.equal(spec.breakMult,undefined); near(spec.power,1.2);
  const parts=spec.buildParts({});
  const lo=Math.min(...parts.map(([s,y])=>y-(s[0]==='box'?s[2]:s[1])));
  const hi=Math.max(...parts.map(([s,y])=>y+(s[0]==='box'?s[2]:s[1])));
  near(hi-lo,length); near(phys.mass,mass);
  for(const scenario of ['sweep-release','contact']) {
    const g=newRound({seed:17,weapon:id,weapon2:'qinggang',gap:scenario==='contact'?2.4:12,walls:false,
      onFighter:f=>{if(f.index===0) { f.onehandArmModel='manual'; f.stanceMemoryModel='fresh'; f.rollTargetModel='bounded'; }} });
    const f=g.player;
    try {
      assert(applySwordsmanship(f));
      g.combat.cutReactionModel='centerline';g.combat.cutReactionFighter=f;
      near(f.sword.mass(),mass); near(f.swordIhand,phys.I);
      assert.equal(f.swordsmanshipState.profile.frame,'one');
      const aura=attachAura(f), group=f.swordGroup.getObjectByName('legendaryAura');
      assert(aura&&group);assert.equal(group.userData.legendaryAura.tone,tone);
      near(group.userData.legendaryAura.strength,.5);
      assert.equal(group.children.filter(x=>x.isPointLight).length,id==='ganjiang'?0:1);
      const snapshot=hash(g.world.takeSnapshot());
      aura.update(1);aura.update(2);
      assert.equal(hash(g.world.takeSnapshot()),snapshot,'Aura changed native physics');
      let maxOmega=0,maxTipSpeed=0,accepted=0;
      for(let tick=0;tick<600;tick++) {
        const active=scenario==='contact'||tick<360;
        const dx=active?.012*Math.cos(tick*.045):0,dy=active?.007*Math.sin(tick*.045):0;
        f.handOffset.x+=dx;f.handOffset.y+=dy;f.handHeld=active;f.inputActive=active;
        f.move.set(0,scenario==='contact'&&f.alive?.65:0);f.stickX=0;f.stickY=f.move.y;
        assert(recordSwordsmanshipInput(f,{id:tick,timeS:tick*DT,dx,dy,held:active,active}));
        if(scenario==='contact'&&tick%180===120&&f.alive) accepted+=!!f.skill.thrust();
        g.step();aura.update(g.t);
        for(const body of g.world.bodies.getAll())
          for(const v of [body.translation(),body.rotation(),body.linvel(),body.angvel()])
            assert(Object.values(v).every(Number.isFinite),'Non-finite native state');
        const omega=f.sword.angvel(),vel=f.sword.linvel();
        maxOmega=Math.max(maxOmega,Math.hypot(omega.x,omega.y,omega.z));
        maxTipSpeed=Math.max(maxTipSpeed,Math.hypot(vel.x,vel.y,vel.z));
        assert.equal(f.weapon.id,id);assert(!f.weaponBroken);
      }
      for(let k=0;k<100;k++)f.absorbWeaponImpact(1e6,g.enemy);
      assert(!f.weaponBroken,'Legend broken by Qinggang');near(f.sword.mass(),mass);
      let disposed=0;
      group.children.find(x=>x.isMesh).geometry.addEventListener('dispose',()=>disposed++);
      aura.dispose();assert(!f.swordGroup.getObjectByName('legendaryAura'));assert.equal(disposed,1);
      rows.push({id,scenario,length,mass,com:phys.com,I:phys.I,tone,seconds:g.t,
        maxOmega,maxLinearSpeed:maxTipSpeed,acceptedThrusts:accepted,clashes:g.clashes,
        wounds:g.wounds.map(w=>({att:w.att.index,vic:w.vic.index,zone:w.zone,energy:w.energy})),alive:f.alive});
    } finally { g.player.clearLoose();g.enemy.clearLoose();g.eventQueue.free();g.world.free(); }
  }
}
assert(weaponPhysics(getWeapon('moye')).mass>weaponPhysics(getWeapon('ganjiang')).mass);
assert(weaponPhysics(getWeapon('moye')).I>weaponPhysics(getWeapon('ganjiang')).I);
assert.deepEqual(sourceHashes(),before,'Sources changed during verification');
const result={pass:true,sourceHashes:before,draw:{samples:20000,count,pairFraction:paired/legend,ganjiangFraction:count.ganjiang/paired},rows,
 limits:['Scripted native input/contact fixture, not win-rate tuning or human naturalness validation.',
 'Browser separately checks full ordinary entry, actual touch input and public delivery.']};
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({pass:true,rows:rows.length,draw:result.draw,out}));
