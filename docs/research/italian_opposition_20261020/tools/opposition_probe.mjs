import {newRound,DT,THREE} from './harness_m.mjs';
import {PlayerParryGuard} from '../../src/parry_button.js';
import {installOpposition} from '../../src/italian_opposition_research.js';
import {TECH} from '../../src/ai_techniques.js';
import {SKILL,ARENA} from '../../src/config.js';
import {readFileSync,writeFileSync} from 'node:fs';
export const snap=f=>({blood:f.blood,con:f.consciousness,limbs:{...f.limbs},bleed:f.bleed,alive:f.alive,cause:f.causeOfDeath,armed:f.armed,stamina:f.stamina.value,spent:{...f.stamina.spent},counts:{...f.stamina.counts}});
export function observe(g){const events=[];for(const f of [g.player,g.enemy]){const old=f.applyWound.bind(f);f.applyWound=h=>{const b=snap(f),v=old(h),a=snap(f);events.push({t:g.t,vic:f.index,part:h.part,type:h.type,severity:h.severity??0,limb:Object.keys(a.limbs).reduce((n,k)=>n+Math.max(0,b.limbs[k]-a.limbs[k]),0),con:Math.max(0,b.con-a.con),bleed:Math.max(0,a.bleed-b.bleed)});return v;};}return events;}
export function trial(c,variant,options={}){
 const g=newRound({weapon:'rapier',weapon2:c.weapon,seed:c.seed??1,gap:c.gap});const p=g.player,a=g.enemy;
 p.fightT=a.fightT=ARENA.startHold;p.skill.corr=SKILL.corr;p.skill.corrTip=SKILL.corrTip;p.skill.autoGuard=true;
 const guard=new PlayerParryGuard(p,a);p.stamina.controller=guard;
 const mod=installOpposition(p,a,guard,{variant,...options}),events=observe(g),frames=[],timeline=[];
 const clash=g.combat.hooks.onClash;g.combat.hooks.onClash=(...args)=>{clash?.(...args);mod.clash(...args);};
 g.ai.update=()=>{};a.move.set(0,0);let ph=0,t0=0,t3=null,pts=null,press=null;
 const atk=TECH.find(x=>x.name===c.attack);if(!atk)throw new Error(c.attack);
 const pad=(x,y)=>{a.handOffset.set(x,y);a.skill.aimRaw.set(x,y);};
 const go=(v,sp)=>{const o=a.handOffset,d=Math.hypot(v[0]-o.x,v[1]-o.y),step=sp*DT;if(d<=step){pad(...v);return true;}pad(o.x+(v[0]-o.x)*step/d,o.y+(v[1]-o.y)*step/d);};
 g.before=()=>{
  const strike=t3??(ph===2?t0+.15:Infinity);
  if(press===null&&g.t>=strike+c.press){press=g.t;guard.held=true;}
  guard.step(DT);p.inputActive=guard.active||!!mod.run;
  if(ph===0&&g.t>.6)ph=1;
  else if(ph===1&&go(atk.from,3)){ph=2;t0=g.t;}
  else if(ph===2&&g.t-t0>.15){ph=3;t3=g.t;pts=atk.path.map(x=>[...x]);a.stamina.attack(atk.kind==='thrust'?'thrust':'cut');}
  else if(ph===3&&go(pts[0],11)&&(pts.shift(),!pts.length)){ph=4;t0=g.t;}
  if(Math.round(g.t/DT)%12===0)timeline.push({t:g.t,p:snap(p),a:snap(a)});
  if(options.record&&Math.round(g.t/DT)%4===0)frames.push({t:g.t,active:!!mod.run,line:guard.line,pose:JSON.parse(JSON.stringify(p.skill.thrustPose)),fighters:[p,a].map(f=>f.meshes.map(({rb})=>({p:{...rb.translation()},q:{...rb.rotation()}})))});
 };
 for(let i=0;i<720;i++){g.step();if((ph===4&&g.t-t0>1.5)||!p.alive||!a.alive)break;}
 const r={...c,variant,options,t:g.t,pressOffset:c.press,press,t3,p:snap(p),a:snap(a),events,triggers:mod.events,contacts:mod.contacts,timeline,frames};g.world.free();return r;
}
if(process.env.CASES){const cases=JSON.parse(readFileSync(process.env.CASES)),variant=process.env.VARIANT??'base',options=JSON.parse(process.env.OPTIONS??'{}');const rows=cases.map(c=>trial(c,variant,options));writeFileSync(process.env.OUT,JSON.stringify({variant,options,results:rows}));console.log(JSON.stringify({variant,n:rows.length,fired:rows.filter(r=>r.triggers.some(e=>e.type==='start')).length,hurt:rows.filter(r=>r.events.some(e=>e.vic===0&&(e.limb||e.con||e.bleed))).length,hits:rows.filter(r=>r.events.some(e=>e.vic===1&&(e.limb||e.con||e.bleed))).length}));}
