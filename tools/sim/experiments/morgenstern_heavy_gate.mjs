/** Bounded heavy-Morgenstern verification using current native game modules.
 * Prepare: node tools/sim/experiments/morgenstern_heavy_gate.mjs --freeze=/outside/fresh-runtime
 * Execute the frozen copy: node .../morgenstern_heavy_gate.mjs --out=/outside/fresh-results --speed=6
 * Contact-only replacement: append --scope=contacts (never reruns freecuts/AI).
 * Six matched freecuts, eight isolated native impacts, then <=six short AI fixtures.
 * No damage injection, replacement controller, weapon edits, or coefficient search.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const own='tools/sim/experiments/morgenstern_heavy_gate.mjs';
const args=Object.fromEntries(process.argv.slice(2).map(x=>{const i=x.indexOf('=');assert(i>2);return[x.slice(2,i),x.slice(i+1)];}));
const sha=x=>createHash('sha256').update(x).digest('hex');
const scan=(base,dir)=>fs.readdirSync(path.join(base,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(base,dir+'/'+e.name):e.name.endsWith('.js')?[dir+'/'+e.name]:[]);
const deps=['node_modules/@dimforge/rapier3d-compat/rapier.mjs','node_modules/@dimforge/rapier3d-compat/rapier_wasm3d_bg.wasm','node_modules/three/build/three.module.js','node_modules/three/build/three.core.js'];
const hashes=(base,names)=>Object.fromEntries(names.map(n=>[n,sha(fs.readFileSync(path.join(base,n)))]));
if(args.freeze){
 assert(path.isAbsolute(args.freeze)&&!fs.existsSync(args.freeze),'Fresh absolute freeze path required');
 const names=[...scan(root,'src'),'package.json','package-lock.json','tools/sim/harness_m.mjs',own].sort();
 const before=hashes(root,[...names,...deps]);
 for(const n of names){fs.mkdirSync(path.dirname(path.join(args.freeze,n)),{recursive:true});fs.copyFileSync(path.join(root,n),path.join(args.freeze,n));}
 fs.symlinkSync(path.join(root,'node_modules'),path.join(args.freeze,'node_modules'),'dir');
 assert.deepEqual(hashes(root,[...names,...deps]),before);assert.deepEqual(hashes(args.freeze,[...names,...deps]),before);
 fs.writeFileSync(path.join(args.freeze,'SOURCE.json'),JSON.stringify({createdUTC:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),dirty:execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}),runtimeUnmodified:true,files:before},null,2)+'\n');
 console.log(args.freeze);process.exit(0);
}
const source=JSON.parse(fs.readFileSync(path.join(root,'SOURCE.json')));
const manifest=()=>hashes(root,Object.keys(source.files));assert.deepEqual(manifest(),source.files);
const out=args.out,speed=Number(args.speed??4),scope=args.scope??'all';assert(['all','contacts'].includes(scope));assert(path.isAbsolute(out)&&!fs.existsSync(out));assert([4,6].includes(speed));fs.mkdirSync(out,{recursive:true});
const [{newRound,THREE,RAPIER,DT,AI,CONFIG},{WEAPONS},{LOOKS},{applySwordsmanship,recordSwordsmanshipInput},{configureCombatDefaults},{prepareMorgensternTrial}]=await Promise.all([
 import('../harness_m.mjs'),import('../../../src/weapons.js'),import('../../../src/looks.js'),import('../../../src/swordsmanship.js'),import('../../../src/combat_defaults.js'),import('../../../src/morgenstern_trial.js')]);
const V=v=>new THREE.Vector3(v.x,v.y,v.z),Q=q=>new THREE.Quaternion(q.x,q.y,q.z,q.w),Y=new THREE.Vector3(0,1,0);
const plain=v=>({x:v.x,y:v.y,z:v.z,...(v.w===undefined?{}:{w:v.w})});
const health=f=>({state:f.state,alive:f.alive,armed:f.armed,broken:!!f.weaponBroken,blood:f.blood,bleed:f.bleed,wounds:f.wounds.length,limbs:{...f.limbs},consciousness:f.consciousness,pain:f.pain,balance:f.balance,daze:f.daze??0,hasHelmet:f.hasHelmet,helmetIntegrity:f.helmetIntegrity,plate:{...f.plate},cloth:{...f.cloth}});
const result=r=>r?Object.fromEntries(['type','zone','energy','ephys','mFree','mEff','eff','thr','severity','pass','finish','speed','t','helmet','helmetBlunt','plate'].map(k=>[k,r[k]])):null;
const nativeFinite=G=>G.world.bodies.getAll().every(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].every(v=>Object.values(v).every(Number.isFinite)));
const props=f=>({massKg:f.sword.mass(),localCOM:plain(f.sword.localCom()),inertia:plain(f.sword.principalInertia()),principalFrame:plain(f.sword.principalInertiaLocalFrame()),gripSwingInertia:f.swordIhand,power:f.weaponCfg.power,mBlunt:f.weaponCfg.mBlunt,mThrust:f.weaponCfg.mThrust,spike:!!f.weaponCfg.spike,ignoreArmor:f.weaponCfg.ignoreArmor,trialOnly:!!f.weapon.trialOnly});
const models=f=>({onehandArm:f.onehandArmModel??'legacy',swordsmanship:f.swordsmanshipModel??'legacy',stance:f.stanceMemoryModel??'legacy',roll:f.rollTargetModel??'legacy',autoGuard:f.skill.autoGuard,skill:f.skill.level});
const rows={freecuts:[],contacts:[],ai:[]},started=performance.now(),startedUTC=new Date().toISOString();let error=null;
const write=(group,row)=>{const p=path.join(out,group+'-'+row.id+'.json');fs.writeFileSync(p,JSON.stringify(row)+'\n');row.artifact={path:p,sha256:sha(fs.readFileSync(p))};console.log(JSON.stringify({group,id:row.id,pass:row.pass,summary:row.summary,error:row.error}));};
function installPlayer(G){
 const f=G.player;
 if(f.weapon.id==='morgenstern'){assert(prepareMorgensternTrial(f),'Morgenstern trial installer must apply');assert(applySwordsmanship(f));}
 else{const d=configureCombatDefaults({active:true},f.weapon);f.onehandArmModel='manual';f.stanceMemoryModel=d.stance;f.rollTargetModel=d.roll;assert(applySwordsmanship(f));G.combat.cutReactionModel=d.cut;G.combat.cutReactionFighter=d.cut==='centerline'?f:null;}
 f.canShove=true;
 assert.deepEqual(models(f),{onehandArm:'manual',swordsmanship:'unified',stance:'fresh',roll:'bounded',autoGuard:false,skill:0});
}
function instrumentContacts(G,row){
 const original=G.combat.strike;
 G.combat.strike=function(pr,point,passing){
  const before=health(pr.v.fighter),r=original.call(this,pr,point,passing);
  if(r){const f=pr.w.fighter;row.events.push({tick:row.steps??0,timeS:G.t,attacker:f.index,victim:pr.v.fighter.index,weapon:f.weapon.id,weaponPart:pr.w.part,weaponCollider:f.swordColliders.findIndex(c=>c.handle===pr.wc),targetPart:pr.v.part,point:point.toArray(),passing,result:result(r),before,after:health(pr.v.fighter)});}
  return r;
 };
}
function schedule(attack){
 const p=attack==='vertical'?{ready:[.1,.42],end:[.1,-.42]}:{ready:[-.35,.4],end:[.35,-.4]},tape=[];let last=[.15,.1];
 for(const [phase,seconds,target] of [['ready',.5,last],['prepare',.6,p.ready],['hold',.4,p.ready],['attack',.25,p.end],['residual',1.25,p.end]]){
  const start=last.slice(),n=Math.round(seconds/DT);for(let i=0;i<n;i++){const next=start.map((x,k)=>x+(target[k]-x)*(i+1)/n),delta=next.map((x,k)=>x-last[k]);tape.push({tick:tape.length,phase,pad:next,delta,held:true,active:Math.hypot(...delta)>1e-5});last=next;}
 }
 return tape;
}
function frame(f,phase,tick){
 const sw=f.sword,q=Q(sw.rotation()),axis=Y.clone().applyQuaternion(q),w=V(sw.angvel()),localW=w.clone().applyQuaternion(q.clone().multiply(Q(sw.principalInertiaLocalFrame())).invert()),I=sw.principalInertia(),v=sw.linvel();
 const headIndex=f.weapon.id==='morgenstern'?3:2,local=f.swordColliders[headIndex].translationWrtParent(),center=V(local).applyQuaternion(q).add(V(sw.translation())),tip=f.bladePoint(1,new THREE.Vector3());
 const point=(b,p)=>V(p).applyQuaternion(Q(b.rotation())).add(V(b.translation())),j=f.gripJoint;
 return {tick,phase,tipSpeed:V(sw.velocityAtPoint(tip)).length(),strikingCenterSpeed:V(sw.velocityAtPoint(center)).length(),strikingCenter: center.toArray(),tip:tip.toArray(),K:.5*sw.mass()*(v.x*v.x+v.y*v.y+v.z*v.z)+.5*(I.x*localW.x**2+I.y*localW.y**2+I.z*localW.z**2),axialOmega:w.dot(axis),wristTorque:f.debug.wristTorque.length(),wristCap:f.debug.wristCap,gripGap:j?.isValid()?point(j.body1(),j.anchor1()).distanceTo(point(j.body2(),j.anchor2())):null,state:f.state};
}
function freecut(weapon,attack){
 const row={id:weapon+'-'+attack,weapon,attack,steps:0,events:[],frames:[],checks:{finite:true,healthy:true,input:true,noOpponentContact:true}},tape=schedule(attack);let G;
 try{
  G=newRound({seed:7,weapon,weapon2:'longsword',gap:14,walls:false,look:LOOKS.enemy,look2:LOOKS.enemy,onFighter:f=>{if(f.index===0){if(f.weapon.id==='morgenstern')assert(prepareMorgensternTrial(f));else{f.onehandArmModel='manual';f.stanceMemoryModel='fresh';f.rollTargetModel='bounded';}}}});
  installPlayer(G);const f=G.player;row.props=props(f);row.props.specMassKg=f.weapon.buildParts(LOOKS.enemy).reduce((s,p)=>s+p[2][0],0);assert(Math.abs(row.props.massKg-row.props.specMassKg)<1e-5);row.models=models(f);row.initialPad=f.handOffset.toArray();row.inputSHA256=sha(JSON.stringify(tape));instrumentContacts(G,row);
  for(const req of tape){
   // Identical gesture deltas preserve each weapon's native spawn mapping.
   f.handOffset.x+=req.delta[0];f.handOffset.y+=req.delta[1];f.handHeld=true;f.inputActive=req.active;f.move.set(0,0);f.stickX=f.stickY=0;
   row.checks.input&&=recordSwordsmanshipInput(f,{id:req.tick,timeS:G.t,dx:req.delta[0],dy:req.delta[1],held:true,active:req.active});
   G.step();row.steps++;row.checks.finite&&=nativeFinite(G);row.checks.healthy&&=f.alive&&f.armed&&f.wounds.length===0&&Object.values(f.limbs).every(x=>x>=1-1e-12);
   row.checks.noOpponentContact&&=row.events.length===0;
   row.frames.push({...frame(f,req.phase,req.tick),appliedPad:f.handOffset.toArray()});if(!row.checks.finite)break;
  }
  const active=row.frames.filter(x=>['attack','residual'].includes(x.phase));
  const metric=k=>{const peak=Math.max(...active.map(x=>x[k])),at=active.findIndex(x=>x[k]===peak);return{peak,peakTimeFromAttackS:at*DT,last:active.at(-1)[k],possibleTruncatedPeak:at>=active.length-6||active.at(-1)[k]>=peak*.95};};
  row.summary={tipSpeedMps:metric('tipSpeed'),strikingCenterSpeedMps:metric('strikingCenterSpeed'),kineticJ:metric('K'),maxGripGapM:Math.max(...row.frames.map(x=>x.gripGap??Infinity)),wristNearCapFrames:active.filter(x=>x.wristCap>0&&x.wristTorque>=.95*x.wristCap).length,maxAbsAxialOmega:Math.max(...row.frames.map(x=>Math.abs(x.axialOmega))),end:health(f),startFrameType:f.weapon.frame,returnScale:f.swordsmanshipState.profile.returnScale};
  row.pass=row.steps===tape.length&&Object.values(row.checks).every(Boolean);
 }catch(e){row.error=e.stack;row.pass=false;}finally{G?.eventQueue.free();G?.world.free();rows.freecuts.push(row);write('freecut',row);}
}
function raySurface(col,bodyPos,bodyQ,origin,dir){
 const c=V(col.translationWrtParent()).applyQuaternion(bodyQ).add(bodyPos),q=bodyQ.clone().multiply(Q(col.rotationWrtParent())),ray=new RAPIER.Ray(origin,dir),hit=col.shape.castRayAndGetNormal(ray,c,q,3,true);
 assert(hit,'Native production shape must intersect fixture ray');return V(ray.pointAt(hit.timeOfImpact));
}
function contact(weapon,target,shaft=false){
 const row={id:weapon+'-'+target+(shaft?'-shaft':''),weapon,target,shaft,steps:0,events:[],native:[]};let G;
 try{
  const part=target==='arm'?'farmS':'head',helmet=target==='helmet';
  G=newRound({seed:7,weapon,weapon2:'longsword',walls:false,look:LOOKS.enemy,look2:helmet?LOOKS.player:LOOKS.enemy});
  const f=G.player,e=G.enemy,C=G.combat;f.foe=e;e.foe=f;
  row.props=props(f);row.before=health(e);instrumentContacts(G,row);
  for(const j of G.world.impulseJoints.getAll())G.world.removeImpulseJoint(j,true);
  G.world.gravity={x:0,y:0,z:0};G.world.forEachCollider(c=>c.setCollisionGroups(0));
  G.world.forEachRigidBody(b=>{b.setLinvel({x:0,y:0,z:0},true);b.setAngvel({x:0,y:0,z:0},true);b.resetForces(true);b.resetTorques(true);});
  const victim=e.bodies[part],vc=victim.collider(0),wi=shaft?0:weapon==='morgenstern'?3:2,wc=f.swordColliders[wi];
  const targetP=new THREE.Vector3(0,2,0),targetQ=new THREE.Quaternion();victim.setTranslation(targetP,true);victim.setRotation(targetQ,true);
  const targetHeight=part==='head'?.04:0,targetSurface=raySurface(vc,targetP,targetQ,{x:-1,y:2+targetHeight,z:0},{x:1,y:0,z:0});
  let localContact,wq;
  if(shaft||weapon==='tree_branch'){
   const c=wc.translationWrtParent();wq=new THREE.Quaternion();localContact=raySurface(wc,new THREE.Vector3(),wq,{x:1,y:c.y,z:0},{x:-1,y:0,z:0});
  }else{
   wq=new THREE.Quaternion().setFromUnitVectors(Y,new THREE.Vector3(1,0,0));const c=wc.translationWrtParent();localContact=raySurface(wc,new THREE.Vector3(),new THREE.Quaternion(),{x:c.x,y:c.y+1,z:c.z},{x:0,y:-1,z:0});
  }
  const swP=targetSurface.clone().add(new THREE.Vector3(-.15,0,0)).sub(localContact.clone().applyQuaternion(wq));
  f.sword.setTranslation(swP,true);f.sword.setRotation(wq,true);f.sword.setLinvel({x:speed,y:0,z:0},true);f.sword.setAngvel({x:0,y:0,z:0},true);
  wc.setCollisionGroups(0xffffffff);vc.setCollisionGroups(0xffffffff);
  row.preparation={speedMps:speed,gapM:.15,removedAllImpulseJoints:true,gravity:0,maskedOtherColliders:true,rawNativeStepOnly:true,weaponCollider:wi,weaponPart:C.info.get(wc.handle).part,targetPart:part,targetSurface:targetSurface.toArray(),weaponLocalContact:localContact.toArray(),shaftOrBranchSide:shaft||weapon==='tree_branch',weaponStart:swP.toArray()};
  for(let i=0;i<60;i++){
   f.cacheState();e.cacheState();G.world.step(G.eventQueue,C.physicsHooks);row.steps++;G.t+=DT;
   const manifolds=[];G.world.contactPair(wc,vc,m=>manifolds.push({contacts:m.numContacts(),solverContacts:m.numSolverContacts(),impulse:Array.from({length:m.numContacts()},(_,j)=>m.contactImpulse(j)).reduce((a,b)=>a+b,0)}));
   C.afterStep(G.world,G.eventQueue);
   row.native.push({tick:i,finite:nativeFinite(G),weaponVelocity:plain(f.sword.linvel()),targetVelocity:plain(victim.linvel()),manifolds,cutting:[...C.cutting].map(([key,c])=>({key,applied:c.applied,seen:c.seen,Eleft:c.Eleft,stuck:c.stuck}))});
   if(row.events.length>0&&i>=(row.events[0].tick+4))break;
  }
  const hit=row.events.find(x=>x.attacker===0&&x.targetPart===part&&x.weaponCollider===wi);
  row.after=health(e);row.summary={firstHit:hit??null,manifoldSteps:row.native.filter(x=>x.manifolds.some(m=>m.contacts>0)).length,appliedWounds:e.wounds.length};
  row.checks={nativeFinite:row.native.every(x=>x.finite),hit:!!hit,contact:row.native.some(x=>x.manifolds.some(m=>m.contacts>0)),armorCoverage:!!hit&&hit.result.helmet===helmet,notArmorBypass:!f.weaponCfg.ignoreArmor,shaftBlunt:!shaft||hit?.result.type==='blunt',armorStops:!helmet||(hit?.result.type==='blunt'&&hit.result.severity===0&&e.wounds.length===0),bareSpikeExposure:speed!==6||weapon!=='morgenstern'||shaft||helmet||(hit?.result.type==='stab'&&hit.result.severity>0&&e.wounds.length>0)};
  row.pass=Object.values(row.checks).every(Boolean);
 }catch(e){row.error=e.stack;row.pass=false;}finally{G?.eventQueue.free();G?.world.free();rows.contacts.push(row);write('contact',row);}
}
function duel(seed,swapped){
 const row={id:seed+(swapped?'-swapped':'-player'),seed,swapped,steps:0,events:[],samples:[]};let G;
 try{
  const weapon=swapped?'longsword':'morgenstern',weapon2=swapped?'morgenstern':'longsword';
  G=newRound({seed,weapon,weapon2,AI2Class:AI,difficulty:'normal',difficulty2:'normal',look:LOOKS.enemy,look2:LOOKS.enemy,persona:{school:weapon2},persona2:{school:weapon}});
  // Both seats use the production opponent AI/controller contract. AI owns pad
  // goals, not phone gestures; installing the player input-driven unified layer
  // here would incorrectly treat AI movement as released/idle input.
  instrumentContacts(G,row);row.models={player:models(G.player),enemy:models(G.enemy),cut:G.combat.cutReactionModel,cutFighter:G.combat.cutReactionFighter?.index??null,gravity:G.world.gravity.y,playerAI:G.ai2.constructor.name,enemyAI:G.ai.constructor.name,playerSchool:G.ai2.school.id,enemySchool:G.ai.school.id,playerMeasure:G.ai2.M,enemyMeasure:G.ai.M};
  const m=swapped?G.enemy:G.player;row.props=props(m);row.checks={finite:true};
  for(let i=0;i<Math.round(20/DT);i++){
   G.step();row.steps++;row.checks.finite&&=nativeFinite(G);
   if(i%120===0)row.samples.push({timeS:G.t,player:health(G.player),enemy:health(G.enemy),gapM:V(G.player.bodies.chest.translation()).distanceTo(V(G.enemy.bodies.chest.translation()))});
   if(!row.checks.finite||!G.player.alive||!G.enemy.alive)break;
  }
  const hits=row.events.filter(x=>x.weapon==='morgenstern');
  row.summary={seconds:G.t,morgensternHits:hits.length,headPartHits:hits.filter(x=>x.weaponPart==='blade').length,spikeWounds:hits.filter(x=>x.result.type==='stab'&&x.result.severity>0).length,shaftHits:hits.filter(x=>x.weaponPart==='hilt').length,targetZones:Object.fromEntries([...new Set(hits.map(x=>x.result.zone))].map(z=>[z,hits.filter(x=>x.result.zone===z).length])),player:health(G.player),enemy:health(G.enemy),clashes:G.clashes};row.pass=row.checks.finite;
 }catch(e){row.error=e.stack;row.pass=false;}finally{G?.eventQueue.free();G?.world.free();rows.ai.push(row);write('ai',row);}
}
try{
 assert.equal(WEAPONS.morgenstern.mBlunt,2.1);assert.equal(WEAPONS.morgenstern.mThrust,.35);assert(WEAPONS.morgenstern.spike);assert(!WEAPONS.morgenstern.ignoreArmor);
 if(scope==='all')for(const weapon of ['morgenstern','frozen_tuna','tree_branch'])for(const attack of ['vertical','diagonal'])freecut(weapon,attack);
 for(const weapon of ['morgenstern','frozen_tuna'])for(const target of ['head','arm','helmet'])contact(weapon,target);
 contact('morgenstern','arm',true);contact('tree_branch','arm');
 if(scope==='all'&&rows.freecuts.every(r=>r.pass)&&rows.contacts.every(r=>r.pass))for(const seed of [7,19,31])for(const swapped of [false,true])duel(seed,swapped);
}catch(e){error=e.stack;}
const sourceStable=JSON.stringify(manifest())===JSON.stringify(source.files),pass=!error&&sourceStable&&rows.freecuts.length===(scope==='all'?6:0)&&rows.contacts.length===8&&[...rows.freecuts,...rows.contacts,...rows.ai].every(r=>r.pass);
const report={head:source.head,source,sourceStable,scope,pass,error,startedUTC,completedUTC:new Date().toISOString(),wallSeconds:(performance.now()-started)/1000,command:process.argv,nativeSteps:[...rows.freecuts,...rows.contacts,...rows.ai].reduce((a,b)=>a+b.steps,0),executionCount:{freecuts:rows.freecuts.length,contacts:rows.contacts.length,ai:rows.ai.length},protocol:{contactSpeedMps:speed,freecutInputs:'Identical delta gesture tapes applied to each weapon native starting pad, manual/unified/fresh/bounded player. Initial and applied pads are recorded; two-hand initial pad differs by .1m vertically. Weapon profiles, masses, controllers and goals retain their ordinary weapon-specific properties. Bare default looks for equal armor load; distant reactive opponent. No claims of human-equivalent motor input.',contacts:'Eight isolated native collisions: all joints removed, gravity0, only selected production weapon and target colliders enabled, initial native pose/velocity set once. Raw world.step and unchanged production Combat callbacks; no injected damage. Axial front for head/tuna, lateral shaft/branch.',ai:'At most6×20s AI vs AI using the production opponent legacy controller in both seats; no player-only input-driven unified layer is installed on an AI. This is an opponent-controller smoke comparison, not the delivered human player controller. Same seed with seats swapped, not paired state equivalence. Bare looks, harness emotion/runtime limitations; no human win-rate inference.',energy:'K from native COM velocity and principal inertia; ephys from production contact effective mass plus .3kg game arm-assist. Game energyScale/power/mBlunt and mThrust resistance are separate; none is a historical stress/trauma calibration.',scope:'A scalar speed/energy result does not establish human feel. Existing per-feature force limits remain; no allweapon balance matrix.'},rows:Object.fromEntries(Object.entries(rows).map(([k,rs])=>[k,rs.map(({frames,native,samples,...r})=>r)]))};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass,sourceStable,executions:report.executionCount,nativeSteps:report.nativeSteps,wallSeconds:report.wallSeconds,out,error}));if(!pass)process.exitCode=1;
