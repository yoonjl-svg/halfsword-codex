import './style.css';
import * as T from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Fighter } from '../fighter.js';
import { LOOKS } from '../looks.js';
import { PHYSICS, SKILL, WEAPON } from '../config.js';
import { Input } from '../input.js';
import { Combat } from '../combat.js';
import { getWeapon } from '../weapons.js';
import { createStaminaHud } from '../stamina_hud.js';
import { GUN_HOOKS } from '../gun.js';
import { DRAGON, configureDragonPlayer, clamp } from './rules.js';
import { DragonGuard } from './guard.js';
import { DragonEncounter } from './encounter.js';
import { createDragonArena } from './arena.js';
import { DragonAudio } from './audio.js';
import { groundShadows } from './shadows.js';

const TEMPO=1.1; // 일반 대련과 동일한 전체 템포
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
const canvas=$('game'),input=new Input(canvas),sound=new DragonAudio();
let renderer,scene,camera,world,eventQueue,player,guard,dragon,combat,arena,shadows;
let state='menu',weaponId='longsword',acc=0,last=performance.now(),feedbackLeft=0,resultDelay=0,guardPointer=null,stickPointer=null;
let running=true,frames=0,frameTimes=[],timePlayed=0,cameraReady=false,guardKey=false,lastStaminaText="",lastHealth=-1,qualityTime=0,qualityFrames=0,qualitySlow=0,qualityFast=0,qualityGood=0;
const chosen=['longsword','rapier','uchigatana','qinggang','zweihander','morgenstern','druid_whip','pistol'];
for(const id of chosen){const w=getWeapon(id);if(w.id!==id)continue;const o=document.createElement('option');o.value=id;o.textContent=w.nameKo;$('weapon').append(o);}
if(chosen.includes(params.get('weapon')))weaponId=params.get('weapon');$('weapon').value=weaponId;
const hud=createStaminaHud($('meters'));
const target=new T.Vector3(),cameraTarget=new T.Vector3(),look=new T.Vector3(),viewDir=new T.Vector3(),side=new T.Vector3();
const eventLog=[];
function event(e) {
  eventLog.push({type:e.type,time:+e.time.toFixed(3),attack:e.attack,zone:e.zone,damage:e.damage});if(eventLog.length>400)eventLog.shift();
  if(state==='fight')sound.event(e);
  if(e.type==='tell')cue(e.name,e.blockable?'막기 또는 회피':'큰 공격 · 회피 준비',e.blockable?'light':'heavy');
  if(e.type==='opening')cue('숨 고르는 틈','낮아진 목을 노리세요','opening');
  if(e.type==='stagger')cue('앞다리가 꺾였습니다','머리를 공격하세요','opening');
  if(e.type==='block')flash('막아냈습니다');
  if(e.type==='cover')flash('화염을 피했습니다');
  if(e.type==='hit'&&e.zone==='목 아래')flash('목 아래 적중');
  if(e.type==='hurt')flash('피격');
  if(e.type==='victory')finish(true);
}
function cue(title,detail='',kind=''){const e=$('cue');e.querySelector('b').textContent=title;e.querySelector('span').textContent=detail;e.dataset.kind=kind;}
function flash(text){$('feedback').textContent=text;$('feedback').classList.add('show');feedbackLeft=1.2;}
function resetInput(){input.resetTransient();input.keys.clear();guardPointer=null;guardKey=false;stickPointer=null;$('stick').querySelector('i').style.transform='';$('guard').classList.remove('held');if(guard){guard.held=false;guard.broken=false;}}
function disposeRound(){
  shadows?.dispose();shadows=null;
  if(world)world.free();if(eventQueue)eventQueue.free();
  if(scene){const geo=new Set(),mat=new Set();scene.traverse(o=>{if(o.geometry)geo.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])mat.add(m);});for(const g of geo)g.dispose();for(const m of mat)m.dispose();}
}
function round() {
  resetInput();disposeRound();eventLog.length=0;acc=0;timePlayed=0;cameraReady=false;resultDelay=0;feedbackLeft=0;
  scene=new T.Scene();world=new RAPIER.World({x:0,y:PHYSICS.gravity,z:0});world.timestep=PHYSICS.timestep;world.integrationParameters.numSolverIterations=6;eventQueue=new RAPIER.EventQueue(true);
  arena=createDragonArena(scene,RAPIER,world);const info=new Map();
  player=new Fighter(RAPIER,world,scene,info,{index:0,name:'여행자',x:-5.8,z:0,heading:0,look:LOOKS.player,weapon:weaponId});
  configureDragonPlayer(player);player.skill.level=.7;player.skill.corr=SKILL.corr;player.skill.autoGuard=true;player.canShove=false;
  guard=new DragonGuard(player);dragon=new DragonEncounter(scene,RAPIER,world,player,guard,arena.covers,event);shadows=groundShadows(scene,arena.covers);
  combat=new Combat(info,{onWound:()=>{},onClash:()=>{}});
  GUN_HOOKS.onImpact=(_f,p)=>dragon.bulletImpact(p);
  GUN_HOOKS.onShot=()=>sound.noiseSound(.2,2100,.35);
  input.tapOnDown=!!player.weapon?.gun;
  player.syncMeshes();cue('수호룡과 마주합니다','작은 공격은 막고, 큰 공격은 피하세요');
  $('feedback').classList.remove('show');updateCamera(1,true);updateHud();
}
async function start(){weaponId=$('weapon').value||'longsword';round();state='fight';input.enabled=true;$('menu').hidden=true;$('pauseMenu').hidden=true;$('result').hidden=true;$('hud').hidden=false;await sound.unlock();sound.pause(false);last=performance.now();}
function pause(){if(state!=='fight')return;state='paused';input.enabled=false;resetInput();sound.pause(true);document.exitPointerLock?.();$('pauseMenu').hidden=false;acc=0;}
async function resume(){if(state!=='paused')return;resetInput();state='fight';input.enabled=true;$('pauseMenu').hidden=true;await sound.unlock();sound.pause(false);last=performance.now();}
function choose(){state='menu';input.enabled=false;resetInput();document.exitPointerLock?.();$('menu').hidden=false;$('result').hidden=true;$('pauseMenu').hidden=true;$('hud').hidden=true;sound.pause(true);round();}
function finish(win){if(state!=='fight')return;state=win?'won':'lost';input.enabled=false;resetInput();document.exitPointerLock?.();resultDelay=1.8;cue(win?'성채에 적막이 돌아옵니다':'여정이 멈추었습니다');}
function showResult(){
  const win=state==='won';$('resultTitle').textContent=win?'수호룡을 쓰러뜨렸습니다':'다시 도전할 수 있습니다';
  $('resultText').textContent=win?'오래 닫혀 있던 문이 조용해졌습니다.':`${player.deathCause||'상처'}로 전투를 마쳤습니다. 약한 공격을 막아 반격할 틈을 만들어 보세요.`;
  const dl=$('resultStats');dl.replaceChildren();
  for(const [label,value] of [['전투 시간',`${Math.round(timePlayed)}초`],['용에게 맞힌 타격',`${dragon.stats.playerHits}회`],['막기 성공',`${dragon.stats.blocked}회`],['엄폐 성공',`${dragon.stats.coverStops}회`]]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;dl.append(dt,dd);}
  $('result').hidden=false;
}
function readInput(dt) {
  const d=input.consumeHandDelta(),taps=input.consumeTaps();
  player.handHeld=input.activeTouch!==null;
  player.inputActive=Math.abs(d.x)+Math.abs(d.y)>1e-5;
  const swipe=Math.hypot(d.x,d.y)/Math.max(.001,dt)>=SKILL.swingSpeed;
  guard.held=(guardPointer!==null||guardKey)&&player.alive&&!player.stamina.exhausted;
  if(guard.broken&&(!guard.held||(!player.skill.swinging&&!player.skill.tap&&!swipe&&!taps)))guard.broken=false;
  if(guard.held&&(swipe||taps))guard.broken=true;
  if(!player.stamina.exhausted&&(!guard.held||guard.broken)) {
    player.handOffset.x=clamp(player.handOffset.x+d.x,-WEAPON.reach,WEAPON.reach);
    player.handOffset.y=clamp(player.handOffset.y+d.y,-WEAPON.reach,WEAPON.reach);
    if(taps&&player.alive)player.skill.thrust();
  }
  const m=input.move;player.move.set(m.x,m.y);player.stickX=m.x;player.stickY=m.y;
  $('guard').classList.toggle('held',guard.held&&!guard.broken);
}
function step() {
  const dt=PHYSICS.timestep;
  dragon.beforeStep(dt);player.faceTarget=dragon.focus;guard.step(dt);
  player.step(dt);player.cacheState();world.step(eventQueue,combat.physicsHooks);combat.afterStep(world,eventQueue);dragon.afterStep(dt);
  if(state==='fight'){timePlayed+=dt;if(!player.alive)finish(false);}
  if(feedbackLeft>0){feedbackLeft-=dt;if(feedbackLeft<=0)$('feedback').classList.remove('show');}
}
function updateCamera(dt,snap=false) {
  shadows?.update(player,dragon);
  // 머리/물리 골반의 흔들림에 카메라가 따라 돌지 않는다. 고정 방향의 넓은 전면 전장.
  const portrait=camera.aspect<1;
  target.set(1.15,1.65,0);cameraTarget.set(-8.5,6.8,14.5);
  if(portrait)cameraTarget.sub(target).multiplyScalar(1.32).add(target);
  if(state==='menu'){target.set(2.2,2,0);cameraTarget.set(-8,7.3,15);}
  const k=snap||!cameraReady?1:1-Math.exp(-dt*5);camera.position.lerp(cameraTarget,k);look.lerp(target,k);camera.lookAt(look);cameraReady=true;
}
function updateHud(){
  const ratio=dragon.health/DRAGON.health;if(lastHealth!==dragon.health){lastHealth=dragon.health;$('bossFill').style.transform=`scaleX(${ratio})`;$('bossFill').parentElement.setAttribute('aria-valuenow',String(Math.round(dragon.health)));}
  const st=player.stamina,html=`${st.exhausted?'탈진':'기력'} <b>${Math.round(st.value)}</b><span> / ${st.max}</span>`;if(lastStaminaText!==html){lastStaminaText=html;$('staminaReadout').innerHTML=html;}
  hud.update([player],camera,state==='fight');
}
function resize(){if(!renderer)return;renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.fov=innerWidth/innerHeight<1?55:40;camera.updateProjectionMatrix();}
function frame(now){
  if(!running)return;requestAnimationFrame(frame);const rawDt=(now-last)/1000,dt=Math.min(.08,rawDt);last=now;
  if(state==='fight'&&!params.has('manual')){qualityTime+=rawDt;qualityFrames++;if(rawDt>.045)qualitySlow++;if(rawDt<.020)qualityFast++;if(qualityTime>3){const ratio=renderer.getPixelRatio(),maxRatio=Math.max(1,Math.min(devicePixelRatio,1.5,1800/innerWidth));let next=ratio;if(qualitySlow/qualityFrames>.35){next=Math.max(1,ratio-.25);qualityGood=0;}else if(qualityFast/qualityFrames>.9){qualityGood+=qualityTime;if(qualityGood>=8){next=Math.min(maxRatio,ratio+.25);qualityGood=0;}}else qualityGood=0;if(next!==ratio){renderer.setPixelRatio(next);renderer.setSize(innerWidth,innerHeight);}qualityTime=0;qualityFrames=0;qualitySlow=0;qualityFast=0;}}
  frames++;frameTimes.push(dt*1000);if(frameTimes.length>240)frameTimes.shift();
  if(state==='fight'&&!params.has('manual')) {
    readInput(dt);acc+=dt*TEMPO;
    let steps=0;while(acc>=PHYSICS.timestep&&steps<PHYSICS.maxStepsPerFrame){step();acc-=PHYSICS.timestep;steps++;if(state!=='fight')break;}
    if(steps===PHYSICS.maxStepsPerFrame)acc=0;
    player.syncMeshes();
  } else if((state==='won'||state==='lost')&&resultDelay>0) {
    dragon.beforeStep(dt);dragon.updateParticles(dt);resultDelay-=dt;if(resultDelay<=0)showResult();
  }
  updateCamera(dt);updateHud();renderer.render(scene,camera);
}
function snapshot(){const p=player.bodies.pelvis.translation();return {state,weapon:weaponId,player:{position:{...p},state:player.state,alive:player.alive,blood:player.blood,consciousness:player.consciousness,stamina:player.stamina.value,max:player.stamina.max,ratio:player.stamina.ratio,exhausted:player.stamina.exhausted,moveScale:player.encounterMoveScale,spent:{...player.stamina.spent},guard:guard.held},dragon:dragon.snapshot(),events:[...eventLog],render:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,pixelRatio:renderer.getPixelRatio(),meanFrameMs:frameTimes.reduce((a,b)=>a+b,0)/(frameTimes.length||1)}};}

