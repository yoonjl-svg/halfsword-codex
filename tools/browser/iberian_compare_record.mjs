import {probe} from '../sim/iberian_beat_probe.mjs';
import {live} from '../sim/iberian_beat_live.mjs';
import {CONFIGS,geometry} from '../sim/iberian_compare.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
const out='docs/research/iberian_compare_20261018/replay';mkdirSync(out,{recursive:true});
const isLive=process.argv.includes('--live');
const output={fixture:isLive?{seed:941,atk:'longsword',weapon:'zweihander',policy:'slash',reaction:.18,seconds:30}:{attack:'zornhau',atk:'longsword',gap:1.6,counter:false},variants:{}};
for(const cfg of CONFIGS){
 const frames=[];let t0=null;
 const result=(isLive?live:probe)({...output.fixture,...cfg,onFrame(G,study){
  const event=isLive?G.combat.lastIberianBeat:study.events[0];
  if(event)t0??=event.time;
  if(t0!=null&&G.t-t0>=-.01&&G.t-t0<.65)frames.push({t:G.t,dt:G.t-t0,geometry:geometry(G),fighters:[G.player,G.enemy].map(f=>({meshes:f.meshes.map(({rb})=>({p:rb.translation(),q:rb.rotation()})),blood:f.blood,weapon:f.weapon.id}))});
 }});
 output.variants[cfg.id]={config:cfg,frames,t0,events:result.beats,health:result.health};
}
writeFileSync(`${out}/${isLive?'live-first':'paired'}.json`,JSON.stringify(output));
