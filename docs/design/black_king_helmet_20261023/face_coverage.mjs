import fs from 'node:fs';import assert from 'node:assert/strict';
import {newRound,THREE} from '../../../tools/sim/harness_m.mjs';import {LOOK_ARCHIVE} from '../../../src/looks.js';
const scenes=['v2','v3'].map(version=>{const g=newRound({look:LOOK_ARCHIVE.black_king[version],weapon:'tizona',seed:31}),head=g.player.groups.head;head.position.set(0,0,0);head.quaternion.identity();head.updateMatrixWorld(true);return{g,head,helm:g.player.helmetGroup}});
const ray=new THREE.Raycaster(),direction=new THREE.Vector3(-1,0,0),belongs=(o,parent)=>{for(;o;o=o.parent)if(o===parent)return true;return false;};
const visible=o=>{for(;o;o=o.parent)if(!o.visible)return false;return true;};
let exposedBefore=0,coveredNow=0;
for(let y=-.095;y<=.040;y+=.0015)for(let z=-.100;z<=.100;z+=.0015){
 ray.set(new THREE.Vector3(1,y,z),direction);
 const old=ray.intersectObject(scenes[0].head,true).find(h=>visible(h.object));
 if(!old||belongs(old.object,scenes[0].helm))continue;
 exposedBefore++;
 const now=ray.intersectObject(scenes[1].head,true).find(h=>visible(h.object));
 if(now&&belongs(now.object,scenes[1].helm))coveredNow++;
}
const result={method:'Orthographic front +X rays, 1.5mm grid over face y[-95,40]mm/z[-100,100]mm. Count previously exposed visible face points now occluded by helmet, including real vent openings.',exposedBefore,coveredNow,coverageRatio:coveredNow/exposedBefore};
assert(result.coverageRatio>.5,result);for(const {g}of scenes)g.world.free();
fs.writeFileSync(new URL('./face-coverage.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(result);
