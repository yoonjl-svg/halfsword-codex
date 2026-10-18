import {live} from './iberian_beat_live.mjs';
import {probe} from './iberian_beat_probe.mjs';
import {geometry,LIVE_CASES} from './iberian_compare.mjs';
import {observeBreaks} from './iberian_dynamic_study.mjs';
import {SWEEPS,contactGuard} from './iberian_contact_sweep.mjs';
import {preGuard} from './iberian_pre_sweep.mjs';
import {entryGuard} from './iberian_entry_sweep.mjs';
import {closeGuard} from './iberian_close_sweep.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
export const OUT='docs/research/iberian_contact_20261018';
export function trial(mode,cfg,options={}){
 const samples=[],weapons={},contacts=[];let state,guard,next=0;
 const r=(mode==='probe'?probe:live)({...options,gain:0,installed:false,GuardOverride:cfg.kind==='close'?closeGuard(cfg):cfg.kind==='entry'?entryGuard(cfg):cfg.kind==='pre'?preGuard(cfg):cfg.hand?contactGuard(cfg):undefined,
  onStart(G,g){guard=g;delete G.combat.iberianBeat;state=G.player.skill._closeSweep??G.player.skill._contactSweep??G.player.skill._preSweep;weapons.player=observeBreaks(G.player,()=>G.t);weapons.enemy=observeBreaks(G.enemy,()=>G.t);
   const clash=G.combat.hooks.onClash;G.combat.hooks.onClash=(point,speed,info)=>{clash?.(point,speed,info);if(info.fresh)contacts.push({t:G.t,J:info.impulse,vn:info.vn,point:point.toArray(),line:g.defLine});};options.onStart?.(G,g);
  },onFrame(G){if(G.t>=next){samples.push({...geometry(G),phase:state?.phase??'base',defTip:G.player.bladePoint(1).toArray(),guardActive:guard.active,activity:G.player.skill.activity,broken:[G.player.weaponBroken,G.enemy.weaponBroken]});next+=mode==='probe'?1/120:.05;}options.onFrame?.(G,guard);}
 });
 return {...r,variant:cfg.id,cfg,motions:state?.events??[],entries:guard.me.skill._entrySweep?.events??[],contacts,weapons,samples};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const mode=process.argv[2]??'probe',configs=process.env.CONFIGS?JSON.parse(process.env.CONFIGS):process.env.ONLY?SWEEPS.filter(c=>c.id===process.env.ONLY):SWEEPS;
 const cases=process.env.CASES?JSON.parse(process.env.CASES):mode==='live'?LIVE_CASES:['zornhau','zornhauL','zwerch','zwerchL','oberhau','stichPflug'].flatMap(attack=>[1.4,1.6].map(gap=>({attack,gap,atk:'longsword',counter:false})));
 mkdirSync(`${OUT}/raw`,{recursive:true});
 for(const cfg of configs){const rows=cases.map(c=>trial(mode,cfg,c));writeFileSync(`${OUT}/raw/${process.env.LABEL??mode}-${cfg.id}.json`,JSON.stringify(rows));
 console.log(JSON.stringify({mode,id:cfg.id,n:rows.length,motions:rows.reduce((s,r)=>s+r.motions.length,0),limb:rows.reduce((s,r)=>s+r.health.limbLost,0),concussion:rows.reduce((s,r)=>s+r.health.concussion,0),bleed:rows.reduce((s,r)=>s+r.health.bleedAdded,0),pDead:rows.filter(r=>!r.health.end.alive).length,pBroken:rows.reduce((s,r)=>s+r.weapons.player.breaks.length,0),eBroken:rows.reduce((s,r)=>s+r.weapons.enemy.breaks.length,0)}));}
}
