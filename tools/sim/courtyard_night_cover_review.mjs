// 봉인의 중정 급수정 — 실제 Rapier · 총 실행 (샛별 저장소에서 가져옴 10/17): 엄폐 · 열린 옆 · 걷기 · 총수 우회.
// 실행: node tools/sim/courtyard_cover.mjs [결과.json]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {newRound,RAPIER,THREE,DT} from './harness_m.mjs';
import {GROUND_GROUPS} from '../../src/fighter.js';
import {configureStageObstacle,clampStageCamera,stageStartZ} from '../../src/arena_obstacle.js';
import {COURTYARD_NAVIGATION as nav} from '../../src/stage_courtyard_cover.js';
import {gunCanFire,updateGun} from '../../src/gun.js';
import {CHARACTERS_BY_ID} from '../../src/characters.js';
const report={shots:[],movement:[],routing:[],camera:[],cleanup:[]};
function shift(f,x,z){const p=f.bodies.pelvis.translation(),dx=x-p.x,dz=z-p.z;const bodies=new Set([...f.meshes.map(m=>m.rb),f.anchor]);for(const b of bodies){const t=b.translation();b.setTranslation({x:t.x+dx,y:t.y,z:t.z+dz},true);b.setLinvel({x:0,y:0,z:0},true);b.setAngvel({x:0,y:0,z:0},true);}}
function obstacle(G){const ob=configureStageObstacle(RAPIER,G.world,'courtyard_night',GROUND_GROUPS);G.player.arenaObstacle=G.enemy.arenaObstacle=ob.navigation;return ob;}
// 실제 총 길로 몸통을 정확히 겨눠 쏜다 — 이 충돌 시험에서만 겨눔 오차를 없앤다(게임은 그대로). 경우마다 새 판
for(const z of [0,.4,-.4,2.5,-2.5]){
 const G=newRound({seed:71,weapon:'longsword',weapon2:'pistol'});obstacle(G);G.ai.update=()=>{};
 shift(G.player,-2.8,z);shift(G.enemy,2.8,z);G.world.step();const f=G.enemy;f.foe=G.player;f.fightT=3;
 const c=G.player.bodies.chest.translation();const target=new THREE.Vector3(c.x,c.y-.1,c.z),origin=new THREE.Vector3(2.4,c.y-.1,z);
 const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),target.clone().sub(origin).normalize());f.sword.setRotation(q,true);f.sword.setTranslation(origin,true);
 // 정확한 AI 겨눔은 엄폐 약속을 보이려고만 쓴다 — 반동 · 흩어짐과 상관없이
 gunCanFire(f,{now:true});f.gun.aim=1;G.world.step();updateGun(f,G.world,G.combat,DT);
 const result={z,shots:f.gun.shots,what:{...f.gun.what},wounds:G.wounds.length};report.shots.push(result);
 if(Math.abs(z)<1){assert.equal(result.what.world,1);assert.equal(result.wounds,0);}else assert.equal(result.what.body,1);
 G.world.free();
}
// 바닥 크기 약속 · 실제로 다가가기 · 마야의 처음부터 끝까지 우회
for(const side of [-1,1]){
 const G=newRound({seed:81,weapon:'longsword',weapon2:'pistol'});obstacle(G);G.ai.update=()=>{};shift(G.player,side*2.5,0);shift(G.enemy,side*6,3);
 let nearest=Infinity;G.before=()=>{G.player.move.set(0,side<0?1:-1)};
 for(let i=0;i<Math.round(3/DT);i++){G.step();const p=G.player.bodies.pelvis.translation();nearest=Math.min(nearest,Math.hypot(p.x,p.z));}
 const p=G.player.bodies.pelvis.translation();report.movement.push({side,nearest,end:{...p}});assert.ok(nearest>.55,'body must not cross the reservoir');G.world.free();
}
for(const [seed,from,to]of [[91,[2.8,0],[-2.8,0]],[92,[-2.8,0],[2.8,0]],[93,[2.8,-.5],[-2.8,-.5]]]){
 const c=CHARACTERS_BY_ID.samira,G=newRound({seed,weapon:'longsword',weapon2:'pistol',look2:c.look,difficulty:c.ai.level,persona:c.ai.persona});obstacle(G);shift(G.player,...to);shift(G.enemy,...from);
 // 플레이어는 급수정 뒤에 머문다. 총수는 이제 실제 물체가 된 엄폐물 반대편에서 제자리 떨지 말고 쏠 각까지 걸어가야 한다
 let maxZ=0,nearest=Infinity;const path=[];
 for(let i=0;i<Math.round(12/DT);i++){G.step();const p=G.enemy.bodies.pelvis.translation();maxZ=Math.max(maxZ,Math.abs(p.z));nearest=Math.min(nearest,Math.hypot(p.x,p.z));if(i%120===0)path.push({x:p.x,z:p.z});if(!G.player.alive)break;}
 report.routing.push({seed,from,to,maxZ,nearest,shots:G.enemy.gun?.shots,path});assert.ok(maxZ>1.7,'Maya must leave blocked line');assert.ok(nearest>1.1,'Maya must not enter cover');G.world.free();
}
// 보이는 돌 쌓기로 밀어 넣은 캡슐은 같은 쪽에서 멈춰야 한다
report.capsule=[];
for(const side of [-1,1]){
 const world=new RAPIER.World({x:0,y:0,z:0});configureStageObstacle(RAPIER,world,'courtyard_night',GROUND_GROUPS);
 const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(side*2.5,1,0).lockRotations());
 world.createCollider(RAPIER.ColliderDesc.capsule(.35,.2),body);
 for(let i=0;i<240;i++){body.setLinvel({x:-side*2,y:0,z:0},true);world.step();}
 const x=body.translation().x;report.capsule.push({side,x});assert.ok(side*x>.77,'capsule must stop at stone');world.free();
}
// 카메라 보호 · 시작 비킴 — 넓힌 바깥 결투장은 그대로
for(let i=0;i<64;i++){
 const a=i*Math.PI/32,origin={x:Math.cos(a)*2,z:Math.sin(a)*2,y:1.1},camera={x:-origin.x*2,z:-origin.z*2,y:2.6};
 clampStageCamera(origin,camera,nav);const radius=Math.hypot(camera.x,camera.z);assert.ok(radius>=nav.radius+.27);report.camera.push(radius);
}
assert.equal(stageStartZ('courtyard_night'),1.10);assert.equal(stageStartZ('courtyard_night',1),1.60);assert.equal(stageStartZ('sluice'),.5);assert.equal(stageStartZ('poseidon'),0);
{
 const G=newRound({weapon:'longsword'}),base=G.world.colliders.len();let previous;
 for(const id of ['courtyard_night','sluice','poseidon','courtyard_night','poseidon']){previous=configureStageObstacle(RAPIER,G.world,id,GROUND_GROUPS,previous);report.cleanup.push({id,count:G.world.colliders.len()});if(id==='poseidon')assert.equal(G.world.colliders.len(),base);}
 G.world.free();
}
report.pass=true;fs.writeFileSync(process.argv[2]||'/tmp/courtyard-cover-physics.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
