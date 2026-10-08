// Bounded real-engine contact comparison for the two formerly withheld thin
// two-hand weapons. The existing recut guard tape is reused, not tuned to win.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const [root,out]=process.argv.slice(2);
assert(root&&out&&path.isAbsolute(root)&&path.isAbsolute(out)&&!fs.existsSync(out));
const sha=x=>createHash('sha256').update(x).digest('hex');
const own='tools/sim/experiments/thin_v2_contact_20261008.mjs';
const names=fs.readdirSync(path.join(root,'src')).filter(n=>n.endsWith('.js')).sort().map(n=>`src/${n}`)
 .concat(own,'tools/sim/harness_m.mjs','tools/sim/experiments/recut_power_20261007_probe.mjs','package.json','package-lock.json');
const manifest=base=>Object.fromEntries(names.map(n=>[n,sha(fs.readFileSync(path.join(base,n)))]));
const sourceBefore=manifest(root),frozen=path.join(out,'source');
const head=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const write=(n,x)=>fs.writeFileSync(path.join(out,n),JSON.stringify(x,null,2)+'\n',{flag:'wx'});
for(const n of names){const d=path.join(frozen,n);fs.mkdirSync(path.dirname(d),{recursive:true});fs.copyFileSync(path.join(root,n),d);}
fs.symlinkSync(path.join(root,'node_modules'),path.join(frozen,'node_modules'),'dir');
assert.deepEqual(manifest(root),sourceBefore);assert.deepEqual(manifest(frozen),sourceBefore);
const schedule=[['ready',60,null],['raise',48,[.42,.42]],['raisedHold',24,null],['firstCut',30,[-.4,-.42]],['followHold',36,null],['reverse',48,[-.4,.42]],['reverseHold',24,null],['recut',30,[.38,-.44]],['recutHold',36,null],['raise2',48,[.42,.42]],['raisedHold2',24,null],['cut2',30,[-.4,-.42]],['followHold2',36,null],['release',120,null]];
const tape=schedule.flatMap(([phase,n,target])=>Array.from({length:n},()=>({phase,n,target,held:phase!=='release'})));
const protocol={seed:7,gapM:5.6,maxSteps:1600,weapons:['monohoshizao','lightsaber'],modes:['legacy','v2'],schedule,
 initial:'Normal Fighter construction, standing idle longsword opponent. No pose, velocity, force, health or wound injection.',
 input:'Existing recut guard tape. Legacy approaches after240steps and starts tape at <=2.8m pelvis distance; joystick tracks1.15m. v2 replays every requested dx/dy/held/active/stick literally, including approach timing. Release extended120steps to inspect residual contact spin.',
 config:'Player fresh stance/bounded roll/centerline cut; both fighters linked arm support; uncapped2.5 finishing power both; limbON/gravity9.81. Legacy player skill.7+autoGuard; v2 applied beforefirststep sets skill0 and manual arm model.',
 contact:'Only native Combat.strike/onWound events. Different trajectories and hit locations are not a matched-damage causality experiment.',
 spin:'Absolute axial angular velocity each step, peak and RMS; longest continuous duration over50rad/s, diagnostic threshold only (not human-normality or game clamp). Post-contact windows cover120steps, overlapdeduplicated.'};
