import R from '@dimforge/rapier3d-compat';
import * as T from 'three';
import {Fighter,GROUND_GROUPS} from '../../src/fighter.js';
import {LOOKS} from '../../src/looks.js';
import {PHYSICS,SKILL} from '../../src/config.js';
import {Combat} from '../../src/combat.js';
import {setSupportFloor} from '../../src/gait.js';
import {DragonGuard} from '../../src/dragon/guard.js';
import {DragonEncounter} from '../../src/dragon/encounter.js';
import {configureDragonPlayer} from '../../src/dragon/rules.js';
await R.init();
export const DT=PHYSICS.timestep;
export function setup({weapon='longsword',x=-5.8,z=0,scale=1.5,base=300}={}) {
 const scene=new T.Scene(),world=new R.World({x:0,y:PHYSICS.gravity,z:0}),queue=new R.EventQueue(true),info=new Map();world.timestep=DT;world.integrationParameters.numSolverIterations=6;
 const ground=world.createRigidBody(R.RigidBodyDesc.fixed());setSupportFloor(world,world.createCollider(R.ColliderDesc.cuboid(100,.5,100).setTranslation(0,-.5,0).setFriction(.9).setCollisionGroups(GROUND_GROUPS),ground));
 const f=new Fighter(R,world,scene,info,{index:0,name:'test',x,z,heading:0,look:LOOKS.player,weapon});
 if(base===300)configureDragonPlayer(f);f.encounterMoveScale=scale;f.skill.level=.7;f.skill.corr=SKILL.corr;f.skill.autoGuard=true;
 const g=new DragonGuard(f),events=[];
 const d=new DragonEncounter(scene,R,world,f,g,[],e=>events.push({type:e.type,time:e.time,attack:e.attack,damage:e.damage,zone:e.zone}));
 const combat=new Combat(info,{onWound:()=>{},onClash:()=>{}});
 function tick({brain=true}={}){if(brain)d.beforeStep(DT);else{d.time+=DT;d.model.update(d,DT);for(const z of d.model.zones)z.body.setNextKinematicTranslation(z.p);d.body.setNextKinematicTranslation({x:d.position.x,y:1.5,z:d.position.z});}f.faceTarget=d.position;g.step(DT);f.step(DT);f.cacheState();world.step(queue,combat.physicsHooks);combat.afterStep(world,queue);d.afterStep(DT);}
 function advance(sec,opts={}){for(let i=0;i<Math.round(sec/DT);i++)tick(opts);}
 function moveTo(x,z){const p=f.bodies.pelvis.translation(),dx=x-p.x,dz=z-p.z;const seen=new Set();for(const{rb}of f.meshes){if(seen.has(rb))continue;seen.add(rb);const p=rb.translation();rb.setTranslation({x:p.x+dx,y:p.y,z:p.z+dz},true);rb.setLinvel({x:0,y:0,z:0},true);rb.setAngvel({x:0,y:0,z:0},true);}f.stamina.position=null;d.previousBlade=null;}
 function dispose(){world.free();queue.free();const geos=new Set(),mats=new Set();scene.traverse(o=>{if(o.geometry)geos.add(o.geometry);if(o.material&&!Array.isArray(o.material))mats.add(o.material);});for(const g of geos)g.dispose();for(const m of mats)m.dispose();}
 return {f,g,d,scene,world,queue,info,combat,tick,advance,moveTo,dispose,events,R};
}
