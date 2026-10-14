// Real Fighter, native Rapier joint removal/steps, bulletHit, and lava sensor.
// Explicit injury fixtures test rules; they do not measure natural combat odds.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { RAPIER as R, THREE, DT, seedRandom } from '../harness_m.mjs';
import { Fighter, GROUND_GROUPS } from '../../../src/fighter.js';
import { COMBAT_HOOKS } from '../../../src/combat.js';
import { COMBAT } from '../../../src/config.js';
import { TERRACOTTA_CHARACTERS } from '../../../src/characters_terracotta.js';
import { LOOKS } from '../../../src/looks.js';
import { bulletHit } from '../../../src/gun.js';
import { createArenaGround, applyTerrainHazards, LAVA_BURN } from '../../../src/etna_ground.js';

const out = process.argv[2];
assert(out?.startsWith('/tmp/') && !fs.existsSync(out), 'Pass a fresh /tmp report path');
const character = TERRACOTTA_CHARACTERS[0], results = [];
function fixture({ human = false, stageId, z = 0, revive } = {}) {
  seedRandom(24);
  const world = new R.World({ x: 0, y: -9.81, z: 0 }); world.timestep = DT;
  const scene = new THREE.Scene(), info = new Map();
  const environment = createArenaGround(R, world, GROUND_GROUPS, { stageId, walls: false });
  const f = new Fighter(R, world, scene, info, { index: 1, name: 'Capability fixture', x: 0, z,
    terrain: environment.terrain, look: human ? LOOKS.enemy : character.look, weapon: 'ganjiang',
    physiology: human ? undefined : character.physiology, revive });
  return { f, world, info, environment,
    step(count = 1) { for (let i = 0; i < count; i++) { f.step(DT); f.cacheState(); world.step(); applyTerrainHazards(environment, info, DT); } },
    close() { world.free(); scene.traverse(o => { o.geometry?.dispose(); for (const m of [o.material].flat()) m?.dispose(); }); },
  };
}
function wound(overrides = {}) {
  return { part: 'chest', zone: 'chest', type: 'cut', severity: 1, energy: 40,
    local: new THREE.Vector3(), dir: new THREE.Vector3(1, 0, 0), bleedPerSev: .1,
    pass: true, passing: false, helmet: false, helmetBlunt: 1, plate: false, ...overrides };
}
function bloodless(f) {
  assert.equal(f.blood, 1); assert.equal(f.bleed, 0);
  assert(f.wounds.every(w => w.bleed === 0));
}
function attached(f) {
  assert(f.alive); assert(f.jointByName.head.joint); assert(!f.decapitated); assert.equal(f.causeOfDeath, null);
}
function detached(f, world, handle) {
  assert.equal(f.alive, false); assert.equal(f.state, 'dead'); assert(f.decapitated);
  assert.equal(f.jointByName.head.joint, null); assert(!world.getImpulseJoint(handle));
  assert(!f.joints.some(j => j.name === 'head')); bloodless(f);
}
function check(name, fn) {
  try { results.push({ name, pass: true, details: fn() }); }
  catch (error) { results.push({ name, pass: false, error: error.stack }); }
}
function use(options, fn) { const q = fixture(options); try { return fn(q); } finally { q.close(); } }

