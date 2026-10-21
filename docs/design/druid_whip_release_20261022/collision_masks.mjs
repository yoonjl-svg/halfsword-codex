import assert from 'node:assert/strict';
import fs from 'node:fs';
import {newRound,CONFIG} from '../../../tools/sim/harness_m.mjs';
const rows=[];
for(const limits of [false,true]){
 CONFIG.BODY.humanLimits=limits;
 const g=newRound({weapon:'druid_whip',weapon2:'druid_whip',seed:11});
 for(const [i,f]of [g.player,g.enemy].entries()){
  const torso=i?512:256, grip=f.swordColliders[0].collisionGroups(), groups=f.flexWeapon.segments.map(s=>s.col.collisionGroups());
  assert.equal(Boolean(grip&torso),limits);
  assert(groups.every(mask=>mask===(grip&~torso)));
  rows.push({index:i,limits,grip,lash:groups[0],onlyOwnerTorsoRemoved:true});
 }
 g.world.free();
}
fs.writeFileSync(new URL('./collision-masks.json',import.meta.url),JSON.stringify(rows,null,2));console.log(rows);
