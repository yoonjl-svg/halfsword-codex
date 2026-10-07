// Actual game movement/input and contact; no wound, position, or velocity injection.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {newRound,AI,THREE,DT,CONFIG} from '../harness_m.mjs';
import {applySwordsmanship,recordSwordsmanshipInput} from '../../../src/swordsmanship.js';
import {configureCombatDefaults} from '../../../src/combat_defaults.js';
import {snapshotWorld} from '../force_ledger.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url)),sha=x=>createHash('sha256').update(x).digest('hex');
const reference=process.argv[4]?JSON.parse(fs.readFileSync(process.argv[4])):null;
const out=process.argv[2],protocol=process.argv[3]??'contact';assert(path.isAbsolute(out)&&!fs.existsSync(out));
const source=JSON.parse(fs.readFileSync(path.join(root,'SOURCE.json'))),manifest=()=>Object.fromEntries(Object.keys(source.files).sort().map(p=>[p,sha(fs.readFileSync(path.join(root,p)))]));
assert.deepEqual(manifest(),source.files);assert(CONFIG.COMBAT.limbSeverTrial);fs.mkdirSync(out,{recursive:true});
const deltaSchedule=[['ready',60,[0,0]],['raise',48,[-.28,.38]],['raisedHold',24,[0,0]],['firstCut',30,[.56,-.76]],['followHold',36,[0,0]],['reverse',36,[-.38,.66]],['reverseHold',24,[0,0]],['recut',30,[.40,-.70]],['recutHold',36,[0,0]],['raise2',48,[-.28,.38]],['raisedHold2',24,[0,0]],['cut2',30,[.56,-.76]],['followHold2',36,[0,0]],['release',60,[0,0]]];
const guardSchedule=[['ready',60,null],['raise',48,[.42,.42]],['raisedHold',24,null],['firstCut',30,[-.4,-.42]],['followHold',36,null],['reverse',48,[-.4,.42]],['reverseHold',24,null],['recut',30,[.38,-.44]],['recutHold',36,null],['raise2',48,[.42,.42]],['raisedHold2',24,null],['cut2',30,[-.4,-.42]],['followHold2',36,null],['release',60,null]];
const schedule=['guard','idle'].includes(protocol)?guardSchedule:deltaSchedule;
const tape=schedule.flatMap(([phase,n,delta])=>Array.from({length:n},()=>({phase,n,target:['guard','idle'].includes(protocol)?delta:null,delta:['guard','idle'].includes(protocol)?[0,0]:delta.map(v=>v/n),held:phase!=='release'})));
const startedUTC=new Date().toISOString(),started=performance.now(),rows=[],random=Math.random;
const health=f=>({alive:f.alive,armed:f.armed,gripValid:!!f.gripJoint?.isValid(),state:f.state,blood:f.blood,limbs:{...f.limbs}});
for(const weapon of reference?['longsword']:protocol==='idle'?['qinggang']:['longsword','qinggang']){
 let baselineStart=reference?.startTick??null,baselineSticks=reference?.inputs.map(x=>x.requested.stickY)??[],baselineDeltas=reference?.inputs.map(x=>[x.requested.dx,x.requested.dy])??[];
 for(const mode of reference?['bounded']:['legacy','bounded']){
  const row={weapon,mode,protocol,steps:0,startTick:null,firstInterventionTick:null,interventions:[],strikes:[],wounds:[],frames:[],inputs:[],metrics:[],checks:{finite:true,inputAccepted:true,models:true},terminal:null};rows.push(row);
  let G,tick=0,current=null,phaseOrigin=null,lastPhase=null;
  try{
   G=newRound({seed:7,weapon,weapon2:'zweihander',gap:5.6,walls:false,AIClass:AI,onFighter:f=>{if(f.index===0){const d=configureCombatDefaults({active:true},f.weapon);f.onehandArmModel='manual';f.stanceMemoryModel=d.stance;f.rollTargetModel=mode;}}});
   if(protocol==='idle')G.ai.update=()=>{G.enemy.move.set(0,0);G.enemy.stickX=G.enemy.stickY=0;G.enemy.inputActive=false;G.enemy.handHeld=true;};
   assert(applySwordsmanship(G.player));G.player.canShove=true;G.combat.cutReactionModel='centerline';G.combat.cutReactionFighter=G.player;
   const f=G.player;row.spawnSHA256=sha(G.world.takeSnapshot());
   f.recutRead=d=>{if(d.target.distanceToSquared(d.raw)>1e-20){row.firstInterventionTick??=tick;row.interventions.push({tick,phase:current.phase,active:f.inputActive,moving:d.moving,angleRad:d.target.angleTo(d.raw)});}};
   const strike=G.combat.strike;
   G.combat.strike=function(pr,p,passing){const att=pr.w.fighter,vic=pr.v.fighter,before=health(vic),active=!!att.inputActive,owner=att.swordsmanshipState?.owner;
    const damageContext={attackerMods:att.emoMods?{...att.emoMods}:null,victimMods:vic.emoMods?{...vic.emoMods}:null,power:att.weaponCfg.power,mCut:att.weaponCfg.mCut};
    const r=strike.call(this,pr,p,passing);if(r&&att===f)row.strikes.push({damageContext,tick,phase:current.phase,part:pr.v.part,active,owner,passing,before,after:health(vic),afterIntervention:row.firstInterventionTick!==null&&tick>row.firstInterventionTick,...Object.fromEntries(['type','zone','energy','ephys','severity','pass','stuck','speed','quality','eff','thr','mEff','t'].map(k=>[k,r[k]]))});return r;};
   G.onWound=(att,vic,r)=>{if(att===f)row.wounds.push({tick,phase:current.phase,part:r.zone,type:r.type,energy:r.energy,severity:r.severity,active:f.inputActive,afterIntervention:row.firstInterventionTick!==null&&tick>row.firstInterventionTick});};
   G.before=()=>{
    const gap=new THREE.Vector3().copy(f.bodies.pelvis.translation()).distanceTo(new THREE.Vector3().copy(G.enemy.bodies.pelvis.translation()));
    const start=mode==='legacy'?(protocol==='air'?tick===240:tick>=240&&gap<=2.8):tick===baselineStart;
    if(row.startTick===null&&start){row.startTick=tick;if(mode==='legacy')baselineStart=tick;}
    const local=row.startTick===null?null:tick-row.startTick,req=local===null?{phase:tick<240?'startLock':'approach',delta:[0,0],held:true}:tape[local];assert(req);
    if(req.phase!==lastPhase){phaseOrigin=f.handOffset.toArray();lastPhase=req.phase;}
    const delta=['guard','idle'].includes(protocol)?(mode==='legacy'?(req.target?req.target.map((v,i)=>(v-phaseOrigin[i])/req.n):[0,0]):baselineDeltas[tick]):req.delta;if(mode==='legacy')baselineDeltas[tick]=delta;
    const [dx,dy]=delta,allowed=f.alive&&f.armed,active=Math.abs(dx)+Math.abs(dy)>1e-5;
    if(allowed){f.handOffset.x+=dx;f.handOffset.y+=dy;}f.handHeld=req.held;f.inputActive=active;
    const input={id:tick,timeS:G.t,dx:allowed?dx:0,dy:allowed?dy:0,held:req.held,active};row.checks.inputAccepted&&=recordSwordsmanshipInput(f,input);
    // Same open-loop joystick in pair; physical separation is only observed.
    const stick=['distance','guard','idle'].includes(protocol)?(mode==='legacy'?(tick<240?0:Math.max(-1,Math.min(1,(gap-1.15)*2))):baselineSticks[tick]):tick>=240&&req.phase!=='release'?1:0;if(mode==='legacy')baselineSticks[tick]=stick;f.move.set(0,f.alive?stick:0);f.stickX=0;f.stickY=f.alive?stick:0;
    current={tick,phase:req.phase,localTick:local,gapM:gap,requested:{dx,dy,held:req.held,active,stickY:stick},applied:{input,move:f.move.toArray()},enemy:{input:G.enemy.inputActive,hand:G.enemy.handOffset.toArray(),move:G.enemy.move.toArray()}};row.inputs.push(current);
   };
   for(tick=0;tick<1600;tick++){
    if(row.startTick!==null&&tick>=row.startTick+tape.length){row.terminal={tick,reason:'full_tape'};break;}
    if(row.startTick===null&&tick>=960){row.terminal={tick,reason:'approach_timeout'};break;}
    G.step();row.steps++;
    const q=new THREE.Quaternion().copy(f.sword.rotation()),axis=new THREE.Vector3(0,1,0).applyQuaternion(q);
    row.metrics.push({tick,phase:current.phase,tipSpeedMps:new THREE.Vector3().copy(f.sword.velocityAtPoint(f.bladePoint(1,new THREE.Vector3()))).length(),swordKJ:snapshotWorld(G.world,{bodies:[f.sword]}).total.K,axialRadps:axis.dot(new THREE.Vector3().copy(f.sword.angvel())),player:health(f),enemy:health(G.enemy)});
    row.frames.push([tick,sha(G.world.takeSnapshot()),sha(JSON.stringify(current.requested)),sha(JSON.stringify(current.applied)),sha(JSON.stringify(current.enemy))]);
    row.checks.finite&&=G.world.bodies.getAll().every(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].every(v=>Object.values(v).every(Number.isFinite)));
    row.checks.models&&=f.stanceMemoryModel==='fresh'&&f.rollTargetModel===mode&&f.onehandArmModel==='manual'&&f.swordsmanshipModel==='unified'&&G.combat.cutReactionModel==='centerline'&&G.combat.cutReactionFighter===f&&CONFIG.COMBAT.limbSeverTrial&&G.world.gravity.y===-9.81;
    if(!row.checks.finite)throw Error('Nonfinite');
    if(!f.alive||!f.armed||!f.gripJoint?.isValid()||!G.enemy.alive){row.terminal={tick,reason:!f.alive?'player_dead':!f.armed?'player_unarmed':!f.gripJoint?.isValid()?'grip_lost':'enemy_dead'};break;}
   }
  }catch(e){row.error={message:e.message,stack:e.stack};}
  finally{G?.eventQueue.free();G?.world.free();const file=path.join(out,weapon+'-'+mode+'.json');fs.writeFileSync(file,JSON.stringify(row)+'\n');row.artifact={path:file,sha256:sha(fs.readFileSync(file)),bytes:fs.statSync(file).size};console.log(JSON.stringify({weapon,mode,steps:row.steps,start:row.startTick,intervention:row.firstInterventionTick,strikes:row.strikes.length,activeCutsAfter:row.strikes.filter(x=>x.afterIntervention&&x.active&&x.before.alive&&x.type==='cut'&&x.severity>0).map(x=>({tick:x.tick,phase:x.phase,part:x.part,energy:x.energy,severity:x.severity})),terminal:row.terminal,error:row.error}));}
 }
}
Math.random=random;
const comparisons=reference?[]:(protocol==='idle'?['qinggang']:['longsword','qinggang']).map(weapon=>{const[a,b]=rows.filter(r=>r.weapon===weapon),n=Math.min(a.frames.length,b.frames.length),diff=k=>a.frames.slice(0,n).findIndex((x,i)=>x[k]!==b.frames[i][k]);return{weapon,sameSpawn:a.spawnSHA256===b.spawnSHA256,sameStart:a.startTick===b.startTick,commonSteps:n,firstNativeDifference:diff(1),firstRequestedDifference:diff(2),firstAppliedDifference:diff(3),firstEnemyDifference:diff(4),prefixExact:a.frames.slice(0,b.firstInterventionTick??n).every((x,i)=>x[1]===b.frames[i][1])};});
const sourceStable=JSON.stringify(manifest())===JSON.stringify(source.files),measurementValid=sourceStable&&rows.every(r=>!r.error&&Object.values(r.checks).every(Boolean))&&comparisons.every(c=>c.sameSpawn&&c.sameStart&&c.firstRequestedDifference===-1&&c.firstAppliedDifference===-1&&c.prefixExact);
const observerEquivalence=reference?{referencePath:process.argv[4],referenceSHA256:sha(fs.readFileSync(process.argv[4])),steps:rows[0].steps,allFramesExact:JSON.stringify(rows[0].frames)===JSON.stringify(reference.frames),allInputsExact:JSON.stringify(rows[0].inputs)===JSON.stringify(reference.inputs),allStrikesApartFromObserverFlagExact:JSON.stringify(rows[0].strikes.map(({afterIntervention,...x})=>x))===JSON.stringify(reference.strikes.map(({afterIntervention,...x})=>x))}:null;
const report={observerEquivalence,head:source.head,source,sourceStable,measurementValid,startedUTC,completedUTC:new Date().toISOString(),wallSeconds:(performance.now()-started)/1000,command:process.argv,protocol:{name:protocol,seed:7,gravity:9.81,startGapM:5.6,opponent:protocol==='idle'?'zweihander normal construction, AI inputs held idle; no physical injection':'zweihander normal AI',playerEmotion:'harness neutral, not main emotion feedback',input:'normal hand deltas and joystick; distance protocol baseline holds1.15m via clamped analog stick and bounded replays exact recorded stick;  no transforms, forces, velocity, wound, armor or health injection',schedule,models:'v2/manual/fresh/centerline/limbON from creation; only bounded vs legacy varies'},comparisons,executionCount:rows.length,steps:rows.reduce((s,r)=>s+r.steps,0),rows:rows.map(r=>({weapon:r.weapon,mode:r.mode,artifact:r.artifact,steps:r.steps,startTick:r.startTick,firstInterventionTick:r.firstInterventionTick,interventions:r.interventions.length,terminal:r.terminal,checks:r.checks,error:r.error}))};
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');if(!measurementValid||(observerEquivalence&&!Object.entries(observerEquivalence).filter(([k])=>k.startsWith('all')).every(([,v])=>v)))process.exitCode=1;
