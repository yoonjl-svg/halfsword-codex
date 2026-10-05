/** Controlled wound replay, not a new natural collision injury sample. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {newRound,THREE,DT,CONFIG} from '../harness_m.mjs';
import {applySwordsmanship,recordSwordsmanshipInput} from '../../../src/swordsmanship.js';
import {mainArmMuscle} from '../../../src/arm_recovery_activation.js';
import {plain,controls,selectedState,V,norm} from './round4_integrated_observer.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const args=Object.fromEntries(process.argv.slice(2).map(a=>{const m=/^--(out|plan)=(.+)$/.exec(a);assert(m);return[m[1],m[2]];}));
assert(args.out&&args.plan&&path.isAbsolute(args.out)&&path.isAbsolute(args.plan)&&!fs.existsSync(args.out));
const sha=b=>createHash('sha256').update(b).digest('hex');
const source=JSON.parse(fs.readFileSync(path.join(root,'SOURCE.json'))),planBytes=fs.readFileSync(args.plan),plan=JSON.parse(planBytes);
const manifest=()=>Object.fromEntries(Object.keys(source.files).sort().map(p=>[p,sha(fs.readFileSync(path.join(root,p)))]));
const sourceBefore=manifest();assert.deepEqual(sourceBefore,source.files);
assert.equal(plan.kind,'controlled_wound_replay_diagnostic');assert.equal(plan.steps,961);
assert.equal(CONFIG.PHYSICS.gravity,-9.81);assert.equal(CONFIG.GAIT.stanceMemory,'legacy');
for(const w of Object.values(plan.wounds)){const b=fs.readFileSync(w.reference.path);assert.equal(b.length,w.reference.bytes);assert.equal(sha(b),w.reference.sha256);}
const tape=plan.tape.flatMap(p=>Array.from({length:p.steps},(_,i)=>({phase:p.phase,phaseTick:i,dx:p.delta[0]/p.steps,dy:p.delta[1]/p.steps,held:p.held})));assert.equal(tape.length,180);
function requestAt(tick){
 if(tick>=plan.firstManualTick&&tick<plan.firstManualTick+tape.length)return{...tape[tick-plan.firstManualTick],cycle:'immediate'};
 if(tick>=plan.secondManualTick&&tick<plan.secondManualTick+tape.length)return{...tape[tick-plan.secondManualTick],cycle:'pain_recovered_window'};
 if(tick>=240&&tick<276)return{phase:'prepare_raise',cycle:'pre_injury',dx:-.28/36,dy:.38/36,held:true};
 return{phase:tick<plan.firstManualTick?'prepare_hold':'quiet_wait',cycle:tick<plan.firstManualTick?'pre_injury':'quiet',dx:0,dy:0,held:tick<plan.firstManualTick};
}
class IdleOpponent {constructor(me){this.me=me;}update(){}}
const health=f=>({state:f.state,stateTime:f.stateTime,alive:f.alive,armed:f.armed,gripValid:!!f.gripJoint?.isValid(),offGripValid:!!f.offGripJoint?.isValid(),armHealth:f.armHealth,limbs:{...f.limbs},pain:f.pain,blood:f.blood,bleed:f.bleed,balance:f.balance,muscle:f.muscle,armMuscle:mainArmMuscle(f),vigor:f.vigor,strength:f.strength});
const assist=f=>({version:f.swordsmanshipState?.version,phase:f.swordsmanshipState?.phase,owner:f.swordsmanshipState?.owner,eligible:f.swordsmanshipState?.eligible,availability:f.swordsmanshipState?.availability,input:plain(f.swordsmanshipState?.input),generatedDX:f.swordsmanshipState?.generatedDX,generatedDY:f.swordsmanshipState?.generatedDY,handCorrection:f.swordsmanshipState?.handCorrection?.toArray(),tap:plain(f.skill.tap),thrustW:f.skill.thrustPose.w,finishAmt:f.finish.amt});
const rows=[],startedUTC=new Date().toISOString(),start=performance.now(),random=Math.random;
let signal=null,error=null;const stop=()=>{signal='interrupt';};process.on('SIGINT',stop);process.on('SIGTERM',stop);fs.mkdirSync(args.out,{recursive:true});

async function run(weapon,level){
 const row={key:weapon+'-'+level,weapon,level,steps:0,frames:[],metrics:[],requests:[],drive:[],injuries:[],error:null,checks:{finite:true,inputAccepted:true,inputConsumed:true,ordinaryV2:true,noOpponentAttack:true,controlledInjuryExact:true}};rows.push(row);
 let G,tick=0,activeDrive=null,lastAimTick=null;
 try{
  G=newRound({seed:7,weapon,weapon2:'longsword',walls:false,gap:5.6,AIClass:IdleOpponent,onFighter:f=>{
   if(f.index!==0)return;f.onehandArmModel='manual';f.canShove=true;
   const drive=f.driveSword;f.driveSword=function(...args){
    const previous=this.prevAim?.clone(),before=health(this);
    activeDrive={tick,before,assistBefore:assist(this),previousAim:previous?.toArray()??null,previousAimTick:lastAimTick,previousAimAgeSteps:lastAimTick===null?null:tick-lastAimTick,calls:[]};
    try{return drive.apply(this,args);}finally{
     const called=activeDrive.calls.some(c=>c.part==='sword');
     const blade=new THREE.Vector3(0,1,0).applyQuaternion(new THREE.Quaternion().copy(this.sword.rotation()));
     const actualAim=this.debug.aim.clone(),omega=new THREE.Vector3().copy(this.sword.angvel());
     const estimatedRaw=called&&previous?new THREE.Vector3().crossVectors(previous,actualAim).divideScalar(DT):new THREE.Vector3();
     const estimatedCapped=estimatedRaw.clone().clampLength(0,25);estimatedCapped.addScaledVector(blade,-estimatedCapped.dot(blade));
     const swing=omega.clone().addScaledVector(blade,-omega.dot(blade)),preTwist=this.debug.wristTorque.clone();
     const axis=new THREE.Vector3().crossVectors(blade,actualAim),sinA=axis.length();
     activeDrive.after={called,health:health(this),assist:assist(this),prevAim:this.prevAim?.toArray()??null,aim:actualAim.toArray(),blade:blade.toArray(),wristBrake:!!this.wristBrake,wristHill:this.wristHill,aimErrorRad:blade.angleTo(actualAim),towardRadps:sinA>1e-5?swing.dot(axis)/sinA:null,wSwing:swing.toArray(),swingOmegaRadps:swing.length(),axialOmegaRadps:omega.dot(blade),preTwistTorqueNm:preTwist.toArray(),preTwistMagnitudeNm:preTwist.length(),wristCapNm:this.debug.wristCap??null,expectedWristCapNm:called?this.weaponCfg.maxAimTorque*this.strength*mainArmMuscle(this)*(.35+.65*this.armHealth)*this.wristHill:null,preTwistSwingPowerW:called?preTwist.dot(swing):null,reconstructedAimRateRawRadps:estimatedRaw.length(),reconstructedAimRateAfterCapAndProjection:estimatedCapped.toArray(),earlyReturnLowMuscle:mainArmMuscle(this)<.12,earlyReturnUnarmed:!this.armed};
     if(called)lastAimTick=tick;row.drive.push(activeDrive);activeDrive=null;
    }
   };
   for(const[part,body]of [['sword',f.sword],['farmS',f.bodies.farmS],['chest',f.bodies.chest]]){const add=body.addTorque;body.addTorque=function(...a){if(activeDrive)activeDrive.calls.push({part,torqueNm:V(a[0]),magnitudeNm:norm(a[0]),omegaAtCall:V(body.angvel()),rotationalPowerW:a[0].x*body.angvel().x+a[0].y*body.angvel().y+a[0].z*body.angvel().z});return add.apply(this,a);};}
  }});
  assert(applySwordsmanship(G.player));G.combat.cutReactionModel='legacy';G.combat.cutReactionFighter=null;
  row.creationNative=sha(G.world.takeSnapshot());row.creationControl=sha(JSON.stringify([controls(G.player),controls(G.enemy)]));
  let supplied=null;
  G.before=()=>{
   const f=G.player,r=requestAt(tick),dx=f.alive?r.dx:0,dy=f.alive?r.dy:0,active=Math.abs(r.dx)+Math.abs(r.dy)>1e-5;
   f.handOffset.x+=dx;f.handOffset.y+=dy;f.handHeld=r.held;f.inputActive=active;f.move.set(0,0);f.stickX=f.stickY=0;
   supplied={id:tick,timeS:G.t,dx,dy,held:r.held,active};const accepted=recordSwordsmanshipInput(f,supplied);row.checks.inputAccepted&&=accepted;
   row.requests.push({tick,...r,supplied:{...supplied},accepted,before:health(f)});
  };
  for(tick=0;tick<plan.steps;tick++){
   if(tick%120===0)await new Promise(r=>setImmediate(r));if(signal)throw Error('Interrupted; partial row retained');
   G.step();
   if(tick===plan.injuryAfterStep&&level!=='healthy'){
    const spec=plan.wounds[level];
    for(let i=0;i<spec.count;i++){
     const f=G.player,nativeBefore=sha(G.world.takeSnapshot()),before=health(f);
     const wound={part:spec.part,type:spec.type,zone:spec.zone,severity:spec.severity,energy:spec.energy,bleedPerSev:CONFIG.ANATOMY.arm.bleed,local:new THREE.Vector3(),point:new THREE.Vector3().copy(f.bodies.farmS.translation()),dir:new THREE.Vector3(0,-1,0),pass:true,passing:true,stuck:false,helmet:false,plate:false,finish:false};
     f.applyWound(wound);
     const nativeAfter=sha(G.world.takeSnapshot());row.injuries.push({tick,replayIndex:i,before,after:health(f),request:plain(wound),nativeBefore,nativeAfter,nativeUnchanged:nativeBefore===nativeAfter,scope:'Controlled API wound, no collision impulse. Local center and direction are fixture inputs, not recovered historical impact geometry.'});
    }
    row.checks.controlledInjuryExact&&=Math.abs(G.player.armHealth-spec.expectedArmHealth)<1e-12&&G.player.alive&&G.player.armed&&G.player.gripJoint.isValid()&&row.injuries.every(i=>i.nativeUnchanged);
   }
   const f=G.player,state=selectedState(G),tip=f.bladePoint(1,new THREE.Vector3()),q=new THREE.Quaternion().copy(f.bodies.farmS.rotation()),hand=new THREE.Vector3(.13,0,0).applyQuaternion(q).add(new THREE.Vector3().copy(f.bodies.farmS.translation()));
   const swordContacts=[];for(const col of f.swordColliders)G.world.contactPairsWith(col,other=>G.world.contactPair(col,other,m=>{if(m.numContacts())swordContacts.push({collider:col.handle,other:other.handle,otherFighter:G.combat.info.get(other.handle)?.fighter?.index??null,points:Array.from({length:m.numContacts()},(_,i)=>({distance:m.contactDist(i),impulse:m.contactImpulse(i)}))});}));
   row.metrics.push({tick,request:requestAt(tick),...state,player:health(f),assist:assist(f),actualHand:hand.toArray(),handTarget:f.handTarget.toArray(),handErrorM:hand.distanceTo(f.handTarget),tipSpeedMps:norm(f.sword.velocityAtPoint(tip)),actualHandSpeedMps:norm(f.bodies.farmS.velocityAtPoint(hand)),swordContacts});
   row.frames.push([tick,sha(G.world.takeSnapshot()),sha(JSON.stringify([controls(f),controls(G.enemy)])),sha(JSON.stringify(supplied))]);row.steps=row.frames.length;
   row.checks.finite&&=G.world.bodies.getAll().every(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].every(v=>Object.values(v).every(Number.isFinite)));assert(row.checks.finite,'Nonfinite');
   row.checks.inputConsumed&&=JSON.stringify(f.swordsmanshipState.input)===JSON.stringify(supplied);
   row.checks.ordinaryV2&&=f.swordsmanshipState.version==='unified-20261005-r2'&&f.skill.level===0&&f.skill.autoGuard===false&&f.stanceMemoryModel!=='fresh'&&G.combat.cutReactionModel==='legacy'&&G.world.gravity.y===-9.81;
   row.checks.noOpponentAttack&&=G.wounds.length===0;
  }
 }catch(e){row.error={message:e.message,stack:e.stack};}
 finally{
  if(G){row.final=health(G.player);row.combatWounds=G.wounds.map(w=>({timeS:w.t,attacker:w.att.index,victim:w.vic.index,energyJ:w.energy,severity:w.severity}));}
  G?.eventQueue.free();G?.world.free();const p=path.join(args.out,row.key+'.json');fs.writeFileSync(p,JSON.stringify(row)+'\n');const b=fs.readFileSync(p);row.artifact={path:p,bytes:b.length,sha256:sha(b)};
  console.log(JSON.stringify({key:row.key,steps:row.steps,error:row.error,checks:row.checks,final:row.final}));
 }
}
try{for(const weapon of plan.weapons)for(const level of plan.levels){if(signal)break;await run(weapon,level);}}catch(e){error={message:e.message,stack:e.stack};}
finally{
 process.off('SIGINT',stop);process.off('SIGTERM',stop);Math.random=random;
 const comparisons=plan.weapons.map(weapon=>{const group=rows.filter(r=>r.weapon===weapon),base=group.find(r=>r.level==='healthy');return{weapon,rows:group.filter(r=>r.level!=='healthy').map(r=>({key:r.key,creationNativeExact:r.creationNative===base?.creationNative,creationControlExact:r.creationControl===base?.creationControl,prefixThrough299Exact:!!base&&r.frames.slice(0,plan.injuryAfterStep).every((f,i)=>JSON.stringify(f)===JSON.stringify(base.frames[i])),allRequestedInputsExact:!!base&&r.frames.every((f,i)=>f[3]===base.frames[i]?.[3]),firstNativeDifference:base?r.frames.find((f,i)=>f[1]!==base.frames[i]?.[1])?.[0]??null:null}))};});
 const sourceAfter=manifest(),sourceStable=JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter),measurementValid=!error&&sourceStable&&rows.length===6&&rows.every(r=>!r.error&&r.steps===plan.steps&&Object.values(r.checks).every(Boolean))&&comparisons.every(g=>g.rows.every(r=>r.creationNativeExact&&r.creationControlExact&&r.prefixThrough299Exact&&r.allRequestedInputsExact));
 const report={head:source.head,source,sourceBefore,sourceAfter,sourceStable,measurementValid,error,startedUTC,completedUTC:new Date().toISOString(),wallSeconds:(performance.now()-start)/1000,command:process.argv,plan:{path:args.plan,bytes:planBytes.length,sha256:sha(planBytes),data:plan},executionCount:rows.length,steps:rows.reduce((n,r)=>n+r.steps,0),comparisons,rows:rows.map(r=>({key:r.key,weapon:r.weapon,level:r.level,steps:r.steps,checks:r.checks,error:r.error,artifact:r.artifact,final:r.final}))};
 const p=path.join(args.out,'report.json');fs.writeFileSync(p,JSON.stringify(report,null,2)+'\n');const b=fs.readFileSync(p);fs.writeFileSync(path.join(args.out,'receipt.json'),JSON.stringify({path:p,bytes:b.length,sha256:sha(b),measurementValid,executionCount:rows.length,steps:report.steps},null,2)+'\n');if(!measurementValid)process.exitCode=1;
}
