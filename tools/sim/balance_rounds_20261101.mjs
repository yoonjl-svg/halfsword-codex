// Full-kit 30-reference-second player Input proxy rounds. Research only.
// Neither policy is a human trial or an estimate of natural human frequency.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { newRound, CONFIG, DT, THREE } from './harness_m.mjs';
import { observeRound, BASE, snapshot } from './balance_core_20261101.mjs';
import { PlayerSecretWatch, secretLeft, secretUsesOf, bladesTouch } from '../../src/secret.js';
import { PlayerUniqueAssist, PLAYER_UNIQUE, strokeTechOf } from '../../src/unique_assist.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { Input } from '../../src/input.js';
import { allNodeIds, kitFromNodes } from '../../src/skill_tree_data.js';
import { TECH_BY_NAME, G as PAD } from '../../src/ai_techniques.js';
import { recoverRate } from '../../src/stamina.js';
import { LOOKS } from '../../src/looks.js';
import { isMain } from './is_main.mjs';

const K=CONFIG.TIME.k, FR=1/60, REACTION=.22;
const BUILD=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const HASH=createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex');
const SPECS={italian:{weapon:'rapier',secret:'andareRisoluto'},iberian:{weapon:'zweihander',secret:'ibSpin'},japanese:{weapon:'uchigatana',secret:'goNoSen'},chinese:{weapon:'hwando',secret:'gyeoksal'}};
const SECRETS={german:'mordschlag',...Object.fromEntries(Object.entries(SPECS).map(([s,o])=>[s,o.secret]))};
const ALL=Object.entries(PLAYER_UNIQUE).flatMap(([school,ts])=>ts.map(t=>({school,name:t.name,category:t.special?'special':'unique'}))).concat(Object.entries(SECRETS).map(([school,name])=>({school,name,category:'secret'})));
const FOES={pressure:{aggr:1.2,margin:.1,patienceTime:4,circleRate:.15},spacing:{aggr:.7,margin:.45,patienceTime:12,circleRate:.25}};
const FORBIDDEN=['TIME_STD','IT_RHYTHM','B4_OLD','B4_ANGLE','FINISH_ENTRY','FINISH_MODE','FINISH_POWER','VITAL','PLATE_NECK','VITAL_AI','VITAL_THRUST','VITAL_PCUT','FINISH_LIFT','FINISH_AIM','FINISH_LIFT_HANDS','FINISH_ARM','FINISH_WRIST','FINISH_CHEST_S','FINISH_CLEAVE','FINISH_CLEAVE_AI','FINISH_CLEAVE_CHARGE','FINISH_CLEAVE_LOW','FINISH_CLEAVE_POWER'];
for(const key of FORBIDDEN)if(process.env[key]!=null)throw Error(`Unset experiment override ${key}`);
if(BUILD!==BASE)throw Error(`Unexpected build ${BUILD}`);
const configHash=()=>createHash('sha256').update(JSON.stringify(CONFIG)).digest('hex');
const CONFIG_HASH=configHash();
const q=x=>Number.isFinite(x)?+x.toFixed(7):null;
const cp=x=>JSON.parse(JSON.stringify(x));
const sum=o=>Object.values(o??{}).reduce((a,n)=>a+(Number.isFinite(n)?n:0),0);
function rng(seed){let s=seed>>>0;const r=()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);r.g=()=>Math.sqrt(-2*Math.log(1-r()))*Math.cos(2*Math.PI*r());return r;}
const canvas={addEventListener(){}};
const win={innerWidth:844,innerHeight:390,addEventListener(){},location:{search:''}};
function inputEnv(fn){const had=Object.hasOwn(globalThis,'window'),old=globalThis.window;globalThis.window=win;try{return fn();}finally{if(had)globalThis.window=old;else delete globalThis.window;}}
globalThis.document??={pointerLockElement:null};
globalThis.matchMedia??=()=>({matches:true});
function bladeCorrection(P,E){
 const a=P.bladePoint(.25,new THREE.Vector3()),b=E.bladePoint(.65,new THREE.Vector3());
 const d=b.sub(a).applyQuaternion(P.yaw.clone().invert());
 return {x:Math.max(-.5,Math.min(.5,P.handOffset.x+d.z*.2)),y:Math.max(-.3,Math.min(.45,P.handOffset.y+(d.y+.03)*.2))};
}

