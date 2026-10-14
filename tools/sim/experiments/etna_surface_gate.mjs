// Shared triangulation is checked against actual native Rapier rays, including
// triangle interiors. Area-weighted grade uses the playable disk above lava.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import R from '@dimforge/rapier3d-compat';
import { ETNA, etnaHeight, etnaNormal, etnaGroundMesh, createArenaGround } from '../../../src/etna_ground.js';

const out = process.argv[2];
assert(out?.startsWith('/tmp/') && !fs.existsSync(out), 'Fresh /tmp/ evidence path required');
await R.init();
const world = new R.World({x:0,y:-9.81,z:0});
createArenaGround(R, world, 0xffffffff, {stageId:'etna', walls:false});
world.step();
let checks = 0, maxHeightError = 0, maxNormalError = 0, upperMin = Infinity;
const grades = [], profile = { min: Infinity, max: -Infinity, sum: 0, n: 0 };
try {
  const {vertices,indices} = etnaGroundMesh();
  for (let i=0;i<indices.length;i+=3) {
    const ids = [indices[i],indices[i+1],indices[i+2]];
    if (ids.some(id=>Math.hypot(vertices[id*3],vertices[id*3+2])>10.5)) continue;
    for (const weights of [[1/3,1/3,1/3],[.2,.3,.5]]) {
      const p = [0,0,0];
      for(let j=0;j<3;j++) for(let a=0;a<3;a++) p[a]+=vertices[ids[j]*3+a]*weights[j];
      const h=etnaHeight(p[0],p[2]), n=etnaNormal(p[0],p[2]);
      const hit=world.castRayAndGetNormal(new R.Ray({x:p[0],y:10,z:p[2]},{x:0,y:-1,z:0}),30,true,R.QueryFilterFlags.EXCLUDE_SENSORS);
      assert(hit, 'Every visible ground point must have a physical surface');
      maxHeightError=Math.max(maxHeightError,Math.abs(h-p[1]),Math.abs(10-hit.timeOfImpact-h));
      maxNormalError=Math.max(maxNormalError,...['x','y','z'].map(a=>Math.abs(hit.normal[a]-n[a])));
      checks++;
    }
  }
  // Uniform horizontal-area sampling; triangle normals already include crossfall.
  for(let ix=-65;ix<=65;ix++) for(let iz=-65;iz<=52;iz++) {
    const x=ix/10+.013,z=iz/10+.017;
    if(Math.hypot(x,z)>6.5||z>=ETNA.lavaEdgeZ)continue;
    const n=etnaNormal(x,z), grade=Math.acos(n.y)*180/Math.PI;
    assert(n.z>0,'Every playable facet still descends toward lava');
    profile.min=Math.min(profile.min,grade);profile.max=Math.max(profile.max,grade);profile.sum+=grade;profile.n++;
    grades.push(grade);if(z< -4)upperMin=Math.min(upperMin,grade);
  }
  profile.mean=profile.sum/profile.n;delete profile.sum;
  grades.sort((a,b)=>a-b);profile.p10=grades[Math.floor(grades.length*.1)];profile.p90=grades[Math.floor(grades.length*.9)];
  assert(profile.mean>9.5&&profile.mean<10.5,'Whole playable surface averages approximately10°');
  assert(profile.min<4&&profile.min>1&&profile.max>16&&profile.max<20,'Include milder and distinctly steeper ground without extreme cliffs');
  assert(upperMin>1,'Former upper shelf must also be sloping');
  assert(maxHeightError<1e-5&&maxNormalError<1e-5,'Rendered triangles, native contact and foot queries must agree');
  for(let x=-10.5;x<=10.5;x+=.25) assert(Math.abs(etnaHeight(x,ETNA.lavaEdgeZ)-ETNA.lavaLevel)<1e-6,'No false shore lip or submerged safe ground');
  const sources=Object.fromEntries(['src/etna_ground.js','tools/sim/experiments/etna_surface_gate.mjs'].map(p=>[p,createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
  const report={pass:true,completedUTC:new Date().toISOString(),checks,maxHeightError,maxNormalError,profile,upperMin,sources,
    mesh:{vertices:vertices.length/3,triangles:indices.length/3},limits:['Slope statistics use uniform0.1m horizontal-area samples inside radius6.5m above lava.','No movement or visual acceptance is established by this geometric gate.']};
  fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
} finally {world.free();}
