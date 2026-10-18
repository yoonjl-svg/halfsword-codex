import RAPIER from './node_modules/@dimforge/rapier3d-compat/rapier.mjs';
import {configureStageObstacle, obstacleSegmentBlocked, OBSTACLE_ROUTE, routeAroundStageObstacle} from './src/arena_obstacle.js';
import {COURTYARD_NAVIGATION as nav, COURTYARD_COVER_SHAPES as shapes} from './src/stage_courtyard_cover.js';
import {GROUND_GROUPS} from './src/fighter.js';
import fs from 'node:fs';
await RAPIER.init(); const world=new RAPIER.World({x:0,y:0,z:0}); configureStageObstacle(RAPIER,world,'courtyard',GROUND_GROUPS);world.step();
const cases=[];
for(const y of [.1,1.2,2.0,2.8])for(const z of [0,.4,.75,1.2,1.85,2]){const a={x:2.8,y,z},b={x:-2.8,y,z};const hit=world.castRay(new RAPIER.Ray(a,{x:-1,y:0,z:0}),5.6,true);cases.push({y,z,physicalBlocked:!!hit,routeBlocked:obstacleSegmentBlocked(a,b,nav.radius+OBSTACLE_ROUTE.clear,nav)});}
const moves=[];
for(const z of [0,1.2,1.85,2]){let x=0,y=0;const p={x:2.8,y:1,z};const t={x:-2.8,y:1,z};const ai={me:{arenaObstacle:nav,alive:true,state:'stand',weapon:{gun:true},bodies:{pelvis:{translation:()=>p}},heading:Math.PI,index:1,move:{get x(){return x},get y(){return y},set(a,b){x=a;y=b}}},foe:{alive:true,bodies:{pelvis:{translation:()=>t}}}};routeAroundStageObstacle(ai);moves.push({z,move:{x,y},magnitude:Math.hypot(x,y)});}
fs.writeFileSync('/tmp/courtyard-cover-review-20261019/geometry_probe.json',JSON.stringify({source:'98a83cf533be87870bda9645da6c78c2fc379200',kind:'isolated geometry and AI-route function probe; not live play',shapes:shapes.filter(s=>s.type==='cuboid'),cases,moves},null,2)+'\n');console.log(JSON.stringify({cases,moves}));world.free();