write('protocol.json',{head,sourceBefore,protocol,argv:process.argv});
const load=f=>import(pathToFileURL(path.join(frozen,f)).href);
const {newRound,THREE,DT,CONFIG}=await load('tools/sim/harness_m.mjs');
const {applySwordsmanship,recordSwordsmanshipInput}=await load('src/swordsmanship.js');
assert(CONFIG.COMBAT.limbSeverTrial);assert.equal(CONFIG.PHYSICS.gravity,-9.81);
class Idle{update(){}}
const norm=v=>Math.hypot(v.x,v.y,v.z);
const health=f=>({alive:f.alive,armed:f.armed,gripValid:!!f.gripJoint?.isValid(),state:f.state,blood:f.blood,consciousness:f.consciousness,pain:f.pain,balance:f.balance,limbs:{...f.limbs},wounds:f.wounds.length,bleed:f.bleed,cloth:{...f.cloth},plate:{...f.plate},helmetIntegrity:f.helmetIntegrity});
const fields=['type','zone','energy','ephys','severity','pass','stuck','speed','quality','eff','thr','mFree','mEff','t','plate','helmet','finishPower','finishingStrike'];
const small=r=>Object.fromEntries(fields.map(k=>[k,r[k]]));
const rows=[],startedUTC=new Date().toISOString(),started=performance.now();
for(const weapon of protocol.weapons){
 let baselineTape=null,baselineStart=null;
 for(const mode of protocol.modes){
  const row={weapon,mode,steps:0,startTick:null,checks:{finite:true,models:true,inputAccepted:true},strikes:[],wounds:[],metrics:[],inputs:[],frames:[],terminal:null};rows.push(row);
  let G,tick=0,current=null,phaseOrigin=null,lastPhase=null;
  try{
   G=newRound({seed:protocol.seed,weapon,weapon2:'longsword',gap:protocol.gapM,walls:false,AIClass:Idle,skill:.7,
    onFighter:f=>{if(f.index===0){f.stanceMemoryModel='fresh';f.rollTargetModel='bounded';}f.armSupportModel='linked';f.onehandArmModel=f.index===0&&mode==='v2'?'manual':'legacy';}});
   const f=G.player,e=G.enemy,C=G.combat;
   f.skill.autoGuard=true;if(mode==='v2')assert(applySwordsmanship(f));f.canShove=true;
   C.cutReactionModel='centerline';C.cutReactionFighter=f;C.finishRuleModel='power';C.finishRuleFighter=null;
   row.spawnSHA256=sha(G.world.takeSnapshot());
   row.config={skill:f.skill.level,autoGuard:f.skill.autoGuard,arm:f.onehandArmModel,swordsmanship:f.swordsmanshipModel??'legacy',profile:f.swordsmanshipState?.profile.id??null};
   const strike=C.strike;
   C.strike=function(pr,p,passing){const attacker=pr.w.fighter,victim=pr.v.fighter,before=health(victim);const r=strike.call(this,pr,p,passing);
    if(r&&attacker===f)row.strikes.push({tick,phase:current.phase,active:f.inputActive,held:f.handHeld,part:pr.v.part,passing,before,after:health(victim),point:p.toArray(),...small(r)});return r;};
   G.onWound=(att,vic,r)=>{if(att===f)row.wounds.push({tick,phase:current.phase,active:f.inputActive,part:r.part,...small(r)});};
   G.before=()=>{
    const gap=new THREE.Vector3().copy(f.bodies.pelvis.translation()).distanceTo(new THREE.Vector3().copy(e.bodies.pelvis.translation()));
    if(mode==='legacy'&&row.startTick===null&&tick>=240&&gap<=2.8){row.startTick=tick;baselineStart=tick;}
    if(mode==='v2'&&tick===baselineStart)row.startTick=tick;
    let req;
    if(mode==='v2'){req=baselineTape[tick];assert(req);}else{
     const local=row.startTick===null?null:tick-row.startTick;
     const t=local===null?{phase:tick<240?'startLock':'approach',target:null,n:1,held:true}:tape[local];assert(t);
     if(t.phase!==lastPhase){phaseOrigin=f.handOffset.toArray();lastPhase=t.phase;}
     const [dx,dy]=t.target?t.target.map((v,i)=>(v-phaseOrigin[i])/t.n):[0,0];
     req={phase:t.phase,dx,dy,active:Math.abs(dx)+Math.abs(dy)>1e-5,held:t.held,stickY:tick<240?0:Math.max(-1,Math.min(1,(gap-1.15)*2))};
    }
    const allowed=f.alive&&f.armed;
    if(allowed){f.handOffset.x+=req.dx;f.handOffset.y+=req.dy;}
    f.handHeld=req.held;f.inputActive=req.active;
    const input={id:tick,timeS:G.t,dx:allowed?req.dx:0,dy:allowed?req.dy:0,held:req.held,active:req.active};
    const accepted=recordSwordsmanshipInput(f,input);row.checks.inputAccepted&&=accepted===(mode==='v2');
    f.move.set(0,f.alive?req.stickY:0);f.stickX=0;f.stickY=f.alive?req.stickY:0;
    current={tick,phase:req.phase,gapM:gap,requested:req,applied:{input,move:f.move.toArray()},player:health(f),enemy:health(e)};row.inputs.push(current);
   };
   for(tick=0;tick<protocol.maxSteps;tick++){
    if(mode==='v2'&&tick>=baselineTape.length){row.terminal={tick,reason:'replay_complete'};break;}
    if(row.startTick!==null&&tick>=row.startTick+tape.length){row.terminal={tick,reason:'full_tape'};break;}
    if(row.startTick===null&&tick>=960){row.terminal={tick,reason:'approach_timeout'};break;}
    G.step();row.steps++;
    const axis=new THREE.Vector3(0,1,0).applyQuaternion(new THREE.Quaternion().copy(f.sword.rotation()));
    row.metrics.push({tick,phase:current.phase,tipSpeedMps:norm(f.sword.velocityAtPoint(f.bladePoint(1,new THREE.Vector3()))),omegaRadps:norm(f.sword.angvel()),axialRadps:axis.dot(new THREE.Vector3().copy(f.sword.angvel())),player:health(f),enemy:health(e)});
    row.frames.push({tick,physics:sha(G.world.takeSnapshot()),requested:sha(JSON.stringify(current.requested)),applied:sha(JSON.stringify(current.applied))});
    row.checks.finite&&=G.world.bodies.getAll().every(b=>[b.translation(),b.rotation(),b.linvel(),b.angvel()].every(v=>Object.values(v).every(Number.isFinite)));
    row.checks.models&&=f.stanceMemoryModel==='fresh'&&f.rollTargetModel==='bounded'&&e.stanceMemoryModel!=='fresh'&&e.rollTargetModel!=='bounded'&&[f,e].every(x=>x.armSupportModel==='linked')&&f.skill.level===(mode==='v2'?0:.7)&&f.skill.autoGuard===(mode==='legacy')&&f.onehandArmModel===(mode==='v2'?'manual':'legacy')&&C.cutReactionModel==='centerline'&&C.finishRuleModel==='power'&&C.finishRuleFighter===null;
    if(!row.checks.finite)throw Error('Nonfinite');
    // Preserve a full open-loop tape after victim death for equal requests. No
    // later corpse hits count as live damage; any player loss is reported.
   }
   row.final={player:health(f),enemy:health(e),clashes:G.clashes};
   if(mode==='legacy')baselineTape=row.inputs.map(x=>x.requested);
  }catch(error){row.error={message:error.message,stack:error.stack};}
  finally{
   G?.eventQueue.free();G?.world.free();
   const name=`${weapon}-${mode}.json`;write(name,row);row.artifact={path:path.join(out,name),sha256:sha(fs.readFileSync(path.join(out,name)))};
   console.log(JSON.stringify({weapon,mode,steps:row.steps,start:row.startTick,strikes:row.strikes.length,wounds:row.wounds.length,liveCuts:row.strikes.filter(x=>x.type==='cut'&&x.active&&x.before.alive).map(x=>({tick:x.tick,phase:x.phase,part:x.part,energy:x.energy,severity:x.severity})),checks:row.checks,error:row.error}));
  }
 }
}
const spin=metrics=>{
 let run=0,longest=0;for(const m of metrics){run=Math.abs(m.axialRadps)>50?run+1:0;longest=Math.max(longest,run);}
 return {steps:metrics.length,peakAbsAxialRadps:Math.max(0,...metrics.map(m=>Math.abs(m.axialRadps))),rmsAxialRadps:Math.sqrt(metrics.reduce((s,m)=>s+m.axialRadps**2,0)/Math.max(1,metrics.length)),longestOver50S:longest*DT,peakTipSpeedMps:Math.max(0,...metrics.map(m=>m.tipSpeedMps))};
};
const comparisons=protocol.weapons.map(weapon=>{const[a,b]=rows.filter(r=>r.weapon===weapon);return{weapon,sameSpawn:a.spawnSHA256===b.spawnSHA256,sameStart:a.startTick===b.startTick,sameRequestedInput:JSON.stringify(a.inputs.map(x=>x.requested))===JSON.stringify(b.inputs.map(x=>x.requested)),sameAppliedInput:JSON.stringify(a.inputs.map(x=>x.applied))===JSON.stringify(b.inputs.map(x=>x.applied))};});
const sourceStable=JSON.stringify(manifest(frozen))===JSON.stringify(sourceBefore);
const report={head,startedUTC,finishedUTC:new Date().toISOString(),wallSeconds:(performance.now()-started)/1000,sourceBefore,sourceStable,protocol,comparisons,steps:rows.reduce((n,r)=>n+r.steps,0),measurementValid:sourceStable&&rows.every(r=>!r.error&&Object.values(r.checks).every(Boolean))&&comparisons.every(c=>c.sameSpawn&&c.sameStart&&c.sameRequestedInput&&c.sameAppliedInput),
 rows:rows.map(({metrics,frames,inputs,strikes,wounds,...row})=>({...row,requestedSHA256:sha(JSON.stringify(inputs.map(x=>x.requested))),strikes:strikes.length,wounds:wounds.length,firstContact:strikes[0]??null,liveActiveCuts:strikes.filter(s=>s.type==='cut'&&s.active&&s.before.alive),cutWounds:wounds.filter(s=>s.type==='cut'),spin:spin(metrics),postContactSpin:spin(metrics.filter(m=>strikes.some(s=>m.tick>=s.tick&&m.tick<s.tick+120))),releaseSpin:spin(metrics.filter(m=>m.phase==='release'))})),
 limitations:['Four deterministic authored traces on idle unarmored standing opponent; not win rate, armor validation or comprehensive human motion validation.','Same input and spawn do not imply same contact point/speed or matched damage.','Dead-opponent follow-through remains recorded and explicitly excluded from live cuts.','50rad/s is diagnostic only; finite/stand alone does not establish acceptable naturalness.']};
write('report.json',report);if(!report.measurementValid)process.exitCode=1;
