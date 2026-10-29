import assert from 'node:assert/strict';
import * as THREE from 'three';
import R from '@dimforge/rapier3d-compat';
import {GROUND_GROUPS} from '../../src/fighter.js';
import {createFordGround,heightAt,moveScaleAt,BOUNDARY,polygonArea,FORD,riverX,routePoint} from '../../src/capital_ford/ground.js';
import {createTeamWorld} from '../../src/capital_ford/combat.js';
import fs from 'node:fs/promises';
await R.init();
const w=new R.World({x:0,y:-9.81,z:0}),ground=createFordGround(R,w,GROUND_GROUPS);w.step();
let worst=0;for(const [x,z]of [[0,-.6],[-3,-.6],[3.2,-.6],[0,4],[riverX(-6),-6],[-4,0],[4,0]]){const ray=new R.Ray({x,y:5,z},{x:0,y:-1,z:0});const hit=ground.floor.castRay(ray,10,true);assert(hit>=0);const err=Math.abs(5-hit-heightAt(x,z));worst=Math.max(worst,err);assert(err<.006,`${x},${z} error ${err}`);}
assert.equal(moveScaleAt(0,-.6),1);assert.equal(moveScaleAt(riverX(-6),-6),.6);assert.equal(moveScaleAt(-8,0),1);
const shapes=ground.obstacles.length;w.free();
const make=(id,assignedWeapon)=>({id,assignedWeapon,hp:100,injuries:[],skills:{german:3,italian:3,iberian:3,japanese:3,chinese:3},status:'ready',limbs:{}});
function walk(z){const g=createTeamWorld(R,new THREE.Scene(),{mode:'explore',spawn:{x:-4,z},allies:[make('player','longsword')],enemies:[]});let start=null,end=null,scales=[];for(let i=0;i<1800;i++){g.human.move.set(0,1);g.human.stickY=1;g.step();const p=g.human.bodies.pelvis.translation();assert(Number.isFinite(p.x)&&Number.isFinite(p.y));if(p.x>=-2.7&&start===null)start=i;if(p.x>=2.7){end=i;break;}scales.push(g.human.surfaceSpeedScale);}const p=g.human.bodies.pelvis.translation(),result={z,start,end,crossSeconds:start!==null&&end!==null?(end-start)/120:null,position:p,state:g.human.state,minScale:Math.min(...scales)};g.dispose();return result;}
const bridge=walk(-.6),water=walk(-6);
assert(bridge.crossSeconds!==null,"bridge crossing must complete");assert(water.crossSeconds!==null,"ford crossing must complete");assert(water.crossSeconds>bridge.crossSeconds,"ford crossing must be slower");
const team=createTeamWorld(R,new THREE.Scene(),{mode:'team',allies:[make('player','longsword'),make('isolde','longsword')],enemies:[make('bran','longsword'),make('liao','qinggang')]},{autoHuman:true});for(let i=0;i<2400;i++)team.step();const actors=team.fighters.map(f=>({id:f.name,p:f.bodies.pelvis.translation(),state:f.state,alive:f.alive}));for(const f of actors)assert(Object.values(f.p).every(Number.isFinite));team.dispose();
const result={surfaceRaysMaxError:worst,nominalArea:polygonArea(BOUNDARY),staticObstacleColliders:shapes,bridge,water,actors,route:routePoint({x:-5,z:1},{x:5,z:1})};console.log(JSON.stringify(result,null,2));await fs.writeFile('docs/design/capital_ford_20261029/results/terrain.json',JSON.stringify(result,null,2));
