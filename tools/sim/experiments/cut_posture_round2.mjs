/** Read-only actual game posture regression. Production sources/engine stay frozen. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {newRound, AI, DT, THREE, CONFIG, handPos} from '../harness_m.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const args=Object.fromEntries(process.argv.slice(2).map(s=>{const m=/^--(seconds|seeds|out)=(.+)$/.exec(s);if(!m)throw Error('Use --seconds/seeds/out=value');return [m[1],m[2]];}));
const seconds=Number(args.seconds??20),seeds=(args.seeds??'7,17').split(',').map(Number),out=args.out??root+'docs/strike/cut_posture_round2.json';
if(!(seconds>0)||seeds.some(x=>!Number.isInteger(x)))throw Error('Invalid options');
if([out,out+'.runs.jsonl'].some(p=>fs.existsSync(p)))throw Error('Preserve prior evidence with new --out');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
function files(d){return fs.readdirSync(root+d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(d+'/'+e.name):e.name.endsWith('.js')?[d+'/'+e.name]:[]);}
const tracked=[...files('src'),'tools/sim/harness_m.mjs','package-lock.json','node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm'];
const manifest=()=>Object.fromEntries(tracked.sort().map(p=>[p,sha(fs.readFileSync(root+p))]));
function head(){const h=fs.readFileSync(root+'.git/HEAD','utf8').trim();return h.startsWith('ref: ')?fs.readFileSync(root+'.git/'+h.slice(5),'utf8').trim():h;}
const sourceBefore=manifest(),sourceCommit=head(),begin=performance.now(),random=Math.random;
const V=x=>new THREE.Vector3(x.x,x.y,x.z),Q=x=>new THREE.Quaternion(x.x,x.y,x.z,x.w),norm=x=>Math.hypot(x.x,x.y,x.z);
const tilt=b=>Math.acos(Math.max(-1,Math.min(1,new THREE.Vector3(0,1,0).applyQuaternion(Q(b.rotation())).y)));
const context=f=>({index:f.index,state:f.state,alive:f.alive,armed:f.armed,gripping:!!f.gripping,blood:f.blood,consciousness:f.consciousness,limbs:{...f.limbs},weaponBroken:!!f.weaponBroken});
const input=G=>[G.player,G.enemy].map(f=>({hand:f.handOffset.toArray(),held:f.handHeld,active:f.inputActive,move:f.move.toArray(),level:f.skill.level}));
function bodies(G){const x=[];G.world.forEachRigidBody(b=>x.push({h:b.handle,p:b.translation(),q:b.rotation(),v:b.linvel(),w:b.angvel(),F:b.userForce(),T:b.userTorque()}));return x;}
function control(G){return [G.player,G.enemy].map(f=>({...context(f),hand:f.handOffset.toArray(),target:f.handTarget.toArray(),aim:f.skill.aim.toArray(),follow:f.skill.follow.toArray(),heading:f.heading,joints:f.joints.map(j=>[j.name,j.target.toArray(),j.prevRV?.toArray()]),gait:[f.gait.levH,f.gait.levC]}));}
function run(cut,skill,seed,observed=true){
 const start=performance.now();let G;const transitions=[],wounds=[],cutEvents=[],samples=[],physics=[],inputs=[];
 const stats={stateSeconds:[{},{}],falls:[0,0],getups:[0,0],deaths:[0,0],aliveStandSeconds:[0,0],chestTiltAliveStandMaxRad:[0,0],chestTiltAliveStandRmsRad:[0,0],pelvisTiltAliveStandMaxRad:[0,0],handErrorAliveArmedMaxM:[0,0],swordAngularAliveArmedMaxRadps:[0,0],maxBodyAngularRadps:0,angularPeak:null,minPelvisAliveM:[Infinity,Infinity],maxJointGapM:[0,0],finite:true,positiveCutCalls:0,firstCutFrame:null};
 const tiltSq=[0,0],standFrames=[0,0];let frame=-1;
 try{
  G=newRound({seed,walls:true,weapon:'zweihander',weapon2:'longsword',AIClass:AI,AI2Class:AI,difficulty:'normal'});
  // AI2 provides responsive combat input; restore requested player skill after its constructor.
  G.player.skill.level=skill;G.player.skill.autoGuard=true;
  for(const f of [G.player,G.enemy])f.armTorqueModel='legacy';
  G.combat.cutReactionModel='legacy';
  for(let n=0;n<Math.round(1/DT);n++)G.step();
  const checkpoint={native:sha(G.world.takeSnapshot()),control:sha(JSON.stringify(control(G))),input:sha(JSON.stringify(input(G)))};
  G.combat.cutReactionModel=cut;
  if(observed){
   G.combat.onCutReaction=d=>{if(d.J>0){stats.positiveCutCalls++;stats.firstCutFrame??=frame;if(cutEvents.length<12)cutEvents.push({frame,timeS:G.t,diagnostic:d,contexts:[context(G.player),context(G.enemy)]});}};
   G.onWound=(a,v,r)=>wounds.push({frame,timeS:G.t,attacker:a.index,victim:v.index,part:r.part,zone:r.zone,type:r.type,energy:r.energy,severity:r.severity,victimContext:context(v)});
  }
  let previous=[G.player.state,G.enemy.state];
  for(frame=0;frame<Math.round(seconds/DT);frame++){
   G.step();const native=bodies(G);
   physics.push(sha(JSON.stringify({native,control:control(G),cuts:[...G.combat.cutting].map(([k,c])=>[k,c.seen,c.applied,c.Eleft,c.stuck])})));inputs.push(sha(JSON.stringify(input(G))));
   if(!observed)continue;
   for(const b of native){if(![b.p,b.q,b.v,b.w].every(x=>Object.values(x).every(Number.isFinite)))stats.finite=false;}
   const contexts=[context(G.player),context(G.enemy)];
   for(const f of [G.player,G.enemy]){
    const i=f.index;
    if(f.state!==previous[i]){transitions.push({frame,timeS:G.t,from:previous[i],to:f.state,...context(f)});if(f.state==='down')stats.falls[i]++;if(f.state==='getup')stats.getups[i]++;if(f.state==='dead')stats.deaths[i]++;previous[i]=f.state;}
    stats.stateSeconds[i][f.state]=(stats.stateSeconds[i][f.state]??0)+DT;
    if(f.alive)stats.minPelvisAliveM[i]=Math.min(stats.minPelvisAliveM[i],f.bodies.pelvis.translation().y);
    if(f.alive&&f.state==='stand'){const t=tilt(f.bodies.chest);standFrames[i]++;tiltSq[i]+=t*t;stats.chestTiltAliveStandMaxRad[i]=Math.max(stats.chestTiltAliveStandMaxRad[i],t);stats.pelvisTiltAliveStandMaxRad[i]=Math.max(stats.pelvisTiltAliveStandMaxRad[i],tilt(f.bodies.pelvis));}
    if(f.alive&&f.armed){stats.handErrorAliveArmedMaxM[i]=Math.max(stats.handErrorAliveArmedMaxM[i],handPos(f).distanceTo(f.handTarget));stats.swordAngularAliveArmedMaxRadps[i]=Math.max(stats.swordAngularAliveArmedMaxRadps[i],norm(f.sword.angvel()));}
    for(const [part,b]of [...Object.entries(f.bodies),['sword',f.sword]]){const w=norm(b.angvel());if(w>stats.maxBodyAngularRadps){stats.maxBodyAngularRadps=w;stats.angularPeak={frame,timeS:G.t,fighter:i,part,omega:b.angvel(),contexts};}}
    for(const j of [...f.joints.map(j=>j.joint),f.gripJoint])if(j?.isValid()){const a=V(j.anchor1()).applyQuaternion(Q(j.body1().rotation())).add(V(j.body1().translation())),b=V(j.anchor2()).applyQuaternion(Q(j.body2().rotation())).add(V(j.body2().translation()));stats.maxJointGapM[i]=Math.max(stats.maxJointGapM[i],a.distanceTo(b));}
   }
   if(frame%12===0)samples.push({frame,timeS:G.t,contexts,chestTiltRad:[G.player,G.enemy].map(f=>tilt(f.bodies.chest)),handErrorM:[G.player,G.enemy].map(f=>handPos(f).distanceTo(f.handTarget)),pelvisY:[G.player,G.enemy].map(f=>f.bodies.pelvis.translation().y)});
  }
  for(let i=0;i<2;i++){stats.aliveStandSeconds[i]=standFrames[i]*DT;stats.chestTiltAliveStandRmsRad[i]=standFrames[i]?Math.sqrt(tiltSq[i]/standFrames[i]):null;if(!Number.isFinite(stats.minPelvisAliveM[i]))stats.minPelvisAliveM[i]=null;}
  return {cut,skill,seed,observed,checkpoint,wallSeconds:(performance.now()-start)/1000,stats,transitions,wounds,cutEvents,samples,physics,inputs,final:[context(G.player),context(G.enemy)],woundHooks:G.wounds.length,clashes:G.clashes};
 }finally{G?.eventQueue.free();G?.world.free();Math.random=random;}
}
const runs=[],comparisons=[],observerChecks=[];
const first=(a,b)=>a.findIndex((x,i)=>x!==b[i]);
for(const seed of seeds)for(const skill of [0,.4,.7]){
 const group=[];for(const cut of ['legacy','budgeted']){const r=run(cut,skill,seed);runs.push(r);group.push(r);fs.appendFileSync(out+'.runs.jsonl',JSON.stringify(r)+'\n');console.log(JSON.stringify({cut,skill,seed,wallSeconds:r.wallSeconds,stats:r.stats,wounds:r.woundHooks}));}
 const [a,b]=group;comparisons.push({seed,skill,checkpointExact:JSON.stringify(a.checkpoint)===JSON.stringify(b.checkpoint),firstPhysicalControlDifferenceFrame:first(a.physics,b.physics),firstReactiveInputDifferenceFrame:first(a.inputs,b.inputs),firstBudgetedCutFrame:b.stats.firstCutFrame});
}
for(const cut of ['legacy','budgeted']){
 const a=runs.find(r=>r.seed===seeds[0]&&r.skill===0&&r.cut===cut),b=run(cut,0,seeds[0],false);
 observerChecks.push({seed:seeds[0],skill:0,cut,checkpointExact:JSON.stringify(a.checkpoint)===JSON.stringify(b.checkpoint),physicalControlTraceExact:JSON.stringify(a.physics)===JSON.stringify(b.physics),inputExact:JSON.stringify(a.inputs)===JSON.stringify(b.inputs),wallSeconds:b.wallSeconds});
}
const sourceAfter=manifest();
const report={createdUTC:new Date().toISOString(),sourceCommit,sourceCommitAfter:head(),command:process.argv,toolSHA256:sha(fs.readFileSync(fileURLToPath(import.meta.url))),wallSeconds:(performance.now()-begin)/1000,sourceBefore,sourceAfter,sourceStable:JSON.stringify(sourceBefore)===JSON.stringify(sourceAfter),configuration:{seconds,seeds,prepareS:1,skill:[0,.4,.7],weapon:'zweihander',foeWeapon:'longsword',foe:'default appearance; normal original AI with seeded random personality',walls:true,arms:'legacy both',cut:['legacy','budgeted'],grip:CONFIG.GRIP.reactionModel,body:CONFIG.BODY.supportModel,weightMode:CONFIG.BODY.weightMode,support:{assist:CONFIG.GAIT.assist,catchMode:CONFIG.GAIT.catchMode,catchScale:CONFIG.GAIT.catchScale},input:'Both original AI classes. Player level reset after AI2 construction. Player autoGuard true. Responsive AI diverges after physical differences; no manual wounds, knockdown, freeze or body injection.'},comparisons,observerChecks,runs,limitations:['Not user scene reproduction or mobile input. Player AI differs from human drag/stick and browser emotion/hitstop loop; skill selection does not turn player into human.', 'One seed is one starting scene, not independent samples for each mode or skill. Prepared native/control equal required only within each skill pair.', 'Stand means runtime state; chest tilt and hand errors observe posture only. No threshold defines naturalness or recovery success.', 'Peak angular speed identifies part and living/armed context. Damaged/dead spinning parts cannot certify control quality.', 'Targets precede solver; hand error measured after solver. Full native muscle/contact work and cut work not measured here. Prior cut-budget suite is separate evidence.']};
report.measurementValid=report.sourceStable&&report.sourceCommit===report.sourceCommitAfter&&comparisons.every(r=>r.checkpointExact)&&observerChecks.every(r=>r.checkpointExact&&r.physicalControlTraceExact&&r.inputExact)&&runs.every(r=>r.stats.finite);
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({out,measurementValid:report.measurementValid,wallSeconds:report.wallSeconds,comparisons,observerChecks}));if(!report.measurementValid)process.exitCode=1;
