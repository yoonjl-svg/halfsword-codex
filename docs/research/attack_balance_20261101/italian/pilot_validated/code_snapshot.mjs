// Italian I7/I2/I9 research. Observation and deterministic Node Input proxy only.
import { mkdirSync, appendFileSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { newRound, CONFIG, DT } from './harness_m.mjs';
import { observeRound, snapshot, summary, mean } from './balance_core_20261101.mjs';
import { PlayerUniqueAssist, strokeTechOf } from '../../src/unique_assist.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { Input } from '../../src/input.js';
import { allNodeIds, kitFromNodes } from '../../src/skill_tree_data.js';
import { TECH_BY_NAME } from '../../src/ai_techniques.js';
import { LOOKS } from '../../src/looks.js';
import { isMain } from './is_main.mjs';

const K = CONFIG.TIME.k, FRAME = 2 * DT;
const BUILD = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const HASH = createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex');
const TECHS = ['imbroccata', 'cavazione', 'inquartata'];
const RANGES = { imbroccata: { close: 1.15, normal: 1.55, edge: 1.95 }, cavazione: { close: 1.1, normal: 1.45, edge: 1.8 }, inquartata: { close: 1.15, normal: 1.55, edge: 1.95 } };
const PROFILES = {
 exact: { startSigma: 0, angleSigma: 0, endSigma: 0, speedSigma: 0, cavDelay: .45, delaySigma: 0, inqReaction: .1, side: .9, sideSigma: 0, stickLead: .05, leadSigma: 0, tapHold: .055, holdSigma: 0, driftPx: 0 },
 small: { startSigma: .06, angleSigma: .1, endSigma: .035, speedSigma: .35, cavDelay: .45, delaySigma: .09, inqReaction: .1, side: .9, sideSigma: .13, stickLead: .05, leadSigma: .025, tapHold: .055, holdSigma: .018, driftPx: 3 },
 large: { startSigma: .2, angleSigma: .45, endSigma: .16, speedSigma: 1.8, cavDelay: .45, delaySigma: .45, inqReaction: .1, side: .65, sideSigma: .55, stickLead: .05, leadSigma: .12, tapHold: .08, holdSigma: .15, driftPx: 14 },
};
const canvas = { addEventListener() {} };
const inputWindow = { innerWidth: 844, innerHeight: 390, addEventListener() {}, location: { search: '' } };
function inputEnv(fn) {
 const had = Object.hasOwn(globalThis, 'window'), old = globalThis.window;
 globalThis.window = inputWindow;
 try { return fn(); } finally { if (had) globalThis.window = old; else delete globalThis.window; }
}
globalThis.document ??= { pointerLockElement: null };
globalThis.matchMedia ??= () => ({ matches: true });
const qn = n => Number.isFinite(n) ? +n.toFixed(7) : null;
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
function rng(seed) { let a = seed >>> 0; const r = () => ((a = (Math.imul(a,1664525)+1013904223)>>>0)/4294967296); r.g = () => Math.sqrt(-2*Math.log(1-r()))*Math.cos(2*Math.PI*r()); return r; }
function pose(f) {
 return { health: snapshot(f), bleed: f.bleed, handOffset: { x: f.handOffset.x,y:f.handOffset.y }, stick: { x:f.stickX,y:f.stickY },
  bodies:Object.fromEntries(Object.entries(f.bodies).map(([n,b])=>[n,{p:b.translation(),q:b.rotation(),v:b.linvel()}])),
  iai:f.iai?{tech:f.iai.tech,t:f.iai.t,maxT:f.iai.maxT}:null,flowRecovery:f.flowRecovery?{...f.flowRecovery}:null };
}
const nowTech=f=>strokeTechOf(f)??f.iai?.tech??null;
const controlBusy=f=>!!(f.skill.sec||f.skill.tap||f.skill.pom||f.skill.vitalRange||f.iai||f.iaiReq||f.iaiHoldT>0);

export function runTrial({ tech='imbroccata',variant='on',range='normal',seed=401,inputProfile='exact',mode='single',perks=true,gap=null,maxSeconds=15,foePolicy=null }={}) {
 if(!TECHS.includes(tech)||!PROFILES[inputProfile])throw new Error('Unknown trial');
 const wall0=performance.now(), rnd=rng(seed*7919+31), profile=PROFILES[inputProfile];
 const kit=kitFromNodes('italian',allNodeIds('italian'));
 // Keep normal support/perks. Only the target attack is removed for the paired decomposition.
 if(variant==='off')kit.unique.delete(tech);
 if(!perks)kit.perk.delete('cavazione');
 const startGap=gap??RANGES[tech][range];
 const policy=foePolicy??(tech==='inquartata'?'single_stroke_proxy':'passive_guard');
 const G=newRound({seed,weapon:'rapier',weapon2:'longsword',gap:startGap,kit,walls:true,look:LOOKS.player,look2:LOOKS.enemy,persona:{proficiency:3},onFighter(f){if(f.index===0)f.humanInput=true;}});
 const P=G.player,E=G.enemy;
 P.skill.autoGuard=true;
 const uq=new PlayerUniqueAssist(P,{names:kit.unique}), guard=new PlayerParryGuard(P,E);P.stamina.controller=guard;
 const input=inputEnv(()=>new Input(canvas));input.enabled=true;
 const rec=observeRound(G,{school:'italian',tech,variant,range,seed,mode,inputProfile,controller:'Node_Input.onDown/onMove/onUp_and_Input.move_proxy',scriptHash:HASH});
 const extras={buildObserved:BUILD,attempted:0,requestAccepted:0,executed:0,conditionEpisodes:0,allTouchEpisodes:0,inputTrace:[],conditionTrace:[],executionTrace:[],physiology:[],snapshots:{},limits:{...CONFIG.UNIQUE_ASSIST.secretUses},
  settings:{startGap,foePolicy:policy,enemyWeapon:'longsword',playerWeapon:'rapier',freshBodies:true,normalDamage:true,oneTargetAttempt:true,noConfigMutation:true,
   kit:{...kit,unique:[...kit.unique],perk:[...kit.perk]},perks,profile,DT,FRAME,TIME:{...CONFIG.TIME},humanRecoveryPerReferenceSecond:CONFIG.STAMINA.humanRecoverPerSecond*K,
   specialCooldown:CONFIG.UNIQUE_ASSIST.specialCooldown,specialCoolFrom:CONFIG.UNIQUE_ASSIST.specialCoolFrom,cavFrom:CONFIG.UNIQUE_ASSIST.cavFrom,cavTo:CONFIG.UNIQUE_ASSIST.cavTo,
   cavSpeed:CONFIG.UNIQUE_ASSIST.cavSpeed,cavSpeedMul:CONFIG.UNIQUE_ASSIST.cavSpeedMul,cavSelfFree:CONFIG.UNIQUE_ASSIST.cavSelfFree,cavArmSlow:CONFIG.UNIQUE_ASSIST.cavArmSlow,
   inqThreat:CONFIG.UNIQUE_ASSIST.inqThreat,specialShare:CONFIG.UNIQUE_ASSIST.specialShare.inquartata,cavSnapTime:CONFIG.UNIQUE_ASSIST.cavSnapTime,inqSnapTime:CONFIG.UNIQUE_ASSIST.inqSnapTime,
   initialArmor:{player:P.helmetType??null,enemy:E.helmetType??null},inputDimensions:{width:844,height:390,verticalGain:input.mobileIntent.verticalGain},
   excludedPaths:['secret watch/execution to isolate the assigned attack','browser hit-stop and render loop','trusted DOM event dispatch and joystick DOM geometry'],maxReferenceSeconds:maxSeconds},
  timelineExtra:{},conditionPreparation:{touchSteps:0,threatSteps:0,excludedCutTouches:0},checkpoints:{},denominators:{},attribution:{},failureReasons:[]};
 const emit=(kind,data={})=>extras.inputTrace.push({kind,tGame:qn(G.t),tReference:qn(G.t/K),...data});
 const capture=name=>{if(!extras.snapshots[name])extras.snapshots[name]={tGame:G.t,tReference:G.t/K,distance:P.foeDistance(),player:pose(P),enemy:pose(E)};};
 capture('initial');
 let targetAttemptT=null,targetRequestT=null,startT=null,motionEndT=null,recoveryT=null,enemyDeadT=null,playerDeadT=null;
 let queue=[],preparing=false,attemptComplete=false,frames=0,px=620,py=180,hand=false,tap=null,due=null,sideUntil=-Infinity,sideValue=0,sideStart=Infinity,seenTouch=null,seenThreat=0,wasMotion=false;
 const tapPlan={delay:tech==='cavazione'?Math.max(0,profile.cavDelay+rnd.g()*profile.delaySigma):Math.max(0,profile.inqReaction+rnd.g()*profile.delaySigma),
  hold:clamp(profile.tapHold+rnd.g()*profile.holdSigma,.008,.4),driftX:rnd.g()*profile.driftPx,driftY:rnd.g()*profile.driftPx,
  side:clamp(profile.side+rnd.g()*profile.sideSigma,0,1)*(rnd()<.5?-1:1),lead:profile.stickLead+rnd.g()*profile.leadSigma};
 extras.settings.sampledInput=tapPlan;
 const event=(kind,dx=0,dy=0)=>{
  const time=Math.max(1,G.t/K*1000),base={pointerId:1,pointerType:'touch',button:0,timeStamp:time,type:kind,clientX:px,clientY:py};
  if(kind==='pointerdown'){inputEnv(()=>input.onDown(base));hand=true;}
  else if(kind==='pointerup'){inputEnv(()=>input.onUp(base));hand=false;}
  else {const s=CONFIG.INPUT.touchSensitivity/390;px+=dx/s;py-=dy/(s*input.mobileIntent.verticalGain);inputEnv(()=>input.onMove({...base,clientX:px,clientY:py}));}
  emit(kind,{dx,dy,clientX:px,clientY:py,untrustedNodeEvent:true});
 };
 const attempt=(why)=>{if(extras.attempted)return;extras.attempted++;if(tech==='imbroccata')extras.conditionEpisodes++;targetAttemptT=G.t;capture('targetInput');emit('target_attempt',{why});};
 const launch0=uq.launchTap;
 uq.launchTap=function(e,...args){const result=launch0.call(this,e,...args);extras.executionTrace.push({kind:'launch_request',tech:e.name,t:G.t,result:!!result,queued:P.iaiReq?.tech??null});if(e.name===tech&&result){extras.requestAccepted++;targetRequestT??=G.t;}return result;};
 const start0=uq.start;
 uq.start=function(e,...args){const result=start0.call(this,e,...args);extras.executionTrace.push({kind:'enhancement_request',tech:e.name,t:G.t,active:this.r?.e?.name??null});if(e.name===tech){extras.requestAccepted++;targetRequestT??=G.t;}return result;};
 const thrust0=P.skill.thrust;
 P.skill.thrust=function(...args){const before={busy:controlBusy(P),touch:uq.touch?{...uq.touch,n:null}:null,noThreat:guard.noThreat,threatId:guard.threatId,stickX:P.stickX,stickY:P.stickY,cooling:uq.coolLeft?.(tech)??null};const r=thrust0.apply(this,args);extras.executionTrace.push({kind:'thrust_request',t:G.t,result:!!r,before});return r;};
 for(const [who,f]of[['player',P],['enemy',E]]){
  const original=f.applyWound;
  f.applyWound=function(h){const before=snapshot(this),b0=this.bleed;const r=original.call(this,h),after=snapshot(this);extras.physiology.push({t:G.t,who,attacker:who==='enemy'?'player':'enemy',tech:nowTech(who==='enemy'?P:E),part:h.part,zone:h.zone,type:h.type,severity:h.severity,energy:h.energy,helmet:!!h.helmet,plate:!!h.plate,actualWounds:after.wounds-before.wounds,bleedAdded:this.bleed-b0,consciousnessLost:before.consciousness-after.consciousness,limbsLost:Object.fromEntries(Object.keys(before.limbs).map(k=>[k,(before.limbs[k]??0)-(after.limbs[k]??0)])),died:before.alive&&!after.alive});return r;};
 }
 const clash0=G.combat.hooks.onClash;
 G.combat.hooks.onClash=(p,v,info)=>{clash0?.(p,v,info);extras.conditionTrace.push({kind:'actual_clash',t:G.t,fresh:!!info?.fresh,speed:v,vn:info?.vn});};
 if(policy==='passive_guard')G.ai.update=()=>{E.move.set(0,0);const dest=tech==='imbroccata'?[0,-.5]:[0,.03];const step=CONFIG.SKILL.recoverSpeed*DT;const dx=dest[0]-E.handOffset.x,dy=dest[1]-E.handOffset.y,d=Math.hypot(dx,dy);if(d>0){const k=Math.min(1,step/d);E.handOffset.x+=dx*k;E.handOffset.y+=dy*k;E.skill.prev.x+=dx*k;E.skill.prev.y+=dy*k;}};
 if(policy==='single_stroke_proxy'){
  let phase='prepare',path=TECH_BY_NAME.zornhau.path.map(p=>p.slice()),charged=false;
  extras.settings.opponentInput={controller:'Node hand-target proxy',tech:'zornhau',from:TECH_BY_NAME.zornhau.from,path,speed:4,move:{x:0,y:0},attempts:1};
  G.ai.update=()=>{
   E.move.set(0,0);
   if(E.openHold||!E.alive||!E.armed)return;
   const target=phase==='prepare'?TECH_BY_NAME.zornhau.from:path[0];
   if(!target)return;
   const dx=target[0]-E.handOffset.x,dy=target[1]-E.handOffset.y,d=Math.hypot(dx,dy),step=(phase==='prepare'?CONFIG.SKILL.recoverSpeed:4)*DT,k=d?Math.min(1,step/d):1;
   E.handOffset.x+=dx*k;E.handOffset.y+=dy*k;
   if(phase==='prepare'){E.skill.prev.x+=dx*k;E.skill.prev.y+=dy*k;}
   if(d<=step){if(phase==='prepare'){phase='strike';if(!charged){E.stamina.attack('cut');charged=true;}extras.conditionTrace.push({kind:'opponent_real_stroke',t:G.t,tech:'zornhau'});}else path.shift();}
  };
 }
 function makeImbro(){
  let hx=P.handOffset.x,hy=P.handOffset.y;const out=[];
  const T=TECH_BY_NAME.oberhau,from=[T.from[0]+rnd.g()*profile.startSigma,T.from[1]+rnd.g()*profile.startSigma];
  const to=(p,speed,phase)=>{for(let i=0;i<500;i++){const dx=p[0]-hx,dy=p[1]-hy,d=Math.hypot(dx,dy);if(d<1e-7)break;const k=Math.min(d,speed*FRAME)/d;out.push({dx:dx*k,dy:dy*k,phase});hx+=dx*k;hy+=dy*k;}};
  to(from,CONFIG.SKILL.recoverSpeed,'prepare');out.push(...Array.from({length:6},()=>({dx:0,dy:0,phase:'prepare'})));
  const angle=rnd.g()*profile.angleSigma,speed=clamp(4+rnd.g()*profile.speedSigma,.5,8),c=Math.cos(angle),s=Math.sin(angle);
  for(const p of T.path){const dx=p[0]-T.from[0],dy=p[1]-T.from[1];to([from[0]+dx*c-dy*s+rnd.g()*profile.endSigma,from[1]+dx*s+dy*c+rnd.g()*profile.endSigma],speed,'target');}
  extras.settings.sampledStroke={from,angle,speed};return out;
 }
 G.before=()=>{
  const tr=G.t/K;
  guard.step(DT);
  if(P.feel?.touching)extras.conditionPreparation.touchSteps++;
  if(guard.noThreat===0)extras.conditionPreparation.threatSteps++;
  const C=uq.touch;
  if(C&&C!==seenTouch){seenTouch=C;extras.allTouchEpisodes++;extras.conditionTrace.push({kind:'touch_episode',t:G.t,t0:C.t0,t1:C.t1,cut:C.cut});if(tech==='cavazione'&&!extras.attempted&&!C.cut&&!P.openHold){extras.conditionEpisodes++;if(due==null){due=G.t+tapPlan.delay*K;capture('condition');}}}
  if(guard.threatId!==seenThreat){seenThreat=guard.threatId;if(tech==='inquartata'&&due==null&&!extras.attempted&&!P.openHold){extras.conditionEpisodes++;due=G.t+tapPlan.delay*K;sideStart=due-tapPlan.lead*K;sideUntil=due+.4*K;sideValue=tapPlan.side;extras.conditionTrace.push({kind:'threat_episode',t:G.t,threatId:seenThreat,noThreat:guard.noThreat});capture('condition');}}
  if((frames++&1)!==0)return;
  if(!P.openHold&&extras.snapshots.prepare==null)capture('prepare');
  if(tech==='imbroccata'&&!P.openHold&&!preparing){preparing=true;queue=makeImbro();event('pointerdown');capture('prepare');}
  if(tech==='cavazione'&&!P.openHold&&extras.snapshots.prepare==null)capture('prepare');
  if(queue.length){const f=queue.shift();if(f.phase==='target')attempt('downward stroke');event('pointermove',f.dx,f.dy);if(!queue.length){event('pointerup');attemptComplete=true;}}
  if(due!=null&&!extras.attempted&&G.t>=due){attempt(tech==='cavazione'?'tap after actual blade contact':'tap after actual threat');event('pointerdown');tap={upAt:G.t+tapPlan.hold*K,moved:false};due=null;}
  if(tap&&!tap.moved&&G.t>=tap.upAt-.02*K){tap.moved=true;const scale=CONFIG.INPUT.touchSensitivity/390;event('pointermove',tapPlan.driftX*scale,-tapPlan.driftY*scale*input.mobileIntent.verticalGain);}
  if(tap&&G.t>=tap.upAt){event('pointerup');tap=null;attemptComplete=true;}
  const d=input.consumeHandDelta();let taps=input.consumeTaps();
  if(!Number.isFinite(d.x)||!Number.isFinite(d.y))throw new Error('Nonfinite input');
  if(P.stamina.exhausted){d.x=d.y=0;taps=0;}
  const swipe=Math.hypot(d.x,d.y)/FRAME>=CONFIG.SKILL.swingSpeed;
  // Same guard/feed/tap ordering as main.js playerInputFrame, without its secret watcher.
  guard.held=tech==='cavazione'&&!extras.attempted&&!P.openHold;
  if(guard.broken&&(!guard.held||(!P.skill.swinging&&!P.skill.tap&&!swipe&&taps===0)))guard.broken=false;
  if(guard.held&&(swipe||taps>0))guard.broken=true;
  const guardHold=guard.held&&!guard.broken&&!P.stamina.exhausted;
  uq.feed(d.x,d.y,FRAME,guardHold||guard.held,guardHold);
  if(!guardHold&&!P.stamina.exhausted){P.handOffset.x+=d.x;P.handOffset.y+=d.y;}
  P.handHeld=hand;P.inputActive=Math.abs(d.x)+Math.abs(d.y)>1e-5;
  if(taps>0&&!P.stamina.exhausted){emit('Input_consumed_tap',{taps});P.skill.thrust();}
  input.stickMove={x:G.t>=sideStart&&G.t<sideUntil?sideValue:0,y:0};
  const m=input.move;P.move.set(m.x,m.y);P.stickX=m.x;P.stickY=m.y;
  emit('input_frame',{dx:d.x,dy:d.y,taps,stickX:m.x,stickY:m.y,guardHeld:guard.held,guardActive:guard.active,hand});
 };
 try{
  while(G.t/K<maxSeconds){
   if(typeof globalThis.window!=='undefined')throw new Error('window shim leaked into world step');
   G.step();
   const motion=P.iai?.tech===tech||uq.r?.e?.name===tech||P.skill.tap?.uniqTech===tech;
   if(motion&&!wasMotion){extras.executed++;startT??=G.t;capture('executionStart');extras.executionTrace.push({kind:'actual_motion_start',t:G.t,tech});}
   if(!motion&&wasMotion){motionEndT=G.t;capture('motionEnd');extras.executionTrace.push({kind:'actual_motion_end',t:G.t,tech});}
   wasMotion=motion;
   if(startT!=null&&motionEndT!=null&&recoveryT==null&&!controlBusy(P)){recoveryT=G.t;capture('controlRecovery');}
   if(!E.alive&&enemyDeadT==null)enemyDeadT=G.t;
   if(!P.alive&&playerDeadT==null)playerDeadT=G.t;
   for(const sec of[1,5]){if(startT!=null&&G.t>=startT+sec*K&&!extras.checkpoints[sec]){extras.checkpoints[sec]={t:G.t,player:snapshot(P),enemy:snapshot(E)};capture('after'+sec+'s');}}
   if(extras.attempted&&attemptComplete&&G.t>targetAttemptT+6*K&&(!controlBusy(P)||!P.alive))break;
   if(!extras.attempted&&(!P.alive||!E.alive))break;
  }
  capture('end');
  const targetHits=extras.physiology.filter(e=>e.who==='enemy'&&e.tech===tech);
  const perPhase={};
  for(const who of['player','enemy']){perPhase[who]={};for(const phase of['preparation','target','recovery_or_other']){const a=extras.physiology.filter(e=>e.who===who&&(phase==='preparation'?targetAttemptT==null||e.t<targetAttemptT:phase==='target'?e.tech===tech&&e.t>=(targetAttemptT??Infinity):e.t>=(targetAttemptT??Infinity)&&e.tech!==tech));perPhase[who][phase]={contacts:a.length,actualWounds:a.reduce((s,e)=>s+Math.max(0,e.actualWounds),0),severity:a.filter(e=>e.type!=='blunt'&&e.actualWounds>0).reduce((s,e)=>s+e.severity,0),consciousnessLost:a.reduce((s,e)=>s+e.consciousnessLost,0),bleedAdded:a.reduce((s,e)=>s+e.bleedAdded,0)};}}
  extras.attribution=perPhase;
  const recvTiming={};
  for(const phase of['preparation','execution','recovery']){const a=extras.physiology.filter(e=>e.who==='player'&&(phase==='preparation'?targetAttemptT==null||e.t<targetAttemptT:phase==='execution'?e.t>=(targetAttemptT??Infinity)&&e.t<=(motionEndT??targetAttemptT):e.t>(motionEndT??targetAttemptT??Infinity)));recvTiming[phase]={contacts:a.length,actualWounds:a.reduce((s,e)=>s+Math.max(0,e.actualWounds),0),severity:a.filter(e=>e.type!=='blunt'&&e.actualWounds>0).reduce((s,e)=>s+e.severity,0),consciousnessLost:a.reduce((s,e)=>s+e.consciousnessLost,0),bleedAdded:a.reduce((s,e)=>s+e.bleedAdded,0)};}
  extras.receivedByTime=recvTiming;
  extras.timelineExtra={attempt:targetAttemptT,request:targetRequestT,start:startT,motionEnd:motionEndT,controlRecovery:recoveryT,enemyDeath:enemyDeadT,playerDeath:playerDeadT};
  extras.denominators={freshTrial:1,conditionEpisode:extras.conditionEpisodes,attempt:extras.attempted,requestAccepted:extras.requestAccepted,executed:extras.executed,targetBodyContacts:targetHits.length,targetRealWounds:targetHits.reduce((s,e)=>s+Math.max(0,e.actualWounds),0)};
  extras.conditionPreparation.excludedCutTouches=uq.stats.touchCut??0;
  if(!extras.attempted)extras.failureReasons.push(tech==='cavazione'?'no_qualifying_real_blade_contact':tech==='inquartata'?'no_live_threat_opportunity':'no_input_attempt');
  if(extras.attempted&&!extras.requestAccepted&&variant==='on'){const req=extras.executionTrace.filter(e=>e.kind==='thrust_request').at(-1);if(req?.before.busy)extras.failureReasons.push('busy_at_request');if(req?.before.touch?.cut)extras.failureReasons.push('contact_excluded_as_cut');if((uq.stats.tapEarly??0)>0)extras.failureReasons.push('early_tap_spent_contact');if(!extras.inputTrace.some(e=>e.kind==='Input_consumed_tap')&&tech!=='imbroccata')extras.failureReasons.push('pointer_gesture_not_read_as_tap');if(tech==='inquartata'&&Math.abs(tapPlan.side)<.5)extras.failureReasons.push('side_input_below_threshold');if(!extras.failureReasons.length)extras.failureReasons.push('condition_or_input_not_accepted');}
  if(extras.requestAccepted&&!extras.executed)extras.failureReasons.push('accepted_without_observed_motion');
  if(extras.executed&&!targetHits.length)extras.failureReasons.push('motion_without_body_contact');
  extras.wallSeconds=(performance.now()-wall0)/1000;
  const result=rec.finish(extras);result.validity={valid:P.humanInput&&CONFIG.STAMINA.humanRecoverPerSecond*K===25&&BUILD.startsWith('88a96061'),normalDamage:true,windowShimDuringWorldStep:typeof globalThis.window!=='undefined'?true:false,noForcedConditions:true,requestIsNotExecution:true};
  return result;
 }finally{G.world.free();}
}

function aggregate(rows){
 const common=summary(rows),by={};
 for(const r of rows){const key=[r.tech,r.mode,r.range,r.inputProfile,r.variant].join('/');(by[key]??=[]).push(r);}
 const metrics=Object.fromEntries(Object.entries(by).map(([key,a])=>[key,{n:a.length,conditionTrials:a.filter(r=>r.conditionEpisodes>0).length,attempts:a.reduce((s,r)=>s+r.attempted,0),accepted:a.reduce((s,r)=>s+r.requestAccepted,0),executed:a.reduce((s,r)=>s+r.executed,0),bodyContactTrials:a.filter(r=>r.denominators.targetBodyContacts>0).length,realWoundTrials:a.filter(r=>r.denominators.targetRealWounds>0).length,targetSeverityMean:mean(a.map(r=>r.attribution.enemy.target.severity)),preparationSeverityMean:mean(a.map(r=>r.attribution.enemy.preparation.severity)),receivedSeverityMean:mean(a.map(r=>r.received.cutStabSeverity)),staminaMean:mean(a.map(r=>r.stamina.totalSpent)),deaths:a.filter(r=>r.inflicted.dead).length,playerDeaths:a.filter(r=>r.received.dead).length,wallSeconds:a.reduce((s,r)=>s+r.wallSeconds,0),failures:a.reduce((o,r)=>{for(const f of r.failureReasons)o[f]=(o[f]??0)+1;return o;},{})}]));
 const pairs=[];for(const on of rows.filter(r=>r.variant==='on')){const off=rows.find(r=>r.variant==='off'&&r.tech===on.tech&&r.seed===on.seed&&r.range===on.range&&r.mode===on.mode&&r.inputProfile===on.inputProfile);if(off)pairs.push({tech:on.tech,range:on.range,seed:on.seed,onExecuted:on.executed,offExecuted:off.executed,dealtSeverityDifference:on.inflicted.cutStabSeverity-off.inflicted.cutStabSeverity,receivedSeverityDifference:on.received.cutStabSeverity-off.received.cutStabSeverity,onTargetSeverity:on.attribution.enemy.target.severity,offTotalSeverity:off.inflicted.cutStabSeverity,staminaDifference:on.stamina.totalSpent-off.stamina.totalSpent,inputSchedulesSame:JSON.stringify(on.settings.sampledInput)===JSON.stringify(off.settings.sampledInput),opportunityTimeDifference:on.timelineExtra.attempt!=null&&off.timelineExtra.attempt!=null?(on.timelineExtra.attempt-off.timelineExtra.attempt)/K:null});}
 return {common,metrics,pairs,totalRows:rows.length,totalWallSeconds:rows.reduce((s,r)=>s+r.wallSeconds,0)};
}

if(isMain(import.meta.url)){
 const args=Object.fromEntries(process.argv.slice(3).map(s=>{const [k,...v]=s.replace(/^--/,'').split('=');return[k,v.join('=')];})),cmd=process.argv[2]??'pilot';
 const out=args.out??`docs/research/attack_balance_20261101/italian/${cmd}`;
 mkdirSync(out,{recursive:true});
 const schedule=[];
 if(cmd==='pilot')for(const tech of TECHS)schedule.push({tech,seed:401});
 else if(cmd==='matrix')for(const tech of TECHS)for(const range of['close','normal','edge'])for(let s=0;s<6;s++)for(const variant of['on','off'])schedule.push({tech,range,seed:501+s,variant});
 else if(cmd==='inputs')for(const tech of TECHS)for(const inputProfile of['exact','small','large'])for(let s=0;s<8;s++)schedule.push({tech,inputProfile,seed:601+s,mode:'input'});
 else if(cmd==='trial')schedule.push({tech:args.tech??'cavazione',seed:+(args.seed??401),range:args.range??'normal',inputProfile:args.profile??'exact',variant:args.variant??'on',gap:args.gap?+args.gap:null,foePolicy:args.foe??null,maxSeconds:+(args.seconds??15)});
 else throw new Error('pilot | matrix | inputs | trial');
 writeFileSync(`${out}/manifest.json`,JSON.stringify({command:process.argv,build:BUILD,scriptHash:HASH,created:new Date().toISOString(),schedule,profiles:PROFILES,ranges:RANGES,oneProcess:true},null,2));
 writeFileSync(`${out}/raw.jsonl`,'');const rows=[],begin=performance.now();
 for(const cfg of schedule){const r=runTrial(cfg);rows.push(r);appendFileSync(`${out}/raw.jsonl`,JSON.stringify(r)+'\n');writeFileSync(`${out}/summary.json`,JSON.stringify(aggregate(rows),null,2));process.stdout.write(JSON.stringify({n:rows.length,total:schedule.length,tech:r.tech,variant:r.variant,range:r.range,profile:r.inputProfile,seed:r.seed,condition:r.conditionEpisodes,attempt:r.attempted,accepted:r.requestAccepted,executed:r.executed,wounds:r.denominators.targetRealWounds,dealt:r.inflicted.cutStabSeverity,received:r.received.cutStabSeverity,wall:r.wallSeconds,failures:r.failureReasons})+'\n');}
 writeFileSync(`${out}/timing.json`,JSON.stringify({rows:rows.length,wallSeconds:(performance.now()-begin)/1000,finished:new Date().toISOString()},null,2));
}
