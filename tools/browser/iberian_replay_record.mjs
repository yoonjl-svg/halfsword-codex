import {probe} from '../sim/iberian_beat_probe.mjs';
import {writeFileSync} from 'node:fs';
const output={};
for(const [label,cfg] of [['base',{gain:0}],['candidate',{gain:1.4,impulseCap:6,speedCap:8}]]){
 const frames=[];let t0=null;
 const result=probe({attack:'zornhau',atk:'longsword',gap:1.6,...cfg,onFrame(G,study){
  if(study.events.length)t0??=study.events[0].time;
  if(t0!=null&&G.t-t0>=-.01&&G.t-t0<.45)frames.push({t:G.t,dt:G.t-t0,fighters:[G.player,G.enemy].map(f=>({meshes:f.meshes.map(({rb})=>({p:rb.translation(),q:rb.rotation()})),blood:f.blood,weapon:f.weapon.id}))});
 }});
 output[label]={config:cfg,frames,t0,events:result.beats};
}
writeFileSync('docs/research/iberian_beat_20261018/replay/paired.json',JSON.stringify(output));
