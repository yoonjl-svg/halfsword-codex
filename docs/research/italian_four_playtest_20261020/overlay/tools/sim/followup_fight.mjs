import {newRound,DT} from './harness_m.mjs';
import {PlayerParryGuard} from '../../src/parry_button.js';
import {installFollowup as installBinding} from '../../src/italian_followup_research.js';
import {SKILL,ARENA} from '../../src/config.js';
import {writeFileSync} from 'node:fs';
const variant=process.env.VARIANT??'current',role=process.env.ROLE??'defender';
const W=(process.env.WEAPONS??'longsword,uchigatana,zweihander,qinggang,rapier,flamberge').split(',');
const snapshot=f=>({blood:f.blood,consciousness:f.consciousness,limbs:{...f.limbs},bleed:f.bleed,stamina:f.stamina.value,alive:f.alive,armed:f.armed,weaponBroken:f.weaponBroken,cause:f.causeOfDeath});
function trial(weapon,seed,delay){
 const defender=role==='defender',g=newRound({weapon:defender?'rapier':weapon,weapon2:defender?weapon:'rapier',seed,difficulty:'normal',gap:2.2});
 const p=g.player,a=g.enemy; p.skill.corr=SKILL.corr;p.skill.corrTip=SKILL.corrTip;p.skill.autoGuard=true;
 const guard=new PlayerParryGuard(p,a);p.stamina.controller=guard;
 let lastContact=-100; const mod=installBinding(p,a,guard,variant);const oc=g.combat.hooks.onClash;g.combat.hooks.onClash=(...args)=>{oc?.(...args);if(guard.held&&args[2]?.vn>.6)lastContact=g.t;};
 const diagnostics=[],frames=[], tipSamples=[];
 if(process.env.CAPTURE){const original=mod.onClash.bind(mod);mod.onClash=(...args)=>{const n=mod.starts;original(...args);if(mod.starts>n)diagnostics.push({t:guard.clock,point:p.feel.point.toArray(),fighters:[p,a].map(f=>({position:f.sword.translation(),rotation:f.sword.rotation(),root:f.bladePoint(0).toArray(),tip:f.bladePoint(1).toArray(),broken:f.weaponBroken,cfg:{hilt:f.weaponCfg.hiltLength,blade:f.weaponCfg.bladeLength}}))});};}
 const events=[],timeline=[];let firstCover=null,peakCover=0,coverTime=0;
 for(const f of [p,a]){const old=f.applyWound.bind(f);f.applyWound=h=>{const b=snapshot(f);const ret=old(h);const e=snapshot(f);const limb=Object.keys(e.limbs).reduce((n,k)=>n+Math.max(0,b.limbs[k]-e.limbs[k]),0);const con=Math.max(0,b.consciousness-e.consciousness),bleed=Math.max(0,e.bleed-b.bleed);if(limb||con||bleed||h.severity>0)events.push({t:g.t,vic:f.index,part:h.part,type:h.type,severity:h.severity??0,limb,con,bleed});return ret;};}
 let seen=false,away=0,pending=null,rip=null,taps=0,hits=0,tries=0,lastAttack=-9;
 let watchFast=false,quietBlade=1,pressAt=null;
 g.before=()=>{
  const now=g.t;const s=guard.sense; // observable blade velocity/position, no AI phase hooks.
  const tip=a.tipPrev,vel=a.tipVel,c=p.bodies.chest.translation();let approaching=0,sp=vel.length();
  if(tip)approaching=(c.x-tip.x)*vel.x+(c.y-tip.y)*vel.y+(c.z-tip.z)*vel.z;
  if(defender){
   if(sp>3.5&&approaching>0&&p.foeDistance()<3.2){if(quietBlade>.25)pressAt=now+delay;quietBlade=0;seen=true;away=0;pending=null;}else quietBlade+=DT;
   if(seen&&!rip&&!mod.run){away+=DT;if(away>.12&&pending===null)pending=now+delay;}
   if((process.env.POLICY!=='defensive'||now-lastContact<1.0)&&pending!==null&&now>=pending&&!rip&&!mod.run&&!p.skill.tap&&p.state==='stand'){rip={at:now,tap:null,w0:events.length};pending=null;seen=false;tries++;}
  }else if(!rip&&now>2.2&&now-lastAttack>1.6+delay&&p.state==='stand'){rip={at:now,tap:null,w0:events.length};tries++;}
  p.move.set(0,0);p.stickX=p.stickY=0;if(process.env.POLICY==='defensive'&&!rip&&p.foeDistance()>1.65){p.move.y=.35;p.stickY=.35;}guard.held=defender&&!rip&&pressAt!==null&&now>=pressAt&&(quietBlade<.40||!!mod.run);
  if(rip&&!mod.run){
   const target=p.swordArt?.measure?.reach??1.6;
   if(p.foeDistance()>target-.05){p.move.set(0,.8);p.stickY=.8;}
   if(rip.tap===null&&p.foeDistance()<=target&&p.skill.thrust()){rip.tap=now;taps++;}
   const hit=events.slice(rip.w0).some(e=>e.vic===1&&e.severity>0);
   if(hit||(rip.tap!==null&&now-rip.tap>.65)||now-rip.at>1.4||!p.alive){if(hit)hits++;lastAttack=now;rip=null;guard.held=defender;p.move.set(0,0);p.stickY=0;}
  }
  const start=mod.events.find(e=>e.type==='start');
  if(process.env.AFTER==='retreat'&&start&&now-start.t>=.25&&now-start.t<1.10){rip=null;pending=null;seen=false;p.move.set(0,-.65);p.stickY=-.65;guard.held=true;}
  guard.step(DT);p.inputActive=guard.active||!!rip;
  const f=defender?p:a,w=f.skill._cover?.w??0;if(w>.5){firstCover??=now;coverTime+=DT;}peakCover=Math.max(peakCover,w);
  if(Math.round(now/DT)%24===0)timeline.push({t:now,p:snapshot(p),a:snapshot(a),distance:p.foeDistance(),held:guard.held,cover:w});
 };
 for(let i=0;i<Math.round(30/DT);i++){g.step();const anchor=mod.events.find(e=>e.type==='start');if(anchor&&g.t-anchor.t>=.15&&!tipSamples.length){tipSamples.push({t:g.t,serial:anchor.serial,tip:a.bladePoint(1).toArray(),chest:[p.bodies.chest.translation().x,p.bodies.chest.translation().y,p.bodies.chest.translation().z],axis:mod.events.find(e=>e.type==='beat')?.dir??null});}if(process.env.CAPTURE&&i%3===0)frames.push({t:g.t,fighters:[p,a].map(f=>f.meshes.map(({rb})=>({p:rb.translation(),q:rb.rotation()})))});if(!p.alive||!a.alive)break;}
 if(process.env.CAPTURE)frames.push({t:g.t,final:true,alive:p.alive,fighters:[p,a].map(f=>f.meshes.map(({rb})=>({p:rb.translation(),q:rb.rotation()})))});
 const result={after:process.env.AFTER??'counter',rollChecks:mod.rollChecks,policy:process.env.POLICY??'reactive',weapon,seed,delay,role,variant,t:g.t,p:snapshot(p),a:snapshot(a),tries,taps,hits,firstCover,peakCover,coverTime,events,timeline,aiParries:g.ai.stats.parries,triggers:mod.events,samples:mod.samples,diagnostics,frames,tipSamples};if(mod.run)mod.cancel('round-end');result.triggers=mod.events;g.world.free();return result;
}
const rows=[];for(const w of W)for(const seed of (process.env.SEEDS??'10301').split(',').map(Number))for(const delay of (process.env.DELAYS??'.12,.22').split(',').map(Number))rows.push(trial(w,seed,delay));
writeFileSync(process.env.OUT,JSON.stringify({variant,role,results:rows}));console.log(JSON.stringify({variant,role,n:rows.length,pDead:rows.filter(x=>!x.p.alive).length,aDead:rows.filter(x=>!x.a.alive).length,taps:rows.reduce((n,r)=>n+r.taps,0),hits:rows.reduce((n,r)=>n+r.hits,0),fired:rows.reduce((n,r)=>n+r.triggers.filter(e=>e.type==='start').length,0)}));
