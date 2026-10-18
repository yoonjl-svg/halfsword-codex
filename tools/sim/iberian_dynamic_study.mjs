import {probe} from './iberian_beat_probe.mjs';
import {live} from './iberian_beat_live.mjs';
import {geometry,LIVE_CASES} from './iberian_compare.mjs';
import {PATHS,dynamicGuard} from './iberian_dynamic_cover.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
export const OUT='docs/research/iberian_dynamic_20261018';
export const CONFIGS=[{id:'base'},...Object.keys(PATHS).map(id=>({id,path:PATHS[id]}))];
export function observeBreaks(f,time){
 const impacts=[],breaks=[],absorb=f.absorbWeaponImpact.bind(f),brk=f.breakWeapon.bind(f);
 f.absorbWeaponImpact=(J,by)=>{
  if(f.armed&&!f.weaponBroken&&f.weapon.fragile){const mult=by?.armed&&!by.weaponBroken?(by.weapon.breakMult??1):1;impacts.push({t:time(),J,p:Math.min(1,f.weapon.breakChance(J)*mult),by:by?.index??null});}
  return absorb(J,by);
 };
 f.breakWeapon=(...args)=>{const was=f.weaponBroken;const r=brk(...args);if(!was&&f.weaponBroken)breaks.push({t:time()});return r;};
 return {impacts,breaks};
}
export function measured(kind,cfg,options={}){
 const samples=[],motions=[],poses=[],weapons={};let next=0,Gref,guardref;
 const run=kind==='probe'?probe:live;
 const r=run({...options,gain:0,installed:false,GuardOverride:cfg.path?dynamicGuard(cfg.path):undefined,
  onStart(G,guard){Gref=G;guardref=guard;delete G.combat.iberianBeat;weapons.player=observeBreaks(G.player,()=>G.t);weapons.enemy=observeBreaks(G.enemy,()=>G.t);options.onStart?.(G,guard);},
  onFrame(G){
   const state=G.player.skill._dynamicBeat;
   if(G.t>=next){
    samples.push({...geometry(G),guardLine:guardref.defLine,phase:state?.phase??'base',defTip:G.player.bladePoint(1).toArray(),defSpeed:Math.hypot(G.player.hitPointVel.x,G.player.hitPointVel.y,G.player.hitPointVel.z),broken:[G.player.weaponBroken,G.enemy.weaponBroken]});
    poses.push({t:G.t,hand:[...G.player.skill.thrustPose.hand],dir:[...G.player.skill.thrustPose.dir]});next+=kind==='probe'?1/120:.05;
   }
   options.onFrame?.(G,guardref);
  }
 });
 motions.push(...(Gref.player.skill._dynamicBeat?.events??[]));
 return {...r,variant:cfg.id,path:cfg.path??null,motions,weapons,samples,poses};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const mode=process.argv[2]??'probe',configs=process.env.ONLY?CONFIGS.filter(c=>c.id===process.env.ONLY):CONFIGS;
 mkdirSync(`${OUT}/raw`,{recursive:true});
 for(const cfg of configs){const rows=[];
  const cases=mode==='live'?LIVE_CASES: ['zornhau','zornhauL','zwerch','zwerchL','oberhau','stichPflug'].flatMap(attack=>[1.4,1.6].map(gap=>({attack,gap,atk:'longsword',counter:false})));
  for(const c of cases){rows.push(measured(mode,cfg,c));}
  writeFileSync(`${OUT}/raw/${mode}-${cfg.id}.json`,JSON.stringify(rows));
  console.log(JSON.stringify({mode,id:cfg.id,n:rows.length,motions:rows.reduce((s,r)=>s+r.motions.length,0),contacts:rows.filter(r=>r.clashes.length).length,limb:rows.reduce((s,r)=>s+r.health.limbLost,0),concussion:rows.reduce((s,r)=>s+r.health.concussion,0),pDead:rows.filter(r=>!r.health.end.alive).length,pBroken:rows.reduce((s,r)=>s+r.weapons.player.breaks.length,0),eBroken:rows.reduce((s,r)=>s+r.weapons.enemy.breaks.length,0)}));
 }
}
