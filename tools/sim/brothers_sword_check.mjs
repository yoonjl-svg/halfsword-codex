import assert from 'node:assert/strict';
import fs from 'node:fs';
import {newRound,DT,AI,THREE as T} from './harness_m.mjs';
import {CHARACTERS_BY_ID as C,aiAtProficiency} from '../../src/characters.js';
import {WEAPONS,drawWeaponCards} from '../../src/weapons.js';
import {schoolOf} from '../../src/schools.js';
import {weaponPhysics} from '../../src/weapon_class.js';
const out=process.argv[2]||'/tmp/brothers-sword-check.json',report={physics:weaponPhysics(WEAPONS.brothers_sword),bouts:[],contacts:[]};
assert.equal(schoolOf('brothers_sword').tradition,'none');
assert.deepEqual(schoolOf('brothers_sword').tech,schoolOf('morgenstern').tech);
assert.deepEqual(schoolOf('brothers_sword').guards,schoolOf('morgenstern').guards);
// Adding a personal weapon must not change ordinary draws, including exclusions.
const oldPool=Object.keys(WEAPONS).filter(id=>id!=='brothers_sword');
for(let seed=1;seed<=32;seed++){
 const rng=()=>{let a=seed;return ()=>{a=(Math.imul(a,1664525)+1013904223)>>>0;return a/2**32}};
 assert.deepEqual(drawWeaponCards(Object.keys(WEAPONS),2,{rnd:rng(),exclude:'morgenstern'}),drawWeaponCards(oldPool,2,{rnd:rng(),exclude:'morgenstern'}));
}
for(const broken of [false,true]){
 const G=newRound({weapon:'brothers_sword',weapon2:'longsword',seed:5});
 if(broken)G.player.breakWeapon();
 const a=G.player,v=G.enemy;
 a.cacheState();v.cacheState();
 const pr={w:{fighter:a,part:'blade'},v:{fighter:v,part:'chest',kind:'chest'}};
 for(const localDir of [new T.Vector3(0,1,0),new T.Vector3(1,0,0),new T.Vector3(0,0,1)]){
  const S={...a.cache.sword,v:localDir.clone().applyQuaternion(a.cache.sword.q).multiplyScalar(8),w:new T.Vector3()};
  const point=new T.Vector3(0,a.weaponCfg.hiltLength+.96*a.weaponCfg.bladeLength,0).applyQuaternion(S.q).add(S.p);
  const P={...v.cache.parts.chest,p:point.clone(),com:point.clone(),v:new T.Vector3(),w:new T.Vector3()};
  const r=G.combat.analyze(pr,point,S,P);
  assert.equal(r.type,'blunt');assert.equal(r.pass,false);assert.equal(r.finish,false);
  const blood=v.blood,bleed=v.bleed,wounds=v.wounds.length;
  v.applyWound({...r,part:'chest'});
  assert.equal(v.blood,blood);assert.equal(v.bleed,bleed);assert.equal(v.wounds.length,wounds);
  report.contacts.push({broken,direction:localDir.toArray(),type:r.type,energy:r.energy,noBleeding:true,noFinish:true});
 }
 G.eventQueue.free();G.world.free();
}
// Actual physics/AI contacts, both sides, original Kim temperament, no stat boosts.
for(let seed=1;seed<=6;seed++)for(const side of [0,1]){
 const cfg=aiAtProficiency(C.renji_mad,3),G=newRound({seed,walls:true,
  weapon:side?'longsword':'brothers_sword',weapon2:side?'brothers_sword':'longsword',AI2Class:AI,
  ...(side?{persona:cfg.persona,look2:C.renji_mad.look}:{persona2:cfg.persona,look:C.renji_mad.look})});
 const f=side?G.enemy:G.player;
 for(let i=0;i<12/DT;i++){
  G.step();
  assert.ok([...Object.values(f.bodies.pelvis.translation()),...Object.values(f.sword.linvel())].every(Number.isFinite));
 }
 const hits=G.wounds.filter(w=>w.att===f);
 assert.ok(hits.every(w=>w.type==='blunt'));
 report.bouts.push({seed,side,hits:hits.length,blunt:hits.length,broken:f.weaponBroken,state:f.state});
 G.eventQueue.free();G.world.free();
}
report.totalHits=report.bouts.reduce((n,b)=>n+b.hits,0);assert.ok(report.totalHits>0);
report.pass=true;fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