$('start').onclick=start;$('pause').onclick=pause;$('resume').onclick=resume;$('restart').onclick=start;$('restartPause').onclick=start;$('choose').onclick=choose;$('choosePause').onclick=choose;
$('weapon').onchange=()=>{weaponId=$('weapon').value;round();};
window.addEventListener('resize',resize);window.addEventListener('keydown',e=>{if(e.code==='KeyF'&&state==='fight'){e.preventDefault();guardKey=true;}if(e.code==='Escape'){if(state==='fight')pause();else if(state==='paused')resume();}});
window.addEventListener('keyup',e=>{if(e.code==='KeyF')guardKey=false;});
window.addEventListener('blur',()=>{if(state==='fight')pause();else resetInput();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='fight')pause();});
$('guard').addEventListener('pointerdown',e=>{if(state!=='fight')return;e.preventDefault();guardPointer=e.pointerId;$('guard').setPointerCapture(e.pointerId);});
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('guard').addEventListener(type,e=>{if(e.pointerId===guardPointer)guardPointer=null;});
const stick=$('stick'),knob=stick.querySelector('i');
function stickMove(e){if(e.pointerId!==stickPointer)return;const r=stick.getBoundingClientRect(),dx=e.clientX-r.x-r.width/2,dy=e.clientY-r.y-r.height/2,max=r.width*.33,len=Math.hypot(dx,dy),k=Math.min(1,max/(len||1));knob.style.transform=`translate(${dx*k}px,${dy*k}px)`;input.stickMove={x:clamp(dx/max,-1,1),y:clamp(-dy/max,-1,1)};const n=Math.hypot(input.stickMove.x,input.stickMove.y);if(n>1){input.stickMove.x/=n;input.stickMove.y/=n;}}
stick.addEventListener('pointerdown',e=>{if(state!=='fight')return;e.preventDefault();stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);stickMove(e);});stick.addEventListener('pointermove',stickMove);
for(const type of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(type,e=>{if(e.pointerId!==stickPointer)return;stickPointer=null;input.stickMove={x:0,y:0};knob.style.transform='';});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();pause();$('fatal').hidden=false;$('fatal').textContent='화면을 복구하고 있습니다. 잠시 기다려 주세요.';});
canvas.addEventListener('webglcontextrestored',()=>{$('fatal').hidden=true;flash('화면이 복구되었습니다');});
window.addEventListener('error',e=>{running=false;$('fatal').hidden=false;$('fatal').textContent=`전투를 불러오지 못했습니다. 새로고침해 주세요.\n${e.message}`;});

