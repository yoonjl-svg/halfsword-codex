// Controller fixtures only: no injected injury or native motion acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {newRound, CONFIG, THREE} from '../harness_m.mjs';
import {guardAt} from '../../../src/guards.js';
import {FINISH} from '../../../src/finish.js';

const out=process.argv[2];assert.ok(out&&!fs.existsSync(out),'Use a fresh output file');
const sha=b=>createHash('sha256').update(b).digest('hex');
const files=['src/fighter.js','src/skill.js','src/guards.js','src/main.js','src/config.js',
  'tools/sim/experiments/onehand_manual_contract.test.mjs','tools/sim/harness_m.mjs',
  'package-lock.json','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'];
const manifest=()=>Object.fromEntries(files.map(p=>[p,sha(fs.readFileSync(p))]));
const before=manifest(),tests=[];
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
const vectorClose=(a,b)=>a.forEach((x,i)=>close(x,b[i]));
function observe(f,amt){
  f.finish.amt=amt;f.finish.on=amt>0;
  f.finish.hover.hand=[...FINISH.hands];f.finish.hover.dir=[.6,-.8,0];
  f.finish.strike.hand=[.4,-.25,.05];f.finish.strike.dir=[.3,-Math.sqrt(.91),0];
  for(const body of [...Object.values(f.bodies),f.sword]){body.resetForces(true);body.resetTorques(true);}
  f.driveSword();
  return {hand:[...f.handBase],aim:f.debug.aim.toArray(),shoulder:f.jointByName.uarmS.target.toArray(),elbow:f.jointByName.farmS.target.toArray()};
}
for(const weapon of ['sabre','rapier','longsword']){
 const worlds=[];
 try{
  const a=newRound({seed:7,weapon,weapon2:'longsword',skill:.7,walls:false});worlds.push(a);a.step();
  const b=newRound({seed:7,weapon,weapon2:'longsword',skill:.7,walls:false,onFighter:f=>{f.onehandArmModel='manual';}});worlds.push(b);b.step();
  for(const G of worlds){G.player.skill.aim.set(...CONFIG.SKILL.homeGuard);G.player.skill.tap=null;G.player.skill.thrustPose.w=0;}
  const legacy=observe(a.player,0),manual=observe(b.player,0);
  if(weapon==='longsword'){
   assert.deepEqual(manual,legacy);tests.push({name:'twohand-controller-unchanged',pass:true});continue;
  }
  const shoulder=CONFIG.ARM.shoulder,home=guardAt(...CONFIG.SKILL.homeGuard,{oneHand:true,table:b.player.guardPose.table});
  close(new THREE.Vector3(...manual.hand).distanceTo(new THREE.Vector3(...shoulder)),
    new THREE.Vector3(...home.hand).distanceTo(new THREE.Vector3(...shoulder)));
  tests.push({name:weapon+'-home-shoulder-distance',pass:true,scale:b.player.onehandReachScale});
  b.player.skill.aim.set(.18,-.28);const left=observe(b.player,0);let maxHandStepM=0,maxAimStepRad=0;
  for(let i=1;i<=1000;i++){
   const right=observe(b.player,i/1000);
   maxHandStepM=Math.max(maxHandStepM,new THREE.Vector3(...left.hand).distanceTo(new THREE.Vector3(...right.hand)));
   maxAimStepRad=Math.max(maxAimStepRad,new THREE.Vector3(...left.aim).angleTo(new THREE.Vector3(...right.aim)));
   assert.ok([...right.hand,...right.aim,...right.shoulder,...right.elbow].every(Number.isFinite));
   vectorCloseLength(right.aim);Object.assign(left,right);
  }
  assert.ok(maxHandStepM<.002&&maxAimStepRad<.01,'Unexpected finishing target discontinuity');
  const legacyFinish=observe(a.player,1),manualFinish=observe(b.player,1);
  vectorClose(legacyFinish.hand,manualFinish.hand);vectorClose(legacyFinish.aim,manualFinish.aim);
  tests.push({name:weapon+'-finish-target-endpoint-and-continuity',pass:true,maxHandStepM,maxAimStepRad,fixtures:1001});
  observe(b.player,0);assert.equal(b.player.skill.thrust({step:false}),true);
  assert.deepEqual(b.player.skill.tap.h0,b.player.handBase);
  tests.push({name:weapon+'-manual-tap-start',pass:true});
 }finally{for(const G of worlds){G.eventQueue.free();G.world.free();}}
}
function vectorCloseLength(v){close(new THREE.Vector3(...v).length(),1);}
const after=manifest(),sourceStable=JSON.stringify(before)===JSON.stringify(after);assert.ok(sourceStable);
const report={pass:true,sourceStable,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),command:process.argv,
 sourceBefore:before,sourceAfter:after,tests,scope:'Controller unit fixtures after one ordinary spawn step. Finishing activation and finite authored target fixtures are supplied directly; no fallen enemy, native finishing motion, contact or human movement certification. 1001 target samples are not independent physics trials.'};
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({pass:true,tests:tests.length,sourceStable}));
