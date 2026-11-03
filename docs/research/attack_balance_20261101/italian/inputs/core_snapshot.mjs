// Observation only. Preserves game callbacks, random calls, physics and damage.
import { strokeTechOf } from '../../src/unique_assist.js';
import { TIME, realS } from '../../src/config.js';
export const BASE='88a96061e8dd93e8f107b7b0df647a341e73fa5d';
export const fnum=v=>Number.isFinite(v)?v:null;
export function snapshot(f){return {
 alive:f.alive,state:f.state,blood:fnum(f.blood),consciousness:fnum(f.consciousness),pain:fnum(f.pain),
 cause:f.causeOfDeath??null,limbs:{...f.limbs},armed:!!f.armed,weaponBroken:!!f.weaponBroken,
 wounds:f.wounds?.length??0,stamina:{value:f.stamina.value,max:f.stamina.max,spent:{...f.stamina.spent},recovered:f.stamina.recovered,counts:{...f.stamina.counts}},
 };}
const sum=o=>Object.values(o??{}).reduce((a,v)=>a+(Number.isFinite(v)?v:0),0);
const skillState=f=>({tech:strokeTechOf(f)??null,iai:f.iai?.tech??null,secret:f.skill?.secretPhase??null,tap:!!f.skill?.tap,swing:!!f.skill?.swinging,unique:!!(f.skill?.uniq?.running||f.skill?.uniq?.holdsHand),state:f.state});
export function observeRound(G,meta={}){
 const P=G.player,E=G.enemy;P.humanInput=true;
 const events=[],states=[],requests=[],initial={player:snapshot(P),enemy:snapshot(E)};
 const stateChanges=[],lastStates=new Map([[P,P.state],[E,E.state]]),minima={player:P.stamina.value,enemy:E.stamina.value};
 const uq=P.skill.uniq;let lastSkill='',lastFires={};let nextSample=0;let done=false;
 const sname=f=>f===P?'player':f===E?'enemy':'other';
 const old=G.combat.hooks.onWound;
 G.combat.hooks.onWound=function(att,vic,r,point,pr){
   old?.(att,vic,r,point,pr);
   events.push({kind:'contact',t:G.t,attacker:sname(att),victim:sname(vic),tech:strokeTechOf(att)??att.iai?.tech??(att.skill?.secretPhase?'secret':att.skill?.tap?'tap':'basic'),part:pr?.v?.part??null,zone:r.zone,type:r.type,energy:fnum(r.energy),severity:fnum(r.severity),bleedPerSev:fnum(r.bleedPerSev),schoolK:fnum(r.schoolK),blocked:!!r.helmet,point:point?{x:point.x,y:point.y,z:point.z}:null});
 };
 for(const name of ['requestArtDup','requestArtThrust','requestArtRedondo','requestArtFold','requestArtSnap','requestCombo','requestIai','requestSpin']){
  if(typeof P[name]!=='function')continue;const fn=P[name];
  P[name]=function(...args){const r=fn.apply(this,args);requests.push({t:G.t,name,result:typeof r==='boolean'?r:null});return r;};
 }
 for(const f of [P,E]){
  for(const name of ['knockDown','dropSword']){
   if(typeof f[name]!=='function')continue;const fn=f[name];
   f[name]=function(...args){const was={alive:this.alive,state:this.state,armed:!!this.armed};const r=fn.apply(this,args);if(name==='knockDown'&&was.state==='stand'&&this.state!=='stand'||name==='dropSword'&&was.armed&&!this.armed)events.push({kind:name,t:G.t,who:sname(this),aliveBefore:was.alive,state:this.state});return r;};
  }
 }
 function tick(){
   minima.player=Math.min(minima.player,P.stamina.value);minima.enemy=Math.min(minima.enemy,E.stamina.value);
   const st=skillState(P),key=JSON.stringify(st);
   if(key!==lastSkill){stateChanges.push({t:G.t,...st});lastSkill=key;}
   for(const [name,n] of Object.entries(uq?.stats?.fired??{}))if(n>(lastFires[name]??0)){events.push({kind:'unique-start',t:G.t,tech:name,count:n-(lastFires[name]??0),distance:P.foeDistance()});lastFires[name]=n;}
   for(const f of [P,E])if(f.state!==lastStates.get(f)){events.push({kind:'state',t:G.t,who:sname(f),from:lastStates.get(f),to:f.state,cause:f.causeOfDeath??null});lastStates.set(f,f.state);}
   if(G.t>=nextSample){states.push({t:G.t,distance:P.foeDistance(),P:{blood:P.blood,consciousness:P.consciousness,stamina:P.stamina.value,state:P.state,active:!!(P.iai||P.skill.tap||P.skill.sec||uq?.running)},E:{blood:E.blood,consciousness:E.consciousness,stamina:E.stamina.value,state:E.state}});nextSample=G.t+realS(.2);}
 }
 const step=G.step;G.step=()=>{step();tick();};
 function outcome(who){const f=who==='player'?P:E,a=initial[who],b=snapshot(f),hits=events.filter(e=>e.kind==='contact'&&e.victim===who);return {
   severity:hits.reduce((v,e)=>v+(e.severity??0),0),cutStabSeverity:hits.filter(e=>e.type!=='blunt').reduce((v,e)=>v+(e.severity??0),0),contacts:hits.length,
   bloodLost:a.blood==null||b.blood==null?null:a.blood-b.blood,consciousnessLost:a.consciousness==null||b.consciousness==null?null:a.consciousness-b.consciousness,
   limbsLost:Object.fromEntries(Object.keys(a.limbs).map(k=>[k,(a.limbs[k]??0)-(b.limbs[k]??0)])),dead:!b.alive,cause:b.cause,
   knockdowns:events.filter(e=>e.kind==='knockDown'&&e.who===who&&e.aliveBefore).length,disarms:events.filter(e=>e.kind==='dropSword'&&e.who===who&&e.aliveBefore).length,
   parts:hits.reduce((o,e)=>(o[e.part??e.zone]=(o[e.part??e.zone]??0)+1,o),{}),end:b};}
 return {events,requests,states,tick,finish(extra={}){
  if(done)throw new Error('Recorder already finalized');done=true;
  const starts=events.filter(e=>e.kind==='unique-start'&&e.tech===meta.tech),activeChanges=stateChanges.filter(e=>e.iai===meta.tech||e.tech===meta.tech);
  const hit=events.find(e=>e.kind==='contact'&&e.attacker==='player'&&e.tech===meta.tech);
  return {build:BASE,...meta,controller:meta.controller??'scripted-player-input-proxy',humanInput:P.humanInput,gear:{maxStamina:P.stamina.max,bonus:P.stamina.maxBonus,infinite:P.stamina.infinite},limitsPreserved:true,
    observed:{gameSeconds:G.t,referenceSeconds:G.t/TIME.k},initial,inflicted:outcome('enemy'),received:outcome('player'),
    stamina:{spent:{...P.stamina.spent},totalSpent:sum(P.stamina.spent),recovered:P.stamina.recovered,min:minima.player,exhaustions:P.stamina.counts.exhaustion},
    requests,started:starts.reduce((a,e)=>a+e.count,0),timeline:{firstStart:starts[0]?.t??activeChanges[0]?.t??null,firstBodyContact:hit?.t??null},
    fired:{...(uq?.stats?.fired??{})},events,states,stateChanges,...extra};
 }};
}
export const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
export function summary(rows){const by={};for(const r of rows){const k=[r.tech,r.variant,r.mode,r.range??'all',r.inputProfile??''].join('/');(by[k]??=[]).push(r);}return Object.fromEntries(Object.entries(by).map(([key,a])=>[key,{n:a.length,started:a.reduce((s,r)=>s+(r.started??0),0),fired:a.reduce((s,r)=>s+(r.fired?.[r.tech]??0),0),dealtMean:mean(a.map(r=>r.inflicted.severity)),receivedMean:mean(a.map(r=>r.received.severity)),dealtConsciousnessMean:mean(a.map(r=>r.inflicted.consciousnessLost??0)),enemyDead:a.filter(r=>r.inflicted.dead).length,playerDead:a.filter(r=>r.received.dead).length,staminaMean:mean(a.map(r=>r.stamina.totalSpent)),valid:a.filter(r=>r.validity?.valid!==false).length}]))}
