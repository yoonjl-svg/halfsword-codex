import fs from 'node:fs';
import {newRound,RAPIER,THREE,DT,CONFIG} from './harness_m.mjs';
import {GROUND_GROUPS} from '../../src/fighter.js';
import {configureStageObstacle,clampStageCamera,obstacleSegmentBlocked,OBSTACLE_ROUTE} from '../../src/arena_obstacle.js';
import {COVER_STUDY,coverSight} from '../../src/courtyard_cover_study.js';
import {CHARACTERS_BY_ID} from '../../src/characters.js';
import {followState,followReset,followStep,retreatStep,basePose,keepDistance} from '../../src/camera_rig.js';
const [mode='base',scenario='entry_hide',seedText='101',out='/tmp/cover-case.json',secondsText='30']=process.argv.slice(2),seed=+seedText,duration=+secondsText;
COVER_STUDY.on=mode!=='base';COVER_STUDY.stats={};
const c=CHARACTERS_BY_ID.samira;
const G=newRound({seed,weapon:'longsword',weapon2:'pistol',look2:c.look,difficulty:'normal',persona:c.ai.persona});
const ob=configureStageObstacle(RAPIER,G.world,'courtyard',GROUND_GROUPS);G.player.arenaObstacle=G.enemy.arenaObstacle=ob.navigation;
const P=G.player,E=G.enemy;
function shift(f,x,z){const p=f.bodies.pelvis.translation(),dx=x-p.x,dz=z-p.z;for(const b of new Set([...f.meshes.map(m=>m.rb),f.anchor])){const t=b.translation();b.setTranslation({x:t.x+dx,y:t.y,z:t.z+dz},true);b.setLinvel({x:0,y:0,z:0},true);b.setAngvel({x:0,y:0,z:0},true);}}
let startP=[-2.8,1.85],startE=[2.8,1.85];
if(mode==='combined'){startP=[-2.8,1.1];startE=[2.8,1.6];}
const edge=scenario.startsWith('edge'),sign=scenario==='edge_south'?-1:1;
if(edge){startP=[-1.45,sign*.4];startE=[2.8,sign*.5];}
shift(P,...startP);shift(E,...startE);G.world.step();
// Damage ledger: actual losses applied by game, no energy-as-health surrogate.
const damage={player:{limbs:0,consciousness:0,bleed:0,wounds:0},enemy:{limbs:0,consciousness:0,bleed:0,wounds:0}};
for(const [f,k]of [[P,'player'],[E,'enemy']]){const old=f.applyWound;f.applyWound=function(h){const limb=Object.values(this.limbs).reduce((a,b)=>a+b,0),con=this.consciousness,bleed=this.bleed;const r=old.call(this,h);damage[k].limbs+=Math.max(0,limb-Object.values(this.limbs).reduce((a,b)=>a+b,0));damage[k].consciousness+=Math.max(0,con-this.consciousness);damage[k].bleed+=Math.max(0,this.bleed-bleed);damage[k].wounds++;return r;};}
let clock=100000;globalThis.performance={now:()=>clock};
const cam=new THREE.Vector3(),dir=new THREE.Vector3(startE[0]-startP[0],0,startE[1]-startP[1]).normalize(),rig=followState(new THREE.Vector3());followReset(rig,P.bodies.pelvis.translation());
let prevAngle=null,prevSwing=null,maxCameraStep=0,maxSwingStep=0,cameraCuts=0,stuck=0,minStamina=P.stamina.value,path=0,coveredSeconds=0,partialSeconds=0,coverStart=null,firstCover=null,firstHit=null,firstLoss=null,prevPos={...P.bodies.pelvis.translation()},nextInput=0,nextAttack=0,coverEpisodes=[],push=false,pushSince=null,attackAttempts=0,attackAccepted=0,nearSeconds=0,everReload=false,phase='enter',control={x:0,y:0},routeMismatch=0;
const visualSnapshots=[];const captureTimes=process.env.COVER_CAPTURE?[2.1,5,9]:[];let captureIndex=0;
const frames=[],events=[];let oldShots=0,oldWounds=0,lastNear=null,reloadApproach=0;
const react=seed===110?.20:seed===111?.35:.20+((seed%3)*.05);
let seenEnemy={x:startE[0],z:startE[1]},visibleUpdates=0,blindInputs=0;
const visibleEnemy=()=>['head','chest'].some(name=>{const p=E.bodies[name].translation(),v=new THREE.Vector3(p.x,p.y,p.z).sub(cam),len=v.length();v.multiplyScalar(1/Math.max(len,1e-9));return !G.world.castRay({origin:cam,dir:v},Math.max(0,len-.01),true,undefined,undefined,undefined,undefined,c=>ob.handles.has(c.handle));});
G.before=t=>{
 if(t<nextInput)return;nextInput=t+react;
 const p=P.bodies.pelvis.translation(),e=E.bodies.pelvis.translation(),d=Math.hypot(e.x-p.x,e.z-p.z);
 const hidingSign=edge?sign:-1;
 // Fixed, imperfect waypoint script. No LOS query or enemy hidden coordinates determine hiding choices.
 // entry_push may react to audible reload; target pursuit after that is an explicit script approximation.
 if(((scenario==='entry_push'&&t>4&&E.gun?.reloading)||(scenario==='push_first'&&t>2&&(E.gun?.shots??0)>0))&&!push){push=true;pushSince=t;events.push({t,event:scenario==='push_first'?'shot_heard_push':'reload_heard_push'});}
 let target;
 if(scenario==='cover_loop'&&t>2){
  if(visibleEnemy()){seenEnemy={x:e.x,z:e.z};visibleUpdates++;}else blindInputs++;
  const angle=Math.atan2(p.z,p.x),goal=Math.atan2(-seenEnemy.z,-seenEnemy.x),delta=Math.atan2(Math.sin(goal-angle),Math.cos(goal-angle)),next=angle+Math.max(-.45,Math.min(.45,delta));
  phase='cover_loop';target={x:Math.cos(next)*1.65,z:Math.sin(next)*1.65};
 }else if(push){phase='push';target=t-pushSince<2?{x:-1.35,z:2.0}:t-pushSince<4?{x:.2,z:2.0}:{x:e.x,z:e.z};}
 else if(t<7){phase=t<4?'enter':'hold';target={x:-1.45,z:hidingSign*.4};}
 else {const q=(t-7)%7;phase=q<2?'peek':'hide';target={x:-1.45,z:q<2?-hidingSign*1.55:hidingSign*.4};}
 const dx=target.x-p.x,dz=target.z-p.z,L=Math.hypot(dx,dz),speed=L<.14?0:Math.min(.8,L/.8);
 const vx=dx/Math.max(L,1e-9)*speed,vz=dz/Math.max(L,1e-9)*speed,s=Math.sin(P.heading),c=Math.cos(P.heading);
 control={x:vx*s+vz*c,y:vx*c-vz*s};
 P.move.set(control.x,control.y);P.stickX=control.x;P.stickY=control.y;
 if(d<2.0&&t>=nextAttack&&P.alive){attackAttempts++;if(P.skill.thrust({step:false}))attackAccepted++;nextAttack=t+1.0;}
};
const sampleEvery=Math.max(1,Math.round((1/60)/DT));
for(let i=0;i<Math.round(duration/DT);i++){
 G.step();clock=100000+G.t*1000;
 const p=P.bodies.pelvis.translation(),e=E.bodies.pelvis.translation(),d=Math.hypot(e.x-p.x,e.z-p.z);
 const dl=Math.hypot(p.x-prevPos.x,p.z-prevPos.z);path+=dl;prevPos={...p};minStamina=Math.min(minStamina,P.stamina.value);
 if(Math.hypot(control.x,control.y)>.4&&Math.hypot(p.x,p.z)<2.2&&dl/DT<.10&&P.state==='stand')stuck+=DT;
 if(d<2&&P.state==='stand'&&E.alive)nearSeconds+=DT;
 if(E.gun?.reloading){everReload=true;if(lastNear!==null)reloadApproach+=Math.max(0,lastNear-d);}lastNear=d;
 if(i%sampleEvery===0){
  const sight=coverSight(E,P),interval=DT*sampleEvery;
  if(sight.blocked){coveredSeconds+=interval;if(firstCover===null)firstCover=G.t;if(coverStart===null)coverStart=G.t;}
  else{if(sight.fraction>0)partialSeconds+=interval;if(coverStart!==null){coverEpisodes.push({start:coverStart,end:G.t,duration:G.t-coverStart,censored:false});coverStart=null;}}
  if(obstacleSegmentBlocked(p,e,ob.navigation.radius+OBSTACLE_ROUTE.clear,ob.navigation)&&!sight.blocked)routeMismatch+=interval;
  const src=(!P.decapitated&&P.com)||p,b=(!E.decapitated&&E.com)||e,standing=P.state==='stand',a=followStep(rig,src,sampleEvery,0,interval,standing,CONFIG.CAMERA,DT);
  const v=new THREE.Vector3(b.x-a.x,0,b.z-a.z);if(v.length()>.3)dir.lerp(v.normalize(),1-Math.exp(-interval*3)).normalize();
  const lift=retreatStep(rig,dir.x,dir.z,interval,standing,CONFIG.CAMERA);basePose(a,dir.x,dir.z,lift,0,CONFIG.CAMERA,cam);keepDistance(cam,src,CONFIG.CAMERA.minDist);
  const r=Math.hypot(cam.x,cam.z);if(r>10.5)cam.multiplyScalar(10.5/r).setY(CONFIG.CAMERA.height+CONFIG.CAMERA.retreatLift*lift);
  const bx=cam.x-a.x,bz=cam.z-a.z;clampStageCamera(a,cam,ob.navigation);
  const angle=Math.atan2(cam.z-a.z,cam.x-a.x),swing=Math.atan2(bx*(cam.z-a.z)-bz*(cam.x-a.x),bx*(cam.x-a.x)+bz*(cam.z-a.z));
  const diff=(x,y)=>Math.abs(Math.atan2(Math.sin(x-y),Math.cos(x-y)))*180/Math.PI;
  if(prevAngle!==null){const da=diff(angle,prevAngle),ds=diff(swing,prevSwing);maxCameraStep=Math.max(maxCameraStep,da);maxSwingStep=Math.max(maxSwingStep,ds);if(da>6)cameraCuts++;}prevAngle=angle;prevSwing=swing;
  if(captureIndex<captureTimes.length&&G.t>=captureTimes[captureIndex]){const bodies=f=>Object.fromEntries(Object.entries({...f.bodies,sword:f.sword,anchor:f.anchor}).map(([k,b])=>[k,{p:{...b.translation()},q:{...b.rotation()}}]));visualSnapshots.push({t:G.t,cam:{...cam},look:{x:a.x+dir.x*CONFIG.CAMERA.lookAhead,y:1.1,z:a.z+dir.z*CONFIG.CAMERA.lookAhead},player:bodies(P),enemy:bodies(E),covered:sight.blocked,fraction:sight.fraction});captureIndex++;}
  if(i%(sampleEvery*6)===0)frames.push({t:G.t,p:{...p},e:{...e},d,phase,covered:sight.blocked,fraction:sight.fraction,cam:{...cam},swing:swing*180/Math.PI,damage:structuredClone(damage),blood:P.blood,consciousness:P.consciousness,stamina:P.stamina.value,enemyStamina:E.stamina.value,shots:E.gun?.shots??0,ammo:E.gun?.ammo??6,reload:!!E.gun?.reloading,alive:P.alive,control:{...control}});
 }
 if((E.gun?.shots??0)>oldShots){events.push({t:G.t,event:'shot',what:{...E.gun.what},p:{...p},e:{...e},phase});oldShots=E.gun.shots;}
 if(damage.player.wounds>oldWounds){if(firstHit===null)firstHit=G.t;oldWounds=damage.player.wounds;events.push({t:G.t,event:'player_wound',damage:{...damage.player}});}
 if(!P.alive||!E.alive){firstLoss=G.t;break;}
}
if(coverStart!==null)coverEpisodes.push({start:coverStart,end:G.t,duration:G.t-coverStart,censored:true});
const result={source:'44b17d86f4b8d595bc452b8a27c8901089c940ab',mode,scenario,seed,react,startP,startE,duration:G.t,intendedDuration:duration,player:{alive:P.alive,state:P.state,blood:P.blood,consciousness:P.consciousness,limbs:{...P.limbs},damage:damage.player,stamina:P.stamina.value,minStamina,spent:{...P.stamina.spent},path,stuck,armed:P.armed,attackAttempts,attackAccepted},enemy:{alive:E.alive,state:E.state,blood:E.blood,damage:damage.enemy,shots:E.gun?.shots??0,what:{...E.gun?.what},spent:{...E.stamina.spent}},cover:{firstCover,firstHit,coveredSeconds,partialSeconds,episodes:coverEpisodes,maxDuration:Math.max(0,...coverEpisodes.map(x=>x.duration)),routeMismatchSeconds:routeMismatch},camera:{maxCameraStep,maxSwingStep,cutsOver6:cameraCuts},opportunity:{nearSeconds,everReload,reloadApproach,pushSince},routeStats:{...COVER_STUDY.stats},scriptObservations:{visibleUpdates,blindInputs},frames,events,...(visualSnapshots.length?{visualSnapshots}:{})};
fs.writeFileSync(out,JSON.stringify(result)+'\n');console.log(JSON.stringify({mode,scenario,seed,t:G.t,alive:P.alive,shots:result.enemy.shots,covered:coveredSeconds,path,wounds:damage.player.wounds,camera:maxCameraStep,attacks:attackAccepted}));G.world.free();
