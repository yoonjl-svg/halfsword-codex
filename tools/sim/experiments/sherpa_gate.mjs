// Registered native character: appearance must not alter physics or disappear on injury.
// node tools/sim/experiments/sherpa_gate.mjs /tmp/halfsword-sherpa-20261010/native.json
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { newRound, THREE } from '../harness_m.mjs';
import { CHARACTERS_BY_ID } from '../../../src/characters.js';
import { applySwordsmanship, recordSwordsmanshipInput } from '../../../src/swordsmanship.js';

const out = process.argv[2];
assert(out?.startsWith('/tmp/halfsword-sherpa-20261010/'));
const c = CHARACTERS_BY_ID.sherpa, checks = [];
const check = (name, pass) => { assert(pass, name); checks.push(name); };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const dispose = g => { g.player.clearLoose(); g.enemy.clearLoose(); g.eventQueue.free(); g.world.free(); };
check('registered character, undisclosed gender, native sabre', c.gender === '불명' && c.weapon === 'sabre');
const opts = { seed:73, weapon:'longsword', weapon2:c.weapon, look2:c.look,
  persona:c.ai.persona, difficulty:c.ai.level, walls:false };
const g = newRound(opts), neutral = newRound({...opts, look2:{...c.look, outfit:null}});
try {
  check('outfit leaves native physics unchanged', sha(g.world.takeSnapshot()) === sha(neutral.world.takeSnapshot()));
  for (let i=0;i<4;i++) {
    const a=g.enemy.groups.head.children[i], b=neutral.enemy.groups.head.children[i];
    assert.deepEqual(a.geometry.attributes.position.array, b.geometry.attributes.position.array);
    assert.deepEqual(a.position.toArray(), b.position.toArray());
    assert.deepEqual(a.scale.toArray(), b.scale.toArray());
  }
  check('common face and eyes', true);
  check('no hidden armor', !g.enemy.hasHelmet && Object.keys(g.enemy.plate).length===0);
  check('native sabre school', g.ai.school.id==='sabre');
  const p=g.player; applySwordsmanship(p);
  for(let i=0;i<480;i++) {
    const active=i%150<55, dx=active?.003*Math.sin(i*.09):0, dy=active?.003*Math.cos(i*.07):0;
    p.handOffset.x+=dx;p.handOffset.y+=dy;p.handHeld=active;p.inputActive=active;
    recordSwordsmanshipInput(p,{id:i,timeS:g.t,dx,dy,held:active,active});g.step();g.enemy.syncMeshes();
    for(const b of g.world.bodies.getAll())for(const v of [b.translation(),b.rotation(),b.linvel(),b.angvel()])assert(Object.values(v).every(Number.isFinite));
    assert([p,g.enemy].every(f=>f.joints.every(j=>j.joint?.isValid())));
  }
  check('480 actual input steps: finite state and valid joints',true);
} finally { dispose(neutral);dispose(g); }
const hit=newRound({...opts,gap:12}); let triangles=0,meshCount=0;
try {
  const e=hit.enemy,layers=[];
  for(const {group} of e.meshes)group.traverse(n=>{if(n.name.startsWith('sherpa-'))layers.push({node:n,parent:n.parent});});
  for(const part of ['head','chest','farmS','thighF'])e.applyWound({part,zone:part,type:'cut',severity:.025,energy:2,
    bleedPerSev:.005,local:new THREE.Vector3(.1,0,0),dir:new THREE.Vector3(1,0,0),pass:true,passing:false,plate:false});
  for(let i=0;i<60;i++){hit.step();e.syncMeshes();}
  check('synthetic wounds preserve outfit attachments',layers.length>5&&e.wounds.length>=4&&layers.every(x=>x.node.parent===x.parent));
  for(const {group} of e.meshes)group.traverse(m=>{if(m.geometry){
    assert(m.geometry.attributes.position.array.every(Number.isFinite));meshCount++;
    triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;
  }});
  check('finite meshes after wounds',true);
} finally {dispose(hit);}
fs.writeFileSync(out,JSON.stringify({pass:true,checks,meshCount,triangles,limits:[
  'One deterministic 480-step input sample; no balance or visual-quality verdict.',
  'Separate synthetic wounds verify retained appearance, not natural combat hit success.',
  'Standard rigid outfit attachments; no fabric collision simulation.'
]},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({pass:true,checks:checks.length,meshCount,triangles}));
