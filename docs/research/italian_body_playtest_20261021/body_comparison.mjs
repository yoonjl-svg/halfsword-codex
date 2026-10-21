import {newRound,DT,CONFIG,THREE} from './harness_m.mjs';
import {PlayerParryGuard} from '../../src/parry_button.js';
import {installBody} from '../../src/italian_body_research.js';
import {CHARACTERS} from '../../src/characters.js';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const baseline={...CONFIG.SKILL.itOppositionVals,window:Infinity,relaxedContact:false};
const variant=process.env.VARIANT??'strongBind';
const seeds=(process.env.SEEDS??'941,10304,11020,11021,11022,11023').split(',').map(Number);
const policies=(process.env.POLICIES??'hold,repress,counter,retreat').split(',');
const bron=CHARACTERS.find(c=>c.id==='bran');
const snap=f=>({alive:f.alive,armed:f.armed,cause:f.causeOfDeath,limbs:{...f.limbs},consciousness:f.consciousness,blood:f.blood,bleed:f.bleed,stamina:f.stamina.value,exhausted:f.stamina.exhausted,broken:f.weaponBroken});
function trial(seed,policy,body){
 const relaxed=true;
 CONFIG.SKILL.itOppositionVals={...baseline,...(relaxed?{relaxedContact:true,minVn:.2,maxGap:Infinity,injuryGrace:0}:{})};
 const g=newRound({weapon:'rapier',weapon2:'sain',seed,gap:2.2,look2:bron.look,difficulty:bron.ai.level,persona:{...bron.ai.persona,school:'sain'}}),p=g.player,a=g.enemy;
 p.skill.corr=CONFIG.SKILL.corr;p.skill.corrTip=CONFIG.SKILL.corrTip;p.skill.autoGuard=true;
 const guard=new PlayerParryGuard(p,a);p.stamina.controller=guard;const mod=installBody(p,a,guard,variant,body);
 // Identical practice attacker selection logic to the public lab; absent tech leaves native AI.
 const tech=g.ai.school.tech.find(t=>t.name==='zwerchL');
 if(tech){g.ai.pickTech=()=>tech;const update=g.ai.update.bind(g.ai);let next=.8;g.ai.update=dt=>{update(dt);const f=a,t=f.stamina.time;if(t>=next&&f.alive&&f.armed&&f.state==='stand'&&!f.stamina.exhausted&&g.ai.mode!=='attack'&&f.foeDistance()<2.3)if(g.ai.startAttack(tech,'research-practice',{noFeint:true,noPending:true}))next=t+2;};}
 const events=[],contacts=[],timeline=[],actions=[],deaths=[],breaks=[];
 const fingerprint=()=>createHash('sha256').update(JSON.stringify([p,a].map(f=>({state:f.state,health:snap(f),rbs:f.meshes.map(({rb})=>[rb.translation(),rb.rotation(),rb.linvel(),rb.angvel()])})))).digest('hex');
 for(const f of [p,a]){const apply=f.applyWound.bind(f);f.applyWound=h=>{const b=snap(f),ret=apply(h),e=snap(f);const limb=Object.keys(e.limbs).reduce((n,k)=>n+Math.max(0,b.limbs[k]-e.limbs[k]),0),con=Math.max(0,b.consciousness-e.consciousness),bleed=Math.max(0,e.bleed-b.bleed);if(limb||con||bleed||(h.severity??0)>0)events.push({t:g.t,vic:f.index,part:h.part,type:h.type,severity:h.severity??0,limb,con,bleed,autoRunning:!!mod.run,autoPush:p.skill.thrustPush,serial:mod.run?.serial??null});return ret;};}
 const clash=mod.onClash.bind(mod);mod.onClash=(att,h)=>{
  const cfg=CONFIG.SKILL.itOppositionVals,age=guard.clock-mod.pressed,st=a.stamina,approach=new THREE.Vector3().copy(p.bodies.chest.translation()).sub(a.bladePoint(1,new THREE.Vector3())).dot(a.tipVel);
  const blocked={eligible:!mod.eligible(),inactive:!guard.active,run:!!mod.run,used:mod.used,age:age<0||age>cfg.window,noAttack:!st.attackId,expiry:!relaxed&&st.time>st.attackUntil,duplicate:mod.usedAttacks.get(a)===st.attackId,injury:guard.clock-mod.lastInjury<cfg.injuryGrace,speed:h.vn<cfg.minVn,gap:p.foeDistance()>cfg.maxGap,direction:!relaxed&&approach<=0};
  const hash=fingerprint(),n=mod.starts,serial=mod.serial;
  clash(att,h);contacts.push({t:g.t,clock:guard.clock,vn:h.vn,gap:p.foeDistance(),approach,blocked,hash,fired:mod.starts>n,started:mod.serial>serial});
 };
 let prevHeld=false,lastCycle=-1,exhausted=[false,false],down=[false,false],broken=[false,false];
 g.before=()=>{
  const t=g.t,cycle=Math.floor(t/2.4),phase=t%2.4;
  let held=policy==='hold'||phase<1.9;
  p.move.set(0,0);p.stickX=p.stickY=0;
  if(policy==='repress'&&p.foeDistance()>1.6)p.move.y=.35;
  if(policy==='counter'&&p.foeDistance()>1.55)p.move.y=.45;
  if(policy==='retreat')p.move.y=phase<1.2?(p.foeDistance()<1.9?-.4:0):(p.foeDistance()>1.65?.35:0);
  if((policy==='counter'||policy==='retreat')&&phase>=1.95&&cycle!==lastCycle){lastCycle=cycle;actions.push({t,kind:'tap',accepted:p.skill.thrust()});}
  p.stickY=p.move.y;guard.held=held;guard.step(DT);p.inputActive=guard.active||!!p.skill.tap;
  if(held!==prevHeld){actions.push({t,kind:held?'press':'release'});prevHeld=held;}
 };
 const initial=fingerprint();
 for(let i=0;i<Math.round(30/DT);i++){
  const sampleBefore=mod.bodySamples.length;g.step();
  for(const sample of mod.bodySamples.slice(sampleBefore))sample.chestRotationAfterPhysics={...p.bodies.chest.rotation()};
  for(const f of [p,a]){const j=f.index;if(!f.alive&&!down[j]){deaths.push({t:g.t,vic:j,cause:f.causeOfDeath});down[j]=true;}if(f.weaponBroken&&!broken[j]){breaks.push({t:g.t,vic:j});broken[j]=true;}if(f.stamina.exhausted&&!exhausted[j])actions.push({t:g.t,kind:'exhaust',vic:j});exhausted[j]=f.stamina.exhausted;}
  if(i%12===0)timeline.push({t:g.t,p:snap(p),a:snap(a),held:guard.held,active:guard.active,gap:p.foeDistance()});
  if(!p.alive||!a.alive)break;
 }
 if(mod.run)mod.cancel('round-end');
 const row={variant,seed,policy,body,relaxed,initial,t:g.t,p:snap(p),a:snap(a),practiceTech:tech?.name??null,events,contacts,timeline,actions,deaths,breaks,triggers:mod.events,samples:mod.samples,bodySamples:mod.bodySamples};
 g.world.free();return row;
}
const rows=[];
for(const seed of seeds)for(const policy of policies)for(const body of [false,true]){const r=trial(seed,policy,body);rows.push(r);console.log(JSON.stringify({variant,seed,policy,body,t:r.t,starts:r.triggers.filter(x=>x.type==='start').length,pDead:!r.p.alive,aDead:!r.a.alive}));writeFileSync(process.env.OUT,JSON.stringify({variant,baseline,rows}));}