try {
  await RAPIER.init();
  renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.shadowMap.enabled=false;renderer.shadowMap.type=T.PCFShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.NoToneMapping;
  camera=new T.PerspectiveCamera(55,innerWidth/innerHeight,.1,150);resize();round();
  $('start').disabled=false;$('start').textContent='용과 마주하기';
  globalThis.__dragon={snapshot};
  if(params.has('debug'))Object.defineProperties(globalThis.__dragon,Object.getOwnPropertyDescriptors({
    get player(){return player;},get dragon(){return dragon;},get guard(){return guard;},get world(){return world;},get renderer(){return renderer;},get camera(){return camera;},start,pause,resume,choose,
    tick(n=1){for(let i=0;i<n;i++){readInput(PHYSICS.timestep);step();}player.syncMeshes();updateCamera(1,true);updateHud();renderer.render(scene,camera);},
    attack(id){dragon.begin(id);},setGuard(on){guardKey=on;guard.held=on;guard.broken=false;},
    position(x,z){const p=player.bodies.pelvis.translation(),dx=x-p.x,dz=z-p.z;const seen=new Set();for(const {rb}of player.meshes){if(seen.has(rb))continue;seen.add(rb);const q=rb.translation();rb.setTranslation({x:q.x+dx,y:q.y,z:q.z+dz},true);rb.setLinvel({x:0,y:0,z:0},true);rb.setAngvel({x:0,y:0,z:0},true);}dragon.previousBlade=null;player.stamina.position=null;},
    draw(){player.syncMeshes();dragon.model.update(dragon,0);updateHud();renderer.render(scene,camera);},events:eventLog,
  }));
  requestAnimationFrame(frame);
  if(params.has('play'))await start();
} catch(e){running=false;$('fatal').hidden=false;$('fatal').textContent=`전투를 불러오지 못했습니다.\n${e.message}`;console.error(e);}