export function runRound({school='italian',mode='natural',opponent='pressure',seed=1,seconds=30}={}){
 const wall0=performance.now(),spec=SPECS[school],rnd=rng(seed*7919+37);
 if(!spec||!FOES[opponent]||!['natural','targeted'].includes(mode))throw Error('Unknown round setting');
 const kit=kitFromNodes(school,allNodeIds(school));
 const G=newRound({seed,weapon:spec.weapon,weapon2:'longsword',kit,walls:true,look:LOOKS.player,look2:LOOKS.enemy,difficulty:CONFIG.AI_PROFICIENCY.levels[3],persona:{proficiency:3,pers:FOES[opponent]},onFighter(f){if(f.index===0)f.humanInput=true;}});
 const P=G.player,E=G.enemy;P.skill.autoGuard=true;P.canShove=true;
 const uq=new PlayerUniqueAssist(P,{names:kit.unique}),W=new PlayerSecretWatch(P,E,{locked:!kit.secret}),guard=new PlayerParryGuard(P,E);P.stamina.controller=guard;
 const input=inputEnv(()=>new Input(canvas));input.enabled=true;
 const recorder=observeRound(G,{school,mode,opponent,seed,tech:'all',controller:'scripted_touch_via_Input_and_Input.move'});
 const byTech=Object.fromEntries(ALL.map(t=>[t.name,{school:t.school,category:t.category,applicable:t.school===school,opportunities:0,intents:0,requests:0,accepted:0,started:0,contacts:0,effectiveWounds:0,severity:0,consciousnessLost:0,limbFunctionLost:0,bleedAdded:0}]));
 const events=[],trace=[],opportunityKinds={};let activeStart=null,action=null,nextDecision=0,sequence=0,nextFrame=0,frames=0,hand=false,x=620,y=180,endedBy='horizon',error=null;
 let ordinaryIntents=0,guardIntents=0,queuedSource=null,seenWindows=0,lastTouch=false,lastState={player:P.state,enemy:E.state},lastBroken={player:!!P.weaponBroken,enemy:!!E.weaponBroken};
 const seenRuns=new WeakSet(),seenMotion=new WeakSet(),history=[],opState={},minConscious={player:P.consciousness,enemy:E.consciousness};
 const emit=(kind,data={})=>events.push({kind,tGame:q(G.t),tReference:q(G.t/K),tActive:activeStart==null?null:q((G.t-activeStart)/K),...data});
 const add=(name,key,n=1)=>{if(byTech[name])byTech[name][key]+=n;};
 const opportunity=(name,on,kind,detail={})=>{const key=`${name}:${kind}`;if(on&&!opState[key]){add(name,'opportunities');opportunityKinds[key]=(opportunityKinds[key]??0)+1;emit('opportunity',{tech:name,definition:kind,...detail});}opState[key]=!!on;};
 const techNow=f=>f.skill.sec?.S?.name??strokeTechOf(f)??f.iai?.tech??(f.skill.tap?'tap':'basic');
 for(const [who,f]of[['player',P],['enemy',E]]){
  const original=f.applyWound;
  f.applyWound=function(h){const before=snapshot(f),bleed=f.bleed;const r=original.call(this,h),after=snapshot(f),tech=techNow(f===E?P:E);
   const delta={actualWounds:after.wounds-before.wounds,consciousnessLost:before.consciousness-after.consciousness,limbFunctionLost:sum(Object.fromEntries(Object.keys(before.limbs).map(k=>[k,Math.max(0,before.limbs[k]-(after.limbs[k]??0))]))),bleedAdded:f.bleed-bleed};
   if(f===E){for(const k of ['consciousnessLost','limbFunctionLost','bleedAdded'])add(tech,k,delta[k]);if(delta.actualWounds>0)add(tech,'effectiveWounds',delta.actualWounds);}
   emit('physiology',{who,tech,part:h.part??null,zone:h.zone,type:h.type,severity:q(h.severity),...Object.fromEntries(Object.entries(delta).map(([k,v])=>[k,q(v)])),limbsBefore:before.limbs,limbsAfter:after.limbs,died:before.alive&&!after.alive});return r;};
 }
 const wound=G.combat.hooks.onWound;G.combat.hooks.onWound=(att,vic,r,pt,pr)=>{wound?.(att,vic,r,pt,pr);const tech=techNow(att);if(att===P){add(tech,'contacts');add(tech,'severity',r.type==='blunt'?0:r.severity??0);}emit('body_contact_callback',{attacker:att===P?'player':'enemy',victim:vic===P?'player':'enemy',tech,part:pr?.v?.part??null,zone:r.zone,type:r.type,energy:q(r.energy),severity:q(r.severity),helmet:!!r.helmet});};
 const clash=G.combat.hooks.onClash;G.combat.hooks.onClash=(...a)=>{clash?.(...a);emit('steel_clash',{fresh:!!a[2]?.fresh});};
 const secret=P.skill.secret;P.skill.secret=function(o){const name=o?.S?.name??spec.secret;add(name,'requests');const r=secret.call(this,o);if(r)add(name,'accepted');emit('engine_request',{tech:name,source:queuedSource??'input_window',accepted:!!r,open:!!W.open,left:secretLeft(P),stamina:q(P.stamina.value),ctx:o?.ctx?cp(o.ctx):null});return r;};
 const updateSecret=P.skill.updateSecret;P.skill.updateSecret=function(dt){const run=this.sec;if(run&&!seenRuns.has(run)){seenRuns.add(run);add(run.S.name,'started');emit('actual_execution',{tech:run.S.name,source:'Skill.updateSecret',stage:run.stage,stamina:q(P.stamina.value)});}return updateSecret.call(this,dt);};
 const choose=uq.choose;uq.choose=function(...a){const r=choose.apply(this,a);if(r){add(r.e.name,'opportunities');emit('opportunity',{tech:r.e.name,definition:'actual_engine_stroke_chooser_match',base:a[0]?.tech??null});}return r;};
 for(const method of ['start','launchTap','windFire']){const original=uq[method];uq[method]=function(...a){const name=method==='windFire'?'redondo':a[0]?.name;const before=this.stats.fired[name]??0;add(name,'requests');const r=original.apply(this,a);const accepted=(this.stats.fired[name]??0)>before;if(accepted)add(name,'accepted');emit('engine_request',{tech:name,method,accepted,returnValue:typeof r==='boolean'?r:null,part:method==='start'?a[2]??null:null});if(method==='start'&&this.r?.e?.name===name&&a[2]!==2){add(name,'started');emit('actual_execution',{tech:name,source:'PlayerUniqueAssist.start',stamina:q(P.stamina.value)});}return r;};}
 const initial={player:snapshot(P),enemy:snapshot(E)};
 const event=(kind,dx=0,dy=0)=>{
  if(kind==='pointerdown'){x=620;y=180;}
  const base={pointerId:1,pointerType:'touch',button:0,timeStamp:Math.max(1,G.t/K*1000),type:kind,clientX:x,clientY:y};
  if(kind==='pointerdown'){inputEnv(()=>input.onDown(base));hand=true;}
  else if(kind==='pointerup'){inputEnv(()=>input.onUp(base));hand=false;}
  else{const scale=CONFIG.INPUT.touchSensitivity/390;x+=dx/scale;y-=dy/(scale*input.mobileIntent.verticalGain);inputEnv(()=>input.onMove({...base,clientX:x,clientY:y}));}
  trace.push({tReference:q(G.t/K),event:kind,dx:q(dx),dy:q(dy),clientX:q(x),clientY:q(y),outsideViewport:x<0||x>844||y<0||y>390});
 };
 function stroke(name,{side=0,fwd=null,combo=false,target=null}={}){
  const T=name==='langortDown'?{from:PAD.langort,path:[[.02,-.22]]}:TECH_BY_NAME[name];if(!T)throw Error(`Missing stroke ${name}`);
  let hx=P.handOffset.x,hy=P.handOffset.y;const queue=[];
  const to=(p,speed)=>{for(let j=0;j<500;j++){const dx=p[0]-hx,dy=p[1]-hy,d=Math.hypot(dx,dy);if(d<1e-7)break;const s=Math.min(d,speed*FR);queue.push([dx/d*s,dy/d*s]);hx+=dx/d*s;hy+=dy/d*s;}};
  to([T.from[0]+rnd.g()*.035,T.from[1]+rnd.g()*.035],CONFIG.SKILL.recoverSpeed);queue.push(...Array.from({length:5},()=>[0,0]));
  const speed=3.8+rnd()*.8;for(const p of T.path)to([p[0]+(rnd()*2-1)*.025,p[1]+(rnd()*2-1)*.025],speed);
  if(combo){queue.push(...Array.from({length:4},()=>[0,0]));to([hx-.3,hy+.65],speed);}
  return {kind:'stroke',queue,side,fwd,target,base:name};
 }
 function begin(a,seen){
  if(hand)event('pointerup');action={...a,t:G.t/K};if(a.target)add(a.target,'intents');else if(a.kind==='guard')guardIntents++;else ordinaryIntents++;
  emit('intended_action',{action:a.kind,tech:a.target??null,base:a.base??null,observedAt:seen?.t??null,observationLag:seen?q(G.t/K-seen.t):null,reason:a.reason??null});
  if(['stroke','tap','hold','circle','bind'].includes(a.kind))event('pointerdown');
 }
 function decide(S){
  const targeted=rnd()<(mode==='targeted'?.8:.25),side=rnd()<.5?-.9:.9;
  if(targeted){
   if(S.window&&school!=='chinese'&&school!=='iberian')return {kind:'tap',seconds:.07,target:spec.secret,reason:'delayed_window_cue'};
   if(school==='italian'){
    if(S.attack&&S.distance<S.reach+.8)return {kind:'tap',seconds:.07,side,target:'inquartata',reason:'delayed_enemy_attack'};
    if(S.cav)return {kind:'tap',seconds:.07,target:'cavazione',reason:'delayed_blade_touch_window'};
    if(sequence++%3===0&&S.left>0)return {kind:'bind',seconds:1.4,fwd:.8,target:spec.secret,reason:'maintain_blade_cover_and_advance'};
    return stroke('oberhau',{target:'imbroccata'});
   }
   if(school==='iberian'){
    if(S.spin)return {kind:'circle',seconds:.8,target:spec.secret,reason:'delayed_armed_cue'};
    if(S.left>0&&S.distance>S.reach)return {kind:'wait',seconds:1.5,fwd:0,target:spec.secret,reason:'wait_outside_reach_for_arm'};
    return sequence++%2===0?{kind:'hold',seconds:.95,target:'redondo',fwd:.7,reason:'press_and_release'}:stroke('zornhau',{side,target:'talhoRodeado'});
   }
   if(school==='japanese'){
    if(S.left>0)return {kind:'wait',seconds:S.iai?.55:2.35,fwd:S.iai&&S.distance>S.reach+.15?.6:0,target:spec.secret,reason:'idle_then_wait_for_enemy'};
    const n=sequence++%3;return n===0?stroke('langortDown',{target:'kote'}):n===1?stroke('zornhauL',{side,target:'hirakiGiri'}):stroke('oberhau',{combo:true,target:'tsubameGaeshi'});
   }
   if(school==='chinese'){
    if(S.attack&&S.left>0)return {kind:'guard',seconds:.65,fwd:1,target:spec.secret,reason:'new_guard_forward_against_delayed_attack'};
    const n=sequence++%3;return n===0?{kind:'retreatTap',seconds:.32,target:'lianchi'}:stroke('zwerch',{fwd:n===1?1:.25,target:n===1?'chebuYaoji':'yaoji'});
   }
  }
  if(S.attack&&S.distance<S.reach+.9&&rnd()<.7)return {kind:'guard',seconds:.6,fwd:S.distance<S.contact?-.5:0};
  if(S.distance>S.reach+.55)return {kind:'move',seconds:.5,fwd:.9};
  if(rnd()<.25)return {kind:'tap',seconds:.07};
  const names=['zornhau','zornhauL','oberhau','zwerch','unterhau'];return stroke(names[Math.floor(rnd()*names.length)]);
 }
 function sense(){const C=uq.touch;return {t:G.t/K,distance:P.foeDistance(),attack:G.ai.mode==='attack'||!!E.skill.tap||!!E.skill.swinging,window:!!W.open,spin:!!W.spinArm.armed,iai:!!W.iaiArm.armed,left:secretLeft(P),reach:P.swordArt.measure.reach,contact:P.swordArt.measure.contact,cav:!!C&&!C.cut&&!C.cavSpent&&uq.t-C.t0>=CONFIG.UNIQUE_ASSIST.cavFrom&&uq.t-C.t1<=CONFIG.UNIQUE_ASSIST.cavTo,correction:bladeCorrection(P,E)};}
 function inputFrame(){
  const t=G.t/K,seen=history.findLast(s=>s.t<=t-REACTION+1e-8),busy=P.stamina.exhausted||!!P.skill.secretPhase;
  if(!P.openHold&&activeStart==null){activeStart=G.t;emit('active_start');}
  if(activeStart!=null&&P.alive&&E.alive&&!busy&&!action&&t>=nextDecision&&seen){begin(decide(seen),seen);nextDecision=t+.35;}
  let guardPress=false,side=.14*Math.sin(t*.65+seed),fwd=seen?(seen.distance>seen.contact+.18?.7:seen.distance<.7?-.4:0):0;
  if(action){const age=t-action.t;guardPress=action.kind==='guard';if(action.side!=null)side=action.side;if(action.fwd!=null)fwd=action.fwd;
   let done=false;
   if(action.kind==='stroke'){if(action.queue.length&&!busy){const [dx,dy]=action.queue.shift();event('pointermove',dx,dy);}done=!action.queue.length;}
   else if(action.kind==='circle'){const z=Math.min(1,age/action.seconds),pt=[.15*(Math.cos(z*Math.PI*2*1.35)-1),.15*Math.sin(z*Math.PI*2*1.35)],prev=action.prev??[0,0];if(!busy)event('pointermove',pt[0]-prev[0],pt[1]-prev[1]);action.prev=pt;done=z>=1;}
   else if(action.kind==='bind'){if(seen?.correction&&!busy){const dx=seen.correction.x-P.handOffset.x,dy=seen.correction.y-P.handOffset.y,d=Math.hypot(dx,dy),k=d?Math.min(1,.6*FR/d):0;event('pointermove',dx*k,dy*k);}done=age>=action.seconds;}
   else if(action.kind==='retreatTap'){side=0;fwd=-.8;if(age>=action.seconds){event('pointerdown');action={kind:'tap',target:'lianchi',seconds:.07,t};}}
   else done=age>=(action.seconds??.5);
   if(done){if(hand)event('pointerup');action=null;nextDecision=Math.max(nextDecision,t+.25);}
  }
  if(P.openHold){side=fwd=0;guardPress=false;}
  const d=input.consumeHandDelta();let taps=input.consumeTaps();if(P.stamina.exhausted){d.x=d.y=0;taps=0;}
  let secBusy=busy;const swipe=Math.hypot(d.x,d.y)/FR>=CONFIG.SKILL.swingSpeed;
  input.stickMove={x:side,y:fwd};
  const atkWin=!!W.open&&!W.stickOwns()&&!W.circleOwns(),stickGo=W.spinStick(FR,input.move,!secBusy&&P.alive),circleGo=W.spinCircle(FR,d,hand,!secBusy&&P.alive),secArm=!(CONFIG.SECRET.secretHold&&(P.skill.tap||P.skill.pom));
  if(((atkWin&&(taps>0||swipe&&!W.S?.do?.tapOnly))||stickGo||circleGo)&&!secBusy&&P.alive&&secArm){const o=W.fire();if(o)o.dir=[d.x,d.y];if(P.skill.secret(o))secBusy=true;}
  if(!secBusy&&P.alive&&(taps>0||swipe)&&W.canBuffer())W.buffer([d.x,d.y]);
  const bufHold=!secBusy&&!!W.bufferHold;if(secBusy||bufHold)taps=0;
  guard.held=guardPress;
  if(guard.broken&&(!guard.held||(!P.skill.swinging&&!P.skill.tap&&!swipe&&taps===0)))guard.broken=false;
  if(guard.held&&!bufHold&&(swipe||taps>0))guard.broken=true;
  const guardHold=guard.held&&!guard.broken&&!secBusy;
  uq.feed(d.x,d.y,FR,guardHold||bufHold||guard.held,guardHold||bufHold);
  if(uq.holdE){const hs=input.holdState();uq.holdInput(hs.down&&!P.stamina.exhausted,hs.still,!!W.open);}
  const winding=!!uq.winding;
  if(P.alive&&!secBusy&&!guardHold&&!bufHold&&!winding){P.handOffset.x+=d.x;P.handOffset.y+=d.y;}
  P.handHeld=hand;P.inputActive=!secBusy&&!bufHold&&!winding&&Math.abs(d.x)+Math.abs(d.y)>1e-5;
  const press=input.press;P.handGrip=press?press.moved>=(CONFIG.INPUT.holdPx??CONFIG.INPUT.tapPx):P.inputActive;
  if(taps>0&&P.alive){const accepted=P.skill.thrust();emit('ordinary_tap_request',{accepted:!!accepted,count:taps});}
  const m=input.move,feet=P.alive&&!P.stamina.exhausted&&P.skill.secretPhase!=='stiff';P.move.set(feet?m.x:0,feet?m.y:0);P.stickX=feet?m.x:0;P.stickY=feet?m.y:0;
  trace.push({tReference:q(t),event:'input_frame',dx:q(d.x),dy:q(d.y),taps,stickX:q(P.stickX),stickY:q(P.stickY),guardHeld:guard.held,guardBroken:guard.broken,hand,secBusy,bufHold,winding,observationT:seen?q(seen.t):null});frames++;
 }
 G.before=()=>{
  W.update(DT,!!P.skill.sec);
  if(W.opened>seenWindows){const n=W.opened-seenWindows;seenWindows=W.opened;add(spec.secret,'opportunities',n);emit('opportunity',{tech:spec.secret,definition:'actual_PlayerSecretWatch_window',count:n,ctx:W.open?.ctx?cp(W.open.ctx):null});}
  if(W.queued&&!P.skill.sec&&P.alive){const o=W.fire();queuedSource='automatic_gyeoksal_or_buffer';if(o)P.skill.secret(o);queuedSource=null;}
  guard.step(DT);
  if(guard.active){P.inputActive=true;P.handHeld=true;}
 };
 try{
  while(activeStart==null||G.t<activeStart+seconds*K){
   if(G.t/K>=nextFrame-1e-8){inputFrame();nextFrame+=FR;}
   if(typeof globalThis.window!=='undefined')throw Error('Input window shim leaked into physics');
   G.step();
   if(P.iai&&!seenMotion.has(P.iai)){seenMotion.add(P.iai);const name=P.iai.tech??P.skill.sec?.S?.name;if(byTech[name]&&name!==P.skill.sec?.S?.name&&!(uq.r?.e?.name===name)){add(name,'started');emit('actual_execution',{tech:name,source:'new_Fighter_iai_object',stamina:q(P.stamina.value)});}}
   const C=uq.touch;
   opportunity('cavazione',school==='italian'&&!!C&&!C.cut&&!C.cavSpent&&uq.t-C.t0>=CONFIG.UNIQUE_ASSIST.cavFrom&&uq.t-C.t1<=CONFIG.UNIQUE_ASSIST.cavTo,'unspent_noncut_touch_timing');
   opportunity('inquartata',school==='italian'&&guard.noThreat<=CONFIG.UNIQUE_ASSIST.inqThreat&&uq.stickOk('side')&&uq.inqSeen!==guard.threatId&&!uq.coolLeft('inquartata'),'threat_plus_side_stick');
   opportunity('lianchi',school==='chinese'&&(uq.backNow()||uq.backOff!=null&&uq.t-uq.backOff<=CONFIG.UNIQUE_ASSIST.lianWindow)&&!uq.coolLeft('lianchi'),'retreat_or_recent_retreat');
   const chain=uq.readyChain(uq.t);if(chain)opportunity(chain.name,true,'engine_readyChain');else for(const name of Object.keys(byTech))opState[`${name}:engine_readyChain`]=false;
   if(school==='iberian')opportunity('redondo',!!uq.holdE&&!W.open&&!uq.cooling(uq.holdE)&&!uq.busy()&&!P.stamina.exhausted,'hold_entry_body_and_cooldown_eligible');
   const touch=bladesTouch(P,E);if(touch&&!lastTouch)emit('geometric_blade_touch_episode');lastTouch=touch;
   for(const [who,f]of[['player',P],['enemy',E]]){minConscious[who]=Math.min(minConscious[who],f.consciousness);if(f.state!==lastState[who]){emit('body_state',{who,from:lastState[who],to:f.state,cause:f.causeOfDeath??null});lastState[who]=f.state;}if(!!f.weaponBroken!==lastBroken[who]){emit('weapon_break',{who,broken:!!f.weaponBroken});lastBroken[who]=!!f.weaponBroken;}}
   if(G.t/K>=((history.at(-1)?.t??-1)+FR-1e-8)){history.push(sense());if(history.length>120)history.shift();}
   if(!P.alive||!E.alive){endedBy='death';break;}
   if(G.t/K>seconds+15){endedBy='observer_guard';throw Error('Active start was not reached');}
  }
 }catch(e){error=String(e.stack??e);endedBy='error';}
 const actual=(activeStart==null?0:(G.t-activeStart)/K),output=recorder.finish({schemaVersion:1,buildObserved:BUILD,scriptHash:HASH,byTech,initial,conditions:{opportunityKinds},inputTrace:trace,researchEvents:events,
  settings:{weapon:spec.weapon,enemyWeapon:'longsword',opponentProficiency:3,difficulty:CONFIG.AI_PROFICIENCY.levels[3],opponentPers:FOES[opponent],resolvedOpponentPers:Object.fromEntries(Object.keys(FOES[opponent]).map(k=>[k,G.ai.pers[k]])),startGap:CONFIG.ARENA.startGap,kit:{...kit,unique:[...kit.unique],perk:[...kit.perk]},reactionReferenceSeconds:REACTION,policySpecialPriority:mode==='targeted'?.8:.25,secondsRequested:seconds,inputFrameReferenceSeconds:FR,physicsTimestep:DT,time:{...CONFIG.TIME},startHoldPhysicsSeconds:CONFIG.ARENA.startHold,observations:['same .22s delayed engine chest distance, enemy attack state, own secret/chain/touch cues, blade geometry','current own input, hand, stamina and action locks'],normalDamage:true,forcedSecretRequest:false,noConfigMutation:true,clockExclusions:['browser hit-stop','browser secret slow motion','rendering','emotion HUD']},
  limits:{humanInput:P.humanInput,aiControlled:!!P.aiControlled,humanRecoveryPerReferenceSecond:q(recoverRate(P)*K),maxStamina:P.stamina.max,maxBonus:P.stamina.maxBonus,infinite:P.stamina.infinite,secretUses:secretUsesOf(P),secretUsed:P.secretUsed??0,secretLeft:secretLeft(P),specialCooldown:CONFIG.UNIQUE_ASSIST.specialCooldown,specialCoolFrom:CONFIG.UNIQUE_ASSIST.specialCoolFrom},
  duration:{activeStartGame:q(activeStart),activeStartReference:q(activeStart/K),activeReferenceSeconds:q(actual),totalGameSeconds:q(G.t),totalReferenceSeconds:q(G.t/K),endedBy,wallSeconds:q((performance.now()-wall0)/1000)},
  proxyCounts:{ordinaryIntents,guardIntents,inputFrames:frames,outsideViewportEvents:trace.filter(e=>e.outsideViewport).length},
  enemyStamina:{spent:{...E.stamina.spent},totalSpent:sum(E.stamina.spent),recovered:E.stamina.recovered,exhaustions:E.stamina.counts.exhaustion},
  final:{player:snapshot(P),enemy:snapshot(E)},peakConsciousnessLoss:{player:initial.player.consciousness-minConscious.player,enemy:initial.enemy.consciousness-minConscious.enemy},
  validity:{valid:error==null,executionFailure:error,naturalHumanFrequency:false,humanSuccessRate:false,seedIsHumanSample:false,configUnchanged:CONFIG_HASH===configHash(),secretUsesWithinLimit:(P.secretUsed??0)<=secretUsesOf(P),wholePreparationDamageIncluded:true,bodyContactWithoutWound:'unavailable: onWound is injury/contact callback, steel clashes separately recorded',opportunityDenominators:'Heterogeneous engine events; each event retains its definition. Stroke chooser matches require an actual input and are not independent opportunities.',executionDefinition:'Unique enhancement start, secret update callback, or first observed kinetic iai object; requests and accepted fire counters are separate.'}});
 G.world.free();return output;
}

