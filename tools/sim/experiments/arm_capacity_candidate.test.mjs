import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {newRound,THREE} from '../harness_m.mjs';
import {installForceLedger} from '../force_ledger.mjs';
import {loadArmCapacityCandidates,transformArmCapacityFighter} from './arm_capacity_candidate.mjs';
const root=new URL('../../../',import.meta.url);
const output=process.argv[2]||'/workspace/halfsword-hybrid-evidence/arm-capacity-candidate-tests.json';
const hash=x=>createHash('sha256').update(x).digest('hex');
const paths=['src/fighter.js','src/config.js','src/guards.js','src/skill.js','tools/sim/harness_m.mjs','tools/sim/force_ledger.mjs',
  'tools/sim/experiments/arm_capacity_candidate.mjs','tools/sim/experiments/arm_capacity_candidate.test.mjs'];
const manifest=async()=>Object.fromEntries(await Promise.all(paths.map(async p=>[p,hash(await readFile(new URL(p,root)))])));
const before=await manifest(),modules=await loadArmCapacityCandidates(),tests=[];
const V=v=>new THREE.Vector3(v.x,v.y,v.z);
function near(a,b,e=1e-8){assert.ok(Math.abs(a-b)<=e,`${a} != ${b} tolerance ${e}`);}
function vecNear(a,b,e=1e-8){for(const k of ['x','y','z'])near(a[k],b[k],e);}
class Passive{update(){}}
async function test(name,fn){try{tests.push({name,pass:true,details:await fn()});console.log('PASS',name);}catch(e){tests.push({name,pass:false,error:e.stack});console.error('FAIL',name,e.stack);}}
function preparedRun(variant,onDiagnostic=null){
  const G=newRound({seed:7,walls:false,AIClass:Passive});G.park();const f=G.player;
  G.before=t=>{f.handOffset.set(.18*Math.sin(t*3),.3*Math.cos(t*2));f.handHeld=true;};
  const trace=()=>JSON.stringify({t:G.t,native:[...Object.values(f.bodies),f.sword].map(b=>[b.mass(),b.translation(),b.rotation(),b.linvel(),b.angvel()]),hand:f.handTarget.toArray(),aim:f.aimDirW.toArray(),state:f.state});
  try{
    for(let i=0;i<30;i++)G.step();const checkpoint=trace();
    const ledger=installForceLedger(G,{fighters:[f],maxSamples:1});
    const installed=variant?modules.installer({f,ledger,variant,onDiagnostic}):null,frames=[];
    try{for(let i=0;i<100;i++){G.step();frames.push(trace());}return {checkpoint,frames,summary:installed?.summary,paths:Object.keys(ledger.summary().totals.byPath)};}
    finally{installed?.restore();ledger.restore();}
  }finally{G.world.free();}
}
// Deliberate native body setters below define static algebra fixtures only.
// No world step follows them. They are not evidence of motion naturalness.
function fixture(variant,{injured=false,zero=false,rotate=true}={}){
  const G=newRound({seed:7,walls:false,AIClass:Passive});G.park();const f=G.player;
  const rows=[],module=modules.variants[variant];module.setDiagnostics(f,d=>rows.push(d));
  try{
    f.foe=null;f.lastDt=1/120;f.muscle=injured?.45:1;f.strength=injured?.8:1;
    f.limbs.armS=injured?.4:1;f.state='stand';f.armed=true;
    // Remove compensation in this fixture to isolate PD, Hill and post-cap twist.
    f.gravityTorque=(_b,_pivot,_x,out)=>out.set(0,0,0);
    f.skill.level=zero?0:.7;f.skill.aim.set(0,.1);f.skill.thrustPose.w=0;f.finish.amt=0;
    const forearmQ=rotate?new THREE.Quaternion().setFromEuler(new THREE.Euler(.3,.7,-.2)):new THREE.Quaternion();
    f.bodies.farmS.setRotation(forearmQ,true);
    f.bodies.chest.setAngvel({x:rotate?5:0,y:rotate?-2:0,z:rotate?3:0},true);
    f.bodies.farmS.setAngvel({x:rotate?-3:0,y:rotate?2:0,z:rotate?1:0},true);
    f.sword.setAngvel({x:rotate?2:0,y:rotate?4:0,z:rotate?-1:0},true);
    const swordQ=zero?new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),-Math.PI/2):
      new THREE.Quaternion().setFromEuler(new THREE.Euler(.4,-.1,.6));
    f.sword.setRotation(swordQ,true);f.prevAim=null;f.wristHill=undefined;
    if(zero){f.weaponCfg={...f.weaponCfg,aimStiffness:0,aimDamping:0,releaseDamping:0};f.twistScale=0;}
    const wristBodies=[f.sword,f.bodies.farmS,f.bodies.chest];
    for(const b of wristBodies)b.resetTorques(true);
    module.driveSword.call(f);
    const wrist=rows.find(r=>r.actuator==='wrist');assert.ok(wrist);
    const actualWristTorques=wristBodies.map(b=>({...b.userTorque()}));
    vecNear(actualWristTorques[0],wrist.reactions.child,1e-4);
    vecNear(actualWristTorques[1],wrist.reactions.parent,1e-4);
    vecNear(actualWristTorques[2],wrist.reactions.chest,1e-4);
    const j=f.jointByName.uarmS;
    j.child.setRotation(new THREE.Quaternion(),true);j.parent.setRotation(new THREE.Quaternion(),true);
    j.child.setAngvel({x:0,y:0,z:0},true);j.parent.setAngvel({x:0,y:0,z:0},true);
    j.target.setFromEuler(new THREE.Euler(zero?0:1,0,zero?0:1));j.prevTarget=j.target.clone();
    const mus=Math.max(.1,f.muscle)*(.3+.7*f.limbs.armS)*f.strength;
    for(const b of [j.child,j.parent])b.resetTorques(true);
    module.manualMuscle.call(f,j,j.k*mus,j.d*Math.sqrt(Math.max(.05,mus)),j.max*mus);
    const shoulder=rows.find(r=>r.actuator==='shoulder');assert.ok(shoulder);
    vecNear(j.child.userTorque(),shoulder.reactions.child,1e-4);vecNear(j.parent.userTorque(),shoulder.reactions.parent,1e-4);
    for(const row of rows){vecNear(row.torqueClosure,{x:0,y:0,z:0});near(row.recipientPowerW,row.effectivePairPowerW,1e-7);assert.ok(Number.isFinite(row.recipientPowerW));}
    assert.equal(module.diagnosticInfo(f).errors.length,0);
    return {variant,condition:{injured,zero,rotate,gravityCompensationOverrideZero:true,nativeBodySettersOnly:true,physicalWorldNotStepped:true},rows};
  }finally{module.setDiagnostics(f,null);G.world.free();}
}
try{
  await test('guarded observational clone restores original Fighter text exactly',async()=>{
    const source=await readFile(new URL('src/fighter.js',root),'utf8');
    const transformed=transformArmCapacityFighter(source);
    assert.throws(()=>transformArmCapacityFighter(transformed),/already transformed/);
    assert.throws(()=>transformArmCapacityFighter(source.replace('    torque.add(twist);','')),{message:/Expected exactly one/});
    const recovered=transformed.slice(transformed.indexOf(source.slice(0,100)))
      .replace(/^    const armCapacity(?:ShoulderPreFinal|WristPrecap|WristPreFinal) = .*;\n/gm,'')
      .replace(/^    armCapacityObserve\(this,.*\n/gm,'');
    assert.equal(recovered,source);return {exactRecovered:true};
  });
  await test('prepared actual source and observed clone traces are exact with diagnostics',()=>{
    const rows=[],original=preparedRun(null),clone=preparedRun('clone',d=>rows.push(d));
    assert.equal(original.checkpoint,clone.checkpoint);assert.deepEqual(original.frames,clone.frames);
    assert.equal(clone.summary.driveSwordCalls,100);assert.equal(clone.summary.manualMuscleCalls,100);
    assert.equal(rows.length,200);assert.equal(clone.summary.errors.length,0);
    assert.ok(clone.paths.some(p=>p.includes('manualMuscle')));assert.ok(clone.paths.some(p=>p.includes('driveSword')));
    return {preparationFrames:30,observedFrames:100,traceExact:true,traceSha256:hash(JSON.stringify(clone.frames)),summary:clone.summary};
  });
  await test('static single-sword fixtures cap final vectors and preserve torque and power closure',()=>{
    const results=[];
    for(const variant of ['clone','finalCap','portHill','combined'])for(const condition of [{},{injured:true},{zero:true,rotate:false}]){
      const result=fixture(variant,condition);results.push(result);
      for(const row of result.rows)if(['finalCap','combined'].includes(variant))assert.ok(row.finalNorm<=row.capNm+1e-9);
      if(condition.zero)for(const row of result.rows){near(row.finalNorm,0);near(row.recipientPowerW,0);assert.ok(Number.isFinite(row.hillVelocity??0));}
      if(['portHill','combined'].includes(variant)){
        const wrist=result.rows.find(r=>r.actuator==='wrist'),T=V(wrist.precapTorque);
        const expected=T.length()>1e-6?T.dot(V(wrist.velocities.child).sub(V(wrist.velocities.effectiveParent)))/T.length():0;
        near(wrist.hillVelocity,expected,1e-7);
      }
    }
    const original=results.find(r=>r.variant==='clone'&&!r.condition.injured&&!r.condition.zero);
    assert.ok(original.rows.some(r=>r.finalNorm>r.capNm+1e-6),'Fixture must expose an original post-cap addition');
    return {classification:'Static synthetic source-algebra/native-accumulator fixtures, not motion naturalness or total-muscle-work evidence.',results};
  });
  await test('diagnostic callback exceptions are explicitly reported for a mandatory caller failure gate',()=>{
    const r=preparedRun('clone',()=>{throw Error('intentional diagnostic failure');});
    assert.equal(r.summary.errors.length,200);assert.ok(r.summary.errors.every(e=>e.includes('intentional diagnostic failure')));
    return {diagnosticErrorsReported:r.summary.errors.length,callerMustRejectNonemptyErrors:true,actuatorContinues:true};
  });
}finally{await modules.cleanup();}
const after=await manifest(),sourceStable=JSON.stringify(before)===JSON.stringify(after);
const result={schemaVersion:1,createdUTC:new Date().toISOString(),command:'node tools/sim/experiments/arm_capacity_candidate.test.mjs '+output,
  scope:modules.scope,sourceHashes:modules.sourceHashes,sourceBefore:before,sourceAfter:after,sourceStable,
  pass:sourceStable&&tests.every(t=>t.pass),tests};
await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({output,pass:result.pass,sourceStable,tests:tests.length,failed:tests.filter(t=>!t.pass).map(t=>t.name)}));
process.exitCode=result.pass?0:1;
