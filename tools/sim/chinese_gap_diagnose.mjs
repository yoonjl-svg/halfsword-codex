// Observation only: classify harm by actual button/controller/body state.
import {live} from './chinese_benefit_live.mjs';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
export function diagnose(opts){
 const events=[],changes=[],frames=[];let lastKey='',heldSince=null,lastTap=null,lastRelease=null;
 const result=live({...opts,onStart(G,g){
  const before=G.before, wound=G.player.applyWound.bind(G.player);
  const context=()=>{
   const d=G.player,a=G.enemy,s=g.sense.seen(0),c=d.bodies.chest.translation();
   return {t:G.t,held:g.held,active:g.active,broken:g.broken,mode:g.mode,line:g.line,timer:g.timer,noThreat:g.noThreat,threatId:g.threatId,
    state:d.state,tap:!!d.skill.tap,armed:d.armed,stamina:d.stamina.value,distance:d.foeDistance(),heldAge:heldSince===null?null:G.t-heldSince,
    sinceTap:lastTap===null?null:G.t-lastTap,sinceRelease:lastRelease===null?null:G.t-lastRelease,
    enemyMode:G.ai.mode,enemyPhase:G.ai.phase,enemyTech:G.ai.tech?.name??G.ai.attack?.name??null,attackId:a.stamina.attackId,
    hand:[s.hx,s.hy],tip:[s.tx-c.x,s.ty-c.y,s.tz-c.z],mid:[s.mx-c.x,s.my-c.y,s.mz-c.z],speed:Math.hypot(s.mvx,s.mvy,s.mvz)};
  };
  G.before=()=>{const held=g.held,tap=!!G.player.skill.tap;before();if(!held&&g.held)heldSince=G.t;if(held&&!g.held){heldSince=null;lastRelease=G.t;}if(!tap&&G.player.skill.tap)lastTap=G.t;
   const c=context(),key=[c.held,c.active,c.broken,c.mode,c.line,c.state,c.attackId].join('|');if(key!==lastKey){changes.push(c);lastKey=key;}frames.push(c);if(frames.length>90)frames.shift();};
  G.player.applyWound=h=>{if(G.player.alive&&!G.player.revival)events.push({...context(),wound:{...h},recent:frames.filter((_,i)=>i%6===0)});return wound(h);};
 }});
 assert.equal(events.length,result.health.applied.length,'observer missed an applied wound');
 events.forEach((e,i)=>{delete e.wound;e.applied=result.health.applied[i];});
 return {...result,events,changes};
}
if(process.argv[1]?.endsWith('/chinese_gap_diagnose.mjs')){
 const out=process.env.GAP_OUT??'/workspace/chinese-parry-gap-20261017';mkdirSync(out,{recursive:true});
 for(const label of ['live','confirm']){
  const old=JSON.parse(readFileSync(`/workspace/chinese-parry-benefit-20261017/${label}-base.json`)),rows=[];
  for(const r of old){const n=diagnose({kind:'base',seed:r.seed,atk:r.atk,policy:r.policy,gap:r.gap});assert.deepEqual(n.health,r.health);assert.deepEqual(n.enemy,r.enemy);assert.deepEqual(n.commands,r.commands);rows.push(n);console.log(JSON.stringify({label,seed:r.seed,atk:r.atk,policy:r.policy,events:n.events.length,death:n.health.death}));}
  writeFileSync(`${out}/diagnose-${label}.json`,JSON.stringify(rows));
 }
}
