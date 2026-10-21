import assert from 'node:assert/strict';import fs from 'node:fs';
import {newRound,RAPIER} from './harness_m.mjs';import {GROUND_GROUPS} from '../../src/fighter.js';import {configureStageObstacle,routeAroundStageObstacle} from '../../src/arena_obstacle.js';import {COVER_STUDY,coverSight}from '../../src/courtyard_cover_study.js';
const rows=[];
for(const z of [0,.4,-.4,1.2,1.85,2.5,-2.5])for(const on of [false,true]){
 const G=newRound({seed:91,weapon:'longsword',weapon2:'pistol'});const ob=configureStageObstacle(RAPIER,G.world,'courtyard',GROUND_GROUPS);G.enemy.arenaObstacle=G.player.arenaObstacle=ob.navigation;
 for(const f of [G.player,G.enemy]){for(const b of new Set([...f.meshes.map(m=>m.rb),f.anchor])){const p=b.translation();b.setTranslation({...p,z:p.z+z},true);}f.fightT=3;}
 G.world.step();G.enemy.move.set(0,0);COVER_STUDY.on=on;COVER_STUDY.stats={};const sight=coverSight(G.enemy,G.player);routeAroundStageObstacle(G.ai);const speed=Math.hypot(G.enemy.move.x,G.enemy.move.y);rows.push({z,on,blocked:sight.blocked,fraction:sight.fraction,speed,stats:{...COVER_STUDY.stats}});
 if(z===1.85){assert.equal(sight.blocked,false);assert.ok(on?speed===0:Math.abs(speed-.65)<1e-9);}
 if(z===0){assert.equal(sight.blocked,true);assert.ok(Math.abs(speed-.65)<1e-9);}
 G.world.free();
}
fs.writeFileSync('/tmp/courtyard-cover-study-20261019/route-probe.json',JSON.stringify({pass:true,rows},null,2)+'\n');console.log(JSON.stringify({pass:true,cases:rows.length}));