export function summarize(rows,wallSeconds){
 const groups={};for(const r of rows){const key=[r.school,r.mode,r.opponent].join('/');(groups[key]??=[]).push(r);}
 const mean=a=>a.length?sum(a)/a.length:null;
 return {schemaVersion:1,build:BUILD,scriptHash:HASH,rows:rows.length,wallSeconds:q(wallSeconds),labels:{natural:'scripted mixed priorities',targeted:'scripted technique seeking priorities',humanFrequency:false},groups:Object.fromEntries(Object.entries(groups).map(([key,rs])=>[key,{n:rs.length,valid:rs.filter(r=>r.validity.valid).length,activeReferenceSeconds:q(sum(rs.map(r=>r.duration.activeReferenceSeconds))),meanInflictedSeverity:q(mean(rs.map(r=>r.inflicted.cutStabSeverity))),meanReceivedSeverity:q(mean(rs.map(r=>r.received.cutStabSeverity))),enemyDeaths:rs.filter(r=>r.inflicted.dead).length,playerDeaths:rs.filter(r=>r.received.dead).length,playerStaminaSpentMean:q(mean(rs.map(r=>r.stamina.totalSpent))),byTech:Object.fromEntries(ALL.filter(t=>t.school===rs[0].school).map(t=>[t.name,Object.fromEntries(['opportunities','intents','requests','accepted','started','contacts','effectiveWounds','severity','consciousnessLost','limbFunctionLost','bleedAdded'].map(k=>[k,q(sum(rs.map(r=>r.byTech[t.name][k])))]))]))}]))};
}

