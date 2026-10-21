// Review preview: session-only storage; no account or production save access.
const memory=new Map();
for(const name of ['localStorage','sessionStorage'])Object.defineProperty(window,name,{configurable:true,value:{
  getItem:k=>memory.get(`${name}:${k}`)??null,
  setItem:(k,v)=>memory.set(`${name}:${k}`,String(v)),
  removeItem:k=>memory.delete(`${name}:${k}`),
  clear:()=>{for(const k of memory.keys())if(k.startsWith(name+':'))memory.delete(k);},
  key:i=>[...memory.keys()].filter(k=>k.startsWith(name+':'))[i]?.slice(name.length+1)??null,
  get length(){return [...memory.keys()].filter(k=>k.startsWith(name+':')).length;}
}});
const q=new URLSearchParams(location.search);
q.set('test','1');q.set('stage','courtyard_night');q.set('foe','samira_mad');q.set('foeWeapon','sabre');
if(!q.has('weapon'))q.set('weapon','longsword');
history.replaceState(null,'',`${location.pathname}?${q}`);
await import('../../src/game_entry.js');
