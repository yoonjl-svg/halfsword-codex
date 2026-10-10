// Actual game constructors/steps; no win-rate or all-animation quality claim.
// node tools/sim/experiments/new_pair_gate.mjs /tmp/halfsword-new-pair-20261010/native.json
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { newRound, THREE } from '../harness_m.mjs';
import { LOOK_ARCHIVE } from '../../../src/looks.js';
import { CHARACTERS_BY_ID } from '../../../src/characters.js';
import { applySwordsmanship, recordSwordsmanshipInput } from '../../../src/swordsmanship.js';

const out = process.argv[2];
assert(out?.startsWith('/tmp/halfsword-new-pair-20261010/'));
const sha = v => createHash('sha256').update(v).digest('hex');
const checks = [], rows = [], widths = [];
const check = (name, pass) => { checks.push({ name, pass: !!pass }); assert(pass, name); };
const dispose = g => { g.player.clearLoose(); g.enemy.clearLoose(); g.eventQueue.free(); g.world.free(); };
const armor = e => Object.fromEntries(Object.entries(e.plateBoxes).map(([k, v]) => [k,
  { partial: v.partial, boxes: v.list.map(x => [x.box.min.toArray(), x.box.max.toArray()]) }]));

for (const [id, oldVersion] of [['isolde','v4'],['yeongman','v4'],['artoria','v4'],['margarethe','v4'],['crown_boss','v6']]) {
  const c = CHARACTERS_BY_ID[id], samples = [];
  for (const look of [LOOK_ARCHIVE[id][oldVersion], c.look]) {
    const g = newRound({seed:73, weapon:'longsword', weapon2:c.weapon, look2:look, walls:false});
    const e = g.enemy;
    samples.push({scales:['chest','abdomen'].map(p => e.groups[p].scale.toArray()),
      physics:sha(g.world.takeSnapshot()), armor:armor(e),
      head:sha(Buffer.from(e.groups.head.children[0].geometry.attributes.position.array.buffer))});
    dispose(g);
  }
  assert.deepEqual(samples[0].scales, [[1,1,.92],[1,1,.96]]);
  assert.deepEqual(samples[1].scales, [[1,1,1],[1,1,1]]);
  for (const key of ['physics','armor','head']) assert.deepEqual(samples[0][key], samples[1][key], `${id}/${key}`);
  check(`${id}/original-width-unchanged-physics-armor-face`, true);
  widths.push({id, before:samples[0].scales, after:samples[1].scales});
}
for (const id of ['renji','eira']) {
  const c = CHARACTERS_BY_ID[id];
  check(`${id}/registered-weapon`, c.weapon === (id === 'renji' ? 'morgenstern' : 'rapier'));
  const opts = {seed:73, weapon:'longsword', weapon2:c.weapon, look2:c.look, persona:c.ai.persona,
    difficulty:c.ai.level, walls:false};
  const g = newRound(opts), e = g.enemy, p = g.player;
  try {
    const neutral = newRound({...opts, look2:{...c.look, outfit:null}});
    check(`${id}/visual-only-body-and-colliders`, sha(g.world.takeSnapshot()) === sha(neutral.world.takeSnapshot()));
    const common = neutral.enemy.groups.head.children;
    for (let i=0;i<4;i++) {
      const a=e.groups.head.children[i], b=common[i];
      assert.deepEqual(a.geometry.attributes.position.array, b.geometry.attributes.position.array);
      assert.deepEqual(a.position.toArray(), b.position.toArray()); assert.deepEqual(a.scale.toArray(), b.scale.toArray());
    }
    dispose(neutral);
    check(`${id}/common-face-and-eyes`, true);
    check(`${id}/no-hidden-armor`, !e.hasHelmet && Object.keys(e.plate).length === 0);
    check(`${id}/school`, g.ai.school.id === (id === 'renji' ? 'tree_branch' : 'rapier'));
    const props=[]; for(const {group} of e.meshes)group.traverse(m => {if(m.name==='renji-sheathed-sword')props.push(m);});
    check(`${id}/sheathed-sword-only-on-renji`,props.length === (id==='renji'?1:0));
    applySwordsmanship(p); let finite=true, jointValid=true;
    for(let i=0;i<480;i++) {
      const active=i%150<55, dx=active?.003*Math.sin(i*.09):0, dy=active?.003*Math.cos(i*.07):0;
      p.handOffset.x+=dx;p.handOffset.y+=dy;p.handHeld=active;p.inputActive=active;
      recordSwordsmanshipInput(p,{id:i,timeS:g.t,dx,dy,held:active,active});g.step();e.syncMeshes();
      for(const b of g.world.bodies.getAll()) for(const v of [b.translation(),b.rotation(),b.linvel(),b.angvel()])finite&&=Object.values(v).every(Number.isFinite);
      jointValid&&=[p,e].every(f=>f.joints.every(j=>j.joint?.isValid()));
    }
    check(`${id}/480-input-steps-finite`,finite&&jointValid);
    rows.push({id,steps:480,clashes:g.clashes,wounds:g.wounds.length,enemyAlive:e.alive});
  } finally {dispose(g);}
  const hit = newRound({...opts, gap:12});
  try {
    const e=hit.enemy, layers=[];
    for(const {group} of e.meshes)group.traverse(n=>{if(n.name.startsWith(id+'-'))layers.push({node:n,parent:n.parent});});
    for(const part of ['head','chest','farmS','thighF'])e.applyWound({part,zone:part,type:'cut',severity:.025,energy:2,
      bleedPerSev:.005,local:new THREE.Vector3(.1,0,0),dir:new THREE.Vector3(1,0,0),pass:true,passing:false,plate:false});
    for(let i=0;i<60;i++){hit.step();e.syncMeshes();}
    check(`${id}/clothes-hair-sheath-survive-wounds`,layers.length>5&&e.wounds.length>=4&&layers.every(x=>x.node.parent===x.parent));
    let finite=true, vertices=0;
    for(const {group} of e.meshes)group.traverse(m=>{if(m.geometry){const a=m.geometry.attributes.position.array;vertices+=a.length/3;finite&&=a.every(Number.isFinite);}});
    check(`${id}/finite-meshes-after-wounds`,finite);rows.find(r=>r.id===id).verticesAfterWounds=vertices;
  }finally{dispose(hit);}
}
fs.writeFileSync(out,JSON.stringify({pass:true,checks,widths,rows,limits:[
  'One seed per character, 480 actual steps against active scripted player. No balance or naturalness conclusion.',
  'Separate synthetic head/chest/forearm/thigh wounds test retained appearance, not ordinary hit success.',
  'Torso comparison covers constructor physics, armor bounds and face; no repeated broad physics campaign.'
]},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({pass:true,checks:checks.length,rows}));