if(isMain(import.meta.url)){
 const args=Object.fromEntries(process.argv.slice(2).map(s=>{const i=s.indexOf('=');return [s.slice(2,i<0?undefined:i),i<0?true:s.slice(i+1)];}));
 const schools=String(args.schools??Object.keys(SPECS).join(',')).split(','),modes=String(args.modes??'natural,targeted').split(','),opps=String(args.opponents??'pressure,spacing').split(','),seeds=String(args.seeds??'1,2,3,4,5,6').split(',').map(Number),seconds=+(args.seconds??30);
 const out=String(args.out??'docs/research/attack_balance_20261101/rounds/full');fs.mkdirSync(out,{recursive:true});const path=`${out}/rounds.jsonl`;fs.writeFileSync(path,'');const rows=[],wall0=performance.now();
 fs.writeFileSync(`${out}/manifest.json`,JSON.stringify({build:BUILD,scriptHash:HASH,configHash:CONFIG_HASH,schools,modes,opponents:opps,seeds,seconds,processes:1,startedUTC:new Date().toISOString(),plannedRows:schools.length*modes.length*opps.length*seeds.length},null,2));
 for(const school of schools)for(const mode of modes)for(const opponent of opps)for(const seed of seeds){const r=runRound({school,mode,opponent,seed,seconds});rows.push(r);fs.appendFileSync(path,JSON.stringify(r)+'\n');fs.writeFileSync(`${out}/summary.json`,JSON.stringify(summarize(rows,(performance.now()-wall0)/1000),null,2));console.log(JSON.stringify({n:rows.length,school,mode,opponent,seed,valid:r.validity.valid,end:r.duration.endedBy,active:r.duration.activeReferenceSeconds,wall:r.duration.wallSeconds,starts:Object.fromEntries(Object.entries(r.byTech).filter(([,t])=>t.started).map(([n,t])=>[n,t.started])),error:r.validity.executionFailure}));}
}
