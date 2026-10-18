import {measured,CONFIGS,OUT} from '../sim/iberian_dynamic_study.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
const data={fixture:{attack:'zwerch',atk:'longsword',gap:1.6,counter:false},variants:{}};
for(const id of ['base','lateral']){
 const frames=[];
 const r=measured('probe',CONFIGS.find(c=>c.id===id),{...data.fixture,onFrame(G,guard){
  frames.push({t:G.t,phase:G.player.skill._dynamicBeat?.phase??'base',line:guard.defLine,
   tips:[G.player,G.enemy].map(f=>f.bladePoint(1).toArray()),
   fighters:[G.player,G.enemy].map(f=>({meshes:f.meshes.map(({rb})=>({p:rb.translation(),q:rb.rotation()})),blood:f.blood,broken:f.weaponBroken}))});
 }});
 if(frames.some(r=>r.fighters.some(f=>f.broken)))throw Error('Broken weapon needs a dedicated replay mesh');
 data.variants[id]={frames,events:r.motions,clashes:r.clashes,health:r.health};
}
data.origin=data.variants.lateral.events[0].t;
mkdirSync(`${OUT}/replay`,{recursive:true});writeFileSync(`${OUT}/replay/paired.json`,JSON.stringify(data));
