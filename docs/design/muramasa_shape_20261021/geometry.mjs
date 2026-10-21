import fs from 'node:fs';import assert from 'node:assert/strict';
import {WEAPONS,weaponSpecText} from '../../../src/weapons.js';import {LOOKS} from '../../../src/looks.js';import {weaponPhysics} from '../../../src/weapon_class.js';
const before=JSON.parse(fs.readFileSync(new URL('./before.json',import.meta.url))),unchanged=[];
for(const [id,w]of Object.entries(WEAPONS)){if(id==='muramasa')continue;assert.deepEqual(w.buildParts(LOOKS.player),before[id].parts,id);assert.equal(JSON.stringify(w,(_k,v)=>typeof v==='function'?v.toString():v),before[id].spec,id);unchanged.push(id);}
const w=WEAPONS.muramasa,parts=w.buildParts(LOOKS.player),part=parts.find(q=>q[4]),m=w.partMesh(3,true,part[0],part[3],{},LOOKS.player,w.tier),p=m.geometry.attributes.position;
const rings=new Map();let maxOutside=0;
for(let i=0;i<p.count;i++){const y=p.getY(i),x=p.getX(i)+(part[5]?.x??0);const k=y.toFixed(8);if(!rings.has(k)||x<rings.get(k).x)rings.set(k,{x,y});maxOutside=Math.max(maxOutside,Math.abs(p.getX(i))-part[0][1]);}
const back=[...rings.values()].sort((a,b)=>a.y-b.y),a=back[0],b=back.at(-1),dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy);
const sori=Math.max(...back.map(v=>Math.abs(dx*(v.y-a.y)-dy*(v.x-a.x))/L));
assert(Math.abs(L-.70)<1e-5,`length ${L}`);assert(Math.abs(sori-.020)<.00001,`sori ${sori}`);assert(maxOutside<=.010001,`collider mismatch ${maxOutside}`);assert.equal(w.bladeLength,.7);assert(Math.abs(weaponPhysics(w).mass-1.1)<1e-9);assert(weaponPhysics(w).I<before.muramasa.phys.I);
const result={sourceBase:'13a2eaf5',measuredMesh:{nagasaM:L,soriM:sori,backRoot:a,tip:b,maximumModelOutsideColliderM:maxOutside},physicsBefore:before.muramasa.phys,physicsAfter:weaponPhysics(w),text:weaponSpecText(w),unchangedWeapons:unchanged};
fs.writeFileSync(new URL('./geometry.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
