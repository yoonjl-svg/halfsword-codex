// Actual native trace with/without presentation hands; separate lifecycle fixtures.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {newRound,DT} from '../harness_m.mjs';
import {attachHandVisuals} from '../../../src/hand_visual.js';
import assert from 'node:assert/strict';
const out=process.argv[2];assert.ok(out&&!fs.existsSync(out));
const hash=b=>createHash('sha256').update(b).digest('hex');
const files=['src/fighter.js','src/main.js','src/hand_visual.js','tools/sim/harness_m.mjs','tools/sim/experiments/hand_visual_probe.mjs'];
const manifest=()=>Object.fromEntries(files.map(p=>[p,hash(fs.readFileSync(p))]));
const sourceBefore=manifest(),originalRandom=Math.random,rows=[];
const snapshot=G=>G.world.takeSnapshot();
try{for(const weapon of ['qinggang','longsword','pistol']){
 const pair=[];
 for(const enabled of [false,true]){
  let G;const hands=[];
  try{
   G=newRound({seed:7,weapon,weapon2:'longsword',skill:weapon==='qinggang'?0:.7,difficulty:'normal',onFighter:f=>{if(weapon==='qinggang')f.onehandArmModel='manual';}});G.player.skill.autoGuard=true;
   const initial=hash(snapshot(G));const counts={bodies:G.world.bodies.len(),colliders:G.world.colliders.len(),joints:G.world.impulseJoints.len()};
   if(enabled)for(const f of [G.player,G.enemy]){f.syncMeshes();hands.push(attachHandVisuals(f,{hands:0xc98f5e}));}
   assert.equal(hash(snapshot(G)),initial);assert.deepEqual({bodies:G.world.bodies.len(),colliders:G.world.colliders.len(),joints:G.world.impulseJoints.len()},counts);
   const nextRandom=Math.random(),trace=createHash('sha256');
   for(let tick=0;tick<Math.round(1.9/DT);tick++){G.step();for(const f of [G.player,G.enemy])f.syncMeshes();for(const h of hands)h.update();trace.update(snapshot(G));}
   const row={enabled,initialNativeSHA:initial,counts,nextRandom,nativeTraceSHA:trace.digest('hex')};
   if(enabled){
    // Explicit display-only state fixture, after measured physics ends.
    G.player.armed=false;G.player.gripping=false;hands[0].update();
    const finite=[];for(const h of hands)for(const group of [h.main,h.off])group.traverse(o=>finite.push([...o.position.toArray(),...o.quaternion.toArray()].every(Number.isFinite)));
    assert.ok(finite.every(Boolean));row.emptyHandTransformsFinite=true;
    const parents=hands.flatMap(h=>[h.main.parent,h.off.parent]);for(const h of hands)h.dispose();
    assert.ok(parents.every(p=>!p.children.some(c=>c.name.startsWith('mitten-'))));row.disposed=true;
   }
   pair.push(row);
  }finally{for(const h of hands)h.dispose();G?.world.free();}
 }
 assert.equal(pair[0].initialNativeSHA,pair[1].initialNativeSHA);assert.equal(pair[0].nextRandom,pair[1].nextRandom);assert.equal(pair[0].nativeTraceSHA,pair[1].nativeTraceSHA);rows.push({weapon,exactNativeAndRandom:true,pair});console.log(JSON.stringify(rows.at(-1)));
}}finally{
 Math.random=originalRandom;const sourceAfter=manifest();fs.writeFileSync(out,JSON.stringify({sourceBefore,sourceAfter,sourceStable:JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter),rows,pass:rows.length===3&&JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter),command:process.argv,dt:DT,seconds:1.9,scope:'3 actual-game paired initial/native traces; same seed7, original reactive enemy AI, no pre-physics state/pose/force writes. After traces end, empty-hand and dispose are separate display fixtures, not injury/duel evidence.'},null,2)+'\n',{flag:'wx'});
}
