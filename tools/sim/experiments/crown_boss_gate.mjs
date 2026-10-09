// New boss content and declared damage fixtures; not a balance or naturalness benchmark.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { newRound, THREE, DT } from '../harness_m.mjs';
import { CHARACTERS_BY_ID, CHARACTERS } from '../../../src/characters.js';
import { STAGE_ORDER, STAGE_FOE, nextStage } from '../../../src/stages.js';
import { ARMOR } from '../../../src/config.js';
import { getLook, CHARACTER_LOOK_VERSION } from '../../../src/looks.js';
import { applySwordsmanship, recordSwordsmanshipInput } from '../../../src/swordsmanship.js';
const out=process.argv[2]; assert(out&&path.isAbsolute(out)&&!fs.existsSync(out));
const sha=x=>createHash('sha256').update(x).digest('hex');
const hashes=()=>Object.fromEntries(fs.readdirSync('src').filter(f=>f.endsWith('.js')).map(f=>[f,sha(fs.readFileSync('src/'+f))]));
const result={basis:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceBefore:hashes(),dt:DT,checks:[],rows:[],limits:['Two bounded actual-game native combat samples; no win-rate, balance or human motion claim.','Wound, helmet and plate destruction are explicit synthetic damage fixtures.','Stage order checks do not replace browser transition/completion tests.']};
const check=(name,ok,detail)=>{result.checks.push({name,ok:!!ok,...(detail?{detail}:{})});};
const c=CHARACTERS_BY_ID.crown_boss;
const uniform=c.look.outfit==='crown_blue_uniform';
if(uniform) result.limits[1]='Uniform profile: explicit chest/head/thigh/forearm wound fixtures; no helmet/plate destruction fixture because this outfit has neither.';
check('registered-final-character',c?.look===getLook('crown_boss')&&c.lookVersion===CHARACTER_LOOK_VERSION.crown_boss&&!CHARACTERS.some(x=>x.id===c.id));
check('prior-journey-preserved',JSON.stringify(STAGE_ORDER.slice(0,-1))===JSON.stringify(['poseidon','clearing','temple','castle','poseidon_night','cathedral']));
check('final-opponent-and-wrap',nextStage('cathedral')==='crown_sanctum'&&STAGE_FOE.crown_sanctum===c.id&&nextStage('crown_sanctum')==='poseidon'&&STAGE_FOE.cathedral==='margarethe');
function round(seed,gap=3){return newRound({seed,weapon:'longsword',weapon2:c.weapon,look2:c.look,persona:c.ai.persona,difficulty:c.ai.level,gap,walls:false});}
function dispose(g){g.player.clearLoose();g.enemy.clearLoose();g.eventQueue.free();g.world.free();}
for(const seed of [37,73]){
 const g=round(seed); const p=g.player,e=g.enemy; applySwordsmanship(p); const row={seed,steps:0,finite:true,joints:true,inputs:0,clashes:0,wounds:0};
 try{
  check(`seed${seed}/armor-and-helmet`,uniform
   ? !e.hasHelmet&&e.helmetType===null&&e.helmetSpec===null&&Object.keys(e.plate).length===0
   : e.hasHelmet&&e.helmetType==='crown'&&e.helmetSpec===ARMOR.helmets.crown&&Object.keys(e.plate).length===11);
  // Bare black thighs intentionally use the existing base mesh beneath the tabard.
  check(`seed${seed}/decorated-parts-and-base-thighs`,Object.entries(e.groups).every(([part,group])=>{if(!uniform&&['thighF','thighB'].includes(part))return !!group.children[0]?.geometry;let found=false;group.traverse(n=>{found ||= n.userData.outfit===c.look.outfit;});return found;}));
  for(let k=0;k<720;k++){
   const active=k%160<55,dx=active?.003*Math.sin(k*.09):0,dy=active?.003*Math.cos(k*.07):0;
   p.handOffset.x+=dx;p.handOffset.y+=dy;p.handHeld=active;p.inputActive=active;
   row.inputs+=!!recordSwordsmanshipInput(p,{id:k,timeS:g.t,dx,dy,held:active,active});
   g.step();e.syncMeshes();row.steps++;
   for(const b of g.world.bodies.getAll())for(const v of [b.translation(),b.rotation(),b.linvel(),b.angvel()])row.finite&&=Object.values(v).every(Number.isFinite);
   row.joints&&=[p,e].every(f=>f.joints.every(j=>j.joint?.isValid()));
  }
  row.clashes=g.clashes;row.wounds=g.wounds.length;row.enemyAlive=e.alive;row.playerAlive=p.alive;row.enemyState=e.state;row.renderParts=Object.keys(e.groups).length;
  check(`seed${seed}/actual-input-and-finite-physics`,row.inputs===720&&row.finite&&row.joints,row);result.rows.push(row);
 }finally{dispose(g);}
}
const g=round(91,12),e=g.enemy;
try{
 const retained=[];
 for(const group of Object.values(e.groups))group.traverse(n=>{if(['crown-hair','crown-cloth','uniform-hair','uniform-pleats'].includes(n.name))retained.push({node:n,parent:n.parent});});
 const helmet=e.helmetGroup;
 check('declared-headwear',uniform?!helmet:!!helmet&&['bowl','spire','crest','nape'].every(k=>helmet.userData.pieces?.[k]));
 check('hair-cloth-outside-helmet',retained.length>2&&retained.every(({node})=>{for(let n=node;n;n=n.parent)if(n===helmet)return false;return true;}));
 const wound={part:'chest',zone:'chest',type:'cut',severity:.2,energy:5,bleedPerSev:.005,local:new THREE.Vector3(.1,0,0),dir:new THREE.Vector3(1,0,0),pass:true,passing:false,plate:false};
 e.applyWound(wound);for(let k=0;k<120;k++){g.step();e.syncMeshes();}
 check('appearance-after-synthetic-wound',e.wounds.length>0&&retained.every(x=>x.node.parent===x.parent));
 if(!uniform){
 e.helmetIntegrity=.85;e.shedHelmet(e.helmetSpec,{local:new THREE.Vector3(0,.1,0),dir:new THREE.Vector3(1,0,0),energy:80});
 check('crown-spire-sheds',!helmet.userData.pieces.spire&&!!helmet.userData.pieces.bowl&&e.hasHelmet);
 e.helmetIntegrity=.4;e.shedHelmet(e.helmetSpec,{local:new THREE.Vector3(0,.1,0),dir:new THREE.Vector3(1,0,0),energy:80});
 check('crown-crest-sheds',!helmet.userData.pieces.crest&&e.hasHelmet);
 e.knockOffHelmet(new THREE.Vector3(1,0,0),220);
 check('broken-helmet-keeps-hair',!e.hasHelmet&&!helmet.parent&&retained.every(x=>x.node.parent===x.parent));
 for(const part of ['chest','abdomen','pelvis'])e.wearPlate(part,10000,new THREE.Vector3(1,0,0),part);
 check('broken-plate-keeps-hair-cloth',['chest','abdomen','pelvis'].every(p=>e.plate[p]===0)&&retained.every(x=>x.node.parent===x.parent));
 }else{
  for(const part of ['head','thighF','farmS']) e.applyWound({...wound,part,zone:part,severity:.025,energy:2});
  check('hair-and-skirt-after-local-wounds',retained.every(x=>x.node.parent===x.parent)&&e.wounds.some(w=>w.part==='head')&&e.wounds.some(w=>w.part==='thighF'));
  check('no-hidden-heavy-protection',!e.hasHelmet&&Object.keys(e.plate).length===0&&Object.keys(e.plateGroups).length===0);
 }
 for(let k=0;k<120;k++){g.step();e.syncMeshes();}
 check('damaged-state-finite',g.world.bodies.getAll().every(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].every(v=>Object.values(v).every(Number.isFinite))));
 result.synthetic={wounds:e.wounds.length,plate:{...e.plate},helmet:e.hasHelmet,retainedGroups:retained.length};
}finally{dispose(g);}
result.sourceAfter=hashes();result.sourceStable=JSON.stringify(result.sourceBefore)===JSON.stringify(result.sourceAfter);result.pass=result.sourceStable&&result.checks.every(c=>c.ok);result.completedUTC=new Date().toISOString();
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({pass:result.pass,checks:result.checks.length,failed:result.checks.filter(x=>!x.ok),sourceStable:result.sourceStable,out}));if(!result.pass)process.exitCode=1;