check('registry capability; ordinary constructor defaults', () => {
  assert.equal(character.physiology.bleeds, false); assert.equal(character.physiology.deathRequiresHeadDetachment, true);
  use({ human: true }, ({f}) => assert.deepEqual(f.physiology, { bleeds: true, deathRequiresHeadDetachment: false }));
});
check('body wounds repeat without blood loss; structural limb damage remains over frames', () => use({}, q => {
  const {f} = q;
  for (let i = 0; i < 8; i++) f.applyWound(wound({ type: i % 2 ? 'stab' : 'cut', severity: 3 }));
  f.applyWound(wound({ part: 'farmS', zone: 'arm', severity: 1 }));
  assert(f.limbs.armS < 1); assert.equal(f.wounds.length, 9); bloodless(f); attached(f);
  q.step(240); attached(f); bloodless(f);
}));
check('body/head finish flags and every direct death cause cannot bypass attached head', () => use({}, ({f}) => {
  for (const part of ['chest', 'abdomen', 'pelvis', 'head']) f.applyWound(wound({ part, zone: part,
    type: 'stab', severity: 0, energy: 0, finish: true, finishingStrike: true }));
  for (const cause of ['출혈', '기절', '머리', '목', '내려찍기', '용암']) { f.die(cause, true); attached(f); }
  f.setState('dead'); attached(f);
  f.consciousness = -2; f.updateVitals(DT); attached(f);
  f.decapitated = true; f.die('목'); assert(f.alive, 'a flag with the neck joint still present is not detachment');
}));
check('bloodless vitals discard stale blood/wound budgets', () => use({}, ({f}) => {
  f.blood = 0; f.bleed = 10; f.wounds.push({ part: 'chest', severity: 1, bleed: 10 });
  f.updateVitals(DT); bloodless(f); attached(f);
}));
for (const [zone, type, severity] of [['neck', 'cut', .5], ['head', 'cut', .8], ['head', 'stab', .5]]) {
  check(`${zone} ${type} threshold equality survives`, () => use({}, ({f}) => {
    f.applyWound(wound({ part: 'head', zone, type, severity })); attached(f); bloodless(f);
  }));
}
for (const [zone, type, severity, passing] of [['neck', 'cut', .501, true], ['neck', 'stab', .501, false],
  ['head', 'cut', .801, false], ['head', 'stab', .501, false]]) {
  check(`${zone} ${type} qualifying wound detaches native joint before event and never repeats`, () => use({}, q => {
    const {f,world} = q, handle = f.jointByName.head.joint.handle, hook = COMBAT_HOOKS.onDecapitate;
    let events = 0; const velocity = { ...f.bodies.head.linvel() };
    COMBAT_HOOKS.onDecapitate = (victim, head) => { assert.equal(victim,f); assert.equal(head,f.bodies.head); detached(f,world,handle); events++; };
    try {
      f.applyWound(wound({ part: 'head', zone, type, severity, passing }));
      detached(f,world,handle); assert.deepEqual({...f.bodies.head.linvel()},velocity); assert.equal(events,1);
      const count = f.wounds.length;
      f.applyWound(wound({ part:'head',zone,type,severity,passing }));
      assert.equal(f.decapitate(severity,10),false); assert.equal(f.wounds.length,count); assert.equal(events,1);
      q.step(120); detached(f,world,handle); assert.equal(events,1);
    } finally { COMBAT_HOOKS.onDecapitate = hook; }
  }));
}
check('cumulative blunt head damage breaks neck only at existing concussion threshold', () => use({}, q => {
  const {f,world}=q, handle=f.jointByName.head.joint.handle;
  const hit=wound({part:'head',zone:'head',type:'blunt',severity:0,energy:60});
  f.applyWound(hit); attached(f); f.applyWound(hit); attached(f); f.applyWound(hit); detached(f,world,handle);
}));
check('body blunt concussion budget cannot detach head', () => use({}, ({f}) => {
  f.applyWound(wound({ type:'blunt', severity:0, energy:1000 })); attached(f); bloodless(f);
}));
check('clay rule works when optional human cut decapitation is disabled', () => use({}, q => {
  const saved=COMBAT.decapitate,handle=q.f.jointByName.head.joint.handle;
  try { COMBAT.decapitate=false; q.f.applyWound(wound({part:'head',zone:'neck',severity:1,passing:true})); detached(q.f,q.world,handle); }
  finally { COMBAT.decapitate=saved; }
}));
check('real revolver bulletHit head detaches; torso bullet survives', () => use({}, q => {
  const {f,world,info}=q,handle=f.jointByName.head.joint.handle;
  const attacker={weaponCfg:{power:1},weapon:{gun:true}}, combat={hooks:{}};
  for(const part of ['chest','head']) {
    const vi=[...info.values()].find(i=>i.fighter===f&&i.part===part);
    const result=bulletHit(attacker,vi,new THREE.Vector3().copy(vi.body.translation()),new THREE.Vector3(1,0,0),combat);
    assert(result.gun); if(part==='chest'){attached(f);bloodless(f);} else detached(f,world,handle);
  }
}));
check('severed structural arm carries zero stump bleed', () => use({}, ({f,world}) => {
  const j=f.jointByName.farmS.joint,handle=j.handle;
  f.applyWound(wound({part:'farmS',zone:'arm',severity:1.3,passing:true,local:new THREE.Vector3().copy(j.anchor2())}));
  assert(f.detachedParts.has('farmS')); assert(!world.getImpulseJoint(handle)); assert.equal(f.limbs.armS,0);
  assert(f.wounds.some(w=>w.limbStump)); attached(f); bloodless(f);
}));
for (const human of [false,true]) check(`native sustained lava ${human?'kills human':'cannot kill clay'}`, () => use({human,stageId:'etna',z:6},q=>{
  // Hold the native contact pose to test sustained thermal dose independently
  // of recovery/knockback, which otherwise may move the foot out of the sensor.
  for(const b of Object.values(q.f.bodies)){b.lockTranslations(true,true);b.lockRotations(true,true);}
  for(let i=0;i<Math.ceil((LAVA_BURN.fatalExposureSeconds+.2)/DT);i++) {q.world.step();applyTerrainHazards(q.environment,q.info,DT);q.f.updateVitals(DT);}
  assert(q.f.lavaBurn?.exposure>=LAVA_BURN.fatalExposureSeconds);
  if(human)assert.equal(q.f.causeOfDeath,'용암'); else {attached(q.f);bloodless(q.f);assert(q.f.limbs.legF<1||q.f.limbs.legB<1);}
}));
for(const mode of ['bleed','head','concussion','finish','neck-cut'])check(`ordinary human retains ${mode} result`,()=>use({human:true},({f,world})=>{
  const handle=f.jointByName.head.joint.handle;
  if(mode==='bleed'){f.applyWound(wound());assert(f.bleed>0);f.blood=.44;f.updateVitals(DT);}
  if(mode==='head')f.applyWound(wound({part:'head',zone:'head',type:'stab',severity:.6}));
  if(mode==='concussion'){f.applyWound(wound({part:'head',zone:'head',type:'blunt',severity:0,energy:160}));f.updateVitals(DT);}
  if(mode==='finish')f.applyWound(wound({type:'stab',severity:0,finish:true}));
  if(mode==='neck-cut')f.applyWound(wound({part:'head',zone:'neck',severity:.6,passing:true}));
  assert(!f.alive);assert.equal(!!f.decapitated,mode==='neck-cut');
  assert.equal(!!world.getImpulseJoint(handle),mode!=='neck-cut');
}));

const sources=Object.fromEntries(['src/fighter.js','src/limb_sever.js','src/characters_terracotta.js','src/gun.js','src/etna_ground.js',
  'tools/sim/experiments/terracotta_vitals_gate.mjs'].map(p=>[p,createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const failed=results.filter(r=>!r.pass),pass=!failed.length;
fs.writeFileSync(out,JSON.stringify({pass,completedUTC:new Date().toISOString(),scope:'Explicit real Fighter/native injury fixtures; not natural combat efficacy',results,sources},null,2));
console.log(JSON.stringify({pass,cases:results.length,failed}));
if(!pass)process.exitCode=1;
