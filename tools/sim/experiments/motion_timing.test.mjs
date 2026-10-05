// Input licensing / continuity contracts; no simulated human or force claims.
import assert from 'node:assert/strict';
import { applyMotionTiming, recordMotionTimingInput, updateMotionTiming } from '../../../src/motion_timing.js';
const fixture = () => ({ index: 0, weapon: {id:'qinggang'}, weaponCfg:{twoHand:false},
  onehandArmModel:'manual',motionAssistModel:'coordinated', bodyPose:{pelvisYaw:0,chestYaw:0},
  alive:true,armed:true,state:'stand',armHealth:1,limbs:{armS:1,legF:1,legB:1},
  skill:{aimRaw:{x:.2,y:0},aim:{x:0,y:0},aimVel:{x:0,y:0},tap:null,thrustPose:{w:0}},finish:{amt:0} });
const setup = (mode='sequenced') => { const f=fixture(); assert(applyMotionTiming({active:true,comparison:'force',motionTiming:mode},f)); return f; };
const record = (f,id,timeS,dx=.01,dy=0,held=true,active=true) => recordMotionTimingInput(f,{id,timeS,dx,dy,held,active});
const step = f => updateMotionTiming(f,1/120,.01,.02,.15);
const rows=[];
const test=(name,fn)=>{fn();rows.push({name,pass:true});};
test('ordinary/opponent/nonmanual activation remains absent',()=>{
  for(const [key,value] of [['index',1],['onehandArmModel','legacy'],['motionAssistModel','none']]) {
    const f=fixture();f[key]=value;assert.equal(applyMotionTiming({active:true,comparison:'force',motionTiming:'sequenced'},f),false);
    assert.equal('motionTimingState' in f,false);
  }
  const f=fixture();assert.equal(applyMotionTiming({active:true,comparison:'motion',motionTiming:'sequenced'},f),false);
  assert.equal(record(f,0,0),false);assert.equal('motionTimingState' in f,false);
});
test('baseline input observation never substitutes body goals',()=>{
  const f=setup('baseline'),before=structuredClone(f.bodyPose);record(f,0,0);
  assert.equal(step(f),null);assert.deepEqual(f.bodyPose,before);assert.equal(f.motionTimingState.targetRefs.chest,.02);
});
test('zero-physics moving batch survives a later empty sample',()=>{
  const f=setup();assert(record(f,0,0));assert(record(f,1,.01,0,0,true,false));step(f);
  assert.equal(f.motionTimingState.phase,'drive');assert.equal(f.motionTimingState.batchCount,2);
});
test('repeated/stale/malformed batches do not renew intent',()=>{
  const f=setup();record(f,4,.1);assert.equal(record(f,4,.1),false);
  assert.equal(record(f,3,.2),false);assert.equal(record(f,5,.09),false);assert.equal(record(f,5,.2,NaN),false);
  for(let i=0;i<30;i++)step(f);
  assert.equal(f.motionTimingState.consumeCount,1);assert.equal(f.motionTimingState.phase,'brake');
});
test('opposite fresh request takes reverse path immediately',()=>{
  const f=setup();record(f,0,0);step(f);f.skill.aimVel.x=1;
  record(f,1,.01,-.01);step(f);assert.equal(f.motionTimingState.phase,'reverse');
  assert.equal(f.motionTimingState.targetRefs.stageChest,.02);
});
test('release withdraws sequencing despite recently moving input',()=>{
  const f=setup();record(f,0,0);step(f);record(f,1,.01,0,0,false,false);step(f);
  assert.equal(f.motionTimingState.phase,'brake');assert.equal(f.motionTimingState.targetRefs.stageChest,.02);
});
test('pointer-lock mouse movement does not need a held touch',()=>{
  const f=setup();record(f,0,0,.01,0,false,true);step(f);assert.equal(f.motionTimingState.phase,'drive');
});
test('special commands/injury retain continuous baseline reference',()=>{
  for(const alter of [f=>f.skill.tap={},f=>f.skill.thrustPose.w=.5,f=>f.finish.amt=.2,f=>f.state='getup',f=>f.armHealth=.5,f=>f.limbs.legF=.4,f=>f.armed=false]) {
    const f=setup();record(f,0,0);step(f);const before=f.motionTimingState.chestReference;
    alter(f);record(f,1,.01);const r=step(f);
    assert.notEqual(f.motionTimingState.phase,'drive');assert.equal(r.stageChest,.02);
    assert.equal(r.extraChestYaw,0,'Special command owns the unmodified chest goal');
    assert.equal(r.chest,.02);
    assert.deepEqual(f.bodyPose,{pelvisYaw:0,chestYaw:0});
  }
});
test('pause-size input-time gap cannot revive stale drive',()=>{
  const f=setup();record(f,0,0);step(f);record(f,1,60,0,0,false,false);step(f);
  assert.notEqual(f.motionTimingState.phase,'drive');
  const pending=setup();record(pending,0,0);record(pending,1,60,0,0,true,false);step(pending);
  assert.notEqual(pending.motionTimingState.phase,'drive','Stale zero-step movement cannot become a new stroke');
});
test('30/60Hz empty render samples retain a continuous moving intent',()=>{
  for(const stride of [2,4]){
    const f=setup();let id=0;
    for(let i=0;i<48;i++){
      if(i%2===0)record(f,id++,i/120,i%stride===0?.02:0,0,true,i%stride===0);
      step(f);assert.equal(f.motionTimingState.phase,'drive');
    }
  }
});
test('reference remains finite/bounded without repeated-batch pumping',()=>{
  const f=setup();record(f,0,0);for(let i=0;i<120;i++){f.bodyPose.pelvisYaw=.5;const r=step(f);
    assert(Number.isFinite(r.chest));assert(Math.abs(r.chest)<=.62*.35*.15+1e-12);
  }
  assert.equal(f.motionTimingState.consumeCount,1);
});
test('lagging pelvis does not supply an independent stored drive',()=>{
  const f=setup();f.motionTimingState.chestReference=.01;f.bodyPose.pelvisYaw=.015;
  record(f,0,0,-.01);f.skill.aimVel.x=-1;
  const r=updateMotionTiming(f,1/120,-.01,-.02,.15);
  assert.equal(r.chest,-.02);assert(r.extraChestYaw<0,'Current hand filter gap supplies the lead; lagging pelvis supplies none');
});
test('bounded lead uses current filter gap and decays without renewed input',()=>{
  const f=setup();f.skill.aimRaw.x=10;f.skill.aim.x=-10;
  for(let i=0;i<60;i++){record(f,i,i/120);step(f);}
  const lead=f.motionTimingState.extraChestYaw;
  assert(lead<0 && Math.abs(lead)<=2*Math.PI/180);
  record(f,60,.5,0,0,false,false);
  step(f);assert.equal(f.motionTimingState.targetRefs.requestedExtraChestYaw,0);
  assert(Math.abs(f.motionTimingState.extraChestYaw)<Math.abs(lead));
  for(let i=0;i<120;i++)step(f);
  assert(Math.abs(f.motionTimingState.extraChestYaw)<1e-10);
});
console.log(JSON.stringify({pass:true,groups:rows.length,rows,scope:'Input licensing and reference contracts only; no physics/performance validation'}));
