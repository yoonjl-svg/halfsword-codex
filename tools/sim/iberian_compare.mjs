// Matched 2 methods x 2 strengths, plus unmodified-effect control.
// Human-command surrogate, NOT a human playtest. Observer never consumes RNG.
import {live} from './iberian_beat_live.mjs';
import {probe} from './iberian_beat_probe.mjs';
import {DT} from './harness_m.mjs';
import * as THREE from 'three';
import {mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export const CONFIGS = [
 {id:'base',gain:0},
 {id:'offset16',gain:.7,impulseCap:3,speedCap:4,recoilDegrees:16,recoilSeconds:.28},
 {id:'offset24',gain:.7,impulseCap:3,speedCap:4,recoilDegrees:24,recoilSeconds:.28},
 {id:'impulse6',gain:1.4,impulseCap:6,speedCap:8,recoilDegrees:0},
 {id:'impulse9',gain:2.1,impulseCap:9,speedCap:12,recoilDegrees:0},
];
export const LIVE_CASES=[941,942].flatMap(seed=>['longsword','qinggang','zweihander'].flatMap(atk=>['slash','riposte'].map(policy=>({seed,atk,weapon:'zweihander',policy,reaction:seed===941?.18:.28,seconds:30}))));
const OUT='docs/research/iberian_compare_20261018';
const v=p=>new THREE.Vector3().copy(p);
function segmentDistance(a,b,p){const ab=b.clone().sub(a);return a.clone().addScaledVector(ab,THREE.MathUtils.clamp(v(p).sub(a).dot(ab)/Math.max(1e-10,ab.lengthSq()),0,1)).distanceTo(p);}
export function geometry(G){
 const D=G.player,A=G.enemy,a=A.bladePoint(0,new THREE.Vector3()),b=A.bladePoint(1,new THREE.Vector3());
 const c=v(D.bodies.chest.translation()),h=v(D.bodies.head.translation()),abd=v(D.bodies.abdomen.translation());
 return {t:G.t,distance:D.foeDistance(),chest:segmentDistance(a,b,c),head:segmentDistance(a,b,h),
  // Explicit analysis envelope, NOT the actual colliders or a guaranteed safe window.
  envelope:Math.min(segmentDistance(a,b,c)-.23,segmentDistance(a,b,h)-.16,segmentDistance(a,b,abd)-.22),
  tip:b.toArray(),root:a.toArray(),dChest:c.toArray(),dRight:D.right(new THREE.Vector3()).toArray(),
  stamina:D.stamina.value,enemyStamina:A.stamina.value,clinch:!!D.stamina.clinching,
  enemySpeed:Math.hypot(A.hitPointVel.x,A.hitPointVel.y,A.hitPointVel.z)};
}
export function measuredLive(options){
 const samples=[],windows=[],attacks=[];let nextSample=0,lastBeat=null,lastAttack=null;
 const result=live({...options,onFrame(G){
  const b=G.combat.lastIberianBeat;
  if(b&&b!==lastBeat){lastBeat=b;windows.push({event:{...b},frames:[]});}
  const id=G.enemy.stamina.attackId;
  if(lastAttack!==id){if(lastAttack!=null)attacks.push({t:G.t,id,phase:G.ai.phase,tech:G.ai.tech?.name});lastAttack=id;}
  const active=windows.filter(w=>G.t-w.event.time<=1.2);
  if(G.t+1e-9>=nextSample||active.length){const row=geometry(G);if(G.t+1e-9>=nextSample){samples.push(row);nextSample+=.05;}for(const w of active)w.frames.push(row);}
 }});
 return {...result,observations:{samples,windows,attacks}};
}
function save(name,data){mkdirSync(`${OUT}/raw`,{recursive:true});writeFileSync(`${OUT}/raw/${name}.json`,JSON.stringify(data));}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const mode=process.argv[2]??'live';
 const configs=process.env.ONLY?CONFIGS.filter(c=>c.id===process.env.ONLY):CONFIGS;
 if(mode==='neutral'){
  const options={...LIVE_CASES[0],...CONFIGS[3],seconds:16};
  const a=live(options),b=measuredLive(options);delete b.observations;
  if(JSON.stringify(a)!==JSON.stringify(b))throw Error('Observer changed the simulation');
  if(!a.beats.length)throw Error('Neutrality check must include a beat event');
  mkdirSync(`${OUT}/checks`,{recursive:true});writeFileSync(`${OUT}/checks/observer.json`,JSON.stringify({identical:true,options,beats:a.beats.length,duration:a.duration,dt:DT},null,2));
  console.log('Observer neutrality: exact result JSON equality');
 }else if(mode==='live'){
  for(const cfg of configs){const rows=[];for(const c of LIVE_CASES){const r=measuredLive({...c,...cfg});rows.push(r);save(`live-${cfg.id}`,rows);console.log(JSON.stringify({id:cfg.id,...c,t:r.duration,beats:r.beats.length,pAlive:r.health.end.alive,eAlive:r.enemy.end.alive}));}}
 }else if(mode==='probe'){
  for(const cfg of configs){const rows=[];for(const attack of ['zornhau','zornhauL','zwerch','zwerchL','oberhau','stichPflug'])for(const gap of [1.4,1.6])for(const counter of [false,true]){
   const frames=[];const r=probe({...cfg,attack,atk:'longsword',gap,counter,onFrame(G,study){if(study.events.length&&G.t-study.events[0].time<=1.2)frames.push(geometry(G));}});
   rows.push({...r,observations:frames});
  }save(`probe-${cfg.id}`,rows);console.log(JSON.stringify({id:cfg.id,probes:rows.length,eligible:rows.filter(r=>r.beats.length).length}));}
 }else throw Error(mode);
}
