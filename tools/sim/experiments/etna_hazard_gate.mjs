// Native sensor/thermal injury and real Fighter walking/knee descent.
// Poses and commands are explicit test fixtures, never a player success rate.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { RAPIER as R, newRound, DT } from '../harness_m.mjs';
import { GROUND_GROUPS } from '../../../src/fighter.js';
import { ETNA, LAVA_BURN, createArenaGround, applyTerrainHazards } from '../../../src/etna_ground.js';
const out = process.argv[2]; assert(out?.startsWith('/tmp/') && !fs.existsSync(out));
const cases = [], runs = []; let failure;
function check(name, fn) { fn(); cases.push(name); }
function fixture({ above = -.001, parts = ['footF'], kind = 'body', detached = false, dt = DT } = {}) {
  const world = new R.World({x:0,y:0,z:0}); world.timestep = dt;
  const env = createArenaGround(R,world,GROUND_GROUPS,{stageId:'etna',walls:false});
  const f = { state:'stand', pain:0, blood:1, bleed:0, wounds:[], bodies:{}, limbs:{legF:1,legB:1,armS:1,armO:1},
    detachedParts:new Set(detached?parts:[]), armed:true, revival:null,
    get alive(){return this.state!=='dead';},
    get legsCannotSupport(){return !!this.lavaBurn?.legs.some(k=>this.limbs[k]<.25);},
    knockDown(){this.state='getup';}, dropSword(){this.armed=false;}, die(cause,final){this.state='dead';this.causeOfDeath=cause;this.final=final;} };
  const info = new Map();
  for (const [i,part] of parts.entries()) {
    const body=world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(i*.1,ETNA.lavaLevel+.02+above,6));
    const col=world.createCollider(R.ColliderDesc.cuboid(.02,.02,.02).setCollisionGroups(GROUND_GROUPS),body);
    f.bodies[part]=body;info.set(col.handle,{fighter:f,kind,part,body});
  }
  return {world,env,f,info,tick(){world.step();return applyTerrainHazards(env,info,dt);},close(){world.free();}};
}
try {
  for (const [name,opts,burn] of [['above surface',{above:.001},false],['native foot overlap',{},true],
    ['head overlap no instant death',{parts:['head']},true],['weapon only',{kind:'weapon',parts:['blade']},false],
    ['detached arm',{parts:['farmO'],detached:true},false]]) check(name,()=>{
      const q=fixture(opts);try{q.tick();assert(q.f.alive);assert.equal(!!q.f.lavaBurn,burn);
        if(burn){assert(q.f.pain>0);assert.equal(q.f.blood,1);assert.equal(q.f.bleed,0);assert.equal(q.f.wounds[0].type,'burn');}}
      finally{q.close();}
    });
  check('exposed limb only; knee transition; one wound per part',()=>{
    const q=fixture();try{for(let i=0;i<120;i++)q.tick();assert(q.f.alive);assert.equal(q.f.state,'getup');
      assert.equal(q.f.limbs.legF,0);assert.equal(q.f.limbs.legB,1);assert.equal(q.f.wounds.length,1);assert(q.f.pain>=1);}
    finally{q.close();}
  });
  check('multiple colliders on one leg do not multiply limb damage',()=>{
    const a=fixture(),b=fixture({parts:['footF','shinF','thighF']});try{for(let i=0;i<12;i++){a.tick();b.tick();}
      assert(Math.abs(a.f.limbs.legF-b.f.limbs.legF)<1e-10);}finally{a.close();b.close();}
  });
  check('simulation-step independent dose',()=>{
    const a=fixture({dt:1/60}),b=fixture({dt:1/120});try{for(let i=0;i<12;i++)a.tick();for(let i=0;i<24;i++)b.tick();
      assert(Math.abs(a.f.limbs.legF-b.f.limbs.legF)<1e-6);assert(Math.abs(a.f.lavaBurn.exposure-b.f.lavaBurn.exposure)<1e-6);}
    finally{a.close();b.close();}
  });
  check('leaving stops damage and cools; leg injury persists',()=>{
    const q=fixture();try{for(let i=0;i<60;i++)q.tick();const leg=q.f.limbs.legF;
      const p=q.f.bodies.footF.translation();q.f.bodies.footF.setTranslation({...p,y:p.y+2},true);
      for(let i=0;i<1200;i++)q.tick();assert(q.f.alive);assert.equal(q.f.limbs.legF,leg);
      assert.equal(q.f.lavaBurn.inLava,false);assert.equal(q.f.lavaBurn.exposure,0);}
    finally{q.close();}
  });
  check('sustained heat kills after six seconds, not first contact',()=>{
    const q=fixture();try{q.f.revival={active:true};for(let i=0;i<Math.floor(5.5/DT);i++)q.tick();assert(q.f.alive);
      while(q.f.alive)q.tick();assert(q.f.lavaBurn.contactTime>=LAVA_BURN.fatalExposureSeconds);
      assert(q.f.lavaBurn.contactTime<LAVA_BURN.fatalExposureSeconds+2*DT);assert.equal(q.f.revival,null);assert(q.f.final);}
    finally{q.close();}
  });
  check('ordinary floor has no thermal damage',()=>{
    const w=new R.World({x:0,y:-9.81,z:0});try{const e=createArenaGround(R,w,GROUND_GROUPS);assert.equal(e.terrain,null);assert.deepEqual(applyTerrainHazards(e,new Map()),[]);}finally{w.free();}
  });
  for(const who of ['player','enemy'])check('actual '+who+' initial contact survives with thermal injury',()=>{
    const g=newRound({seed:24,stageId:'etna',playerZ:who==='player'?6:0,enemyZ:who==='enemy'?6:0});
    try{for(let i=0;i<3;i++)g.step();const f=g[who];assert(f.alive&&f.lavaBurn);assert(f.pain>0);assert(f.wounds.some(w=>w.type==='burn'));}
    finally{g.eventQueue.free();g.world.free();}
  });
  check('actual downhill manual input reaches lava and physically lowers to knees',()=>{
    const g=newRound({seed:31,stageId:'etna',heading:-Math.PI/2,weapon:'longsword'});
    try{g.park();g.faceP={x:-2.8,y:0,z:100};const f=g.player;let contact=null,heightBefore=0,lowest=Infinity,legMin=1,atTwo=null;
      for(let i=0;i<1600;i++){
        g.before=()=>f.move.set(0,i<240||contact!==null?0:1);g.step();
        const p=f.bodies.pelvis.translation(),height=p.y-f.groundHeightAt(p.x,p.z);
        if(!f.lavaBurn)heightBefore=height;
        if(f.lavaBurn&&contact===null){contact=g.t;assert(f.alive);}
        if(contact!==null){lowest=Math.min(lowest,height);legMin=Math.min(legMin,f.legHealth);
          if(!atTwo&&g.t-contact>=2){atTwo={state:f.state,alive:f.alive,kneel:f.kneelAmount,height,legHealth:f.legHealth,redFromPain:Math.min(1,f.pain)*.35};}
          if(g.t-contact>8)break;
        }
      }
      assert(contact!==null);assert(atTwo.alive);assert(atTwo.kneel>.9);assert(heightBefore-lowest>.18);assert(legMin<.65);assert(atTwo.redFromPain>.3);
      runs.push({contactSeconds:contact,heightBefore,lowestPelvisHeight:lowest,atTwo,finalState:f.state,heatExposure:f.lavaBurn.exposure,cause:f.causeOfDeath});
    }finally{g.eventQueue.free();g.world.free();}
  });
}catch(e){failure={message:e.message,stack:e.stack};process.exitCode=1;}
const sources=Object.fromEntries(['src/etna_ground.js','src/fighter.js','src/gait.js','tools/sim/harness_m.mjs','tools/sim/experiments/etna_hazard_gate.mjs'].map(p=>[p,createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
fs.writeFileSync(out,JSON.stringify({pass:!failure,completedUTC:new Date().toISOString(),cases,runs,failure,sources},null,2));
console.log(JSON.stringify({pass:!failure,cases:cases.length,runs,failure}));
