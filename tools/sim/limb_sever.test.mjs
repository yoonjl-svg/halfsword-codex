import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {newRound,CONFIG,DT,THREE} from './harness_m.mjs';
import {tryRevive} from '../../src/revive.js';
import {bulletHit} from '../../src/gun.js';
import {configureCombatDefaults} from '../../src/combat_defaults.js';
import {configureSwordsmanshipDefault,swordsmanshipDefaultSupportsWeapon} from '../../src/swordsmanship_default.js';
import {applySwordsmanship,recordSwordsmanshipInput} from '../../src/swordsmanship.js';
const repo=fileURLToPath(new URL('../../',import.meta.url)), out=process.argv[2]||'/tmp/halfsword-limb-sever.json';
const started=performance.now(),ordinaryEntry=configureSwordsmanshipDefault(new URLSearchParams());
const sourceFiles=['src/limb_sever.js','src/fighter.js','src/gait.js','src/combat.js','src/gun.js','src/revive.js','src/config.js','src/main.js','src/combat_defaults.js','src/swordsmanship_default.js','src/swordsmanship.js','src/swordsmanship_profiles.js','src/roll_target.js','src/cut_centerline.js','src/stance_memory.js','tools/sim/harness_m.mjs','tools/sim/limb_sever.test.mjs','package.json','package-lock.json'];
const hashes=()=>Object.fromEntries(sourceFiles.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(repo+'/'+p)).digest('hex')]));
const result={createdUTC:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),sourceBefore:hashes(),dt:DT,defaultFlag:CONFIG.COMBAT.limbSeverTrial,roundsCreated:0,physicsSteps:0,assertions:[],scenes:[],limitations:['Synthetic wound injection is not a physical contact strike or human realism validation.','Force/motor method observers delegate original arguments unchanged; gravity and constraint/contact forces are not user actuation.','Zero ankle motor parameters and no reactivation do not prove unrestricted native ankle rotation: retained joint limits/axes remain unmeasured.','Single deterministic seed, no gameplay balance benchmark.','All fixture and 5-second post-separation runs use game DT. Contact fixtures initialize the blade below the anchor so its first contact reaches the anchor during the normal step.','Four controlled-sever follow-ups use real ordinary swordsmanship input and native game stepping; they do not demonstrate natural injury acquisition, human movement, or recovery on a missing support leg.']};
const check=(name,ok,details)=>{result.assertions.push({name,ok:!!ok,details});if(!ok)console.error('FAIL',name,JSON.stringify(details));};
const close=(a,b)=>Math.abs(a-b)<1e-7;
class Passive{update(){}}
function ordinaryRound(extra={}){
 const g=newRound({seed:7,walls:false,AIClass:Passive,...extra,onFighter:f=>{
  f.onehandArmModel='legacy';if(f.index!==0)return;
  if(swordsmanshipDefaultSupportsWeapon(f.weapon))f.onehandArmModel='manual';
  const defaults=configureCombatDefaults(ordinaryEntry,f.weapon);f.stanceMemoryModel=defaults.stance;f.rollTargetModel=defaults.roll;
 }});
 result.roundsCreated++;const f=g.player,nativeBefore=crypto.createHash('sha256').update(g.world.takeSnapshot()).digest('hex');
 f.skill.autoGuard=true;const applied=applySwordsmanship(f);f.canShove=true;
 const defaults=configureCombatDefaults(ordinaryEntry,f.weapon);g.combat.cutReactionModel=defaults.cut;g.combat.cutReactionFighter=defaults.cut==='centerline'?f:null;
 g.ordinarySetup={applied,defaults,onehandArmModel:f.onehandArmModel,version:f.swordsmanshipState?.version,playerOnly:!g.enemy.swordsmanshipState&&!g.enemy.stanceMemoryModel&&!g.enemy.rollTargetModel,
  installNativeUnchanged:nativeBefore===crypto.createHash('sha256').update(g.world.takeSnapshot()).digest('hex')};
 const step=g.step;g.step=()=>{result.physicsSteps++;return step();};return g;
}
function round(settle=true){const g=ordinaryRound({revive2:{count:1}});g.park();g.player.balanceProbe={};if(settle)for(let i=0;i<300;i++)g.step();return g;}
const roots={farmS:{parent:'uarmS',parts:['farmS'],limb:'armS'},farmO:{parent:'uarmO',parts:['farmO'],limb:'armO'},shinF:{parent:'thighF',parts:['shinF','footF'],limb:'legF'},shinB:{parent:'thighB',parts:['shinB','footB'],limb:'legB'}};
function wound(f,root,patch={}){const part=patch.part||root, a=part===root?f.jointByName[root].joint.anchor2():f.jointByName[root].joint.anchor1();return {part,zone:root.startsWith('farm')?'arm':'leg',type:'cut',severity:1.3,energy:120,bleedPerSev:.015,local:new THREE.Vector3().copy(a),dir:new THREE.Vector3(1,0,0),pass:true,passing:true,stuck:false,...patch};}
function props(b){return {mass:b.mass(),v:{...b.linvel()},w:{...b.angvel()}};}
function sameProps(a,b){return close(a.mass,b.mass)&&['x','y','z'].every(k=>close(a.v[k],b.v[k])&&close(a.w[k],b.w[k]));}
function snapshot(f){return {state:f.state,bleed:f.bleed,blood:f.blood,limbs:{...f.limbs},armed:f.armed,gripping:f.gripping,missingSupportLeg:!!f.missingSupportLeg,gaitActive:f.gait?.active,footLoad:{...f.footLoad},balanceProbe:{...f.balanceProbe},totalMass:f.totalMass,gaitMg:f.gait?.Mg};}
function observeBodies(f,names){const calls=[];for(const name of names)for(const method of ['addForce','addForceAtPoint','addTorque','applyTorqueImpulse','applyImpulse','applyImpulseAtPoint','setLinvel','setAngvel']){const b=f.bodies[name],original=b[method];if(typeof original!=='function')continue;b[method]=function(...args){calls.push({name,method,vector:args[0]&&{...args[0]}});return original.apply(this,args);};}return calls;}
function observeMotors(j){const calls=[],raw=j.rawSet,original=raw.jointConfigureMotor;raw.jointConfigureMotor=function(...args){if(args[0]===j.handle)calls.push(args);else calls.otherMotorCommands=(calls.otherMotorCommands||0)+1;return original.apply(this,args);};return calls;}
try{
check('default_on_config',result.defaultFlag===true,{defaultFlag:result.defaultFlag});
// Explicit OFF remains a real wound through Fighter.applyWound.
{CONFIG.COMBAT.limbSeverTrial=false;const g=round(),f=g.player;f.applyWound(wound(f,'shinF'));check('explicit_off_keeps_root_joint',!f.severedLimbs?.length&&!!f.jointByName.shinF.joint,{state:f.state});g.world.free();}
CONFIG.COMBAT.limbSeverTrial=true;
for(const root of Object.keys(roots)){
 for(const [label,patch] of [['wrong_type',{type:'stab'}],['weak',{severity:1.19}],['distant',{local:new THREE.Vector3(2,2,2)}],['stuck',{stuck:true}],['not_passing',{passing:false}],['not_pass',{pass:false}]]){
  const g=round(false),f=g.player;f.applyWound(wound(f,root,patch));check(`${root}_${label}_no_sever`,!f.severedLimbs?.length&&!!f.jointByName[root].joint);g.world.free();
 }
 const g=round(),f=g.player,t=roots[root],rootHandle=f.jointByName[root].joint.handle;
 const ankle=root.startsWith('shin')?f.jointByName['foot'+root.at(-1)].joint:null;
 const motorCalls=ankle?observeMotors(ankle):[];
 for(const name of t.parts){f.bodies[name].setLinvel({x:.4,y:.2,z:-.3},true);f.bodies[name].setAngvel({x:.1,y:.3,z:-.2},true);}
 const before=Object.fromEntries(Object.entries(f.bodies).map(([n,b])=>[n,props(b)]));
 const massBefore=f.totalMass,removedAnatomical=t.parts.reduce((s,n)=>s+f.bodies[n].collider(0).mass(),0);
 f.applyWound(wound(f,root));
 const after=Object.fromEntries(Object.entries(f.bodies).map(([n,b])=>[n,props(b)]));
 check(root+'_sever_once',f.severedLimbs?.length===1&&t.parts.every(n=>f.detachedParts.has(n)));
 check(root+'_all_body_mass_velocity_preserved',Object.keys(before).every(n=>sameProps(before[n],after[n])),{before,after});
 check(root+'_rootjoint_removed',f.jointByName[root].joint===null&&!g.world.getImpulseJoint(rootHandle));
 check(root+'_controller_mass_recomputed',close(f.totalMass,massBefore-removedAnatomical)&&close(f.gait.Mg,f.totalMass*9.81),{massBefore,totalMass:f.totalMass,removedAnatomical,gaitMg:f.gait.Mg});
 check(root+'_limb_zero',f.limbs[t.limb]===0);
 check(root+'_bleed_once',close(f.bleed,1.3*.015)&&f.wounds.filter(w=>w.limbStump).length===1,{bleed:f.bleed,wounds:f.wounds});
 if(root==='farmS')check(root+'_disarmed',!f.armed&&!g.world.getImpulseJoint(f.gripJoint.handle));
 if(root==='farmO')check(root+'_offhand_released',!f.gripping);
 if(ankle){check(root+'_ankle_retained_not_controlled',!!g.world.getImpulseJoint(ankle.handle)&&!f.joints.some(j=>t.parts.includes(j.name)));check(root+'_ankle_motor_zeroed',motorCalls.filter(c=>c[0]===ankle.handle).length===3&&motorCalls.filter(c=>c[0]===ankle.handle).every(c=>c.slice(2).every(x=>x===0)),{calls:motorCalls});}
 const detachedInfo=f.colliderInfo.get(f.bodies[root].collider(0).handle),enemyWeapon=[...f.colliderInfo.values()].find(i=>i.fighter===g.enemy&&i.kind==='weapon'&&i.part==='blade');
 check(root+'_fragment_pair_rejected',g.combat.pairOf(detachedInfo.body.collider(0).handle,[...f.colliderInfo.entries()].find(([,i])=>i===enemyWeapon)?.[0])===null);
 const vitalBefore=JSON.stringify({bleed:f.bleed,pain:f.pain,balance:f.balance,cloth:f.cloth,wounds:f.wounds.length,limbs:f.limbs,helmetIntegrity:f.helmetIntegrity,plate:f.plate});
 for(let i=0;i<3;i++)f.applyWound({...woundForDetached(root),local:new THREE.Vector3()});
 const bh=bulletHit(g.enemy,detachedInfo,new THREE.Vector3().copy(f.bodies[root].translation()),new THREE.Vector3(1,0,0),g.combat);
 check(root+'_repeated_and_bullet_fragment_no_damage',bh===null&&vitalBefore===JSON.stringify({bleed:f.bleed,pain:f.pain,balance:f.balance,cloth:f.cloth,wounds:f.wounds.length,limbs:f.limbs,helmetIntegrity:f.helmetIntegrity,plate:f.plate}));
 const reviveLeft=f.revive?.left;check(root+'_revive_blocked',tryRevive(f,'출혈')===false&&f.revive?.left===reviveLeft&&!f.revival,{revive:f.revive});
 const actuation=observeBodies(f,t.parts),states=new Set();let finite=true,supportZero=true,inputAccepted=true,inputConsumed=true,goalsFinite=true;
 const followup={steps:0,phases:{},tapAccepted:null,boundaries:[],inputSHA256:null},inputHash=crypto.createHash('sha256');
 const phases=[['raise',60,-.28,.38,true],['hold',60,0,0,true],['cut',30,.56,-.76,true],['reverse',36,-.38,.66,true],['tap',60,0,0,true],['release',354,0,0,false]];
 const tape=phases.flatMap(([phase,n,dx,dy,held])=>Array.from({length:n},(_,j)=>({phase,dx:dx/n,dy:dy/n,held,tap:phase==='tap'&&j===0})));
 for(let i=0;i<Math.ceil(5/DT);i++){
  const request=tape[i],active=Math.abs(request.dx)+Math.abs(request.dy)>1e-5;f.handOffset.x+=request.dx;f.handOffset.y+=request.dy;f.handHeld=request.held;f.inputActive=active;
  const input={id:i,timeS:g.t,dx:request.dx,dy:request.dy,held:request.held,active};inputAccepted&&=recordSwordsmanshipInput(f,input);inputHash.update(JSON.stringify(input)+'\n');
  if(request.tap)followup.tapAccepted=f.skill.thrust();f.move.set(.2,.1);f.stickX=.2;f.stickY=.1;g.step();followup.steps++;followup.phases[request.phase]=(followup.phases[request.phase]??0)+1;
  inputConsumed&&=JSON.stringify(f.swordsmanshipState.input)===JSON.stringify(input);goalsFinite&&=[...f.handTarget.toArray(),...f.aimDirW.toArray(),...f.handOffset.toArray()].every(Number.isFinite);
  states.add(f.state);supportZero&&=!f.missingSupportLeg||(f.balanceProbe.appliedUpN===0&&f.footLoad.F===0&&f.footLoad.B===0&&!f.gait.active);for(const b of Object.values(f.bodies))for(const v of [b.translation(),b.rotation(),b.linvel(),b.angvel()])finite&&=Object.values(v).every(Number.isFinite);
  if(i===0||tape[i+1]?.phase!==request.phase)followup.boundaries.push({tick:i,phase:request.phase,state:snapshot(f),assistPhase:f.swordsmanshipState.phase,assistOwner:f.swordsmanshipState.owner,eligible:f.swordsmanshipState.eligible,handOffset:f.handOffset.toArray()});
 }
 followup.inputSHA256=inputHash.digest('hex');
 check(root+'_ordinary_defaults_from_creation',g.ordinarySetup.applied&&g.ordinarySetup.installNativeUnchanged&&g.ordinarySetup.playerOnly&&g.ordinarySetup.onehandArmModel==='manual'&&g.ordinarySetup.defaults.stance==='fresh'&&g.ordinarySetup.defaults.roll==='bounded'&&g.ordinarySetup.defaults.cut==='centerline',g.ordinarySetup);
 check(root+'_real_reinput_accepted_consumed',inputAccepted&&inputConsumed,{inputAccepted,inputConsumed,steps:followup.steps,tapAccepted:followup.tapAccepted});
 check(root+'_finite_input_goals_5sec',goalsFinite);
 check(root+'_finite_5sec',finite);check(root+'_no_amputated_actuation_5sec',actuation.length===0,{calls:actuation.slice(0,12),count:actuation.length});
 if(ankle){check(root+'_permanent_down_no_support_getup',[...states].every(s=>s==='down'||s==='dead')&&supportZero,{states:[...states],snapshot:snapshot(f)});check(root+'_no_ankle_motor_reactivation',motorCalls.filter(c=>c[0]===ankle.handle).length===3);}
 f.state='dead';const deadSnapshot=JSON.stringify({bleed:f.bleed,wounds:f.wounds.length,pain:f.pain});f.applyWound(woundForDetached(root));check(root+'_dead_fragment_no_damage',deadSnapshot===JSON.stringify({bleed:f.bleed,wounds:f.wounds.length,pain:f.pain}));
 result.scenes.push({root,kind:'synthetic_wound_actual_Rapier',ordinarySetup:g.ordinarySetup,followup,instantBefore:before,instantAfter:after,final:snapshot(f),states:[...states],actuationCount:actuation.length,motorSummary:ankle?{ankleCommands:motorCalls.length,otherMotorCommands:motorCalls.otherMotorCommands||0}:null});g.world.free();console.log('Completed',root);
}
// Physical collision fixture: initialize a consistent whole-attacker translation and velocity,
// then use actual Rapier contacts + unmodified Combat hooks; never call applyWound directly.
result.contactFixtures=[];
for(const root of ['farmO','shinF']){
 const g=ordinaryRound({sameLook:true}),att=g.player,vic=g.enemy;
 g.world.step(g.eventQueue,g.combat.physicsHooks);result.physicsSteps++;g.combat.afterStep(g.world,g.eventQueue);
 const child=vic.bodies[root],anchor=new THREE.Vector3().copy(vic.jointByName[root].joint.anchor2()).applyQuaternion(new THREE.Quaternion().copy(child.rotation())).add(new THREE.Vector3().copy(child.translation()));
 const desiredQ=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2),deltaQ=desiredQ.clone().multiply(new THREE.Quaternion().copy(att.sword.rotation()).invert()),origin=new THREE.Vector3().copy(att.sword.translation());
 for(const {rb} of att.meshes){const p=new THREE.Vector3().copy(rb.translation()).sub(origin).applyQuaternion(deltaQ).add(origin),q=deltaQ.clone().multiply(new THREE.Quaternion().copy(rb.rotation()));rb.setTranslation(p,true);rb.setRotation(q,true);}
 const ar=new THREE.Vector3().copy(att.anchor.translation()).sub(origin).applyQuaternion(deltaQ).add(origin);att.anchor.setTranslation(ar,true);att.anchor.setRotation(deltaQ.clone().multiply(new THREE.Quaternion().copy(att.anchor.rotation())),true);
 const edge=new THREE.Vector3(1,0,0).applyQuaternion(new THREE.Quaternion().copy(att.sword.rotation()));
 const bladePoint=att.bladePoint(.35),shift=anchor.clone().sub(bladePoint).addScaledVector(edge,-.055).add(new THREE.Vector3(0,-.35,0));
 for(const {rb} of att.meshes){const p=rb.translation();rb.setTranslation({x:p.x+shift.x,y:p.y+shift.y,z:p.z+shift.z},true);rb.setLinvel({x:edge.x*24,y:edge.y*24,z:edge.z*24},true);rb.setAngvel({x:0,y:0,z:0},true);}
 const ap=att.anchor.translation();att.anchor.setTranslation({x:ap.x+shift.x,y:ap.y+shift.y,z:ap.z+shift.z},true);
 g.world.timestep=DT;
 const contacts=[],original=g.combat.strike.bind(g.combat);
 g.combat.strike=function(pr,point,passing){const joint=vic.jointByName[root].joint,localAnchor=pr.v.part===root?joint?.anchor2():pr.v.part===roots[root].parent?joint?.anchor1():null;const r=original(pr,point,passing);contacts.push({part:pr.v.part,passing,point:{...point},distanceToRequestedJointM:r&&localAnchor?Math.hypot(r.local.x-localAnchor.x,r.local.y-localAnchor.y,r.local.z-localAnchor.z):null,result:r&&{type:r.type,severity:r.severity,pass:r.pass,stuck:r.stuck,energy:r.energy,absorb:r.absorb,local:{...r.local}}});return r;};
 for(let i=0;i<12;i++){att.cacheState();vic.cacheState();g.world.step(g.eventQueue,g.combat.physicsHooks);result.physicsSteps++;g.combat.afterStep(g.world,g.eventQueue);}
 const entry={requestedRoot:root,kind:'actual_Rapier_contact_unmodified_Combat',initialEdgeSpeedMps:24,initialHeightOffsetM:-.35,fixtureTimestep:g.world.timestep,contacts,severed:vic.severedLimbs?.map(s=>s.root)||[],limitations:'Artificial initial positions/velocities; no player input or gameplay reach/balance claim.'};result.contactFixtures.push(entry);
 check(root+'_actual_contact_reaches_strike',contacts.length>0,{contacts:contacts.length,severed:entry.severed});
 check(root+'_actual_contact_severs',entry.severed.includes(root),{contacts,severed:entry.severed});
 g.world.free();
}
// Parent-side bleeding transfer retains unrelated and earlier parent wounds, removes distal bleeding.
{const g=round(),f=g.player;f.applyWound(wound(f,'shinF',{severity:.2,passing:false}));f.applyWound(wound(f,'shinF',{part:'thighF',severity:.1,passing:false}));const existingParentBleed=.1*.015;f.applyWound(wound(f,'shinF',{part:'thighF'}));check('parent_side_sever_bleed_no_double_count',f.severedLimbs?.length===1&&close(f.bleed,existingParentBleed+1.3*.015)&&f.wounds.filter(w=>w.part==='shinF').every(w=>w.bleed===0),{bleed:f.bleed,wounds:f.wounds});g.world.free();}
}catch(e){result.exception={message:e.message,stack:e.stack};console.error(e);}
finally{CONFIG.COMBAT.limbSeverTrial=result.defaultFlag;result.sourceAfter=hashes();result.sourceStable=JSON.stringify(result.sourceBefore)===JSON.stringify(result.sourceAfter);result.pass=!result.exception&&result.sourceStable&&result.assertions.every(a=>a.ok);process.exitCode=result.pass?0:1;result.count=result.assertions.length;result.failed=result.assertions.filter(a=>!a.ok).map(a=>a.name);result.completedUTC=new Date().toISOString();result.wallSeconds=(performance.now()-started)/1000;fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({out,pass:result.pass,count:result.count,failed:result.failed,exception:result.exception,sourceStable:result.sourceStable,roundsCreated:result.roundsCreated,physicsSteps:result.physicsSteps,wallSeconds:result.wallSeconds}));}
function woundForDetached(root){return {part:root,zone:root.startsWith('farm')?'arm':'leg',type:'cut',severity:1.3,energy:120,bleedPerSev:.015,local:new THREE.Vector3(),dir:new THREE.Vector3(1,0,0),pass:true,passing:true,stuck:false};}
