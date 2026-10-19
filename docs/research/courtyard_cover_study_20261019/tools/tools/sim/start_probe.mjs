import fs from 'node:fs';import {newRound,RAPIER,DT} from './harness_m.mjs';import {GROUND_GROUPS} from '../../src/fighter.js';import {configureStageObstacle} from '../../src/arena_obstacle.js';import {coverSight} from '../../src/courtyard_cover_study.js';import {CHARACTERS_BY_ID} from '../../src/characters.js';
const rows=[];
for(const [pz,ez] of [[.65,1.15],[.9,1.4],[1.1,1.6],[1.2,1.85],[1.4,1.85],[1.85,1.85]]){
 const c=CHARACTERS_BY_ID.samira,G=newRound({seed:101,weapon:'longsword',weapon2:'pistol',look2:c.look,persona:c.ai.persona});configureStageObstacle(RAPIER,G.world,'courtyard',GROUND_GROUPS);G.ai.update=()=>{};
 for(const [f,z] of [[G.player,pz],[G.enemy,ez]])for(const b of new Set([...f.meshes.map(m=>m.rb),f.anchor])){const p=b.translation();b.setTranslation({...p,z:p.z+z},true);}
 G.world.step();const init=coverSight(G.enemy,G.player);
 for(let i=0;i<240;i++)G.step();const settled=coverSight(G.enemy,G.player);
 rows.push({pz,ez,initial:init.fraction,settled:settled.fraction,feetHeld:G.player.feetHeld,fightT:G.player.fightT});G.world.free();
}
fs.writeFileSync('/tmp/courtyard-cover-study-20261019/pilot/start_probe.json',JSON.stringify(rows,null,2));console.log(rows);
