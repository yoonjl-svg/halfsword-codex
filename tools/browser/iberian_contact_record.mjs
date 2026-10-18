import {trial as measured,OUT} from '../sim/iberian_contact_study.mjs';
const candidate=JSON.parse(process.env.CANDIDATE??'{"id":"finish","duration":0.18,"hold":0.10,"recover":0.20,"hand":[0,0,0],"angle":[0,0]}');
const CONFIGS=[{id:'base'},candidate],folder=process.env.REPLAY??'finish';
import {mkdirSync,writeFileSync} from 'node:fs';
const data={fixture:JSON.parse(process.env.FIXTURE??'{"attack":"zwerch","atk":"longsword","gap":1.6,"counter":false}'),variants:{}};
for(const id of ['base',candidate.id]){
 const frames=[];
 const r=measured('probe',CONFIGS.find(c=>c.id===id),{...data.fixture,onFrame(G,guard){
  frames.push({t:G.t,phase:G.player.skill._closeSweep?.phase??G.player.skill._contactSweep?.phase??'base',line:guard.defLine,
   tips:[G.player,G.enemy].map(f=>f.bladePoint(1).toArray()),
   fighters:[G.player,G.enemy].map(f=>({meshes:f.meshes.map(({rb})=>({p:rb.translation(),q:rb.rotation()})),blood:f.blood,broken:f.weaponBroken}))});
 }});
 if(frames.some(r=>r.fighters.some(f=>f.broken)))throw Error('Broken weapon needs a dedicated replay mesh');
 data.variants[id]={frames,events:r.motions,clashes:r.clashes,health:r.health};
}
data.candidate=candidate;data.origin=data.variants[candidate.id].events[0].t;
mkdirSync(`${OUT}/replay/${folder}`,{recursive:true});writeFileSync(`${OUT}/replay/${folder}/paired.json`,JSON.stringify(data));
